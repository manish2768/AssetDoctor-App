/**
 * Survive Android Activity recreation during ImagePicker camera/gallery & ML Kit scanning.
 * Without this, RN remounts at MainTabs/Home and feels like an auto-redirect.
 *
 * NEVER call navigate while the container is uninitialized — that throws
 * "The 'navigation' object hasn't been initialized yet" and crashes to Home.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef, safeNavigate } from '../navigation/navActions';
import { getRouteForCanonicalDocType, normalizeToCanonicalDocType } from '../types/assetDocumentTypes';

const KEY = '@assetdoctor/scan_session_v1';
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
let lastRestoredTs = null;
let restoreInFlight = false;
let activeScanSessionId = null;

/**
 * Confirmed existing screen routes registered in RootNavigator.jsx
 */
export const VALID_SCAN_ROUTES = Object.freeze([
  'ScanBill',
  'ReviewAsset',
  'ReviewInsurance',
  'ReviewPuc',
  'ReviewVehicleService',
  'ReviewElectricityBill',
  'ReviewGenericDocument',
  'OcrTest',
  'OcrDiagnostic',
]);

/**
 * Register the currently active in-memory scan session ID.
 */
export function setActiveScanSessionId(sessionId) {
  activeScanSessionId = sessionId || null;
}

/**
 * Retrieve the currently active in-memory scan session ID.
 */
export function getActiveScanSessionId() {
  return activeScanSessionId;
}

/**
 * Call right before opening camera/gallery, and when entering any Review screen.
 * @param {string} route
 * @param {object} [params]
 */
export async function markScanSession(route = 'ScanBill', params = {}) {
  try {
    const rawParams = params && typeof params === 'object' ? params : {};
    const scanSessionId = rawParams.scanSessionId || activeScanSessionId || `scan_${Date.now()}`;
    activeScanSessionId = scanSessionId;

    const docType = rawParams.documentType || rawParams.classifiedDocumentType || null;
    const canonicalDocType = docType ? normalizeToCanonicalDocType(docType) : null;

    let targetRoute = route;
    if (!VALID_SCAN_ROUTES.includes(targetRoute)) {
      if (canonicalDocType) {
        targetRoute = getRouteForCanonicalDocType(canonicalDocType);
      } else {
        targetRoute = 'ReviewAsset';
      }
    }

    const sessionRecord = {
      route: targetRoute,
      reviewRoute: targetRoute !== 'ScanBill' ? targetRoute : (rawParams.reviewRoute || null),
      documentType: canonicalDocType,
      scanSessionId,
      // Keep params lean — review payload without bulky base64
      params: rawParams,
      ts: Date.now(),
    };

    console.log(
      `[SCAN_NAV_DEBUG] markScanSession savedRoute=${sessionRecord.route} reviewRoute=${sessionRecord.reviewRoute} documentType=${sessionRecord.documentType} scanSessionId=${sessionRecord.scanSessionId}`,
    );

    await AsyncStorage.setItem(KEY, JSON.stringify(sessionRecord));
  } catch (error) {
    console.warn('[scanNavGuard] mark failed:', error?.message || error);
  }
}

/** Clear after explicit Close, successful save → Home, or stale session. */
export async function clearScanSession() {
  try {
    console.log(`[SCAN_NAV_DEBUG] clearScanSession activeScanSessionId=${activeScanSessionId}`);
    await AsyncStorage.removeItem(KEY);
    lastRestoredTs = null;
    activeScanSessionId = null;
  } catch (error) {
    console.warn('[scanNavGuard] clear failed:', error?.message || error);
  }
}

function waitForNavReady(timeoutMs = 4000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      try {
        if (navigationRef.isReady()) {
          resolve(true);
          return;
        }
      } catch {
        /* not ready */
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

/**
 * If the app remounted onto MainTabs after camera/recreation, bounce back to the appropriate screen.
 * Never leaves the user stranded on Home mid-scan.
 * Preserves specific document type review screens (ReviewInsurance, ReviewPuc, etc.).
 */
export async function restoreScanSessionIfNeeded() {
  if (restoreInFlight) return false;
  restoreInFlight = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return false;

    let saved;
    try {
      saved = JSON.parse(raw);
    } catch {
      await clearScanSession();
      return false;
    }

    const ts = Number(saved?.ts) || 0;
    if (!ts || Date.now() - ts > MAX_AGE_MS) {
      console.log(`[SCAN_NAV_DEBUG] Expired session discarded (age=${Date.now() - ts}ms)`);
      await clearScanSession();
      return false;
    }

    // Avoid restore loops for the exact same session timestamp
    if (lastRestoredTs === ts) return false;

    const ready = await waitForNavReady(4000);
    if (!ready) {
      console.warn('[scanNavGuard] navigator not ready — will retry later');
      setTimeout(() => {
        restoreScanSessionIfNeeded().catch(() => {});
      }, 500);
      return false;
    }

    // Stale session protection: if an active in-memory scan is running with a different ID, ignore stale disk cache
    const currentMatchesSaved = !activeScanSessionId || activeScanSessionId === saved.scanSessionId;
    const staleState = !currentMatchesSaved;

    console.log(
      `[SCAN_NAV_DEBUG] ActivityRecreated check savedRoute=${saved.route} reviewRoute=${saved.reviewRoute} documentType=${saved.documentType} scanSessionId=${saved.scanSessionId} staleState=${staleState} currentScanMatchesSavedState=${currentMatchesSaved}`,
    );

    if (staleState) {
      console.warn(
        `[SCAN_NAV_DEBUG] Discarding stale scan state: active=${activeScanSessionId} saved=${saved.scanSessionId}`,
      );
      await clearScanSession();
      return false;
    }

    // Resolve target route in priority order:
    // 1. saved.reviewRoute (if valid)
    // 2. Canonical documentType route resolution
    // 3. saved.route (if valid)
    // 4. Fallback to ScanBill
    let destination = 'ScanBill';

    if (saved.reviewRoute && VALID_SCAN_ROUTES.includes(saved.reviewRoute)) {
      destination = saved.reviewRoute;
    } else if (saved.documentType) {
      const canonicalType = normalizeToCanonicalDocType(saved.documentType);
      destination = getRouteForCanonicalDocType(canonicalType);
    } else if (saved.route && VALID_SCAN_ROUTES.includes(saved.route)) {
      destination = saved.route;
    }

    if (!VALID_SCAN_ROUTES.includes(destination)) {
      destination = 'ScanBill';
    }

    let current = null;
    try {
      current = navigationRef.getCurrentRoute?.()?.name;
    } catch (error) {
      console.warn('[scanNavGuard] getCurrentRoute:', error?.message || error);
    }

    // If we're already on the target route or on any valid review screen, do not interrupt
    if (current === destination || (destination !== 'ScanBill' && VALID_SCAN_ROUTES.includes(current) && current !== 'ScanBill')) {
      return false;
    }

    // Only restore when we landed on tabs / home after Activity kill
    const homeLike =
      !current ||
      ['MainTabs', 'Home', 'Dashboard', 'SettingsHome', 'AssetsHome', 'VaultHome'].includes(
        current,
      );
    if (!homeLike) return false;

    lastRestoredTs = ts;
    activeScanSessionId = saved.scanSessionId || null;

    console.log(
      `[SCAN_NAV_DEBUG] Restoring route after Activity recreate → ${destination} (scanSessionId=${saved.scanSessionId})`,
    );

    const ok = await safeNavigate(destination, saved.params || {});
    if (!ok) {
      lastRestoredTs = null;
      setTimeout(() => {
        if (navigationRef.isReady()) {
          safeNavigate(destination, saved.params || {}).catch(() => {});
        }
      }, 500);
    }
    return ok;
  } catch (error) {
    console.warn('[scanNavGuard] restore failed:', error?.message || error);
    return false;
  } finally {
    restoreInFlight = false;
  }
}

export default {
  VALID_SCAN_ROUTES,
  setActiveScanSessionId,
  getActiveScanSessionId,
  markScanSession,
  clearScanSession,
  restoreScanSessionIfNeeded,
};

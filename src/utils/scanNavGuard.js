/**
 * Survive Android Activity recreation during ImagePicker camera/gallery.
 * Without this, RN remounts at MainTabs/Home and feels like an auto-redirect.
 *
 * NEVER call navigate while the container is uninitialized — that throws
 * "The 'navigation' object hasn't been initialized yet" and crashes to Home.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { navigationRef, safeNavigate } from '../navigation/navActions';

const KEY = '@assetdoctor/scan_session_v1';
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
let lastRestoredTs = null;
let restoreInFlight = false;

/**
 * Call right before opening camera/gallery, and when entering Review.
 * @param {'ScanBill'|'ReviewAsset'} route
 * @param {object} [params]
 */
export async function markScanSession(route = 'ScanBill', params = {}) {
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({
        route: route === 'ReviewAsset' ? 'ReviewAsset' : 'ScanBill',
        // Keep params lean — Review may carry invoice fields but never base64
        params: params && typeof params === 'object' ? params : {},
        ts: Date.now(),
      }),
    );
  } catch (error) {
    console.warn('[scanNavGuard] mark failed:', error?.message || error);
  }
}

/** Clear after explicit Close, successful save → Home, or stale session. */
export async function clearScanSession() {
  try {
    await AsyncStorage.removeItem(KEY);
    lastRestoredTs = null;
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
 * If the app remounted onto MainTabs after camera, bounce back to Scan/Review.
 * Never leaves the user stranded on Home mid-scan.
 * Never throws if navigator is not initialized yet.
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
      await clearScanSession();
      return false;
    }

    // Avoid restore loops for the same session stamp
    if (lastRestoredTs === ts) return false;

    const ready = await waitForNavReady(4000);
    if (!ready) {
      console.warn('[scanNavGuard] navigator not ready — will retry later');
      // Soft retry once after remount settles
      setTimeout(() => {
        restoreScanSessionIfNeeded().catch(() => {});
      }, 500);
      return false;
    }

    const route = saved.route === 'ReviewAsset' ? 'ReviewAsset' : 'ScanBill';

    let current = null;
    try {
      current = navigationRef.getCurrentRoute?.()?.name;
    } catch (error) {
      console.warn('[scanNavGuard] getCurrentRoute:', error?.message || error);
    }

    if (current === 'ScanBill' || current === 'ReviewAsset') {
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
    console.warn('[scanNavGuard] restoring after Activity recreate →', route);

    const ok = await safeNavigate(route, saved.params || {});
    if (!ok) {
      // Allow another attempt on next AppState active
      lastRestoredTs = null;
      setTimeout(() => {
        if (navigationRef.isReady()) {
          safeNavigate(route, saved.params || {}).catch(() => {});
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
  markScanSession,
  clearScanSession,
  restoreScanSessionIfNeeded,
};

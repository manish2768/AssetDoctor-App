/**
 * Shared navigation ref + actions (avoids circular imports with screens).
 * All post-camera navigations must tolerate an uninitialized container
 * after Android Activity recreation.
 */

import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

const RETRY_DELAYS_MS = [0, 250, 500, 1000, 2000];

/**
 * Safe navigate — never throws "hasn't been initialized yet".
 * Retries briefly while the container remounts after camera Activity recreate.
 *
 * @param {string} name
 * @param {object} [params]
 * @returns {Promise<boolean>}
 */
export function safeNavigate(name, params = {}) {
  const attempt = (delayMs) =>
    new Promise((resolve) => {
      const run = () => {
        try {
          if (!navigationRef.isReady()) {
            resolve(false);
            return;
          }
          navigationRef.navigate(name, params);
          resolve(true);
        } catch (error) {
          console.warn('[nav] safeNavigate failed:', name, error?.message || error);
          resolve(false);
        }
      };
      if (delayMs <= 0) run();
      else setTimeout(run, delayMs);
    });

  return (async () => {
    for (const delay of RETRY_DELAYS_MS) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await attempt(delay);
      if (ok) return true;
    }
    // Last-resort CommonActions.dispatch once container is ready
    try {
      if (!navigationRef.isReady()) return false;
      navigationRef.dispatch(
        CommonActions.navigate({
          name,
          params,
        }),
      );
      return true;
    } catch (error) {
      console.error('[nav] safeNavigate dispatch failed:', name, error?.message || error);
      return false;
    }
  })();
}

/** Open the Assets tab list scoped to a stable category key. */
export function openAssetCategoryList(category = 'all') {
  const key = category && category !== 'all' ? String(category) : 'all';
  try {
    if (!navigationRef.isReady()) {
      setTimeout(() => {
        safeNavigate('Assets', { screen: 'AssetList', params: { category: key } }).catch(() => {});
      }, 150);
      return false;
    }
    navigationRef.navigate('Assets', { screen: 'AssetList', params: { category: key } });
    return true;
  } catch (error) {
    console.warn('[nav] openAssetCategoryList:', error?.message || error);
    safeNavigate('Assets', { screen: 'AssetList', params: { category: key } }).catch(() => {});
    return false;
  }
}

/** Open invoice scanner as root modal — never nests under Home tab. */
export function openScanInvoice(params = {}) {
  try {
    if (!navigationRef.isReady()) {
      setTimeout(() => {
        safeNavigate('ScanBill', params).catch(() => {});
      }, 500);
      return false;
    }
    navigationRef.navigate('ScanBill', params);
    return true;
  } catch (error) {
    console.warn('[nav] openScanInvoice:', error?.message || error);
    safeNavigate('ScanBill', params).catch(() => {});
    return false;
  }
}

/**
 * Open ReviewAsset ONLY — never MainTabs / Home / Dashboard / popToTop.
 * Scan → Next must always land on Review, even when OCR fails.
 */
export function openReviewInvoice(params = {}) {
  try {
    if (navigationRef.isReady()) {
      try {
        navigationRef.navigate('ReviewAsset', params);
        return true;
      } catch (navErr) {
        console.warn('[nav] openReviewInvoice navigate failed:', navErr?.message || navErr);
      }
      try {
        navigationRef.dispatch(
          CommonActions.navigate({
            name: 'ReviewAsset',
            params,
          }),
        );
        return true;
      } catch (error) {
        console.error('[nav] openReviewInvoice dispatch failed:', error?.message || error);
      }
    }
  } catch (error) {
    console.warn('[nav] openReviewInvoice not ready:', error?.message || error);
  }

  // Navigator not ready after Activity recreate — retry, never crash
  setTimeout(() => {
    safeNavigate('ReviewAsset', params).catch(() => {});
  }, 500);
  return false;
}

/** Re-open scanner for another attempt. */
export function openRescanInvoice(params = {}) {
  try {
    if (navigationRef.isReady()) {
      try {
        navigationRef.navigate('ScanBill', params);
        return true;
      } catch (error) {
        console.warn('[nav] openRescanInvoice failed:', error?.message || error);
      }
      try {
        navigationRef.dispatch(
          CommonActions.navigate({
            name: 'ScanBill',
            params,
          }),
        );
        return true;
      } catch {
        /* fall through */
      }
    }
  } catch (error) {
    console.warn('[nav] openRescanInvoice not ready:', error?.message || error);
  }
  setTimeout(() => {
    safeNavigate('ScanBill', params).catch(() => {});
  }, 500);
  return false;
}

/** Explicit Home navigation — ONLY for post-save / user Close, never Scan Next. */
export function goHomeDashboard() {
  try {
    // eslint-disable-next-line global-require
    require('../utils/scanNavGuard').clearScanSession();
  } catch {
    /* optional */
  }

  const go = () => {
    try {
      if (!navigationRef.isReady()) return false;
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        }),
      );
      return true;
    } catch (error) {
      console.warn('[nav] goHomeDashboard reset failed:', error?.message || error);
      try {
        if (!navigationRef.isReady()) return false;
        navigationRef.navigate('MainTabs', {
          screen: 'Home',
          params: { screen: 'Dashboard' },
        });
        return true;
      } catch (navErr) {
        console.warn('[nav] goHomeDashboard navigate failed:', navErr?.message || navErr);
        return false;
      }
    }
  };

  if (!navigationRef.isReady()) {
    setTimeout(() => {
      go();
    }, 500);
    return false;
  }
  return go();
}

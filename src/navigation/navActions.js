/**
 * Shared navigation ref + actions (avoids circular imports with screens).
 */

import { CommonActions, createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/** Open invoice scanner as root modal — never nests under Home tab. */
export function openScanInvoice(params = {}) {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate('ScanBill', params);
  return true;
}

/**
 * Open review with OCR payload.
 * Always reset root stack to MainTabs → ReviewAsset so fullScreenModal
 * sibling navigate cannot dismiss back to Home tabs (the "Next → Home" bug).
 */
export function openReviewInvoice(params = {}) {
  if (!navigationRef.isReady()) return false;
  try {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'ReviewAsset', params },
        ],
      }),
    );
    return true;
  } catch (error) {
    console.warn('[nav] openReviewInvoice reset failed:', error?.message || error);
    try {
      navigationRef.navigate('ReviewAsset', params);
      return true;
    } catch (navErr) {
      console.error('[nav] openReviewInvoice navigate failed:', navErr?.message || navErr);
      return false;
    }
  }
}

/** Re-open scanner for another attempt (clears review off the stack). */
export function openRescanInvoice(params = {}) {
  if (!navigationRef.isReady()) return false;
  try {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          { name: 'ScanBill', params },
        ],
      }),
    );
    return true;
  } catch (error) {
    console.warn('[nav] openRescanInvoice failed:', error?.message || error);
    navigationRef.navigate('ScanBill', params);
    return true;
  }
}

export function goHomeDashboard() {
  if (!navigationRef.isReady()) return false;
  try {
    // Clear Scan/Review modals, remount tabs on Home (Net Worth refreshes from assets).
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      }),
    );
    return true;
  } catch (error) {
    console.warn('[nav] goHomeDashboard reset failed:', error?.message || error);
    navigationRef.navigate('MainTabs', {
      screen: 'Home',
      params: { screen: 'Dashboard' },
    });
    return true;
  }
}

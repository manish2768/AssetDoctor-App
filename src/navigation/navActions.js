/**
 * Shared navigation ref + actions (avoids circular imports with screens).
 */

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/** Open invoice scanner as root modal — never nests under Home tab. */
export function openScanInvoice(params = {}) {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate('ScanBill', params);
  return true;
}

export function openReviewInvoice(params = {}) {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate('ReviewAsset', params);
  return true;
}

export function goHomeDashboard() {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate('MainTabs', {
    screen: 'Home',
    params: { screen: 'Dashboard' },
  });
  return true;
}

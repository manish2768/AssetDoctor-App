/**
 * Deep-link helper for notification taps (STEP 9).
 */

export function openNotificationDeepLink(navigationRef, response) {
  const data = response?.notification?.request?.content?.data || {};
  const assetId = data.assetId;
  if (!assetId) return false;
  if (!navigationRef?.isReady?.()) return false;

  const screen = data.screen || 'AssetPassport';
  const focusSection = data.focusSection || null;
  const params = { assetId, focusSection, field: data.field || null };

  navigationRef.navigate('MainTabs', {
    screen: 'Home',
    params: { screen: 'Dashboard', params: {} },
  });

  setTimeout(() => {
    if (!navigationRef.isReady()) return;
    const target =
      screen === 'Maintenance'
        ? 'Maintenance'
        : screen === 'DocumentsVault'
          ? 'DocumentsVault'
          : 'AssetPassport';
    navigationRef.navigate('MainTabs', {
      screen: 'Home',
      params: { screen: target, params },
    });
  }, 50);
  return true;
}

export default { openNotificationDeepLink };

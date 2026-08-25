/**
 * Locked Android / iOS identity for Play Store & App Store.
 * NEVER change `ANDROID_PACKAGE` after the first Play Console upload —
 * Google treats a new package as a different app (users cannot update in place).
 */

export const ANDROID_PACKAGE = 'com.assetdoctor.app';
export const IOS_BUNDLE_ID = 'com.assetdoctor.app';

/** Placeholder until the listing is live — update in Firestore app_config/android */
export const PLAY_STORE_URL_FALLBACK =
  'https://play.google.com/store/apps/details?id=com.assetdoctor.app';

export const APP_CONFIG_FIRESTORE_PATH = {
  collection: 'app_config',
  androidDoc: 'android',
};

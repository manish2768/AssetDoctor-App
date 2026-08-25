/**
 * Firebase Storage bucket + instance for Asset Doctor.
 * Default bucket matches google-services.json (new Firebase format).
 */

import storage from '@react-native-firebase/storage';

import { ENV } from './env';

/** Canonical default bucket (also present in google-services.json). */
export const DEFAULT_STORAGE_BUCKET =
  ENV.firebase?.storageBucket || 'assetdoctor-5fd25-vault';

/** gs:// URL used by RN Firebase when selecting a bucket explicitly. */
export function storageBucketGsUrl(bucket = DEFAULT_STORAGE_BUCKET) {
  const cleaned = String(bucket || DEFAULT_STORAGE_BUCKET)
    .trim()
    .replace(/^gs:\/\//i, '');
  return `gs://${cleaned}`;
}

/**
 * Storage instance pinned to the project bucket.
 * Falls back to the default app bucket from google-services.json.
 */
export function getAppStorage() {
  const gs = storageBucketGsUrl();
  try {
    // RN Firebase: storage('gs://bucket') when hasCustomUrlOrRegionSupport
    return storage(gs);
  } catch {
    try {
      return storage().app.storage(gs);
    } catch {
      return storage();
    }
  }
}

export function storageRef(path) {
  return getAppStorage().ref(String(path || '').replace(/^\/+/, ''));
}

export default {
  DEFAULT_STORAGE_BUCKET,
  storageBucketGsUrl,
  getAppStorage,
  storageRef,
};

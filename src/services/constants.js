/**
 * Asset Doctor — Shared constants (Auth, Assets, OCR)
 */

export const COLLECTIONS = {
  USERS: 'Users',
  /** Subcollection under Users/{uid}/Assets */
  ASSETS: 'Assets',
};

export const STORAGE_PATHS = {
  /** users/{userId}/bills/{fileName} */
  bills: (userId, fileName) => `users/${userId}/bills/${fileName}`,
};

/** Default display name when Google/Phone profile has none */
export const DEFAULT_DISPLAY_NAME = 'Asset Owner';

/** Asset categories used across OCR + vault */
export const ASSET_CATEGORIES = Object.freeze({
  VEHICLE: 'Vehicle',
  ELECTRONICS: 'Electronics',
  PROPERTY: 'Property',
  GENERAL: 'General',
});

/**
 * Strict OCR allowlist — extract ONLY these fields.
 * Any other ML Kit tokens must be ignored.
 */
export const OCR_FIELDS = Object.freeze([
  'assetName',
  'storeName',
  'purchaseDate',
  'serialNumber',
  'chassisNumber',
  'warrantyExpiry',
  'insuranceExpiry',
]);

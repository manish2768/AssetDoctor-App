/**
 * Asset Doctor — Shared constants (Auth, Assets, OCR)
 */

export const COLLECTIONS = {
  USERS: 'Users',
  /** Subcollection under Users/{uid}/Assets */
  ASSETS: 'Assets',
};

export const STORAGE_PATHS = {
  /** users/{userId}/bills/{fileName} — legacy */
  bills: (userId, fileName) => `users/${userId}/bills/${fileName}`,
  /** Preferred invoice scan path */
  vaultInvoice: (userId, stamp = Date.now()) =>
    `vault_invoices/${String(userId).replace(/[^a-zA-Z0-9_-]/g, '_')}/${stamp}.jpg`,
};

/** Default display name when Google/Phone profile has none */
export const DEFAULT_DISPLAY_NAME = 'Asset Owner';

/** Asset categories used across OCR + vault */
export const ASSET_CATEGORIES = Object.freeze({
  VEHICLES: 'Vehicles',
  ELECTRONICS_APPLIANCES: 'Electronics & Appliances',
  PROPERTY_HOME: 'Digital Bills & Utility Subscriptions',
  PERSONAL_LEGAL: 'Personal & Legal',
  // Compatibility aliases while existing records are normalized on edit.
  VEHICLE: 'Vehicles',
  ELECTRONICS: 'Electronics & Appliances',
  PROPERTY: 'Digital Bills & Utility Subscriptions',
  DIGITAL_BILLS: 'Digital Bills & Utility Subscriptions',
  GENERAL: 'Personal & Legal',
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

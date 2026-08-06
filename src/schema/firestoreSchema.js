/**
 * Asset Doctor — Firestore Schema (v4 — household/vehicle vault)
 */

export const SCHEMA_VERSION = 4;

/**
 * Users/{uid}
 *   + Vendors/{vendorId}
 *   + Assets/{assetId}
 *       Documents | ServiceSchedules | RepairLogs
 *   + PowerLogs/{logId}
 * mail_queue | notification_logs
 */

export const PATHS = {
  user: (uid) => `Users/${uid}`,
  vendors: (uid) => `Users/${uid}/Vendors`,
  assets: (uid) => `Users/${uid}/Assets`,
  asset: (uid, assetId) => `Users/${uid}/Assets/${assetId}`,
  documents: (uid, assetId) => `Users/${uid}/Assets/${assetId}/Documents`,
  serviceSchedules: (uid, assetId) => `Users/${uid}/Assets/${assetId}/ServiceSchedules`,
  repairLogs: (uid, assetId) => `Users/${uid}/Assets/${assetId}/RepairLogs`,
  powerLogs: (uid) => `Users/${uid}/PowerLogs`,
  mailQueue: 'mail_queue',
  notificationLogs: 'notification_logs',
};

/** Canonical asset document (write this shape from the app) */
export const ASSET_FIELDS = {
  // identity
  assetId: 'string',
  assetName: 'string',
  categoryId: 'string',
  category: 'string',
  categoryLabel: 'string',
  icon: 'string',
  status: 'active|in_repair|retired|sold',
  // purchase
  storeName: 'string',
  vendorId: 'string|null',
  brandName: 'string',
  supportPhone: 'string',
  supportUrl: 'string',
  purchaseDate: 'YYYY-MM-DD|null',
  value: 'number',
  condition: 'excellent|good|fair|poor',
  // identifiers
  serialNumber: 'string',
  chassisNumber: 'string',
  registration: 'string',
  // expiries
  warrantyExpiry: 'YYYY-MM-DD|null',
  insuranceExpiry: 'YYYY-MM-DD|null',
  pucExpiry: 'YYYY-MM-DD|null',
  nextServiceDue: 'YYYY-MM-DD|null',
  // ownership costs
  annualInsurancePremium: 'number',
  insurancePremiumTotal: 'number',
  salePrice: 'number',
  soldAt: 'YYYY-MM-DD|null',
  // depreciation / TCO caches (recomputed on write)
  bookValue: 'number',
  accumulatedDepreciation: 'number',
  tco: 'number',
  healthScore: 'number',
  healthGrade: 'string',
  estimatedResale: 'number',
  // power
  powerWatts: 'number',
  powerFactor: 'number 0.3–1.0',
  dailyHours: 'number',
  // media
  billImageUrl: 'string',
  billStoragePath: 'string',
  hasBill: 'boolean',
  // Sweet Bill / Cloud Vision invoice capture (optional)
  invoiceMeta: 'object|null',
  // sync / soft delete
  clientUpdatedAt: 'ISO string',
  pendingSync: 'boolean',
  deletedAt: 'Timestamp|null',
  createdAt: 'Timestamp',
  updatedAt: 'Timestamp',
};

export const EXAMPLE_VENDOR = {
  vendorId: 'vnd_01',
  name: 'TVS Authorized Service',
  type: 'workshop',
  phone: '+9198XXXXXXXX',
  email: '',
  address: 'Lucknow',
  gstin: '',
  notes: '',
};

export const EXAMPLE_ASSET = {
  assetId: 'asset_01',
  assetName: 'TVS Ronin 225 TD',
  categoryId: 'bike',
  category: 'Vehicles',
  status: 'active',
  vendorId: 'vnd_01',
  value: 172000,
  purchaseDate: '2024-06-12',
  insuranceExpiry: '2026-08-01',
  annualInsurancePremium: 4500,
  bookValue: 132000,
  tco: 178500,
  estimatedResale: 98000,
  pendingSync: false,
  deletedAt: null,
};

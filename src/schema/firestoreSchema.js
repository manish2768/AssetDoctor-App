/**
 * Asset Doctor — Firestore Schema (v5 — universal asset intelligence)
 */

export const SCHEMA_VERSION = 5;

/**
 * Users/{uid}
 *   + Vendors/{vendorId}
 *   + Locations/{locationId}          (hierarchy: parentId + path)
 *   + Assets/{assetId}
 *       Documents | ServiceSchedules | RepairLogs | serviceHistory | LocationHistory
 *   + PowerLogs/{logId}
 * mail_queue | notification_logs
 *
 * Asset identity:
 *   assetId        — Firestore doc id (asset_*)
 *   publicAssetId  — permanent human/QR code AST-XX-HEX (never changes)
 *   nickname       — friendly name (Master Bedroom AC)
 *   locationId / locationPath — physical placement
 *
 * Extensible:
 *   specifications  — map of { value, unit, source, confidence, verified }
 *   batteryProfile  — health / capacity / cycles (Estimated vs Actual)
 *   energyProfile   — consumption / cost estimates + calculationMethod
 *   assetCategory / vehicleType / powertrain — taxonomy (EV = powertrain)
 *   assetHealthScore — reserved (null until scoring ships)
 */

export const PATHS = {
  user: (uid) => `Users/${uid}`,
  vendors: (uid) => `Users/${uid}/Vendors`,
  locations: (uid) => `Users/${uid}/Locations`,
  assets: (uid) => `Users/${uid}/Assets`,
  asset: (uid, assetId) => `Users/${uid}/Assets/${assetId}`,
  documents: (uid, assetId) => `Users/${uid}/Assets/${assetId}/Documents`,
  serviceSchedules: (uid, assetId) => `Users/${uid}/Assets/${assetId}/ServiceSchedules`,
  repairLogs: (uid, assetId) => `Users/${uid}/Assets/${assetId}/RepairLogs`,
  serviceHistory: (uid, assetId) => `Users/${uid}/Assets/${assetId}/serviceHistory`,
  locationHistory: (uid, assetId) => `Users/${uid}/Assets/${assetId}/LocationHistory`,
  powerLogs: (uid) => `Users/${uid}/PowerLogs`,
  reminders: 'reminders',
  mailQueue: 'mail_queue',
  notificationLogs: 'notification_logs',
};

/** Canonical asset document (write this shape from the app) */
export const ASSET_FIELDS = {
  // identity
  assetId: 'string',
  publicAssetId: 'string AST-XX-HEX permanent',
  assetCode: 'string alias of publicAssetId',
  assetName: 'string',
  nickname: 'string friendly physical name',
  categoryId: 'string',
  category: 'string',
  categoryLabel: 'string',
  icon: 'string',
  status: 'active|in_repair|retired|sold',
  // taxonomy
  assetCategory: 'VEHICLE|HOME_APPLIANCE|GADGET|OTHER',
  vehicleType: 'CAR|BIKE|SCOOTER|COMMERCIAL|OTHER|null',
  powertrain: 'PETROL|DIESEL|CNG|HYBRID|ELECTRIC|OTHER|null',
  subcategory: 'string',
  applianceType: 'string|null',
  gadgetType: 'string|null',
  // physical placement
  locationId: 'string|null',
  locationPath: 'string',
  locationAssignedAt: 'Timestamp|null',
  // purchase
  storeName: 'string',
  vendorId: 'string|null',
  brandName: 'string',
  supportPhone: 'string',
  supportUrl: 'string',
  purchaseDate: 'YYYY-MM-DD|null',
  value: 'number',
  purchasePrice: 'number',
  condition: 'excellent|good|fair|poor',
  // identifiers
  serialNumber: 'string',
  chassisNumber: 'string',
  registration: 'string',
  imei: 'string',
  // extensible metadata
  specifications: 'map key → {value,unit,source,confidence,verified}',
  batteryProfile: 'object|null',
  energyProfile: 'object|null',
  assetHealthScore: 'number|null reserved',
  assetHealthScoreVersion: 'number',
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
  assetHealthScore: 'number|null',
  assetHealthScoreVersion: 'number',
  healthBand: 'Excellent|Good|Needs Attention|At Risk|Critical',
  healthBreakdown: 'object|null factor → {earned,max,label}',
  healthWhy: 'string[]',
  healthHistory: 'array|{score,at} monthly snapshots',
  estimatedResale: 'number',
  currentEstimatedValue: 'number estimated — not market guarantee',
  // power (legacy flat fields — keep for EnergyService compatibility)
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
  syncStatus: 'SYNCED|PENDING_CREATE|PENDING_UPDATE|PENDING_DELETE|PENDING_UPLOAD|SYNC_FAILED|CONFLICT',
  version: 'number optimistic concurrency',
  lastSyncedAt: 'ISO string|null',
  operationId: 'string idempotency key|null',
  deletedAt: 'Timestamp|null',
  createdAt: 'Timestamp',
  updatedAt: 'Timestamp',
};

/** ServiceRecord shape (persisted via RepairLogs + normalized in ServiceRecordService) */
export const SERVICE_RECORD_FIELDS = {
  id: 'string',
  ownerUid: 'string',
  assetId: 'string',
  serviceDate: 'YYYY-MM-DD|null',
  serviceType: 'string',
  serviceProvider: 'string',
  technician: 'string',
  description: 'string',
  complaint: 'string',
  workPerformed: 'string',
  partsReplaced: 'array',
  labourCost: 'number',
  partsCost: 'number',
  tax: 'number',
  totalAmount: 'number',
  odometer: 'number|null',
  documentId: 'string|null',
  nextServiceDate: 'YYYY-MM-DD|null',
  warrantyOnRepair: 'string|null',
  notes: 'string',
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
  publicAssetId: 'AST-BK-7F29A1',
  assetCode: 'AST-BK-7F29A1',
  assetName: 'TVS Ronin 225 TD',
  nickname: 'Garage Bike',
  categoryId: 'bike',
  category: 'Vehicles',
  assetCategory: 'VEHICLE',
  vehicleType: 'BIKE',
  powertrain: 'PETROL',
  locationPath: 'Home → Garage',
  status: 'active',
  vendorId: 'vnd_01',
  value: 172000,
  purchaseDate: '2024-06-12',
  insuranceExpiry: '2026-08-01',
  annualInsurancePremium: 4500,
  bookValue: 132000,
  tco: 178500,
  estimatedResale: 98000,
  specifications: {},
  batteryProfile: null,
  energyProfile: null,
  assetHealthScore: null,
  pendingSync: false,
  deletedAt: null,
};

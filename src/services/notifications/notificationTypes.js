/**
 * STEP 9 — Notification type catalog, priority, identity, default offsets.
 * Extensible: add types without scattering logic across screens.
 */

export const NOTIFICATION_TYPE = Object.freeze({
  INSURANCE_EXPIRY: 'INSURANCE_EXPIRY',
  PUC_EXPIRY: 'PUC_EXPIRY',
  WARRANTY_EXPIRY: 'WARRANTY_EXPIRY',
  EXTENDED_WARRANTY_EXPIRY: 'EXTENDED_WARRANTY_EXPIRY',
  SERVICE_DUE: 'SERVICE_DUE',
  MAINTENANCE_DUE: 'MAINTENANCE_DUE',
  BATTERY_HEALTH: 'BATTERY_HEALTH',
  ASSET_HEALTH: 'ASSET_HEALTH',
  DOCUMENT_EXPIRY: 'DOCUMENT_EXPIRY',
  ENERGY_ALERT: 'ENERGY_ALERT',
  SYNC_ALERT: 'SYNC_ALERT',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
});

export const NOTIFICATION_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const NOTIFICATION_STATUS = Object.freeze({
  UNREAD: 'UNREAD',
  READ: 'READ',
  DISMISSED: 'DISMISSED',
  ACTIONED: 'ACTIONED',
  EXPIRED: 'EXPIRED',
  SCHEDULED: 'SCHEDULED',
});

/** STEP 9 default reminder offsets (days before event; 0 = day of). */
export const DEFAULT_REMINDER_OFFSETS = Object.freeze([30, 15, 7, 3, 1, 0]);

export const FIELD_TO_TYPE = Object.freeze({
  insuranceExpiry: NOTIFICATION_TYPE.INSURANCE_EXPIRY,
  pucExpiry: NOTIFICATION_TYPE.PUC_EXPIRY,
  warrantyExpiry: NOTIFICATION_TYPE.WARRANTY_EXPIRY,
  extendedWarrantyExpiry: NOTIFICATION_TYPE.EXTENDED_WARRANTY_EXPIRY,
  nextServiceDue: NOTIFICATION_TYPE.SERVICE_DUE,
});

export const TYPE_TO_FIELD = Object.freeze({
  [NOTIFICATION_TYPE.INSURANCE_EXPIRY]: 'insuranceExpiry',
  [NOTIFICATION_TYPE.PUC_EXPIRY]: 'pucExpiry',
  [NOTIFICATION_TYPE.WARRANTY_EXPIRY]: 'warrantyExpiry',
  [NOTIFICATION_TYPE.EXTENDED_WARRANTY_EXPIRY]: 'extendedWarrantyExpiry',
  [NOTIFICATION_TYPE.SERVICE_DUE]: 'nextServiceDue',
});

export const TYPE_TO_PREF_KEY = Object.freeze({
  [NOTIFICATION_TYPE.INSURANCE_EXPIRY]: 'Insurance',
  [NOTIFICATION_TYPE.PUC_EXPIRY]: 'PUC',
  [NOTIFICATION_TYPE.WARRANTY_EXPIRY]: 'Warranty',
  [NOTIFICATION_TYPE.EXTENDED_WARRANTY_EXPIRY]: 'Warranty',
  [NOTIFICATION_TYPE.SERVICE_DUE]: 'Service',
  [NOTIFICATION_TYPE.MAINTENANCE_DUE]: 'Service',
  [NOTIFICATION_TYPE.BATTERY_HEALTH]: 'Battery',
  [NOTIFICATION_TYPE.ASSET_HEALTH]: 'Health',
  [NOTIFICATION_TYPE.DOCUMENT_EXPIRY]: 'Document',
  [NOTIFICATION_TYPE.ENERGY_ALERT]: 'Energy',
  [NOTIFICATION_TYPE.SYNC_ALERT]: 'System',
  [NOTIFICATION_TYPE.SYSTEM_ALERT]: 'System',
});

export const TYPE_DEEP_LINK = Object.freeze({
  [NOTIFICATION_TYPE.INSURANCE_EXPIRY]: { screen: 'AssetPassport', focusSection: 'insurance' },
  [NOTIFICATION_TYPE.PUC_EXPIRY]: { screen: 'AssetPassport', focusSection: 'puc' },
  [NOTIFICATION_TYPE.WARRANTY_EXPIRY]: { screen: 'AssetPassport', focusSection: 'warranty' },
  [NOTIFICATION_TYPE.EXTENDED_WARRANTY_EXPIRY]: {
    screen: 'AssetPassport',
    focusSection: 'warranty',
  },
  [NOTIFICATION_TYPE.SERVICE_DUE]: { screen: 'Maintenance', focusSection: 'service' },
  [NOTIFICATION_TYPE.MAINTENANCE_DUE]: { screen: 'Maintenance', focusSection: 'maintenance' },
  [NOTIFICATION_TYPE.BATTERY_HEALTH]: { screen: 'AssetPassport', focusSection: 'battery' },
  [NOTIFICATION_TYPE.ASSET_HEALTH]: { screen: 'AssetPassport', focusSection: 'health' },
  [NOTIFICATION_TYPE.DOCUMENT_EXPIRY]: { screen: 'DocumentsVault', focusSection: 'documents' },
  [NOTIFICATION_TYPE.ENERGY_ALERT]: { screen: 'AssetPassport', focusSection: 'energy' },
});

/**
 * Unique identity — prevents duplicate generation across launches/sync.
 * Format: userId|assetId|type|eventDate|offset
 */
export function makeNotificationIdentity({
  userId,
  assetId,
  notificationType,
  eventDate,
  reminderOffset,
}) {
  const uid = String(userId || 'local');
  const aid = String(assetId || 'unknown');
  const typ = String(notificationType || 'SYSTEM_ALERT');
  const edt = String(eventDate || '').slice(0, 10) || 'none';
  const off = Number.isFinite(Number(reminderOffset)) ? String(Number(reminderOffset)) : 'x';
  return `${uid}|${aid}|${typ}|${edt}|${off}`;
}

export function resolvePriority(daysLeft) {
  if (daysLeft == null || Number.isNaN(Number(daysLeft))) return NOTIFICATION_PRIORITY.LOW;
  const d = Number(daysLeft);
  if (d < 0) return NOTIFICATION_PRIORITY.CRITICAL;
  if (d <= 3) return NOTIFICATION_PRIORITY.HIGH;
  if (d <= 15) return NOTIFICATION_PRIORITY.MEDIUM;
  return NOTIFICATION_PRIORITY.LOW;
}

export function deepLinkFor(type, assetId) {
  const base = TYPE_DEEP_LINK[type] || { screen: 'AssetPassport', focusSection: null };
  return {
    screen: base.screen,
    assetId,
    focusSection: base.focusSection,
    notificationType: type,
  };
}

export default {
  NOTIFICATION_TYPE,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_STATUS,
  DEFAULT_REMINDER_OFFSETS,
  FIELD_TO_TYPE,
  TYPE_TO_FIELD,
  TYPE_TO_PREF_KEY,
  makeNotificationIdentity,
  resolvePriority,
  deepLinkFor,
};

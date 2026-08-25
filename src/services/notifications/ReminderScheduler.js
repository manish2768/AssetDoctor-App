/**
 * STEP 9 — ReminderScheduler
 * Creates/cancels/reschedules via existing ExpiryAlertService (no duplicate scheduler).
 */

import { ExpiryAlertService } from './ExpiryAlertService';
import { DEFAULT_REMINDER_OFFSETS, TYPE_TO_FIELD, NOTIFICATION_TYPE } from './notificationTypes';
import { resolveNotificationRecipients } from './notificationRules';

/**
 * Unified offsets used by local Expo schedules (STEP 9 default).
 * ExpiryAlertService reads EXPIRY_ALERT_PROFILES from branding — keep branding in sync.
 */
export function unifiedOffsetsForField(field, prefs = {}) {
  const typeMap = {
    insuranceExpiry: NOTIFICATION_TYPE.INSURANCE_EXPIRY,
    pucExpiry: NOTIFICATION_TYPE.PUC_EXPIRY,
    warrantyExpiry: NOTIFICATION_TYPE.WARRANTY_EXPIRY,
    extendedWarrantyExpiry: NOTIFICATION_TYPE.EXTENDED_WARRANTY_EXPIRY,
    nextServiceDue: NOTIFICATION_TYPE.SERVICE_DUE,
  };
  const type = typeMap[field];
  const custom = prefs?.reminderOffsets?.[type] || prefs?.reminderOffsets?.default;
  if (Array.isArray(custom) && custom.length) {
    return custom.map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  }
  return [...DEFAULT_REMINDER_OFFSETS];
}

export class ReminderScheduler {
  /** Schedule all local reminders for one asset (owner device). */
  static async scheduleForAsset(asset, opts = {}) {
    if (!asset) return { success: false };
    const actor = opts.userId || asset.ownerUid || asset.uid;
    const routing = resolveNotificationRecipients(asset, actor);
    // Only schedule local OS notifications for the current user if they are a recipient
    if (actor && routing.recipients.length && !routing.recipients.includes(actor)) {
      await ExpiryAlertService.clearResolvedExpiryAlerts(asset.assetId || asset.id, [
        'insuranceExpiry',
        'pucExpiry',
        'warrantyExpiry',
        'extendedWarrantyExpiry',
        'nextServiceDue',
      ]);
      return { success: true, skipped: true, reason: 'not_recipient' };
    }
    return ExpiryAlertService.scheduleForAsset(asset);
  }

  static async syncPortfolio(assets = [], opts = {}) {
    const list = (assets || []).filter((a) => a && !a.deletedAt);
    await ExpiryAlertService.syncPortfolioAlerts(list);
    return { success: true, count: list.length };
  }

  /** After renew / date change — cancel stale then reschedule. */
  static async rescheduleAsset(asset, changedFields = [], opts = {}) {
    const id = asset?.assetId || asset?.id;
    if (!id) return { success: false };
    const fields =
      changedFields.length > 0
        ? changedFields
        : [
            'insuranceExpiry',
            'pucExpiry',
            'warrantyExpiry',
            'extendedWarrantyExpiry',
            'nextServiceDue',
          ];
    await ExpiryAlertService.clearResolvedExpiryAlerts(id, fields);
    return this.scheduleForAsset(asset, opts);
  }

  /** Soft-delete / sold — cancel all expiry reminders for asset. */
  static async cancelForAsset(assetId) {
    if (!assetId) return { success: false };
    await ExpiryAlertService.clearResolvedExpiryAlerts(
      assetId,
      [
        'insuranceExpiry',
        'pucExpiry',
        'warrantyExpiry',
        'extendedWarrantyExpiry',
        'nextServiceDue',
      ],
      { allOffsets: true },
    );
    return { success: true };
  }

  static fieldForType(type) {
    return TYPE_TO_FIELD[type] || null;
  }
}

export default ReminderScheduler;

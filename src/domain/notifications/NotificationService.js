import NotificationProvider, { NOTIFICATION_CHANNEL } from './NotificationProvider';

export const REMINDER_TYPE = Object.freeze({
  WARRANTY_EXPIRY: 'WARRANTY_EXPIRY',
  INSURANCE_EXPIRY: 'INSURANCE_EXPIRY',
  PUC_EXPIRY: 'PUC_EXPIRY',
  SERVICE_DUE: 'SERVICE_DUE',
  AMC_EXPIRY: 'AMC_EXPIRY',
  DOCUMENT_EXPIRY: 'DOCUMENT_EXPIRY',
  PAYMENT_REMINDER: 'PAYMENT_REMINDER',
  OTHER_ASSET_EVENT: 'OTHER_ASSET_EVENT',
});

/** Default lead times — configuration-driven, not hardcoded in UI. */
export const DEFAULT_REMINDER_OFFSETS_DAYS = Object.freeze([30, 15, 7, 1, 0]);

/**
 * Orchestrates template selection, consent, and provider dispatch.
 * Server-side implementations plug in real WhatsApp/email providers later.
 */
export class NotificationService {
  /**
   * @param {{ providers?: Record<string, NotificationProvider>, preferenceService?: object, templateService?: object, scheduler?: object }} deps
   */
  constructor(deps = {}) {
    this.providers = deps.providers || {};
    this.preferenceService = deps.preferenceService || null;
    this.templateService = deps.templateService || null;
    this.scheduler = deps.scheduler || null;
  }

  registerProvider(channel, provider) {
    this.providers[channel] = provider;
  }

  /** Schedule asset reminder events — no outbound call until provider configured. */
  scheduleReminderEvent(event) {
    if (!this.scheduler) return { scheduled: false, reason: 'no_scheduler' };
    return this.scheduler.enqueue(event);
  }

  /** Resolve preferred channel (WhatsApp when consented). */
  async resolveChannel(userId) {
    if (this.preferenceService?.getPreferredChannel) {
      return this.preferenceService.getPreferredChannel(userId);
    }
    return NOTIFICATION_CHANNEL.PUSH;
  }
}

export default NotificationService;

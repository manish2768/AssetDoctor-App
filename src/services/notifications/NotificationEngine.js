/**
 * STEP 9 — Centralized NotificationEngine
 * Asset/Data → Rules → Center + ReminderScheduler
 * Does not replace ExpiryAlertService; orchestrates it.
 */

import {
  getNotificationPrefs,
  upsertInsights,
  listNotificationCenter,
  markAlertStatus,
  unreadCount,
  setNotificationPrefs,
} from '../health/notificationCenter';
import { evaluatePortfolioNotifications, buildUpcomingSummary, resolveNotificationRecipients } from './notificationRules';
import { ReminderScheduler } from './ReminderScheduler';
import {
  NOTIFICATION_STATUS,
  NOTIFICATION_PRIORITY,
  makeNotificationIdentity,
} from './notificationTypes';

function inQuietHours(prefs, now = new Date()) {
  if (!prefs?.quietHoursEnabled) return false;
  const start = Number(prefs.quietHoursStart ?? 22); // 22:00
  const end = Number(prefs.quietHoursEnd ?? 7); // 07:00
  const hour = now.getHours();
  if (start === end) return false;
  if (start > end) {
    // e.g. 22 → 7
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

export class NotificationEngine {
  /**
   * Evaluate portfolio, write in-app center (deduped), refresh local schedules.
   */
  static async refreshForUser(userId, assets = [], opts = {}) {
    const prefs = await getNotificationPrefs();
    const list = (assets || []).filter((a) => a && !a.deletedAt);

    // Security: only process assets owned by / addressed to this user
    const scoped = list.filter((a) => {
      const owner = a.ownerUid || a.uid;
      if (!userId) return true;
      if (owner && owner !== userId) {
        const routing = resolveNotificationRecipients(a, userId);
        return routing.recipients.includes(userId);
      }
      return true;
    });

    const candidates = evaluatePortfolioNotifications(scoped, {
      userId,
      prefs,
      now: opts.now,
    });

    // Quiet hours: still upsert in-app center; skip marking as push-ready for non-critical
    const forCenter = candidates.map((c) => {
      const quiet = inQuietHours(prefs);
      const critical = c.priority === NOTIFICATION_PRIORITY.CRITICAL;
      return {
        ...c,
        status: NOTIFICATION_STATUS.UNREAD,
        suppressPush: quiet && !critical && prefs.quietHoursBlockNonCritical !== false,
        privacyMode: prefs.lockScreenPrivacy === 'generic',
      };
    });

    await upsertInsights(forCenter, userId);

    if (!opts.skipLocalSchedule) {
      await ReminderScheduler.syncPortfolio(scoped, { userId });
    }

    // Asynchronously dispatch WhatsApp notifications for eligible expiry milestones
    if (userId && candidates.length > 0 && !inQuietHours(prefs)) {
      (async () => {
        try {
          const { UserService } = await import('../user/UserService.js');
          const userProfile = await UserService.getProfile(userId);
          const phone = userProfile?.normalizedPhoneNumber || userProfile?.phoneNumber || userProfile?.phone;
          if (phone && userProfile?.whatsappOptIn !== false) {
            const { WhatsAppService } = await import('../whatsapp/WhatsAppService.js');
            for (const c of candidates) {
              if ([30, 15, 7, 1].includes(c.daysLeft)) {
                const targetAsset = scoped.find((a) => (a.id || a.uid) === c.assetId);
                const vehicleName = targetAsset?.registrationNumber || targetAsset?.assetName || 'Asset';
                let docType = 'Document';
                if (c.notificationType?.includes('INSURANCE')) docType = 'Insurance';
                else if (c.notificationType?.includes('PUC')) docType = 'PUC';
                else if (c.notificationType?.includes('WARRANTY')) docType = 'Warranty';

                await WhatsAppService.sendExpiryReminder({
                  userId,
                  phone,
                  customerName: userProfile?.name || 'Valued Member',
                  vehicleName,
                  docType,
                  expiryDate: c.eventDate || new Date().toISOString().slice(0, 10),
                  assetId: c.assetId,
                }).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.warn('[NotificationEngine] WhatsApp dispatch note:', e?.message);
        }
      })();
    }

    const center = await listNotificationCenter(userId);
    const unread = await unreadCount(userId);
    return {
      success: true,
      generated: candidates.length,
      unread,
      upcoming: buildUpcomingSummary(candidates),
      centerCount: center.length,
    };
  }

  static async markRead(notificationId) {
    return markAlertStatus(notificationId, NOTIFICATION_STATUS.READ);
  }

  static async dismiss(notificationId) {
    return markAlertStatus(notificationId, NOTIFICATION_STATUS.DISMISSED);
  }

  static async markActioned(notificationId) {
    return markAlertStatus(notificationId, NOTIFICATION_STATUS.ACTIONED);
  }

  static async getCenter(filter = {}) {
    let list = await listNotificationCenter(filter.userId);
    if (filter.status === 'unread') {
      list = list.filter(
        (r) =>
          r.status === NOTIFICATION_STATUS.UNREAD ||
          r.status === 'SCHEDULED' ||
          r.status === 'SENT',
      );
    } else if (filter.status === 'expired') {
      list = list.filter(
        (r) =>
          r.status === NOTIFICATION_STATUS.EXPIRED ||
          (r.daysLeft != null && r.daysLeft < 0),
      );
    } else if (filter.status === 'due_soon') {
      list = list.filter((r) => r.daysLeft != null && r.daysLeft >= 0 && r.daysLeft <= 15);
    }
    if (filter.notificationType) {
      list = list.filter((r) => r.notificationType === filter.notificationType);
    }
    if (filter.priority) {
      list = list.filter((r) => r.priority === filter.priority);
    }
    if (filter.assetId) {
      list = list.filter((r) => r.assetId === filter.assetId);
    }
    return list;
  }

  static async updatePrefs(patch) {
    return setNotificationPrefs(patch);
  }

  static async getPrefs() {
    return getNotificationPrefs();
  }

  static async onAssetDatesChanged(asset, changedFields = [], userId) {
    await ReminderScheduler.rescheduleAsset(asset, changedFields, { userId });
  }

  static async onAssetRemoved(assetId) {
    await ReminderScheduler.cancelForAsset(assetId);
  }

  static makeIdentity(args) {
    return makeNotificationIdentity(args);
  }
}

export default NotificationEngine;

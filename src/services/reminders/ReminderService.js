/**
 * Queue expiry / service reminders for Email + In-App Push (not WhatsApp).
 */

import firestore from '@react-native-firebase/firestore';

import { Haptics } from '../haptics/triggerHaptic';
import { ExpiryAlertService } from '../notifications/ExpiryAlertService';
import { EmailService } from '../email/EmailService';

/**
 * @param {string} userId
 * @param {{
 *  assetId?: string,
 *  email?: string,
 *  message: string,
 *  title?: string,
 *  triggerAt?: string|Date,
 *  deepLink?: string,
 *  type?: string,
 * }} payload
 */
export async function enqueueReminder(userId, payload = {}) {
  if (!userId) return { success: false, error: 'userId required' };
  if (!payload.message) return { success: false, error: 'message required' };

  try {
    const triggerAt =
      payload.triggerAt instanceof Date
        ? payload.triggerAt
        : new Date(payload.triggerAt || Date.now());

    const title = String(payload.title || 'Asset Doctor reminder').slice(0, 80);
    const message = String(payload.message).slice(0, 900);
    const deepLink =
      payload.deepLink ||
      (payload.assetId
        ? `assetdoctor://asset/${payload.assetId}`
        : 'assetdoctor://home');

    const doc = {
      uid: userId,
      assetId: payload.assetId || '',
      email: payload.email || '',
      message,
      title,
      reminderText: message,
      triggerAt: firestore.Timestamp.fromDate(
        Number.isNaN(triggerAt.getTime()) ? new Date() : triggerAt,
      ),
      deepLink,
      type: payload.type || 'expiry_reminder',
      status: 'queued',
      channel: 'push_email',
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    const ref = await firestore().collection('reminders').add(doc);
    await firestore()
      .collection('notificationQueue')
      .doc(ref.id)
      .set({ ...doc, reminderId: ref.id }, { merge: true });

    // Fire local / in-app notification immediately when due now (or overdue)
    const dueNow = triggerAt.getTime() <= Date.now() + 60_000;
    if (dueNow) {
      await ExpiryAlertService.notifyReminder({
        title,
        body: message,
        data: {
          assetId: payload.assetId || '',
          screen: 'AssetPassport',
          type: doc.type,
        },
      }).catch(() => null);

      if (payload.email) {
        await EmailService.sendGenericNotice?.({
          email: payload.email,
          subject: title,
          body: message,
          uid: userId,
        }).catch(() => null);
      }
    }

    Haptics.success();
    return { success: true, id: ref.id };
  } catch (error) {
    return { success: false, error: error?.message || 'Could not queue reminder' };
  }
}

/** @deprecated use enqueueReminder */
export async function enqueueWhatsAppReminder(userId, payload = {}) {
  return enqueueReminder(userId, payload);
}

export const ReminderService = { enqueueReminder, enqueueWhatsAppReminder };
export default ReminderService;

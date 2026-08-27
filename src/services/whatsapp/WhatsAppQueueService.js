/**
 * Server-backed WhatsApp welcome queue.
 * The RN client must NEVER call Meta with an access token.
 * It only creates a pending notification_queue document.
 */

import firestore from '@react-native-firebase/firestore';

import {
  WELCOME_QUEUE_COLLECTION,
  buildWelcomeQueueItem,
  maskE164ForTrace,
  welcomeQueueDocId,
  welcomeIdempotencyKey,
} from './welcomeQueueContract.js';

export {
  WELCOME_QUEUE_COLLECTION,
  buildWelcomeQueueItem,
  maskE164ForTrace,
  welcomeQueueDocId,
  welcomeIdempotencyKey,
};

/**
 * First-time welcome: create notification_queue/welcome_{uid}.
 * Duplicate creates resolve as already-queued (idempotent).
 */
export async function enqueueWelcomeWhatsApp({ userId, phone, userName, customerType = 'NEW' } = {}) {
  const built = buildWelcomeQueueItem({ userId, phone, userName, customerType });
  if (!built.ok) {
    console.warn('[WHATSAPP_TRACE] PHONE_NORMALIZED_FAILED', built.errorCategory);
    return { success: false, duplicate: false, ...built };
  }

  console.log('[WHATSAPP_TRACE] PHONE_NORMALIZED', built.item.maskedPhone);
  console.log('[WHATSAPP_TRACE] WELCOME_EVENT_CREATED', built.docId);

  try {
    await firestore().collection(WELCOME_QUEUE_COLLECTION).doc(built.docId).create(built.item);
    try {
      await firestore().collection('adminActivity').add({
        type: 'WHATSAPP_WELCOME',
        action: 'Welcome WhatsApp queued',
        customerUid: userId,
        customerName: String(userName || '').slice(0, 80),
        priority: 'INFO',
        source: 'USER_SIGNUP',
        status: 'QUEUED',
        timestamp: new Date().toISOString(),
        maskedPhone: built.item.maskedPhone,
      });
    } catch {
      /* adminActivity is observability-only */
    }
    return {
      success: true,
      duplicate: false,
      queued: true,
      queueId: built.docId,
      maskedPhone: built.item.maskedPhone,
      status: 'queued',
    };
  } catch (error) {
    const code = String(error?.code || '');
    const already =
      code.includes('already-exists') ||
      /already exists/i.test(String(error?.message || ''));
    if (already) {
      console.log('[WHATSAPP_TRACE] WELCOME_EVENT_DUPLICATE', built.docId);
      return {
        success: true,
        duplicate: true,
        queued: true,
        queueId: built.docId,
        maskedPhone: built.item.maskedPhone,
        status: 'queued',
      };
    }
    console.warn('[WHATSAPP_TRACE] WELCOME_EVENT_CREATE_FAILED', error?.message || error);
    return {
      success: false,
      duplicate: false,
      error: error?.message || 'Failed to queue WhatsApp welcome',
      errorCategory: 'QUEUE_WRITE_FAILED',
    };
  }
}

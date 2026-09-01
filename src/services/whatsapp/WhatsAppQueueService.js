/**
 * Server-backed WhatsApp welcome queue.
 * The RN client must NEVER call Meta with an access token.
 * It only creates a pending/diagnostic notification_queue document.
 */

import firestore from '@react-native-firebase/firestore';

import {
  WELCOME_QUEUE_COLLECTION,
  buildWelcomeQueueItem,
  evaluateWelcomeEligibility,
  maskE164ForTrace,
  welcomeQueueDocId,
  welcomeIdempotencyKey,
} from './welcomeQueueContract.js';

export {
  WELCOME_QUEUE_COLLECTION,
  buildWelcomeQueueItem,
  evaluateWelcomeEligibility,
  maskE164ForTrace,
  welcomeQueueDocId,
  welcomeIdempotencyKey,
};

async function createQueueDoc(docId, item) {
  await firestore().collection(WELCOME_QUEUE_COLLECTION).doc(docId).create(item);
  try {
    await firestore().collection('adminActivity').add({
      type: 'WHATSAPP_WELCOME',
      action: item.status === 'queued' ? 'Welcome WhatsApp queued' : `Welcome ${item.status}`,
      customerUid: item.userId,
      customerName: String(item.customerName || item.payload?.userName || '').slice(0, 80),
      priority: item.status === 'failed' ? 'HIGH' : 'INFO',
      source: 'USER_SIGNUP',
      status: String(item.status || 'QUEUED').toUpperCase(),
      timestamp: new Date().toISOString(),
      maskedPhone: item.phoneMasked || item.maskedPhone,
      failureReason: item.failureReason || null,
    });
  } catch {
    /* adminActivity is observability-only */
  }
}

/**
 * First-time welcome: create notification_queue/welcome_{uid}.
 * Duplicate creates resolve as already-queued (idempotent).
 * Skip/fail reasons are written as diagnostic docs — never silent.
 */
export async function enqueueWelcomeWhatsApp({
  userId,
  phone,
  userName,
  customerType = 'NEW',
  whatsappOptIn = true,
  welcomeMessageSent = false,
} = {}) {
  const gate = evaluateWelcomeEligibility({
    phone,
    whatsappOptIn,
    welcomeMessageSent,
  });
  const built = buildWelcomeQueueItem({
    userId,
    phone,
    userName,
    customerType,
    gate,
  });

  if (!built.docId && !built.ok) {
    console.warn('[WHATSAPP_TRACE] PHONE_NORMALIZED_FAILED', built.errorCategory);
    return { success: false, duplicate: false, ...built };
  }

  const item = built.item || built.diagnosticItem;
  const docId = built.docId;
  if (!item || !docId) {
    return { success: false, duplicate: false, errorCategory: 'QUEUE_WRITE_FAILED', error: 'Missing queue payload' };
  }

  if (item.maskedPhone) {
    console.log('[WHATSAPP_TRACE] PHONE_NORMALIZED', item.maskedPhone);
  }
  console.log('[WHATSAPP_TRACE] WELCOME_EVENT_CREATED', docId, item.status);

  try {
    await createQueueDoc(docId, item);
    return {
      success: item.status === 'queued',
      duplicate: false,
      queued: item.status === 'queued',
      skipped: item.status === 'skipped',
      failed: item.status === 'failed',
      queueId: docId,
      maskedPhone: item.maskedPhone || item.phoneMasked,
      status: item.status,
      reason: item.failureReason || null,
    };
  } catch (error) {
    const code = String(error?.code || '');
    const already =
      code.includes('already-exists') ||
      /already exists/i.test(String(error?.message || ''));
    if (already) {
      console.log('[WHATSAPP_TRACE] WELCOME_EVENT_DUPLICATE', docId);
      return {
        success: true,
        duplicate: true,
        queued: true,
        queueId: docId,
        maskedPhone: item.maskedPhone || item.phoneMasked,
        status: 'queued',
        reason: 'ALREADY_QUEUED',
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

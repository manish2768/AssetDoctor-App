/**
 * Asset Doctor — WhatsApp queue worker (Cloud Functions)
 * Sends welcome_message via Meta Cloud API. Tokens stay in Function secrets.
 *
 * Deploy (does not replace other remote functions if you use --only):
 *   firebase deploy --only functions:onWhatsAppQueueCreate,functions:whatsappWebhook
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const GRAPH_BASE = 'https://graph.facebook.com';
const WELCOME_TEMPLATE = 'welcome_message';
const WELCOME_LANGUAGE = 'en';

const META_TOKEN = defineSecret('META_WHATSAPP_ACCESS_TOKEN');
const META_PHONE_ID = defineSecret('META_WHATSAPP_PHONE_NUMBER_ID');
const META_VERIFY = defineSecret('META_WEBHOOK_VERIFY_TOKEN');

function normalizeRecipient(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return '****';
  return `+${digits.slice(0, 2)}******${digits.slice(-4)}`;
}

async function sendWelcomeTemplate(token, phoneNumberId, to, userName) {
  const recipient = normalizeRecipient(to);
  if (!token || !phoneNumberId) {
    return { success: false, errorCategory: 'MISSING_CREDENTIALS', error: 'Meta WhatsApp secrets missing' };
  }
  if (!recipient || recipient.length < 8) {
    return { success: false, errorCategory: 'INVALID_RECIPIENT_PHONE', error: 'Invalid recipient' };
  }

  const url = `${GRAPH_BASE}/v21.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: WELCOME_TEMPLATE,
      language: { code: WELCOME_LANGUAGE },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: String(userName || 'Valued User').slice(0, 80) }],
        },
      ],
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    return {
      success: false,
      errorCategory: 'META_ERROR',
      error: data?.error?.message || `HTTP ${response.status}`,
      metaCode: data?.error?.code || null,
      httpStatus: response.status,
    };
  }
  return {
    success: true,
    messageId: data?.messages?.[0]?.id || null,
    httpStatus: response.status,
  };
}

exports.onWhatsAppQueueCreate = onDocumentCreated(
  {
    document: 'notification_queue/{notificationId}',
    region: 'asia-south1',
    secrets: [META_TOKEN, META_PHONE_ID],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const item = snap.data() || {};
    const ref = snap.ref;

    if (item.channel !== 'whatsapp' || item.templateKey !== WELCOME_TEMPLATE) {
      return;
    }
    if (item.status && item.status !== 'queued' && item.status !== 'pending') {
      return;
    }

    logger.info('[WHATSAPP_TRACE] WHATSAPP_SEND_ATTEMPT', {
      queueId: event.params.notificationId,
      maskedPhone: maskPhone(item.recipientPhone),
    });

    const result = await sendWelcomeTemplate(
      META_TOKEN.value(),
      META_PHONE_ID.value(),
      item.recipientPhone,
      item.payload?.userName,
    );

    const now = new Date().toISOString();
    if (result.success) {
      logger.info('[WHATSAPP_TRACE] META_RESPONSE accepted');
      await ref.set(
        {
          status: 'sent',
          wamid: result.messageId || null,
          sentAt: now,
          failureReason: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );
      if (item.userId) {
        const patch = {
          welcomeMessageSent: true,
          welcomeMessageSentAt: now,
          whatsappLastMessageAt: now,
        };
        await Promise.all([
          db.collection('users').doc(item.userId).set(patch, { merge: true }),
          db.collection('Users').doc(item.userId).set(patch, { merge: true }),
        ]).catch(() => {});
      }
      await db.collection('whatsappLogs').add({
        userId: item.userId || null,
        maskedPhone: maskPhone(item.recipientPhone),
        type: 'WELCOME',
        templateName: WELCOME_TEMPLATE,
        status: 'SENT',
        wamid: result.messageId || null,
        createdAt: now,
      }).catch(() => {});
      return;
    }

    logger.warn('[WHATSAPP_TRACE] META_RESPONSE failed', {
      errorCategory: result.errorCategory,
      metaCode: result.metaCode || null,
    });
    await ref.set(
      {
        status: 'failed',
        failureReason: result.errorCategory || 'META_ERROR',
        errorMessage: result.error || 'Meta send failed',
        failedAt: now,
        retryCount: Number(item.retryCount || 0) + 1,
      },
      { merge: true },
    );
  },
);

exports.whatsappWebhook = onRequest(
  {
    region: 'asia-south1',
    secrets: [META_VERIFY],
  },
  async (req, res) => {
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      const expected = META_VERIFY.value();
      if (mode === 'subscribe' && token && expected && token === expected) {
        return res.status(200).send(challenge);
      }
      return res.status(403).json({ error: 'Verification token mismatch' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const statusObj = req.body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
      const wamid = statusObj?.id;
      const status = String(statusObj?.status || '').toLowerCase();
      logger.info('[WHATSAPP_TRACE] DELIVERY_WEBHOOK', status || 'empty');

      if (wamid && status) {
        const now = new Date().toISOString();
        const snap = await db.collection('notification_queue').where('wamid', '==', wamid).limit(1).get();
        if (!snap.empty) {
          const patch = { status, updatedAt: now };
          if (status === 'delivered') patch.deliveredAt = now;
          if (status === 'read') patch.readAt = now;
          if (status === 'failed') {
            patch.failureReason = statusObj?.errors?.[0]?.code || 'WEBHOOK_FAILED';
            patch.errorMessage = statusObj?.errors?.[0]?.message || 'Meta delivery failed';
          }
          await snap.docs[0].ref.set(patch, { merge: true });
        }
      }
      return res.status(200).json({ status: 'ok' });
    } catch (err) {
      logger.warn('[WHATSAPP_TRACE] DELIVERY_WEBHOOK_ERROR', err?.message);
      return res.status(200).json({ status: 'error_handled' });
    }
  },
);

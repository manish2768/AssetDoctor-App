/**
 * Asset Doctor — WhatsApp queue worker (Cloud Functions)
 * Sends welcome_message via Meta Cloud API. Tokens stay in Function secrets.
 *
 * Deploy:
 *   firebase deploy --only functions:onWhatsAppQueueCreate,functions:whatsappWebhook,functions:whatsappOpsHealth,functions:adminTestWelcome
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const life = require('./welcomeLifecycle');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const META_TOKEN = defineSecret('META_WHATSAPP_ACCESS_TOKEN');
const META_PHONE_ID = defineSecret('META_WHATSAPP_PHONE_NUMBER_ID');
const META_VERIFY = defineSecret('META_WEBHOOK_VERIFY_TOKEN');

function safeSecret(secret) {
  try {
    const value = secret.value();
    return value && String(value).trim() ? String(value).trim() : '';
  } catch {
    return '';
  }
}

async function requireAdmin(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    if (decoded.super_admin === true) return decoded;
    const email = String(decoded.email || '').toLowerCase();
    if (email === 'manish2768@gmail.com') return decoded;
    return null;
  } catch {
    return null;
  }
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
    const templateName = item.templateName || item.templateKey;

    if (item.channel !== 'whatsapp' || templateName !== life.WELCOME_TEMPLATE_NAME) {
      return;
    }
    if (item.status && item.status !== 'queued' && item.status !== 'pending') {
      return;
    }

    const now = new Date().toISOString();
    try {
      await ref.set(
        {
          status: 'sending',
          updatedAt: now,
          attemptCount: Number(item.attemptCount || item.retryCount || 0) + 1,
          provider: 'meta_cloud_api',
          templateName: life.WELCOME_TEMPLATE_NAME,
          language: life.WELCOME_LANGUAGE,
        },
        { merge: true },
      );

      logger.info('[WHATSAPP_TRACE] WHATSAPP_SEND_ATTEMPT', {
        queueId: event.params.notificationId,
        maskedPhone: life.maskPhone(item.recipientPhone || item.recipientWhatsApp),
      });

      const token = safeSecret(META_TOKEN);
      const phoneId = safeSecret(META_PHONE_ID);
      const result = await life.sendWelcomeTemplate(
        token,
        phoneId,
        item.recipientWhatsApp || item.recipientPhone,
        item.payload && item.payload.userName,
      );

      const doneAt = new Date().toISOString();
      if (result.success && result.messageId) {
        logger.info('[WHATSAPP_TRACE] META_RESPONSE accepted');
        await ref.set(
          {
            status: 'sent',
            wamid: result.messageId,
            sentAt: doneAt,
            updatedAt: doneAt,
            failureReason: admin.firestore.FieldValue.delete(),
            failureCode: admin.firestore.FieldValue.delete(),
            errorMessage: admin.firestore.FieldValue.delete(),
          },
          { merge: true },
        );
        if (item.userId) {
          const patch = {
            welcomeMessageSent: true,
            welcomeMessageSentAt: doneAt,
            whatsappLastMessageAt: doneAt,
          };
          await Promise.all([
            db.collection('users').doc(item.userId).set(patch, { merge: true }),
            db.collection('Users').doc(item.userId).set(patch, { merge: true }),
          ]).catch(() => {});
        }
        await db.collection('whatsappLogs').add({
          userId: item.userId || null,
          maskedPhone: life.maskPhone(item.recipientPhone),
          type: 'WELCOME',
          templateName: life.WELCOME_TEMPLATE_NAME,
          status: 'SENT',
          wamid: result.messageId,
          createdAt: doneAt,
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
          failureCode: result.metaCode || result.errorCategory || 'META_ERROR',
          errorMessage: result.human || result.error || 'Meta send failed',
          fbtraceId: result.fbtraceId || null,
          httpStatus: result.httpStatus || null,
          failedAt: doneAt,
          updatedAt: doneAt,
          retryCount: Number(item.retryCount || 0) + 1,
        },
        { merge: true },
      );
    } catch (err) {
      const failedAt = new Date().toISOString();
      logger.warn('[WHATSAPP_TRACE] WORKER_EXCEPTION', err && err.message);
      await ref.set(
        {
          status: 'failed',
          failureReason: 'META_API_UNAVAILABLE',
          failureCode: 'WORKER_EXCEPTION',
          errorMessage: (err && err.message) ? String(err.message).slice(0, 180) : 'Cloud Function exception',
          failedAt,
          updatedAt: failedAt,
        },
        { merge: true },
      ).catch(() => {});
    }
  },
);

exports.whatsappWebhook = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    secrets: [META_VERIFY],
  },
  async (req, res) => {
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      const expected = safeSecret(META_VERIFY);
      if (mode === 'subscribe' && token && expected && token === expected) {
        return res.status(200).send(challenge);
      }
      return res.status(403).json({ error: 'Verification token mismatch' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const statusObj = req.body && req.body.entry && req.body.entry[0]
        && req.body.entry[0].changes && req.body.entry[0].changes[0]
        && req.body.entry[0].changes[0].value
        && req.body.entry[0].changes[0].value.statuses
        && req.body.entry[0].changes[0].value.statuses[0];
      const wamid = statusObj && statusObj.id;
      const status = String((statusObj && statusObj.status) || '').toLowerCase();
      logger.info('[WHATSAPP_TRACE] DELIVERY_WEBHOOK', status || 'empty');

      if (wamid && status) {
        const now = new Date().toISOString();
        const snap = await db.collection('notification_queue').where('wamid', '==', wamid).limit(1).get();
        if (!snap.empty) {
          const current = snap.docs[0].data() || {};
          const decision = life.mergeWebhookStatus(current.status, status);
          if (decision.apply) {
            const patch = life.webhookPatchForStatus(decision.status, statusObj, now);
            await snap.docs[0].ref.set(patch, { merge: true });
          }
        }
      }
      return res.status(200).json({ status: 'ok' });
    } catch (err) {
      logger.warn('[WHATSAPP_TRACE] DELIVERY_WEBHOOK_ERROR', err && err.message);
      return res.status(200).json({ status: 'error_handled' });
    }
  },
);

exports.whatsappOpsHealth = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    secrets: [META_TOKEN, META_PHONE_ID, META_VERIFY],
  },
  async (req, res) => {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return res.status(403).json({ ok: false, error: 'admin_only' });
    }
    const token = safeSecret(META_TOKEN);
    const phoneId = safeSecret(META_PHONE_ID);
    const verify = safeSecret(META_VERIFY);
    const testTo = String(process.env.WHATSAPP_TEST_TO || '').trim();
    return res.status(200).json({
      ok: true,
      function: 'DEPLOYED',
      credentials: token && phoneId ? 'CONFIGURED' : 'MISSING',
      webhookVerify: verify ? 'CONFIGURED' : 'MISSING',
      testRecipient: testTo ? 'CONFIGURED' : 'MISSING',
      templateName: life.WELCOME_TEMPLATE_NAME,
      language: life.WELCOME_LANGUAGE,
      tokenPreview: token ? '••••••••••••••••' : 'MISSING',
    });
  },
);

exports.adminTestWelcome = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    secrets: [META_TOKEN, META_PHONE_ID],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'POST required' });
    }
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return res.status(403).json({ ok: false, error: 'admin_only' });
    }
    const testTo = String(process.env.WHATSAPP_TEST_TO || '').trim();
    const parsed = life.normalizeIndianWhatsAppDigits(testTo);
    if (!parsed.ok) {
      return res.status(200).json({
        ok: false,
        status: 'NOT_CONFIGURED',
        reason: 'WHATSAPP_TEST_TO missing or invalid. Set the Functions env WHATSAPP_TEST_TO to the approved test number.',
      });
    }
    const uid = adminUser.uid;
    const docId = `welcome_test_${uid}_${Date.now()}`;
    const now = new Date().toISOString();
    const displayName = String(adminUser.name || adminUser.email || 'Asset Doctor Admin').slice(0, 80);
    await db.collection('notification_queue').doc(docId).create({
      uid,
      userId: uid,
      type: 'WELCOME',
      eventType: 'user_welcome',
      channel: 'whatsapp',
      templateName: life.WELCOME_TEMPLATE_NAME,
      templateKey: life.WELCOME_TEMPLATE_NAME,
      language: life.WELCOME_LANGUAGE,
      templateLanguage: life.WELCOME_LANGUAGE,
      recipientPhone: `+${parsed.digits}`,
      recipientWhatsApp: parsed.digits,
      phoneMasked: life.maskPhone(parsed.digits),
      maskedPhone: life.maskPhone(parsed.digits),
      payload: { userName: displayName, customerType: 'TEST' },
      status: 'queued',
      provider: 'meta_cloud_api',
      createdAt: now,
      updatedAt: now,
      scheduledAt: now,
      attemptCount: 0,
      retryCount: 0,
      wamid: null,
      idempotencyKey: `welcome_test:${uid}:${docId}`,
      source: 'admin_test',
    });
    return res.status(200).json({
      ok: true,
      status: 'queued',
      queueId: docId,
      maskedPhone: life.maskPhone(parsed.digits),
      note: 'Cloud Function onWhatsAppQueueCreate will send welcome_message if secrets are configured.',
    });
  },
);

/* ============================================================
 * NOTE: Support Tickets & Document Intelligence functions were
 * moved to the dedicated codebase "asset-doctor-support"
 * (source: functions/support). See /functions/support.
 * ============================================================ */

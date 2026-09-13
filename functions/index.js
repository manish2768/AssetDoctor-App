/**
 * Asset Doctor — WhatsApp queue worker (Cloud Functions)
 * Sends welcome_message via Meta Cloud API. Tokens stay in Function secrets.
 *
 * Deploy:
 *   firebase deploy --only functions:onWhatsAppQueueCreate,functions:whatsappWebhook,functions:whatsappOpsHealth,functions:adminTestWelcome
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
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
const GSC_SECRET_KEY = defineSecret('GSC_CREDENTIALS_ENCRYPTION_KEY');

function safeSecret(secret, envKey) {
  try {
    const value = secret.value();
    if (value && String(value).trim()) return String(value).trim();
  } catch {}
  if (envKey && process.env[envKey] && String(process.env[envKey]).trim()) {
    return String(process.env[envKey]).trim();
  }
  return '';
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
    const queueId = event.params.notificationId;

    if (item.channel !== 'whatsapp') {
      return;
    }
    const currentStatus = String(item.status || '').toLowerCase();
    if (currentStatus !== 'queued' && currentStatus !== 'pending' && currentStatus !== 'retrying') {
      return;
    }
    // Idempotency: skip if already terminal or wamid present
    if (currentStatus === 'sent' || currentStatus === 'delivered' || currentStatus === 'read' || item.wamid) {
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
        },
        { merge: true },
      );

      logger.info('[WHATSAPP_TRACE] WHATSAPP_SEND_ATTEMPT', {
        queueId,
        templateKey: item.templateKey || item.templateName || item.type,
        maskedPhone: life.maskPhone(item.recipientPhone || item.recipientWhatsApp),
      });

      const token = safeSecret(META_TOKEN, 'META_WHATSAPP_ACCESS_TOKEN');
      const phoneId = safeSecret(META_PHONE_ID, 'META_WHATSAPP_PHONE_NUMBER_ID') || '1298737189989464';

      const result = await life.dispatchWhatsAppNotification({
        token,
        phoneNumberId: phoneId,
        item,
        now,
      });

      if (result.patch) {
        await ref.set(result.patch, { merge: true });
      }

      const doneAt = new Date().toISOString();
      if (result.success && result.wamid) {
        logger.info('[WHATSAPP_TRACE] META_RESPONSE accepted', { wamid: result.wamid });

        if (item.userId && (item.type === 'WELCOME' || item.templateName === 'welcome_message' || item.templateKey === 'welcome_message')) {
          const userPatch = {
            welcomeMessageSent: true,
            welcomeMessageSentAt: doneAt,
            whatsappLastMessageAt: doneAt,
          };
          await Promise.all([
            db.collection('users').doc(item.userId).set(userPatch, { merge: true }),
            db.collection('Users').doc(item.userId).set(userPatch, { merge: true }),
          ]).catch(() => {});
        }

        await db.collection('whatsappLogs').add({
          queueId,
          userId: item.userId || null,
          maskedPhone: life.maskPhone(item.recipientPhone || item.recipientWhatsApp),
          type: item.type || 'NOTIFICATION',
          templateName: result.templateName || item.templateName || item.templateKey,
          status: 'SENT',
          wamid: result.wamid,
          createdAt: doneAt,
        }).catch(() => {});
        return;
      }

      logger.warn('[WHATSAPP_TRACE] META_RESPONSE failed/retrying', {
        status: result.status,
        errorCategory: result.errorCategory,
      });

      await db.collection('whatsappLogs').add({
        queueId,
        userId: item.userId || null,
        maskedPhone: life.maskPhone(item.recipientPhone || item.recipientWhatsApp),
        type: item.type || 'NOTIFICATION',
        templateName: item.templateName || item.templateKey,
        status: String(result.status || 'FAILED').toUpperCase(),
        errorCategory: result.errorCategory || 'UNKNOWN',
        errorMessage: result.error || 'Failed',
        createdAt: doneAt,
      }).catch(() => {});
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

    const diagCounters = {
      webhookReceived: 1,
      webhookParsed: 0,
      webhookMatched: 0,
      webhookIgnored: 0,
      webhookWriteSuccess: 0,
      webhookWriteFailed: 0,
    };

    try {
      const now = new Date().toISOString();
      const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];

      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const statuses = Array.isArray(change.value?.statuses) ? change.value.statuses : [];
          for (const statusObj of statuses) {
            diagCounters.webhookParsed++;
            const wamid = statusObj?.id;
            const incomingStatus = String(statusObj?.status || '').toLowerCase();
            logger.info('[WHATSAPP_TRACE] DELIVERY_WEBHOOK_STATUS', { wamid, status: incomingStatus });

            diagCounters.lastEventType = incomingStatus;
            diagCounters.lastWamid = wamid;

            // Match by wamid in notification_queue
            const snap = await db.collection('notification_queue').where('wamid', '==', wamid).limit(1).get().catch(() => ({ empty: true }));
            if (snap && !snap.empty) {
              diagCounters.webhookMatched++;
              const docRef = snap.docs[0].ref;
              const current = snap.docs[0].data() || {};
              const decision = life.mergeWebhookStatus(current.status, incomingStatus);

              if (decision.apply) {
                const patch = life.webhookPatchForStatus(decision.status, statusObj, now);
                try {
                  await docRef.set(patch, { merge: true });
                  diagCounters.webhookWriteSuccess++;
                } catch (writeErr) {
                  diagCounters.webhookWriteFailed++;
                  logger.warn('[WHATSAPP_TRACE] DELIVERY_WRITE_FAIL', writeErr && writeErr.message);
                }
              } else {
                diagCounters.webhookIgnored++;
              }
            } else {
              diagCounters.webhookIgnored++;
              // Safe diagnostic event logging for unmatched wamid (never drop events)
              const safeDiagId = `unmatched_${String(wamid).replace(/[^a-zA-Z0-9]/g, '_').slice(-40)}_${Date.now()}`;
              await db.collection('webhook_diagnostic_events').doc(safeDiagId).set({
                wamid,
                status: incomingStatus,
                recipientPhone: statusObj?.recipient_id ? `+${statusObj.recipient_id}` : null,
                timestamp: statusObj?.timestamp || null,
                errors: statusObj?.errors || null,
                receivedAt: now,
                reason: 'WAMID_NOT_FOUND_IN_QUEUE',
              }).catch(() => {});
            }
          }
        }
      }

      const maskedWamid = diagCounters.lastWamid
        ? `${diagCounters.lastWamid.slice(0, 15)}...${diagCounters.lastWamid.slice(-6)}`
        : null;

      // Persist safe diagnostic counters with increment and latest event details
      const diagRef = db.collection('system_metadata').doc('whatsapp_webhook_diagnostics');
      await diagRef.set({
        webhookReceived: admin.firestore.FieldValue.increment(diagCounters.webhookReceived),
        webhookParsed: admin.firestore.FieldValue.increment(diagCounters.webhookParsed),
        webhookMatched: admin.firestore.FieldValue.increment(diagCounters.webhookMatched),
        webhookIgnored: admin.firestore.FieldValue.increment(diagCounters.webhookIgnored),
        webhookWriteSuccess: admin.firestore.FieldValue.increment(diagCounters.webhookWriteSuccess),
        webhookWriteFailed: admin.firestore.FieldValue.increment(diagCounters.webhookWriteFailed),
        lastEventAt: now,
        lastReceivedAt: now,
        lastEventType: diagCounters.lastEventType || 'unknown',
        lastWamid: maskedWamid,
        lastEventPersisted: true,
      }, { merge: true }).catch(() => {});

      return res.status(200).json({ status: 'ok', parsed: diagCounters.webhookParsed });
    } catch (err) {
      logger.warn('[WHATSAPP_TRACE] DELIVERY_WEBHOOK_ERROR', err && err.message);
      return res.status(200).json({ status: 'error_handled' });
    }
  },
);

let opsHealthCache = {
  timestamp: 0,
  phoneDetails: null,
  metaTemplates: null,
};

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
    const token = safeSecret(META_TOKEN, 'META_WHATSAPP_ACCESS_TOKEN');
    const phoneId = safeSecret(META_PHONE_ID, 'META_WHATSAPP_PHONE_NUMBER_ID') || '1298737189989464';
    const verify = safeSecret(META_VERIFY, 'META_WEBHOOK_VERIFY_TOKEN');
    const testTo = String(process.env.WHATSAPP_TEST_TO || '').trim();
    const wabaId = String(process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || '2519296845235500').trim();
    const forceRefresh = req.query.forceRefresh === 'true' || req.query.refresh === '1';

    const now = new Date().toISOString();
    const cacheValid = opsHealthCache.phoneDetails && (Date.now() - opsHealthCache.timestamp < 60000);

    let phoneDetails = null;
    let metaTemplates = null;

    if (cacheValid && !forceRefresh) {
      phoneDetails = opsHealthCache.phoneDetails;
      metaTemplates = opsHealthCache.metaTemplates;
    } else if (token && phoneId) {
      const [pRes, tRes] = await Promise.all([
        life.fetchMetaPhoneNumberDetails(token, phoneId),
        life.fetchMetaTemplates(token, wabaId),
      ]);
      phoneDetails = pRes;
      metaTemplates = tRes.ok ? tRes.templates : [];
      opsHealthCache = {
        timestamp: Date.now(),
        phoneDetails,
        metaTemplates,
      };
    }

    // Query recent queue docs (single-field index on createdAt avoids composite index)
    const queueSnap = await db.collection('notification_queue')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
      .catch(() => ({ docs: [] }));

    const queueDocs = (queueSnap.docs ? queueSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [])
      .filter(d => !d.channel || d.channel === 'whatsapp');

    // Query latest invocation
    const latestLogSnap = await db.collection('whatsappLogs')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
      .catch(() => ({ docs: [] }));
    const lastInvocation = latestLogSnap.docs && latestLogSnap.docs[0] ? latestLogSnap.docs[0].data().createdAt : null;

    // Query surveillance metadata, next upcoming reminder, and webhook diagnostics
    const [surveillanceDoc, nextScheduledReminder, webhookDiagDoc] = await Promise.all([
      db.collection('system_metadata').doc('whatsapp_surveillance').get().catch(() => null),
      life.computeNextScheduledReminder(db),
      db.collection('system_metadata').doc('whatsapp_webhook_diagnostics').get().catch(() => null),
    ]);
    const surveillanceStats = surveillanceDoc && surveillanceDoc.exists ? surveillanceDoc.data() : {
      status: 'ACTIVE',
      cadence: 'Daily at 09:00 AM IST (asia-south1)',
      channel: 'WhatsApp (Meta v21.0)',
      lastRunAt: null,
    };
    const webhookDiagnostics = webhookDiagDoc && webhookDiagDoc.exists ? webhookDiagDoc.data() : null;

    const healthModel = life.buildAuthoritativeWhatsAppHealthModel({
      tokenConfigured: Boolean(token),
      phoneIdConfigured: Boolean(phoneId),
      verifyTokenConfigured: Boolean(verify),
      phoneDetails,
      metaTemplates,
      queueDocs,
      workerDeployed: true,
      lastInvocation,
      now,
      nextScheduledReminder,
      surveillanceStats,
      webhookDiagnostics,
    });

    return res.status(200).json({
      ok: true,
      function: 'DEPLOYED',
      credentials: token && phoneId ? 'CONFIGURED' : 'MISSING',
      webhookVerify: verify ? 'CONFIGURED' : 'MISSING',
      testRecipient: testTo ? 'CONFIGURED' : 'MISSING',
      templateName: life.WELCOME_TEMPLATE_NAME,
      language: life.WELCOME_LANGUAGE,
      tokenPreview: token ? '••••••••••••••••' : 'MISSING',
      ...healthModel,
    });
  },
);

exports.adminSyncWhatsAppTemplates = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    secrets: [META_TOKEN, META_PHONE_ID],
  },
  async (req, res) => {
    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return res.status(403).json({ ok: false, error: 'admin_only' });
    }
    const token = safeSecret(META_TOKEN, 'META_WHATSAPP_ACCESS_TOKEN');
    const wabaId = String(process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || '2519296845235500').trim();

    if (!token) {
      return res.status(400).json({
        ok: false,
        errorCategory: 'FUNCTION_CONFIGURATION_MISSING',
        error: 'META_WHATSAPP_ACCESS_TOKEN not configured.',
      });
    }

    // Ensure Meta WABA subscribed_apps includes this app for incoming webhooks
    await life.ensureMetaWabaSubscribed(token, wabaId).catch(() => {});

    const tRes = await life.fetchMetaTemplates(token, wabaId);
    if (!tRes.ok) {
      return res.status(400).json({
        ok: false,
        errorCategory: tRes.errorCategory,
        error: tRes.error,
      });
    }

    const now = new Date().toISOString();
    const batch = db.batch();
    const syncedTemplates = [];

    // Sync all templates returned by Meta
    tRes.templates.forEach((metaTpl) => {
      const normalized = life.normalizeMetaTemplate(metaTpl, now);
      const docRef = db.collection('whatsapp_templates').doc(normalized.metaName);
      batch.set(docRef, normalized, { merge: true });
      syncedTemplates.push(normalized);
    });

    // Guard: service_reminder (unapproved on Meta)
    const hasServiceReminder = tRes.templates.some(t => t.name === 'service_reminder');
    if (!hasServiceReminder) {
      const serviceTpl = {
        localKey: 'service_reminder',
        templateKey: 'service_reminder',
        metaName: 'service_reminder',
        metaTemplateName: 'service_reminder',
        language: 'en',
        category: 'MARKETING',
        metaStatus: 'PENDING',
        localStatus: 'REGISTERED',
        deliverable: false,
        rejectionReason: 'Pending Meta review and approval',
        components: [],
        id: 'service_reminder',
        lastSyncedAt: now,
        updatedAt: now,
      };
      const docRef = db.collection('whatsapp_templates').doc('service_reminder');
      batch.set(docRef, serviceTpl, { merge: true });
      syncedTemplates.push(serviceTpl);
    }

    await batch.commit();

    // Invalidate health cache
    opsHealthCache.timestamp = 0;

    return res.status(200).json({
      ok: true,
      syncedCount: syncedTemplates.length,
      templates: syncedTemplates,
      syncedAt: now,
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

/**
 * Master Admin Send WhatsApp Message
 * Sends test or customer communication via Meta Cloud API v21.0.
 * Protected by Super Admin authorization.
 * Logs to whatsappAuditLogs and notification_queue. Zero token exposure.
 */
exports.adminSendWhatsAppMessage = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    secrets: [META_TOKEN, META_PHONE_ID],
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'POST required' });
    }

    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return res.status(403).json({ ok: false, error: 'admin_only', detail: 'Super Admin authorization required' });
    }

    const token = safeSecret(META_TOKEN, 'META_WHATSAPP_ACCESS_TOKEN');
    const phoneId = safeSecret(META_PHONE_ID, 'META_WHATSAPP_PHONE_NUMBER_ID') || '1298737189989464';

    if (!token) {
      return res.status(400).json({ ok: false, error: 'FUNCTION_CONFIGURATION_MISSING', detail: 'META_WHATSAPP_ACCESS_TOKEN not configured on server.' });
    }

    const body = req.body || {};
    const recipientRaw = String(body.recipientPhone || body.to || '').trim();
    const parsed = life.normalizeIndianWhatsAppDigits(recipientRaw);
    if (!parsed.ok) {
      return res.status(400).json({ ok: false, error: 'INVALID_PHONE', detail: 'Invalid 10-digit Indian or international recipient phone number.' });
    }

    const messageType = String(body.messageType || 'template').toLowerCase();
    const templateName = String(body.templateName || '').trim();
    const templateLanguage = String(body.templateLanguage || 'en').trim();
    const templateParams = Array.isArray(body.templateParams) ? body.templateParams : [];
    const textBody = String(body.textBody || body.text || '').trim();
    const isTest = Boolean(body.isTest);
    const customerId = body.customerId ? String(body.customerId).trim() : null;
    const assetId = body.assetId ? String(body.assetId).trim() : null;

    const now = new Date().toISOString();
    let sendResult = { success: false, error: 'Unknown error' };

    if (messageType === 'template') {
      if (!templateName) {
        return res.status(400).json({ ok: false, error: 'MISSING_TEMPLATE_NAME', detail: 'Template name is required for template messages.' });
      }

      const templateParamNames = {
        electricity_bill_due_reminder: ['customer_name', 'billing_month', 'due_date', 'current_bill_amount', 'total_payable_amount'],
        warranty_expiry_reminder: ['customer_name', 'asset_name', 'warranty_expiry_date'],
        asset_doctor_puc_expiry: ['customer_name', 'vehicle_name', 'puc_expiry_date'],
        asset_doctor_insurance_expiry: ['customer_name', 'vehicle_name', 'insurance_expiry_date'],
        service_due_reminder: ['customer_name', 'asset_name', 'service_due_date'],
        asset_doctor_welcome: ['customer_name'],
        welcome_message: ['customer_name'],
      };

      let components = undefined;
      const paramNames = templateParamNames[templateName] || [];
      if (templateParams.length > 0) {
        components = [
          {
            type: 'body',
            parameters: templateParams.map((val, idx) => {
              const p = { type: 'text', text: String(val || '') };
              if (paramNames[idx]) {
                p.parameter_name = paramNames[idx];
              }
              return p;
            }),
          },
        ];
      }

      sendResult = await life.sendMetaTemplate(token, phoneId, {
        to: parsed.digits,
        templateName,
        languageCode: templateLanguage,
        components,
      });
    } else if (messageType === 'text') {
      if (!textBody) {
        return res.status(400).json({ ok: false, error: 'MISSING_TEXT_BODY', detail: 'Text body cannot be empty.' });
      }
      sendResult = await life.sendMetaText(token, phoneId, {
        to: parsed.digits,
        body: textBody,
      });
    } else {
      return res.status(400).json({ ok: false, error: 'UNSUPPORTED_MESSAGE_TYPE', detail: `Message type '${messageType}' is not supported.` });
    }

    const docId = `msg_${isTest ? 'test_' : 'admin_'}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const maskedPhone = life.maskPhone(parsed.digits);

    await db.collection('notification_queue').doc(docId).set({
      type: isTest ? 'TEST_MESSAGE' : 'ADMIN_DIRECT',
      channel: 'whatsapp',
      templateName: messageType === 'template' ? templateName : null,
      messageType,
      recipientPhone: `+${parsed.digits}`,
      recipientWhatsApp: parsed.digits,
      phoneMasked: maskedPhone,
      maskedPhone: maskedPhone,
      status: sendResult.success ? 'sent' : 'failed',
      wamid: sendResult.messageId || null,
      submittedAt: now,
      sentAt: sendResult.success ? now : null,
      failedAt: sendResult.success ? null : now,
      failureReason: sendResult.error || null,
      failureCode: sendResult.errorCategory || null,
      customerId,
      assetId,
      source: isTest ? 'admin_test_console' : 'admin_direct_console',
      sentBy: adminUser.email,
      createdAt: now,
      updatedAt: now,
    }).catch((err) => logger.warn('[ADMIN_SEND] Failed to write notification_queue doc', err));

    await db.collection('whatsappAuditLogs').add({
      adminEmail: adminUser.email,
      adminUid: adminUser.uid,
      action: isTest ? 'TEST_MESSAGE_SEND' : 'DIRECT_MESSAGE_SEND',
      recipientMasked: maskedPhone,
      messageType,
      templateName: messageType === 'template' ? templateName : null,
      result: sendResult.success ? 'SUCCESS' : 'FAILED',
      metaMessageId: sendResult.messageId || null,
      failureReason: sendResult.error || null,
      timestamp: now,
    }).catch(() => {});

    return res.status(200).json({
      ok: sendResult.success,
      status: sendResult.success ? 'SENT' : 'FAILED',
      messageId: sendResult.messageId || null,
      queueId: docId,
      recipient: maskedPhone,
      templateName: templateName || null,
      submittedAt: now,
      error: sendResult.error || null,
      errorCategory: sendResult.errorCategory || null,
    });
  },
);

/**
 * Master Admin WhatsApp 6-Layer Live Diagnostic Runner
 */
exports.adminWhatsAppDiagnostic = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    secrets: [META_TOKEN, META_PHONE_ID, META_VERIFY],
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return res.status(403).json({ ok: false, error: 'admin_only' });
    }

    const token = safeSecret(META_TOKEN, 'META_WHATSAPP_ACCESS_TOKEN');
    const phoneId = safeSecret(META_PHONE_ID, 'META_WHATSAPP_PHONE_NUMBER_ID') || '1298737189989464';
    const verify = safeSecret(META_VERIFY, 'META_WEBHOOK_VERIFY_TOKEN');
    const wabaId = String(process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || '2519296845235500').trim();

    const diagnostic = await life.runWhatsAppDiagnosticSuite({
      token,
      phoneNumberId: phoneId,
      wabaId,
      verifyToken: verify,
      db,
    });

    return res.status(200).json(diagnostic);
  },
);

/**
 * P1: Automatic Server-Side Daily Expiry Surveillance
 * Runs every day at 09:00 AM IST (03:30 UTC) in asia-south1.
 * Scans assets for T-30, T-15, T-7, T-3, T-1, T-0 and post-expiry milestones.
 * Queues idempotent expiry_reminder WhatsApp jobs for onWhatsAppQueueCreate.
 */
exports.dailyExpiryAlerts = onSchedule(
  {
    schedule: '30 3 * * *',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    secrets: [META_TOKEN, META_PHONE_ID],
  },
  async () => {
    logger.info('[SCHEDULER] Running dailyExpiryAlerts surveillance cycle...');
    const summary = await life.runDailyExpirySurveillance(db);
    logger.info('[SCHEDULER] dailyExpiryAlerts surveillance cycle completed', summary);
    // Invalidate health cache
    opsHealthCache.timestamp = 0;
  },
);

/**
 * Super Admin On-Demand Expiry Surveillance Runner / Dry-Run Prober
 */
exports.adminTriggerExpirySurveillance = onRequest(
  {
    region: 'asia-south1',
    secrets: [META_TOKEN, META_PHONE_ID],
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return res.status(403).json({ ok: false, error: 'Unauthorized. Super Admin token required.' });
    }

    const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
    logger.info('[ADMIN_SURVEILLANCE] Manual surveillance trigger initiated', {
      adminEmail: adminUser.email,
      dryRun,
    });

    const summary = await life.runDailyExpirySurveillance(db, { dryRun });
    // Invalidate health cache
    opsHealthCache.timestamp = 0;

    return res.status(200).json({
      ok: true,
      dryRun,
      summary,
      triggeredBy: adminUser.email,
    });
  },
);


/* ============================================================
 * Google Search Console (GSC) API Integration
 * ============================================================ */

const https = require('https');
const crypto = require('crypto');
const { JWT } = require('google-auth-library');

const DEFAULT_GSC_SITE = 'sc-domain:assetdoctor.in';
const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/**
 * Server-side AES-256-GCM encryption key derivation
 */
function getGscCipherKey() {
  const customSecret = safeSecret(GSC_SECRET_KEY, 'GSC_CREDENTIALS_ENCRYPTION_KEY');
  const seed = customSecret || 'assetdoctor-gsc-kms-master-seed-2026';
  return crypto.createHash('sha256').update(seed).digest();
}

/**
 * Server-side AES-256-GCM encryption for private keys
 */
function encryptGscPrivateKey(plainTextKey) {
  if (!plainTextKey || typeof plainTextKey !== 'string') return '';
  const key = getGscCipherKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainTextKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Server-side AES-256-GCM decryption for private keys
 */
function decryptGscPrivateKey(storedKey) {
  if (!storedKey || typeof storedKey !== 'string') return '';
  // Support transparent migration if stored as legacy plaintext
  if (!storedKey.startsWith('enc:v1:')) {
    return storedKey;
  }
  try {
    const parts = storedKey.split(':');
    if (parts.length !== 5) return '';
    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encryptedHex = parts[4];
    const key = getGscCipherKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    logger.error('[GSC_DECRYPT_FAIL] Failed to decrypt private key', { error: err.message });
    return '';
  }
}

/**
 * Fetch organic search analytics from Google Search Console API via raw HTTPS
 */
function fetchGscSearchAnalytics(accessToken, siteUrl, payload) {
  return new Promise((resolve, reject) => {
    const encodedSite = encodeURIComponent(siteUrl);
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'www.googleapis.com',
      port: 443,
      path: `/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, statusCode: res.statusCode, data: parsed });
          } else {
            resolve({
              ok: false,
              statusCode: res.statusCode,
              error: parsed.error?.message || `HTTP ${res.statusCode}`,
              raw: parsed,
            });
          }
        } catch (err) {
          resolve({ ok: false, statusCode: res.statusCode, error: 'Malformed JSON response from Google', raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy(new Error('GSC API request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Verify property accessibility via Search Console sites endpoint
 */
function fetchGscPropertyDetails(accessToken, siteUrl) {
  return new Promise((resolve, reject) => {
    const encodedSite = encodeURIComponent(siteUrl);
    const options = {
      hostname: 'www.googleapis.com',
      port: 443,
      path: `/webmasters/v3/sites/${encodedSite}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, statusCode: res.statusCode, data: parsed });
          } else {
            resolve({
              ok: false,
              statusCode: res.statusCode,
              error: parsed.error?.message || `HTTP ${res.statusCode}`,
              raw: parsed,
            });
          }
        } catch (err) {
          resolve({ ok: false, statusCode: res.statusCode, error: 'Malformed JSON response', raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => req.destroy(new Error('GSC sites check timed out')));
    req.end();
  });
}

/**
 * Super Admin Endpoint to retrieve Google Search Console metrics
 */
exports.adminGetSearchConsoleAnalytics = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    secrets: [GSC_SECRET_KEY],
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return res.status(403).json({ ok: false, errorCategory: 'AUTH_FAILED', error: 'Unauthorized. Super Admin token required.' });
    }

    try {
      // 1. Fetch configured service account credentials from Firestore systemSettings
      const docSnap = await db.collection('systemSettings').doc('google_search_console').get();
      const config = docSnap.exists ? docSnap.data() : null;

      const clientEmail = config?.client_email || 'asset-doctor-search-console@assetdoctor-5fd25.iam.gserviceaccount.com';
      const storedKey = config?.encrypted_private_key || config?.private_key || '';
      const privateKey = decryptGscPrivateKey(storedKey);
      const siteUrl = config?.site_url || DEFAULT_GSC_SITE;
      const rawDays = parseInt(req.query.days || req.body?.days || 28, 10);
      const days = isNaN(rawDays) ? 28 : Math.min(Math.max(rawDays, 3), 90);

      // Status response if private key is not yet saved/valid
      if (!privateKey) {
        return res.status(200).json({
          ok: true,
          status: 'CONFIGURED_AWAITING_CREDENTIALS',
          errorCategory: 'NOT_CONFIGURED',
          connected: false,
          clientEmail,
          siteUrl,
          message: 'Search Console integration is not configured. Please upload or save your Service Account credentials in System Settings.',
          metrics: {
            totalClicks: 0,
            totalImpressions: 0,
            averageCtr: 0,
            averagePosition: 0,
            rows: []
          }
        });
      }

      // 2. Format PEM private key (support literal \n escapes)
      const formattedKey = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;

      // 3. Obtain OAuth2 Access Token using JWT
      const jwtClient = new JWT({
        email: clientEmail,
        key: formattedKey,
        scopes: [GSC_SCOPE],
      });

      let tokenResponse;
      try {
        tokenResponse = await jwtClient.getAccessToken();
      } catch (authErr) {
        logger.warn('[GSC_AUTH_FAIL] Failed to acquire Google access token with service account key', {
          error: authErr.message,
        });
        return res.status(200).json({
          ok: true,
          status: 'AUTH_ERROR',
          errorCategory: 'AUTH_FAILED',
          connected: false,
          clientEmail,
          siteUrl,
          message: `Google OAuth authentication failed: ${authErr.message}. Verify private key format in System Settings.`,
          metrics: {
            totalClicks: 0,
            totalImpressions: 0,
            averageCtr: 0,
            averagePosition: 0,
            rows: []
          }
        });
      }

      const accessToken = tokenResponse?.token || tokenResponse;
      if (!accessToken) {
        return res.status(502).json({
          ok: false,
          errorCategory: 'AUTH_FAILED',
          error: 'Failed to obtain Google access token for Search Console.',
        });
      }

      // 4. Calculate date range (GSC data has a 2-3 day lag)
      const endDateObj = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const startDateObj = new Date(endDateObj.getTime() - days * 24 * 60 * 60 * 1000);
      const endDate = endDateObj.toISOString().split('T')[0];
      const startDate = startDateObj.toISOString().split('T')[0];

      // 5. Query GSC API: Fetch property-level aggregate and query-level rows in parallel
      const propAggPayload = {
        startDate,
        endDate,
      };

      const queryPayload = {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 50,
      };

      const [propAggResult, queryResult] = await Promise.all([
        fetchGscSearchAnalytics(accessToken, siteUrl, propAggPayload).catch(err => ({ ok: false, error: err.message })),
        fetchGscSearchAnalytics(accessToken, siteUrl, queryPayload).catch(err => ({ ok: false, error: err.message })),
      ]);

      const gscResult = queryResult.ok ? queryResult : propAggResult;

      if (!gscResult.ok) {
        logger.warn('[GSC_QUERY_NOTICE] Google Search Console API returned non-200', {
          statusCode: gscResult.statusCode,
          error: gscResult.error,
        });

        let errorCategory = 'GOOGLE_API_ERROR';
        let status = 'API_ERROR';
        let message = `GSC API: ${gscResult.error}`;

        if (gscResult.statusCode === 403) {
          errorCategory = 'NOT_DELEGATED';
          status = 'PERMISSION_DENIED';
          message = `Google Search Console returned 403 (Permission Denied). Please ensure ${clientEmail} is added as a User/Owner on property ${siteUrl} in Google Search Console Console.`;
        } else if (gscResult.statusCode === 404) {
          errorCategory = 'PROPERTY_NOT_FOUND';
          status = 'PROPERTY_NOT_FOUND';
          message = `Search Console property ${siteUrl} was not found.`;
        } else if (gscResult.statusCode === 429) {
          errorCategory = 'RATE_LIMITED';
          status = 'RATE_LIMITED';
          message = 'Google Search Console query rate limit reached. Please try again later.';
        } else if (gscResult.statusCode >= 500) {
          errorCategory = 'GOOGLE_API_ERROR';
          status = 'SERVICE_UNAVAILABLE';
          message = 'Google Search Console temporarily unavailable.';
        }

        return res.status(200).json({
          ok: true,
          status,
          errorCategory,
          connected: false,
          clientEmail,
          siteUrl,
          message,
          metrics: {
            totalClicks: 0,
            totalImpressions: 0,
            averageCtr: null,
            averagePosition: null,
            rows: []
          }
        });
      }

      // 6. Aggregate results using Google Property-level aggregate (authoritative)
      const rows = queryResult.ok && queryResult.data?.rows ? queryResult.data.rows : [];
      let totalClicks = 0;
      let totalImpressions = 0;
      let averageCtr = null;
      let averagePosition = null;

      if (propAggResult.ok && propAggResult.data?.rows && propAggResult.data.rows.length > 0) {
        const topRow = propAggResult.data.rows[0];
        totalClicks = topRow.clicks || 0;
        totalImpressions = topRow.impressions || 0;
        averageCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : (topRow.ctr != null ? Number((topRow.ctr * 100).toFixed(2)) : null);
        averagePosition = topRow.position != null ? Number(topRow.position.toFixed(1)) : null;
      } else {
        // Fallback calculation directly across all rows
        rows.forEach((r) => {
          totalClicks += (r.clicks || 0);
          totalImpressions += (r.impressions || 0);
        });
        averageCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : null;
        if (rows.length > 0) {
          let weightedPos = 0;
          let weightCount = 0;
          rows.forEach((r) => {
            const imp = r.impressions || 1;
            weightedPos += (r.position || 0) * imp;
            weightCount += imp;
          });
          averagePosition = weightCount > 0 ? Number((weightedPos / weightCount).toFixed(1)) : null;
        }
      }

      return res.status(200).json({
        ok: true,
        status: 'CONNECTED',
        connected: true,
        errorCategory: (totalImpressions === 0 && rows.length === 0) ? 'NO_DATA' : null,
        clientEmail,
        siteUrl,
        startDate,
        endDate,
        metrics: {
          totalClicks,
          totalImpressions,
          averageCtr,
          averagePosition,
          rows,
        },
      });

    } catch (err) {
      logger.error('[GSC_UNHANDLED_ERR]', { error: err.message });
      return res.status(500).json({
        ok: false,
        errorCategory: 'INTERNAL_ERROR',
        error: 'Internal server error while querying Search Console.',
      });
    }
  }
);

/**
 * Super Admin Endpoint to test Search Console connection and property permissions
 */
exports.adminTestSearchConsoleConnection = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    secrets: [GSC_SECRET_KEY],
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return res.status(403).json({ ok: false, error: 'Unauthorized. Super Admin token required.' });
    }

    try {
      const docSnap = await db.collection('systemSettings').doc('google_search_console').get();
      const config = docSnap.exists ? docSnap.data() : null;

      const clientEmail = config?.client_email || 'asset-doctor-search-console@assetdoctor-5fd25.iam.gserviceaccount.com';
      const storedKey = config?.encrypted_private_key || config?.private_key || '';
      const privateKey = decryptGscPrivateKey(storedKey);
      const siteUrl = config?.site_url || DEFAULT_GSC_SITE;

      if (!privateKey) {
        return res.status(200).json({
          ok: true,
          authenticationSuccessful: false,
          propertyAccess: false,
          serviceAccountEmail: clientEmail,
          projectId: config?.project_id || 'assetdoctor-5fd25',
          checkedAt: new Date().toISOString(),
          status: 'NOT_CONFIGURED',
          message: 'No private key configured. Upload service account JSON key in System Settings.',
        });
      }

      const formattedKey = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;

      const jwtClient = new JWT({
        email: clientEmail,
        key: formattedKey,
        scopes: [GSC_SCOPE],
      });

      let tokenResponse;
      try {
        tokenResponse = await jwtClient.getAccessToken();
      } catch (authErr) {
        return res.status(200).json({
          ok: true,
          authenticationSuccessful: false,
          propertyAccess: false,
          serviceAccountEmail: clientEmail,
          projectId: config?.project_id || 'assetdoctor-5fd25',
          checkedAt: new Date().toISOString(),
          status: 'AUTH_FAILED',
          message: `OAuth authentication failed: ${authErr.message}`,
        });
      }

      const accessToken = tokenResponse?.token || tokenResponse;
      if (!accessToken) {
        return res.status(200).json({
          ok: true,
          authenticationSuccessful: false,
          propertyAccess: false,
          serviceAccountEmail: clientEmail,
          projectId: config?.project_id || 'assetdoctor-5fd25',
          checkedAt: new Date().toISOString(),
          status: 'AUTH_FAILED',
          message: 'Unable to acquire OAuth2 access token.',
        });
      }

      // Check property access
      const propResult = await fetchGscPropertyDetails(accessToken, siteUrl);

      if (!propResult.ok) {
        const is403 = propResult.statusCode === 403;
        const is404 = propResult.statusCode === 404;
        return res.status(200).json({
          ok: true,
          authenticationSuccessful: true,
          propertyAccess: false,
          serviceAccountEmail: clientEmail,
          projectId: config?.project_id || 'assetdoctor-5fd25',
          checkedAt: new Date().toISOString(),
          status: is403 ? 'NOT_DELEGATED' : is404 ? 'PROPERTY_NOT_FOUND' : 'API_ERROR',
          message: is403
            ? `Service account authentication succeeded, but the service account does not have permission to access ${siteUrl}. Please add ${clientEmail} in Search Console property settings.`
            : is404
            ? `Search Console property ${siteUrl} was not found.`
            : `Property check returned HTTP ${propResult.statusCode}: ${propResult.error}`,
        });
      }

      return res.status(200).json({
        ok: true,
        authenticationSuccessful: true,
        propertyAccess: true,
        serviceAccountEmail: clientEmail,
        projectId: config?.project_id || 'assetdoctor-5fd25',
        siteUrl,
        checkedAt: new Date().toISOString(),
        permissionLevel: propResult.data?.permissionLevel || 'siteFullUser',
        status: 'ACTIVE_AND_VERIFIED',
        message: `Connection test passed! Authenticated as ${clientEmail} with access to ${siteUrl}.`,
      });

    } catch (err) {
      logger.error('[GSC_TEST_CONN_ERR]', { error: err.message });
      return res.status(500).json({ ok: false, error: 'Failed to test connection.' });
    }
  }
);

/**
 * Super Admin Endpoint to save/update Google Search Console configuration
 */
exports.adminSaveSearchConsoleConfig = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    secrets: [GSC_SECRET_KEY],
  },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    const adminUser = await requireAdmin(req);
    if (!adminUser) {
      return res.status(403).json({ ok: false, errorCategory: 'AUTH_FAILED', error: 'Unauthorized. Super Admin token required.' });
    }

    try {
      const body = req.body || {};
      const clientEmail = String(body.client_email || body.clientEmail || '').trim();
      const rawPrivateKey = String(body.private_key || body.privateKey || '').trim();
      const siteUrl = String(body.site_url || body.siteUrl || DEFAULT_GSC_SITE).trim();
      const projectId = String(body.project_id || body.projectId || 'assetdoctor-5fd25').trim();
      const serviceAccountType = String(body.type || 'service_account').trim();

      // Strict validation
      if (!clientEmail) {
        return res.status(400).json({ ok: false, errorCategory: 'INVALID_CREDENTIALS', error: 'Client email is required.' });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        return res.status(400).json({ ok: false, errorCategory: 'INVALID_CREDENTIALS', error: 'Invalid email format for service account.' });
      }

      if (serviceAccountType && serviceAccountType !== 'service_account') {
        return res.status(400).json({ ok: false, errorCategory: 'INVALID_CREDENTIALS', error: 'Invalid service-account type. Must be "service_account".' });
      }

      const updateData = {
        client_email: clientEmail,
        project_id: projectId,
        site_url: siteUrl,
        scope: GSC_SCOPE,
        status: 'CONFIGURED',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: adminUser.email,
      };

      if (rawPrivateKey) {
        // Validate PEM structure
        if (!rawPrivateKey.includes('BEGIN PRIVATE KEY') || !rawPrivateKey.includes('END PRIVATE KEY')) {
          return res.status(400).json({ ok: false, errorCategory: 'INVALID_CREDENTIALS', error: 'Malformed private key. Must be a valid PEM formatted string containing BEGIN and END PRIVATE KEY markers.' });
        }

        const normalizedKey = rawPrivateKey.includes('\\n') ? rawPrivateKey.replace(/\\n/g, '\n') : rawPrivateKey;

        // Verify key can be parsed and authenticated with Google OAuth
        try {
          const testJwt = new JWT({
            email: clientEmail,
            key: normalizedKey,
            scopes: [GSC_SCOPE],
          });
          // Initiate token acquisition to prove validity before committing to database
          await testJwt.getAccessToken();
        } catch (testAuthErr) {
          logger.warn('[GSC_SAVE_VALIDATE_REJECT] Provided credentials failed Google authentication probe', {
            error: testAuthErr.message,
          });
          return res.status(400).json({
            ok: false,
            errorCategory: 'INVALID_CREDENTIALS',
            error: `Provided credentials failed Google authentication: ${testAuthErr.message}. Existing working configuration was NOT overwritten.`,
          });
        }

        // Encrypt with AES-256-GCM
        const encryptedKey = encryptGscPrivateKey(normalizedKey);
        updateData.encrypted_private_key = encryptedKey;
        // Purge legacy plaintext field if exists
        updateData.private_key = admin.firestore.FieldValue.delete();
      }

      await db.collection('systemSettings').doc('google_search_console').set(updateData, { merge: true });

      logger.info('[GSC_CONFIG_SAVED] Search console settings encrypted and updated by super admin', {
        admin: adminUser.email,
        clientEmail,
        siteUrl,
      });

      return res.status(200).json({
        ok: true,
        message: 'Google Search Console configuration encrypted and saved successfully.',
        clientEmail,
        siteUrl,
      });
    } catch (err) {
      logger.error('[GSC_SAVE_ERR]', { error: err.message });
      return res.status(500).json({ ok: false, errorCategory: 'INTERNAL_ERROR', error: 'Failed to save configuration.' });
    }
  }
);

/* ============================================================
 * NOTE: Support Tickets & Document Intelligence functions were
 * moved to the dedicated codebase "asset-doctor-support"
 * (source: functions/support). See /functions/support.
 * ============================================================ */


/* ============================================================
 * PARKING ASSISTANT — Cloud Functions
 * Phase C: reportParkingIssue, acknowledgeParking, resolveParking,
 * adminGenerateParkingQr, adminRegenerateParkingQr, adminDisableParkingQr
 * ============================================================ */

const PARKING_QRS = 'parking_qrs';
const PARKING_ALERTS = 'parking_alerts';
const PARKING_RATE_LIMITS = 'parking_rate_limits';

const PARKING_QR_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  DISABLED: 'DISABLED',
});

const PARKING_ALERT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  OWNER_NOTIFIED: 'OWNER_NOTIFIED',
  OWNER_ACKNOWLEDGED: 'OWNER_ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
});

const VALID_ALERT_TYPES = new Set([
  'VEHICLE_BLOCKING', 'WRONG_PARKING', 'LIGHTS_LEFT_ON',
  'WINDOW_OPEN', 'VEHICLE_ISSUE', 'EMERGENCY',
]);

const ALERT_TYPE_LABEL = {
  VEHICLE_BLOCKING: 'Vehicle Blocking Me',
  WRONG_PARKING: 'Wrong Parking',
  LIGHTS_LEFT_ON: 'Lights Left On',
  WINDOW_OPEN: 'Window / Door Open',
  VEHICLE_ISSUE: 'Vehicle Issue',
  EMERGENCY: 'Emergency',
};

function parkingQrCorsHeaders(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function genParkingQrCode() {
  const chars = '0123456789ABCDEF';
  let out = 'AD-PARK-';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

async function uniqueParkingQrCode() {
  for (let i = 0; i < 8; i++) {
    const code = genParkingQrCode();
    const check = await db.collection(PARKING_QRS).doc(code).get();
    if (!check.exists) return code;
  }
  throw new Error('Could not generate a unique QR code after 8 attempts.');
}

async function sendParkingPushToOwner({ ownerUid, vehicleNumber, alertType, alertId }) {
  try {
    const userDoc = await db.collection('users').doc(ownerUid).get();
    if (!userDoc.exists) return;
    const userData = userDoc.data() || {};
    const fcmToken = userData.fcmToken || userData.expoPushToken;
    if (!fcmToken) {
      logger.info('[PARKING_PUSH] No FCM token for owner', { ownerUid });
      return;
    }
    const isEmergency = alertType === 'EMERGENCY';
    const title = isEmergency ? '❤️ Emergency — Parking Alert' : '🚨 Parking Alert';
    const body = `Someone reported: "${ALERT_TYPE_LABEL[alertType] || alertType}"${vehicleNumber ? ` for ${vehicleNumber}` : ''}.`;

    // Expo push token or FCM
    if (String(fcmToken).startsWith('ExponentPushToken')) {
      // Expo Push API (no server key needed, just HTTP)
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          to: fcmToken,
          title,
          body,
          data: { screen: 'ParkingAssistant', alertId, assetId: userDoc.data()?.assetId },
          sound: isEmergency ? 'default' : undefined,
          priority: isEmergency ? 'high' : 'default',
        }),
      }).catch((err) => logger.warn('[PARKING_PUSH] Expo push failed', err?.message));
    } else {
      // FCM legacy or v1 token
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: { screen: 'ParkingAssistant', alertId: String(alertId) },
        android: { priority: isEmergency ? 'high' : 'normal' },
        apns: { payload: { aps: { sound: 'default' } } },
      }).catch((err) => logger.warn('[PARKING_PUSH] FCM send failed', err?.message));
    }
    logger.info('[PARKING_PUSH] Notification sent to owner', { ownerUid, alertType });
  } catch (err) {
    logger.warn('[PARKING_PUSH] sendParkingPushToOwner error', { error: err?.message });
  }
}

async function auditParkingAction({ adminEmail, action, qrCode, assetId, details }) {
  try {
    const now = new Date().toISOString();
    await db.collection('auditLogs').add({
      timestamp: now,
      actorRole: 'admin',
      actorEmail: adminEmail || 'admin',
      action,
      targetQrCode: qrCode || null,
      targetAssetId: assetId || null,
      details: details || {},
      category: 'parking_qr',
    });
  } catch (err) {
    logger.warn('[PARKING_AUDIT] Failed to write audit log', err?.message);
  }
}

// ─── 1. reportParkingIssue (public — no auth required) ────────────────────
exports.reportParkingIssue = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
    parkingQrCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
      const { qrCode, alertType, message } = req.body || {};

      if (!qrCode || typeof qrCode !== 'string') return res.status(400).json({ error: 'qrCode is required.' });
      if (!alertType || !VALID_ALERT_TYPES.has(alertType)) return res.status(400).json({ error: 'Invalid alertType.' });

      const cleanQrCode = String(qrCode).toUpperCase().trim();
      if (!/^AD-PARK-[A-Z0-9]{6}$/.test(cleanQrCode)) return res.status(400).json({ error: 'Invalid QR code format.' });

      // Rate limiting: max 3 reports per IP+qrCode per hour
      const now = Date.now();
      const rateLimitId = `${cleanQrCode}_${String(req.ip || '').replace(/[^0-9a-zA-Z]/g, '_').slice(0, 40)}`;
      const rateLimitRef = db.collection(PARKING_RATE_LIMITS).doc(rateLimitId);
      const rateSnap = await rateLimitRef.get();
      if (rateSnap.exists) {
        const rateData = rateSnap.data() || {};
        const windowStart = rateData.windowStart || 0;
        const count = rateData.count || 0;
        const ONE_HOUR = 60 * 60 * 1000;
        if ((now - windowStart) < ONE_HOUR && count >= 3) {
          return res.status(429).json({ error: 'Too many reports. Please wait before reporting again.' });
        }
        if ((now - windowStart) >= ONE_HOUR) {
          await rateLimitRef.set({ windowStart: now, count: 1 });
        } else {
          await rateLimitRef.update({ count: count + 1 });
        }
      } else {
        await rateLimitRef.set({ windowStart: now, count: 1 });
      }

      // Look up QR record
      const qrDoc = await db.collection(PARKING_QRS).doc(cleanQrCode).get();
      if (!qrDoc.exists) return res.status(404).json({ error: 'QR code not found.' });

      const qrData = qrDoc.data() || {};
      if (qrData.status !== PARKING_QR_STATUS.ACTIVE) {
        return res.status(410).json({ error: 'This Parking QR is not active.', status: qrData.status });
      }

      const ownerUid = qrData.userId;
      const assetId = qrData.assetId;
      const vehicleNumber = qrData.vehicleNumber || qrData.assetName || '';

      // Create alert
      const alertId = `alert_${cleanQrCode}_${now}`;
      const nowIso = new Date(now).toISOString();
      const alertDoc = {
        alertId,
        qrCode: cleanQrCode,
        assetId,
        ownerUid,
        vehicleNumber,
        alertType,
        alertTypeLabel: ALERT_TYPE_LABEL[alertType] || alertType,
        message: String(message || '').slice(0, 500),
        photoUrl: null,
        status: PARKING_ALERT_STATUS.PENDING,
        createdAt: nowIso,
        updatedAt: nowIso,
        acknowledgedAt: null,
        resolvedAt: null,
        scannerPhone: null,
        scannerEmail: null,
      };

      await db.collection(PARKING_ALERTS).doc(alertId).set(alertDoc);

      logger.info('[PARKING_REPORT] Alert created', { alertId, alertType, ownerUid });

      // Send push notification (fire-and-forget)
      sendParkingPushToOwner({ ownerUid, vehicleNumber, alertType, alertId }).catch(() => {});

      // Mark QR record with last alert timestamp
      await db.collection(PARKING_QRS).doc(cleanQrCode).update({
        lastAlertAt: nowIso,
        alertCount: admin.firestore.FieldValue.increment(1),
        updatedAt: nowIso,
      }).catch(() => {});

      return res.status(200).json({ success: true, alertId, message: 'Owner has been notified.' });
    } catch (err) {
      logger.error('[PARKING_REPORT] Unhandled error', { error: err?.message });
      return res.status(500).json({ error: 'Internal error. Please try again.' });
    }
  }
);

// ─── 2. acknowledgeParking (owner auth required) ───────────────────────────
exports.acknowledgeParking = onRequest(
  { region: 'asia-south1', cors: true },
  async (req, res) => {
    parkingQrCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const authUser = await requireAdmin(req).catch(() => null);
      let ownerUid = authUser?.uid;
      if (!ownerUid) {
        // Non-admin users: verify their own token
        const header = String(req.headers.authorization || '');
        const match = header.match(/^Bearer\s+(.+)$/i);
        if (match) {
          const decoded = await admin.auth().verifyIdToken(match[1]).catch(() => null);
          ownerUid = decoded?.uid;
        }
      }
      if (!ownerUid) return res.status(401).json({ error: 'Authentication required.' });

      const { alertId } = req.body || {};
      if (!alertId) return res.status(400).json({ error: 'alertId is required.' });

      const alertDoc = await db.collection(PARKING_ALERTS).doc(alertId).get();
      if (!alertDoc.exists) return res.status(404).json({ error: 'Alert not found.' });

      const alertData = alertDoc.data() || {};
      if (alertData.ownerUid !== ownerUid && !authUser) {
        return res.status(403).json({ error: 'Unauthorized.' });
      }

      const now = new Date().toISOString();
      await db.collection(PARKING_ALERTS).doc(alertId).update({
        status: PARKING_ALERT_STATUS.OWNER_ACKNOWLEDGED,
        acknowledgedAt: now,
        acknowledgedBy: ownerUid,
        updatedAt: now,
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      logger.error('[PARKING_ACK] Error', { error: err?.message });
      return res.status(500).json({ error: 'Internal error.' });
    }
  }
);

// ─── 3. resolveParking (owner auth required) ──────────────────────────────
exports.resolveParking = onRequest(
  { region: 'asia-south1', cors: true },
  async (req, res) => {
    parkingQrCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const header = String(req.headers.authorization || '');
      const match = header.match(/^Bearer\s+(.+)$/i);
      if (!match) return res.status(401).json({ error: 'Authentication required.' });
      const decoded = await admin.auth().verifyIdToken(match[1]).catch(() => null);
      if (!decoded) return res.status(401).json({ error: 'Invalid token.' });

      const { alertId } = req.body || {};
      if (!alertId) return res.status(400).json({ error: 'alertId is required.' });

      const alertDoc = await db.collection(PARKING_ALERTS).doc(alertId).get();
      if (!alertDoc.exists) return res.status(404).json({ error: 'Alert not found.' });

      const alertData = alertDoc.data() || {};
      const isOwner = alertData.ownerUid === decoded.uid;
      const isSuperAdmin = decoded.super_admin === true;
      if (!isOwner && !isSuperAdmin) return res.status(403).json({ error: 'Unauthorized.' });

      const now = new Date().toISOString();
      await db.collection(PARKING_ALERTS).doc(alertId).update({
        status: PARKING_ALERT_STATUS.RESOLVED,
        resolvedAt: now,
        resolvedBy: decoded.uid,
        updatedAt: now,
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      logger.error('[PARKING_RESOLVE] Error', { error: err?.message });
      return res.status(500).json({ error: 'Internal error.' });
    }
  }
);

// ─── 4. adminGenerateParkingQr (super_admin only) ─────────────────────────
exports.adminGenerateParkingQr = onRequest(
  { region: 'asia-south1', cors: true },
  async (req, res) => {
    parkingQrCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const adminUser = await requireAdmin(req);
      if (!adminUser) return res.status(403).json({ error: 'Super admin access required.' });

      const { assetId, userId, vehicleNumber, assetName } = req.body || {};
      if (!assetId || !userId) return res.status(400).json({ error: 'assetId and userId are required.' });

      // Idempotent: check for existing ACTIVE QR
      const existingSnap = await db.collection(PARKING_QRS)
        .where('assetId', '==', assetId)
        .where('status', '==', PARKING_QR_STATUS.ACTIVE)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        return res.status(200).json({ success: true, qrCode: existingDoc.id, isNew: false, ...existingDoc.data() });
      }

      const qrCode = await uniqueParkingQrCode();
      const now = new Date().toISOString();
      const payload = {
        qrCode, assetId, userId,
        vehicleNumber: String(vehicleNumber || '').trim(),
        assetName: String(assetName || '').trim(),
        status: PARKING_QR_STATUS.ACTIVE,
        createdAt: now, updatedAt: now,
        source: 'admin', createdBy: adminUser.uid,
      };

      await db.collection(PARKING_QRS).doc(qrCode).set(payload);
      await auditParkingAction({ adminEmail: adminUser.email, action: 'parking_qr_generated', qrCode, assetId });

      logger.info('[PARKING_ADMIN] QR generated', { qrCode, assetId, admin: adminUser.email });
      return res.status(200).json({ success: true, qrCode, isNew: true, ...payload });
    } catch (err) {
      logger.error('[PARKING_ADMIN] adminGenerateParkingQr error', { error: err?.message });
      return res.status(500).json({ error: 'Internal error.' });
    }
  }
);

// ─── 5. adminRegenerateParkingQr (super_admin only) ───────────────────────
exports.adminRegenerateParkingQr = onRequest(
  { region: 'asia-south1', cors: true },
  async (req, res) => {
    parkingQrCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const adminUser = await requireAdmin(req);
      if (!adminUser) return res.status(403).json({ error: 'Super admin access required.' });

      const { assetId, userId, confirmRegenerate } = req.body || {};
      if (!assetId || !userId) return res.status(400).json({ error: 'assetId and userId are required.' });
      if (confirmRegenerate !== true) return res.status(400).json({ error: 'confirmRegenerate: true required to prevent accidents.' });

      const now = new Date().toISOString();

      // Find all active QRs for this asset
      const activeSnap = await db.collection(PARKING_QRS)
        .where('assetId', '==', assetId)
        .where('status', '==', PARKING_QR_STATUS.ACTIVE)
        .get();

      const oldCodes = activeSnap.docs.map((d) => d.id);
      const newQrCode = await uniqueParkingQrCode();

      const batch = db.batch();
      for (const oldCode of oldCodes) {
        batch.update(db.collection(PARKING_QRS).doc(oldCode), {
          status: PARKING_QR_STATUS.REVOKED,
          revokedAt: now,
          revokedBy: adminUser.uid,
          revokedReason: 'ADMIN_REGENERATE',
          updatedAt: now,
        });
      }

      const newPayload = {
        qrCode: newQrCode, assetId, userId,
        status: PARKING_QR_STATUS.ACTIVE,
        createdAt: now, updatedAt: now,
        source: 'admin', createdBy: adminUser.uid,
        replacedQrCodes: oldCodes,
      };
      batch.set(db.collection(PARKING_QRS).doc(newQrCode), newPayload);
      await batch.commit();

      await auditParkingAction({ adminEmail: adminUser.email, action: 'parking_qr_regenerated', qrCode: newQrCode, assetId, details: { revokedCodes: oldCodes } });

      logger.info('[PARKING_ADMIN] QR regenerated', { newQrCode, oldCodes, admin: adminUser.email });
      return res.status(200).json({ success: true, qrCode: newQrCode, oldQrCodes: oldCodes });
    } catch (err) {
      logger.error('[PARKING_ADMIN] adminRegenerateParkingQr error', { error: err?.message });
      return res.status(500).json({ error: 'Internal error.' });
    }
  }
);

// ─── 6. adminDisableParkingQr (super_admin only) ──────────────────────────
exports.adminDisableParkingQr = onRequest(
  { region: 'asia-south1', cors: true },
  async (req, res) => {
    parkingQrCorsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const adminUser = await requireAdmin(req);
      if (!adminUser) return res.status(403).json({ error: 'Super admin access required.' });

      const { qrCode } = req.body || {};
      if (!qrCode) return res.status(400).json({ error: 'qrCode is required.' });

      const now = new Date().toISOString();
      const qrRef = db.collection(PARKING_QRS).doc(String(qrCode).toUpperCase().trim());
      const qrDoc = await qrRef.get();
      if (!qrDoc.exists) return res.status(404).json({ error: 'QR code not found.' });

      await qrRef.update({ status: PARKING_QR_STATUS.DISABLED, disabledAt: now, disabledBy: adminUser.uid, updatedAt: now });
      await auditParkingAction({ adminEmail: adminUser.email, action: 'parking_qr_disabled', qrCode, assetId: qrDoc.data()?.assetId });

      logger.info('[PARKING_ADMIN] QR disabled', { qrCode, admin: adminUser.email });
      return res.status(200).json({ success: true });
    } catch (err) {
      logger.error('[PARKING_ADMIN] adminDisableParkingQr error', { error: err?.message });
      return res.status(500).json({ error: 'Internal error.' });
    }
  }
);

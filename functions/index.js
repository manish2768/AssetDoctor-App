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
 * NOTE: Support Tickets & Document Intelligence functions were
 * moved to the dedicated codebase "asset-doctor-support"
 * (source: functions/support). See /functions/support.
 * ============================================================ */

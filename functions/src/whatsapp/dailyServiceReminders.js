/**
 * Daily WhatsApp utility reminders — `asset_service_reminder`
 * Scans Users/{uid}/Assets for PUC / insurance / warranty / next service.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');

const { getWhatsAppConfig } = require('../config/whatsappConfig');
const { sendServiceReminderTemplate } = require('./templates');
const { toWhatsAppRecipient, formatDueDate } = require('./phoneUtils');
const { cors, requireAdminSecret, kolkataTodayKey, daysUntilKolkata } = require('./httpUtils');

const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return String(value).trim();
}

function readReminderDayOffsets() {
  const raw = readEnv('WHATSAPP_REMINDER_DAYS', '7');
  const parsed = String(raw)
    .split(',')
    .map((d) => Number(d.trim()))
    .filter((n) => Number.isFinite(n));
  return parsed.length ? parsed : [7];
}

const REMINDER_DAY_OFFSETS = readReminderDayOffsets();

/** Vehicle RC compliance is tracked via PUC + insurance fields on asset docs */
const REMINDER_WINDOWS = {
  pucExpiry: { label: 'PUC Renewal', days: REMINDER_DAY_OFFSETS },
  insuranceExpiry: { label: 'Insurance Renewal', days: REMINDER_DAY_OFFSETS },
  warrantyExpiry: { label: 'Warranty Expiry', days: REMINDER_DAY_OFFSETS },
  nextServiceDue: { label: 'Service Due', days: REMINDER_DAY_OFFSETS },
};

const USER_PAGE_SIZE = 200;
const ALERTABLE = new Set(['active', 'in_repair', undefined, null, '']);

function buildReminders(asset, now) {
  if (!ALERTABLE.has(asset.status) || asset.deletedAt) return [];
  const out = [];
  for (const [field, meta] of Object.entries(REMINDER_WINDOWS)) {
    const days = daysUntilKolkata(asset[field], now);
    if (days === null || !meta.days.includes(days)) continue;
    out.push({
      field,
      eventType: meta.label,
      dueDate: asset[field],
      days,
      assetId: asset.assetId || asset.id,
      assetName: asset.assetName || 'Asset',
    });
  }
  return out;
}

async function claimSlot(db, dedupeId, payload) {
  const ref = db.collection('notification_logs').doc(dedupeId);
  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) throw new Error('DUPLICATE');
      tx.set(ref, {
        ...payload,
        channel: 'whatsapp',
        template: 'asset_service_reminder',
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return true;
  } catch (err) {
    if (String(err.message) === 'DUPLICATE') return false;
    throw err;
  }
}

async function processUserWhatsApp(db, userDoc, now, day, stats, token) {
  const uid = userDoc.id;
  const user = userDoc.data() || {};
  const phone = toWhatsAppRecipient(user.phoneNumber || user.phone);
  if (!phone) {
    stats.skippedNoPhone += 1;
    return;
  }
  if (user.whatsappRemindersOptOut === true) {
    stats.skippedOptOut += 1;
    return;
  }

  const userName = user.name || user.displayName || 'Asset Owner';
  let assetsSnap;
  try {
    assetsSnap = await userDoc.ref.collection('Assets').get();
  } catch (err) {
    logger.error('WA reminders assets failed', { uid, err: String(err) });
    return;
  }

  for (const assetDoc of assetsSnap.docs) {
    const asset = { id: assetDoc.id, ...assetDoc.data() };
    const reminders = buildReminders(asset, now);
    for (const reminder of reminders) {
      const dedupeId = `wa_${uid}_${reminder.assetId}_${reminder.field}_${reminder.days}_${day}`;
      let claimed = false;
      try {
        claimed = await claimSlot(db, dedupeId, {
          uid,
          assetId: reminder.assetId,
          kind: reminder.field,
          days: reminder.days,
          dueDate: reminder.dueDate || null,
          day,
          status: 'pending',
          phoneHint: phone.slice(-4),
        });
      } catch (err) {
        logger.error('WA claim failed', { dedupeId, err: String(err) });
        continue;
      }
      if (!claimed) continue;

      try {
        await sendServiceReminderTemplate({
          to: phone,
          userName,
          assetName: reminder.assetName,
          eventType:
            reminder.days < 0 ? `${reminder.eventType} Expired` : reminder.eventType,
          dueDate: formatDueDate(reminder.dueDate),
          token,
        });
        await db.collection('notification_logs').doc(dedupeId).set(
          { status: 'sent', sentAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
        stats.whatsappSent += 1;
      } catch (err) {
        logger.error('WA reminder send failed', {
          uid,
          assetId: reminder.assetId,
          err: String(err?.message || err),
        });
        await db
          .collection('notification_logs')
          .doc(dedupeId)
          .set({ status: 'error', error: String(err?.message || err) }, { merge: true })
          .catch(() => null);
        stats.errors += 1;
      }
    }
  }
}

async function runWhatsAppReminderSweep(token) {
  const stats = {
    usersScanned: 0,
    whatsappSent: 0,
    skippedNoPhone: 0,
    skippedOptOut: 0,
    errors: 0,
    pages: 0,
  };
  const db = getFirestore();
  const now = new Date();
  const day = kolkataTodayKey(now);
  // Ensure env defaults available for template language
  getWhatsAppConfig({ token });

  let lastDoc = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = db.collection('Users').orderBy('__name__').limit(USER_PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const page = await query.get();
    if (page.empty) break;
    stats.pages += 1;
    lastDoc = page.docs[page.docs.length - 1];

    for (const userDoc of page.docs) {
      stats.usersScanned += 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        await processUserWhatsApp(db, userDoc, now, day, stats, token);
      } catch (err) {
        logger.error('WA user failed', { uid: userDoc.id, err: String(err) });
        stats.errors += 1;
      }
    }
    if (page.size < USER_PAGE_SIZE) break;
  }

  logger.info('dailyWhatsAppReminders complete', { ...stats, day });
  return { ...stats, day };
}

exports.dailyWhatsAppReminders = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    secrets: [WHATSAPP_TOKEN],
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => runWhatsAppReminderSweep(WHATSAPP_TOKEN.value()),
);

/** Manual / admin trigger for the same sweep — requires WHATSAPP_ADMIN_SECRET */
exports.runWhatsAppRemindersNow = onRequest(
  {
    region: 'asia-south1',
    secrets: [WHATSAPP_TOKEN],
    timeoutSeconds: 540,
    memory: '512MiB',
    cors: true,
  },
  async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ success: false, error: 'POST required' });
      return;
    }
    if (!requireAdminSecret(req, res)) return;
    try {
      const result = await runWhatsAppReminderSweep(WHATSAPP_TOKEN.value());
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      logger.error('runWhatsAppRemindersNow failed', { err: String(err?.message || err) });
      res.status(500).json({ success: false, error: err?.message || 'Sweep failed' });
    }
  },
);

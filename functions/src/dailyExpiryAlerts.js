/**
 * Daily CRON — production hardened
 * - Paginates users (no full-collection memory blow-up)
 * - Chunks Expo push (max 100/request)
 * - Skips retired/sold assets
 * - Transactional dedupe on notification_logs
 * - Outer try/catch; never leaves unhandled rejections
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');

const SERVICE_ALERT_DAYS = [30, 14, 7, 3, 1];
const ALERT_PROFILES = {
  pucExpiry: {
    label: 'PUC',
    days: [7, 1],
    message: 'Save ₹10,000 fine! Your PUC expires soon.',
  },
  insuranceExpiry: {
    label: 'Motor insurance',
    days: [15, 3],
    message: 'Your motor insurance expires soon. Renew before your cover ends.',
  },
  warrantyExpiry: {
    label: 'Warranty',
    days: [30],
    message: 'Claim free service or extend warranty now.',
  },
};
const USER_PAGE_SIZE = 200;
const EXPO_CHUNK = 100;
const ALERTABLE = new Set(['active', 'in_repair', undefined, null, '']);

function toDateOnly(value) {
  if (!value) return null;
  try {
    if (typeof value === 'string') {
      const d = new Date(`${value.slice(0, 10)}T00:00:00Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value.toDate === 'function') return value.toDate();
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  } catch {
    return null;
  }
  return null;
}

function daysUntil(dateValue, now = new Date()) {
  const target = toDateOnly(dateValue);
  if (!target) return null;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((end - start) / 86400000);
}

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function sendExpoPush(tokens, title, body, data = {}) {
  const list = [...new Set((tokens || []).filter((t) => typeof t === 'string' && t.length > 0))];
  if (!list.length) return { sent: 0 };

  let sent = 0;
  for (const group of chunk(list, EXPO_CHUNK)) {
    const messages = group.map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
    }));

    let res;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });
        if (res.ok) break;
        const text = await res.text().catch(() => '');
        throw new Error(`Expo push failed: ${res.status} ${text}`);
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, attempt * 750));
        }
      }
    }
    if (!res?.ok) {
      throw new Error(`Expo push failed after retries: ${lastError?.message || lastError}`);
    }

    // Drain body so sockets free under load
    await res.json().catch(() => null);
    sent += messages.length;
  }

  return { sent };
}

function buildAssetAlerts(asset, now) {
  if (!ALERTABLE.has(asset.status)) return [];

  const alerts = [];
  for (const [key, profile] of Object.entries(ALERT_PROFILES)) {
    const days = daysUntil(asset[key], now);
    if (days === null || !profile.days.includes(days)) continue;
    alerts.push({
      kind: key,
      label: profile.label,
      message: profile.message,
      days,
      dueDate: asset[key],
      assetId: asset.assetId || asset.id,
      assetName: asset.assetName || 'Asset',
    });
  }
  return alerts;
}

function buildScheduleAlerts(schedule, asset, now) {
  if (!ALERTABLE.has(asset.status)) return [];
  const days = daysUntil(schedule.dueDate, now);
  if (days === null) return [];
  const window = Array.isArray(schedule.remindDaysBefore)
    ? schedule.remindDaysBefore
    : SERVICE_ALERT_DAYS;
  if (!window.includes(days)) return [];
  if (schedule.status && !['upcoming', 'due'].includes(schedule.status)) return [];

  return [
    {
      kind: 'service_schedule',
      label: schedule.title || 'Service',
      days,
      dueDate: schedule.dueDate,
      assetId: asset.assetId || asset.id,
      assetName: asset.assetName || 'Asset',
      scheduleId: schedule.scheduleId || schedule.id,
    },
  ];
}

async function claimNotificationSlot(db, dedupeId, payload) {
  const logRef = db.collection('notification_logs').doc(dedupeId);
  try {
    await db.runTransaction(async (tx) => {
      const existing = await tx.get(logRef);
      if (existing.exists) {
        throw new Error('DUPLICATE');
      }
      tx.set(logRef, {
        ...payload,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return true;
  } catch (err) {
    if (String(err.message) === 'DUPLICATE') return false;
    throw err;
  }
}

async function processUser(db, userDoc, now, day, stats) {
  const uid = userDoc.id;
  const user = userDoc.data() || {};
  const tokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : [];
  const localExpiryTokens = new Set(
    Array.isArray(user.localExpiryTokens) ? user.localExpiryTokens : [],
  );
  const remoteExpiryTokens = tokens.filter((token) => !localExpiryTokens.has(token));
  if (!tokens.length) return;

  let assetsSnap;
  try {
    assetsSnap = await userDoc.ref.collection('Assets').get();
  } catch (err) {
    logger.error('assets fetch failed', { uid, err: String(err) });
    return;
  }

  for (const assetDoc of assetsSnap.docs) {
    const asset = { id: assetDoc.id, ...assetDoc.data() };
    if (asset.deletedAt) continue;

    let alerts = buildAssetAlerts(asset, now);

    try {
      let schedulesSnap;
      try {
        schedulesSnap = await assetDoc.ref
          .collection('ServiceSchedules')
          .where('status', 'in', ['upcoming', 'due'])
          .get();
      } catch {
        schedulesSnap = await assetDoc.ref.collection('ServiceSchedules').get();
      }

      for (const schDoc of schedulesSnap.docs) {
        alerts = alerts.concat(
          buildScheduleAlerts({ id: schDoc.id, ...schDoc.data() }, asset, now),
        );
      }
    } catch (err) {
      logger.warn('schedules skipped', { uid, assetId: asset.id, err: String(err) });
    }

    for (const alert of alerts) {
      const targetTokens = Object.hasOwn(ALERT_PROFILES, alert.kind)
        ? remoteExpiryTokens
        : tokens;
      if (!targetTokens.length) continue;
      const dedupeId = `${uid}_${alert.assetId}_${alert.kind}_${alert.days}_${day}`;
      const when =
        alert.days < 0
          ? `expired ${Math.abs(alert.days)} day(s) ago`
          : alert.days === 0
            ? 'expires today'
            : `expires in ${alert.days} day(s)`;

      const title = `${alert.label} reminder`;
      const body = alert.message
        ? `${alert.assetName}: ${alert.message} ${when}.`
        : `${alert.assetName}: ${alert.label} ${when}.`;

      let claimed = false;
      try {
        claimed = await claimNotificationSlot(db, dedupeId, {
          uid,
          assetId: alert.assetId,
          kind: alert.kind,
          label: alert.label,
          days: alert.days,
          dueDate: alert.dueDate || null,
          scheduleId: alert.scheduleId || null,
          title,
          body,
          day,
          status: 'pending',
        });
      } catch (err) {
        logger.error('dedupe failed', { dedupeId, err: String(err) });
        continue;
      }

      if (!claimed) continue;

      try {
        await sendExpoPush(targetTokens, title, body, {
          assetId: alert.assetId,
          kind: alert.kind,
          days: alert.days,
        });
        await db.collection('notification_logs').doc(dedupeId).set(
          { status: 'sent', sentAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
        stats.notificationsSent += 1;
      } catch (err) {
        logger.error('Push failed', { uid, alert, err: String(err) });
        await db
          .collection('notification_logs')
          .doc(dedupeId)
          .set({ status: 'error', error: String(err.message || err) }, { merge: true })
          .catch(() => null);
      }
    }
  }
}

exports.dailyExpiryAlerts = onSchedule(
  {
    schedule: 'every day 03:30',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const stats = { usersScanned: 0, notificationsSent: 0, pages: 0 };
    const db = getFirestore();
    const now = new Date();
    const day = todayKey(now);

    try {
      let lastDoc = null;
      // Paginate users to bound memory
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let query = db.collection('Users').orderBy('__name__').limit(USER_PAGE_SIZE);
        if (lastDoc) query = query.startAfter(lastDoc);

        let page;
        try {
          page = await query.get();
        } catch (err) {
          logger.error('user page failed', { err: String(err) });
          break;
        }

        if (page.empty) break;
        stats.pages += 1;
        lastDoc = page.docs[page.docs.length - 1];

        for (const userDoc of page.docs) {
          stats.usersScanned += 1;
          try {
            await processUser(db, userDoc, now, day, stats);
          } catch (err) {
            logger.error('user processing failed', { uid: userDoc.id, err: String(err) });
          }
        }

        if (page.size < USER_PAGE_SIZE) break;
      }

      logger.info('dailyExpiryAlerts complete', { ...stats, day });
      return { ...stats, day };
    } catch (err) {
      logger.error('dailyExpiryAlerts fatal', { err: String(err) });
      throw err;
    }
  },
);

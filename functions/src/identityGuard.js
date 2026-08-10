/**
 * HTTP + callable — check email / phone are free or owned by the caller.
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizePhone(value) {
  const trimmed = String(value || '').replace(/[\s-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  if (trimmed.startsWith('91') && trimmed.length === 12) return `+${trimmed}`;
  return trimmed;
}

async function findConflict(db, field, value, excludeUid) {
  if (!value) return null;
  const snap = await db.collection('users').where(field, '==', value).limit(5).get();
  for (const doc of snap.docs) {
    if (excludeUid && doc.id === excludeUid) continue;
    return { uid: doc.id, field };
  }
  const legacy = await db.collection('Users').where(field, '==', value).limit(5).get();
  for (const doc of legacy.docs) {
    if (excludeUid && doc.id === excludeUid) continue;
    return { uid: doc.id, field };
  }
  return null;
}

async function runCheck({ email, phone, excludeUid }) {
  const db = getFirestore();
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = normalizePhone(phone);

  if (!cleanEmail && !cleanPhone) {
    return { available: true };
  }

  if (cleanPhone) {
    const byPhoneNumber = await findConflict(db, 'phoneNumber', cleanPhone, excludeUid);
    if (byPhoneNumber) {
      return {
        available: false,
        field: 'phone',
        message: 'Phone number is already registered with another account.',
      };
    }
    const byPhone = await findConflict(db, 'phone', cleanPhone, excludeUid);
    if (byPhone) {
      return {
        available: false,
        field: 'phone',
        message: 'Phone number is already registered with another account.',
      };
    }
  }

  if (cleanEmail) {
    const byEmail = await findConflict(db, 'email', cleanEmail, excludeUid);
    if (byEmail) {
      return {
        available: false,
        field: 'email',
        message: 'Email is already registered with another account.',
      };
    }
  }

  return { available: true };
}

exports.checkIdentityAvailable = onCall(
  { region: 'asia-south1', invoker: 'public' },
  async (request) => {
    try {
      return await runCheck({
        email: request.data?.email,
        phone: request.data?.phone || request.data?.phoneNumber,
        excludeUid: request.auth?.uid || request.data?.excludeUid || null,
      });
    } catch (err) {
      logger.error('checkIdentityAvailable failed', err);
      throw new HttpsError('internal', err?.message || 'Identity check failed');
    }
  },
);

/** Fetch-friendly HTTP twin (no @react-native-firebase/functions needed on client) */
exports.checkIdentityAvailableHttp = onRequest(
  { region: 'asia-south1', cors: true, invoker: 'public' },
  async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }
      if (req.method !== 'POST') {
        res.status(405).json({ available: false, message: 'POST only' });
        return;
      }
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const result = await runCheck({
        email: body.email,
        phone: body.phone || body.phoneNumber,
        excludeUid: body.excludeUid || null,
      });
      res.status(200).json(result);
    } catch (err) {
      logger.error('checkIdentityAvailableHttp failed', err);
      res.status(500).json({ available: true, skipped: true, error: String(err?.message || err) });
    }
  },
);

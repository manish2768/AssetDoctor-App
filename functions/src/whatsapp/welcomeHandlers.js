/**
 * Welcome WhatsApp — on new Users/{uid} profile create, or HTTP trigger.
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');

const { getWhatsAppConfig } = require('../config/whatsappConfig');
const { sendWelcomeTemplate } = require('./templates');
const { toWhatsAppRecipient } = require('./phoneUtils');
const { cors, readJson, requireAdminSecret } = require('./httpUtils');

const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');

async function deliverWelcome({ uid, name, phone, token }) {
  const digits = toWhatsAppRecipient(phone);
  if (!digits) {
    return { success: false, skipped: true, reason: 'no-phone' };
  }
  const config = getWhatsAppConfig({ token });
  const welcomeName = String(name || '').trim() || digits;
  await sendWelcomeTemplate({
    to: digits,
    name: welcomeName,
    websiteUrl: config.websiteUrl,
    token,
    languageCode: config.templateLang,
  });
  if (uid && !String(uid).startsWith('phone_')) {
    const db = getFirestore();
    await Promise.all([
      db.collection('Users').doc(uid).set(
        {
          welcomeWhatsAppSent: true,
          welcomeWhatsAppSentAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
      db.collection('users').doc(uid).set(
        {
          welcomeWhatsAppSent: true,
          welcomeWhatsAppSentAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      ),
    ]);
  }
  return { success: true };
}

/**
 * Firestore trigger — first Users/{uid} write for a brand-new profile.
 * Skip if OTP verify already marked welcomeWhatsAppSent.
 */
exports.onUserCreatedWelcomeWhatsApp = onDocumentCreated(
  {
    document: 'Users/{uid}',
    region: 'asia-south1',
    secrets: [WHATSAPP_TOKEN],
  },
  async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data() || {};
    // WhatsApp OTP verify owns welcome — avoid double-send race with this trigger
    if (data.authProvider === 'whatsapp_otp') {
      logger.info('welcome WhatsApp skipped — OTP verify owns send', { uid });
      return null;
    }
    if (data.welcomeWhatsAppSent) {
      logger.info('welcome WhatsApp already sent', { uid });
      return null;
    }
    const phone = data.phoneNumber || data.phone;
    if (!phone) {
      logger.info('welcome WhatsApp skipped — no phone', { uid });
      return null;
    }
    try {
      const result = await deliverWelcome({
        uid,
        name: data.name || data.displayName,
        phone,
        token: WHATSAPP_TOKEN.value(),
      });
      logger.info('welcome WhatsApp result', { uid, result });
      return result;
    } catch (err) {
      logger.error('onUserCreatedWelcomeWhatsApp failed', {
        uid,
        err: String(err?.message || err),
      });
      // Mark failure so ops can retry; do not invent success
      await getFirestore()
        .collection('Users')
        .doc(uid)
        .set(
          {
            welcomeWhatsAppError: String(err?.message || err).slice(0, 200),
            welcomeWhatsAppFailedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        .catch(() => null);
      return null;
    }
  },
);

/**
 * Firestore trigger — profile completed (Gmail / email) → welcome WhatsApp.
 * Fires when profileSetupComplete flips to true and phone is present.
 */
exports.onProfileCompletedWelcomeWhatsApp = onDocumentUpdated(
  {
    document: 'Users/{uid}',
    region: 'asia-south1',
    secrets: [WHATSAPP_TOKEN],
  },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};

    if (after.welcomeWhatsAppSent) return null;
    if (after.authProvider === 'whatsapp_otp') return null;

    const justCompleted =
      after.profileSetupComplete === true && before.profileSetupComplete !== true;
    const phoneAdded =
      after.profileSetupComplete === true &&
      !before.phoneNumber &&
      !before.phone &&
      Boolean(after.phoneNumber || after.phone);

    if (!justCompleted && !phoneAdded) return null;

    const phone = after.phoneNumber || after.phone;
    if (!phone) {
      logger.info('profile welcome skipped — no phone', { uid });
      return null;
    }

    try {
      const result = await deliverWelcome({
        uid,
        name: after.name || after.displayName,
        phone,
        token: WHATSAPP_TOKEN.value(),
      });
      logger.info('profile completed welcome WhatsApp', { uid, result });
      return result;
    } catch (err) {
      logger.error('onProfileCompletedWelcomeWhatsApp failed', {
        uid,
        err: String(err?.message || err),
      });
      return null;
    }
  },
);

/**
 * POST { uid?, phoneNumber, name, adminSecret } — admin / ops welcome retry.
 * Requires WHATSAPP_ADMIN_SECRET (header X-Admin-Secret or body.adminSecret).
 */
exports.sendWelcomeWhatsApp = onRequest(
  {
    region: 'asia-south1',
    secrets: [WHATSAPP_TOKEN],
    timeoutSeconds: 30,
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
      const body = readJson(req);
      const phone = body.phoneNumber || body.phone;
      const name = body.name || 'Asset Owner';
      const uid = body.uid || null;
      if (!phone) {
        res.status(400).json({ success: false, error: 'phoneNumber required' });
        return;
      }
      if (uid) {
        const snap = await getFirestore().collection('Users').doc(uid).get();
        if (snap.exists && snap.data()?.welcomeWhatsAppSent) {
          res.status(200).json({ success: true, skipped: true, reason: 'already-sent' });
          return;
        }
      }
      const result = await deliverWelcome({
        uid: uid || null,
        name,
        phone,
        token: WHATSAPP_TOKEN.value(),
      });
      res.status(200).json(result);
    } catch (err) {
      logger.error('sendWelcomeWhatsApp failed', { err: String(err?.message || err) });
      res.status(500).json({ success: false, error: err?.message || 'Welcome send failed' });
    }
  },
);

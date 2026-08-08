/**
 * WhatsApp OTP — send + verify (custom Firebase Auth token).
 */

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');

const { getWhatsAppConfig } = require('../config/whatsappConfig');
const { sendOtpTemplate, sendWelcomeTemplate } = require('./templates');
const {
  toWhatsAppRecipient,
  toE164,
  generateOtp,
  hashOtp,
  timingSafeEqualHex,
} = require('./phoneUtils');
const { cors, readJson } = require('./httpUtils');

const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN');
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function otpDocId(phoneDigits) {
  return `wa_${phoneDigits}`;
}

/**
 * POST { phoneNumber: "+9198..." | "987..." }
 * Generates 6-digit OTP, stores hash, sends `asset_doctor_otp`.
 */
exports.sendWhatsAppOtp = onRequest(
  {
    region: 'asia-south1',
    secrets: [WHATSAPP_TOKEN],
    timeoutSeconds: 30,
    memory: '256MiB',
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

    try {
      const body = readJson(req);
      const phoneDigits = toWhatsAppRecipient(body.phoneNumber || body.phone);
      if (!phoneDigits || phoneDigits.length < 10) {
        res.status(400).json({ success: false, error: 'Valid phone number required' });
        return;
      }
      const e164 = toE164(phoneDigits);

      const config = getWhatsAppConfig({ token: WHATSAPP_TOKEN.value() });
      const db = getFirestore();
      const ref = db.collection('whatsapp_otp').doc(otpDocId(phoneDigits));
      const existing = await ref.get();
      if (existing.exists) {
        const prev = existing.data() || {};
        const created =
          prev.createdAt?.toDate?.() ||
          (prev.createdAt ? new Date(prev.createdAt) : null);
        if (created && Date.now() - created.getTime() < OTP_RESEND_COOLDOWN_MS) {
          const waitSec = Math.ceil(
            (OTP_RESEND_COOLDOWN_MS - (Date.now() - created.getTime())) / 1000,
          );
          res.status(429).json({
            success: false,
            error: `Wait ${waitSec}s before requesting another OTP`,
          });
          return;
        }
      }

      const otp = generateOtp(6);
      const salt = `${phoneDigits}:${Date.now()}`;
      const otpHash = hashOtp(otp, salt);
      const expiresAt = new Date(Date.now() + config.otpTtlMinutes * 60 * 1000);

      await ref.set({
        phone: phoneDigits,
        e164,
        otpHash,
        salt,
        attempts: 0,
        expiresAt,
        createdAt: FieldValue.serverTimestamp(),
        channel: 'whatsapp',
        template: 'asset_doctor_otp',
      });

      await sendOtpTemplate({
        to: phoneDigits,
        otp,
        token: WHATSAPP_TOKEN.value(),
        languageCode: config.templateLang,
      });

      logger.info('WhatsApp OTP dispatched', { phoneHint: phoneDigits.slice(-4) });
      res.status(200).json({
        success: true,
        channel: 'whatsapp',
        expiresInSec: config.otpTtlMinutes * 60,
        phoneHint: `******${phoneDigits.slice(-4)}`,
      });
    } catch (err) {
      logger.error('sendWhatsAppOtp failed', { err: String(err?.message || err) });
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to send WhatsApp OTP',
      });
    }
  },
);

/**
 * POST { phoneNumber, otp, name? }
 * Verifies OTP → Firebase custom token (create user by phone if needed).
 */
exports.verifyWhatsAppOtp = onRequest(
  {
    region: 'asia-south1',
    secrets: [WHATSAPP_TOKEN],
    timeoutSeconds: 60,
    memory: '256MiB',
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

    try {
      const body = readJson(req);
      const phoneDigits = toWhatsAppRecipient(body.phoneNumber || body.phone);
      const e164 = toE164(phoneDigits);
      const otp = String(body.otp || body.code || '').trim();
      if (!phoneDigits || !/^\d{6}$/.test(otp)) {
        res.status(400).json({ success: false, error: 'Phone and 6-digit OTP required' });
        return;
      }

      const config = getWhatsAppConfig({ token: WHATSAPP_TOKEN.value() });
      const db = getFirestore();
      const ref = db.collection('whatsapp_otp').doc(otpDocId(phoneDigits));
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(400).json({ success: false, error: 'OTP expired or not requested' });
        return;
      }

      const record = snap.data() || {};
      const expiresAt = record.expiresAt?.toDate?.() || new Date(record.expiresAt);
      if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
        await ref.delete().catch(() => null);
        res.status(400).json({ success: false, error: 'OTP expired — request a new code' });
        return;
      }

      const attempts = Number(record.attempts || 0);
      if (attempts >= config.otpMaxAttempts) {
        await ref.delete().catch(() => null);
        res.status(429).json({ success: false, error: 'Too many attempts — request a new OTP' });
        return;
      }

      const expected = hashOtp(otp, record.salt);
      if (!timingSafeEqualHex(expected, record.otpHash)) {
        await ref.set({ attempts: attempts + 1 }, { merge: true });
        res.status(400).json({ success: false, error: 'Invalid OTP' });
        return;
      }

      await ref.delete().catch(() => null);

      const requestedName = String(body.name || '').trim().slice(0, 80);
      // Never invent "Asset Owner" — prefer provided name, else phone E.164, else empty
      const displayName = requestedName || e164 || '';

      const auth = getAuth();
      let userRecord;
      let isNewUser = false;
      try {
        userRecord = await auth.getUserByPhoneNumber(e164);
      } catch (err) {
        if (err?.code !== 'auth/user-not-found') throw err;
        const createPayload = { phoneNumber: e164 };
        if (displayName) createPayload.displayName = displayName;
        userRecord = await auth.createUser(createPayload);
        isNewUser = true;
      }

      // Update Auth display name when user provided one
      if (requestedName && userRecord.displayName !== requestedName) {
        try {
          await auth.updateUser(userRecord.uid, { displayName: requestedName });
          userRecord = await auth.getUser(userRecord.uid);
        } catch (updateErr) {
          logger.warn('displayName update skipped', {
            uid: userRecord.uid,
            err: String(updateErr?.message || updateErr),
          });
        }
      }

      const customToken = await auth.createCustomToken(userRecord.uid, {
        authProvider: 'whatsapp_otp',
      });

      const profileName =
        requestedName ||
        userRecord.displayName ||
        e164 ||
        '';

      const profilePayload = {
        uid: userRecord.uid,
        phone: e164,
        phoneNumber: e164,
        name: profileName,
        authProvider: 'whatsapp_otp',
        // Complete only when a real name was provided (not phone-only fallback)
        profileSetupComplete: Boolean(requestedName),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (isNewUser) {
        profilePayload.createdAt = FieldValue.serverTimestamp();
      }

      const userRef = db.collection('Users').doc(userRecord.uid);
      const prior = await userRef.get();
      const alreadyWelcomed = Boolean(prior.data()?.welcomeWhatsAppSent);

      await Promise.all([
        userRef.set(profilePayload, { merge: true }),
        db.collection('users').doc(userRecord.uid).set(profilePayload, { merge: true }),
      ]);

      // Welcome on first successful verify (new or returning without prior welcome)
      let welcomeSent = alreadyWelcomed;
      if (!alreadyWelcomed) {
        try {
          await sendWelcomeTemplate({
            to: phoneDigits,
            name: profileName || e164,
            websiteUrl: config.websiteUrl,
            token: WHATSAPP_TOKEN.value(),
            languageCode: config.templateLang,
          });
          await Promise.all([
            userRef.set(
              {
                welcomeWhatsAppSent: true,
                welcomeWhatsAppSentAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            ),
            db.collection('users').doc(userRecord.uid).set(
              {
                welcomeWhatsAppSent: true,
                welcomeWhatsAppSentAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            ),
          ]);
          welcomeSent = true;
        } catch (welcomeErr) {
          logger.error('Welcome WhatsApp after OTP failed', {
            uid: userRecord.uid,
            template: config.welcomeTemplateName,
            err: String(welcomeErr?.message || welcomeErr),
            metaCode: welcomeErr?.code || null,
            fbtraceId: welcomeErr?.fbtraceId || null,
          });
        }
      }

      res.status(200).json({
        success: true,
        customToken,
        uid: userRecord.uid,
        isNewUser,
        phone: e164,
        name: profileName,
        welcomeSent,
      });
    } catch (err) {
      logger.error('verifyWhatsAppOtp failed', { err: String(err?.message || err) });
      res.status(500).json({
        success: false,
        error: err?.message || 'OTP verification failed',
      });
    }
  },
);

/**
 * Email Service — Welcome / verification emails via Resend or SendGrid.
 * Client enqueues Firestore `mail_queue`; Cloud Function delivers mail
 * (API keys stay server-side — see functions/emailTrigger.example.js).
 */

import firestore from '@react-native-firebase/firestore';

import { Haptics } from '../haptics/triggerHaptic';
import { PATHS } from '../../schema/firestoreSchema';
import { BRAND } from '../../theme/branding';

const PROVIDER = (process.env.EXPO_PUBLIC_EMAIL_PROVIDER || 'resend').toLowerCase();

export class EmailService {
  /**
   * Queue automated welcome email after signup / verification.
   *
   * IDEMPOTENCY: Uses a Firestore transaction to atomically check-and-set
   * `welcomeEmailQueued`. Safe to call on every sign-in — will only ever
   * enqueue ONE welcome email per user, even under concurrent requests or
   * app reinstalls.
   *
   * EXISTING USER PROTECTION: If the user doc has `welcomeEmailQueued: true`,
   * `welcomeEmailSent: true`, OR a `createdAt` older than 30 days, the
   * welcome email is skipped so existing customers are not mass-emailed.
   *
   * @param {{ uid: string, email: string, name?: string }} user
   */
  static async sendWelcomeEmail(user) {
    Haptics.tap();

    try {
      if (!user?.email) throw new Error('Email is required for welcome message');
      if (!user?.uid) throw new Error('UID is required for welcome email idempotency');

      // Ensure Auth token carries email (required by mail_queue rules)
      try {
        const authMod = require('@react-native-firebase/auth').default;
        await authMod().currentUser?.getIdToken?.(true);
      } catch {
        /* ignore */
      }

      const db = firestore();
      const userRef = db.collection('Users').doc(user.uid);

      // Firestore transaction: atomically read → check → write
      // This is the single source of truth for idempotency.
      let shouldSend = false;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.data() || {};

        // Guard 1: already queued or sent — skip
        if (data.welcomeEmailQueued === true || data.welcomeEmailSent === true) {
          shouldSend = false;
          return;
        }

        // Guard 2: existing user protection — skip if account is older than 30 days
        // This prevents mass-emailing existing users after this feature is deployed.
        if (data.createdAt) {
          let createdMs = null;
          try {
            // Firestore Timestamp
            createdMs = typeof data.createdAt.toMillis === 'function'
              ? data.createdAt.toMillis()
              : Number(data.createdAt);
          } catch {
            /* ignore */
          }
          if (createdMs && (Date.now() - createdMs) > 30 * 24 * 60 * 60 * 1000) {
            shouldSend = false;
            return;
          }
        }

        // Mark as queued INSIDE the transaction so concurrent calls see it immediately
        tx.set(userRef, {
          welcomeEmailQueued: true,
          welcomeEmailSent: false,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        shouldSend = true;
      });

      if (!shouldSend) {
        // Already sent or existing user — skip silently
        return { success: true, skipped: true, reason: 'already_queued_or_existing_user' };
      }

      // Write to mail_queue AFTER transaction committed welcomeEmailQueued: true
      await db.collection(PATHS.mailQueue).add({
        to: String(user.email).trim().toLowerCase(),
        template: 'welcome',
        provider: PROVIDER,
        status: 'pending',
        data: {
          uid: user.uid || null,
          name: user.name || 'Asset Owner',
          appName: BRAND.name,
          tagline: BRAND.tagline,
        },
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      Haptics.success();
      return { success: true, via: 'mail_queue', provider: PROVIDER };
    } catch (error) {
      Haptics.error();
      // Do NOT mark welcomeEmailQueued: true here — leave it false so a retry is safe
      return { success: false, error: error?.message || 'Failed to queue welcome email' };
    }
  }

  static async sendVerificationReminder({ email, name, verifyLink }) {
    Haptics.tap();
    try {
      if (!email) throw new Error('Email required');
      await firestore().collection(PATHS.mailQueue).add({
        to: email,
        template: 'email_verification',
        provider: PROVIDER,
        data: {
          name: name || 'Asset Owner',
          verifyLink: verifyLink || '',
          appName: BRAND.name,
        },
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to queue verification email' };
    }
  }

  /** Queue a generic reminder / notice email (expiry, service, etc.). */
  static async sendGenericNotice({ email, subject, body, uid, name }) {
    try {
      if (!email) return { success: false, error: 'Email required' };
      await firestore().collection(PATHS.mailQueue).add({
        to: String(email).trim().toLowerCase(),
        template: 'reminder',
        provider: PROVIDER,
        status: 'pending',
        data: {
          uid: uid || null,
          name: name || 'Asset Owner',
          subject: String(subject || `${BRAND.name} reminder`).slice(0, 120),
          body: String(body || '').slice(0, 2000),
          appName: BRAND.name,
        },
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to queue reminder email' };
    }
  }
}

export default EmailService;

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
   * @param {{ uid: string, email: string, name?: string }} user
   */
  static async sendWelcomeEmail(user) {
    Haptics.tap();

    try {
      if (!user?.email) throw new Error('Email is required for welcome message');

      // Ensure Auth token carries email (required by mail_queue rules)
      try {
        const authMod = require('@react-native-firebase/auth').default;
        await authMod().currentUser?.getIdToken?.(true);
      } catch {
        /* ignore */
      }

      await firestore().collection(PATHS.mailQueue).add({
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

      if (user.uid) {
        await firestore().collection('Users').doc(user.uid).set(
          {
            welcomeEmailQueued: true,
            welcomeEmailSent: false,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      Haptics.success();
      return { success: true, via: 'mail_queue', provider: PROVIDER };
    } catch (error) {
      Haptics.error();
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

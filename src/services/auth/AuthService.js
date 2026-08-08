/**
 * Asset Doctor — Auth Service
 * Google Sign-In + Mobile OTP (WhatsApp Cloud API for login tab; SMS only if channel:'sms').
 * All touch / success / error paths trigger haptic feedback.
 */

import auth from '@react-native-firebase/auth';

import { Haptics, triggerHaptic } from '../haptics/triggerHaptic';
import { UserService } from '../user/UserService';
import { EmailService } from '../email/EmailService';
import { ExpiryAlertService } from '../notifications/ExpiryAlertService';
import { OfflineVaultCache } from '../offline/OfflineVaultCache';
import { OfflineQueue } from '../offline/OfflineQueue';
import { WhatsAppCloudService } from '../whatsapp/WhatsAppCloudService';
import {
  configureGoogleSignIn,
  getGoogleIdToken,
  googleSignOut,
} from './googleSignIn';

const PREFER_WHATSAPP_OTP =
  String(process.env.EXPO_PUBLIC_WHATSAPP_OTP || '1').toLowerCase() !== '0';

/**
 * Normalize phone to E.164 (basic). Expects country code, e.g. +919876543210.
 * @param {string} phoneNumber
 * @returns {string}
 */
function normalizePhone(phoneNumber) {
  const trimmed = String(phoneNumber || '').replace(/[\s-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  // Default India country code for Asset Doctor MVP
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  return trimmed.startsWith('91') && trimmed.length === 12 ? `+${trimmed}` : trimmed;
}

/**
 * @typedef {{ success: true, user: import('@react-native-firebase/auth').FirebaseAuthTypes.User, profile?: object }} AuthSuccess
 * @typedef {{ success: false, error: string }} AuthFailure
 * @typedef {AuthSuccess | AuthFailure} AuthResult
 */

export class AuthService {
  /**
   * Email / password sign-up + verification email + welcome queue.
   * @param {{ name: string, email: string, password: string }} payload
   * @returns {Promise<AuthResult & { verificationSent?: boolean }>}
   */
  static async signUpWithEmail({ name, email, password }) {
    Haptics.tap();

    try {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || '').trim() || 'Asset Owner';
      if (!cleanEmail || !password || password.length < 6) {
        throw new Error('Valid email and password (min 6 chars) are required');
      }

      const userCredential = await auth().createUserWithEmailAndPassword(cleanEmail, password);
      await userCredential.user.updateProfile({ displayName: cleanName });
      // Refresh token so mail_queue rules see auth.token.email
      await userCredential.user.getIdToken(true);

      let verificationSent = false;
      try {
        await userCredential.user.sendEmailVerification();
        verificationSent = true;
      } catch {
        /* verification email may fail in emulators — continue */
      }

      const profile = await UserService.syncUserToFirestore(userCredential.user, {
        authProvider: 'email',
        extra: {
          name: cleanName,
          email: cleanEmail,
          emailVerified: false,
          welcomeEmailSent: false,
        },
      }).catch((syncError) => {
        console.warn('[AuthService] profile sync after signup:', syncError?.message || syncError);
        return null;
      });

      const welcome = await EmailService.sendWelcomeEmail({
        uid: userCredential.user.uid,
        email: cleanEmail,
        name: cleanName,
      }).catch((welcomeError) => {
        console.warn('[AuthService] welcome email skipped:', welcomeError?.message || welcomeError);
        return { success: false, error: welcomeError?.message };
      });

      Haptics.success();
      return {
        success: true,
        user: userCredential.user,
        profile,
        verificationSent,
        welcomeQueued: Boolean(welcome?.success),
        welcomeError: welcome?.success ? null : welcome?.error,
      };
    } catch (error) {
      Haptics.error();
      return { success: false, error: mapAuthError(error) };
    }
  }

  /**
   * Email / password login.
   * Email is trimmed + lowercased; password is trimmed (case preserved).
   * Profile sync failures never block a successful Firebase Auth login.
   * @param {{ email: string, password: string }} payload
   * @returns {Promise<AuthResult>}
   */
  static async signInWithEmail({ email, password }) {
    Haptics.tap();

    try {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPassword = String(password || '').trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Enter a valid email address');
      }
      if (!cleanPassword) {
        throw new Error('Enter your password');
      }

      const userCredential = await auth().signInWithEmailAndPassword(cleanEmail, cleanPassword);
      let profile = null;
      try {
        profile = await UserService.syncUserToFirestore(userCredential.user, {
          authProvider: 'email',
          extra: { emailVerified: Boolean(userCredential.user.emailVerified) },
        });
      } catch (syncError) {
        console.warn('[AuthService] profile sync after email login:', syncError?.message || syncError);
      }
      Haptics.success();
      return { success: true, user: userCredential.user, profile };
    } catch (error) {
      Haptics.error();
      return { success: false, error: mapAuthError(error) };
    }
  }

  /**
   * Re-send Firebase email verification + optional reminder via Resend/SendGrid queue.
   */
  static async sendEmailVerification() {
    Haptics.tap();
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not signed in');
      if (user.emailVerified) {
        Haptics.success();
        return { success: true, alreadyVerified: true };
      }
      await user.sendEmailVerification();
      await EmailService.sendVerificationReminder({
        email: user.email,
        name: user.displayName,
      });
      Haptics.success();
      return { success: true, alreadyVerified: false };
    } catch (error) {
      Haptics.error();
      return { success: false, error: mapAuthError(error) };
    }
  }

  /** Reload user to pick up emailVerified after they tap the link */
  static async reloadUser() {
    const user = auth().currentUser;
    if (!user) return { success: false, error: 'Not signed in' };
    await user.reload();
    const refreshed = auth().currentUser;
    if (refreshed?.emailVerified) {
      await UserService.syncUserToFirestore(refreshed, {
        extra: { emailVerified: true },
      });
      Haptics.success();
    }
    return { success: true, user: refreshed, emailVerified: Boolean(refreshed?.emailVerified) };
  }

  /**
   * Google Sign-In via @react-native-google-signin/google-signin.
   * Configures webClientId, obtains ID token, signs into Firebase Auth,
   * then stores uid / name / email / photoURL / createdAt under users/{userId}.
   *
   * @param {string} [idToken] - Optional pre-fetched token; if omitted, runs interactive sign-in.
   * @returns {Promise<AuthResult>}
   */
  static async signInWithGoogle(idToken) {
    Haptics.tap();

    try {
      // Always (re)configure with the Firebase Web OAuth client before sign-in
      configureGoogleSignIn();

      let token = idToken;
      if (!token) {
        const google = await getGoogleIdToken();
        token = google.idToken;
      }

      if (!token) {
        throw new Error('Missing Google ID token');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(token);
      const userCredential = await auth().signInWithCredential(googleCredential);
      const { user } = userCredential;
      const isNewUser = Boolean(userCredential.additionalUserInfo?.isNewUser);

      let profile = null;
      try {
        profile = await UserService.saveGoogleUserProfile(user);
      } catch (syncError) {
        console.warn('[AuthService] profile sync after Google login:', syncError?.message || syncError);
      }

      if (isNewUser && user.email) {
        try {
          await user.getIdToken(true);
          await EmailService.sendWelcomeEmail({
            uid: user.uid,
            email: user.email,
            name: user.displayName || 'Asset Owner',
          });
        } catch (welcomeError) {
          console.warn('[AuthService] welcome email skipped:', welcomeError?.message || welcomeError);
        }
      }

      Haptics.success();
      return { success: true, user, profile, isNewUser };
    } catch (error) {
      Haptics.error();
      console.warn('[AuthService] signInWithGoogle error:', {
        code: error?.code,
        message: error?.message,
        nativeMessage: error?.nativeMessage,
      });
      return { success: false, error: mapAuthError(error) || error?.message || 'Google Sign-In failed' };
    }
  }

  /**
   * 2. Send Mobile OTP.
   * - channel `'whatsapp'` (login WhatsApp tab): Cloud Function `sendWhatsAppOtp` only — never SMS.
   * - channel `'sms'`: Firebase `signInWithPhoneNumber` only.
   * - channel `'auto'` (default): WhatsApp when EXPO_PUBLIC_WHATSAPP_OTP≠0, else SMS.
   * @param {string} phoneNumber - E.164 or 10-digit Indian mobile
   * @param {{ channel?: 'whatsapp' | 'sms' | 'auto' }} [options]
   * @returns {Promise<object>}
   */
  static async sendOTP(phoneNumber, options = {}) {
    Haptics.tap();

    try {
      const e164 = normalizePhone(phoneNumber);
      if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
        throw new Error('Enter a valid mobile number with country code (e.g. +919876543210)');
      }

      const requested = String(options.channel || 'auto').toLowerCase();
      const useWhatsApp =
        requested === 'whatsapp' || (requested === 'auto' && PREFER_WHATSAPP_OTP);
      const forceSms = requested === 'sms';

      if (useWhatsApp && !forceSms) {
        const wa = await WhatsAppCloudService.sendOtp(e164);
        if (wa.success) {
          return {
            success: true,
            channel: 'whatsapp',
            phone: e164,
            confirmation: { channel: 'whatsapp', phone: e164 },
            expiresInSec: wa.expiresInSec,
          };
        }
        // WhatsApp login tab must not fall back to Firebase SMS
        if (requested === 'whatsapp') {
          throw new Error(wa.error || 'Failed to send WhatsApp OTP');
        }
        console.warn('[AuthService] WhatsApp OTP failed, trying SMS:', wa.error);
      }

      const confirmation = await auth().signInWithPhoneNumber(e164);
      Haptics.success();
      return { success: true, channel: 'sms', confirmation, phone: e164 };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to send OTP' };
    }
  }

  /**
   * Verify Mobile OTP (WhatsApp custom token or Firebase SMS confirmation).
   * WhatsApp path signs in ONLY after `verifyWhatsAppOtp` returns success + customToken.
   * @param {object} confirmation
   * @param {string} otpCode
   * @param {{ name?: string }} [options]
   * @returns {Promise<AuthResult>}
   */
  static async verifyOTP(confirmation, otpCode, options = {}) {
    triggerHaptic('impactMedium');

    try {
      const code = String(otpCode || '').trim();
      if (!/^\d{6}$/.test(code)) {
        throw new Error('Enter the 6-digit OTP');
      }

      if (!confirmation || typeof confirmation !== 'object') {
        throw new Error('OTP session expired. Please request a new code.');
      }

      if (confirmation.channel === 'whatsapp') {
        const phone = confirmation.phone;
        if (!phone) {
          throw new Error('OTP session expired. Please request a new code.');
        }
        const result = await WhatsAppCloudService.verifyOtp(phone, code, {
          name: options.name,
        });
        if (!result.success || !result.user) {
          throw new Error(result.error || 'Invalid OTP');
        }
        Haptics.success();
        return {
          success: true,
          user: result.user,
          profile: result.profile,
          isNewUser: result.isNewUser,
          channel: 'whatsapp',
          welcomeSent: Boolean(result.welcomeSent),
        };
      }

      if (!confirmation?.confirm) {
        throw new Error('OTP session expired. Please request a new code.');
      }

      const userCredential = await confirmation.confirm(code);
      const profile = await UserService.syncUserToFirestore(userCredential.user, {
        authProvider: 'phone',
      });

      Haptics.success();
      return { success: true, user: userCredential.user, profile, channel: 'sms' };
    } catch (error) {
      Haptics.error();
      const message =
        error?.code === 'auth/invalid-verification-code'
          ? 'Invalid OTP'
          : error?.message || 'Invalid OTP';
      return { success: false, error: message, user: null };
    }
  }

  /**
   * Sign out current user.
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  static async signOut() {
    Haptics.tap();

    try {
      const userId = auth().currentUser?.uid;
      if (userId) {
        await Promise.allSettled([
          ExpiryAlertService.unregisterPushToken(userId),
          OfflineVaultCache.clearUser(userId),
          OfflineQueue.removeUser(userId),
        ]);
      }
      await googleSignOut();
      await auth().signOut();
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Sign out failed' };
    }
  }

  /** @returns {import('@react-native-firebase/auth').FirebaseAuthTypes.User | null} */
  static getCurrentUser() {
    return auth().currentUser;
  }

  /**
   * Subscribe to Firebase Auth state changes.
   * @param {(user: import('@react-native-firebase/auth').FirebaseAuthTypes.User | null) => void} callback
   * @returns {() => void} unsubscribe
   */
  static onAuthStateChanged(callback) {
    try {
      return auth().onAuthStateChanged(callback);
    } catch (error) {
      console.warn('[AssetDoctor] Firebase Auth unavailable:', error?.message || error);
      try {
        callback(null);
      } catch {
        /* ignore */
      }
      return () => {};
    }
  }

  /**
   * Re-sync the signed-in user to Firestore (e.g. after app resume).
   * @returns {Promise<AuthResult>}
   */
  static async refreshProfile() {
    Haptics.tap();

    try {
      const user = auth().currentUser;
      if (!user) throw new Error('Not signed in');

      const profile = await UserService.syncUserToFirestore(user);
      Haptics.success();
      return { success: true, user, profile };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Could not refresh profile' };
    }
  }
}

function mapAuthError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || error?.nativeMessage || '');
  if (code.includes('email-already-in-use')) return 'An account already exists with this email';
  if (code.includes('invalid-email')) return 'Enter a valid email address';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Incorrect email or password';
  }
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again later';
  if (message.includes('cancelled') || message.includes('canceled') || code === 'SIGN_IN_CANCELLED') {
    return 'Google Sign-In was cancelled';
  }
  // Surface native Google / Firebase details so Play Console debugging is accurate
  if (
    code.includes('DEVELOPER_ERROR') ||
    message.includes('DEVELOPER_ERROR') ||
    code.includes('GOOGLE') ||
    code.includes('SIGN_IN') ||
    message.includes('[')
  ) {
    const parts = [code && `code=${code}`, message && `message=${message}`].filter(Boolean);
    return parts.length ? `Google Sign-In failed (${parts.join(' | ')})` : 'Google Sign-In failed';
  }
  return message || 'Authentication failed';
}

export default AuthService;

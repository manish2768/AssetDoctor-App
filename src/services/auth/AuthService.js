/**
 * Asset Doctor — Auth Service
 * Google Sign-In + Mobile OTP (WhatsApp Cloud API primary, Firebase SMS fallback).
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
      });

      const welcome = await EmailService.sendWelcomeEmail({
        uid: userCredential.user.uid,
        email: cleanEmail,
        name: cleanName,
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
   * @param {{ email: string, password: string }} payload
   * @returns {Promise<AuthResult>}
   */
  static async signInWithEmail({ email, password }) {
    Haptics.tap();

    try {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const userCredential = await auth().signInWithEmailAndPassword(cleanEmail, password);
      const profile = await UserService.syncUserToFirestore(userCredential.user, {
        authProvider: 'email',
        extra: { emailVerified: Boolean(userCredential.user.emailVerified) },
      });
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

      // Explicit profile write: users/{userId}
      const profile = await UserService.saveGoogleUserProfile(user);

      if (isNewUser && user.email) {
        await user.getIdToken(true);
        await EmailService.sendWelcomeEmail({
          uid: user.uid,
          email: user.email,
          name: user.displayName || 'Asset Owner',
        });
      }

      Haptics.success();
      return { success: true, user, profile, isNewUser };
    } catch (error) {
      Haptics.error();
      return { success: false, error: mapAuthError(error) || error?.message || 'Google Sign-In failed' };
    }
  }

  /**
   * 2. Send Mobile OTP — WhatsApp Cloud (`asset_doctor_otp`) by default.
   * Set EXPO_PUBLIC_WHATSAPP_OTP=0 to use Firebase Phone Auth (SMS) only.
   * @param {string} phoneNumber - E.164 or 10-digit Indian mobile
   * @returns {Promise<object>}
   */
  static async sendOTP(phoneNumber) {
    Haptics.tap();

    try {
      const e164 = normalizePhone(phoneNumber);
      if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
        throw new Error('Enter a valid mobile number with country code (e.g. +919876543210)');
      }

      if (PREFER_WHATSAPP_OTP) {
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
        // Fall through to Firebase SMS if WhatsApp backend is unavailable
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
   * @param {object} confirmation
   * @param {string} otpCode
   * @returns {Promise<AuthResult>}
   */
  static async verifyOTP(confirmation, otpCode) {
    triggerHaptic('impactMedium');

    try {
      const code = String(otpCode || '').trim();
      if (!/^\d{6}$/.test(code)) {
        throw new Error('Enter the 6-digit OTP');
      }

      if (confirmation?.channel === 'whatsapp') {
        const phone = confirmation.phone;
        const result = await WhatsAppCloudService.verifyOtp(phone, code);
        if (!result.success) throw new Error(result.error || 'Invalid OTP');
        // Welcome template is sent server-side in verifyWhatsAppOtp (not via client HTTP)
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
      return { success: false, error: message };
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
  const code = error?.code || '';
  const message = String(error?.message || '');
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
  if (code.includes('DEVELOPER_ERROR') || message.includes('DEVELOPER_ERROR')) {
    return 'Google Sign-In misconfigured. Check SHA-1 and webClientId.';
  }
  return error?.message || 'Authentication failed';
}

export default AuthService;

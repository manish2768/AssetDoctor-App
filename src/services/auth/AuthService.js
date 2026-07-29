/**
 * Asset Doctor — Auth Service
 * Google Sign-In + Mobile OTP (Firebase Phone Auth / SMS).
 * All touch / success / error paths trigger haptic feedback.
 */

import auth from '@react-native-firebase/auth';

import { Haptics, triggerHaptic } from '../haptics/triggerHaptic';
import { UserService } from '../user/UserService';

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
   * 1. Google Sign-In
   * Pass the Google ID token from @react-native-google-signin/google-signin.
   * @param {string} idToken
   * @returns {Promise<AuthResult>}
   */
  static async signInWithGoogle(idToken) {
    Haptics.tap();

    try {
      if (!idToken) {
        throw new Error('Missing Google ID token');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      const profile = await UserService.syncUserToFirestore(userCredential.user, {
        authProvider: 'google',
      });

      Haptics.success();
      return { success: true, user: userCredential.user, profile };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Google Sign-In failed' };
    }
  }

  /**
   * 2. Send Mobile OTP via Firebase Phone Auth (SMS).
   * WhatsApp delivery requires a separate Business API — not Firebase Auth default.
   * @param {string} phoneNumber - E.164 or 10-digit Indian mobile
   * @returns {Promise<{ success: true, confirmation: import('@react-native-firebase/auth').FirebaseAuthTypes.ConfirmationResult } | AuthFailure>}
   */
  static async sendOTP(phoneNumber) {
    Haptics.tap();

    try {
      const e164 = normalizePhone(phoneNumber);
      if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
        throw new Error('Enter a valid mobile number with country code (e.g. +919876543210)');
      }

      const confirmation = await auth().signInWithPhoneNumber(e164);
      Haptics.success();
      return { success: true, confirmation };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to send OTP' };
    }
  }

  /**
   * Verify Mobile OTP and sync profile to Firestore.
   * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.ConfirmationResult} confirmation
   * @param {string} otpCode
   * @returns {Promise<AuthResult>}
   */
  static async verifyOTP(confirmation, otpCode) {
    triggerHaptic('impactMedium');

    try {
      if (!confirmation?.confirm) {
        throw new Error('OTP session expired. Please request a new code.');
      }

      const code = String(otpCode || '').trim();
      if (!/^\d{6}$/.test(code)) {
        throw new Error('Enter the 6-digit OTP');
      }

      const userCredential = await confirmation.confirm(code);
      const profile = await UserService.syncUserToFirestore(userCredential.user, {
        authProvider: 'phone',
      });

      Haptics.success();
      return { success: true, user: userCredential.user, profile };
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
    return auth().onAuthStateChanged(callback);
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

export default AuthService;

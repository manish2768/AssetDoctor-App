/**
 * Asset Doctor — Auth Service
 * Google Sign-In + Mobile SMS OTP (Firebase Phone Auth) + Email.
 * Welcome + expiry alerts use Email / In-App Push — not WhatsApp Business API.
 * All touch / success / error paths trigger haptic feedback.
 */

import auth from '@react-native-firebase/auth';

import { ensureFirebaseApp, waitForFirebaseApp } from '../../config/firebaseApp';
import { Haptics, triggerHaptic } from '../haptics/triggerHaptic';
import { UserService } from '../user/UserService';
import { EmailService } from '../email/EmailService';
import { ExpiryAlertService } from '../notifications/ExpiryAlertService';
import { OfflineVaultCache } from '../offline/OfflineVaultCache';
import { OfflineQueue } from '../offline/OfflineQueue';
import { removeOcrJobsForUser } from '../ocr/ocrOfflineQueue';
import {
  configureGoogleSignIn,
  getGoogleIdToken,
  googleSignOut,
} from './googleSignIn';
import { IdentityService } from './IdentityService';

function isFirebaseDefaultMissing(error) {
  const msg = String(error?.message || error || '');
  const code = String(error?.code || '');
  return /no firebase app|\[DEFAULT\]|not been created|firebase.*initializ/i.test(
    `${msg} ${code}`,
  );
}

/**
 * Sync auth() when native app is already up (no throw on race — returns null).
 * @returns {import('@react-native-firebase/auth').FirebaseAuthTypes.Module | null}
 */
function getAuthSafe() {
  if (!ensureFirebaseApp()) return null;
  try {
    return auth();
  } catch (error) {
    if (isFirebaseDefaultMissing(error)) return null;
    throw error;
  }
}

/**
 * Resolve Firebase Auth with automatic retries so button taps don't fail on boot race.
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<import('@react-native-firebase/auth').FirebaseAuthTypes.Module>}
 */
async function resolveFirebaseAuth(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const ready = await waitForFirebaseApp({ timeoutMs, intervalMs: 75 });
  if (ready) {
    const instance = getAuthSafe();
    if (instance) return instance;
  }

  // Final sync attempts after wait
  for (let i = 0; i < 8; i += 1) {
    const instance = getAuthSafe();
    if (instance) return instance;
    await new Promise((r) => setTimeout(r, 100));
  }

  throw new Error(
    'Firebase Auth is unavailable. Please restart the app and try again.',
  );
}

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
 * Send OTP for linking without switching the current Auth session.
 * @param {string} e164
 */
function sendLinkPhoneOtp(e164) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve(value);
    };

    let unsubscribe = () => {};
    (async () => {
      try {
        const firebaseAuth = await resolveFirebaseAuth();
        const phoneAuth = firebaseAuth.verifyPhoneNumber(e164);
        unsubscribe = phoneAuth.on(
          'state_changed',
          (snapshot) => {
            const state = snapshot?.state;
            const codeSent =
              state === auth.PhoneAuthState.CODE_SENT ||
              state === 'sent' ||
              state === auth.PhoneAuthState.AUTO_VERIFY_TIMEOUT ||
              state === 'timeout';
            if (codeSent && snapshot.verificationId) {
              const verificationId = snapshot.verificationId;
              finish(null, {
                mode: 'link',
                phone: e164,
                verificationId,
                confirm: async (code) => {
                  const credential = auth.PhoneAuthProvider.credential(verificationId, code);
                  const current = getAuthSafe()?.currentUser;
                  if (!current) throw new Error('Not signed in');
                  return current.linkWithCredential(credential);
                },
              });
              return;
            }
            if (state === auth.PhoneAuthState.ERROR || state === 'error' || snapshot?.error) {
              finish(snapshot.error || new Error('Failed to send OTP'));
            }
          },
          (error) => finish(error || new Error('Failed to send OTP')),
        );
      } catch (error) {
        finish(error);
      }
    })();
  });
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
      const firebaseAuth = await resolveFirebaseAuth();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || '').trim() || 'Asset Owner';
      if (!cleanEmail || !password || password.length < 6) {
        throw new Error('Valid email and password (min 6 chars) are required');
      }

      const identity = await IdentityService.checkAvailable({ email: cleanEmail });
      if (!identity.available) {
        throw new Error(identity.message || 'Email is already registered with another account.');
      }

      const userCredential = await firebaseAuth.createUserWithEmailAndPassword(cleanEmail, password);
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

      try {
        await ExpiryAlertService.notifyWelcome({ name: cleanName });
      } catch {
        /* non-blocking */
      }

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
      const firebaseAuth = await resolveFirebaseAuth();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanPassword = String(password || '').trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Enter a valid email address');
      }
      if (!cleanPassword) {
        throw new Error('Enter your password');
      }

      const userCredential = await firebaseAuth.signInWithEmailAndPassword(cleanEmail, cleanPassword);
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
      const firebaseAuth = await resolveFirebaseAuth();
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
      const userCredential = await firebaseAuth.signInWithCredential(googleCredential);
      const { user } = userCredential;
      const isNewUser = Boolean(userCredential.additionalUserInfo?.isNewUser);

      let profile = null;
      try {
        profile = await UserService.syncUserToFirestore(user, {
          authProvider: 'google',
          extra: {
            name: user.displayName || undefined,
            email: user.email || undefined,
            photoURL: user.photoURL || undefined,
          },
        });
      } catch (syncError) {
        console.warn('[AuthService] profile sync after Google login:', syncError?.message || syncError);
        try {
          profile = await UserService.saveGoogleUserProfile(user);
        } catch {
          /* Auth still succeeds */
        }
      }

      if (isNewUser && user.email) {
        try {
          await user.getIdToken(true);
          await EmailService.sendWelcomeEmail({
            uid: user.uid,
            email: user.email,
            name: user.displayName || 'Asset Owner',
          });
          await ExpiryAlertService.notifyWelcome({
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
   * Send Mobile OTP via Firebase Phone Auth (SMS).
   * - Cold login: signInWithPhoneNumber
   * - Signed-in email/Google user without phone: verifyPhoneNumber for linkWithCredential
   * @param {string} phoneNumber
   * @param {{ mode?: 'auto' | 'signIn' | 'link' }} [options]
   */
  static async sendOTP(phoneNumber, options = {}) {
    Haptics.tap();

    try {
      const firebaseAuth = await resolveFirebaseAuth();
      const e164 = normalizePhone(phoneNumber);
      if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
        throw new Error('Enter a valid mobile number with country code (e.g. +919876543210)');
      }

      const current = firebaseAuth.currentUser;
      // Only link when explicitly requested — Login/Signup always cold sign-in (new or existing).
      const wantsLink = options.mode === 'link' && Boolean(current);

      if (wantsLink && current) {
        const identity = await IdentityService.checkAvailable({
          phone: e164,
          excludeUid: current?.uid,
        });
        if (identity.available) {
          const confirmation = await sendLinkPhoneOtp(e164);
          Haptics.success();
          return {
            success: true,
            channel: 'sms',
            mode: 'link',
            phone: e164,
            confirmation,
          };
        }
        // Already registered elsewhere → sign into that account (never block).
      }

      const confirmation = await firebaseAuth.signInWithPhoneNumber(e164);
      Haptics.success();
      return {
        success: true,
        channel: 'sms',
        mode: 'signIn',
        confirmation: {
          ...confirmation,
          mode: 'signIn',
          phone: e164,
          confirm: confirmation.confirm.bind(confirmation),
          verificationId: confirmation.verificationId,
        },
        phone: e164,
      };
    } catch (error) {
      Haptics.error();
      try {
        const { logPhoneAuthFailure } = require('./AuthDiagnostics');
        logPhoneAuthFailure(error, 'sendOTP');
      } catch {
        console.warn('[AuthService] sendOTP error:', error?.code, error?.message);
      }
      return { success: false, error: mapAuthError(error) || error?.message || 'Failed to send OTP' };
    }
  }

  /**
   * Verify Mobile SMS OTP — sign-in or linkWithCredential into current session.
   */
  static async verifyOTP(confirmation, otpCode, options = {}) {
    triggerHaptic('impactMedium');

    try {
      const code = String(otpCode || '').trim();
      if (!/^\d{6}$/.test(code)) {
        throw new Error('Enter the 6-digit OTP');
      }

      if (!confirmation || (typeof confirmation.confirm !== 'function' && !confirmation.verificationId)) {
        throw new Error('OTP session expired. Please request a new code.');
      }

      const mode = confirmation.mode || options.mode || 'signIn';
      let userCredential;
      let linkMeta = { merged: false, message: null };

      if (mode === 'link') {
        const verificationId = confirmation.verificationId;
        if (!verificationId) {
          throw new Error('OTP session expired. Please request a new code.');
        }
        try {
          const { linkOrRecoverPhoneCredential } = require('./AccountLinkService');
          const recovered = await linkOrRecoverPhoneCredential(verificationId, code);
          userCredential = recovered.userCredential;
          linkMeta = {
            merged: Boolean(recovered.merged),
            message: recovered.message || null,
          };
        } catch (linkErr) {
          // Never show raw Firebase "already linked" — recover via sign-in
          const linkCode = String(linkErr?.code || '');
          if (
            linkCode.includes('credential-already-in-use') ||
            linkCode.includes('account-exists-with-different-credential') ||
            linkCode.includes('provider-already-linked')
          ) {
            const credential = auth.PhoneAuthProvider.credential(verificationId, code);
            if (linkCode.includes('provider-already-linked')) {
              userCredential = {
                user: auth().currentUser,
                additionalUserInfo: { isNewUser: false },
              };
              linkMeta = { merged: false, message: 'Mobile already on this account.' };
            } else {
              userCredential = await auth().signInWithCredential(credential);
              linkMeta = {
                merged: true,
                message: 'Opened the vault for this mobile number.',
              };
            }
          } else {
            throw linkErr;
          }
        }
      } else {
        if (typeof confirmation.confirm !== 'function') {
          throw new Error('OTP session expired. Please request a new code.');
        }
        userCredential = await confirmation.confirm(code);
      }

      const { user } = userCredential;
      if (!user) {
        throw new Error('Could not complete phone verification.');
      }
      const isNewUser = Boolean(userCredential.additionalUserInfo?.isNewUser);
      const displayName =
        String(options.name || '').trim() || user.displayName || undefined;

      const phone = user.phoneNumber || confirmation.phone || undefined;

      if (displayName && displayName !== user.displayName) {
        try {
          await user.updateProfile({ displayName });
        } catch {
          /* non-blocking */
        }
      }

      const providers = (user.providerData || []).map((p) => p.providerId).join(',');
      let authProviders = [];
      try {
        const { authProvidersFromUser } = require('./authProviders');
        authProviders = authProvidersFromUser(user);
      } catch {
        authProviders = ['phone'];
      }
      const profile = await UserService.syncUserToFirestore(user, {
        authProvider: mode === 'link' && !linkMeta.merged ? 'linked' : 'phone',
        extra: {
          phone: phone || undefined,
          phoneNumber: phone || undefined,
          name: displayName,
          linkedProviders: providers,
          authProviders,
        },
      });

      if (isNewUser && mode !== 'link') {
        await Promise.allSettled([
          user.email
            ? EmailService.sendWelcomeEmail({
                uid: user.uid,
                email: user.email,
                name: displayName || 'Asset Owner',
              })
            : Promise.resolve(),
          ExpiryAlertService.notifyWelcome({
            name: displayName || 'Asset Owner',
          }),
        ]);
      }

      Haptics.success();
      return {
        success: true,
        user,
        profile,
        channel: 'sms',
        mode: linkMeta.merged ? 'signIn' : mode,
        isNewUser,
        merged: linkMeta.merged,
        message: linkMeta.message || undefined,
      };
    } catch (error) {
      Haptics.error();
      const message =
        error?.code === 'auth/invalid-verification-code'
          ? 'Invalid OTP'
          : mapAuthError(error) || error?.message || 'Invalid OTP';
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
      // Always clear Firebase session first so UI can leave the spinner / remount AuthWelcome.
      // Push-token / offline cleanup must never block sign-out (can hang on getExpoPushTokenAsync).
      try {
        await googleSignOut();
      } catch {
        /* ignore */
      }
      await auth().signOut();
      if (userId) {
        Promise.race([
          Promise.allSettled([
            ExpiryAlertService.unregisterPushToken(userId),
            OfflineVaultCache.clearUser(userId),
            OfflineQueue.removeUser(userId),
            removeOcrJobsForUser(userId),
            (async () => {
              try {
                // eslint-disable-next-line global-require
                const { InvoiceOfflineCache } = require('../ocr/InvoiceOfflineCache');
                await InvoiceOfflineCache.clearUser(userId);
              } catch {
                /* ignore */
              }
            })(),
          ]),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]).catch(() => {});
      }
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Sign out failed' };
    }
  }

  /** @returns {import('@react-native-firebase/auth').FirebaseAuthTypes.User | null} */
  static getCurrentUser() {
    try {
      return getAuthSafe()?.currentUser ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Subscribe to Firebase Auth state changes.
   * Waits briefly for native Firebase so cold start does not treat auth as signed-out.
   * @param {(user: import('@react-native-firebase/auth').FirebaseAuthTypes.User | null) => void} callback
   * @returns {() => void} unsubscribe
   */
  static onAuthStateChanged(callback) {
    let cancelled = false;
    let unsub = () => {};

    (async () => {
      await waitForFirebaseApp({ timeoutMs: 10000, intervalMs: 75 });
      if (cancelled) return;
      try {
        const firebaseAuth = getAuthSafe();
        if (!firebaseAuth) {
          try { callback(null); } catch { /* ignore */ }
          return;
        }
        unsub = firebaseAuth.onAuthStateChanged(callback);
      } catch (error) {
        console.warn('[AssetDoctor] Firebase Auth unavailable:', error?.message || error);
        try { callback(null); } catch { /* ignore */ }
      }
    })();

    return () => {
      cancelled = true;
      try { unsub(); } catch { /* ignore */ }
    };
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
  try {
    const { toAuthUserMessage } = require('./authErrors');
    const authFriendly = toAuthUserMessage(error, '');
    if (authFriendly) return authFriendly;
  } catch {
    /* fall through */
  }
  try {
    const { toFriendlyError } = require('../../utils/friendlyErrors');
    const friendly = toFriendlyError(error, '');
    if (friendly) return friendly;
  } catch {
    /* fall through */
  }
  const code = String(error?.code || '');
  const message = String(error?.message || error?.nativeMessage || '');
  if (
    /no firebase app|\[DEFAULT\]|not been created|firebase.*initializ|Auth is unavailable/i.test(message) ||
    /no firebase app|\[DEFAULT\]/i.test(code)
  ) {
    return 'Signing services are warming up — tap again in a moment.';
  }
  if (code.includes('email-already-in-use')) {
    return 'This email is already on an Asset Doctor account — sign in with it, or use another email.';
  }
  if (code.includes('provider-already-linked') || /already\s*linked/i.test(message)) {
    return 'Connecting your accounts…';
  }
  if (
    code.includes('credential-already-in-use') ||
    code.includes('account-exists-with-different-credential')
  ) {
    return 'Connecting your accounts…';
  }
  if (code.includes('invalid-email')) return 'Enter a valid email address';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters';
  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Incorrect email or password';
  }
  if (code.includes('too-many-requests') || code.includes('quota')) {
    return 'Too many attempts. Try again later.';
  }
  if (code.includes('invalid-phone-number')) return 'Enter a valid mobile number';
  if (message.includes('already registered')) {
    return 'Connecting your accounts…';
  }
  if (message.includes('Firebase Auth is unavailable') || message.includes('Firebase is still starting')) {
    return message;
  }
  if (message.includes('cancelled') || message.includes('canceled') || code === 'SIGN_IN_CANCELLED') {
    return 'Google Sign-In was cancelled';
  }
  // Never dump raw DEVELOPER_ERROR / Integrity token strings to the user
  if (
    /developer_error|integrity|safetynet|app-not-authorized|play.?integrity/i.test(`${code} ${message}`)
  ) {
    return 'Sign-in is not ready on this install. Use the Play Store build, or try Email / Phone OTP.';
  }
  if (message && message.length < 140 && !/exception|stack|token/i.test(message)) {
    return message;
  }
  return 'Sign-in failed. Please try again.';
}

export default AuthService;

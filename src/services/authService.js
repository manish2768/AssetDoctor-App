/**
 * Auth persistence helpers — SecureStore session mirror for Home greeting + Edit/Delete.
 * Firebase Auth remains source of truth; encrypted local session keeps uid / profile offline.
 */

import * as SecureStore from 'expo-secure-store';

import { AuthService } from './auth/AuthService';
import { EncryptedVaultStorage } from './security/EncryptedVaultStorage';
import { saveLocalProfile, loadLocalProfile, DEFAULT_PROFILE } from '../utils/userProfileStorage';

export const AUTH_SESSION_KEY = 'asset_doctor_auth_session_v1';
const SECURE_SESSION_KEY = 'asset_doctor_auth_session_secure_v1';

async function writeSession(session) {
  const payload = JSON.stringify(session);
  try {
    await SecureStore.setItemAsync(SECURE_SESSION_KEY, payload, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error) {
    console.warn('[authService] SecureStore session write failed:', error?.message || error);
  }
  await EncryptedVaultStorage.setItem(AUTH_SESSION_KEY, payload);
}

async function readSession() {
  try {
    const secure = await SecureStore.getItemAsync(SECURE_SESSION_KEY);
    if (secure) {
      const parsed = JSON.parse(secure);
      if (parsed?.uid) return parsed;
    }
  } catch {
    /* fall through */
  }
  try {
    const raw = await EncryptedVaultStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.uid) return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function wipeSession() {
  try {
    await SecureStore.deleteItemAsync(SECURE_SESSION_KEY);
  } catch {
    /* ignore */
  }
  await EncryptedVaultStorage.removeItem(AUTH_SESSION_KEY);
}

/**
 * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.User|null} user
 * @param {object|null} profile
 */
export async function persistAuthSession(user, profile = {}) {
  try {
    if (!user?.uid) {
      await wipeSession();
      return { success: true, profile: null };
    }

    const name =
      String(profile?.name || user.displayName || DEFAULT_PROFILE.name).trim() ||
      DEFAULT_PROFILE.name;
    const email = String(profile?.email || user.email || '').trim();
    const phone = String(
      profile?.phone || profile?.phoneNumber || user.phoneNumber || '',
    ).trim();
    const photoURL = String(profile?.photoURL || user.photoURL || '').trim();

    const session = {
      uid: user.uid,
      name,
      email,
      phone,
      phoneNumber: phone,
      photoURL,
      providerId: user.providerData?.[0]?.providerId || '',
      updatedAt: Date.now(),
    };

    await writeSession(session);
    const local = await saveLocalProfile({
      name,
      email,
      phone,
      phoneNumber: phone,
      photoURL,
    });

    return { success: true, session, profile: local.profile || session };
  } catch (error) {
    console.warn('[authService] persistAuthSession failed:', error?.message || error);
    return { success: false, error: error?.message || 'Could not persist session' };
  }
}

export async function loadAuthSession() {
  try {
    const parsed = await readSession();
    if (parsed?.uid) return parsed;
    const local = await loadLocalProfile();
    return {
      uid: null,
      name: local.name || DEFAULT_PROFILE.name,
      email: local.email || '',
      phone: local.phone || '',
      photoURL: local.photoURL || '',
    };
  } catch {
    return { ...DEFAULT_PROFILE, uid: null };
  }
}

export async function clearAuthSession({ keepLocalProfile = true } = {}) {
  try {
    await wipeSession();
    if (!keepLocalProfile) {
      await saveLocalProfile({
        name: DEFAULT_PROFILE.name,
        email: '',
        phone: '',
        phoneNumber: '',
        photoURL: '',
      });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || 'Could not clear session' };
  }
}

/** Thin wrappers so screens can import from `services/authService`. */
export async function signInWithGoogle(idToken) {
  return AuthService.signInWithGoogle(idToken);
}

export async function signInWithEmail(payload) {
  return AuthService.signInWithEmail(payload);
}

export async function signUpWithEmail(payload) {
  return AuthService.signUpWithEmail(payload);
}

export async function sendOTP(phoneNumber, options) {
  return AuthService.sendOTP(phoneNumber, options);
}

export async function verifyOTP(confirmation, otpCode, options) {
  return AuthService.verifyOTP(confirmation, otpCode, options);
}

export async function signOut() {
  const result = await AuthService.signOut();
  if (result?.success) {
    await clearAuthSession({ keepLocalProfile: true });
  }
  return result;
}

export default {
  AUTH_SESSION_KEY,
  persistAuthSession,
  loadAuthSession,
  clearAuthSession,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendOTP,
  verifyOTP,
  signOut,
  AuthService,
};

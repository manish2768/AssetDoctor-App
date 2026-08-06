/**
 * Google Sign-In config — never crash APK if native module misconfigured.
 * webClientId MUST be the Firebase/GCP OAuth "Web client" (client_type: 3), not Android.
 */

import Constants from 'expo-constants';

import { ENV } from '../../config/env';

/** Firebase Web client ID (OAuth client_type 3) — required for idToken → Firebase Auth */
export const FIREBASE_GOOGLE_WEB_CLIENT_ID =
  '926559836985-1jschm7e172vqo2rav99oif3uoq93ftq.apps.googleusercontent.com';

function firstNonEmpty(...values) {
  for (const value of values) {
    const s = String(value || '').trim();
    if (s) return s;
  }
  return '';
}

export const GOOGLE_WEB_CLIENT_ID = firstNonEmpty(
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  Constants.expoConfig?.extra?.googleWebClientId,
  Constants.easConfig?.extra?.googleWebClientId,
  ENV.googleWebClientId,
  FIREBASE_GOOGLE_WEB_CLIENT_ID
);

let configured = false;

function getGoogleSignin() {
  try {
    // eslint-disable-next-line global-require
    return require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch {
    return null;
  }
}

export function configureGoogleSignIn() {
  try {
    const GoogleSignin = getGoogleSignin();
    if (!GoogleSignin?.configure) {
      console.warn('[AssetDoctor] Google Sign-In native module unavailable');
      return false;
    }

    const webClientId = GOOGLE_WEB_CLIENT_ID || FIREBASE_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId.includes('apps.googleusercontent.com')) {
      console.warn('[AssetDoctor] Invalid webClientId — check Firebase Web OAuth client');
      return false;
    }

    GoogleSignin.configure({
      webClientId,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
    configured = true;
    if (__DEV__) {
      console.log('[AssetDoctor] GoogleSignin configured with webClientId:', webClientId);
    }
    return true;
  } catch (error) {
    console.warn('[AssetDoctor] Google Sign-In configure failed:', error?.message || error);
    return false;
  }
}

export async function getGoogleIdToken() {
  if (!configured) configureGoogleSignIn();

  const GoogleSignin = getGoogleSignin();
  if (!GoogleSignin) {
    throw new Error('Google Sign-In is not available in this build.');
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();

  if (response?.type === 'cancelled') {
    throw new Error('Google Sign-In was cancelled');
  }

  const data = response?.data || response;
  let idToken = data?.idToken;

  if (!idToken) {
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens?.idToken;
  }

  if (!idToken) {
    throw new Error('Google Sign-In did not return an ID token. Check webClientId.');
  }

  return {
    idToken,
    user: data?.user || null,
  };
}

export async function googleSignOut() {
  try {
    if (!configured) configureGoogleSignIn();
    const GoogleSignin = getGoogleSignin();
    await GoogleSignin?.signOut?.();
  } catch {
    /* ignore */
  }
}

export default {
  GOOGLE_WEB_CLIENT_ID,
  FIREBASE_GOOGLE_WEB_CLIENT_ID,
  configureGoogleSignIn,
  getGoogleIdToken,
  googleSignOut,
};

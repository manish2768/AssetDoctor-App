/**
 * Google Sign-In config — never crash APK if native module misconfigured.
 */

import { ENV } from '../../config/env';

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  ENV.googleWebClientId ||
  '926559836985-1jschm7e172vqo2rav99oif3uoq93ftq.apps.googleusercontent.com';

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
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
      forceCodeForRefreshToken: true,
    });
    configured = true;
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
  configureGoogleSignIn,
  getGoogleIdToken,
  googleSignOut,
};

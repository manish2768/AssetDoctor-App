/**
 * Google Sign-In config — never crash APK if native module misconfigured.
 * webClientId MUST be the Firebase/GCP OAuth "Web client" (client_type: 3), not Android.
 */

/**
 * SHA-1 fingerprints that MUST be registered on the Firebase Android app
 * (Project settings → Your apps → Add fingerprint), then re-download google-services.json.
 *
 * Current google-services.json oauth hashes (without colons):
 * - 4a9cef27… → manish upload / older release
 * - 43d095bb… → typical debug / alternate
 * - 1d018319… → alternate release
 *
 * REQUIRED for Play builds signed with hansgeet upload key (DB:44…):
 *   DB:44:EC:44:E5:68:29:A5:91:78:71:D1:79:7D:6A:AC:1C:9B:09:A8
 * Also add Play App Signing certificate SHA-1 from Play Console → App integrity.
 */
export const ANDROID_SHA1_FINGERPRINTS = Object.freeze({
  playUploadHansgeet: 'DB:44:EC:44:E5:68:29:A5:91:78:71:D1:79:7D:6A:AC:1C:9B:09:A8',
  legacyUploadManish: '4A:9C:EF:27:A9:46:84:35:40:30:2D:9E:92:50:81:69:E5:7A:79:39',
});

/**
 * Firebase Web OAuth client (client_type: 3) — REQUIRED for GoogleSignin → Firebase Auth.
 * Do NOT use an Android client_id (client_type: 1) here.
 * Must stay exactly this value across app.json / eas.json / .env / google-services.json.
 */
export const FIREBASE_GOOGLE_WEB_CLIENT_ID =
  '926559836985-1jschm7e172vqo2rav99oif3uoq93ftq.apps.googleusercontent.com';

/** Always the pinned Web client — never trust a mismatched env override for Sign-In. */
export const GOOGLE_WEB_CLIENT_ID = FIREBASE_GOOGLE_WEB_CLIENT_ID;

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

    // Explicit Web client ID (must match Firebase Console → Web client, type 3)
    GoogleSignin.configure({
      webClientId:
        '926559836985-1jschm7e172vqo2rav99oif3uoq93ftq.apps.googleusercontent.com',
      offlineAccess: true,
    });
    configured = true;
    if (__DEV__) {
      console.log(
        '[AssetDoctor] GoogleSignin configured with webClientId:',
        FIREBASE_GOOGLE_WEB_CLIENT_ID,
      );
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

  try {
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
  } catch (error) {
    const code = error?.code ?? error?.status ?? '';
    const message = String(error?.message || error || 'Google Sign-In failed');
    const detail = code ? `[${code}] ${message}` : message;
    console.warn('[AssetDoctor] GoogleSignin native error:', { code, message, error });
    const enriched = new Error(detail);
    enriched.code = code;
    enriched.nativeMessage = message;
    throw enriched;
  }
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

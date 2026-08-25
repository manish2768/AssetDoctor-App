/**
 * Asset Doctor — runtime config (public Expo vars only)
 */

function envOr(fallback, ...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return fallback;
}

export const ENV = {
  emailProvider: envOr('resend', 'EXPO_PUBLIC_EMAIL_PROVIDER'),
  facebookAppId: envOr('', 'EXPO_PUBLIC_FACEBOOK_APP_ID'),
  googleWebClientId: envOr(
    '926559836985-1jschm7e172vqo2rav99oif3uoq93ftq.apps.googleusercontent.com',
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
  ),
  firebase: {
    apiKey: envOr('', 'EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: envOr('', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: envOr('', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: envOr(
      'assetdoctor-5fd25-vault',
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'
    ),
    messagingSenderId: envOr('', 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: envOr('', 'EXPO_PUBLIC_FIREBASE_APP_ID'),
    measurementId: envOr('', 'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID'),
  },
  /** @deprecated use ENV.firebase.projectId */
  firebaseProjectId: envOr('', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  /** HTTPS Cloud Function URL for DOCUMENT_TEXT_DETECTION (optional proxy) */
  ocrVisionUrl: envOr(
    'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceVision',
    'EXPO_PUBLIC_OCR_VISION_URL'
  ),
  /** Google Cloud Vision API key (client). Prefer Functions secret in production. */
  googleCloudVisionApiKey: envOr('', 'EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY'),
  /** Gemini 1.5 Flash — prefer Cloud Function proxy in production */
  geminiApiKey: envOr('', 'EXPO_PUBLIC_GEMINI_API_KEY', 'GEMINI_API_KEY'),
  isDev: typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production',
};

export default ENV;

/**
 * Safe auth diagnostics for Phone OTP / Play Integrity failures.
 * Never log OTP, tokens, or keystore secrets.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

import {
  ANDROID_SHA1_FINGERPRINTS,
  ANDROID_SHA256_FINGERPRINTS,
} from './googleSignIn';

export const ANDROID_PACKAGE_ID = 'com.assetdoctor.app';
export const FIREBASE_PROJECT_ID = 'assetdoctor-5fd25';
export const FIREBASE_ANDROID_APP_ID = '1:926559836985:android:842e878c508df93d2b66e8';

function sanitizeAuthMessage(message) {
  return String(message || '')
    .replace(/\b\d{6}\b/g, '[otp]')
    .replace(/Bearer\s+\S+/gi, '[token]')
    .slice(0, 280);
}

/**
 * Build-variant hints for diagnosing Play Integrity vs local signing.
 */
export function getAuthBuildContext() {
  const executionEnvironment = Constants.executionEnvironment || '';
  const appOwnership = Constants.appOwnership || '';
  return {
    platform: Platform.OS,
    packageName: ANDROID_PACKAGE_ID,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    firebaseAndroidAppId: FIREBASE_ANDROID_APP_ID,
    isDev: Boolean(typeof __DEV__ !== 'undefined' && __DEV__),
    executionEnvironment,
    appOwnership,
    // Known certs that MUST exist in Firebase Console for each install type
    expectedSha1: {
      playAppSigning: ANDROID_SHA1_FINGERPRINTS.playAppSigning,
      playUpload: ANDROID_SHA1_FINGERPRINTS.playUploadHansgeet,
      localDebug: ANDROID_SHA1_FINGERPRINTS.localDebug,
    },
    expectedSha256: {
      playAppSigning: ANDROID_SHA256_FINGERPRINTS.playAppSigning,
      playUpload: ANDROID_SHA256_FINGERPRINTS.playUpload,
      localDebug: ANDROID_SHA256_FINGERPRINTS.localDebug,
    },
  };
}

/**
 * Log phone-auth / integrity failures for engineers (Logcat / Metro).
 */
export function logPhoneAuthFailure(error, phase = 'sendOTP') {
  const ctx = getAuthBuildContext();
  const code = String(error?.code || '');
  const message = sanitizeAuthMessage(error?.message || error?.nativeMessage || error);
  console.warn('[AssetDoctor][PhoneAuth]', {
    phase,
    code,
    message,
    packageName: ctx.packageName,
    isDev: ctx.isDev,
    executionEnvironment: ctx.executionEnvironment,
    appOwnership: ctx.appOwnership,
    firebaseProjectId: ctx.firebaseProjectId,
    hint:
      'If code is app-not-authorized / missing-client-identifier / invalid-app-credential: ' +
      'register THIS install signing SHA-1+SHA-256 in Firebase (debug, upload, AND Play App Signing).',
  });
}

export default {
  ANDROID_PACKAGE_ID,
  FIREBASE_PROJECT_ID,
  getAuthBuildContext,
  logPhoneAuthFailure,
};

/**
 * Map Firebase / Google / Play Integrity auth failures to short user-facing copy.
 * Never surface raw token / SafetyNet / stack traces in the UI.
 */

function blobOf(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || error?.nativeMessage || error || '');
  return { code, message, blob: `${code} ${message}`.toLowerCase() };
}

/**
 * @param {unknown} error
 * @returns {string|null} friendly message or null if not an auth/integrity class error
 */
export function mapPlayIntegrityOrAuthError(error) {
  const { code, message, blob } = blobOf(error);

  if (/sign_in_cancelled|sign_in_canceled|cancelled|canceled/.test(blob)) {
    return 'Sign-in was cancelled.';
  }

  // Play Integrity / SafetyNet / app attestation (Phone Auth)
  // Root cause is almost always: install signing cert SHA not registered in Firebase.
  if (
    /play.?integrity|safetynet|integrity.?token|app.?attest|recaptcha|captcha-check|missing-client-identifier|app-not-authorized|app_not_authorized|invalid-app-credential|invalid.app.credential|missing-app-credential/.test(
      blob,
    ) ||
    /error.?code.?10|error.?code.?7|common.?status.?codes/.test(blob)
  ) {
    return 'This app build is not verified for phone login (signing key mismatch). Install from Play Internal testing, or ask the developer to register this build’s SHA-1 and SHA-256 in Firebase. You can still use Google Sign-In or Email.';
  }

  // Google Sign-In SHA-1 / OAuth client misconfig
  if (
    /developer_error|api_not_available|sign_in_failed|10:|status.?code.?10|12500|12501|network_error/.test(
      blob,
    ) ||
    code === '10' ||
    code === 'DEVELOPER_ERROR'
  ) {
    return 'Google Sign-In is not ready on this install. Use the Play Store build, or continue with Email / Phone OTP.';
  }

  if (/play.?services|google.?play.?services|service_invalid|service_missing|service_version_update_required/.test(blob)) {
    return 'Update Google Play Services, then try signing in again.';
  }

  if (/network|timeout|unavailable|offline|failed to connect|econn|etimedout/.test(blob)) {
    return 'Network issue — check your connection and try again.';
  }

  if (/too.?many.?requests|quota|sms.?quota/.test(blob)) {
    return 'Too many attempts. Wait a bit, then try again.';
  }

  if (/invalid-phone-number|invalid.?phone/.test(blob)) {
    return 'Enter a valid mobile number with country code.';
  }

  if (/invalid-verification-code|invalid.?otp|session-expired|code-expired/.test(blob)) {
    return 'Invalid or expired OTP. Request a new code.';
  }

  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(blob)) {
    return 'Those login details did not match. Check and try again.';
  }

  if (/firebase.*still starting|no firebase app|\[default\]|auth is unavailable|signing services are warming/.test(blob)) {
    return 'Signing services are warming up — tap again in a moment.';
  }

  // Already-friendly short messages from our own throws
  if (message && message.length < 140 && !/exception|stack|token|integrity|safetynet|native/i.test(message)) {
    return message;
  }

  return null;
}

/**
 * Always returns a safe string for Alerts / Login UI.
 */
export function toAuthUserMessage(error, fallback = 'Sign-in failed. Please try again.') {
  return mapPlayIntegrityOrAuthError(error) || fallback;
}

export function isTransientAuthWarmup(error) {
  const { blob } = blobOf(error);
  return /firebase.*still starting|no firebase app|\[default\]|auth is unavailable|warming up/.test(blob);
}

export default {
  mapPlayIntegrityOrAuthError,
  toAuthUserMessage,
  isTransientAuthWarmup,
};

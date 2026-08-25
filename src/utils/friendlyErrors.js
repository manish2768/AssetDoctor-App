/**
 * Map technical / Firebase / OCR errors to short user-facing copy.
 */

export function toFriendlyError(error, fallback = 'Something went wrong. Please try again.') {
  const code = String(error?.code || '');
  const message = String(error?.message || error?.nativeMessage || error || '');
  const blob = `${code} ${message}`.toLowerCase();

  if (/network|timeout|unavailable|offline|failed to connect|econn|etimedout/.test(blob)) {
    return 'Network taking time, saved locally';
  }
  if (/not signed in|requires.?auth|unauthenticated/.test(blob)) {
    return 'Please sign in to sync this change.';
  }
  if (
    /ocr|scan|vision|ml.?kit|could not read|no text|empty text|blurry|image/.test(blob) ||
    /couldn't scan|could not scan/.test(blob)
  ) {
    return "Couldn't scan clearly, please try again";
  }
  if (/permission|denied|camera|photos|library/.test(blob)) {
    return 'Permission needed — enable Camera / Photos in Settings.';
  }
  if (/firebase.*still starting|no firebase app|\[default\]|auth is unavailable/.test(blob)) {
    return 'Signing services are warming up — tap again in a moment.';
  }
  if (/cancelled|canceled|sign_in_cancelled/.test(blob)) {
    return 'Sign-in was cancelled.';
  }
  if (/too.?many.?requests|quota/.test(blob)) {
    return 'Too many attempts. Try again later.';
  }
  // Prefer already-friendly short messages
  if (message && message.length < 120 && !/exception|stack|native|error:/i.test(message)) {
    return message;
  }
  return fallback;
}

export default { toFriendlyError };

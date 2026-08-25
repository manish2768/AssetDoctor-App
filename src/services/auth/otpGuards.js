/**
 * Client-side OTP attempt / resend throttling (Firebase also rate-limits server-side).
 * Never stores OTP codes.
 */

const RESEND_COOLDOWN_SEC = 30;
const MAX_VERIFY_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

/** @type {Map<string, { attempts: number, lockedUntil: number, lastSendAt: number }>} */
const byPhone = new Map();

function key(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function getOtpResendCooldownSec() {
  return RESEND_COOLDOWN_SEC;
}

export function canSendOtp(phone) {
  const k = key(phone);
  if (!k) return { ok: false, waitSec: 0, reason: 'Enter a valid mobile number.' };
  const row = byPhone.get(k) || { attempts: 0, lockedUntil: 0, lastSendAt: 0 };
  const now = Date.now();
  if (row.lockedUntil > now) {
    return {
      ok: false,
      waitSec: Math.ceil((row.lockedUntil - now) / 1000),
      reason: 'Too many attempts. Please wait a few minutes and try again.',
    };
  }
  const since = now - (row.lastSendAt || 0);
  if (row.lastSendAt && since < RESEND_COOLDOWN_SEC * 1000) {
    return {
      ok: false,
      waitSec: Math.ceil((RESEND_COOLDOWN_SEC * 1000 - since) / 1000),
      reason: `Wait ${Math.ceil((RESEND_COOLDOWN_SEC * 1000 - since) / 1000)}s before resending OTP.`,
    };
  }
  return { ok: true, waitSec: 0 };
}

export function markOtpSent(phone) {
  const k = key(phone);
  const row = byPhone.get(k) || { attempts: 0, lockedUntil: 0, lastSendAt: 0 };
  row.lastSendAt = Date.now();
  byPhone.set(k, row);
}

export function recordOtpFailure(phone) {
  const k = key(phone);
  const row = byPhone.get(k) || { attempts: 0, lockedUntil: 0, lastSendAt: 0 };
  row.attempts += 1;
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    row.lockedUntil = Date.now() + LOCK_MS;
    row.attempts = 0;
  }
  byPhone.set(k, row);
  return {
    remaining: Math.max(0, MAX_VERIFY_ATTEMPTS - row.attempts),
    locked: row.lockedUntil > Date.now(),
  };
}

export function clearOtpAttempts(phone) {
  const k = key(phone);
  if (k) byPhone.delete(k);
}

/** India mobile: 10 digits starting 6–9, optional +91 / 91 prefix. */
export function validateIndianMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let ten = digits;
  if (digits.length === 12 && digits.startsWith('91')) ten = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) ten = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(ten)) {
    return {
      ok: false,
      e164: '',
      reason: 'Enter a valid 10-digit Indian mobile number.',
    };
  }
  return { ok: true, e164: `+91${ten}`, national: ten };
}

export default {
  canSendOtp,
  markOtpSent,
  recordOtpFailure,
  clearOtpAttempts,
  validateIndianMobile,
  getOtpResendCooldownSec,
};

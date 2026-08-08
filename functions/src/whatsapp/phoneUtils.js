/**
 * Phone + OTP helpers for WhatsApp auth.
 */

const crypto = require('crypto');

/** Digits only, with country code (no +). Default India 91 for 10-digit mobiles. */
function toWhatsAppRecipient(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.startsWith('0') && digits.length === 11) digits = `91${digits.slice(1)}`;
  return digits;
}

/** E.164 for Firebase Auth (+9198…) */
function toE164(phone) {
  const digits = toWhatsAppRecipient(phone);
  return digits ? `+${digits}` : '';
}

function generateOtp(length = 6) {
  const max = 10 ** length;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(length, '0');
}

function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function timingSafeEqualHex(a, b) {
  try {
    const bufA = Buffer.from(String(a), 'hex');
    const bufB = Buffer.from(String(b), 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function formatDueDate(value) {
  if (!value) return '—';
  try {
    let d;
    if (typeof value === 'string') {
      d = new Date(`${value.slice(0, 10)}T00:00:00`);
    } else if (typeof value.toDate === 'function') {
      d = value.toDate();
    } else if (value instanceof Date) {
      d = value;
    }
    if (!d || Number.isNaN(d.getTime())) return String(value).slice(0, 32);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(value).slice(0, 32);
  }
}

module.exports = {
  toWhatsAppRecipient,
  toE164,
  generateOtp,
  hashOtp,
  timingSafeEqualHex,
  formatDueDate,
};

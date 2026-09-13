/**
 * Asset Doctor — Canonical Phone & WhatsApp Utility
 * 
 * Standardizes phone normalization, validation, and WhatsApp deep linking across
 * the entire mobile, web, and backend services.
 * 
 * Rules:
 * 1. Indian numbers:
 *    - "9876543210"        -> "+919876543210"
 *    - "09876543210"       -> "+919876543210"
 *    - "919876543210"      -> "+919876543210"
 *    - "+91 98765 43210"   -> "+919876543210"
 *    - "(987) 654-3210"    -> "+919876543210" (when 10-digit Indian context)
 * 2. International numbers:
 *    - "+1 415 555 2671"   -> "+14155552671"
 *    - "+44 7911 123456"   -> "+447911123456"
 * 3. WhatsApp Digits (for wa.me / API):
 *    - "+919876543210"     -> "919876543210"
 *    - "+14155552671"      -> "14155552671"
 */

/**
 * Normalizes any raw phone input to canonical E.164 format (+[country][national]).
 * Returns null or empty string if input cannot be resolved to a valid phone.
 */
export function normalizePhone(rawPhone: string | null | undefined, defaultCountryCode: string = '91'): string {
  if (!rawPhone) return '';
  const str = String(rawPhone).trim();
  if (!str) return '';

  // 1. Check if user already typed an international plus prefix
  const hasPlus = str.startsWith('+');

  // 2. Strip all non-digit characters
  const allDigits = str.replace(/\D/g, '');
  if (!allDigits) return '';

  // If already had a plus:
  if (hasPlus) {
    // Check if it was +0... (invalid leading 0 after plus)
    const cleanAfterPlus = allDigits.replace(/^0+/, '');
    if (cleanAfterPlus.length >= 7) {
      return `+${cleanAfterPlus}`;
    }
  }

  // 3. Indian number handling:
  // Case A: 11 digits starting with 0 (e.g. 09876543210 -> 9876543210)
  if (allDigits.length === 11 && allDigits.startsWith('0')) {
    const ten = allDigits.slice(1);
    if (/^[6-9]\d{9}$/.test(ten)) {
      return `+91${ten}`;
    }
  }

  // Case B: Exactly 10 digits
  if (allDigits.length === 10) {
    // If starts with 6-9 (standard Indian mobile series) or defaultCountryCode is 91
    if (/^[6-9]\d{9}$/.test(allDigits) || defaultCountryCode === '91') {
      return `+91${allDigits}`;
    }
    return `+${defaultCountryCode}${allDigits}`;
  }

  // Case C: 12 digits starting with 91 (e.g. 919876543210)
  if (allDigits.length === 12 && allDigits.startsWith('91')) {
    return `+${allDigits}`;
  }

  // Case D: Other international lengths (11 to 15 digits)
  if (allDigits.length >= 10 && allDigits.length <= 15) {
    // If starts with 00 (international call prefix e.g. 0014155552671)
    if (allDigits.startsWith('00')) {
      return `+${allDigits.slice(2)}`;
    }
    // If already starts with 91 and length 12
    if (allDigits.startsWith('91') && allDigits.length === 12) {
      return `+${allDigits}`;
    }
    // Otherwise assume country code is present if > 10 digits
    if (allDigits.length > 10) {
      return `+${allDigits}`;
    }
    return `+${defaultCountryCode}${allDigits}`;
  }

  return '';
}

/**
 * Normalized phone alias for E.164 consistency
 */
export const normalizeE164Phone = normalizePhone;
export const normalizeWhatsAppPhone = normalizePhone;

/**
 * Returns digits-only representation without leading '+' or '0' for WhatsApp URLs / APIs.
 * e.g., "+919876543210" -> "919876543210"
 */
export function toWhatsAppDigits(rawPhone: string | null | undefined): string {
  const e164 = normalizePhone(rawPhone);
  if (!e164) return '';
  return e164.replace(/\D/g, '');
}

/**
 * Validates whether a phone number is a valid international/Indian phone number.
 */
export function isValidPhoneNumber(rawPhone: string | null | undefined): boolean {
  const e164 = normalizePhone(rawPhone);
  if (!e164) return false;
  // E.164 must be + followed by 10 to 15 digits, not starting with +0
  return /^\+[1-9]\d{9,14}$/.test(e164);
}

/**
 * Formats a phone number cleanly for human display.
 * e.g., "+919876543210" -> "+91 98765 43210"
 */
export function formatDisplayPhone(rawPhone: string | null | undefined): string {
  const e164 = normalizePhone(rawPhone);
  if (!e164) return String(rawPhone || '').trim();

  // Indian numbers (+91XXXXXXXXXX) -> "+91 XXXXX XXXXX"
  if (e164.startsWith('+91') && e164.length === 13) {
    const p1 = e164.slice(3, 8);
    const p2 = e164.slice(8);
    return `+91 ${p1} ${p2}`;
  }

  // US/Canada (+1XXXXXXXXXX) -> "+1 (XXX) XXX-XXXX"
  if (e164.startsWith('+1') && e164.length === 12) {
    const area = e164.slice(2, 5);
    const mid = e164.slice(5, 8);
    const last = e164.slice(8);
    return `+1 (${area}) ${mid}-${last}`;
  }

  return e164;
}

/**
 * Constructs a resilient WhatsApp URL for deep-linking or web fallback.
 */
export function buildWhatsAppLink({
  phone,
  message
}: {
  phone?: string | null;
  message: string;
}): {
  appUrl: string;
  webUrl: string;
  digits: string;
  hasPhone: boolean;
} {
  const digits = phone ? toWhatsAppDigits(phone) : '';
  const encodedText = encodeURIComponent(message || '');

  const appUrl = digits
    ? `whatsapp://send?phone=${digits}&text=${encodedText}`
    : `whatsapp://send?text=${encodedText}`;

  const webUrl = digits
    ? `https://wa.me/${digits}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  return {
    appUrl,
    webUrl,
    digits,
    hasPhone: Boolean(digits)
  };
}

export default {
  normalizePhone,
  normalizeE164Phone,
  normalizeWhatsAppPhone,
  toWhatsAppDigits,
  isValidPhoneNumber,
  formatDisplayPhone,
  buildWhatsAppLink,
};

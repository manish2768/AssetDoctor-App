/**
 * Client helper → HTTP identity guard (no native functions module required).
 */

const REGION = process.env.EXPO_PUBLIC_FUNCTIONS_REGION || 'asia-south1';
const PROJECT_ID =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'assetdoctor-5fd25';
const DEFAULT_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/checkIdentityAvailableHttp`;
const ENDPOINT =
  process.env.EXPO_PUBLIC_IDENTITY_CHECK_URL || DEFAULT_URL;

function normalizePhone(value) {
  const trimmed = String(value || '').replace(/[\s-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  if (trimmed.startsWith('91') && trimmed.length === 12) return `+${trimmed}`;
  return trimmed;
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export class IdentityService {
  /**
   * @param {{ email?: string, phone?: string, excludeUid?: string }} input
   * @returns {Promise<{ available: boolean, field?: string, message?: string, error?: string, skipped?: boolean }>}
   */
  static async checkAvailable({ email, phone, excludeUid } = {}) {
    const payload = {
      email: email ? normalizeEmail(email) : undefined,
      phone: phone ? normalizePhone(phone) : undefined,
      excludeUid: excludeUid || undefined,
    };
    if (!payload.email && !payload.phone) {
      return { available: true };
    }

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('[IdentityService] HTTP', res.status, data);
        return { available: true, skipped: true, error: data?.error || `HTTP ${res.status}` };
      }
      if (data.available === false) {
        return {
          available: false,
          field: data.field,
          message:
            data.message ||
            (data.field === 'email'
              ? 'Email is already registered with another account.'
              : 'Phone number is already registered with another account.'),
        };
      }
      return { available: true, skipped: Boolean(data.skipped) };
    } catch (error) {
      console.warn('[IdentityService]', error?.message || error);
      const msg = String(error?.message || '');
      if (/already registered/i.test(msg)) {
        return { available: false, message: msg };
      }
      return { available: true, skipped: true, error: msg };
    }
  }
}

export default IdentityService;

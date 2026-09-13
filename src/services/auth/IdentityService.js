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

import { IdentityResolver } from '../identity/identityResolver';
import {
  normalizeCanonicalEmail,
  normalizeCanonicalPhone,
} from '../identity/identityNormalizer';

export class IdentityService {
  /**
   * @param {{ email?: string, phone?: string, excludeUid?: string }} input
   * @returns {Promise<{ available: boolean, field?: string, message?: string, error?: string, skipped?: boolean }>}
   */
  static async checkAvailable({ email, phone, excludeUid } = {}) {
    const normEmail = email ? normalizeCanonicalEmail(email) : '';
    const normPhone = phone ? normalizeCanonicalPhone(phone) : '';

    if (!normEmail && !normPhone) {
      return { available: true };
    }

    // 1. Authoritative check via IdentityResolver (L1 index + Firestore identityMappings + users)
    try {
      const result = await IdentityResolver.checkIdentityAvailable({
        email: normEmail || undefined,
        phone: normPhone || undefined,
        excludeUid,
      });

      if (result.available === false) {
        return {
          available: false,
          field: result.field,
          message:
            result.message ||
            (result.field === 'phone'
              ? 'This mobile number is already linked to another account.'
              : 'This email is already associated with another account.'),
          existingUserId: result.existingUserId,
        };
      }
    } catch (resolverErr) {
      console.warn('[IdentityService] IdentityResolver check warning:', resolverErr?.message || resolverErr);
    }

    // 2. Optional HTTP Cloud Function check if configured
    if (process.env.EXPO_PUBLIC_IDENTITY_CHECK_URL) {
      try {
        const payload = {
          email: normEmail || undefined,
          phone: normPhone || undefined,
          excludeUid: excludeUid || undefined,
        };
        const res = await fetch(process.env.EXPO_PUBLIC_IDENTITY_CHECK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.available === false) {
          return {
            available: false,
            field: data.field,
            message:
              data.message ||
              (data.field === 'phone'
                ? 'This mobile number is already linked to another account.'
                : 'This email is already associated with another account.'),
          };
        }
      } catch (httpErr) {
        /* non-fatal */
      }
    }

    return { available: true };
  }
}

export default IdentityService;

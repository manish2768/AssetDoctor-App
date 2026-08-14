/**
 * Profile setup gate — never force phone linking after Google / email.
 * Phone is optional; collect later from Settings / Profile.
 */

import { DEFAULT_DISPLAY_NAME } from '../services/constants';

export function normalizePhone(value) {
  const trimmed = String(value || '').replace(/[\s-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  if (trimmed.startsWith('91') && trimmed.length === 12) return `+${trimmed}`;
  return trimmed;
}

/** @deprecated alias — use normalizePhone */
export const normalizeWhatsAppPhone = normalizePhone;

export function hasValidPhone(profile) {
  const raw = profile?.phoneNumber || profile?.phone || '';
  const e164 = normalizePhone(raw);
  return /^\+[1-9]\d{9,14}$/.test(e164);
}

/** @deprecated alias — use hasValidPhone */
export const hasValidWhatsAppPhone = hasValidPhone;

function hasRealName(profile, user) {
  const name = String(profile?.name || user?.displayName || '').trim();
  if (!name) return false;
  if (name === DEFAULT_DISPLAY_NAME) return false;
  if (/^\+?\d{10,15}$/.test(name)) return false;
  return true;
}

/**
 * Forced "Complete your profile" is DISABLED.
 * Google / email users go straight to Home; phone link is optional in Settings.
 * @param {object | null} _profile
 * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.User | null} _user
 */
export function needsProfileSetup(_profile, _user) {
  return false;
}

export { hasRealName };

export default {
  needsProfileSetup,
  hasValidPhone,
  hasValidWhatsAppPhone,
  normalizePhone,
  normalizeWhatsAppPhone,
};

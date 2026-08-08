/**
 * Profile setup gate — collect WhatsApp number / real name when missing.
 */

import { DEFAULT_DISPLAY_NAME } from '../services/constants';

export function normalizeWhatsAppPhone(value) {
  const trimmed = String(value || '').replace(/[\s-]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  if (trimmed.startsWith('91') && trimmed.length === 12) return `+${trimmed}`;
  return trimmed;
}

export function hasValidWhatsAppPhone(profile) {
  const raw = profile?.phoneNumber || profile?.phone || '';
  const e164 = normalizeWhatsAppPhone(raw);
  return /^\+[1-9]\d{9,14}$/.test(e164);
}

function hasRealName(profile, user) {
  const name = String(profile?.name || user?.displayName || '').trim();
  if (!name) return false;
  if (name === DEFAULT_DISPLAY_NAME) return false;
  if (/^\+?\d{10,15}$/.test(name)) return false;
  return true;
}

/**
 * @param {object | null} profile
 * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.User | null} user
 */
export function needsProfileSetup(profile, user) {
  if (!user?.uid || !profile) return false;
  if (
    profile.profileSetupComplete === true &&
    hasRealName(profile, user) &&
    hasValidWhatsAppPhone(profile)
  ) {
    return false;
  }
  if (profile.profileSetupComplete === true) return false;

  const provider =
    profile.authProvider ||
    user.providerData?.[0]?.providerId ||
    '';

  const isGoogleOrEmail =
    provider === 'google' ||
    provider === 'email' ||
    provider.includes('google') ||
    provider.includes('password');

  const isWhatsApp = provider === 'whatsapp_otp' || provider.includes('phone');

  if (!isGoogleOrEmail && !isWhatsApp) return false;

  const missingName = !hasRealName(profile, user);
  const missingPhone = !hasValidWhatsAppPhone(profile);

  if (isWhatsApp) return missingName;
  return missingName || missingPhone;
}

export default { needsProfileSetup, hasValidWhatsAppPhone, normalizeWhatsAppPhone };

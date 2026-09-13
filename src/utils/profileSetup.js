/**
 * Profile setup gate — never force phone linking after Google / email.
 * Phone is optional; collect later from Settings / Profile.
 */

import { DEFAULT_DISPLAY_NAME } from '../services/constants';
import {
  normalizePhone,
  normalizeE164Phone,
  normalizeWhatsAppPhone,
  isValidPhoneNumber as hasValidPhone,
  toWhatsAppDigits,
  formatDisplayPhone
} from './phoneUtils';

export {
  normalizePhone,
  normalizeE164Phone,
  normalizeWhatsAppPhone,
  hasValidPhone,
  toWhatsAppDigits,
  formatDisplayPhone
};

/** @deprecated alias — use hasValidPhone */
export const hasValidWhatsAppPhone = hasValidPhone;

function hasRealName(profile, user) {
  const name = String(profile?.name || user?.displayName || '').trim();
  if (!name) return false;
  if (name === DEFAULT_DISPLAY_NAME) return false;
  if (/^\+?\d{10,15}$/.test(name)) return false;
  return true;
}

import { computeProfileCompletion, needsProfileOnboarding, resolveProfileCompletion } from './profileCompletion';

/**
 * Profile setup gate:
 * User needs profile setup if mandatory fields (Full Name, PIN Code, City, State) are not complete.
 * @param {object | null} profile
 * @param {import('@react-native-firebase/auth').FirebaseAuthTypes.User | null} user
 */
export function needsProfileSetup(profile, user) {
  if (!user && !profile) return false;
  return needsProfileOnboarding({ user, profile });
}

export { hasRealName, needsProfileOnboarding, resolveProfileCompletion };

export default {
  needsProfileSetup,
  needsProfileOnboarding,
  resolveProfileCompletion,
  hasValidPhone,
  hasValidWhatsAppPhone,
  normalizePhone,
  normalizeWhatsAppPhone,
};

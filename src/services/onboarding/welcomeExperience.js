/**
 * First-time welcome eligibility — Firestore profile is source of truth.
 * Reinstall / relogin must not treat an existing customer as new.
 */

export const WELCOME_EXPERIENCE_VERSION = '10.1';

export function firstNameFromDisplay(fullName = '') {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts[0]) return '';
  if (parts[0] === 'Asset' && parts[1] === 'Owner') return '';
  return parts[0].slice(0, 24);
}

/**
 * @param {object | null | undefined} profile
 * @returns {boolean}
 */
export function isWelcomeExperienceEligible(profile) {
  if (!profile || typeof profile !== 'object') return false;
  if (profile.onboardingCompleted === true) return false;
  if (profile.welcomeExperienceCompleted === true) return false;
  return profile.welcomeExperiencePending === true;
}

export function welcomePrimaryAction() {
  return { openScanner: true };
}

export function welcomeSecondaryAction() {
  return { openScanner: false };
}

export function buildWelcomeExperienceFlags(isNewUser) {
  if (!isNewUser) return {};
  return {
    welcomeExperiencePending: true,
    welcomeExperienceCompleted: false,
    welcomeExperienceVersion: WELCOME_EXPERIENCE_VERSION,
    onboardingCompleted: false,
  };
}

export function buildWelcomeExperienceCompletePatch() {
  return {
    welcomeExperiencePending: false,
    welcomeExperienceCompleted: true,
    onboardingCompleted: true,
    welcomeExperienceVersion: WELCOME_EXPERIENCE_VERSION,
  };
}

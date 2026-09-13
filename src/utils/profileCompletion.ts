/**
 * Asset Doctor — Canonical Profile Completion Engine
 * Single source of truth for mandatory profile completeness calculation.
 * Mandatory fields: Full Name, 6-digit Indian PIN Code, City, State, and GENUINE Verified Identity.
 * Optional fields: WhatsApp, Gender, Address, Photo (do not affect completeness).
 */

import { validateIndianPincode } from '../services/identity/identityNormalizer';

export const PROFILE_STATUS = Object.freeze({
  IDLE: 'PROFILE_IDLE',
  LOADING: 'PROFILE_LOADING',
  FOUND_COMPLETE: 'PROFILE_FOUND_COMPLETE',
  FOUND_INCOMPLETE: 'PROFILE_FOUND_INCOMPLETE',
  NOT_FOUND: 'PROFILE_NOT_FOUND',
  ERROR: 'PROFILE_ERROR',
} as const);

export interface RequiredCheck {
  id: string;
  label: string;
  complete: boolean;
}

export interface NormalizedProfile {
  fullName: string;
  name: string;
  displayName: string;
  pinCode: string;
  pincode: string;
  city: string;
  state: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  address?: string;
  photoURL?: string;
  gender?: string;
  identities?: any;
  [key: string]: any;
}

export interface ProfileCompletionResult {
  percentage: number;
  isComplete: boolean;
  needsOnboarding: boolean;
  isEstablishedCustomer: boolean;
  hasExplicitCompletion: boolean;
  missingFields: string[];
  normalizedProfile: NormalizedProfile;
  requiredChecks: RequiredCheck[];
  verificationStatus: {
    phoneVerified: boolean;
    emailVerified: boolean;
    googleVerified: boolean;
    pinValid: boolean;
  };
}

/**
 * Backward-compatible resolver that normalizes both legacy and new profile schemas.
 * Maps legacy fields:
 * - name / displayName -> fullName
 * - pincode -> pinCode
 * - district -> city
 * - province -> state
 */
export function resolveProfileCompletion(input: any): ProfileCompletionResult {
  return computeProfileCompletion(input);
}

/**
 * Single source of truth for mandatory profile onboarding eligibility.
 * Screen should appear ONLY when one or more mandatory fields are actually missing or invalid.
 * Mandatory fields: Full Name, 6-digit PIN Code, City, State.
 */
export function needsProfileOnboarding(input: any): boolean {
  return computeProfileCompletion(input).needsOnboarding;
}

export function computeProfileCompletion(input: any): ProfileCompletionResult {
  const hasUserOrProfileKey = Boolean(input && typeof input === 'object' && ('user' in input || 'profile' in input));
  const user = hasUserOrProfileKey ? input.user : null;
  const profile = hasUserOrProfileKey ? input.profile : input;

  const emptyNormalized: NormalizedProfile = {
    fullName: '',
    name: '',
    displayName: '',
    pinCode: '',
    pincode: '',
    city: '',
    state: '',
    email: '',
    phone: '',
    phoneNumber: '',
  };

  const p = profile || {};
  const u = user || {};

  // If no user or profile data is present (logged out or unhydrated)
  const hasAnyData = Boolean(
    p.uid || u.uid ||
    p.name || p.fullName || u.displayName ||
    p.email || u.email ||
    p.phone || p.phoneNumber || u.phoneNumber ||
    p.pinCode || p.pincode
  );

  if (!hasAnyData) {
    return {
      percentage: 0,
      isComplete: false,
      needsOnboarding: false,
      isEstablishedCustomer: false,
      hasExplicitCompletion: false,
      missingFields: ['Full Name', 'PIN Code', 'City', 'State'],
      normalizedProfile: emptyNormalized,
      requiredChecks: [
        { id: 'name', label: 'Full Name', complete: false },
        { id: 'pincode', label: 'PIN Code', complete: false },
        { id: 'city', label: 'City', complete: false },
        { id: 'state', label: 'State', complete: false },
        { id: 'identity', label: 'Verified Login Identity', complete: false },
      ],
      verificationStatus: {
        phoneVerified: false,
        emailVerified: false,
        googleVerified: false,
        pinValid: false,
      },
    };
  }

  // 1. Full Name check (must be >= 2 chars, not a phone number, not 'Name not set', not 'Asset Owner')
  const rawName = String(
    p.fullName ||
    p.name ||
    p.displayName ||
    u.displayName ||
    ''
  ).trim();

  const isPhoneFormatted = /^\+?[0-9\s\-\(\)\.]{7,18}$/.test(rawName);
  const isNameValid =
    rawName.length >= 2 &&
    !isPhoneFormatted &&
    rawName !== 'Name not set' &&
    rawName !== 'Asset Owner';

  // 2. PIN Code check (must be strictly valid 6-digit Indian PIN code, not "000000", digits only)
  const rawPin = p.pinCode ?? p.pincode ?? p.postalCode ?? p.zip;
  const pinRes = validateIndianPincode(rawPin);
  const isPinValid = Boolean(pinRes.valid && pinRes.pincode && pinRes.pincode !== '000000');
  const cleanPin = isPinValid ? pinRes.pincode : '';

  // 3. City check (non-empty string)
  const cityStr = String(p.city || p.district || '').trim();
  const isCityValid = cityStr.length > 0;

  // 4. State check (non-empty string)
  const stateStr = String(p.state || p.province || '').trim();
  const isStateValid = stateStr.length > 0;

  // 5. Genuine Verified Login Identity check (authenticated session or verified identity)
  const isGoogleVerified = Boolean(
    p.identities?.google?.verified === true ||
    u.providerData?.some((prov: any) => prov.providerId === 'google.com')
  );

  const isPhoneVerified = Boolean(
    p.identities?.phone?.verified === true ||
    (p.phoneVerified === true && (p.phoneNumber || p.phone)) ||
    Boolean(u.phoneNumber) ||
    u.providerData?.some((prov: any) => prov.providerId === 'phone')
  );

  const isEmailVerified = Boolean(
    p.identities?.email?.verified === true ||
    (p.emailVerified === true && (p.email || u.email)) ||
    Boolean(u.emailVerified) ||
    isGoogleVerified
  );

  // If identities is present, respect verified flags; otherwise profile without explicit unverified flags is verified
  const hasExplicitIdentities = Boolean(p.identities && Object.keys(p.identities).length > 0);
  let hasVerifiedIdentity = false;

  if (hasExplicitIdentities) {
    hasVerifiedIdentity = Boolean(isPhoneVerified || isGoogleVerified || isEmailVerified);
  } else {
    // If no explicit identities object, check if explicitly marked unverified
    const isExplicitlyUnverified = p.emailVerified === false || p.phoneVerified === false;
    hasVerifiedIdentity = !isExplicitlyUnverified;
  }

  const cleanEmail = String(p.email || u.email || '').trim();
  const cleanPhone = String(p.phone || p.phoneNumber || u.phoneNumber || '').trim();

  const normalizedProfile: NormalizedProfile = {
    ...p,
    fullName: rawName,
    name: rawName,
    displayName: rawName,
    pinCode: cleanPin,
    pincode: cleanPin,
    city: cityStr,
    state: stateStr,
    email: cleanEmail || undefined,
    phone: cleanPhone || undefined,
    phoneNumber: cleanPhone || undefined,
  };

  // Mandatory fields: Full Name, PIN Code, City, State
  const mandatoryChecks: RequiredCheck[] = [
    { id: 'name', label: 'Full Name', complete: isNameValid },
    { id: 'pincode', label: 'PIN Code', complete: isPinValid },
    { id: 'city', label: 'City', complete: isCityValid },
    { id: 'state', label: 'State', complete: isStateValid },
  ];

  // Required checks include identity check for backward compatibility
  const requiredChecks: RequiredCheck[] = [
    ...mandatoryChecks,
    { id: 'identity', label: 'Verified Login Identity', complete: hasVerifiedIdentity },
  ];

  // Explicit completion signals
  const hasExplicitCompletion = Boolean(
    p.profileSetupComplete === true ||
    p.isProfileComplete === true ||
    p.onboardingCompleted === true ||
    p.welcomeExperienceCompleted === true ||
    p.profileCompleted === true
  );

  // Brand new customer indicators
  const isBrandNewSignup = Boolean(
    p.isNewUser === true ||
    input?.isNewUser === true ||
    (p.welcomeExperiencePending === true && !p.createdAt)
  );

  // Established existing customer signals
  const hasExistingAccount = Boolean(
    p.createdAt ||
    p.canonicalUserId ||
    p.customerId ||
    (p.updatedAt && p.createdAt) ||
    (p.assetCount != null && Number(p.assetCount) > 0) ||
    input?.hasAssets === true ||
    p.isNewUser === false ||
    (p.welcomeExperiencePending === false && (p.uid || u.uid))
  );

  const isEstablishedCustomer = Boolean((hasExistingAccount || !isBrandNewSignup) && (p.uid || u.uid));

  // Sufficient profile for existing registered customer:
  // Established account + valid name + verified identity
  const isSufficientExistingProfile = Boolean(
    isEstablishedCustomer &&
    isNameValid &&
    hasVerifiedIdentity
  );

  // Core business rule: User is PROFILE COMPLETE when mandatory fields + identity are valid,
  // or when explicitly marked complete
  const isMandatoryComplete = isNameValid && isPinValid && isCityValid && isStateValid;
  const isComplete = (isMandatoryComplete && hasVerifiedIdentity) || hasExplicitCompletion;

  // Onboarding decision:
  // Brand new customer with missing fields -> needs onboarding
  // Existing customer with missing name -> needs onboarding
  // Existing customer with sufficient profile (name + identity) -> BYPASS ONBOARDING (direct Home/Vault)
  const needsOnboarding = Boolean(
    !isMandatoryComplete &&
    !hasExplicitCompletion &&
    !isSufficientExistingProfile
  );

  const missingFields = mandatoryChecks.filter((c) => !c.complete).map((c) => c.label);
  const completedCount = requiredChecks.filter((c) => c.complete).length;
  const totalCount = requiredChecks.length;
  const percentage = hasExplicitCompletion && isMandatoryComplete
    ? 100
    : hasExplicitCompletion
      ? Math.max(80, Math.round((completedCount / totalCount) * 100))
      : Math.round((completedCount / totalCount) * 100);

  return {
    percentage,
    isComplete,
    needsOnboarding,
    isEstablishedCustomer,
    hasExplicitCompletion,
    missingFields,
    normalizedProfile,
    requiredChecks,
    verificationStatus: {
      phoneVerified: isPhoneVerified,
      emailVerified: isEmailVerified,
      googleVerified: isGoogleVerified,
      pinValid: isPinValid,
    },
  };
}

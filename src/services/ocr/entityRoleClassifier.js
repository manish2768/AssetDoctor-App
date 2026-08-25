/**
 * Semantic role for a string pulled from an invoice.
 * Prefer null over guessing a person from an address.
 */

import { isAddressLikeName } from './fieldValidators';

export const ENTITY_ROLE = Object.freeze({
  PERSON_NAME: 'PERSON_NAME',
  COMPANY: 'COMPANY',
  ADDRESS: 'ADDRESS',
  CITY: 'CITY',
  STATE: 'STATE',
  PIN: 'PIN',
  PHONE: 'PHONE',
  EMAIL: 'EMAIL',
  UNKNOWN: 'UNKNOWN',
});

const COMPANY_TAIL =
  /\b(?:pvt\.?\s*ltd\.?|private\s+limited|limited|llp|llc|inc\.?|corporation|enterprises|retail|stores?|traders?|motors?)\b/i;

const STATE_RE =
  /\b(?:uttar\s*pradesh|maharashtra|karnataka|tamil\s*nadu|delhi|haryana|gujarat|rajasthan|west\s*bengal|telangana|andhra\s*pradesh|kerala|punjab|bihar|madhya\s*pradesh)\b/i;

const CITY_RE =
  /\b(?:lucknow|kanpur|noida|gurgaon|gurugram|mumbai|pune|bengaluru|bangalore|hyderabad|chennai|kolkata|ahmedabad|jaipur|indore|delhi|gomti\s*nagar)\b/i;

export function classifyEntityRole(value) {
  const v = String(value || '').trim();
  if (!v) return ENTITY_ROLE.UNKNOWN;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return ENTITY_ROLE.EMAIL;
  const digits = v.replace(/\D/g, '');
  if (/^(?:\+?91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/\s/g, '')) || (digits.length === 10 && /^[6-9]/.test(digits) && !/[A-Za-z]{3,}/.test(v))) {
    return ENTITY_ROLE.PHONE;
  }
  if (/^[1-9]\d{5}$/.test(v.replace(/\s/g, ''))) return ENTITY_ROLE.PIN;
  if (STATE_RE.test(v) && v.split(/\s+/).length <= 4) return ENTITY_ROLE.STATE;
  if (isAddressLikeName(v) || /\b(?:road|crossing|nagar|sector|pin)\b/i.test(v)) return ENTITY_ROLE.ADDRESS;
  if (CITY_RE.test(v) && v.split(/\s+/).length <= 3) return ENTITY_ROLE.CITY;
  if (COMPANY_TAIL.test(v)) return ENTITY_ROLE.COMPANY;
  const parts = v.split(/\s+/).filter(Boolean);
  if (
    parts.length >= 2 &&
    parts.length <= 4 &&
    parts.every((p) => /^[A-Za-z][A-Za-z.'-]{1,}$/.test(p)) &&
    !isAddressLikeName(v)
  ) {
    return ENTITY_ROLE.PERSON_NAME;
  }
  return ENTITY_ROLE.UNKNOWN;
}

/** Buyer/owner only when role is PERSON_NAME (or COMPANY for B2B). Else null. */
export function buyerNameOrNull(value) {
  const role = classifyEntityRole(value);
  if (role === ENTITY_ROLE.PERSON_NAME || role === ENTITY_ROLE.COMPANY) {
    return String(value).trim();
  }
  return null;
}

export default { ENTITY_ROLE, classifyEntityRole, buyerNameOrNull };

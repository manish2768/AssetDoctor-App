/**
 * Financial intelligence constants — INR default, estimates labeled.
 */

export const CURRENCY_INR = 'INR';

export const VALUE_SOURCE = Object.freeze({
  USER_ENTERED: 'USER_ENTERED',
  ESTIMATED: 'ESTIMATED',
  EXTERNAL_SOURCE: 'EXTERNAL_SOURCE',
  UNKNOWN: 'UNKNOWN',
});

export const DEPRECIATION_METHOD = Object.freeze({
  STRAIGHT_LINE: 'STRAIGHT_LINE',
  PERCENTAGE: 'PERCENTAGE', // existing declining-balance style (default)
  USER_DEFINED: 'USER_DEFINED',
  NONE: 'NONE',
});

export const EXPENSE_BUCKET = Object.freeze({
  PURCHASE: 'purchase',
  SERVICE: 'service',
  REPAIR: 'repair',
  INSURANCE: 'insurance',
  ENERGY: 'energy',
  ACCESSORIES: 'accessories',
  FUEL: 'fuel',
  CHARGING: 'charging',
  OTHER: 'other',
});

export const OWNERSHIP_ROLE = Object.freeze({
  OWNER: 'OWNER',
  FAMILY_MEMBER: 'FAMILY_MEMBER',
  BUSINESS: 'BUSINESS',
  SHARED: 'SHARED',
});

export const REPAIR_ADVICE = Object.freeze({
  REPAIR: 'REPAIR',
  MONITOR: 'MONITOR',
  COMPARE_REPLACEMENT: 'COMPARE_REPLACEMENT',
});

export function formatInr(n) {
  const v = Math.round(Number(n) || 0);
  return `₹${v.toLocaleString('en-IN')}`;
}

export function notAvailable(label = 'Not available') {
  return { available: false, label, value: null };
}

export default {
  CURRENCY_INR,
  VALUE_SOURCE,
  DEPRECIATION_METHOD,
  EXPENSE_BUCKET,
  OWNERSHIP_ROLE,
  REPAIR_ADVICE,
  formatInr,
  notAvailable,
};

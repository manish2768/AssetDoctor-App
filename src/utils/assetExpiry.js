/**
 * Asset expiry helpers — red-flag / Attention Required logic.
 */

import { daysUntil } from './dates';

export const EXPIRY_FIELDS = Object.freeze([
  { field: 'insuranceExpiry', label: 'Insurance' },
  { field: 'pucExpiry', label: 'PUC' },
  { field: 'warrantyExpiry', label: 'Warranty' },
  { field: 'nextServiceDue', label: 'Service' },
]);

/**
 * @param {string|null|undefined} isoDate
 * @returns {boolean}
 */
export function isDateExpired(isoDate) {
  const days = daysUntil(isoDate);
  return days != null && days < 0;
}

/**
 * @param {object} asset
 * @returns {{ field: string, label: string, days: number, date: string }[]}
 */
export function getExpiredFields(asset = {}) {
  const out = [];
  for (const { field, label } of EXPIRY_FIELDS) {
    const days = daysUntil(asset[field]);
    if (days != null && days < 0) {
      out.push({ field, label, days, date: asset[field] });
    }
  }
  return out;
}

export function hasExpiredDocuments(asset) {
  return getExpiredFields(asset).length > 0;
}

/**
 * Dashboard filter: Expired Assets / Attention Required
 * Includes already-expired docs and items due within `attentionDays`.
 */
export function needsAttention(asset, attentionDays = 15) {
  if (!asset || asset.deletedAt) return false;
  for (const { field } of EXPIRY_FIELDS) {
    const days = daysUntil(asset[field]);
    if (days != null && days <= attentionDays) return true;
  }
  return false;
}

export function attentionSummary(asset) {
  const expired = getExpiredFields(asset);
  if (expired.length) {
    return `${expired.map((e) => e.label).join(', ')} Expired`;
  }
  const soon = [];
  for (const { field, label } of EXPIRY_FIELDS) {
    const days = daysUntil(asset[field]);
    if (days != null && days >= 0 && days <= 15) {
      soon.push(`${label} ${days}d`);
    }
  }
  return soon.slice(0, 2).join(' · ') || 'Attention Required';
}

export default {
  isDateExpired,
  getExpiredFields,
  hasExpiredDocuments,
  needsAttention,
  attentionSummary,
};

/**
 * Canonical warranty date helpers — calendar-safe (no timezone drift).
 * Asset Passport is the consumer; OCR pipeline is unchanged.
 */

import { parseFlexibleDate } from './dates';

/**
 * Add calendar months to YYYY-MM-DD without UTC/local shift.
 * @param {string|null} isoDate
 * @param {number} months
 * @returns {string|null}
 */
export function addMonthsToIsoDate(isoDate, months) {
  const iso = parseFlexibleDate(isoDate);
  const n = Number(months);
  if (!iso || !Number.isFinite(n) || n <= 0) return null;

  const parts = iso.split('-').map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;

  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  const nd = Math.min(d, lastDay);

  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/**
 * @param {object} asset
 * @returns {string|null}
 */
export function resolveWarrantyStartDate(asset = {}) {
  return (
    parseFlexibleDate(asset.purchaseDate) ||
    parseFlexibleDate(asset.invoiceMeta?.invoiceDate) ||
    parseFlexibleDate(asset.invoiceDate) ||
    null
  );
}

/**
 * @param {object} asset
 * @returns {number|null}
 */
export function resolveWarrantyMonths(asset = {}) {
  const months = Number(
    asset.warrantyMonths ??
      asset.warrantyPeriodMonths ??
      asset.invoiceMeta?.warrantyPeriodMonths,
  );
  return Number.isFinite(months) && months > 0 ? months : null;
}

/**
 * Single source of truth for warranty expiry across Passport sections.
 * Prefers purchaseDate + warrantyMonths when both are known.
 * @param {object} asset
 * @returns {string|null}
 */
export function resolveCanonicalWarrantyExpiry(asset = {}) {
  const start = resolveWarrantyStartDate(asset);
  const months = resolveWarrantyMonths(asset);
  if (start && months) {
    return addMonthsToIsoDate(start, months);
  }
  return parseFlexibleDate(asset.warrantyExpiry) || null;
}

/**
 * @param {object} asset
 * @returns {string|null}
 */
export function resolveWarrantyText(asset = {}) {
  const text =
    asset.warrantyText ||
    asset.invoiceMeta?.warrantyText ||
    asset.ocrExtract?.warrantyText ||
    '';
  return String(text || '').trim() || null;
}

export default {
  addMonthsToIsoDate,
  resolveWarrantyStartDate,
  resolveWarrantyMonths,
  resolveCanonicalWarrantyExpiry,
  resolveWarrantyText,
};

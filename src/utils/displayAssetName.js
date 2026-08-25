/**
 * Clean display titles — strip trailing raw IDs / chassis fragments from vehicle names.
 * Registration / number plate stays on a separate field for UI.
 * Never show empty / IMEI / address strings as the main asset header.
 */

import {
  isAddressLikeText,
  isImeiOrSerialTitle,
  resolveAssetDisplayTitle,
} from './productNameSanitizer';

const TRAILING_ID = /\s+(?:#?\d{3,}|(?:[A-Z]{1,3}\s*)?\d{4,}|\bVIN\b.*|\bCH\s*\d+)\s*$/i;
const PLATE_IN_NAME =
  /\b([A-Z]{2}\s*-?\s*\d{1,2}\s*-?\s*[A-Z]{0,3}\s*-?\s*\d{3,4})\b/i;

/**
 * @param {string} rawName
 * @param {{ registration?: string, categoryLabel?: string, smartCategory?: string, purchaseCategory?: string, categoryId?: string, category?: string }} [opts]
 * @returns {string}
 */
export function cleanAssetDisplayName(rawName, opts = {}) {
  let name = String(rawName || '').trim().replace(/\s+/g, ' ');

  if (!name || isImeiOrSerialTitle(name) || isAddressLikeText(name)) {
    return resolveAssetDisplayTitle(
      {
        assetName: name,
        categoryLabel: opts.categoryLabel,
        smartCategory: opts.smartCategory,
        purchaseCategory: opts.purchaseCategory,
        categoryId: opts.categoryId,
        category: opts.category,
      },
      { rawName: name },
    );
  }

  const plate = String(opts.registration || '')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (plate && name.replace(/\s+/g, '').toUpperCase().includes(plate)) {
    name = name
      .replace(new RegExp(plate.split('').join('\\s*'), 'i'), ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  name = name.replace(PLATE_IN_NAME, ' ').replace(/\s+/g, ' ').trim();

  let prev = '';
  while (name !== prev) {
    prev = name;
    name = name.replace(TRAILING_ID, '').trim();
  }

  // Strip naked IMEI embedded in title
  name = name.replace(/\b\d{15}\b/g, '').replace(/\s+/g, ' ').trim();

  if (name.length > 2 && name === name.toUpperCase() && /[A-Z]/.test(name)) {
    name = name
      .toLowerCase()
      .split(' ')
      .map((w) =>
        w.length <= 3 && /^(tvs|bmw|mg|skoda|kia)$/i.test(w)
          ? w.toUpperCase()
          : w.charAt(0).toUpperCase() + w.slice(1),
      )
      .join(' ');
    name = name.replace(/\bTvs\b/g, 'TVS').replace(/\bBmw\b/g, 'BMW');
  }

  if (!name || isImeiOrSerialTitle(name) || isAddressLikeText(name)) {
    return resolveAssetDisplayTitle(
      {
        assetName: String(rawName || '').trim(),
        categoryLabel: opts.categoryLabel,
        smartCategory: opts.smartCategory,
        purchaseCategory: opts.purchaseCategory,
        categoryId: opts.categoryId,
        category: opts.category,
      },
      { rawName },
    );
  }

  return name;
}

export function formatRegistrationDisplay(registration) {
  const raw = String(registration || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!raw) return '';
  const m = raw.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{3,4})$/);
  if (!m) return String(registration || '').trim().toUpperCase();
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ');
}

export { resolveAssetDisplayTitle };

export default { cleanAssetDisplayName, formatRegistrationDisplay, resolveAssetDisplayTitle };

/**
 * Derive PolicyBazaar-style vehicle spec fields from asset + plate.
 */

import { normalizeRegistration } from './vehicleFolder';

/**
 * Extract RTO code from Indian plate (e.g. MH12AB1234 → MH12).
 * @param {string} [registration]
 * @returns {string}
 */
export function extractRtoCode(registration) {
  const raw = normalizeRegistration(registration).replace(/\s+/g, '');
  if (!raw || raw.length < 4) return '';
  const match = raw.match(/^([A-Z]{2})(\d{1,2})/);
  if (!match) return raw.slice(0, 4).toUpperCase();
  return `${match[1]}${match[2]}`.toUpperCase();
}

/**
 * Space-format Indian plate for display (MH12AB1234 → MH 12 AB 1234).
 * @param {string} [registration]
 */
export function formatIndiaPlate(registration) {
  const raw = normalizeRegistration(registration).replace(/\s+/g, '').toUpperCase();
  if (!raw) return '';
  const m = raw.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  if (!m) return raw;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ');
}

/**
 * @param {object} asset
 */
export function getVehicleSpecs(asset = {}) {
  const registration = asset.registration || '';
  const rto =
    String(asset.rtoCode || asset.rto || '').trim() || extractRtoCode(registration) || '—';
  const fuelNorm =
    String(asset.fuelNorm || asset.emissionNorm || asset.fuelType || '').trim() || '—';
  const chassis = String(asset.chassisNumber || asset.vin || '').trim() || '—';
  return {
    rto,
    fuelNorm,
    chassis,
    registration: formatIndiaPlate(registration) || registration || '—',
    rawRegistration: registration,
  };
}

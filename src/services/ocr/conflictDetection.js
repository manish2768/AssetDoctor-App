/**
 * Cross-document conflict flags. Never silently overwrite trusted asset data.
 */

import { compactPlate, isIndianPlateToken } from './semanticFieldFinder';
import { FIELD_STATUS, makeField } from './fieldStatus';

function normId(v) {
  return String(v || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function filled(v) {
  return v != null && String(v).trim() !== '';
}

function similarEnough(a, b) {
  const x = normId(a);
  const y = normId(b);
  if (!x || !y) return true;
  return x === y;
}

const CHECKS = [
  ['registration', 'registration', 'vehicleRegistrationNumber'],
  ['vehicleMake', 'brandName', 'vehicleMake'],
  ['vehicleModel', 'model', 'vehicleModel'],
  ['engineNumber', 'engineNumber', 'engineNumber'],
  ['chassisNumber', 'chassisNumber', 'chassisNumber'],
];

/**
 * @param {object} existing trusted asset
 * @param {object} incoming OCR / review payload
 * @returns {{ conflicts: object[], fieldStatusPatch: object }}
 */
export function detectAssetFieldConflicts(existing = {}, incoming = {}) {
  const conflicts = [];
  const fieldStatusPatch = {};
  if (!existing || !incoming) return { conflicts, fieldStatusPatch };

  const existingReg = compactPlate(existing.registration);
  const incomingReg = compactPlate(incoming.registration);
  if (isIndianPlateToken(existingReg) && isIndianPlateToken(incomingReg) && existingReg !== incomingReg) {
    const reason = `Possible mismatch detected. Existing asset data: ${existingReg}. New document: ${incomingReg}. Please verify.`;
    conflicts.push({
      field: 'registration',
      existing: existingReg,
      incoming: incomingReg,
      reason,
    });
    fieldStatusPatch.registration = makeField(incomingReg, {
      confidence: 0.4,
      source: 'OCR',
      reason,
      validationStatus: FIELD_STATUS.CONFLICT,
    });
  }

  for (const [statusKey, existKey, inKey] of CHECKS) {
    if (statusKey === 'registration') continue;
    const prev = existing[existKey] || existing[statusKey];
    const next = incoming[inKey] || incoming[existKey] || incoming[statusKey];
    if (!filled(prev) || !filled(next)) continue;
    if (similarEnough(prev, next)) continue;
    const reason = `Possible mismatch detected. Existing asset data: ${prev}. New document: ${next}. Please verify.`;
    conflicts.push({ field: statusKey, existing: prev, incoming: next, reason });
    fieldStatusPatch[statusKey] = makeField(next, {
      confidence: 0.4,
      source: 'OCR',
      reason,
      validationStatus: FIELD_STATUS.CONFLICT,
    });
  }

  const prevKm = existing.odometerKm != null ? Number(existing.odometerKm) : null;
  const nextKm =
    incoming.odometerKm != null
      ? Number(incoming.odometerKm)
      : incoming.odometerReading != null
        ? Number(incoming.odometerReading)
        : null;
  if (prevKm != null && nextKm != null && Number.isFinite(prevKm) && Number.isFinite(nextKm) && nextKm + 50 < prevKm) {
    const reason = `Possible mismatch detected. Existing odometer: ${prevKm} km. New document: ${nextKm} km. Please verify.`;
    conflicts.push({ field: 'odometerReading', existing: prevKm, incoming: nextKm, reason });
    fieldStatusPatch.odometerReading = makeField(nextKm, {
      confidence: 0.4,
      source: 'OCR',
      reason,
      validationStatus: FIELD_STATUS.CONFLICT,
    });
  }

  return { conflicts, fieldStatusPatch };
}

/**
 * Skip OCR overwrite when the existing value is user_verified.
 */
export function shouldPreserveUserVerified(existingSources = {}, field) {
  const src = existingSources[field];
  if (!src) return false;
  if (typeof src === 'string') return src === 'user_verified';
  return src.source === 'user_verified' || src.validationStatus === 'user_verified';
}

export default {
  detectAssetFieldConflicts,
  shouldPreserveUserVerified,
};

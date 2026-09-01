/**
 * Fuel & Mileage — single source of truth for mileage-health verdict thresholds
 * and vehicle-type resolution. Kept separate from UI/calculation so thresholds
 * are configurable in exactly one place.
 *
 * NOTE: This is intentionally a `.js` barrel of pure constants/helpers so it can
 * be imported from both UI components and node-side tests. Type annotations live
 * in src/types/fuelTypes.ts.
 */

/** Thresholds grouped by vehicle family (km per litre). */
export const MILEAGE_THRESHOLDS = Object.freeze({
  CAR: Object.freeze({ excellentFrom: 18, averageFrom: 12 }),
  COMMERCIAL: Object.freeze({ excellentFrom: 10, averageFrom: 7 }),
  SCOOTER: Object.freeze({ excellentFrom: 45, averageFrom: 30 }),
  BIKE: Object.freeze({ excellentFrom: 45, averageFrom: 30 }),
  // Safe generic fallback when the vehicle type cannot be determined.
  OTHER: Object.freeze({ excellentFrom: 18, averageFrom: 12 }),
});

/** Maximum plausible mileage before flagging corrupted data (km/L). */
export const MAX_PLAUSIBLE_MILEAGE = 250;

/**
 * Resolve the fuel vehicle type from an asset's known fields.
 * Prefers explicit taxonomy fields, then categoryId heuristics.
 *
 * @param {object} asset
 * @returns {string} one of CAR | BIKE | SCOOTER | COMMERCIAL | OTHER
 */
export function resolveFuelVehicleType(asset = {}) {
  const vehicleType = String(asset.vehicleType || asset.subcategory || '').toUpperCase();
  if (['CAR', 'BIKE', 'SCOOTER', 'COMMERCIAL'].includes(vehicleType)) {
    return vehicleType;
  }

  const categoryId = String(asset.categoryId || '').toLowerCase();
  const name = String(asset.assetName || asset.model || '').toLowerCase();
  const text = `${categoryId} ${name}`;

  if (/scooter|activa|jupiter|ather|ola\s*s/.test(text)) return 'SCOOTER';
  if (/bike|motorcycle|pulsar|ronin|classic\s*350|hunter\s*350|bullet|fz|mt-15|gt\s*650|ninja/.test(text)) {
    return 'BIKE';
  }
  if (/car|suv|sedan|hatchback|cab|nexon|creta|hyundai|hybrid/.test(text)) return 'CAR';
  if (/truck|tempo|commercial|autowala|mini\s*truck/.test(text)) return 'COMMERCIAL';
  return 'OTHER';
}

/**
 * Return the threshold set for a vehicle type (always present due to OTHER).
 * @param {string} vehicleType
 */
export function thresholdsForVehicleType(vehicleType) {
  return MILEAGE_THRESHOLDS[vehicleType] || MILEAGE_THRESHOLDS.OTHER;
}

/**
 * Compute a mileage verdict for a (valid, non-null) mileage value.
 *
 * @param {number|null} mileage km/L
 * @param {string} vehicleType
 * @returns {{rank:string,label:string,emoji:string,thresholds:object}|null}
 */
export function mileageVerdict(mileage, vehicleType = 'OTHER') {
  const numeric = Number(mileage);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const thresholds = thresholdsForVehicleType(vehicleType);

  if (numeric >= thresholds.excellentFrom) {
    return {
      rank: 'excellent',
      label: 'Excellent Mileage',
      emoji: '🟢',
      thresholds,
    };
  }
  if (numeric >= thresholds.averageFrom) {
    return {
      rank: 'average',
      label: 'Average Mileage',
      emoji: '🟡',
      thresholds,
    };
  }
  return { rank: 'low', label: 'Low Mileage', emoji: '🔴', thresholds };
}

export default {
  MILEAGE_THRESHOLDS,
  MAX_PLAUSIBLE_MILEAGE,
  resolveFuelVehicleType,
  thresholdsForVehicleType,
  mileageVerdict,
};

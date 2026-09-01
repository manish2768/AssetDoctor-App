/**
 * ASSET DOCTOR — VEHICLE IDENTITY VALIDATOR (OCR PIPELINE V2)
 * Normalizes Indian registration numbers, cross-validates chassis/engine/VIN,
 * and calculates identity confidence against existing vehicle profiles.
 */

export interface VehicleIdentityMatchResult {
  isMatch: boolean;
  identityConfidence: number; // 0.0 to 1.0
  updateAllowed: boolean;
  matchReasons: string[];
  mismatchWarnings: string[];
  normalizedRegistration: string | null;
  status: 'EXACT_MATCH' | 'HIGH_CONFIDENCE_MATCH' | 'POTENTIAL_MISMATCH' | 'NO_EXISTING_ASSET';
}

/**
 * Normalizes Indian registration format.
 * Examples:
 *   "UP 32 AB 1234" -> "UP32AB1234"
 *   "DL-01-C-9999" -> "DL01C9999"
 *   "MH02.BZ.5555" -> "MH02BZ5555"
 */
export function normalizeIndianRegistration(rawReg?: string | null): string | null {
  if (!rawReg || typeof rawReg !== 'string') return null;
  const cleaned = rawReg.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned || cleaned.length < 5 || cleaned.length > 13) return null;

  // Standard Indian Reg Pattern: State (2 chars) + RTO Code (1-2 digits) + Series (0-3 chars) + Number (4 digits)
  // E.g. UP32AB1234, DL1C9999, KA05MH1111, 22BH1234A (BH series)
  const isStandard =
    /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(cleaned) ||
    /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(cleaned); // Bharat series

  return isStandard ? cleaned : cleaned;
}

export function validateVehicleIdentity(
  documentOcr: {
    vehicleRegistrationNumber?: string | null;
    chassisNumber?: string | null;
    engineNumber?: string | null;
    vin?: string | null;
    vehicleMake?: string | null;
    vehicleModel?: string | null;
  },
  existingAsset?: {
    registrationNumber?: string | null;
    chassisNumber?: string | null;
    engineNumber?: string | null;
    vin?: string | null;
    make?: string | null;
    model?: string | null;
    name?: string | null;
  } | null
): VehicleIdentityMatchResult {
  const docReg = normalizeIndianRegistration(documentOcr.vehicleRegistrationNumber);
  const docChassis = (documentOcr.chassisNumber || documentOcr.vin || '').toUpperCase().trim();
  const docEngine = (documentOcr.engineNumber || '').toUpperCase().trim();

  if (!existingAsset) {
    return {
      isMatch: true,
      identityConfidence: docReg ? 0.95 : 0.7,
      updateAllowed: true,
      matchReasons: ['New vehicle document — no existing asset to match against.'],
      mismatchWarnings: [],
      normalizedRegistration: docReg,
      status: 'NO_EXISTING_ASSET',
    };
  }

  const assetReg = normalizeIndianRegistration(
    existingAsset.registrationNumber || existingAsset.name
  );
  const assetChassis = (existingAsset.chassisNumber || existingAsset.vin || '').toUpperCase().trim();
  const assetEngine = (existingAsset.engineNumber || '').toUpperCase().trim();

  const matchReasons: string[] = [];
  const mismatchWarnings: string[] = [];
  let score = 0;
  let maxPossibleScore = 0;

  // 1. Registration Number Comparison (Weight: 50)
  if (docReg && assetReg) {
    maxPossibleScore += 50;
    if (docReg === assetReg) {
      score += 50;
      matchReasons.push(`Registration number exact match (${docReg}).`);
    } else {
      mismatchWarnings.push(
        `Registration mismatch: Document has "${docReg}", Asset has "${assetReg}".`
      );
    }
  }

  // 2. Chassis / VIN Comparison (Weight: 30)
  if (docChassis && assetChassis) {
    maxPossibleScore += 30;
    if (docChassis === assetChassis || docChassis.endsWith(assetChassis) || assetChassis.endsWith(docChassis)) {
      score += 30;
      matchReasons.push(`Chassis/VIN match (${docChassis}).`);
    } else {
      mismatchWarnings.push(
        `Chassis number mismatch: Document has "${docChassis}", Asset has "${assetChassis}".`
      );
    }
  }

  // 3. Engine Number Comparison (Weight: 20)
  if (docEngine && assetEngine) {
    maxPossibleScore += 20;
    if (docEngine === assetEngine) {
      score += 20;
      matchReasons.push(`Engine number match (${docEngine}).`);
    } else {
      mismatchWarnings.push(
        `Engine number mismatch: Document has "${docEngine}", Asset has "${assetEngine}".`
      );
    }
  }

  // Calculate normalized confidence score
  const identityConfidence = maxPossibleScore > 0 ? Math.round((score / maxPossibleScore) * 100) / 100 : 0.5;

  const isMatch = identityConfidence >= 0.85;
  const updateAllowed = isMatch && mismatchWarnings.length === 0;

  let status: VehicleIdentityMatchResult['status'] = 'POTENTIAL_MISMATCH';
  if (identityConfidence >= 0.95) status = 'EXACT_MATCH';
  else if (identityConfidence >= 0.85) status = 'HIGH_CONFIDENCE_MATCH';

  return {
    isMatch,
    identityConfidence,
    updateAllowed,
    matchReasons,
    mismatchWarnings,
    normalizedRegistration: docReg,
    status,
  };
}

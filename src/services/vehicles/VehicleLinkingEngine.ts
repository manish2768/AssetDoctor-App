/**
 * Vehicle Linking Engine — Safe Vehicle Passport Resolution & Multi-Field Corroboration.
 *
 * Implements strict priority matching for Insurance & PUC documents:
 * 1. Exact Registration Plate Match (Highest Priority)
 * 2. Exact Full Chassis / VIN Match
 * 3. Exact Full Engine Number Match
 * 4. Suffix Match (Last 4-6 digits) with Mandatory Corroboration:
 *    - Rejects ambiguous matches if multiple vehicles share the suffix.
 *    - Validates against vehicle make/model/registration.
 *    - Blocks auto-link on conflicting vehicle details.
 * 5. Safe Fallback / Manual Selection Prompt.
 */

import {
  listVehicleAssets,
  normalizeChassis,
  normalizeRegistration,
} from '../../utils/vehicleFolder';

export interface VehicleMatchCandidate {
  registrationNumber?: string;
  chassisNumber?: string;
  engineNumber?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  ownerName?: string;
}

export type VehicleLinkingStatus =
  | 'EXACT_MATCH'
  | 'SUFFIX_CORROBORATED'
  | 'AMBIGUOUS'
  | 'CONFLICT'
  | 'UNCONFIRMED_CANDIDATE'
  | 'NO_MATCH';

export interface VehicleLinkingResult {
  status: VehicleLinkingStatus;
  matchedVehicle?: any;
  matchField?: 'REGISTRATION' | 'CHASSIS' | 'ENGINE' | 'SUFFIX_CORROBORATED';
  confidence: number;
  candidates: any[];
  reason: string;
}

export class VehicleLinkingEngine {
  public static resolveVehicleLink(
    candidate: VehicleMatchCandidate,
    allAssets: any[] = [],
  ): VehicleLinkingResult {
    const vehicles = listVehicleAssets(allAssets) || [];

    if (!vehicles || vehicles.length === 0) {
      return {
        status: 'NO_MATCH',
        confidence: 0,
        candidates: [],
        reason: 'No existing vehicles found in user vault',
      };
    }

    const normReg = normalizeRegistration(candidate.registrationNumber);
    const normChassis = normalizeChassis(candidate.chassisNumber);
    const normEngine = normalizeChassis(candidate.engineNumber);

    const docMake = (candidate.vehicleMake || '').trim().toLowerCase();
    const docModel = (candidate.vehicleModel || '').trim().toLowerCase();
    const docOwner = (candidate.ownerName || '').trim().toLowerCase();

    // 1. EXACT REGISTRATION MATCH
    if (normReg && normReg.length >= 6) {
      const match = vehicles.find((v) => {
        const vReg = normalizeRegistration(v.registration);
        return vReg && vReg === normReg;
      });
      if (match) {
        return {
          status: 'EXACT_MATCH',
          matchedVehicle: match,
          matchField: 'REGISTRATION',
          confidence: 1.0,
          candidates: [match],
          reason: `Exact vehicle registration plate match: "${match.registration || normReg}"`,
        };
      }
    }

    // 2. EXACT FULL CHASSIS MATCH (Length >= 8)
    if (normChassis && normChassis.length >= 8) {
      const match = vehicles.find((v) => {
        const vChassis = normalizeChassis(v.chassisNumber);
        return vChassis && vChassis === normChassis;
      });
      if (match) {
        return {
          status: 'EXACT_MATCH',
          matchedVehicle: match,
          matchField: 'CHASSIS',
          confidence: 0.98,
          candidates: [match],
          reason: `Exact chassis / VIN match: "${normChassis}"`,
        };
      }
    }

    // 3. EXACT FULL ENGINE MATCH (Length >= 6)
    if (normEngine && normEngine.length >= 6) {
      const match = vehicles.find((v) => {
        const vEngine = normalizeChassis(v.engineNumber);
        return vEngine && vEngine === normEngine;
      });
      if (match) {
        return {
          status: 'EXACT_MATCH',
          matchedVehicle: match,
          matchField: 'ENGINE',
          confidence: 0.95,
          candidates: [match],
          reason: `Exact engine number match: "${normEngine}"`,
        };
      }
    }

    // 4. SUFFIX MATCHING (Last 4 to 6 characters of Chassis or Engine)
    const chassisSuffix = normChassis.length >= 4 ? normChassis.slice(-6) : '';
    const engineSuffix = normEngine.length >= 4 ? normEngine.slice(-6) : '';

    if (chassisSuffix || engineSuffix) {
      const suffixCandidates = vehicles.filter((v) => {
        const vChassis = normalizeChassis(v.chassisNumber);
        const vEngine = normalizeChassis(v.engineNumber);

        const chassisMatch =
          chassisSuffix &&
          vChassis &&
          vChassis.length >= chassisSuffix.length &&
          vChassis.endsWith(chassisSuffix);

        const engineMatch =
          engineSuffix &&
          vEngine &&
          vEngine.length >= engineSuffix.length &&
          vEngine.endsWith(engineSuffix);

        return chassisMatch || engineMatch;
      });

      // AMBIGUITY SAFEGUARD: Multiple vehicles share same suffix -> NEVER auto-link!
      if (suffixCandidates.length > 1) {
        return {
          status: 'AMBIGUOUS',
          confidence: 0.4,
          candidates: suffixCandidates,
          reason: `Multiple vehicles (${suffixCandidates.length}) match identifier suffix "${chassisSuffix || engineSuffix}". Manual selection required.`,
        };
      }

      // Exactly ONE suffix candidate -> CORROBORATE
      if (suffixCandidates.length === 1) {
        const single = suffixCandidates[0];
        const vName = (single.name || single.assetName || '').toLowerCase();
        const vBrand = (single.brand || single.brandName || '').toLowerCase();
        const vReg = normalizeRegistration(single.registration);

        // Check for conflicting vehicle make (e.g. document says Hyundai, vehicle is TVS)
        if (docMake && vBrand && !vBrand.includes(docMake) && !docMake.includes(vBrand)) {
          return {
            status: 'CONFLICT',
            candidates: [single],
            confidence: 0.3,
            reason: `Suffix matches vehicle "${single.name || single.registration}", but brand conflict detected: document make "${candidate.vehicleMake}" vs vehicle brand "${single.brand}".`,
          };
        }

        // Corroborate: Reg match OR Make/Model containment OR Owner match
        const regCorroborated = normReg && vReg && normReg === vReg;
        const makeModelCorroborated =
          (docMake && (vName.includes(docMake) || vBrand.includes(docMake))) ||
          (docModel && vName.includes(docModel));
        const ownerCorroborated =
          docOwner &&
          single.ownerName &&
          single.ownerName.toLowerCase().includes(docOwner);

        if (regCorroborated || makeModelCorroborated || ownerCorroborated) {
          return {
            status: 'SUFFIX_CORROBORATED',
            matchedVehicle: single,
            matchField: 'SUFFIX_CORROBORATED',
            confidence: 0.90,
            candidates: [single],
            reason: `Suffix "${chassisSuffix || engineSuffix}" safely corroborated by ${
              regCorroborated
                ? 'registration plate'
                : makeModelCorroborated
                ? 'vehicle make/model'
                : 'owner name'
            } for "${single.name || single.registration}".`,
          };
        }

        // Suffix matches single vehicle, but no corroborating evidence found
        return {
          status: 'UNCONFIRMED_CANDIDATE',
          matchedVehicle: single,
          confidence: 0.65,
          candidates: [single],
          reason: `Identifier suffix matches "${single.name || single.registration}", but no corroborating make/model found. Confirmation recommended.`,
        };
      }
    }

    // 5. NO CONFIDENT MATCH
    return {
      status: 'NO_MATCH',
      confidence: 0,
      candidates: vehicles,
      reason: 'No matching vehicle found in user vault.',
    };
  }
}

/**
 * Asset Doctor — Duplicate Asset Protection Service
 * Identifies potential duplicate asset creation and suggests actions without silent merging.
 */

import type { Asset } from '../types';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingAsset?: Asset;
  matchField?: 'EXACT_NAME' | 'BRAND_MODEL' | 'SERIAL_NUMBER' | 'REGISTRATION';
  reason?: string;
}

export class DuplicateProtectionService {
  /**
   * Check if a candidate asset matches any existing assets in user's vault
   */
  public static checkForDuplicate(
    candidate: Partial<Asset>,
    existingAssets: Asset[]
  ): DuplicateCheckResult {
    if (!existingAssets || existingAssets.length === 0) {
      return { isDuplicate: false };
    }

    const cleanCandidateName = (candidate.name || '').trim().toLowerCase();
    const cleanCandidateBrand = (candidate.brand || '').trim().toLowerCase();
    const cleanCandidateSerial = (candidate.serialNumber || '').trim().toLowerCase();
    const cleanCandidateReg = (candidate.registration || candidate.serialNumber || '').trim().toLowerCase();

    // 1. Serial Number / Chassis Number Exact Match
    if (cleanCandidateSerial && cleanCandidateSerial.length >= 4) {
      const match = existingAssets.find(
        a => (a.serialNumber && a.serialNumber.trim().toLowerCase() === cleanCandidateSerial) ||
             (a.registration && a.registration.trim().toLowerCase() === cleanCandidateSerial)
      );
      if (match) {
        return {
          isDuplicate: true,
          existingAsset: match,
          matchField: 'SERIAL_NUMBER',
          reason: `An asset with matching identifier "${match.serialNumber || match.registration}" already exists in your Vault.`
        };
      }
    }

    // 2. Vehicle Registration Match
    if (cleanCandidateReg && cleanCandidateReg.length >= 4) {
      const match = existingAssets.find(
        a => a.registration && a.registration.trim().toLowerCase() === cleanCandidateReg
      );
      if (match) {
        return {
          isDuplicate: true,
          existingAsset: match,
          matchField: 'REGISTRATION',
          reason: `A vehicle with registration number "${match.registration}" already exists in your Vault.`
        };
      }
    }

    // 3. Exact Name Match (case-insensitive)
    if (cleanCandidateName && cleanCandidateName.length >= 3) {
      const match = existingAssets.find(
        a => a.name.trim().toLowerCase() === cleanCandidateName
      );
      if (match) {
        return {
          isDuplicate: true,
          existingAsset: match,
          matchField: 'EXACT_NAME',
          reason: `You already have an asset named "${match.name}" in your Vault.`
        };
      }
    }

    // 4. Brand + Model Match
    if (cleanCandidateBrand && cleanCandidateName && cleanCandidateBrand.length >= 2) {
      const match = existingAssets.find(a => {
        const brandMatch = (a.brand || '').trim().toLowerCase() === cleanCandidateBrand;
        const nameContains = a.name.trim().toLowerCase().includes(cleanCandidateName) ||
                             cleanCandidateName.includes(a.name.trim().toLowerCase());
        return brandMatch && nameContains;
      });
      if (match) {
        return {
          isDuplicate: true,
          existingAsset: match,
          matchField: 'BRAND_MODEL',
          reason: `A similar ${match.brand} item ("${match.name}") already exists in your Vault.`
        };
      }
    }

    return { isDuplicate: false };
  }
}

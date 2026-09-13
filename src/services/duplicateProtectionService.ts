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

  /**
   * Check if an insurance policy already exists for the target vehicle
   */
  public static checkInsuranceDuplicate(
    policyNumber: string,
    targetVehicle: any,
    existingDocs: any[] = [],
  ): DuplicateCheckResult {
    const cleanPolicy = String(policyNumber || '').trim().toUpperCase();
    if (!cleanPolicy || cleanPolicy.length < 4) {
      return { isDuplicate: false };
    }

    // Check if vehicle itself already has this exact policy number
    const vehiclePolicy = String(
      targetVehicle?.insurancePolicyNumber ||
      targetVehicle?.policyNumber ||
      targetVehicle?.insurance?.policyNumber ||
      ''
    ).trim().toUpperCase();

    if (vehiclePolicy && vehiclePolicy === cleanPolicy) {
      return {
        isDuplicate: true,
        existingAsset: targetVehicle,
        matchField: 'EXACT_NAME',
        reason: `Policy number "${cleanPolicy}" is already recorded on this vehicle.`,
      };
    }

    const docMatch = existingDocs.find(d => {
      const p = String(d.policyNumber || d.invoiceNumber || d.identifier || '').trim().toUpperCase();
      const vId = d.assetId || d.linkedAssetId;
      const targetId = targetVehicle?.assetId || targetVehicle?.id;
      return p === cleanPolicy && (!targetId || vId === targetId);
    });

    if (docMatch) {
      return {
        isDuplicate: true,
        matchField: 'EXACT_NAME',
        reason: `An insurance policy with number "${cleanPolicy}" already exists in your vault.`,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check if a PUC certificate already exists for the target vehicle
   */
  public static checkPucDuplicate(
    certificateNumber: string,
    targetVehicle: any,
    existingDocs: any[] = [],
  ): DuplicateCheckResult {
    const cleanCert = String(certificateNumber || '').trim().toUpperCase();
    if (!cleanCert || cleanCert.length < 4) {
      return { isDuplicate: false };
    }

    const vehicleCert = String(
      targetVehicle?.pucCertificateNumber ||
      targetVehicle?.certificateNumber ||
      targetVehicle?.puc?.certificateNumber ||
      ''
    ).trim().toUpperCase();

    if (vehicleCert && vehicleCert === cleanCert) {
      return {
        isDuplicate: true,
        existingAsset: targetVehicle,
        matchField: 'EXACT_NAME',
        reason: `PUC certificate "${cleanCert}" is already recorded on this vehicle.`,
      };
    }

    const docMatch = existingDocs.find(d => {
      const c = String(d.certificateNumber || d.invoiceNumber || d.identifier || '').trim().toUpperCase();
      const vId = d.assetId || d.linkedAssetId;
      const targetId = targetVehicle?.assetId || targetVehicle?.id;
      return c === cleanCert && (!targetId || vId === targetId);
    });

    if (docMatch) {
      return {
        isDuplicate: true,
        matchField: 'EXACT_NAME',
        reason: `A PUC certificate with number "${cleanCert}" already exists in your vault.`,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check if an electricity bill already exists for consumer & billing period
   */
  public static checkElectricityDuplicate(
    bill: { consumerNumber?: string; billingPeriod?: string; billDate?: string },
    existingBills: any[] = [],
  ): DuplicateCheckResult {
    const cleanConsumer = String(bill.consumerNumber || '').trim().toUpperCase();
    const cleanPeriod = String(bill.billingPeriod || bill.billDate || '').trim().toLowerCase();

    if (!cleanConsumer || !cleanPeriod) {
      return { isDuplicate: false };
    }

    const match = existingBills.find(b => {
      const bConsumer = String(b.consumerId || b.consumerNumber || '').trim().toUpperCase();
      const bPeriod = String(b.billingMonth || b.billingPeriod || b.billDate || '').trim().toLowerCase();
      return bConsumer === cleanConsumer && bPeriod === cleanPeriod;
    });

    if (match) {
      return {
        isDuplicate: true,
        reason: `Electricity bill for consumer "${cleanConsumer}" for period "${cleanPeriod}" already exists.`,
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check if a vehicle service bill already exists for the target vehicle
   */
  public static checkVehicleServiceDuplicate(
    invoiceNumber: string,
    serviceDate: string,
    targetVehicle: any,
  ): DuplicateCheckResult {
    const cleanInv = String(invoiceNumber || '').trim().toUpperCase();
    const cleanDate = String(serviceDate || '').trim();

    if (!targetVehicle || (!cleanInv && !cleanDate)) {
      return { isDuplicate: false };
    }

    const history: any[] = Array.isArray(targetVehicle.serviceHistory)
      ? targetVehicle.serviceHistory
      : [];

    const match = history.find((record) => {
      const recInv = String(record.serviceInvoiceNumber || record.invoiceNumber || '').trim().toUpperCase();
      const recDate = String(record.serviceDate || record.invoiceDate || '').trim();

      if (cleanInv && cleanInv.length >= 3 && recInv === cleanInv) {
        return true;
      }
      if (cleanDate && recDate === cleanDate && cleanInv && recInv === cleanInv) {
        return true;
      }
      return false;
    });

    if (match) {
      return {
        isDuplicate: true,
        existingAsset: targetVehicle,
        matchField: 'EXACT_NAME',
        reason: cleanInv
          ? `Service invoice "${cleanInv}" is already recorded on this vehicle.`
          : `A service record for date "${cleanDate}" already exists on this vehicle.`,
      };
    }

    return { isDuplicate: false };
  }
}

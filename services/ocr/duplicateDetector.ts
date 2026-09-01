/**
 * Document Duplicate Detection Engine
 * Computes deterministic document fingerprints to prevent duplicate uploads.
 */

import type {
  UniversalExtractedData,
  UniversalDocumentType,
  DuplicateCheckResult
} from './types.ts';

export interface VaultedDocumentRecord {
  id: string;
  assetId: string;
  documentType: UniversalDocumentType | string;
  fingerprint: string;
  invoiceNumber?: string;
  policyNumber?: string;
  certificateNumber?: string;
  documentDate?: string;
  imei?: string;
  serialNumber?: string;
  totalAmount?: number;
  registration?: string;
}

export class DuplicateDetector {
  /**
   * Generates a deterministic hash fingerprint from extracted document metadata.
   */
  public static computeFingerprint(
    docType: UniversalDocumentType,
    data: UniversalExtractedData,
    rawText: string
  ): string {
    const invNo = data.serviceData?.invoiceNumber?.value || data.purchaseData?.invoiceNumber?.value || '';
    const polNo = data.insuranceData?.policyNumber?.value || '';
    const certNo = data.pucData?.certificateNumber?.value || data.warrantyData?.warrantyNumber?.value || '';
    const reg = data.serviceData?.vehicleRegistration?.value ||
                data.insuranceData?.vehicleRegistration?.value ||
                data.pucData?.registrationNumber?.value ||
                data.rcData?.registrationNumber?.value || '';
    const date = data.serviceData?.invoiceDate?.value ||
                 data.insuranceData?.policyStartDate?.value ||
                 data.pucData?.issueDate?.value ||
                 data.purchaseData?.invoiceDate?.value || '';

    const primaryKey = [docType, invNo, polNo, certNo, reg, date].filter(Boolean).join('::');
    if (primaryKey.length > docType.length + 4) {
      return `FP_${primaryKey.replace(/[^A-Za-z0-9_\-\:]/g, '').toUpperCase()}`;
    }

    // Fallback: simplified content hash
    let hash = 0;
    const cleanText = rawText.replace(/\s+/g, '').substring(0, 500);
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `FP_HASH_${Math.abs(hash)}`;
  }

  /**
   * Checks if the document is a duplicate of an existing vaulted document.
   */
  public static checkDuplicate(
    docType: UniversalDocumentType,
    data: UniversalExtractedData,
    rawText: string,
    existingVaultedDocs: VaultedDocumentRecord[]
  ): DuplicateCheckResult {
    const fingerprint = this.computeFingerprint(docType, data, rawText);

    if (!existingVaultedDocs || existingVaultedDocs.length === 0) {
      return { isDuplicate: false, fingerprint };
    }

    const matched = existingVaultedDocs.find(
      (d) => d.fingerprint && fingerprint && d.fingerprint === fingerprint,
    );
    if (matched) {
      return {
        isDuplicate: true,
        duplicateDocumentId: matched.id,
        duplicateAssetId: matched.assetId,
        fingerprint,
        reason: `Duplicate document detected (Identical ${docType} "${matched.invoiceNumber || matched.policyNumber || matched.certificateNumber || matched.id}" already exists in vault).`
      };
    }

    const invNo = (data.serviceData?.invoiceNumber?.value || data.purchaseData?.invoiceNumber?.value || '').toUpperCase().replace(/\s+/g, '');
    const polNo = (data.insuranceData?.policyNumber?.value || '').toUpperCase().replace(/\s+/g, '');
    const imei = String(data.electronicsData?.imei?.value || '').replace(/\D/g, '');
    const serial = String(
      data.electronicsData?.serialNumber?.value || data.purchaseData?.serialNumber?.value || '',
    ).toUpperCase().replace(/\s+/g, '');
    const date = (
      data.serviceData?.invoiceDate?.value ||
      data.insuranceData?.policyStartDate?.value ||
      data.purchaseData?.invoiceDate?.value ||
      ''
    ).slice(0, 10);
    const amount = Number(
      data.serviceData?.totalAmount?.value ||
        data.purchaseData?.finalAmount?.value ||
        data.insuranceData?.premiumAmount?.value ||
        0,
    );
    const reg = String(
      data.serviceData?.vehicleRegistration?.value ||
        data.insuranceData?.vehicleRegistration?.value ||
        data.rcData?.registrationNumber?.value ||
        '',
    ).toUpperCase().replace(/[^A-Z0-9]/g, '');

    const identityHit = existingVaultedDocs.find((d) => {
      const dInv = String(d.invoiceNumber || '').toUpperCase().replace(/\s+/g, '');
      const dPol = String(d.policyNumber || '').toUpperCase().replace(/\s+/g, '');
      const dImei = String(d.imei || '').replace(/\D/g, '');
      const dSerial = String(d.serialNumber || '').toUpperCase().replace(/\s+/g, '');
      const dDate = String(d.documentDate || '').slice(0, 10);
      const dAmt = Number(d.totalAmount || 0);
      const dReg = String(d.registration || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (polNo && dPol && polNo === dPol) return true;
      if (imei.length === 15 && dImei.length === 15 && imei === dImei && date && dDate && date === dDate) {
        return true;
      }
      if (serial.length >= 6 && dSerial.length >= 6 && serial === dSerial && date && dDate && date === dDate) {
        return true;
      }
      if (
        invNo &&
        dInv &&
        invNo === dInv &&
        date &&
        dDate &&
        date === dDate &&
        amount > 0 &&
        dAmt > 0 &&
        Math.abs(amount - dAmt) < 1
      ) {
        return true;
      }
      if (
        invNo &&
        dInv &&
        invNo === dInv &&
        reg &&
        dReg &&
        reg === dReg &&
        date &&
        dDate &&
        date === dDate
      ) {
        return true;
      }
      return false;
    });

    if (identityHit) {
      return {
        isDuplicate: true,
        duplicateDocumentId: identityHit.id,
        duplicateAssetId: identityHit.assetId,
        fingerprint,
        reason: `Duplicate document identity already exists in vault (${identityHit.invoiceNumber || identityHit.policyNumber || identityHit.id}).`,
      };
    }

    return { isDuplicate: false, fingerprint };
  }
}

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
  documentType: UniversalDocumentType;
  fingerprint: string;
  invoiceNumber?: string;
  policyNumber?: string;
  certificateNumber?: string;
  documentDate?: string;
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

    const matched = existingVaultedDocs.find(d => d.fingerprint === fingerprint);
    if (matched) {
      return {
        isDuplicate: true,
        duplicateDocumentId: matched.id,
        duplicateAssetId: matched.assetId,
        fingerprint,
        reason: `Duplicate document detected (Identical ${docType} "${matched.invoiceNumber || matched.policyNumber || matched.certificateNumber || matched.id}" already exists in vault).`
      };
    }

    return { isDuplicate: false, fingerprint };
  }
}

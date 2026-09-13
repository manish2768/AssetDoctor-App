/**
 * Asset Doctor — Canonical Document Intelligence Types
 *
 * Defines the single canonical type system for document scanning,
 * classification, category-specific extraction, and review routing.
 */

export type AssetDocumentType =
  | 'VEHICLE_PURCHASE_INVOICE'
  | 'VEHICLE_SERVICE_BILL'
  | 'VEHICLE_INSURANCE'
  | 'VEHICLE_PUC'
  | 'ELECTRICITY_BILL'
  | 'OTHER_DOCUMENT'
  | 'UNKNOWN';

export type PipelineStage =
  | 'UPLOAD'
  | 'IMAGE_QUALITY'
  | 'OCR'
  | 'CLASSIFICATION'
  | 'EXTRACTION'
  | 'NORMALIZATION'
  | 'VALIDATION'
  | 'ROUTING'
  | 'DATABASE'
  | 'NETWORK'
  | 'UNKNOWN';

export interface FieldWithConfidence<T = any> {
  value: T;
  confidence: number; // 0.0 to 1.0
  isAutoPopulated: boolean; // confidence >= 0.85
  requiresReview: boolean; // confidence < 0.85
}

/**
 * Normalizes any raw/legacy document type string into canonical AssetDocumentType.
 */
export function normalizeToCanonicalDocType(raw?: string | null): AssetDocumentType {
  if (!raw || typeof raw !== 'string') return 'UNKNOWN';
  const clean = raw.trim().toUpperCase().replace(/[-\s]/g, '_');

  if (clean.includes('ELECTRICITY') || clean.includes('POWER_BILL') || clean.includes('ENERGY')) {
    return 'ELECTRICITY_BILL';
  }

  if (clean.includes('SERVICE') || clean.includes('JOB_CARD') || clean.includes('REPAIR') || clean === 'VEHICLE_SERVICE') {
    return 'VEHICLE_SERVICE_BILL';
  }

  if (clean.includes('INSURANCE') || clean.includes('POLICY') || clean === 'VEHICLE_INSURANCE') {
    return 'VEHICLE_INSURANCE';
  }

  if (clean.includes('PUC') || clean.includes('EMISSION') || clean.includes('POLLUTION') || clean === 'VEHICLE_PUC') {
    return 'VEHICLE_PUC';
  }

  if (clean.includes('VEHICLE_PURCHASE') || clean.includes('VEHICLE_INVOICE') || clean.includes('VEHICLE_SALE')) {
    return 'VEHICLE_PURCHASE_INVOICE';
  }

  if (clean.includes('INVOICE') || clean.includes('BILL') || clean.includes('RECEIPT') || clean.includes('PURCHASE')) {
    return 'VEHICLE_PURCHASE_INVOICE';
  }

  if (clean === 'OTHER_DOCUMENT' || clean === 'OTHER' || clean === 'GENERIC') {
    return 'OTHER_DOCUMENT';
  }

  return 'UNKNOWN';
}

/**
 * Maps a canonical document type to its dedicated navigation route.
 * ZERO silent fallback to Purchase Invoice!
 */
export function getRouteForCanonicalDocType(docType: AssetDocumentType): string {
  switch (docType) {
    case 'VEHICLE_SERVICE_BILL':
      return 'ReviewVehicleService';
    case 'VEHICLE_INSURANCE':
      return 'ReviewInsurance';
    case 'VEHICLE_PUC':
      return 'ReviewPuc';
    case 'ELECTRICITY_BILL':
      return 'ReviewElectricityBill';
    case 'OTHER_DOCUMENT':
    case 'UNKNOWN':
      return 'ReviewGenericDocument';
    case 'VEHICLE_PURCHASE_INVOICE':
    default:
      return 'ReviewAsset';
  }
}

/**
 * User-friendly display label for canonical document types.
 */
export function getCanonicalDocTypeLabel(docType: AssetDocumentType): string {
  switch (docType) {
    case 'VEHICLE_SERVICE_BILL':
      return 'Vehicle Service Bill';
    case 'VEHICLE_INSURANCE':
      return 'Vehicle Insurance Policy';
    case 'VEHICLE_PUC':
      return 'PUC Certificate';
    case 'ELECTRICITY_BILL':
      return 'Electricity Bill';
    case 'VEHICLE_PURCHASE_INVOICE':
      return 'Purchase Bill / Invoice';
    case 'OTHER_DOCUMENT':
      return 'Other Document';
    case 'UNKNOWN':
    default:
      return 'Unknown Document';
  }
}

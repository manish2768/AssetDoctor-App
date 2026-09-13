/**
 * Asset Doctor — Canonical Asset Document Domain Types
 *
 * Exclusively focused on Personal Asset & Warranty Management.
 * Zero accounting/tax/ledger clutter.
 */

export type DocumentCategory =
  | 'ELECTRONICS'
  | 'VEHICLE'
  | 'HOME_APPLIANCE'
  | 'INSURANCE'
  | 'GENERAL_BILL';

export type WarrantySource = 'EXTRACTED' | 'DERIVED' | 'NOT_FOUND';

export interface BaseAssetFields {
  invoiceNumber?: string;
  merchantName?: string;
  purchaseDate?: string; // Strictly YYYY-MM-DD
  totalAmount?: number;
  currency?: string; // Default: 'INR'
  confidenceScore: number; // 0.0 to 1.0
}

export interface ElectronicsFields {
  brand?: string;
  model?: string;
  serialNumber?: string;
  imei?: string;
  warrantyPeriodMonths?: number;
  warrantyExpiryDate?: string; // YYYY-MM-DD
  warrantySource?: WarrantySource;
}

export interface VehicleFields {
  make?: string;
  model?: string;
  vin?: string;
  engineNumber?: string;
  registrationNumber?: string;
  policyNumber?: string;
  insuranceExpiryDate?: string; // YYYY-MM-DD
  currentOdometerKm?: number;
}

export interface HomeApplianceFields {
  brand?: string;
  model?: string;
  serialNumber?: string;
  applianceType?: string;
  warrantyExpiryDate?: string; // YYYY-MM-DD
  warrantySource?: WarrantySource;
}

export interface InsuranceFields {
  providerName?: string;
  policyNumber?: string;
  policyType?: 'HEALTH' | 'MOTOR' | 'HOME' | 'TERM';
  startDate?: string; // YYYY-MM-DD
  expiryDate?: string; // YYYY-MM-DD
}

/**
 * Canonical, unified asset payload for personal asset tracking.
 * Contains ONLY AssetDoctor domain fields — zero GSTIN, CGST, SGST, IGST, HSN, etc.
 */
export interface UnifiedAssetPayload extends BaseAssetFields,
  ElectronicsFields,
  VehicleFields,
  HomeApplianceFields,
  InsuranceFields {
  assetName?: string;
  documentCategory: DocumentCategory;
  rawTextLength?: number;
  // Symmetrical review/display aliases (guarantees existing UI forms never break)
  productName?: string;
  storeName?: string;
  vendorName?: string;
  shopName?: string;
  price?: number;
  warrantyMonths?: number;
  warrantyExpiry?: string;
  insuranceExpiry?: string;
  registration?: string;
  chassisNumber?: string;
}

export interface OcrExtractionResponse {
  success: boolean;
  category: DocumentCategory;
  asset: UnifiedAssetPayload;
  rawText?: string;
  isReadable: boolean;
  isComplete: boolean;
  needsReview: boolean;
  warnings?: string[];
  provider?: string;
  executionTimeMs?: number;
}

/**
 * Strict allowlist of keys permitted in the structured UnifiedAssetPayload.
 * Prevents accidental re-introduction of accounting, tax, or unstructured metadata.
 */
export const ALLOWED_UNIFIED_ASSET_KEYS: ReadonlyArray<keyof UnifiedAssetPayload> = Object.freeze([
  'assetName',
  'documentCategory',
  'invoiceNumber',
  'merchantName',
  'purchaseDate',
  'totalAmount',
  'currency',
  'confidenceScore',
  'brand',
  'model',
  'serialNumber',
  'imei',
  'warrantyPeriodMonths',
  'warrantyExpiryDate',
  'warrantySource',
  'make',
  'vin',
  'engineNumber',
  'registrationNumber',
  'policyNumber',
  'insuranceExpiryDate',
  'currentOdometerKm',
  'applianceType',
  'providerName',
  'policyType',
  'startDate',
  'expiryDate',
  'rawTextLength',
  // Symmetrical UI aliases
  'productName',
  'storeName',
  'vendorName',
  'shopName',
  'price',
  'warrantyMonths',
  'warrantyExpiry',
  'insuranceExpiry',
  'registration',
  'chassisNumber',
]);

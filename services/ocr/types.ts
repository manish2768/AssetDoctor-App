/**
 * Universal OCR Intelligence & Document Classification Types
 * Covers all 13 Indian Automotive & Appliance Document Categories
 */

export type UniversalDocumentType =
  | 'SERVICE_INVOICE'
  | 'REPAIR_BILL'
  | 'INSURANCE_POLICY'
  | 'INSURANCE_RECEIPT'
  | 'INSURANCE_RENEWAL'
  | 'SERVICE_BOOK'
  | 'PUC_CERTIFICATE'
  | 'RC_CERTIFICATE'
  | 'PURCHASE_INVOICE'
  | 'VEHICLE_PURCHASE_INVOICE'
  | 'ELECTRONICS_PURCHASE_INVOICE'
  | 'APPLIANCE_PURCHASE_INVOICE'
  | 'OTHER_PURCHASE_DOCUMENT'
  | 'WARRANTY_DOCUMENT'
  | 'EXTENDED_WARRANTY'
  | 'AMC_CONTRACT'
  | 'APPLIANCE_INVOICE'
  | 'APPLIANCE_WARRANTY'
  | 'SALES_INVOICE'
  | 'OTHER'
  | 'UNKNOWN_DOCUMENT'
  | 'UNREADABLE_DOCUMENT'
  | 'GENERIC_DOCUMENT'
  | 'GENERIC_INVOICE'
  | 'UNKNOWN';

export type InsurancePolicyType =
  | 'COMPREHENSIVE'
  | 'THIRD_PARTY'
  | 'OWN_DAMAGE'
  | 'ZERO_DEPRECIATION'
  | 'ADD_ON_BUNDLE'
  | 'UNKNOWN';

export type VerificationConfidenceTier =
  | 'VERIFIED'           // >= 85%
  | 'HIGH_CONFIDENCE'    // 70% - 84%
  | 'NEEDS_REVIEW'       // < 70%
  | 'NEEDS_VERIFICATION' // Alias for backwards compat
  | 'NOT_FOUND'          // Explicitly not found on document
  | 'REJECTED';

export type FieldProvenance =
  | 'OCR_DOCUMENT'
  | 'OEM_DATABASE'
  | 'USER_ENTERED'
  | 'SYSTEM_CALCULATION';

export type FieldStatus =
  | 'AUTO_ACCEPTED'
  | 'VERIFIED'
  | 'HIGH_CONFIDENCE'
  | 'NEEDS_REVIEW'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'USER_VERIFIED';

export interface BoundingBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  page?: number;
}

export interface OdometerCandidate {
  value: number;
  sourceText: string;
  context: string;
  confidence: number;
  extractionMethod: string;
}

export interface ExtractedField<T> {
  value: T | null;
  normalizedValue?: T | null;
  confidence: number;       // 0.0 to 1.0
  rawText: string;
  /** Exact OCR span used for this value. Never use a value as its own evidence. */
  sourceText?: string | null;
  sourceLabel?: string;
  boundingBox?: BoundingBox;
  sourceBoundingBox?: BoundingBox | null;
  page?: number | null;
  evidenceType?:
    | 'explicit_label'
    | 'document_header'
    | 'table_cell'
    | 'contextual_text'
    | 'provider_consensus'
    | 'user_verified'
    | 'none';
  tier: VerificationConfidenceTier;
  status: FieldStatus;
  sourceType: FieldProvenance;
  provenance?: FieldProvenance;
  evidence?: string;
  extractionMethod?: string;
  flag?: string;            // Validation or anomaly note
  validationResult?: 'PASS' | 'FAIL' | 'UNVALIDATED';
  validationReason?: string;
  /** True when only a suffix/partial identifier was printed. */
  partialIdentifier?: boolean;
  conflictCandidates?: Array<{ value: T; sourceText?: string; confidence?: number }>;
  sourceDocumentId?: string;
  scanSessionId?: string;
}

export interface ClassificationResult {
  documentType: UniversalDocumentType;
  documentSubtype: string;
  confidence: number;
  matchedKeywords: string[];
  isLowConfidence: boolean;
  evidence?: string[];
  type?: UniversalDocumentType;
  subtype?: string;
}

export interface CrossFieldValidationIssue {
  field: string;
  severity: 'WARNING' | 'ERROR';
  rule: string;
  message: string;
  details?: Record<string, any>;
}

export interface CrossFieldValidationResult {
  isValid: boolean;
  score: number; // 0.0 to 1.0
  issues: CrossFieldValidationIssue[];
}

export interface ServiceInvoiceData {
  customerName?: ExtractedField<string>;
  customerPhone?: ExtractedField<string>;
  vehicleRegistration?: ExtractedField<string>;
  vehicleMake?: ExtractedField<string>;
  vehicleModel?: ExtractedField<string>;
  variant?: ExtractedField<string>;
  vinOrChassis?: ExtractedField<string>;
  engineNumber?: ExtractedField<string>;
  invoiceNumber?: ExtractedField<string>;
  invoiceDate?: ExtractedField<string>;
  serviceDate?: ExtractedField<string>;
  odometerKm?: ExtractedField<number>;
  nextServiceOdometerKm?: ExtractedField<number>;
  workshopName?: ExtractedField<string>;
  workshopAddress?: ExtractedField<string>;
  gstin?: ExtractedField<string>;
  serviceType?: ExtractedField<string>;
  labourCharges?: ExtractedField<number>;
  partsTotal?: ExtractedField<number>;
  consumablesTotal?: ExtractedField<number>;
  discountAmount?: ExtractedField<number>;
  taxAmount?: ExtractedField<number>;
  totalAmount?: ExtractedField<number>;
}

export interface InsurancePolicyData {
  insurerName?: ExtractedField<string>;
  policyNumber?: ExtractedField<string>;
  policyType?: ExtractedField<InsurancePolicyType>;
  insuredName?: ExtractedField<string>;
  insuredAddress?: ExtractedField<string>;
  vehicleRegistration?: ExtractedField<string>;
  vehicleMake?: ExtractedField<string>;
  vehicleModel?: ExtractedField<string>;
  vinOrChassis?: ExtractedField<string>;
  engineNumber?: ExtractedField<string>;
  policyStartDate?: ExtractedField<string>;
  policyExpiryDate?: ExtractedField<string>;
  idvAmount?: ExtractedField<number>;
  premiumAmount?: ExtractedField<number>;
  ncbPercentage?: ExtractedField<number>;
  zeroDepCover?: ExtractedField<boolean>;
  addOnCovers?: ExtractedField<string[]>;
}

export interface PucCertificateData {
  registrationNumber?: ExtractedField<string>;
  vehicleType?: ExtractedField<string>;
  fuelType?: ExtractedField<string>;
  certificateNumber?: ExtractedField<string>;
  issueDate?: ExtractedField<string>;
  expiryDate?: ExtractedField<string>;
  emissionValues?: ExtractedField<string>;
  testingCenterName?: ExtractedField<string>;
  certificateStatus?: ExtractedField<string>;
}

export interface RcCertificateData {
  registrationNumber?: ExtractedField<string>;
  ownerName?: ExtractedField<string>;
  vehicleClass?: ExtractedField<string>;
  maker?: ExtractedField<string>;
  model?: ExtractedField<string>;
  fuel?: ExtractedField<string>;
  registrationDate?: ExtractedField<string>;
  manufacturingDate?: ExtractedField<string>;
  chassisNumber?: ExtractedField<string>;
  engineNumber?: ExtractedField<string>;
  colour?: ExtractedField<string>;
  cubicCapacity?: ExtractedField<number>;
  seatingCapacity?: ExtractedField<number>;
  financier?: ExtractedField<string>;
  registrationValidity?: ExtractedField<string>;
}

export interface PurchaseInvoiceData {
  sellerName?: ExtractedField<string>;
  buyerName?: ExtractedField<string>;
  invoiceNumber?: ExtractedField<string>;
  invoiceDate?: ExtractedField<string>;
  assetName?: ExtractedField<string>;
  brand?: ExtractedField<string>;
  model?: ExtractedField<string>;
  serialNumber?: ExtractedField<string>;
  imei?: ExtractedField<string>;
  vehicleRegistration?: ExtractedField<string>;
  vinOrChassis?: ExtractedField<string>;
  engineNumber?: ExtractedField<string>;
  gstin?: ExtractedField<string>;
  purchasePrice?: ExtractedField<number>;
  taxableAmount?: ExtractedField<number>;
  taxAmount?: ExtractedField<number>;
  discountAmount?: ExtractedField<number>;
  finalAmount?: ExtractedField<number>;
  warrantyMonths?: ExtractedField<number>;
  warrantyStartDate?: ExtractedField<string>;
  warrantyEndDate?: ExtractedField<string>;
}

export interface WarrantyDocumentData {
  brand?: ExtractedField<string>;
  productName?: ExtractedField<string>;
  model?: ExtractedField<string>;
  serialNumber?: ExtractedField<string>;
  warrantyNumber?: ExtractedField<string>;
  warrantyStartDate?: ExtractedField<string>;
  warrantyEndDate?: ExtractedField<string>;
  customerName?: ExtractedField<string>;
  sellerName?: ExtractedField<string>;
  coverageTerms?: ExtractedField<string>;
  totalAmount?: ExtractedField<number>;
}

export interface ApplianceDocumentData {
  productName?: ExtractedField<string>;
  applianceType?: ExtractedField<string>;
  brand?: ExtractedField<string>;
  model?: ExtractedField<string>;
  serialNumber?: ExtractedField<string>;
  purchaseDate?: ExtractedField<string>;
  purchasePrice?: ExtractedField<number>;
  warrantyMonths?: ExtractedField<number>;
  warrantyExpiryDate?: ExtractedField<string>;
  sellerName?: ExtractedField<string>;
  invoiceNumber?: ExtractedField<string>;
}

export interface ElectronicsPurchaseData {
  productName?: ExtractedField<string>;
  brand?: ExtractedField<string>;
  model?: ExtractedField<string>;
  serialNumber?: ExtractedField<string>;
  imei?: ExtractedField<string>;
  invoiceNumber?: ExtractedField<string>;
  invoiceDate?: ExtractedField<string>;
  sellerName?: ExtractedField<string>;
  buyerName?: ExtractedField<string>;
  purchasePrice?: ExtractedField<number>;
  taxAmount?: ExtractedField<number>;
  totalAmount?: ExtractedField<number>;
  gstin?: ExtractedField<string>;
  warrantyMonths?: ExtractedField<number>;
  warrantyExpiry?: ExtractedField<string>;
}

export interface UniversalExtractedData {
  serviceData?: ServiceInvoiceData;
  insuranceData?: InsurancePolicyData;
  pucData?: PucCertificateData;
  rcData?: RcCertificateData;
  purchaseData?: PurchaseInvoiceData;
  warrantyData?: WarrantyDocumentData;
  applianceData?: ApplianceDocumentData;
  electronicsData?: ElectronicsPurchaseData;
  genericData?: Record<string, ExtractedField<any>>;
}

export interface EntityLinkCandidate {
  assetId: string;
  assetName: string;
  matchScore: number;
  matchedFields: string[];
  isExactMatch: boolean;
  status: 'EXACT_MATCH' | 'POSSIBLE_MATCH' | 'NO_MATCH';
}

export interface EntityLinkResult {
  matchedAssetId: string | null;
  confidence: number;
  matchType: 'EXACT_REGISTRATION' | 'EXACT_VIN' | 'EXACT_ENGINE' | 'EXACT_SERIAL' | 'EXACT_IMEI' | 'FUZZY_NAME' | 'USER_CONFIRMED' | 'NO_MATCH';
  isAutoLinked: boolean;
  notes: string;
  candidates: EntityLinkCandidate[];
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateDocumentId?: string;
  duplicateAssetId?: string;
  fingerprint: string;
  reason?: string;
}

export interface ProcessingMetrics {
  uploadToOcrMs: number;
  preprocessMs?: number;
  ocrDurationMs: number;
  classificationMs?: number;
  extractionDurationMs: number;
  validationDurationMs: number;
  assetMatchMs?: number;
  totalProcessingTimeMs: number;
  cacheHit?: boolean;
}

export interface CanonicalDocumentFields {
  documentNumber: ExtractedField<string>;
  documentDate: ExtractedField<string>;
  vendorName: ExtractedField<string>;
  vendorGSTIN: ExtractedField<string>;
  assetName: ExtractedField<string>;
  registrationNumber: ExtractedField<string>;
  serialNumber: ExtractedField<string>;
  imei: ExtractedField<string>;
  chassisNumber: ExtractedField<string>;
  engineNumber: ExtractedField<string>;
  odometerKm: ExtractedField<number>;
  nextServiceOdometerKm: ExtractedField<number>;
  nextServiceDate: ExtractedField<string>;
  policyStartDate: ExtractedField<string>;
  policyExpiryDate: ExtractedField<string>;
  warrantyExpiryDate: ExtractedField<string>;
  totalAmount: ExtractedField<number>;
  taxAmount: ExtractedField<number>;
  premium: ExtractedField<number>;
  idv: ExtractedField<number>;
  customerName: ExtractedField<string>;
  customerPhone: ExtractedField<string>;
}

export interface DocumentLineItem {
  name: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  serialNumber?: string;
  hsn?: string;
  category?: string;
  isFee?: boolean;
}

export interface DocumentResult {
  documentId: string;
  scanSessionId?: string;
  classification: ClassificationResult;
  sourceImage?: string | null;
  imageHash?: string | null;
  fields: CanonicalDocumentFields;
  lineItems: DocumentLineItem[];
  provenance: Record<string, FieldProvenance>;
  confidence: number;
  validation: CrossFieldValidationResult;
  assetMatch: EntityLinkResult;
  metrics: ProcessingMetrics;
  requiresReview: boolean;
  reviewReasons: string[];
  rawOcrText: string;
  createdAt: string;
  reviewInvoice?: Record<string, any>;
  reviewFamily?: string;
  cacheKey?: string;
}

export interface UniversalOcrDocumentResult extends DocumentResult {
  extractedData: UniversalExtractedData;
  duplicateCheck: DuplicateCheckResult;
  entityLink: EntityLinkResult;
  matchedAssetId?: string | null;
  matchType?: string | null;
}

export interface OcrReviewQueueItem {
  id: string;
  documentId: string;
  userId: string;
  assetId?: string;
  documentType: UniversalDocumentType;
  classificationConfidence: number;
  reviewReasons: string[];
  extractedFields: Record<string, any>;
  validationIssues: CrossFieldValidationIssue[];
  rawText: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CORRECTED';
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface OcrCorrectionLog {
  id: string;
  documentId: string;
  documentType: UniversalDocumentType;
  fieldName: string;
  originalValue: any;
  correctedValue: any;
  originalConfidence: number;
  correctedBy: string;
  correctedAt: string;
  notes?: string;
}

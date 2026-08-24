/**
 * Universal OCR Intelligence & Document Classification Types
 * Covers all 13 Indian Automotive & Appliance Document Categories
 */

export type UniversalDocumentType =
  | 'SERVICE_INVOICE'
  | 'REPAIR_BILL'
  | 'INSURANCE_POLICY'
  | 'INSURANCE_RENEWAL'
  | 'PUC_CERTIFICATE'
  | 'RC_CERTIFICATE'
  | 'PURCHASE_INVOICE'
  | 'WARRANTY_DOCUMENT'
  | 'EXTENDED_WARRANTY'
  | 'AMC_CONTRACT'
  | 'APPLIANCE_INVOICE'
  | 'APPLIANCE_WARRANTY'
  | 'GENERIC_DOCUMENT'
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
  | 'NEEDS_REVIEW'       // 70% - 84%
  | 'NEEDS_VERIFICATION' // < 70%
  | 'REJECTED';

export interface BoundingBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  page?: number;
}

export interface ExtractedField<T> {
  value: T | null;
  confidence: number;       // 0.0 to 1.0
  rawText: string;
  sourceLabel?: string;
  boundingBox?: BoundingBox;
  tier: VerificationConfidenceTier;
  flag?: string;            // Validation or anomaly note
}

export interface ClassificationResult {
  documentType: UniversalDocumentType;
  documentSubtype: string;
  confidence: number;
  matchedKeywords: string[];
  isLowConfidence: boolean;
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
  vehicleRegistration?: ExtractedField<string>;
  purchasePrice?: ExtractedField<number>;
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
}

export interface ApplianceDocumentData {
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

export interface UniversalExtractedData {
  serviceData?: ServiceInvoiceData;
  insuranceData?: InsurancePolicyData;
  pucData?: PucCertificateData;
  rcData?: RcCertificateData;
  purchaseData?: PurchaseInvoiceData;
  warrantyData?: WarrantyDocumentData;
  applianceData?: ApplianceDocumentData;
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
  matchType: 'EXACT_REGISTRATION' | 'EXACT_VIN' | 'EXACT_SERIAL' | 'FUZZY_NAME' | 'NO_MATCH';
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
  ocrDurationMs: number;
  extractionDurationMs: number;
  validationDurationMs: number;
  totalProcessingTimeMs: number;
}

export interface UniversalOcrDocumentResult {
  documentId: string;
  classification: ClassificationResult;
  extractedData: UniversalExtractedData;
  validation: CrossFieldValidationResult;
  entityLink: EntityLinkResult;
  duplicateCheck: DuplicateCheckResult;
  metrics: ProcessingMetrics;
  requiresReview: boolean;
  reviewReasons: string[];
  rawOcrText: string;
  createdAt: string;
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

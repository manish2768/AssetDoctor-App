/**
 * ASSET DOCTOR — OCR PIPELINE V2 SCHEMAS
 * Strongly-typed data structures for document OCR, classification,
 * field confidence, cross-field validation, and auditability.
 */

export type DocumentCategory = 'VEHICLE' | 'HOME_APPLIANCES' | 'ELECTRONICS' | 'GENERAL';

export type VehicleDocumentType =
  | 'VEHICLE_RC'
  | 'VEHICLE_INSURANCE'
  | 'VEHICLE_PUC'
  | 'VEHICLE_SERVICE_INVOICE'
  | 'VEHICLE_REPAIR_INVOICE'
  | 'VEHICLE_PURCHASE_INVOICE'
  | 'VEHICLE_WARRANTY'
  | 'VEHICLE_SERVICE_RECORD';

export type ApplianceDocumentType =
  | 'APPLIANCE_PURCHASE_INVOICE'
  | 'APPLIANCE_SERVICE_INVOICE'
  | 'APPLIANCE_WARRANTY'
  | 'APPLIANCE_EXTENDED_WARRANTY'
  | 'APPLIANCE_AMC'
  | 'APPLIANCE_REPAIR_BILL';

export type DocumentType = VehicleDocumentType | ApplianceDocumentType | 'GENERIC_INVOICE' | 'UNKNOWN_DOCUMENT';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED';

export type ProcessingStatus =
  | 'SCANNING'
  | 'PREPROCESSING'
  | 'CLASSIFYING'
  | 'EXTRACTING'
  | 'VALIDATING'
  | 'READY'
  | 'REVIEW_REQUIRED'
  | 'FAILED';

export interface FieldConfidenceScore {
  field: string;
  value: any;
  confidence: number; // 0.0 to 1.0
  level: ConfidenceLevel;
  source: 'provider' | 'semantic' | 'heuristic' | 'user_corrected';
  provenanceLabel?: string;
  warning?: string;
}

export interface LineItem {
  description: string;
  quantity?: number | null;
  unitPrice?: number | null;
  discount?: number | null;
  tax?: number | null;
  total?: number | null;
  category?: 'PARTS' | 'LABOUR' | 'CONSUMABLES' | 'GENERAL';
}

/** Standard Vehicle Document Fields */
export interface VehicleDocumentFields {
  vehicleRegistrationNumber?: string | null;
  normalizedRegistrationNumber?: string | null;
  ownerName?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleVariant?: string | null;
  vehicleType?: string | null;
  fuelType?: string | null;

  engineNumber?: string | null;
  chassisNumber?: string | null;
  vin?: string | null;

  invoiceNumber?: string | null;
  jobCardNumber?: string | null;
  invoiceDate?: string | null;
  serviceDate?: string | null;
  purchaseDate?: string | null;

  odometerReading?: number | null;
  odometerUnit?: 'KM' | 'MILES';
  odometerConfidence?: number;

  totalAmount?: number | null;
  taxAmount?: number | null;
  discount?: number | null;
  subtotal?: number | null;

  workshopName?: string | null;
  workshopAddress?: string | null;
  workshopPhone?: string | null;
  workshopGSTIN?: string | null;

  policyNumber?: string | null;
  policyStartDate?: string | null;
  policyEndDate?: string | null;
  insurerName?: string | null;
  insuredDeclaredValue?: number | null;

  pucNumber?: string | null;
  pucStartDate?: string | null;
  pucExpiryDate?: string | null;

  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;

  lineItems?: LineItem[];
}

/** Standard Appliance Document Fields */
export interface ApplianceDocumentFields {
  productName?: string | null;
  brand?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
  category?: string | null;

  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  purchaseDate?: string | null;
  serviceDate?: string | null;

  totalAmount?: number | null;
  taxAmount?: number | null;
  discount?: number | null;
  subtotal?: number | null;

  storeName?: string | null;
  storeAddress?: string | null;
  storePhone?: string | null;
  storeGSTIN?: string | null;
  customerName?: string | null;

  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  warrantyPeriodMonths?: number | null;

  amcNumber?: string | null;
  amcStartDate?: string | null;
  amcEndDate?: string | null;

  lineItems?: LineItem[];
}

export type ExtractedFields = VehicleDocumentFields & ApplianceDocumentFields;

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  severity: 'WARNING' | 'CRITICAL';
}

export interface DocumentOCRResult {
  processingId: string;
  documentHash: string; // SHA-256 of image base64
  documentId?: string | null;
  assetId?: string | null;

  ocrPipelineVersion: 'v2';
  documentType: DocumentType;
  documentCategory: DocumentCategory;
  assetType?: 'VEHICLE' | 'APPLIANCE' | 'ELECTRONICS' | 'GENERAL';

  documentConfidence: number; // 0.0 to 1.0
  assetResolution?: {
    matchedAssetId: string | null;
    resolutionMethod: string;
    matchConfidence: number;
    requiresReview: boolean;
    conflictReason: string | null;
    candidateAssets: Array<{ assetId: string; displayName: string; score: number; matchReasons: string[] }>;
  };

  fields: ExtractedFields;
  fieldConfidenceMap: Record<string, FieldConfidenceScore>;

  lineItems: LineItem[];
  rawText: string;

  provider: 'DocumentAI' | 'GeminiVision' | 'CloudVision' | 'MlKit' | 'Fallback';
  providerMetrics?: {
    processingTimeMs: number;
    providerConfidence?: number;
    model?: string;
  };

  processingStatus: ProcessingStatus;
  validationStatus: 'VALID' | 'NEEDS_REVIEW' | 'INVALID';
  identityConfidence?: number;

  warnings: ValidationWarning[];
  errors: string[];
  processedAt: string; // ISO 8601
}

export interface ManualCorrectionRecord {
  field: string;
  originalValue: any;
  correctedValue: any;
  correctedByUserId: string;
  correctedAt: string;
  reason?: string;
  provider: string;
  originalConfidence: number;
}

export interface AuditTrailEvent {
  eventId: string;
  processingId: string;
  documentId?: string | null;
  assetId?: string | null;
  userId?: string | null;
  eventType:
    | 'DOCUMENT_SCAN_STARTED'
    | 'OCR_PROCESSING_STARTED'
    | 'OCR_EXTRACTION_COMPLETED'
    | 'OCR_VALIDATION_FAILED'
    | 'OCR_REVIEW_REQUIRED'
    | 'OCR_MANUAL_CORRECTION'
    | 'OCR_PROCESSING_RETRY'
    | 'OCR_PROCESSING_FAILED'
    | 'DOCUMENT_SAVED'
    | 'VEHICLE_PROFILE_UPDATED';
  details?: Record<string, any>;
  timestamp: string;
  pipelineVersion: 'v2';
}

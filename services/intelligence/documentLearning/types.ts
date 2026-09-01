/**
 * Phase 13 — Adaptive Document Intelligence types.
 * Sits above OCR. Never invents missing values.
 */

export const LEARNING_DOCUMENT_TYPES = [
  'SERVICE_INVOICE',
  'INSURANCE_POLICY',
  'PUC',
  'RC',
  'PURCHASE_INVOICE',
  'WARRANTY',
  'ELECTRONICS_INVOICE',
  'APPLIANCE_INVOICE',
  'GENERIC_DOCUMENT',
] as const;

export type LearningDocumentType = (typeof LEARNING_DOCUMENT_TYPES)[number];

export const VALIDATION_STATUS = {
  VALID: 'VALID',
  LIKELY: 'LIKELY',
  SUSPICIOUS: 'SUSPICIOUS',
  INVALID: 'INVALID',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ValidationStatus = (typeof VALIDATION_STATUS)[keyof typeof VALIDATION_STATUS];

export interface ValidationResult {
  status: ValidationStatus;
  reason?: string;
  normalized?: string | number | null;
}

export const CORRECTION_TYPES = {
  WRONG_VALUE: 'WRONG_VALUE',
  WRONG_FIELD: 'WRONG_FIELD',
  MISSING_FIELD: 'MISSING_FIELD',
  WRONG_DOCUMENT_TYPE: 'WRONG_DOCUMENT_TYPE',
  WRONG_ASSET_MATCH: 'WRONG_ASSET_MATCH',
  OCR_NOISE: 'OCR_NOISE',
  FORMAT_ERROR: 'FORMAT_ERROR',
  USER_CONFIRMED: 'USER_CONFIRMED',
  USER_REJECTED: 'USER_REJECTED',
} as const;

export type CorrectionType = (typeof CORRECTION_TYPES)[keyof typeof CORRECTION_TYPES];

export const PATTERN_STATUS = {
  CANDIDATE: 'CANDIDATE',
  EMERGING: 'EMERGING',
  TRUSTED: 'TRUSTED',
  REJECTED: 'REJECTED',
} as const;

export type PatternStatus = (typeof PATTERN_STATUS)[keyof typeof PATTERN_STATUS];

export const VALUE_SHAPES = {
  GSTIN: 'GSTIN',
  IMEI: 'IMEI',
  PHONE: 'PHONE',
  CURRENCY_AMOUNT: 'CURRENCY_AMOUNT',
  VEHICLE_REG: 'VEHICLE_REG',
  VIN: 'VIN',
  ENGINE: 'ENGINE',
  SERIAL: 'SERIAL',
  INVOICE_NUMBER: 'INVOICE_NUMBER',
  POLICY_NUMBER: 'POLICY_NUMBER',
  PIN: 'PIN',
  DATE: 'DATE',
  OTHER: 'OTHER',
  EMPTY: 'EMPTY',
} as const;

export type ValueShape = (typeof VALUE_SHAPES)[keyof typeof VALUE_SHAPES];

export const FEEDBACK_QUALITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type FeedbackQuality = (typeof FEEDBACK_QUALITY)[keyof typeof FEEDBACK_QUALITY];

export interface ContextSignals {
  nearbyLabels: string[];
  vendorHash?: string | null;
  hasCurrencyGlyph?: boolean;
  layoutRegion?: 'header' | 'body' | 'summary' | 'unknown';
  matchedAssetId?: string | null;
  documentTypeConfidence?: number | null;
}

export interface FieldCandidate {
  fieldName: string;
  value: string | number | null;
  score: number;
  ocrConfidence: number;
  semanticProximity: number;
  formatScore: number;
  crossFieldScore: number;
  learnedScore: number;
  validationState: ValidationStatus;
  valueShape: ValueShape;
  source: 'OCR_SELECTED' | 'LABEL_NEARBY' | 'TOKEN_SCAN' | 'LEARNED';
  evidence?: string;
  learningApplied: boolean;
  reviewReason?: string;
}

export interface FieldReview {
  fieldName: string;
  value: string | number | null;
  validationState: ValidationStatus;
  needsReview: boolean;
  reason: string | null;
  topCandidate: FieldCandidate | null;
  candidates: FieldCandidate[];
  learningApplied: boolean;
}

export interface LearningFeedbackEvent {
  eventId: string;
  recordType: 'EVENT';
  userId: string;
  documentType: LearningDocumentType | string;
  fieldName: string;
  originalValue: string | number | null;
  correctedValue: string | number | null;
  originalValueShape: ValueShape;
  correctedValueShape: ValueShape;
  correctionType: CorrectionType;
  originalConfidence: number | null;
  validationState: ValidationStatus | null;
  documentFingerprint: string;
  contextSignals: ContextSignals;
  timestamp: string;
  createdAt: string;
  feedbackQuality: FeedbackQuality;
  semanticLabel?: string | null;
}

export interface LearningPattern {
  patternId: string;
  recordType: 'PATTERN';
  documentType: string;
  fieldName: string;
  semanticLabel: string;
  normalizedPattern: string;
  layoutSignal?: string | null;
  supportCount: number;
  independentEvidence: number;
  confidence: number;
  status: PatternStatus;
  createdAt: string;
  updatedAt: string;
  rejectedCount?: number;
}

export const LEARNING_COLLECTION = 'document_intelligence_feedback';

export const PROMOTION = {
  EMERGING_EVIDENCE: 3,
  TRUSTED_EVIDENCE: 5,
} as const;

export const TARGET_FIELDS = [
  'imei',
  'shopGstin',
  'gstin',
  'customerPhone',
  'phone',
  'invoiceNumber',
  'registration',
  'chassisNumber',
  'engineNumber',
  'serialNumber',
  'totalAmount',
  'policyNumber',
  'pinCode',
  'invoiceDate',
  'odometerKm',
] as const;

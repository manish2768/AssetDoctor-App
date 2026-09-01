/**
 * Asset Doctor — OCR Field Provenance & Evidence Contracts
 * Strict source isolation: OCR_DOCUMENT, OEM_DATABASE, USER_ENTERED, SYSTEM_CALCULATION
 */

export type FieldSource = 'OCR_DOCUMENT' | 'OEM_DATABASE' | 'USER_ENTERED' | 'SYSTEM_CALCULATION';

export type FieldStatus = 'VERIFIED' | 'LIKELY' | 'NEEDS_REVIEW' | 'NOT_FOUND';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedField<T = string | number | null> {
  value: T;
  confidence: number; // 0.0 to 1.0
  status: FieldStatus;
  source: FieldSource;
  evidence: string | null;
  boundingBox?: BoundingBox | null;
  originalValue?: T;
  correctedValue?: T;
  correctedAt?: string;
}

export function createNotFoundField<T = null>(evidence: string | null = null): ExtractedField<T> {
  return {
    value: null as unknown as T,
    confidence: 0,
    status: 'NOT_FOUND',
    source: 'OCR_DOCUMENT',
    evidence: evidence || 'Not physically printed on document',
    boundingBox: null
  };
}

export function createVerifiedField<T>(value: T, confidence: number, evidence: string, source: FieldSource = 'OCR_DOCUMENT', boundingBox?: BoundingBox): ExtractedField<T> {
  return {
    value,
    confidence: Math.min(1.0, Math.max(0.0, confidence)),
    status: confidence >= 0.85 ? 'VERIFIED' : 'LIKELY',
    source,
    evidence,
    boundingBox: boundingBox || null
  };
}

export function createSystemCalculationField<T>(value: T, evidence: string, confidence: number = 0.95): ExtractedField<T> {
  return {
    value,
    confidence,
    status: 'VERIFIED',
    source: 'SYSTEM_CALCULATION',
    evidence,
    boundingBox: null
  };
}

export function createUserEnteredField<T>(value: T, originalValue?: T): ExtractedField<T> {
  return {
    value,
    confidence: 1.0,
    status: 'VERIFIED',
    source: 'USER_ENTERED',
    evidence: 'Entered/modified by user',
    originalValue,
    correctedValue: value,
    correctedAt: new Date().toISOString(),
    boundingBox: null
  };
}

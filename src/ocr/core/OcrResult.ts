/**
 * Asset Doctor — Normalized OCR Contract
 * Uniform output shape for all OCR engines and routing layers.
 */

import type { ExtractedField } from './OcrEvidence.ts';

export type SupportedDocumentClass =
  | 'SERVICE_INVOICE'
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'INSURANCE_POLICY'
  | 'PUC_CERTIFICATE'
  | 'RC_CERTIFICATE'
  | 'WARRANTY_DOCUMENT'
  | 'APPLIANCE_INVOICE'
  | 'ELECTRONICS_INVOICE'
  | 'GENERIC_DOCUMENT';

export interface OcrTimingBreakdown {
  cameraCaptureMs?: number;
  preprocessingMs?: number;
  classificationMs?: number;
  localOcrMs?: number;
  googleOcrMs?: number;
  azureOcrMs?: number;
  geminiMs?: number;
  extractionMs?: number;
  assetMatchingMs?: number;
  firebaseMs?: number;
  totalMs: number;
}

export interface OcrResult<TFields = Record<string, ExtractedField<any>>> {
  success: boolean;
  engine: 'local-mlkit' | 'google-vision' | 'azure-vision' | 'multimodal-gemini' | 'hybrid-universal' | 'cache' | 'manual';
  documentType: SupportedDocumentClass;
  rawText: string;
  fields: TFields;
  warnings: string[];
  timing: OcrTimingBreakdown;
  fingerprint?: string;
  fromCache?: boolean;
  requiresReview: boolean;
  reviewReasons: string[];
  matchedAssetId?: string | null;
  matchType?: string;
  error?: string;
}

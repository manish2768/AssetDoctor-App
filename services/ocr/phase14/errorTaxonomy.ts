/**
 * Phase 14 — structured OCR error codes.
 * Never use a generic "OCR failed" when a specific reason exists.
 */

export const OCR_ERROR = Object.freeze({
  OCR_IMAGE_QUALITY_LOW: 'OCR_IMAGE_QUALITY_LOW',
  OCR_DOCUMENT_CROPPED: 'OCR_DOCUMENT_CROPPED',
  OCR_DOCUMENT_ROTATED: 'OCR_DOCUMENT_ROTATED',
  OCR_DOCUMENT_UNKNOWN: 'OCR_DOCUMENT_UNKNOWN',
  OCR_FIELD_NOT_FOUND: 'OCR_FIELD_NOT_FOUND',
  OCR_FIELD_TYPE_MISMATCH: 'OCR_FIELD_TYPE_MISMATCH',
  OCR_PROVIDER_DISAGREEMENT: 'OCR_PROVIDER_DISAGREEMENT',
  OCR_CURRENCY_AS_IDENTIFIER: 'OCR_CURRENCY_AS_IDENTIFIER',
  OCR_IDENTIFIER_AS_AMOUNT: 'OCR_IDENTIFIER_AS_AMOUNT',
  OCR_ASSET_MATCH_CONFLICT: 'OCR_ASSET_MATCH_CONFLICT',
  OCR_DATE_RELATIONSHIP_INVALID: 'OCR_DATE_RELATIONSHIP_INVALID',
  OCR_TOTAL_MISMATCH: 'OCR_TOTAL_MISMATCH',
  OCR_TABLE_EXTRACTION_LOW_CONFIDENCE: 'OCR_TABLE_EXTRACTION_LOW_CONFIDENCE',
  OCR_EMPTY_TEXT: 'OCR_EMPTY_TEXT',
  OCR_DOCUMENT_TYPE_UNCERTAIN: 'OCR_DOCUMENT_TYPE_UNCERTAIN',
} as const);

export type OcrErrorCode = (typeof OCR_ERROR)[keyof typeof OCR_ERROR];

export const USER_MESSAGES: Record<OcrErrorCode, string> = {
  OCR_IMAGE_QUALITY_LOW: 'Image quality is too low to read this document clearly.',
  OCR_DOCUMENT_CROPPED: 'Please capture the full invoice. The document looks cropped.',
  OCR_DOCUMENT_ROTATED: 'Document looks tilted. Keep it flat and fully in frame.',
  OCR_DOCUMENT_UNKNOWN: 'Document structure is unclear. Fields will be extracted generically.',
  OCR_FIELD_NOT_FOUND: 'Not found on document.',
  OCR_FIELD_TYPE_MISMATCH: 'Detected value does not match the expected field type.',
  OCR_PROVIDER_DISAGREEMENT: 'OCR engines disagree on this field. Please review.',
  OCR_CURRENCY_AS_IDENTIFIER: 'Candidate resembles a monetary amount rather than an identifier.',
  OCR_IDENTIFIER_AS_AMOUNT: 'Candidate resembles an identifier rather than a currency amount.',
  OCR_ASSET_MATCH_CONFLICT: 'Identifiers conflict with an existing asset. Nothing was overwritten.',
  OCR_DATE_RELATIONSHIP_INVALID: 'Dates on this document are inconsistent. Please review.',
  OCR_TOTAL_MISMATCH: 'Line totals and grand total do not reconcile. Please verify the amount.',
  OCR_TABLE_EXTRACTION_LOW_CONFIDENCE: 'Line items need review. Rows were not invented.',
  OCR_EMPTY_TEXT: 'No readable text was found. Please recapture the document.',
  OCR_DOCUMENT_TYPE_UNCERTAIN: 'Document type is uncertain. Please review before saving.',
};

export function messageForCode(code: OcrErrorCode | string | null | undefined): string {
  if (!code) return 'Please review this document before saving.';
  return USER_MESSAGES[code as OcrErrorCode] || String(code);
}

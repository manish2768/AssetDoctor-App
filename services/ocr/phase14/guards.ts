/**
 * Phase 14 — line-item guard + image quality messages from existing heuristics.
 * Does not invent table rows. Does not claim pixel-level blur without signals.
 */

import { OCR_ERROR, messageForCode } from './errorTaxonomy.ts';

export function evaluateLineItems(fields: Record<string, unknown> = {}): {
  code: string | null;
  reason: string | null;
  reviewRequired: boolean;
} {
  const items = Array.isArray(fields.items) ? fields.items : [];
  if (!items.length) {
    return { code: null, reason: null, reviewRequired: false };
  }
  let mixed = 0;
  for (const row of items) {
    const qty = row?.quantity ?? row?.qty;
    const price = row?.unitPrice ?? row?.price;
    const imei = row?.imei;
    if (imei && (qty === imei || price === imei)) mixed += 1;
    const desc = String(row?.description || row?.name || '');
    if (/\bimei\b/i.test(desc) && Number(qty) > 1000) mixed += 1;
  }
  if (mixed > 0 || (items.length === 1 && !items[0]?.description && !items[0]?.name)) {
    return {
      code: OCR_ERROR.OCR_TABLE_EXTRACTION_LOW_CONFIDENCE,
      reason: messageForCode(OCR_ERROR.OCR_TABLE_EXTRACTION_LOW_CONFIDENCE),
      reviewRequired: true,
    };
  }
  return { code: null, reason: null, reviewRequired: false };
}

export function interpretImageQuality(input: {
  score?: number;
  ok?: boolean;
  issues?: string[];
  message?: string;
} = {}): {
  imageQualityScore: number | null;
  imageQualityIssues: string[];
  codes: string[];
  userMessages: string[];
} {
  const issues = Array.isArray(input.issues) ? input.issues.map(String) : [];
  const score = Number.isFinite(Number(input.score)) ? Number(input.score) : null;
  const codes: string[] = [];
  const userMessages: string[] = [];

  if (issues.includes('low_resolution') || issues.includes('partial_document') || issues.includes('small_text')) {
    codes.push(OCR_ERROR.OCR_DOCUMENT_CROPPED);
    userMessages.push(messageForCode(OCR_ERROR.OCR_DOCUMENT_CROPPED));
  }
  if (issues.includes('rotated_or_cropped')) {
    codes.push(OCR_ERROR.OCR_DOCUMENT_ROTATED);
    userMessages.push(messageForCode(OCR_ERROR.OCR_DOCUMENT_ROTATED));
  }
  if (issues.includes('blur') || issues.includes('low_brightness') || input.ok === false) {
    codes.push(OCR_ERROR.OCR_IMAGE_QUALITY_LOW);
    userMessages.push(input.message || messageForCode(OCR_ERROR.OCR_IMAGE_QUALITY_LOW));
  }
  if (score != null && score < 30 && !codes.length) {
    codes.push(OCR_ERROR.OCR_IMAGE_QUALITY_LOW);
    userMessages.push(messageForCode(OCR_ERROR.OCR_IMAGE_QUALITY_LOW));
  }

  return {
    imageQualityScore: score,
    imageQualityIssues: issues,
    codes: [...new Set(codes)],
    userMessages: [...new Set(userMessages)],
  };
}

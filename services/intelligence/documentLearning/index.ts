/**
 * Phase 13 — Apply adaptive document intelligence ABOVE existing OCR output.
 * Does not replace Vision / Azure / ML Kit / UniversalOcrPipeline extractors.
 * Never invents missing values.
 */

import {
  VALIDATION_STATUS,
  type FieldReview,
  type LearningPattern,
} from './types.ts';
import { generateFieldCandidates, selectRankedValue } from './candidateEngine.ts';
import { evaluateCrossFieldDocument } from './crossFieldIntelligence.ts';
import { normalizeLearningDocumentType } from './valueShape.ts';
import { validateField } from './fieldValidators.ts';

const RANK_FIELDS = [
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
] as const;

function readValue(fields: Record<string, unknown>, key: string): unknown {
  const raw = fields?.[key];
  if (raw && typeof raw === 'object' && raw !== null && 'value' in (raw as object)) {
    return (raw as { value: unknown }).value;
  }
  return raw;
}

function writeValue(fields: Record<string, unknown>, key: string, value: unknown, nested: boolean): void {
  const raw = fields?.[key];
  if (nested || (raw && typeof raw === 'object' && raw !== null && 'value' in (raw as object))) {
    fields[key] = {
      ...(typeof raw === 'object' && raw ? raw : {}),
      value,
    };
    return;
  }
  fields[key] = value;
}

function isEmpty(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

export function flattenIntelligenceFields(fields: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = readValue(fields, k) ?? v;
  }
  return out;
}

export interface ApplyIntelligenceInput {
  documentType?: string;
  fields?: Record<string, unknown>;
  rawText?: string;
  providerTexts?: Record<string, string | null>;
  patterns?: LearningPattern[];
  fieldConfidence?: Record<string, number>;
  matchedAsset?: { registration?: string; category?: string } | null;
  applyOverrides?: boolean;
}

export interface ApplyIntelligenceResult {
  documentType: string;
  fields: Record<string, unknown>;
  flatFields: Record<string, unknown>;
  fieldReviews: Record<string, FieldReview>;
  reviewReasons: string[];
  requiresReview: boolean;
  appliedOverrides: boolean;
  recommendedPatches: Record<string, string | number | null>;
}

export function applyDocumentIntelligence(input: ApplyIntelligenceInput = {}): ApplyIntelligenceResult {
  const documentType = String(normalizeLearningDocumentType(input.documentType || 'GENERIC_DOCUMENT'));
  const sourceFields = { ...(input.fields || {}) };
  const nested = RANK_FIELDS.some((k) => {
    const raw = sourceFields[k];
    return raw && typeof raw === 'object' && raw !== null && 'value' in (raw as object);
  });
  const flat = flattenIntelligenceFields(sourceFields);
  const patterns = input.patterns || [];
  const fieldReviews: Record<string, FieldReview> = {};
  const recommendedPatches: Record<string, string | number | null> = {};
  const reviewReasons: string[] = [];
  let appliedOverrides = false;

  const cross = evaluateCrossFieldDocument(documentType, flat);

  for (const fieldName of RANK_FIELDS) {
    const current = flat[fieldName];
    const candidates = generateFieldCandidates({
      fieldName,
      currentValue: current,
      documentType,
      rawText: input.rawText || '',
      providerTexts: input.providerTexts,
      allFields: flat,
      ocrConfidence: input.fieldConfidence?.[fieldName],
      patterns,
    });
    const top = selectRankedValue(candidates);
    const currentValidation = validateField(fieldName, current);
    const currentCandidate = candidates.find((c) => String(c.value) === String(current)) || null;
    const learningApplied = candidates.some((c) => c.learningApplied);
    const crossIssue = cross.issues.find((i) => i.fieldName === fieldName);
    const empty = isEmpty(current);

    let needsReview = false;
    let reason: string | null = null;

    if (empty) {
      needsReview = false;
      reason = null;
    } else if (currentValidation.status === VALIDATION_STATUS.INVALID || currentValidation.status === VALIDATION_STATUS.SUSPICIOUS) {
      needsReview = true;
      reason =
        crossIssue?.reason ||
        currentValidation.reason ||
        'Extracted value failed deterministic validation.';
    } else if (crossIssue) {
      needsReview = true;
      reason = crossIssue.reason;
    } else if ((input.fieldConfidence?.[fieldName] ?? 1) < 0.7) {
      needsReview = true;
      reason = 'Low OCR confidence — please verify this field.';
    } else if (top && current != null && String(top.value) !== String(current) && top.score - (currentCandidate?.score || 0) >= 8) {
      needsReview = true;
      reason = top.reviewReason || 'A stronger candidate was found for this field.';
    }

    if (needsReview && reason) reviewReasons.push(`${fieldName}: ${reason}`);

    const alt = top && String(top.value) !== String(current || '') ? top : candidates.find((c) => String(c.value) !== String(current || '')) || null;

    fieldReviews[fieldName] = {
      fieldName,
      value: empty ? null : (current as string | number),
      validationState: empty ? VALIDATION_STATUS.UNKNOWN : currentCandidate?.validationState || currentValidation.status,
      needsReview,
      reason,
      topCandidate: alt && alt.validationState === VALIDATION_STATUS.VALID ? alt : alt,
      candidates: candidates.slice(0, 6),
      learningApplied,
    };

    // Override only when current is present AND invalid/suspicious AND a better VALID candidate exists in-document.
    // Missing stays missing (zero hallucination).
    const shouldOverride =
      input.applyOverrides !== false &&
      !empty &&
      top &&
      !isEmpty(top.value) &&
      String(top.value) !== String(current) &&
      top.validationState === VALIDATION_STATUS.VALID &&
      (currentValidation.status === VALIDATION_STATUS.INVALID ||
        currentValidation.status === VALIDATION_STATUS.SUSPICIOUS ||
        learningApplied);

    if (shouldOverride && top) {
      recommendedPatches[fieldName] = top.value as string | number;
      writeValue(sourceFields, fieldName, top.value, nested);
      flat[fieldName] = top.value;
      appliedOverrides = true;
      fieldReviews[fieldName] = {
        ...fieldReviews[fieldName],
        value: top.value as string | number,
        validationState: top.validationState,
        needsReview: false,
        reason: null,
        learningApplied: top.learningApplied,
      };
    }
  }

  // Strip leaked insurance↔service fields rather than inventing replacements.
  if (documentType === 'SERVICE_INVOICE') {
    for (const leak of ['policyNumber', 'idvAmount', 'premiumAmount', 'coverageType']) {
      if (!isEmpty(flat[leak])) {
        writeValue(sourceFields, leak, null, nested);
        flat[leak] = null;
        fieldReviews[leak] = {
          fieldName: leak,
          value: null,
          validationState: VALIDATION_STATUS.INVALID,
          needsReview: false,
          reason: 'Insurance fields must not leak into a service invoice.',
          topCandidate: null,
          candidates: [],
          learningApplied: false,
        };
      }
    }
  }
  if (documentType === 'INSURANCE_POLICY') {
    for (const leak of ['odometerKm', 'labourCharges', 'nextServiceDue', 'nextServiceOdometerKm']) {
      if (!isEmpty(flat[leak])) {
        writeValue(sourceFields, leak, null, nested);
        flat[leak] = null;
        fieldReviews[leak] = {
          fieldName: leak,
          value: null,
          validationState: VALIDATION_STATUS.INVALID,
          needsReview: false,
          reason: 'Service fields must not leak into an insurance document.',
          topCandidate: null,
          candidates: [],
          learningApplied: false,
        };
      }
    }
  }

  return {
    documentType,
    fields: sourceFields,
    flatFields: flat,
    fieldReviews,
    reviewReasons: [...new Set(reviewReasons)],
    requiresReview: reviewReasons.length > 0,
    appliedOverrides,
    recommendedPatches,
  };
}

export {
  validateField,
  validateGSTIN,
  validateIMEI,
  validateVehicleReg,
  validatePhone,
  validatePinCode,
  validateDate,
  validateAmount,
  validateInvoiceNumber,
  validateChassisVIN,
  validateEngineNumber,
  validateSerialNumber,
  validatePolicyNumber,
} from './fieldValidators.ts';

export { generateFieldCandidates, scoreCandidate, extractCandidateTokens, learnedPatternSupport } from './candidateEngine.ts';
export { evaluateCrossFieldDocument, crossFieldScore, documentTypeFieldLeak } from './crossFieldIntelligence.ts';
export { PatternMemory } from './patternMemory.ts';
export { buildFeedbackEvent, diffReviewCorrections, inferCorrectionType, makeEventId } from './feedbackCapture.ts';
export { sanitizeLearningRecord, redactFieldValue, learningRecordHasForbiddenKeys } from './privacy.ts';
export { classifyValueShape, normalizeLearningDocumentType, makeDocumentFingerprint, patternKey } from './valueShape.ts';
export { summarizeLearningCenter } from './adminLearning.ts';
export { CORRECTION_TYPES, PATTERN_STATUS, VALIDATION_STATUS, VALUE_SHAPES, LEARNING_COLLECTION, PROMOTION } from './types.ts';

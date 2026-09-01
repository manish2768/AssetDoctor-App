/**
 * Phase 13 — Structured feedback events from customer review corrections.
 * One correction = learning signal. Does not store images or full document text.
 */

import {
  CORRECTION_TYPES,
  FEEDBACK_QUALITY,
  VALIDATION_STATUS,
  type CorrectionType,
  type FieldReview,
  type LearningFeedbackEvent,
} from './types.ts';
import { classifyValueShape, makeDocumentFingerprint, normalizeLearningDocumentType, stableHash } from './valueShape.ts';
import { sanitizeLearningRecord } from './privacy.ts';
import { validateField } from './fieldValidators.ts';

const TRACKED_FIELDS = [
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
  'productName',
  'documentType',
  'linkAssetId',
];

function norm(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return norm(a).toUpperCase().replace(/\s+/g, '') === norm(b).toUpperCase().replace(/\s+/g, '');
}

export function inferCorrectionType(opts: {
  fieldName: string;
  originalValue: unknown;
  correctedValue: unknown;
  fieldReviews?: Record<string, FieldReview>;
}): CorrectionType {
  const origEmpty = !norm(opts.originalValue);
  const nextEmpty = !norm(opts.correctedValue);
  if (origEmpty && !nextEmpty) return CORRECTION_TYPES.MISSING_FIELD;
  if (!origEmpty && nextEmpty) return CORRECTION_TYPES.USER_REJECTED;
  if (opts.fieldName === 'documentType') return CORRECTION_TYPES.WRONG_DOCUMENT_TYPE;
  if (opts.fieldName === 'linkAssetId') return CORRECTION_TYPES.WRONG_ASSET_MATCH;
  const origShape = classifyValueShape(opts.originalValue);
  const nextShape = classifyValueShape(opts.correctedValue);
  if (origShape !== nextShape && origShape !== 'EMPTY' && nextShape !== 'EMPTY') {
    return CORRECTION_TYPES.WRONG_FIELD;
  }
  const review = opts.fieldReviews?.[opts.fieldName];
  if (review?.validationState === VALIDATION_STATUS.INVALID) return CORRECTION_TYPES.FORMAT_ERROR;
  if (review?.reason && /noise|garbled|ocr/i.test(review.reason)) return CORRECTION_TYPES.OCR_NOISE;
  return CORRECTION_TYPES.WRONG_VALUE;
}

export function makeEventId(parts: {
  userId: string;
  fingerprint: string;
  fieldName: string;
  correctionType: string;
  originalValue: unknown;
  correctedValue: unknown;
}): string {
  const raw = [
    parts.userId,
    parts.fingerprint,
    parts.fieldName,
    parts.correctionType,
    norm(parts.originalValue),
    norm(parts.correctedValue),
  ].join('|');
  return `learn_${stableHash(raw)}${stableHash(raw.split('').reverse().join(''))}`;
}

export function buildFeedbackEvent(opts: {
  userId: string;
  documentType: string;
  fieldName: string;
  originalValue: unknown;
  correctedValue: unknown;
  correctionType?: CorrectionType;
  originalConfidence?: number | null;
  documentFingerprint?: string;
  nearbyLabels?: string[];
  vendorHint?: string;
  fieldPresence?: string[];
  matchedAssetId?: string | null;
  fieldReviews?: Record<string, FieldReview>;
  timestamp?: string;
}): LearningFeedbackEvent {
  const documentType = normalizeLearningDocumentType(opts.documentType);
  const correctionType =
    opts.correctionType ||
    inferCorrectionType({
      fieldName: opts.fieldName,
      originalValue: opts.originalValue,
      correctedValue: opts.correctedValue,
      fieldReviews: opts.fieldReviews,
    });
  const fingerprint =
    opts.documentFingerprint ||
    makeDocumentFingerprint({
      documentType,
      nearbyLabels: opts.nearbyLabels,
      vendorHint: opts.vendorHint,
      fieldPresence: opts.fieldPresence,
    });
  const validation = validateField(opts.fieldName, opts.originalValue);
  const ts = opts.timestamp || new Date().toISOString();
  const event: LearningFeedbackEvent = {
    eventId: makeEventId({
      userId: opts.userId || 'anon',
      fingerprint,
      fieldName: opts.fieldName,
      correctionType,
      originalValue: opts.originalValue,
      correctedValue: opts.correctedValue,
    }),
    recordType: 'EVENT',
    userId: opts.userId || '',
    documentType,
    fieldName: opts.fieldName,
    originalValue: opts.originalValue == null || opts.originalValue === '' ? null : (opts.originalValue as string | number),
    correctedValue: opts.correctedValue == null || opts.correctedValue === '' ? null : (opts.correctedValue as string | number),
    originalValueShape: classifyValueShape(opts.originalValue),
    correctedValueShape: classifyValueShape(opts.correctedValue),
    correctionType,
    originalConfidence: opts.originalConfidence ?? null,
    validationState: validation.status,
    documentFingerprint: fingerprint,
    contextSignals: {
      nearbyLabels: opts.nearbyLabels || [],
      vendorHash: opts.vendorHint ? stableHash(String(opts.vendorHint).toUpperCase()) : null,
      hasCurrencyGlyph: false,
      layoutRegion: 'unknown',
      matchedAssetId: opts.matchedAssetId || null,
    },
    timestamp: ts,
    createdAt: ts,
    feedbackQuality: FEEDBACK_QUALITY.HIGH,
    semanticLabel: `${opts.fieldName}:${classifyValueShape(opts.originalValue)}->${classifyValueShape(opts.correctedValue)}`,
  };
  return event;
}

export function diffReviewCorrections(opts: {
  userId: string;
  documentType: string;
  original: Record<string, unknown>;
  corrected: Record<string, unknown>;
  userConfirmedFields?: Record<string, boolean>;
  fieldReviews?: Record<string, FieldReview>;
  documentFingerprint?: string;
  vendorHint?: string;
  nearbyLabels?: string[];
  matchedAssetId?: string | null;
}): LearningFeedbackEvent[] {
  const events: LearningFeedbackEvent[] = [];
  const original = opts.original || {};
  const corrected = opts.corrected || {};
  const presence = TRACKED_FIELDS.filter((f) => norm(original[f]) || norm(corrected[f]));

  for (const fieldName of TRACKED_FIELDS) {
    const a = original[fieldName];
    const b = corrected[fieldName];
    if (valuesEqual(a, b)) {
      if (opts.userConfirmedFields?.[fieldName] && norm(b)) {
        events.push(
          sanitizeLearningRecord(
            buildFeedbackEvent({
              ...opts,
              fieldName,
              originalValue: a,
              correctedValue: b,
              correctionType: CORRECTION_TYPES.USER_CONFIRMED,
              fieldPresence: presence,
              originalConfidence: opts.fieldReviews?.[fieldName] ? undefined : 0.9,
            }),
          ),
        );
      }
      continue;
    }
    events.push(
      sanitizeLearningRecord(
        buildFeedbackEvent({
          ...opts,
          fieldName,
          originalValue: a,
          correctedValue: b,
          fieldPresence: presence,
          originalConfidence: opts.fieldReviews?.[fieldName] ? undefined : null,
        }),
      ),
    );
  }
  return events;
}

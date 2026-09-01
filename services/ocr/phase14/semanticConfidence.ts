/**
 * Phase 14 — semantic confidence vs OCR confidence.
 * OCR 99% + validation FAIL → LOW final confidence.
 */

import { VALIDATION_STATUS, type ValidationStatus } from '../../intelligence/documentLearning/types.ts';

export const REVIEW_DECISION = Object.freeze({
  AUTO_ACCEPT: 'AUTO_ACCEPT',
  REVIEW_RECOMMENDED: 'REVIEW_RECOMMENDED',
  MANUAL_ENTRY_REQUIRED: 'MANUAL_ENTRY_REQUIRED',
  REJECT_CANDIDATE: 'REJECT_CANDIDATE',
  NOT_FOUND: 'NOT_FOUND',
} as const);

export type ReviewDecision = (typeof REVIEW_DECISION)[keyof typeof REVIEW_DECISION];

export interface CalibratedConfidence {
  ocrConfidence: number | null;
  semanticConfidence: number;
  finalConfidence: number;
  band: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  decision: ReviewDecision;
}

function clamp01(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(Number(n))) return null;
  const v = Number(n);
  if (v > 1 && v <= 100) return v / 100;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function semanticFromValidation(status: ValidationStatus | undefined, extras: {
  crossFieldOk?: boolean;
  providerAgreement?: boolean;
  assetMatch?: boolean;
  learnedPattern?: boolean;
  currencyVeto?: boolean;
}): number {
  if (extras.currencyVeto) return 0.05;
  let base = 0.4;
  switch (status) {
    case VALIDATION_STATUS.VALID:
      base = 0.88;
      break;
    case VALIDATION_STATUS.LIKELY:
      base = 0.7;
      break;
    case VALIDATION_STATUS.UNKNOWN:
      base = 0.45;
      break;
    case VALIDATION_STATUS.SUSPICIOUS:
      base = 0.28;
      break;
    case VALIDATION_STATUS.INVALID:
      base = 0.08;
      break;
    default:
      base = 0.4;
  }
  if (extras.crossFieldOk === false) base -= 0.25;
  if (extras.crossFieldOk === true) base += 0.05;
  if (extras.providerAgreement) base += 0.06;
  if (extras.assetMatch) base += 0.05;
  if (extras.learnedPattern) base += 0.04;
  return Math.max(0, Math.min(1, base));
}

export function calibrateFieldConfidence(opts: {
  ocrConfidence?: number | null;
  validationStatus?: ValidationStatus;
  empty?: boolean;
  crossFieldOk?: boolean;
  providerAgreement?: boolean;
  assetMatch?: boolean;
  learnedPattern?: boolean;
  currencyVeto?: boolean;
  disagreement?: boolean;
}): CalibratedConfidence {
  const ocr = clamp01(opts.ocrConfidence ?? null);
  if (opts.empty) {
    return {
      ocrConfidence: ocr,
      semanticConfidence: 0,
      finalConfidence: 0,
      band: 'NONE',
      decision: REVIEW_DECISION.NOT_FOUND,
    };
  }
  const semantic = semanticFromValidation(opts.validationStatus, opts);
  // Hard validation dominates OCR engine confidence.
  const final = Math.min(semantic, ocr == null ? semantic : 0.35 * ocr + 0.65 * semantic);
  let decision: ReviewDecision = REVIEW_DECISION.REVIEW_RECOMMENDED;
  if (opts.currencyVeto || opts.validationStatus === VALIDATION_STATUS.INVALID) {
    decision = REVIEW_DECISION.REJECT_CANDIDATE;
  } else if (opts.disagreement || opts.validationStatus === VALIDATION_STATUS.SUSPICIOUS || final < 0.55) {
    decision = REVIEW_DECISION.REVIEW_RECOMMENDED;
  } else if (final >= 0.82 && opts.validationStatus === VALIDATION_STATUS.VALID && opts.crossFieldOk !== false) {
    decision = REVIEW_DECISION.AUTO_ACCEPT;
  } else if (final < 0.25) {
    decision = REVIEW_DECISION.MANUAL_ENTRY_REQUIRED;
  }

  let band: CalibratedConfidence['band'] = 'LOW';
  if (final >= 0.82) band = 'HIGH';
  else if (final >= 0.55) band = 'MEDIUM';

  return {
    ocrConfidence: ocr,
    semanticConfidence: Number(semantic.toFixed(3)),
    finalConfidence: Number(final.toFixed(3)),
    band,
    decision,
  };
}

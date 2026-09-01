/**
 * Phase 14 — hardening orchestrator.
 * Runs ABOVE existing OCR + Phase 13. Never invents missing values.
 * Priority: HARD VALIDATION > CROSS-FIELD > DOCUMENT CONTEXT > LEARNED PATTERN > OCR CONFIDENCE
 */

import { applyDocumentIntelligence } from '../../intelligence/documentLearning/index.ts';
import { VALIDATION_STATUS, type FieldReview, type LearningPattern } from '../../intelligence/documentLearning/types.ts';
import { classifyDocumentIntelligence, UNKNOWN_DOCUMENT_STRUCTURE, DOCUMENT_TYPE_UNCERTAIN } from './documentTypeIntelligence.ts';
import { buildEnsembleCandidates, describeProviderAvailability, RANK_FIELDS } from './ensembleCandidates.ts';
import type { ProviderTexts } from './ensembleCandidates.ts';
import { calibrateFieldConfidence, REVIEW_DECISION } from './semanticConfidence.ts';
import { evaluateRelationalValidation } from './crossFieldHardening.ts';
import { resolveAssetIdentity } from './assetIdentity.ts';
import { evaluateLineItems, interpretImageQuality } from './guards.ts';
import { currencyAsIdentifierVeto } from './currencyProtection.ts';
import { validatePhase14Field } from './extendedValidators.ts';
import { OCR_ERROR, messageForCode } from './errorTaxonomy.ts';
import type { MatchCandidate } from '../../../src/ocr/linking/AssetMatcher.ts';

function isEmpty(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

function valuePresentInDocument(rawText: string, value: unknown): boolean {
  const token = String(value ?? '').trim();
  if (!token) return false;
  const text = String(rawText || '');
  if (text.includes(token)) return true;
  const compactVal = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compactVal.length < 8) return false;
  const compactText = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return compactText.includes(compactVal);
}

function readValue(fields: Record<string, unknown>, key: string): unknown {
  const raw = fields?.[key];
  if (raw && typeof raw === 'object' && raw !== null && 'value' in (raw as object)) {
    return (raw as { value: unknown }).value;
  }
  return raw;
}

export interface HardenInput {
  fields?: Record<string, unknown>;
  rawText?: string;
  providerTexts?: ProviderTexts;
  documentType?: string;
  fieldConfidence?: Record<string, number>;
  ocrConfidence?: number;
  patterns?: LearningPattern[];
  assets?: MatchCandidate[];
  imageQuality?: { score?: number; ok?: boolean; issues?: string[]; message?: string };
  applyOverrides?: boolean;
}

export interface FieldDecision {
  fieldName: string;
  value: unknown;
  ocrConfidence: number | null;
  semanticConfidence: number;
  finalConfidence: number;
  decision: string;
  validationState: string;
  reason: string | null;
  errorCodes: string[];
  topCandidate: FieldReview['topCandidate'];
  needsReview: boolean;
}

export function hardenOcrUnderstanding(input: HardenInput = {}) {
  const t0 = Date.now();
  const sourceFields = { ...(input.fields || {}) };
  const classification = classifyDocumentIntelligence(
    input.rawText || '',
    sourceFields,
    input.documentType,
  );
  const documentType =
    classification.documentType === UNKNOWN_DOCUMENT_STRUCTURE ||
    classification.documentType === DOCUMENT_TYPE_UNCERTAIN
      ? 'GENERIC_DOCUMENT'
      : classification.documentType;

  const learned = applyDocumentIntelligence({
    documentType,
    fields: sourceFields,
    rawText: input.rawText || '',
    providerTexts: input.providerTexts as any,
    patterns: input.patterns || [],
    fieldConfidence: input.fieldConfidence,
    applyOverrides: input.applyOverrides !== false,
  });

  const flat = { ...learned.flatFields };
  if (documentType === 'SERVICE_INVOICE' || documentType === 'RC' || documentType === 'PUC' || documentType === 'INSURANCE_POLICY') {
    for (const leak of ['imei', 'imei1', 'imei2', 'serialNumber', 'policyNumber', 'idvAmount', 'premiumAmount', 'coverageType']) {
      if (!isEmpty(flat[leak])) flat[leak] = null;
    }
  }
  if (documentType === 'INSURANCE_POLICY') {
    for (const leak of ['odometerKm', 'labourCharges', 'nextServiceDue', 'nextServiceOdometerKm', 'engineNumber', 'chassisNumber']) {
      if (!isEmpty(flat[leak])) flat[leak] = null;
    }
  }
  if (documentType === 'PURCHASE_INVOICE' || documentType === 'ELECTRONICS_INVOICE' || documentType === 'APPLIANCE_INVOICE' || documentType === 'WARRANTY' || documentType === 'PUC') {
    for (const leak of ['engineNumber', 'chassisNumber', 'odometerKm', 'jobCardNumber']) {
      if (!isEmpty(flat[leak])) flat[leak] = null;
    }
  }
  const relational = evaluateRelationalValidation(documentType, flat);
  const lineItems = evaluateLineItems(flat);
  const quality = interpretImageQuality(input.imageQuality || {});
  const asset = resolveAssetIdentity(flat, input.assets || []);

  const providerAvailability = describeProviderAvailability(input.providerTexts || {}, input.rawText || '');
  const fieldDecisions: Record<string, FieldDecision> = {};
  const errorCodes: string[] = [...quality.codes];
  const reviewReasons: string[] = [...(learned.reviewReasons || [])];

  if (classification.documentType === UNKNOWN_DOCUMENT_STRUCTURE) {
    errorCodes.push(OCR_ERROR.OCR_DOCUMENT_UNKNOWN);
    reviewReasons.push(messageForCode(OCR_ERROR.OCR_DOCUMENT_UNKNOWN));
  }
  if (classification.documentType === DOCUMENT_TYPE_UNCERTAIN) {
    errorCodes.push(OCR_ERROR.OCR_DOCUMENT_TYPE_UNCERTAIN);
    reviewReasons.push(messageForCode(OCR_ERROR.OCR_DOCUMENT_TYPE_UNCERTAIN));
  }
  if (asset.code) {
    errorCodes.push(asset.code);
    reviewReasons.push(asset.reason);
  }
  if (lineItems.reviewRequired && lineItems.code) {
    errorCodes.push(lineItems.code);
    reviewReasons.push(lineItems.reason || '');
  }
  for (const issue of relational.issues) {
    errorCodes.push(issue.code);
    reviewReasons.push(`${issue.fieldName}: ${issue.reason}`);
  }

  const recommendedPatches: Record<string, string | number | null> = {
    ...(learned.recommendedPatches || {}),
  };

  for (const fieldName of RANK_FIELDS) {
    const current = readValue(flat, fieldName);
    const ensemble = buildEnsembleCandidates({
      fieldName,
      currentValue: current,
      documentType,
      rawText: input.rawText || '',
      providerTexts: {
        ...(input.providerTexts || {}),
        winner: input.providerTexts?.winner || input.rawText,
      },
      allFields: flat,
      ocrConfidence: input.fieldConfidence?.[fieldName] ?? input.ocrConfidence,
      patterns: input.patterns || [],
    });
    const veto = currencyAsIdentifierVeto(fieldName, current);
    const validation = validatePhase14Field(fieldName, current);
    const top = ensemble.candidates[0] || null;
    const empty = isEmpty(current);
    const calibrated = calibrateFieldConfidence({
      ocrConfidence: input.fieldConfidence?.[fieldName] ?? input.ocrConfidence,
      validationStatus: empty ? VALIDATION_STATUS.UNKNOWN : validation.status,
      empty,
      crossFieldOk: !relational.issues.some((i) => i.fieldName === fieldName),
      providerAgreement: providerAvailability.availableProviderCount >= 2 && !ensemble.disagreement,
      assetMatch: asset.matched && !asset.conflicts.length,
      learnedPattern: Boolean(learned.fieldReviews?.[fieldName]?.learningApplied),
      currencyVeto: veto.blocked,
      disagreement: ensemble.disagreement,
    });

    let decision = calibrated.decision;
    let reason = learned.fieldReviews?.[fieldName]?.reason || null;
    const codes = [...ensemble.errorCodes];
    const canPromoteFromDocument =
      Boolean(top) &&
      !isEmpty(top?.value) &&
      (top?.validationState === VALIDATION_STATUS.VALID ||
        top?.validationState === VALIDATION_STATUS.LIKELY) &&
      valuePresentInDocument(input.rawText || '', top?.value) &&
      !currencyAsIdentifierVeto(fieldName, top?.value).blocked;
    if (empty) {
      if (top && canPromoteFromDocument && input.applyOverrides !== false) {
        recommendedPatches[fieldName] = top.value as string | number;
        flat[fieldName] = top.value;
        decision = REVIEW_DECISION.REVIEW_RECOMMENDED;
        reason = 'Value is present on the document but was not taken from the primary OCR field.';
      } else {
        decision = REVIEW_DECISION.NOT_FOUND;
        reason = null;
        codes.push(OCR_ERROR.OCR_FIELD_NOT_FOUND);
      }
    } else if (veto.blocked) {
      decision = REVIEW_DECISION.REJECT_CANDIDATE;
      reason = veto.reason;
      codes.push(veto.code || OCR_ERROR.OCR_CURRENCY_AS_IDENTIFIER);
      if (top && String(top.value) !== String(current) && (top.validationState === VALIDATION_STATUS.VALID || top.validationState === VALIDATION_STATUS.LIKELY) && !currencyAsIdentifierVeto(fieldName, top.value).blocked) {
        recommendedPatches[fieldName] = top.value as string | number;
        flat[fieldName] = top.value;
        decision = REVIEW_DECISION.REVIEW_RECOMMENDED;
        reason = `Vetoed invalid candidate "${current}" and promoted valid document candidate "${top.value}".`;
      } else {
        flat[fieldName] = null;
        recommendedPatches[fieldName] = null;
      }
    } else if (
      validation.status === VALIDATION_STATUS.INVALID ||
      validation.status === VALIDATION_STATUS.SUSPICIOUS
    ) {
      if (
        top &&
        !isEmpty(top.value) &&
        String(top.value) !== String(current) &&
        top.validationState === VALIDATION_STATUS.VALID
      ) {
        recommendedPatches[fieldName] = top.value as string | number;
        flat[fieldName] = top.value;
        decision = REVIEW_DECISION.REVIEW_RECOMMENDED;
        reason = top.reviewReason || 'A stronger typed candidate replaced a semantically invalid OCR value.';
      }
    }

    const needsReview =
      decision === REVIEW_DECISION.REVIEW_RECOMMENDED ||
      decision === REVIEW_DECISION.MANUAL_ENTRY_REQUIRED ||
      decision === REVIEW_DECISION.REJECT_CANDIDATE;

    if (needsReview && reason) reviewReasons.push(`${fieldName}: ${reason}`);

    fieldDecisions[fieldName] = {
      fieldName,
      value: decision === REVIEW_DECISION.NOT_FOUND ? null : flat[fieldName],
      ocrConfidence: calibrated.ocrConfidence,
      semanticConfidence: calibrated.semanticConfidence,
      finalConfidence: calibrated.finalConfidence,
      decision,
      validationState:
        decision === REVIEW_DECISION.NOT_FOUND
          ? VALIDATION_STATUS.UNKNOWN
          : empty && top
            ? top.validationState
            : validation.status,
      reason,
      errorCodes: [...new Set(codes)],
      topCandidate: top,
      needsReview,
    };
  }

  const timings = {
    totalMs: Date.now() - t0,
  };

  const requiresReview =
    learned.requiresReview ||
    classification.documentType === UNKNOWN_DOCUMENT_STRUCTURE ||
    classification.documentType === DOCUMENT_TYPE_UNCERTAIN ||
    Boolean(asset.code) ||
    lineItems.reviewRequired ||
    relational.issues.length > 0 ||
    Object.values(fieldDecisions).some((d) => d.needsReview);

  return {
    documentType: classification.documentType,
    documentTypeConfidence: classification.documentTypeConfidence,
    classificationReasons: classification.classificationReasons,
    fields: { ...sourceFields, ...recommendedPatches },
    flatFields: flat,
    fieldDecisions,
    fieldReviews: learned.fieldReviews,
    recommendedPatches,
    reviewReasons: [...new Set(reviewReasons.filter(Boolean))],
    errorCodes: [...new Set(errorCodes)],
    requiresReview,
    assetIdentity: asset,
    lineItems,
    imageQuality: quality,
    amountCheck: relational.amountCheck,
    timings,
    appliedOverrides: learned.appliedOverrides,
    providerAvailability,
  };
}

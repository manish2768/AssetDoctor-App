/**
 * Phase 15 — field-level evaluation of a document through Phase 14.
 * Records raw / normalized / confidence / validator / decision. Never invents provider text.
 */

import { hardenOcrUnderstanding } from '../phase14/hardeningOrchestrator.ts';
import { REVIEW_DECISION } from '../phase14/semanticConfidence.ts';
import { mapPipelineCodes } from './failureTaxonomy.ts';
import type { RedactedDocumentFixture } from './redactedCorpus.ts';

export interface FieldCard {
  field: string;
  expected: unknown;
  rawOcrValue: unknown;
  normalizedValue: unknown;
  providerSource: string;
  ocrConfidence: number | null;
  semanticConfidence: number | null;
  validatorResult: string | null;
  crossFieldResult: string;
  learningInfluence: boolean;
  finalDecision: string;
  status: 'PASS' | 'FAIL' | 'NOT_FOUND' | 'SKIP';
  labCodes: string[];
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function valuesMatch(expected: unknown, actual: unknown): boolean {
  if (expected == null || expected === '') return actual == null || String(actual).trim() === '';
  if (typeof expected === 'number') return Number(actual) === expected;
  const a = normalize(actual);
  const e = normalize(expected);
  if (!e) return !a;
  return a === e || a.includes(e) || e.includes(a);
}

export function evaluateFixture(fixture: RedactedDocumentFixture) {
  const poisoned = { ...(fixture.poisonedFields || {}) };
  const hardened = hardenOcrUnderstanding({
    documentType: fixture.expectedType === 'UNKNOWN_DOCUMENT_STRUCTURE' ? undefined : fixture.expectedType,
    fields: { ...poisoned },
    rawText: fixture.rawText,
    applyOverrides: true,
  });

  const cards: FieldCard[] = [];
  const keys = Object.keys(fixture.expect);
  for (const field of keys) {
    const expected = fixture.expect[field];
    const decision = hardened.fieldDecisions[field];
    const actual = decision?.value ?? hardened.flatFields[field] ?? hardened.recommendedPatches[field];
    const emptyExpected = expected == null || expected === '';
    let status: FieldCard['status'] = 'SKIP';
    if (emptyExpected) {
      status = !actual || String(actual).trim() === '' || decision?.decision === REVIEW_DECISION.NOT_FOUND
        ? 'NOT_FOUND'
        : 'FAIL';
    } else if (valuesMatch(expected, actual)) {
      status = 'PASS';
    } else {
      status = 'FAIL';
    }
    cards.push({
      field,
      expected,
      rawOcrValue: poisoned[field] ?? null,
      normalizedValue: actual ?? null,
      providerSource: decision?.topCandidate?.source || 'winner_text',
      ocrConfidence: decision?.ocrConfidence ?? null,
      semanticConfidence: decision?.semanticConfidence ?? null,
      validatorResult: decision?.validationState || null,
      crossFieldResult: (hardened.errorCodes || []).join(',') || 'none',
      learningInfluence: Boolean(hardened.fieldReviews?.[field]?.learningApplied),
      finalDecision: decision?.decision || 'ABSENT',
      status: status === 'NOT_FOUND' && emptyExpected ? 'PASS' : status,
      labCodes: mapPipelineCodes(decision?.errorCodes || hardened.errorCodes || []),
    });
  }

  const typeOk =
    fixture.expectedType === 'UNKNOWN_DOCUMENT_STRUCTURE'
      ? hardened.documentType === 'UNKNOWN_DOCUMENT_STRUCTURE' ||
        hardened.documentType === 'DOCUMENT_TYPE_UNCERTAIN' ||
        hardened.documentType === 'GENERIC_DOCUMENT'
      : hardened.documentType === fixture.expectedType ||
        (fixture.expectedType === 'PURCHASE_INVOICE' &&
          (hardened.documentType === 'ELECTRONICS_INVOICE' ||
            hardened.documentType === 'APPLIANCE_INVOICE' ||
            hardened.documentType === 'PURCHASE_INVOICE'));

  const forcedBill = hardened.documentType === 'bill' || hardened.classificationReasons?.includes('forced_bill');
  const forbiddenHit = fixture.forbiddenTypes.some(
    (t) => String(hardened.documentType).toUpperCase() === String(t).toUpperCase() || hardened.documentType === t,
  );

  return {
    id: fixture.id,
    category: fixture.category,
    expectedType: fixture.expectedType,
    actualType: hardened.documentType,
    typeOk: typeOk && !forcedBill && !forbiddenHit,
    forcedBill,
    cards,
    fieldPass: cards.filter((c) => c.status === 'PASS').length,
    fieldFail: cards.filter((c) => c.status === 'FAIL').length,
    errorCodes: hardened.errorCodes,
    labCodes: mapPipelineCodes(hardened.errorCodes || []),
    requiresReview: hardened.requiresReview,
    providerAvailability: hardened.providerAvailability,
  };
}

export function summarizeLab(results: ReturnType<typeof evaluateFixture>[]) {
  const fieldPass = results.reduce((n, r) => n + r.fieldPass, 0);
  const fieldFail = results.reduce((n, r) => n + r.fieldFail, 0);
  return {
    documents: results.length,
    typePass: results.filter((r) => r.typeOk).length,
    typeFail: results.filter((r) => !r.typeOk).length,
    fieldPass,
    fieldFail,
    source: 'REDACTED_SYNTHETIC_CORPUS',
    productionTelemetry: 'TELEMETRY NOT AVAILABLE',
  };
}

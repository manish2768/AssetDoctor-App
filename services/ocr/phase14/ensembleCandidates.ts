/**
 * Phase 14 — preserve candidates from all already-captured OCR texts.
 * Does not re-call providers. Does not invent values.
 */

import { generateFieldCandidates } from '../../intelligence/documentLearning/candidateEngine.ts';
import type { FieldCandidate, LearningPattern } from '../../intelligence/documentLearning/types.ts';
import { VALIDATION_STATUS } from '../../intelligence/documentLearning/types.ts';
import { currencyAsIdentifierVeto, identifierAsAmountVeto } from './currencyProtection.ts';
import { OCR_ERROR } from './errorTaxonomy.ts';
import { validateInvoiceNumberNotDate } from './extendedValidators.ts';

export interface ProviderTexts {
  google?: string | null;
  azure?: string | null;
  mlkit?: string | null;
  winner?: string | null;
}

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
  'odometerKm',
];

export function describeProviderAvailability(
  providerTexts: ProviderTexts = {},
  rawText = '',
): {
  google: boolean;
  azure: boolean;
  mlkit: boolean;
  winner: boolean;
  availableProviderCount: number;
  mode: string;
  unavailable: string[];
} {
  const usable = (text?: string | null) => String(text || '').trim().length >= 8;
  const google = usable(providerTexts.google);
  const azure = usable(providerTexts.azure);
  const mlkit = usable(providerTexts.mlkit);
  const winner = usable(providerTexts.winner || rawText);
  const availableProviderCount = [google, azure, mlkit].filter(Boolean).length;
  const unavailable: string[] = [];
  if (!google) unavailable.push('google');
  if (!azure) unavailable.push('azure');
  if (!mlkit) unavailable.push('mlkit');
  let mode = 'PROVIDER_CANDIDATE_TELEMETRY_UNAVAILABLE';
  if (availableProviderCount >= 3) mode = 'MULTI_PROVIDER';
  else if (availableProviderCount === 2) mode = 'DUAL_PROVIDER';
  else if (availableProviderCount === 1) mode = 'SINGLE_PROVIDER';
  else if (winner) mode = 'WINNER_TEXT_ONLY';
  return { google, azure, mlkit, winner, availableProviderCount, mode, unavailable };
}

function uniqueTexts(providerTexts: ProviderTexts = {}, rawText = ''): Array<{ provider: string; text: string }> {
  const rows: Array<{ provider: string; text: string }> = [];
  const seen = new Set<string>();
  const push = (provider: string, text?: string | null) => {
    const t = String(text || '').trim();
    if (t.length < 8) return;
    const key = t.slice(0, 400);
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ provider, text: t });
  };
  push('winner', providerTexts.winner || rawText);
  push('google', providerTexts.google);
  push('azure', providerTexts.azure);
  push('mlkit', providerTexts.mlkit);
  return rows;
}

function mergeCandidates(list: FieldCandidate[]): FieldCandidate[] {
  const byValue = new Map<string, FieldCandidate>();
  for (const c of list) {
    const key = String(c.value ?? '').trim();
    if (!key) continue;
    const prev = byValue.get(key);
    if (!prev || c.score > prev.score) byValue.set(key, c);
  }
  return [...byValue.values()].sort((a, b) => b.score - a.score);
}

export function buildEnsembleCandidates(opts: {
  fieldName: string;
  currentValue: unknown;
  documentType: string;
  rawText?: string;
  providerTexts?: ProviderTexts;
  allFields?: Record<string, unknown>;
  ocrConfidence?: number;
  patterns?: LearningPattern[];
}): { candidates: FieldCandidate[]; disagreement: boolean; errorCodes: string[] } {
  const sources = uniqueTexts(opts.providerTexts, opts.rawText || '');
  const all: FieldCandidate[] = [];
  const errorCodes: string[] = [];

  for (const src of sources) {
    const generated = generateFieldCandidates({
      fieldName: opts.fieldName,
      currentValue: opts.currentValue,
      documentType: opts.documentType,
      rawText: src.text,
      allFields: opts.allFields || {},
      ocrConfidence: opts.ocrConfidence,
      patterns: opts.patterns || [],
    });
    for (const c of generated) {
      all.push({
        ...c,
        evidence: [c.evidence, `provider:${src.provider}`].filter(Boolean).join(' '),
      });
    }
  }

  const vetoed: FieldCandidate[] = [];
  for (const c of all) {
    const currency = currencyAsIdentifierVeto(opts.fieldName, c.value);
    const ident = identifierAsAmountVeto(opts.fieldName, c.value);
    const dateAsInvoice =
      opts.fieldName === 'invoiceNumber' && validateInvoiceNumberNotDate(c.value);
    if (currency.blocked) {
      errorCodes.push(OCR_ERROR.OCR_CURRENCY_AS_IDENTIFIER);
      vetoed.push({
        ...c,
        score: 0,
        validationState: VALIDATION_STATUS.INVALID,
        reviewReason: currency.reason || c.reviewReason,
      });
      continue;
    }
    if (ident.blocked) {
      errorCodes.push(OCR_ERROR.OCR_IDENTIFIER_AS_AMOUNT);
      vetoed.push({
        ...c,
        score: 0,
        validationState: VALIDATION_STATUS.INVALID,
        reviewReason: ident.reason || c.reviewReason,
      });
      continue;
    }
    if (dateAsInvoice) {
      errorCodes.push(OCR_ERROR.OCR_FIELD_TYPE_MISMATCH);
      vetoed.push({
        ...c,
        score: 0,
        validationState: VALIDATION_STATUS.INVALID,
        reviewReason: 'Invoice number cannot be a date',
      });
      continue;
    }
    vetoed.push(c);
  }

  const merged = mergeCandidates(vetoed);
  const validDistinct = merged.filter((c) => c.validationState === VALIDATION_STATUS.VALID);
  const disagreement = validDistinct.length >= 2 && sources.length >= 2;

  if (disagreement) errorCodes.push(OCR_ERROR.OCR_PROVIDER_DISAGREEMENT);

  return {
    candidates: merged,
    disagreement,
    errorCodes: [...new Set(errorCodes)],
  };
}

export { RANK_FIELDS };

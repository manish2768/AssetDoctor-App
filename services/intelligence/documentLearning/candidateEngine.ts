/**
 * Phase 13 — Ranked candidate engine.
 * Does not blindly take the first OCR match. Never invents missing values.
 * Trusted/emerging patterns influence ranking (Phase G).
 */

import {
  PATTERN_STATUS,
  VALIDATION_STATUS,
  VALUE_SHAPES,
  type FieldCandidate,
  type LearningPattern,
  type ValidationStatus,
  type ValueShape,
} from './types.ts';
import { validateField } from './fieldValidators.ts';
import { classifyValueShape, rejectPatternName, preferPatternName } from './valueShape.ts';
import { crossFieldScore, documentTypeFieldLeak } from './crossFieldIntelligence.ts';

const LABEL_HINTS: Record<string, RegExp> = {
  imei: /\bIMEI\b/i,
  shopGstin: /\bGSTIN\b|\bGST\s*IN\b/i,
  gstin: /\bGSTIN\b/i,
  customerPhone: /\b(?:phone|mobile|tel)\b/i,
  invoiceNumber: /\binvoice\s*(?:no|number|#)\b/i,
  registration: /\b(?:reg(?:istration)?(?:\s*(?:no|number|n[o.]{1,2}))?|vehicle\s*no)\b/i,
  chassisNumber: /\b(?:chassis|vin|frame\s*no)\b/i,
  engineNumber: /\bengine\s*(?:no|number)\b/i,
  serialNumber: /\bserial\s*(?:no|number)\b/i,
  totalAmount: /\b(?:grand\s*)?total|net\s*amount|amount\s*payable\b/i,
  policyNumber: /\bpolicy\s*(?:no|number)\b/i,
  odometerKm: /\b(?:odometer|current\s*km|km\s*reading|meter\s*reading|\bodo\b|running\s*km)\b/i,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function expectedShape(fieldName: string): ValueShape | null {
  switch (fieldName) {
    case 'imei':
      return VALUE_SHAPES.IMEI;
    case 'shopGstin':
    case 'gstin':
      return VALUE_SHAPES.GSTIN;
    case 'customerPhone':
    case 'phone':
      return VALUE_SHAPES.PHONE;
    case 'invoiceNumber':
      return VALUE_SHAPES.INVOICE_NUMBER;
    case 'registration':
      return VALUE_SHAPES.VEHICLE_REG;
    case 'chassisNumber':
      return VALUE_SHAPES.VIN;
    case 'engineNumber':
      return VALUE_SHAPES.ENGINE;
    case 'serialNumber':
      return VALUE_SHAPES.SERIAL;
    case 'totalAmount':
      return VALUE_SHAPES.CURRENCY_AMOUNT;
    case 'policyNumber':
      return VALUE_SHAPES.POLICY_NUMBER;
    default:
      return null;
  }
}

function formatScore(status: ValidationStatus): number {
  switch (status) {
    case VALIDATION_STATUS.VALID:
      return 1;
    case VALIDATION_STATUS.LIKELY:
      return 0.7;
    case VALIDATION_STATUS.UNKNOWN:
      return 0.4;
    case VALIDATION_STATUS.SUSPICIOUS:
      return 0.25;
    case VALIDATION_STATUS.INVALID:
    default:
      return 0;
  }
}

function patternWeight(status: string): number {
  if (status === PATTERN_STATUS.TRUSTED) return 1;
  if (status === PATTERN_STATUS.EMERGING) return 0.65;
  if (status === PATTERN_STATUS.CANDIDATE) return 0.25;
  return 0;
}

export function learnedPatternSupport(opts: {
  fieldName: string;
  valueShape: ValueShape;
  documentType: string;
  patterns: LearningPattern[];
}): { score: number; applied: boolean; labels: string[] } {
  const patterns = (opts.patterns || []).filter(
    (p) =>
      p &&
      p.status !== PATTERN_STATUS.REJECTED &&
      String(p.fieldName).toLowerCase() === String(opts.fieldName).toLowerCase() &&
      String(p.documentType).toUpperCase() === String(opts.documentType).toUpperCase(),
  );
  if (!patterns.length) return { score: 0.5, applied: false, labels: [] };

  let boost = 0;
  let penalty = 0;
  const labels: string[] = [];
  const rejectName = rejectPatternName(opts.fieldName, opts.valueShape);
  const preferName = preferPatternName(opts.fieldName, opts.valueShape);

  for (const p of patterns) {
    const w = patternWeight(p.status) * clamp01(p.confidence || 0.5);
    if (p.normalizedPattern === rejectName || p.semanticLabel === rejectName) {
      penalty += w;
      labels.push(p.normalizedPattern);
    }
    if (p.normalizedPattern === preferName || p.semanticLabel === preferName) {
      boost += w;
      labels.push(p.normalizedPattern);
    }
  }
  const applied = labels.length > 0;
  const score = clamp01(0.5 + boost * 0.5 - penalty * 0.5);
  return { score, applied, labels };
}

function semanticProximity(fieldName: string, rawText: string, value: unknown): number {
  const text = String(rawText || '');
  const token = String(value ?? '').trim();
  if (!token) return 0;
  const hint = LABEL_HINTS[fieldName];
  const idx = text.toUpperCase().indexOf(token.toUpperCase());
  if (idx < 0) return 0.35;
  const window = text.slice(Math.max(0, idx - 48), Math.min(text.length, idx + token.length + 16));
  if (hint && hint.test(window)) return 1;
  if (hint && hint.test(text)) return 0.55;
  return 0.4;
}

function documentTypeFit(fieldName: string, documentType: string): number {
  const leak = documentTypeFieldLeak(documentType, fieldName, 'x');
  if (leak && fieldName === leak.fieldName) {
    // leak helper requires a value; use a dummy — actual leak checked in crossField
  }
  const electronics = documentType === 'ELECTRONICS_INVOICE' || documentType === 'APPLIANCE_INVOICE';
  if (electronics && (fieldName === 'imei' || fieldName === 'serialNumber' || fieldName === 'totalAmount')) return 1;
  if (documentType === 'SERVICE_INVOICE' && (fieldName === 'registration' || fieldName === 'odometerKm' || fieldName === 'totalAmount')) return 1;
  if (documentType === 'INSURANCE_POLICY' && (fieldName === 'policyNumber' || fieldName === 'registration')) return 1;
  if ((fieldName === 'policyNumber' || fieldName === 'idvAmount') && documentType === 'SERVICE_INVOICE') return 0;
  if ((fieldName === 'odometerKm' || fieldName === 'labourCharges') && documentType === 'INSURANCE_POLICY') return 0;
  return 0.6;
}

export function scoreCandidate(opts: {
  fieldName: string;
  value: string | number | null;
  documentType: string;
  rawText?: string;
  allFields?: Record<string, unknown>;
  ocrConfidence?: number;
  source?: FieldCandidate['source'];
  isCurrentSelection?: boolean;
  patterns?: LearningPattern[];
  layoutBoost?: number;
}): FieldCandidate {
  const value = opts.value;
  const validation = validateField(opts.fieldName, value);
  const shape = classifyValueShape(value);
  const cross = crossFieldScore(opts.fieldName, value, opts.allFields || {});
  const leak = documentTypeFieldLeak(opts.documentType, opts.fieldName, value);
  const learned = learnedPatternSupport({
    fieldName: opts.fieldName,
    valueShape: shape,
    documentType: opts.documentType,
    patterns: opts.patterns || [],
  });
  const ocr = clamp01(opts.ocrConfidence ?? (opts.isCurrentSelection ? 0.9 : 0.55));
  const semantic = semanticProximity(opts.fieldName, opts.rawText || '', value);
  const format = formatScore(validation.status);
  const typeFit = documentTypeFit(opts.fieldName, opts.documentType);
  const layout = clamp01(opts.layoutBoost ?? 0.5);
  const expected = expectedShape(opts.fieldName);
  const shapeFit = expected && shape === expected ? 1 : expected && shape !== VALUE_SHAPES.EMPTY ? 0.2 : 0.5;
  const currentBonus = opts.isCurrentSelection ? 8 : 0;
  const leakPenalty = leak ? 12 : 0;

  const score =
    25 * ocr +
    18 * semantic +
    10 * typeFit +
    18 * format +
    8 * layout +
    12 * cross.score +
    22 * learned.score +
    8 * shapeFit +
    currentBonus -
    leakPenalty;

  const issues = [...cross.issues, ...(leak ? [leak] : [])];
  const reviewReason =
    issues.find((i) => !i.compatible)?.reason ||
    (validation.status === VALIDATION_STATUS.INVALID || validation.status === VALIDATION_STATUS.SUSPICIOUS
      ? validation.reason || null
      : null);

  let validationState = validation.status;
  if (issues.some((i) => i.status === VALIDATION_STATUS.INVALID)) validationState = VALIDATION_STATUS.INVALID;
  else if (issues.some((i) => i.status === VALIDATION_STATUS.SUSPICIOUS) && validationState === VALIDATION_STATUS.VALID) {
    validationState = VALIDATION_STATUS.SUSPICIOUS;
  }

  return {
    fieldName: opts.fieldName,
    value,
    score: Math.round(Math.max(0, score) * 10) / 10,
    ocrConfidence: ocr,
    semanticProximity: semantic,
    formatScore: format,
    crossFieldScore: cross.score,
    learnedScore: learned.score,
    validationState,
    valueShape: shape,
    source: opts.source || (opts.isCurrentSelection ? 'OCR_SELECTED' : 'TOKEN_SCAN'),
    evidence: reviewReason || undefined,
    learningApplied: learned.applied,
    reviewReason: reviewReason || undefined,
  };
}

const TOKEN_PATTERNS: Array<{ shape: ValueShape; re: RegExp }> = [
  { shape: VALUE_SHAPES.GSTIN, re: /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/gi },
  { shape: VALUE_SHAPES.IMEI, re: /\b[0-9]{15}\b/g },
  { shape: VALUE_SHAPES.VEHICLE_REG, re: /\b[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}\b/gi },
  { shape: VALUE_SHAPES.VIN, re: /\b[A-HJ-NPR-Z0-9]{17}\b/gi },
  { shape: VALUE_SHAPES.PHONE, re: /\b[6-9][0-9]{9}\b/g },
  { shape: VALUE_SHAPES.CURRENCY_AMOUNT, re: /(?:₹|Rs\.?)\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi },
  { shape: VALUE_SHAPES.INVOICE_NUMBER, re: /\b[A-Z]{1,4}[-/][A-Z0-9][A-Z0-9\-/]{2,}\b/gi },
];

export function extractCandidateTokens(rawText: string): Array<{ value: string; shape: ValueShape }> {
  const text = String(rawText || '');
  const found: Array<{ value: string; shape: ValueShape }> = [];
  const seen = new Set<string>();
  for (const { shape, re } of TOKEN_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    const copy = new RegExp(re.source, re.flags);
    while ((m = copy.exec(text))) {
      const value = (m[1] || m[0] || '').trim();
      if (!value) continue;
      const key = `${shape}:${value.toUpperCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ value, shape });
    }
  }
  return found;
}

export function generateFieldCandidates(opts: {
  fieldName: string;
  currentValue: unknown;
  documentType: string;
  rawText?: string;
  providerTexts?: Record<string, string | null>;
  allFields?: Record<string, unknown>;
  ocrConfidence?: number;
  patterns?: LearningPattern[];
}): FieldCandidate[] {
  const current =
    opts.currentValue == null || String(opts.currentValue).trim() === '' ? null : opts.currentValue;
  const combinedText = `${opts.rawText || ''} ${Object.values(opts.providerTexts || {}).filter(Boolean).join(' ')}`;
  const tokens = extractCandidateTokens(combinedText);
  const ranked: FieldCandidate[] = [];
  const seen = new Set<string>();

  const push = (value: string | number | null, extra: Partial<Parameters<typeof scoreCandidate>[0]>) => {
    if (value == null || String(value).trim() === '') return;
    const key = String(value).toUpperCase().replace(/\s+/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    ranked.push(
      scoreCandidate({
        fieldName: opts.fieldName,
        value,
        documentType: opts.documentType,
        rawText: combinedText,
        allFields: opts.allFields,
        ocrConfidence: extra.ocrConfidence,
        source: extra.source,
        isCurrentSelection: extra.isCurrentSelection,
        patterns: opts.patterns,
        layoutBoost: extra.layoutBoost,
      }),
    );
  };

  if (current != null) {
    push(typeof current === 'number' ? current : String(current), {
      isCurrentSelection: true,
      ocrConfidence: opts.ocrConfidence ?? 0.88,
      source: 'OCR_SELECTED',
    });
  }

  for (const token of tokens) {
    push(token.value, {
      source: 'TOKEN_SCAN',
      ocrConfidence: 0.58,
      layoutBoost: 0.45,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

export function selectRankedValue(candidates: FieldCandidate[]): FieldCandidate | null {
  if (!candidates.length) return null;
  return candidates[0];
}

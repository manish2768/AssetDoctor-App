/**
 * Phase 11.2 — field-safety validation / normalization.
 * Provider text is not trusted as HIGH_CONFIDENCE until the field validator passes.
 * Never logs raw OCR / document content.
 */

import type { ExtractedField, FieldStatus, UniversalExtractedData, VerificationConfidenceTier } from './types.ts';
import {
  validateGSTIN,
  validateIMEI,
  validateIndianRegistration,
  validateMonetaryAmount,
  validateVIN,
} from './fieldChecksumValidators.ts';
import {
  isAbsurdPurchaseAmount,
  isIdentifierMoneyDigits,
  parseInvoiceMoney,
} from '../../src/services/ocr/invoiceAmountGuard.js';
import { selectGrandTotal } from '../../src/services/ocr/grandTotalSelection.js';

export { isIdentifierMoneyDigits, parseInvoiceMoney, isAbsurdPurchaseAmount };

const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const INDIAN_PHONE = /^[6-9]\d{9}$/;
const PLATE_SHAPE = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
const BHARAT_SHAPE = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

const FINANCIAL_KEYS = new Set([
  'totalAmount',
  'purchasePrice',
  'finalAmount',
  'taxAmount',
  'taxableAmount',
  'labourCharges',
  'partsTotal',
  'discountAmount',
  'premiumAmount',
  'idvAmount',
]);

const REGISTRATION_KEYS = new Set([
  'vehicleRegistration',
  'registrationNumber',
  'registration',
]);

const IMEI_KEYS = new Set(['imei']);

const REG_LABEL_RE =
  /(?:Vehicle\s*Reg(?:istration)?(?:\s*(?:No\.?|Num|Number)?)?|Regn\.?\s*(?:No\.?|Num|Number)?|\bReg\s*(?:No\.?|Num|Number)?|Registration(?:\s*(?:No\.?|Num|Number))?|Vehicle\s*(?:No\.?|Number)|Veh\.?\s*No\.?|RTO\s*(?:No\.?|Number)?|RegNo\.?|REG\s*#?|वाहन\s*(?:संख्या|नंबर))[\s:\-\.#]*[\n\r]?[\s:\-\.#]*/i;

const REG_VALUE_RE =
  /([A-Za-z]{2}[\s\-]?[0-9]{1,2}[\s\-]?[A-Za-z]{0,3}[\s\-]?[0-9]{3,4}|[0-9]{2}\s*BH\s*[0-9]{4}\s*[A-Za-z]{1,2})/;

export function compactAlnum(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function compactDigits(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}

export function looksLikeGstin(value: unknown): boolean {
  const clean = compactAlnum(value);
  if (clean.length !== 15) return false;
  if (GSTIN_SHAPE.test(clean)) return true;
  return Boolean(validateGSTIN(clean).valid);
}

export function looksLikeImei(value: unknown): boolean {
  return compactDigits(value).length === 15;
}

export function looksLikeIndianPhone(value: unknown): boolean {
  let digits = compactDigits(value);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return INDIAN_PHONE.test(digits);
}

export function normalizeIndianPhone(value: unknown): string | null {
  let digits = compactDigits(value);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return INDIAN_PHONE.test(digits) ? digits : null;
}

export function looksLikeIndianRegistration(value: unknown): boolean {
  const clean = compactAlnum(value);
  if (looksLikeGstin(clean)) return false;
  if (BHARAT_SHAPE.test(clean)) return true;
  if (!PLATE_SHAPE.test(clean) || clean.length < 8 || clean.length > 11) return false;
  return true;
}

export function looksLikeChassisVin(value: unknown): boolean {
  const clean = compactAlnum(value);
  if (clean.length < 12 || clean.length > 17) return false;
  if (/^\d+$/.test(clean) && (looksLikeImei(clean) || looksLikeIndianPhone(clean))) return false;
  return /[A-Z]/.test(clean) && /\d/.test(clean);
}

export function looksLikeEngineNumber(value: unknown): boolean {
  const clean = compactAlnum(value);
  if (clean.length < 6 || clean.length > 16) return false;
  if (looksLikeGstin(clean) || looksLikeImei(clean) || looksLikeIndianPhone(clean)) return false;
  if (looksLikeIndianRegistration(clean)) return false;
  return /[A-Z0-9]/.test(clean);
}

export function looksLikeInvoiceIdentifier(value: unknown): boolean {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/[A-Za-z]/.test(raw) && /\d/.test(raw) && /[\/\-_]/.test(raw)) return true;
  const digits = compactDigits(raw);
  return digits.length >= 8 && digits.length <= 12 && !String(raw).includes('.') && /[A-Za-z]/.test(raw);
}

export function isForbiddenFinancialToken(raw: unknown): boolean {
  if (raw == null || raw === '') return false;
  const asString = String(raw).trim();
  if (isIdentifierMoneyDigits(asString)) return true;
  if (looksLikeImei(asString)) return true;
  if (looksLikeIndianPhone(asString)) return true;
  if (looksLikeGstin(asString)) return true;
  if (looksLikeIndianRegistration(asString) && !/\d{1,3}(?:,\d{2,3})+/.test(asString)) return true;
  if (looksLikeChassisVin(asString)) return true;
  if (looksLikeEngineNumber(asString) && /[A-Z]/i.test(asString)) return true;
  if (looksLikeInvoiceIdentifier(asString) && compactDigits(asString).length >= 10) return true;
  const parsed = typeof raw === 'number' ? raw : parseInvoiceMoney(asString);
  if (parsed != null && isAbsurdPurchaseAmount(parsed)) return true;
  return false;
}

export function parseSafeAmount(raw: unknown): number | null {
  if (isForbiddenFinancialToken(raw)) return null;
  const parsed = parseInvoiceMoney(raw);
  if (parsed == null) return null;
  if (isForbiddenFinancialToken(parsed)) return null;
  const money = validateMonetaryAmount(parsed, true);
  if (!money.valid) return null;
  return money.normalized;
}

const LABELED_TOTAL_REASONS = new Set([
  'grand_total',
  'amount_payable',
  'total_invoice_value',
  'invoice_total',
  'net_total',
  'total_amount',
  'ex_showroom',
  'amount_in_words',
  'repeated_line_total',
  'tot',
  'total_bare',
  'total_price',
  'final_amount',
]);

const LINE_AMOUNT_RE =
  /(?:₹|Rs\.?|INR)?\s*((?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{2})?)/gi;

const TOTAL_LABEL_RULES: Array<{ id: string; re: RegExp }> = [
  { id: 'grand_total', re: /grand\s*tot[ae]l/i },
  { id: 'amount_payable', re: /amount\s*payable|net\s*payable/i },
  { id: 'total_invoice_value', re: /total\s*invoice\s*value/i },
  { id: 'invoice_total', re: /invoice\s*total/i },
  { id: 'net_total', re: /net\s*total|net\s*amount/i },
  { id: 'total_amount', re: /total\s*amount(?:\s*payable)?/i },
  { id: 'ex_showroom', re: /ex[\s\-]?showroom\s*price|on[\s\-]?road\s*price/i },
  { id: 'total_price', re: /total\s*price/i },
  { id: 'final_amount', re: /final\s*amount|payable\s*amount|total\s*payable/i },
  // Abbreviated "TOT" footer label (e.g. "TOT: 260"). Word-bounded so it never
  // collides with full "total" labels. Lowest priority.
  { id: 'tot', re: /\btot\b/i },
  // Bare "Total:" / "Total ₹" footer label not already matched above.
  { id: 'total_bare', re: /\btotal\b:(?!\s*amount)|\btotal\b(?!\s*(?:amount|price|payable|invoice|value|tax))/i },
];

export function amountsOnLabeledLine(line: string): number[] {
  const out: number[] = [];
  LINE_AMOUNT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINE_AMOUNT_RE.exec(line))) {
    const raw = m[1];
    if (compactDigits(raw).length >= 10 && !String(raw).includes(',') && !String(raw).includes('.')) {
      continue;
    }
    const n = parseSafeAmount(raw);
    if (n != null && n > 5) out.push(n);
  }
  return out;
}

export function extractLabeledGrandTotal(rawText: string): {
  amount: number | null;
  evidence: string;
  reason: string;
} {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const rule of TOTAL_LABEL_RULES) {
    for (const line of lines) {
      if (/(?:cgst|sgst|igst|taxable\s*value)\b/i.test(line) && !/grand\s*total|amount\s*payable/i.test(line)) {
        continue;
      }
      if (!rule.re.test(line)) continue;
      const amts = amountsOnLabeledLine(line);
      if (!amts.length) continue;
      const chosen = amts[amts.length - 1];
      if (isForbiddenFinancialToken(chosen)) continue;
      return { amount: chosen, evidence: line.slice(0, 80), reason: rule.id };
    }
  }

  const result = selectGrandTotal(rawText);
  if (result?.selected == null) {
    return { amount: null, evidence: '', reason: result?.reason || 'no_labeled_total' };
  }
  if (isForbiddenFinancialToken(result.selected)) {
    return { amount: null, evidence: '', reason: 'identifier_rejected' };
  }
  const labeledHit = (result.candidates || []).find(
    (c: { amount: number; label?: string }) =>
      c.amount === result.selected && LABELED_TOTAL_REASONS.has(String(c.label || '')),
  );
  if (!labeledHit && !LABELED_TOTAL_REASONS.has(String(result.reason || ''))) {
    return { amount: null, evidence: '', reason: 'unlabeled_numeric_fallback_rejected' };
  }
  return {
    amount: result.selected,
    evidence: String(labeledHit?.label || result.reason || 'labeled_total'),
    reason: String(result.reason || 'labeled_total'),
  };
}

export function extractLabeledTaxAmount(rawText: string): number | null {
  return extractLabeledTaxAmountWithEvidence(rawText).amount;
}

export function extractLabeledTaxAmountWithEvidence(rawText: string): { amount: number | null; evidence: string } {
  const m = String(rawText || '').match(
    /(?:Total\s*Tax|GST\s*Amount|Tax\s*Amount|IGST|CGST\s*\+\s*SGST)[^\d\n₹]{0,24}((?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{2})?)/i,
  );
  if (!m) return { amount: null, evidence: '' };
  return { amount: parseSafeAmount(m[1]), evidence: m[0] };
}

export function extractLabeledTaxableAmount(rawText: string): number | null {
  return extractLabeledTaxableAmountWithEvidence(rawText).amount;
}

export function extractLabeledTaxableAmountWithEvidence(rawText: string): { amount: number | null; evidence: string } {
  const m = String(rawText || '').match(
    /(?:Taxable\s*(?:Value|Amount)|Taxable)[^\d\n₹]{0,24}((?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{2})?)/i,
  );
  if (!m) return { amount: null, evidence: '' };
  return { amount: parseSafeAmount(m[1]), evidence: m[0] };
}

export function normalizeIndianRegistration(reg: string | null | undefined): string | null {
  if (!reg) return null;
  const clean = compactAlnum(reg);
  if (!clean) return null;
  if (looksLikeGstin(clean)) return null;
  if (looksLikeImei(clean) || looksLikeIndianPhone(clean)) return null;
  const checked = validateIndianRegistration(clean);
  if (checked.valid) return checked.formatted;
  if (BHARAT_SHAPE.test(clean)) return clean;
  if (PLATE_SHAPE.test(clean) && clean.length >= 8 && clean.length <= 11) return clean;
  return null;
}

export function extractLabeledRegistration(rawText: string): {
  value: string | null;
  evidence: string;
  valid: boolean;
} {
  const text = String(rawText || '');
  const combined = new RegExp(REG_LABEL_RE.source + REG_VALUE_RE.source, 'i');
  const match = text.match(combined);
  if (!match?.[1]) {
    return { value: null, evidence: '', valid: false };
  }
  const normalized = normalizeIndianRegistration(match[1]);
  if (!normalized) {
    return { value: null, evidence: match[0], valid: false };
  }
  const checked = validateIndianRegistration(normalized);
  return {
    value: normalized,
    evidence: match[0],
    valid: Boolean(checked.valid),
  };
}

export function extractLabeledImei(rawText: string): {
  value: string | null;
  evidence: string;
  luhnValid: boolean;
} {
  const match = String(rawText || '').match(
    /(?:IMEI(?:\s*(?:No|Number|1|2))?|IMEI1)[:\s.\-]*([0-9]{15})\b/i,
  );
  if (!match?.[1]) {
    return { value: null, evidence: '', luhnValid: false };
  }
  const digits = compactDigits(match[1]);
  if (digits.length !== 15) {
    return { value: null, evidence: match[0], luhnValid: false };
  }
  const luhn = validateIMEI(digits);
  return { value: digits, evidence: match[0], luhnValid: Boolean(luhn.isLuhnValid) };
}

export function extractLabeledChassisResult(rawText: string): { value: string | null; evidence: string; partialIdentifier: boolean } {
  const text = String(rawText || '');
  const full = text.match(
    /(?:Chassis(?:\s*(?:No|Num|Number))?|VIN|Frame\s*(?:No|Num|Number)?)[^\w\n]*([A-HJ-NPR-Z0-9]{17}|[A-Z0-9]{12,20})/i,
  );
  const partial = text.match(
    /(?:Chassis|VIN|Frame)[^\n]{0,24}(?:last\s*(?:4|four)|suffix|ending)?[^\w\n]*([A-Z0-9]{4,11})\b/i,
  );
  const match = full || partial;
  if (!match?.[1]) return { value: null, evidence: '', partialIdentifier: false };
  const clean = compactAlnum(match[1]);
  if (looksLikeGstin(clean) || looksLikeImei(clean) || looksLikeIndianRegistration(clean)) {
    return { value: null, evidence: match[0], partialIdentifier: false };
  }
  if (full && clean.length >= 10) return { value: clean, evidence: match[0], partialIdentifier: false };
  if (partial && clean.length >= 4) return { value: clean, evidence: match[0], partialIdentifier: true };
  return { value: null, evidence: match[0], partialIdentifier: false };
}

export function extractLabeledChassis(rawText: string): string | null {
  return extractLabeledChassisResult(rawText).value;
}

export function extractLabeledEngineResult(rawText: string): { value: string | null; evidence: string; partialIdentifier: boolean } {
  const text = String(rawText || '');
  const full = text.match(
    /(?:Engine(?:\s*(?:No|Num|Number))?|Motor\s*(?:No|Num|Number))[^\w\n]*([A-Z0-9]{6,16})/i,
  );
  const partial = text.match(
    /(?:Engine|Motor)[^\n]{0,24}(?:last\s*(?:4|four)|suffix|ending)?[^\w\n]*([A-Z0-9]{4,5})\b/i,
  );
  const match = full || partial;
  if (!match?.[1]) return { value: null, evidence: '', partialIdentifier: false };
  const clean = compactAlnum(match[1]);
  if (looksLikeGstin(clean) || looksLikeImei(clean) || looksLikeIndianPhone(clean) || looksLikeIndianRegistration(clean)) {
    return { value: null, evidence: match[0], partialIdentifier: false };
  }
  if (full && clean.length >= 6) return { value: clean, evidence: match[0], partialIdentifier: false };
  if (partial && clean.length >= 4) return { value: clean, evidence: match[0], partialIdentifier: true };
  return { value: null, evidence: match[0], partialIdentifier: false };
}

export function extractLabeledEngine(rawText: string): string | null {
  return extractLabeledEngineResult(rawText).value;
}

export function applyImeiValidation<T>(field: ExtractedField<T>): ExtractedField<T> {
  if (!field || field.value == null || field.value === '') return field;
  const digits = compactDigits(field.value);
  const luhn = validateIMEI(digits);
  field.normalizedValue = (digits.length === 15 ? digits : field.value) as T;
  if (digits.length === 15 && field.value !== digits) {
    field.value = digits as T;
  }
  if (!luhn.valid) {
    field.status = 'NEEDS_REVIEW';
    field.tier = 'NEEDS_REVIEW';
    field.confidence = Math.min(field.confidence, 0.54);
    field.flag = luhn.reason || 'LUHN_CHECKSUM_FAILED';
    field.validationResult = 'FAIL';
    field.validationReason = luhn.reason || 'LUHN_CHECKSUM_FAILED';
  } else {
    field.validationResult = 'PASS';
    field.validationReason = undefined;
    if (field.confidence >= 0.7) {
      field.status = 'HIGH_CONFIDENCE';
      field.tier = 'HIGH_CONFIDENCE';
    }
  }
  return field;
}

export function applyRegistrationValidation<T>(field: ExtractedField<T>): ExtractedField<T> | null {
  if (!field || field.value == null || field.value === '') return field;
  const raw = String(field.value);
  if (looksLikeGstin(raw)) return null;
  const normalized = normalizeIndianRegistration(raw);
  if (!normalized) return null;
  field.value = normalized as T;
  field.normalizedValue = normalized as T;
  const checked = validateIndianRegistration(normalized);
  if (!checked.valid) {
    field.status = 'NEEDS_REVIEW';
    field.tier = 'NEEDS_REVIEW';
    field.confidence = Math.min(field.confidence, 0.65);
    field.validationResult = 'FAIL';
    field.validationReason = checked.reason || 'NON_STANDARD_REGISTRATION_FORMAT';
    field.flag = field.validationReason;
  } else {
    field.validationResult = 'PASS';
    if (field.confidence >= 0.7) {
      field.status = 'HIGH_CONFIDENCE';
      field.tier = 'HIGH_CONFIDENCE';
    }
  }
  return field;
}

function markNeedsReview<T>(field: ExtractedField<T>, reason: string): ExtractedField<T> {
  field.status = 'NEEDS_REVIEW';
  field.tier = 'NEEDS_REVIEW';
  field.confidence = Math.min(field.confidence, 0.54);
  field.validationResult = 'FAIL';
  field.validationReason = reason;
  field.flag = reason;
  return field;
}

function identityTokensFromExtracted(data: UniversalExtractedData): string[] {
  const tokens: string[] = [];
  const groups = Object.values(data || {});
  for (const group of groups) {
    if (!group || typeof group !== 'object') continue;
    const rec = group as Record<string, ExtractedField<unknown>>;
    for (const [key, field] of Object.entries(rec)) {
      if (!field || typeof field !== 'object' || field.value == null) continue;
      if (IMEI_KEYS.has(key) || /imei/i.test(key)) tokens.push(compactDigits(field.value));
      if (REGISTRATION_KEYS.has(key)) tokens.push(compactAlnum(field.value));
      if (/gstin/i.test(key)) tokens.push(compactAlnum(field.value));
      if (/phone/i.test(key)) tokens.push(compactDigits(field.value));
      if (/chassis|vin/i.test(key)) tokens.push(compactAlnum(field.value));
      if (/engine/i.test(key)) tokens.push(compactAlnum(field.value));
      if (/invoiceNumber|invoice_number/i.test(key)) tokens.push(compactAlnum(field.value), compactDigits(field.value));
    }
  }
  return tokens.filter((t) => t.length >= 8);
}

function scrubFinancialField(field: ExtractedField<number>, identityTokens: string[]): ExtractedField<number> | null {
  if (!field || field.value == null) return field;
  const raw = field.value;
  if (isForbiddenFinancialToken(raw)) return null;
  const digits = compactDigits(raw);
  if (identityTokens.some((tok) => tok && (tok === digits || tok === compactAlnum(raw)))) return null;
  const parsed = parseSafeAmount(raw);
  if (parsed == null) return null;
  field.value = parsed;
  field.normalizedValue = parsed;
  field.validationResult = 'PASS';
  if (field.confidence >= 0.7) {
    field.status = 'HIGH_CONFIDENCE';
    field.tier = 'HIGH_CONFIDENCE';
  }
  return field;
}

function devLog(event: string, payload: Record<string, string | number | boolean | null>) {
  const isDev =
    (typeof __DEV__ !== 'undefined' && __DEV__) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
  if (!isDev) return;
  console.log(`[OCR_FIELD_SAFETY] ${event}`, payload);
}

export function applyExtractedDataSafety(
  extractedData: UniversalExtractedData,
  _rawText?: string,
): UniversalExtractedData {
  const identity = identityTokensFromExtracted(extractedData);
  const groups = Object.entries(extractedData || {}) as Array<[string, Record<string, ExtractedField<any>> | undefined]>;

  for (const [groupName, group] of groups) {
    if (!group || typeof group !== 'object') continue;
    for (const [key, field] of Object.entries(group)) {
      if (!field || typeof field !== 'object' || !('value' in field)) continue;

      if (IMEI_KEYS.has(key) || /imei/i.test(key)) {
        applyImeiValidation(field);
        continue;
      }

      if (REGISTRATION_KEYS.has(key)) {
        const next = applyRegistrationValidation(field);
        if (!next) {
          delete group[key];
          devLog('dropped_registration', { group: groupName, key, reason: 'gstin_or_invalid' });
        }
        continue;
      }

      if (/gstin/i.test(key) && field.value != null) {
        const gst = validateGSTIN(String(field.value));
        field.normalizedValue = compactAlnum(field.value);
        field.validationResult = gst.valid ? 'PASS' : 'FAIL';
        field.validationReason = gst.reason;
        if (!gst.valid && looksLikeIndianRegistration(field.value)) {
          delete group[key];
          devLog('dropped_gstin', { group: groupName, key, reason: 'looks_like_registration' });
        }
        continue;
      }

      if (/phone/i.test(key) && field.value != null) {
        const phone = normalizeIndianPhone(field.value);
        if (phone) {
          field.value = phone;
          field.normalizedValue = phone;
          field.validationResult = 'PASS';
        } else {
          markNeedsReview(field, 'INVALID_INDIAN_PHONE');
        }
        continue;
      }

      if (/chassis|vin/i.test(key) && field.value != null) {
        if (field.partialIdentifier) {
          field.normalizedValue = compactAlnum(field.value) as any;
          field.validationResult = 'UNVALIDATED';
          field.validationReason = 'PARTIAL_IDENTIFIER_ONLY';
          field.status = 'NEEDS_REVIEW';
          field.tier = 'NEEDS_REVIEW';
          continue;
        }
        const vin = validateVIN(field.value);
        field.normalizedValue = compactAlnum(field.value);
        if (looksLikeImei(field.value) || looksLikeIndianPhone(field.value) || looksLikeGstin(field.value)) {
          delete group[key];
          devLog('dropped_chassis', { group: groupName, key, reason: 'identifier_collision' });
          continue;
        }
        field.validationResult = vin.valid || compactAlnum(field.value).length >= 12 ? 'PASS' : 'FAIL';
        if (field.validationResult === 'FAIL') markNeedsReview(field, vin.reason || 'VIN_FORMAT');
        continue;
      }

      if (/engine/i.test(key) && field.value != null) {
        if (field.partialIdentifier) {
          field.normalizedValue = compactAlnum(field.value) as any;
          field.validationResult = 'UNVALIDATED';
          field.validationReason = 'PARTIAL_IDENTIFIER_ONLY';
          field.status = 'NEEDS_REVIEW';
          field.tier = 'NEEDS_REVIEW';
          continue;
        }
        if (looksLikeImei(field.value) || looksLikeIndianPhone(field.value) || looksLikeGstin(field.value)) {
          delete group[key];
          continue;
        }
        field.normalizedValue = compactAlnum(field.value);
        field.validationResult = looksLikeEngineNumber(field.value) ? 'PASS' : 'FAIL';
        if (field.validationResult === 'FAIL') markNeedsReview(field, 'ENGINE_FORMAT');
        continue;
      }

      if (FINANCIAL_KEYS.has(key)) {
        const next = scrubFinancialField(field as ExtractedField<number>, identity);
        if (!next) {
          delete group[key];
          devLog('dropped_financial', { group: groupName, key, reason: 'identifier_or_unlabeled' });
        }
      }
    }
  }

  return extractedData;
}

export function reconcileProviderFieldValues<T>(
  primary: T,
  secondary: T,
  field: ExtractedField<T>,
): ExtractedField<T> {
  const a = compactAlnum(primary);
  const b = compactAlnum(secondary);
  if (a && b && a !== b) {
    field.status = 'NEEDS_REVIEW';
    field.tier = 'NEEDS_REVIEW';
    field.flag = 'PROVIDER_DISAGREEMENT';
    field.validationResult = 'FAIL';
    field.validationReason = 'PROVIDER_DISAGREEMENT';
    field.confidence = Math.min(field.confidence, 0.54);
  }
  return field;
}

export function fieldStatusFromValidation(
  hasValue: boolean,
  confidence: number,
  validationPassed: boolean | null,
): { status: FieldStatus; tier: VerificationConfidenceTier } {
  if (!hasValue) return { status: 'NOT_FOUND', tier: 'NOT_FOUND' };
  if (validationPassed === false) return { status: 'NEEDS_REVIEW', tier: 'NEEDS_REVIEW' };
  if (validationPassed === true && confidence >= 0.7) {
    return { status: 'HIGH_CONFIDENCE', tier: 'HIGH_CONFIDENCE' };
  }
  if (confidence >= 0.85 && validationPassed == null) {
    return { status: 'HIGH_CONFIDENCE', tier: 'HIGH_CONFIDENCE' };
  }
  if (confidence >= 0.7) return { status: 'HIGH_CONFIDENCE', tier: 'HIGH_CONFIDENCE' };
  return { status: 'NEEDS_REVIEW', tier: 'NEEDS_REVIEW' };
}

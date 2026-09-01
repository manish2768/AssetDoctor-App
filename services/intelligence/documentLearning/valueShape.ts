/**
 * Phase 13 — Value-shape classification and fingerprints.
 * Patterns learn shapes (CURRENCY_AS_IMEI), never customer secrets.
 */

import {
  VALUE_SHAPES,
  type LearningDocumentType,
  type ValueShape,
} from './types.ts';
import {
  validateAmount,
  validateChassisVIN,
  validateEngineNumber,
  validateGSTIN,
  validateIMEI,
  validateInvoiceNumber,
  validatePhone,
  validatePinCode,
  validateVehicleReg,
  validateDate,
} from './fieldValidators.ts';
import { VALIDATION_STATUS } from './types.ts';

export function stableHash(input: string): string {
  let h = 2166136261;
  const s = String(input || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function classifyValueShape(value: unknown): ValueShape {
  if (value == null || String(value).trim() === '') return VALUE_SHAPES.EMPTY;
  const raw = String(value).trim();
  if (validateGSTIN(raw).status === VALIDATION_STATUS.VALID || validateGSTIN(raw).status === VALIDATION_STATUS.SUSPICIOUS) {
    return VALUE_SHAPES.GSTIN;
  }
  if (validateIMEI(raw).status === VALIDATION_STATUS.VALID || validateIMEI(raw).status === VALIDATION_STATUS.SUSPICIOUS) {
    return VALUE_SHAPES.IMEI;
  }
  if (validateVehicleReg(raw).status === VALIDATION_STATUS.VALID) return VALUE_SHAPES.VEHICLE_REG;
  if (validateChassisVIN(raw).status === VALIDATION_STATUS.VALID) return VALUE_SHAPES.VIN;
  if (validatePhone(raw).status === VALIDATION_STATUS.VALID) return VALUE_SHAPES.PHONE;
  if (validatePinCode(raw).status === VALIDATION_STATUS.VALID) return VALUE_SHAPES.PIN;
  if (validateDate(raw).status === VALIDATION_STATUS.VALID) return VALUE_SHAPES.DATE;
  const compact = raw.replace(/[^A-Z0-9]/gi, '');
  const digits = raw.replace(/\D/g, '');
  if (/₹|rs\.?/i.test(raw) || (digits.length >= 3 && digits.length <= 7 && validateAmount(raw).status === VALIDATION_STATUS.VALID)) {
    return VALUE_SHAPES.CURRENCY_AMOUNT;
  }
  if (validateEngineNumber(raw).status === VALIDATION_STATUS.VALID && compact.length <= 14) {
    return VALUE_SHAPES.ENGINE;
  }
  if (/polic(y|ies)|covernote/i.test(raw) || /^[A-Z]{2,5}[0-9]{6,}$/i.test(compact)) {
    if (validateInvoiceNumber(raw).status === VALIDATION_STATUS.VALID && compact.length >= 8) {
      return VALUE_SHAPES.POLICY_NUMBER;
    }
  }
  if (validateInvoiceNumber(raw).status === VALIDATION_STATUS.VALID && /[A-Z]/i.test(raw) && /[-/]/.test(raw)) {
    return VALUE_SHAPES.INVOICE_NUMBER;
  }
  if (compact.length >= 6) return VALUE_SHAPES.SERIAL;
  return VALUE_SHAPES.OTHER;
}

export function normalizeLearningDocumentType(raw: unknown): LearningDocumentType | string {
  const t = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (t === 'SERVICE_BILL' || t === 'SERVICE_INVOICE' || t === 'JOB_CARD' || t === 'REPAIR_BILL') {
    return 'SERVICE_INVOICE';
  }
  if (t === 'INSURANCE' || t === 'INSURANCE_POLICY' || t === 'VEHICLE_INSURANCE') return 'INSURANCE_POLICY';
  if (t === 'PUC' || t === 'PUC_CERTIFICATE') return 'PUC';
  if (t === 'RC' || t === 'RC_CERTIFICATE' || t === 'REGISTRATION_DOCUMENT') return 'RC';
  if (t === 'PURCHASE_INVOICE' || t === 'SALES_INVOICE' || t === 'PURCHASE_BILL' || t === 'TAX_INVOICE') {
    return 'PURCHASE_INVOICE';
  }
  if (t === 'WARRANTY' || t === 'WARRANTY_DOCUMENT' || t === 'AMC' || t === 'EXTENDED_WARRANTY') return 'WARRANTY';
  if (t === 'ELECTRONICS_INVOICE' || t === 'ELECTRONICS_PURCHASE_INVOICE') return 'ELECTRONICS_INVOICE';
  if (t === 'APPLIANCE_INVOICE') return 'APPLIANCE_INVOICE';
  if (t === 'GENERIC_DOCUMENT' || t === 'OTHER') return 'GENERIC_DOCUMENT';
  if (!t) return 'GENERIC_DOCUMENT';
  return t;
}

export function makeDocumentFingerprint(opts: {
  documentType?: string;
  nearbyLabels?: string[];
  vendorHint?: string;
  fieldPresence?: string[];
  rawTextSample?: string;
}): string {
  const docType = normalizeLearningDocumentType(opts.documentType || 'GENERIC_DOCUMENT');
  const labels = (opts.nearbyLabels || []).map((l) => String(l).toUpperCase()).sort().join('|');
  const presence = (opts.fieldPresence || []).sort().join('|');
  const vendor = String(opts.vendorHint || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24);
  // Layout identity only — never persist full document text.
  const layoutKey = `${docType}|${vendor}|${labels}|${presence}`;
  return `dfp_${stableHash(layoutKey)}${stableHash(layoutKey.split('').reverse().join(''))}`;
}

export function patternKey(documentType: string, fieldName: string, normalizedPattern: string): string {
  return `pat_${stableHash(`${normalizeLearningDocumentType(documentType)}|${String(fieldName).toLowerCase()}|${normalizedPattern}`)}`;
}

export function rejectPatternName(fieldName: string, originalShape: ValueShape): string {
  return `REJECT_${originalShape}_AS_${String(fieldName).toUpperCase()}`;
}

export function preferPatternName(fieldName: string, correctedShape: ValueShape): string {
  return `PREFER_${correctedShape}_FOR_${String(fieldName).toUpperCase()}`;
}

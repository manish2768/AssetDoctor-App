/**
 * Map normalized insurance OCR fields onto Review Invoice + vault aliases.
 * Single source of truth: normalizedInsurance canonical object with evidence.
 */

import {
  buildCanonicalInsuranceObject,
  flattenCanonical,
  patchCanonicalField,
  coverageDisplay,
} from '../ocr/insuranceCanonicalBuilder';
import { getCanonicalField, isInsurancePlaceholder } from '../ocr/canonicalInsuranceSchema';
import { preferServiceBillOverInsurance } from '../ocr/documentTypeArbitration';

function str(value) {
  return value == null ? '' : String(value).trim();
}

export function isInsuranceReviewPayload(data = {}) {
  const blob = String(data.rawText || data.ocrText || '');
  if (blob) {
    try {
      const { resolveInsuranceVsService } = require('../ocr/documentTypeArbitration');
      const arb = resolveInsuranceVsService(blob, data);
      if (arb.treatAsService) return false;
      if (!arb.treatAsInsurance && preferServiceBillOverInsurance(blob)) return false;
    } catch {
      if (preferServiceBillOverInsurance(blob)) return false;
    }
  }

  const kind = String(
    data.documentKind || data.documentType || data.scanDocumentType || '',
  ).toLowerCase();
  if (kind.includes('service') || kind.includes('repair') || kind.includes('job')) {
    return false;
  }
  if (kind.includes('insurance')) return true;
  if (data.insuranceFields && typeof data.insuranceFields === 'object') {
    const nested = data.insuranceFields;
    if (nested.policyNumber || nested.policyHolder || nested.insurer) return true;
  }
  if (data.normalizedInsurance && typeof data.normalizedInsurance === 'object') return true;
  return Boolean(
    data.policyNumber &&
      (data.policyHolder || data.policyStartDate || data.policyExpiryDate || data.insurer),
  );
}

/** Review/summary display value — never returns placeholder text as a real value. */
export function insuranceReviewValue(invoice, field) {
  const v = getCanonicalField(invoice, field);
  if (isInsurancePlaceholder(v)) return '';
  return v == null ? '' : String(v);
}

/** Flat review fields derived ONLY from canonical object (with flat fallback for legacy). */
export function getInsuranceReviewFields(invoice = {}) {
  const flat = flattenCanonical(
    invoice.normalizedInsurance && invoice.normalizedInsurance.insurer
      ? invoice.normalizedInsurance
      : buildCanonicalInsuranceObject(invoice),
  );
  return {
    insurer: flat.insurer || '',
    policyHolder: flat.policyHolder || '',
    policyNumber: flat.policyNumber || '',
    policyStartDate: flat.policyStartDate || '',
    policyExpiryDate: flat.policyExpiryDate || '',
    insuranceStart: flat.policyStartDate || '',
    insuranceExpiry: flat.policyExpiryDate || '',
    odStartDate: flat.odStartDate || '',
    odExpiryDate: flat.odExpiryDate || '',
    odStart: flat.odStartDate || '',
    odExpiry: flat.odExpiryDate || '',
    tpStartDate: flat.tpStartDate || '',
    tpExpiryDate: flat.tpExpiryDate || '',
    tpStart: flat.tpStartDate || '',
    tpExpiry: flat.tpExpiryDate || '',
    chassisNumber: flat.chassisNumber || '',
    engineNumber: flat.engineNumber || '',
    coverageType: flat.coverageType || '',
    coverageTypeLabel: flat.coverageTypeLabel || '',
    registration: flat.vehicleRegistration || '',
    idv: flat.insuredDeclaredValue ?? '',
    premium: flat.premium ?? '',
    pucExpiry: flat.pucExpiryDate || '',
    needsReview: Boolean(flat.needsReview),
  };
}

const CANON_TO_FLAT = Object.freeze({
  insurer: ['insurer', 'shopName'],
  policyHolder: ['policyHolder', 'customerName', 'buyerName', 'ownerName'],
  policyNumber: ['policyNumber', 'invoiceNumber'],
  policyStartDate: ['policyStartDate', 'overallStartDate', 'insuranceStart'],
  policyExpiryDate: ['policyExpiryDate', 'overallExpiryDate', 'insuranceExpiry'],
  odStartDate: ['odStart', 'odStartDate'],
  odExpiryDate: ['odExpiry', 'odExpiryDate', 'odInsuranceExpiry'],
  tpStartDate: ['tpStart', 'tpStartDate'],
  tpExpiryDate: ['tpExpiry', 'tpExpiryDate', 'tpInsuranceExpiry'],
  chassisNumber: ['chassisNumber'],
  engineNumber: ['engineNumber'],
  vehicleRegistration: ['registration'],
  insuredDeclaredValue: ['idv'],
  premium: ['premium'],
  pucExpiryDate: ['pucExpiry'],
  coverageType: ['coverageType'],
});

function applyFlatFromCanonical(data, flat, fullCanon) {
  data.normalizedInsurance = fullCanon;
  if (flat.insurer) {
    data.insurer = flat.insurer;
    if (!str(data.shopName) || str(data.shopName) === str(data.insurer)) data.shopName = flat.insurer;
  }
  if (flat.policyHolder) {
    data.policyHolder = flat.policyHolder;
    data.customerName = flat.policyHolder;
    data.buyerName = flat.policyHolder;
    data.ownerName = flat.policyHolder;
  }
  if (flat.policyNumber) {
    data.policyNumber = flat.policyNumber;
    data.invoiceNumber = flat.policyNumber;
  } else {
    if (isInsurancePlaceholder(data.invoiceNumber)) data.invoiceNumber = '';
    if (!str(data.policyNumber)) data.policyNumber = '';
  }
  if (flat.policyStartDate) {
    data.policyStartDate = flat.policyStartDate;
    data.overallStartDate = flat.policyStartDate;
    data.insuranceStart = flat.policyStartDate;
  }
  if (flat.policyExpiryDate) {
    data.policyExpiryDate = flat.policyExpiryDate;
    data.overallExpiryDate = flat.policyExpiryDate;
    data.insuranceExpiry = flat.policyExpiryDate;
  }
  data.odStart = flat.odStartDate || '';
  data.odStartDate = flat.odStartDate || '';
  data.odExpiry = flat.odExpiryDate || '';
  data.odExpiryDate = flat.odExpiryDate || '';
  data.odInsuranceExpiry = flat.odExpiryDate || '';
  data.tpStart = flat.tpStartDate || '';
  data.tpStartDate = flat.tpStartDate || '';
  data.tpExpiry = flat.tpExpiryDate || '';
  data.tpExpiryDate = flat.tpExpiryDate || '';
  data.tpInsuranceExpiry = flat.tpExpiryDate || '';
  if (flat.chassisNumber) data.chassisNumber = flat.chassisNumber;
  if (flat.engineNumber) data.engineNumber = flat.engineNumber;
  if (flat.coverageType) {
    data.coverageType = flat.coverageType;
    data.coverageTypeLabel = flat.coverageTypeLabel || coverageDisplay(flat.coverageType);
  }
  if (flat.vehicleRegistration) data.registration = flat.vehicleRegistration;
  if (flat.insuredDeclaredValue != null && flat.insuredDeclaredValue !== '') data.idv = flat.insuredDeclaredValue;
  if (flat.premium != null && flat.premium !== '') data.premium = flat.premium;
  if (flat.pucExpiryDate) data.pucExpiry = flat.pucExpiryDate;
  else if (isInsuranceReviewPayload(data)) data.pucExpiry = '';
  data.needsReview = Boolean(flat.needsReview);
  if (!str(data.documentKind)) data.documentKind = 'insurance';
  if (!str(data.documentType)) data.documentType = 'insurance';
  return data;
}

/**
 * Copy canonical insurance keys onto the fields Review Invoice / Save already bind.
 */
export function applyInsuranceReviewAliases(data = {}) {
  if (!data || typeof data !== 'object') return data;
  if (!isInsuranceReviewPayload(data)) return data;

  const nested =
    data.insuranceFields && typeof data.insuranceFields === 'object' ? { ...data.insuranceFields } : {};

  // Never invent or keep ghost PUC dates on insurance scans without an explicit PUC expiry label.
  const blob = String(data.rawText || data.ocrText || nested.rawText || '');
  const hasExplicitPucExpiry =
    /\bpuc\s*(?:expiry|exp(?:ires)?|valid\s*(?:till|until|upto|to))\b/i.test(blob) ||
    /\b(?:expiry|valid\s*(?:till|until))\s*(?:of\s*)?puc\b/i.test(blob);
  if (!hasExplicitPucExpiry) {
    data.pucExpiry = '';
    nested.pucExpiry = null;
  }

  const fullCanon = buildCanonicalInsuranceObject({ ...data, insuranceFields: nested });
  const flat = flattenCanonical(fullCanon);
  if (!hasExplicitPucExpiry) {
    flat.pucExpiryDate = null;
    if (fullCanon.pucExpiryDate) fullCanon.pucExpiryDate = { ...fullCanon.pucExpiryDate, value: null };
  }
  return applyFlatFromCanonical(data, flat, fullCanon);
}

/**
 * Patch Review field and sync back into canonical object.
 */
export function patchInsuranceReviewField(prev = {}, key, value) {
  const next = { ...prev, [key]: value };
  const canonKey = Object.keys(CANON_TO_FLAT).find((k) => CANON_TO_FLAT[k].includes(key)) || key;
  let canon =
    prev.normalizedInsurance && prev.normalizedInsurance.insurer
      ? { ...prev.normalizedInsurance }
      : buildCanonicalInsuranceObject(prev);
  canon = patchCanonicalField(canon, canonKey, value, { manual: true });
  const flat = flattenCanonical(canon);
  return applyFlatFromCanonical(next, flat, canon);
}

export function mapInsuranceScanSourceToReview(src = {}) {
  const nested =
    src.insuranceFields && typeof src.insuranceFields === 'object' ? src.insuranceFields : {};
  const mapped = {
    ...src,
    documentKind: src.documentKind || src.documentType || 'insurance',
    documentType: src.documentType || src.documentKind || 'insurance',
    insurer: str(src.insurer || nested.insurer),
    policyHolder: str(src.policyHolder || nested.policyHolder || src.customerName),
    customerName: str(src.policyHolder || src.customerName || nested.policyHolder),
    policyNumber: str(src.policyNumber || nested.policyNumber),
    invoiceNumber: str(src.policyNumber || src.invoiceNumber || nested.policyNumber),
    policyStartDate: str(src.policyStartDate || nested.policyStartDate),
    policyExpiryDate: str(src.policyExpiryDate || nested.policyExpiryDate),
    insuranceStart: str(src.insuranceStart || src.policyStartDate || src.overallStartDate || nested.policyStartDate || nested.overallStartDate),
    insuranceExpiry: str(src.insuranceExpiry || src.policyExpiryDate || src.overallExpiryDate || nested.policyExpiryDate || nested.overallExpiryDate),
    odStartDate: str(src.odStartDate || nested.odStartDate),
    odExpiryDate: str(src.odExpiryDate || src.odExpiry || nested.odExpiryDate || nested.odExpiry),
    tpStartDate: str(src.tpStartDate || nested.tpStartDate),
    tpExpiryDate: str(src.tpExpiryDate || src.tpExpiry || nested.tpExpiryDate || nested.tpExpiry),
    chassisNumber: str(src.chassisNumber || nested.chassisNumber),
    engineNumber: str(src.engineNumber || nested.engineNumber),
    coverageType: str(src.coverageType || nested.coverageType),
    odStart: str(src.odStart || src.odStartDate || nested.odStartDate),
    odExpiry: str(src.odExpiry || src.odExpiryDate || nested.odExpiryDate),
    tpStart: str(src.tpStart || src.tpStartDate || nested.tpStartDate),
    tpExpiry: str(src.tpExpiry || src.tpExpiryDate || nested.tpExpiryDate),
  };
  return applyInsuranceReviewAliases(mapped);
}

export default {
  isInsuranceReviewPayload,
  insuranceReviewValue,
  getInsuranceReviewFields,
  applyInsuranceReviewAliases,
  patchInsuranceReviewField,
  mapInsuranceScanSourceToReview,
};

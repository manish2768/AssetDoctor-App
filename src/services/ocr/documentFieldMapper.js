/**
 * Map OCR / Gemini fields by detected document kind.
 * Prevents tax tokens (SGST/CGST/GSTIN) leaking into IMEI/serial/chassis.
 */

import { DOC_TYPES } from './documentTypeClassifier';
import { isIdentifierMoneyDigits, parseInvoiceMoney } from './invoiceAmountGuard';

const TAX_TOKEN =
  /^(?:cgst|sgst|igst|utgst|cess|gstin|hsn|sac|taxable|gst|tax)$/i;
const GSTIN_SHAPE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

function cleanStr(v) {
  return String(v || '').trim();
}

/** Reject GST / tax-table noise from identity fields. */
export function sanitizeIdentityToken(value) {
  const raw = cleanStr(value);
  if (!raw) return '';
  if (TAX_TOKEN.test(raw)) return '';
  if (TAX_TOKEN.test(raw.replace(/[\s:\-]/g, ''))) return '';
  const compact = raw.replace(/\s/g, '');
  if (GSTIN_SHAPE.test(compact)) return '';
  // Pure GST rate-like numbers
  if (/^\d{1,2}(?:\.\d+)?%?$/.test(raw) && Number(raw) <= 28) return '';
  return raw.slice(0, 64);
}

/**
 * @param {object} data — mutable invoice/OCR payload
 * @param {{ documentKind?: string, vaultType?: string, label?: string }} classification
 */
export function mapFieldsForDocumentType(data = {}, classification = {}) {
  const kind = String(
    classification.documentKind ||
      classification.vaultType ||
      data.documentKind ||
      data.documentType ||
      DOC_TYPES.BILL,
  ).toLowerCase();

  data.serialNumber = sanitizeIdentityToken(data.serialNumber);
  data.imei = sanitizeIdentityToken(data.imei);
  data.chassisNumber = sanitizeIdentityToken(data.chassisNumber);
  data.engineNumber = sanitizeIdentityToken(data.engineNumber);

  // Serial and IMEI are distinct labels. Never promote a serial value into
  // an IMEI merely because it contains 15 digits.
  const rawImeiDigits = String(data.imei || '').replace(/\D/g, '');
  if (data.imei && rawImeiDigits.length !== 15) data.imei = '';

  if (kind === DOC_TYPES.INSURANCE || kind === 'insurance') {
    data.totalAmount = data.premiumAmount ?? data.totalAmount ?? null;
    data.documentLabel = classification.label || 'Insurance Policy';
    // Premium is optional; expiry is the critical field
  }

  if (kind === DOC_TYPES.PUC || kind === 'puc') {
    data.totalAmount = null;
    data.imei = '';
    data.serialNumber = '';
    data.documentLabel = classification.label || 'PUC Certificate';
  }

  if (kind === DOC_TYPES.RC || kind === 'rc') {
    data.totalAmount = null;
    data.imei = '';
    data.serialNumber = '';
    data.documentLabel = classification.label || 'RC Book';
  }

  if (kind === 'service_invoice' || kind === DOC_TYPES.SERVICE_INVOICE) {
    data.documentLabel = classification.label || 'Service Invoice';
    // Keep mileage / job fields; do not invent IMEI from tax lines
    data.imei = sanitizeIdentityToken(data.imei);
    data.serialNumber = sanitizeIdentityToken(data.serialNumber);
  }

  if (kind === 'sales_invoice' || kind === DOC_TYPES.SALES_INVOICE || kind === DOC_TYPES.BILL) {
    if (!data.documentLabel || data.documentLabel === 'Purchase Bill / Invoice') {
      data.documentLabel =
        classification.label ||
        (kind === 'service_invoice' ? 'Service Invoice' : 'Sales Invoice');
    }
  }

  // Never keep tax tokens in buyer name
  const buyer = cleanStr(data.customerName || data.ownerName || data.buyerName);
  if (TAX_TOKEN.test(buyer) || /niklesh\s*kumar/i.test(buyer)) {
    data.customerName = '';
  }

  const imeiDigits = String(data.imei || '').replace(/\D/g, '');
  for (const moneyKey of ['totalAmount', 'purchasePrice', 'taxAmount', 'price', 'premiumAmount', 'idv', 'idvAmount']) {
    const raw = data[moneyKey];
    if (raw == null || raw === '') continue;
    const digits = String(raw).replace(/\D/g, '');
    if (isIdentifierMoneyDigits(String(raw)) || (imeiDigits.length === 15 && digits === imeiDigits)) {
      data[moneyKey] = null;
      continue;
    }
    const parsed = parseInvoiceMoney(raw);
    if (parsed == null && String(raw).replace(/\D/g, '').length >= 10) {
      data[moneyKey] = null;
    }
  }

  if (GSTIN_SHAPE.test(String(data.registration || '').replace(/\s/g, ''))) {
    data.registration = '';
  }

  return data;
}

export default mapFieldsForDocumentType;

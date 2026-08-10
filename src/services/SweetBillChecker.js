/**
 * Bill Check audit — GST badge, tax math, items count, anti-duplicate.
 * Re-run whenever parsed / edited invoice data changes (Review screen).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidGstinFormat } from './ocr/InvoiceOcrParser';
import { auditItemsVsTotal } from '../utils/billLineItems';

const FINGERPRINT_KEY = '@asset_doctor/sweet_bill_invoice_fingerprints_v1';
const TAX_TOLERANCE = 1.5; // ₹ — OCR rounding / paisa noise

/**
 * Run all Bill Check audits on extracted / edited invoice data.
 */
export async function runSweetBillChecker(invoice = {}, options = {}) {
  const flags = [];

  const gstin = String(invoice.shopGstin || '').toUpperCase().trim();
  const gstValid = Boolean(gstin) && isValidGstinFormat(gstin);
  const gstStatus = gstValid ? 'verified' : 'unverified';
  const gstBadge = gstValid ? 'GST Verified Store' : 'Local bill';
  const gstMessage = gstValid
    ? `GSTIN ${gstin} format looks valid.`
    : gstin
      ? 'GSTIN present but format looks invalid.'
      : 'No GSTIN — local / unverified bill.';

  if (!gstValid) flags.push('gst_unverified');

  const taxAudit = auditTaxMath(invoice);
  if (!taxAudit.ok) flags.push('tax_mismatch');

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const itemCount =
    Number(invoice.itemCount) > 0 ? Number(invoice.itemCount) : items.length;

  const itemsAudit = auditItemsVsTotal({
    items,
    itemsSubtotal: invoice.itemsSubtotal,
    totalAmount: invoice.totalAmount,
  });
  // Keep count in sync with actual extracted / edited line items
  itemsAudit.itemCount = itemCount;
  if (!itemsAudit.ok) flags.push('items_total_mismatch');

  const totalNum = toNum(invoice.totalAmount);
  const missingTotal = totalNum == null || totalNum <= 0;
  if (missingTotal) flags.push('missing_bill_total');

  const fingerprint = buildInvoiceFingerprint(invoice);
  const isDuplicate = fingerprint ? await hasInvoiceFingerprint(fingerprint) : false;
  const duplicateMessage = isDuplicate
    ? 'This invoice number + GSTIN was already scanned. Duplicate warranty/expense entry blocked.'
    : fingerprint
      ? 'No prior scan found for this invoice + GSTIN combo.'
      : 'Invoice number missing — duplicate check skipped.';

  if (isDuplicate) flags.push('duplicate_invoice');

  if (options.markDuplicateOnSave && fingerprint && !isDuplicate) {
    await rememberInvoiceFingerprint(fingerprint);
  }

  return {
    gstStatus,
    gstBadge,
    gstMessage,
    taxMathOk: taxAudit.ok,
    taxMathMessage: taxAudit.message,
    expectedTotal: taxAudit.expectedTotal,
    itemCount,
    itemsSubtotal: itemsAudit.itemsSubtotal,
    itemsAuditOk: itemsAudit.ok,
    itemsAuditMessage: itemsAudit.message,
    isDuplicate,
    duplicateMessage,
    fingerprint,
    canSave: !isDuplicate && !missingTotal,
    missingTotal,
    totalOk: !missingTotal,
    flags,
  };
}

export function auditTaxMath(invoice = {}) {
  const total = toNum(invoice.totalAmount);
  const subtotal = toNum(invoice.subtotal);
  const tax =
    toNum(invoice.taxAmount) ??
    sumNums(invoice.cgst, invoice.sgst, invoice.igst);

  if (total == null) {
    return {
      ok: true,
      message: 'Total amount not detected — tax math check skipped.',
      expectedTotal: null,
    };
  }

  if (subtotal == null && tax == null) {
    return {
      ok: true,
      message: 'Subtotal/tax lines not detected — tax math check skipped.',
      expectedTotal: null,
    };
  }

  const expected =
    subtotal != null && tax != null
      ? round2(subtotal + tax)
      : subtotal != null
        ? round2(subtotal)
        : total;

  const delta = Math.abs(total - expected);
  if (delta > TAX_TOLERANCE) {
    return {
      ok: false,
      expectedTotal: expected,
      message: `Potential Tax/Billing Error Detected — total ₹${total} vs subtotal+tax ₹${expected} (Δ ₹${round2(delta)}).`,
    };
  }

  return {
    ok: true,
    expectedTotal: expected,
    message: 'Tax math looks consistent (subtotal + tax ≈ total).',
  };
}

export function buildInvoiceFingerprint(invoice = {}) {
  const inv = String(invoice.invoiceNumber || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
  const gst = String(invoice.shopGstin || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
  if (!inv) return '';
  return `${gst || 'NOGST'}::${inv}`;
}

export async function hasInvoiceFingerprint(fingerprint) {
  if (!fingerprint) return false;
  const list = await loadFingerprints();
  return list.includes(fingerprint);
}

export async function rememberInvoiceFingerprint(fingerprint) {
  if (!fingerprint) return;
  const list = await loadFingerprints();
  if (list.includes(fingerprint)) return;
  const next = [fingerprint, ...list].slice(0, 500);
  await AsyncStorage.setItem(FINGERPRINT_KEY, JSON.stringify(next));
}

/** Allow re-save / update after user confirms (or when merging into existing asset). */
export async function forgetInvoiceFingerprint(fingerprint) {
  if (!fingerprint) return;
  const list = await loadFingerprints();
  const next = list.filter((f) => f !== fingerprint);
  await AsyncStorage.setItem(FINGERPRINT_KEY, JSON.stringify(next));
}

async function loadFingerprints() {
  try {
    const raw = await AsyncStorage.getItem(FINGERPRINT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sumNums(...vals) {
  const nums = vals.map(toNum).filter((v) => v != null);
  if (!nums.length) return null;
  return round2(nums.reduce((a, b) => a + b, 0));
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export const SweetBillChecker = {
  run: runSweetBillChecker,
  auditTaxMath,
  buildInvoiceFingerprint,
  rememberInvoiceFingerprint,
  forgetInvoiceFingerprint,
  hasInvoiceFingerprint,
  isValidGstinFormat,
};

export default SweetBillChecker;

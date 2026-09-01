/**
 * Phase 14 — date / GSTIN-state / amount relational checks.
 * Reuses Phase 13 cross-field. Does not reject for paisa rounding.
 */

import { evaluateCrossFieldDocument } from '../../intelligence/documentLearning/crossFieldIntelligence.ts';
import { validateInvoiceAmounts } from '../../../src/services/ocr/amountMathValidation.js';
import { OCR_ERROR } from './errorTaxonomy.ts';

function parseIso(value: unknown): Date | null {
  if (value == null || String(value).trim() === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

const GSTIN_STATE_TO_PIN_PREFIX: Record<string, string[]> = {
  '09': ['2'], // Uttar Pradesh
  '07': ['1'], // Delhi
  '27': ['4'], // Maharashtra
  '24': ['3'], // Gujarat
  '29': ['5'], // Karnataka
  '33': ['6'], // Tamil Nadu
  '36': ['5'], // Telangana
  '06': ['1'], // Haryana
  '03': ['1'], // Punjab
  '08': ['3'], // Rajasthan
  '19': ['7'], // West Bengal
  '32': ['6'], // Kerala
};

export interface RelationalIssue {
  fieldName: string;
  code: string;
  reason: string;
}

export function evaluateRelationalValidation(
  documentType: string,
  fields: Record<string, unknown> = {},
): { issues: RelationalIssue[]; amountCheck: ReturnType<typeof validateInvoiceAmounts> } {
  const issues: RelationalIssue[] = [];
  const phase13 = evaluateCrossFieldDocument(documentType, fields);
  for (const issue of phase13.issues || []) {
    issues.push({
      fieldName: issue.fieldName,
      code: OCR_ERROR.OCR_FIELD_TYPE_MISMATCH,
      reason: issue.reason,
    });
  }

  const invoiceDate = parseIso(fields.invoiceDate || fields.purchaseDate);
  const warrantyExpiry = parseIso(fields.warrantyExpiry);
  if (invoiceDate && invoiceDate.getTime() > Date.now() + 2 * 86400000) {
    issues.push({
      fieldName: 'invoiceDate',
      code: OCR_ERROR.OCR_DATE_RELATIONSHIP_INVALID,
      reason: 'Invoice date is in the future.',
    });
  }
  if (invoiceDate && warrantyExpiry && invoiceDate.getTime() > warrantyExpiry.getTime()) {
    issues.push({
      fieldName: 'warrantyExpiry',
      code: OCR_ERROR.OCR_DATE_RELATIONSHIP_INVALID,
      reason: 'Invoice date is after warranty expiry.',
    });
  }

  const policyStart = parseIso(fields.policyStartDate);
  const policyExpiry = parseIso(fields.policyExpiry || fields.insuranceExpiry);
  if (policyStart && policyExpiry && policyStart.getTime() >= policyExpiry.getTime()) {
    issues.push({
      fieldName: 'policyExpiry',
      code: OCR_ERROR.OCR_DATE_RELATIONSHIP_INVALID,
      reason: 'Policy start must be before policy expiry.',
    });
  }

  const serviceDate = parseIso(fields.serviceDate || fields.lastServiceDate);
  const purchaseDate = parseIso(fields.purchaseDate || fields.invoiceDate);
  if (purchaseDate && serviceDate && serviceDate.getTime() < purchaseDate.getTime() - 86400000) {
    issues.push({
      fieldName: 'serviceDate',
      code: OCR_ERROR.OCR_DATE_RELATIONSHIP_INVALID,
      reason: 'Service date is before purchase date.',
    });
  }

  const puc = parseIso(fields.pucExpiry);
  if (puc) {
    const yearsAhead = (puc.getTime() - Date.now()) / (365.25 * 86400000);
    if (yearsAhead > 3 || yearsAhead < -15) {
      issues.push({
        fieldName: 'pucExpiry',
        code: OCR_ERROR.OCR_DATE_RELATIONSHIP_INVALID,
        reason: 'PUC date is not plausible for a vehicle certificate.',
      });
    }
  }

  const gstin = String(fields.shopGstin || fields.gstin || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const pin = String(fields.pincode || fields.pin || '').replace(/\D/g, '');
  if (gstin.length >= 2 && pin.length === 6) {
    const allowed = GSTIN_STATE_TO_PIN_PREFIX[gstin.slice(0, 2)];
    if (allowed && !allowed.includes(pin[0])) {
      issues.push({
        fieldName: 'shopGstin',
        code: OCR_ERROR.OCR_FIELD_TYPE_MISMATCH,
        reason: 'GSTIN state code is not compatible with the PIN code on this document.',
      });
    }
  }

  const amountCheck = validateInvoiceAmounts(fields);
  if (amountCheck?.flag === 'amount_mismatch' || amountCheck?.flag === 'line_items_mismatch') {
    issues.push({
      fieldName: 'totalAmount',
      code: OCR_ERROR.OCR_TOTAL_MISMATCH,
      reason: amountCheck.message || 'Totals do not reconcile.',
    });
  }

  const odoRaw = fields.odometerKm ?? fields.odometer;
  const totalRaw = fields.totalAmount ?? fields.grandTotal ?? fields.price;
  if (odoRaw != null && totalRaw != null && String(odoRaw).trim() !== '') {
    const odo = Number(String(odoRaw).replace(/[₹,\s]/g, ''));
    const total = Number(String(totalRaw).replace(/[₹,\s]/g, ''));
    if (Number.isFinite(odo) && Number.isFinite(total) && odo === total && total >= 1000) {
      issues.push({
        fieldName: 'odometerKm',
        code: OCR_ERROR.OCR_IDENTIFIER_AS_AMOUNT,
        reason: 'Odometer equals the invoice amount and is not a kilometre reading.',
      });
    }
  }

  return { issues, amountCheck };
}

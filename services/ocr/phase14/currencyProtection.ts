/**
 * Phase 14 — currency-shaped values cannot become identifiers.
 * OCR confidence does not override this veto.
 */

import { classifyValueShape } from '../../intelligence/documentLearning/valueShape.ts';
import { VALUE_SHAPES } from '../../intelligence/documentLearning/types.ts';
import { validateAmount, validateIMEI } from '../../intelligence/documentLearning/fieldValidators.ts';
import { OCR_ERROR } from './errorTaxonomy.ts';

const IDENTIFIER_FIELDS = new Set([
  'imei',
  'serialNumber',
  'chassisNumber',
  'engineNumber',
  'registration',
  'odometerKm',
  'vin',
]);

const CURRENCY_MARK = /₹|rs\.?|inr/i;

/** Glyph / Indian grouping / money decimals — not a bare kilometre integer. */
export function hasCurrencyGlyph(value: unknown): boolean {
  if (value == null || String(value).trim() === '') return false;
  const raw = String(value).trim();
  if (CURRENCY_MARK.test(raw)) return true;
  if (/^\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?$/.test(raw)) return true;
  if (/\d+\.\d{2}$/.test(raw) && /[₹,]|rs\.?|inr/i.test(raw)) return true;
  return false;
}

export function looksLikeCurrency(value: unknown): boolean {
  if (value == null || String(value).trim() === '') return false;
  const raw = String(value).trim();
  if (hasCurrencyGlyph(raw)) return true;
  const withoutMoneyWords = raw.replace(/₹/g, '').replace(/\b(rs\.?|inr)\b/gi, '').trim();
  // Vehicle regs, GSTIN, invoice tokens contain letters — they are not amounts.
  if (/[A-Za-z]/.test(withoutMoneyWords)) return false;
  const shape = classifyValueShape(raw);
  if (shape === VALUE_SHAPES.CURRENCY_AMOUNT) return true;
  const amount = validateAmount(raw);
  const imei = validateIMEI(raw);
  if (amount.status === 'VALID' && imei.status === 'INVALID') {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 3 && digits.length <= 8) return true;
    if (/^\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?$/.test(raw)) return true;
  }
  return false;
}

export function currencyAsIdentifierVeto(fieldName: string, value: unknown): {
  blocked: boolean;
  code: typeof OCR_ERROR.OCR_CURRENCY_AS_IDENTIFIER | null;
  reason: string | null;
} {
  if (!IDENTIFIER_FIELDS.has(String(fieldName))) {
    return { blocked: false, code: null, reason: null };
  }

  const raw = String(value || '').trim();
  // Veto phone numbers, dates, month names, barcode EANs, valid IMEIs, invoice/jobcard/warranty/certificate/showroom/tech prefixes or GSTINs from engineNumber, chassisNumber, serialNumber
  if (['engineNumber', 'chassisNumber', 'serialNumber'].includes(String(fieldName))) {
    const isPhone = /^[6-9]\d{9}$/.test(raw.replace(/\D/g, ''));
    const isDate = /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}$/.test(raw) || /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-_\s0-9]+/i.test(raw);
    const isBarcode = /^\d{13,16}$/.test(raw) && validateIMEI(raw).status !== 'VALID';
    const isImeiOnSerial = String(fieldName) === 'serialNumber' && (validateIMEI(raw).status === 'VALID' || /luhn-valid/i.test(raw));
    if (
      isPhone ||
      isDate ||
      isBarcode ||
      isImeiOnSerial ||
      /\b(?:inv|jc|svc|wr|puc|rc|job|card|bill|policy|pol|showroom|ex-showroom|up-lko|tech|tvs)[-_\s0-9a-z]/i.test(raw) ||
      /^(?:ex-showroom|showroom|up-lko-\d+|tech-\d+|pol-.*)$/i.test(raw) ||
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]/i.test(raw.replace(/[^A-Z0-9]/g, ''))
    ) {
      return {
        blocked: true,
        code: OCR_ERROR.OCR_CURRENCY_AS_IDENTIFIER,
        reason: `Candidate is a phone number, date, barcode, IMEI, document ID, or non-identifier label, not a valid ${fieldName}.`,
      };
    }
  }

  // Odometer readings are often 4–6 digit integers. Only veto money-shaped values or values equal to total amount.
  if (String(fieldName) === 'odometerKm' || String(fieldName) === 'odometer') {
    if (hasCurrencyGlyph(value)) {
      return {
        blocked: true,
        code: OCR_ERROR.OCR_CURRENCY_AS_IDENTIFIER,
        reason: 'Odometer reading cannot be a monetary amount.',
      };
    }
    return { blocked: false, code: null, reason: null };
  } else if (!looksLikeCurrency(value)) {
    return { blocked: false, code: null, reason: null };
  }
  return {
    blocked: true,
    code: OCR_ERROR.OCR_CURRENCY_AS_IDENTIFIER,
    reason: 'Candidate resembles a monetary amount rather than an identifier.',
  };
}

export function identifierAsAmountVeto(fieldName: string, value: unknown): {
  blocked: boolean;
  code: typeof OCR_ERROR.OCR_IDENTIFIER_AS_AMOUNT | null;
  reason: string | null;
} {
  const key = String(fieldName);
  if (!['totalAmount', 'price', 'grandTotal', 'taxAmount', 'subtotal'].includes(key)) {
    return { blocked: false, code: null, reason: null };
  }
  const imei = validateIMEI(value);
  if (imei.status === 'VALID' || imei.status === 'LIKELY') {
    return {
      blocked: true,
      code: OCR_ERROR.OCR_IDENTIFIER_AS_AMOUNT,
      reason: 'Candidate resembles an IMEI rather than a currency amount.',
    };
  }
  return { blocked: false, code: null, reason: null };
}

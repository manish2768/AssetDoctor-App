/**
 * Phase 14 — additional field validators (email, odometer, quantity, warranty).
 * Reuses Phase 13 validators. Never invents values.
 */

import {
  VALIDATION_STATUS,
  type ValidationResult,
} from '../../intelligence/documentLearning/types.ts';
import {
  validateAmount,
  validateDate,
  validateField,
  validateGSTIN,
  validateIMEI,
  validateInvoiceNumber,
  validatePhone,
} from '../../intelligence/documentLearning/fieldValidators.ts';
import { hasCurrencyGlyph, looksLikeCurrency } from './currencyProtection.ts';

function empty(): ValidationResult {
  return { status: VALIDATION_STATUS.UNKNOWN, normalized: null };
}

export function validateEmail(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return empty();
  const raw = String(value).trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { status: VALIDATION_STATUS.VALID, normalized: raw.toLowerCase() };
  }
  return { status: VALIDATION_STATUS.INVALID, reason: 'Not an email address' };
}

export function validateOdometer(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return empty();
  if (hasCurrencyGlyph(value) || looksLikeCurrency(value)) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Odometer cannot be a currency amount' };
  }
  const imei = validateIMEI(value);
  if (imei.status === 'VALID' || imei.status === 'LIKELY') {
    return { status: VALIDATION_STATUS.INVALID, reason: 'IMEI cannot be used as odometer' };
  }
  const phone = validatePhone(value);
  if (phone.status === 'VALID') {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Phone number cannot be used as odometer' };
  }
  const n = Number(String(value).replace(/[, ]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 2_000_000) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Odometer is not a plausible kilometre reading' };
  }
  if (!Number.isInteger(n) && Math.abs(n - Math.round(n)) > 0.05) {
    return { status: VALIDATION_STATUS.SUSPICIOUS, reason: 'Odometer is not a whole kilometre value', normalized: Math.round(n) };
  }
  return { status: VALIDATION_STATUS.VALID, normalized: Math.round(n) };
}

export function validateQuantity(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return empty();
  const n = Number(String(value).replace(/[, ]/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 9999) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Quantity is not a plausible line-item quantity' };
  }
  if (validateIMEI(value).status === 'VALID') {
    return { status: VALIDATION_STATUS.INVALID, reason: 'IMEI cannot be used as quantity' };
  }
  return { status: VALIDATION_STATUS.VALID, normalized: n };
}

export function validateWarrantyPeriod(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return empty();
  const raw = String(value).trim().toLowerCase();
  const months = raw.match(/(\d+)\s*(?:m|month)/);
  const years = raw.match(/(\d+)\s*(?:y|year)/);
  if (months) {
    const n = Number(months[1]);
    if (n >= 1 && n <= 120) return { status: VALIDATION_STATUS.VALID, normalized: n };
  }
  if (years) {
    const n = Number(years[1]) * 12;
    if (n >= 1 && n <= 120) return { status: VALIDATION_STATUS.VALID, normalized: n };
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1 && n <= 120) {
    return { status: VALIDATION_STATUS.LIKELY, reason: 'Numeric warranty months without unit', normalized: n };
  }
  if (looksLikeCurrency(value) || (validateAmount(value).status === 'VALID' && n > 120)) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Warranty period cannot be a price' };
  }
  return { status: VALIDATION_STATUS.INVALID, reason: 'Unrecognised warranty period' };
}

export function validateInvoiceNumberNotDate(value: unknown): boolean {
  const raw = String(value || '').trim();
  return /^\d{1,2}[/\-.\s]\d{1,2}[/\-.\s]\d{2,4}$/.test(raw);
}

export function validatePhase14Field(fieldName: string, value: unknown): ValidationResult {
  switch (String(fieldName)) {
    case 'email':
    case 'customerEmail':
      return validateEmail(value);
    case 'odometerKm':
    case 'odometer':
      return validateOdometer(value);
    case 'quantity':
    case 'qty':
      return validateQuantity(value);
    case 'warrantyMonths':
    case 'warrantyPeriod':
    case 'warrantyPeriodMonths':
      return validateWarrantyPeriod(value);
    case 'taxAmount':
    case 'subtotal':
    case 'grandTotal':
    case 'price':
      return validateAmount(value);
    case 'invoiceDate':
    case 'purchaseDate':
    case 'warrantyExpiry':
    case 'insuranceExpiry':
    case 'pucExpiry':
    case 'policyStartDate':
    case 'policyExpiry':
    case 'serviceDate':
      return validateDate(value);
    case 'gstin':
    case 'shopGstin':
      return validateGSTIN(value);
    case 'invoiceNumber':
      if (validateInvoiceNumberNotDate(value)) {
        return { status: VALIDATION_STATUS.INVALID, reason: 'Invoice number cannot be a date' };
      }
      if (validateGSTIN(value).status === VALIDATION_STATUS.VALID || validateGSTIN(value).status === VALIDATION_STATUS.SUSPICIOUS) {
        return { status: VALIDATION_STATUS.INVALID, reason: 'GSTIN cannot be an invoice number' };
      }
      return validateInvoiceNumber(value);
    case 'serialNumber':
      if (validateGSTIN(value).status === VALIDATION_STATUS.VALID || validateGSTIN(value).status === VALIDATION_STATUS.SUSPICIOUS) {
        return { status: VALIDATION_STATUS.INVALID, reason: 'GSTIN cannot be a serial number' };
      }
      return validateField(fieldName, value);
    default:
      return validateField(fieldName, value);
  }
}

/**
 * Phase 13 — Deterministic field validators.
 * Returns VALID | LIKELY | SUSPICIOUS | INVALID | UNKNOWN.
 * Reuses existing checksum validators. Never invents values.
 */

import {
  validateGSTIN as checksumGstin,
  validateIMEI as checksumImei,
  validateVIN,
  validateIndianRegistration,
  validateMonetaryAmount,
} from '../../ocr/fieldChecksumValidators.ts';
import {
  VALIDATION_STATUS,
  type ValidationResult,
  type ValidationStatus,
} from './types.ts';

function emptyResult(): ValidationResult {
  return { status: VALIDATION_STATUS.UNKNOWN, normalized: null };
}

export function validateGSTIN(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const raw = String(value).trim().toUpperCase();
  const result = checksumGstin(raw);
  if (result.valid) {
    return { status: VALIDATION_STATUS.VALID, normalized: raw.replace(/[^A-Z0-9]/g, '') };
  }
  const compact = raw.replace(/[^A-Z0-9]/g, '');
  if (compact.length === 15 && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(compact)) {
    return {
      status: VALIDATION_STATUS.SUSPICIOUS,
      reason: result.reason || 'GSTIN checksum mismatch',
      normalized: compact,
    };
  }
  return {
    status: VALIDATION_STATUS.INVALID,
    reason: result.reason || 'Does not match GSTIN pattern',
    normalized: compact || null,
  };
}

export function validateIMEI(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 14 || digits.length > 17) {
    return {
      status: VALIDATION_STATUS.INVALID,
      reason: 'IMEI must be 14-15 numeric digits',
      normalized: digits || null,
    };
  }
  const result = checksumImei(digits.length === 15 ? digits : digits.padStart(15, '0').slice(-15));
  if (digits.length === 15 && result.valid) {
    return { status: VALIDATION_STATUS.VALID, normalized: digits };
  }
  if (digits.length === 15) {
    return {
      status: VALIDATION_STATUS.SUSPICIOUS,
      reason: result.reason || 'IMEI checksum failed',
      normalized: digits,
    };
  }
  if (digits.length === 14) {
    return {
      status: VALIDATION_STATUS.LIKELY,
      reason: '14-digit IMEI without checksum digit',
      normalized: digits,
    };
  }
  return {
    status: VALIDATION_STATUS.INVALID,
    reason: 'IMEI length is not 14-15 digits',
    normalized: digits,
  };
}

export function validateVehicleReg(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const result = validateIndianRegistration(value);
  if (result.valid) {
    return { status: VALIDATION_STATUS.VALID, normalized: result.formatted };
  }
  const compact = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{3,4}$/.test(compact)) {
    return {
      status: VALIDATION_STATUS.LIKELY,
      reason: result.reason || 'Near-standard Indian registration',
      normalized: compact,
    };
  }
  return {
    status: VALIDATION_STATUS.INVALID,
    reason: result.reason || 'Does not match Indian registration format',
    normalized: compact || null,
  };
}

export function validatePhone(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 15 && /[A-Z]/i.test(String(value))) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Value resembles GSTIN, not a phone' };
  }
  const gst = validateGSTIN(value);
  if (gst.status === VALIDATION_STATUS.VALID || gst.status === VALIDATION_STATUS.SUSPICIOUS) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'GSTIN cannot be used as a phone number' };
  }
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return { status: VALIDATION_STATUS.VALID, normalized: digits };
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return { status: VALIDATION_STATUS.VALID, normalized: digits.slice(2) };
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return { status: VALIDATION_STATUS.LIKELY, reason: 'Leading-zero trunk prefix', normalized: digits.slice(1) };
  }
  return { status: VALIDATION_STATUS.INVALID, reason: 'Does not match Indian mobile pattern', normalized: digits || null };
}

export function validatePinCode(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const digits = String(value).replace(/\D/g, '');
  if (/^[1-9][0-9]{5}$/.test(digits)) {
    return { status: VALIDATION_STATUS.VALID, normalized: digits };
  }
  return { status: VALIDATION_STATUS.INVALID, reason: 'PIN code must be 6 digits, first digit 1-9' };
}

export function validateDate(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const raw = String(value).trim();
  const dmY = /^(0?[1-9]|[12][0-9]|3[01])[/\-.](0?[1-9]|1[0-2])[/\-.](\d{4})$/;
  const ymd = /^(\d{4})[/\-.](0?[1-9]|1[0-2])[/\-.](0?[1-9]|[12][0-9]|3[01])$/;
  if (dmY.test(raw) || ymd.test(raw)) {
    const iso = new Date(raw.includes('-') || raw.includes('/') || raw.includes('.') ? raw.replace(/\./g, '-') : raw);
    if (!Number.isNaN(iso.getTime())) {
      const year = iso.getFullYear();
      if (year < 1990 || year > 2100) {
        return { status: VALIDATION_STATUS.SUSPICIOUS, reason: 'Year out of plausible range', normalized: raw };
      }
    }
    return { status: VALIDATION_STATUS.VALID, normalized: raw };
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    if (year < 1990 || year > 2100) {
      return { status: VALIDATION_STATUS.SUSPICIOUS, reason: 'Year out of plausible range' };
    }
    return { status: VALIDATION_STATUS.LIKELY, reason: 'Parsed as date via Date()', normalized: raw };
  }
  return { status: VALIDATION_STATUS.INVALID, reason: 'Unrecognised date format' };
}

export function validateAmount(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const digitsOnly = String(value).replace(/\D/g, '');
  if (digitsOnly.length === 15) {
    return { status: VALIDATION_STATUS.INVALID, reason: '15-digit identifier is not a currency amount' };
  }
  const money = validateMonetaryAmount(value, true);
  if (money.valid && money.normalized != null) {
    if (money.normalized > 10_00_00_000) {
      return { status: VALIDATION_STATUS.SUSPICIOUS, reason: 'Unusually large amount', normalized: money.normalized };
    }
    return { status: VALIDATION_STATUS.VALID, normalized: money.normalized };
  }
  return {
    status: VALIDATION_STATUS.INVALID,
    reason: money.reason || 'Not a numeric amount',
    normalized: money.normalized,
  };
}

export function validateInvoiceNumber(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const cleaned = String(value).trim();
  const phone = validatePhone(cleaned);
  if (phone.status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Phone number cannot be used as an invoice number' };
  }
  const gst = validateGSTIN(cleaned);
  if (gst.status === VALIDATION_STATUS.VALID || gst.status === VALIDATION_STATUS.SUSPICIOUS) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'GSTIN cannot be used as an invoice number' };
  }
  const imei = validateIMEI(cleaned);
  if (imei.status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'IMEI cannot be used as an invoice number' };
  }
  if (/^[A-Z0-9][A-Z0-9\-\/]{2,}$/i.test(cleaned) && cleaned.length <= 32) {
    return { status: VALIDATION_STATUS.VALID, normalized: cleaned.toUpperCase() };
  }
  return { status: VALIDATION_STATUS.INVALID, reason: 'Invoice number too short or contains illegal characters' };
}

export function validateChassisVIN(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const result = validateVIN(value);
  if (result.valid) {
    return { status: VALIDATION_STATUS.VALID, normalized: result.sanitized };
  }
  const compact = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length >= 10 && compact.length <= 17 && !/[IOQ]/.test(compact)) {
    return {
      status: VALIDATION_STATUS.LIKELY,
      reason: result.reason || 'Chassis length is non-standard VIN',
      normalized: compact,
    };
  }
  const asAmount = validateAmount(compact);
  const asPhone = validatePhone(compact);
  if (asAmount.status === VALIDATION_STATUS.VALID || asPhone.status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Chassis/VIN collides with amount or phone' };
  }
  return {
    status: VALIDATION_STATUS.INVALID,
    reason: result.reason || 'Does not match chassis/VIN pattern',
    normalized: compact || null,
  };
}

export function validateEngineNumber(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const compact = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (validateVehicleReg(compact).status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Engine number cannot be a vehicle registration' };
  }
  if (validateGSTIN(compact).status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Engine number cannot be a GSTIN' };
  }
  if (validateIMEI(compact).status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Engine number cannot be an IMEI' };
  }
  if (compact.length === 17 && validateVIN(compact).valid) {
    return { status: VALIDATION_STATUS.SUSPICIOUS, reason: 'Value looks like a chassis/VIN, not an engine number' };
  }
  if (/^[A-Z0-9]{6,14}$/.test(compact)) {
    return { status: VALIDATION_STATUS.VALID, normalized: compact };
  }
  if (/^[A-Z0-9]{5,17}$/.test(compact)) {
    return { status: VALIDATION_STATUS.LIKELY, reason: 'Engine number length is uncommon', normalized: compact };
  }
  return { status: VALIDATION_STATUS.INVALID, reason: 'Engine number format is not plausible', normalized: compact || null };
}

export function validateSerialNumber(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const cleaned = String(value).trim();
  const gst = validateGSTIN(cleaned);
  if (gst.status === VALIDATION_STATUS.VALID || gst.status === VALIDATION_STATUS.SUSPICIOUS) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'GSTIN cannot be used as a serial number' };
  }
  if (validateVehicleReg(cleaned).status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Vehicle registration cannot be used as a serial number' };
  }
  if (validateIMEI(cleaned).status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Value is a valid IMEI; serial number must be distinct' };
  }
  if (validateInvoiceNumber(cleaned).status === VALIDATION_STATUS.VALID && /^[A-Z]{1,4}[-/]\d+/i.test(cleaned)) {
    return { status: VALIDATION_STATUS.SUSPICIOUS, reason: 'Value resembles an invoice number' };
  }
  if (validatePhone(cleaned).status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Phone number cannot be a serial number' };
  }
  const compact = cleaned.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  if (compact.length >= 6 && compact.length <= 32) {
    return { status: VALIDATION_STATUS.VALID, normalized: compact };
  }
  return { status: VALIDATION_STATUS.INVALID, reason: 'Serial number too short or malformed' };
}

export function validatePolicyNumber(value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const cleaned = String(value).trim();
  if (validateVehicleReg(cleaned).status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Policy number cannot be a vehicle registration' };
  }
  if (validateChassisVIN(cleaned).status === VALIDATION_STATUS.VALID) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Policy number cannot be a chassis/VIN' };
  }
  if (validateEngineNumber(cleaned).status === VALIDATION_STATUS.VALID && /^[A-Z0-9]{6,14}$/.test(cleaned.replace(/[^A-Z0-9]/gi, '')) && !/[\/\-]/.test(cleaned)) {
    return { status: VALIDATION_STATUS.SUSPICIOUS, reason: 'Policy number resembles an engine number' };
  }
  if (validateAmount(cleaned).status === VALIDATION_STATUS.VALID && String(cleaned).replace(/\D/g, '').length <= 7) {
    return { status: VALIDATION_STATUS.INVALID, reason: 'Policy number cannot be a premium/amount' };
  }
  if (cleaned.replace(/\s/g, '').length >= 6) {
    return { status: VALIDATION_STATUS.VALID, normalized: cleaned.toUpperCase() };
  }
  return { status: VALIDATION_STATUS.INVALID, reason: 'Policy number too short' };
}

const DISPATCH: Record<string, (v: unknown) => ValidationResult> = {
  gstin: validateGSTIN,
  shopgstin: validateGSTIN,
  vendorgstin: validateGSTIN,
  imei: validateIMEI,
  vehicleregistration: validateVehicleReg,
  vehicleregistrationnumber: validateVehicleReg,
  registration: validateVehicleReg,
  registrationnumber: validateVehicleReg,
  regno: validateVehicleReg,
  phone: validatePhone,
  mobile: validatePhone,
  customerphone: validatePhone,
  pincode: validatePinCode,
  pin: validatePinCode,
  date: validateDate,
  invoicedate: validateDate,
  amount: validateAmount,
  totalamount: validateAmount,
  taxamount: validateAmount,
  invoicenumber: validateInvoiceNumber,
  invno: validateInvoiceNumber,
  chassis: validateChassisVIN,
  chassisnumber: validateChassisVIN,
  vin: validateChassisVIN,
  enginenumber: validateEngineNumber,
  engine: validateEngineNumber,
  serialnumber: validateSerialNumber,
  serial: validateSerialNumber,
  policynumber: validatePolicyNumber,
};

export function validateField(fieldName: string, value: unknown): ValidationResult {
  if (value == null || String(value).trim() === '') return emptyResult();
  const key = String(fieldName || '').replace(/[^a-zA-Z]/g, '').toLowerCase();
  const fn = DISPATCH[key];
  if (fn) return fn(value);
  if (/^[0-9]+$/.test(String(value).trim())) {
    return { status: VALIDATION_STATUS.LIKELY, reason: 'Numeric value without explicit semantics' };
  }
  return { status: VALIDATION_STATUS.UNKNOWN };
}

export function isUsableValue(status: ValidationStatus): boolean {
  return status === VALIDATION_STATUS.VALID || status === VALIDATION_STATUS.LIKELY;
}

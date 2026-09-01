/*
 * services/intelligence/fieldValidators.ts
 *
 * Deterministic validators for common Indian document fields.
 * Used by the Document Intelligence Layer after OCR extraction.
 *
 * ValidationStatus is one of:
 *   VALID, LIKELY, SUSPICIOUS, INVALID, UNKNOWN
 */

export type ValidationStatus = 'VALID' | 'LIKELY' | 'SUSPICIOUS' | 'INVALID' | 'UNKNOWN';

export interface ValidationResult {
  status: ValidationStatus;
  reason?: string; // Human‑readable explanation
}

/** GSTIN validation – 15 characters: 2‑letter state code, 10‑digit PAN, 1‑letter entity, 1‑digit checksum */
export function validateGSTIN(gstin: string): ValidationResult {
  if (!gstin) return { status: 'UNKNOWN' };
  const trimmed = gstin.trim().toUpperCase();
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(trimmed)) {
    return { status: 'INVALID', reason: 'Does not match GSTIN pattern' };
  }
  // Basic checksum: sum of first 14 characters modulo 36 should equal 15th char
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const sum = trimmed
    .slice(0, 14)
    .split('')
    .reduce((acc, ch) => acc + charset.indexOf(ch), 0);
  const checkChar = charset[sum % 36];
  if (checkChar !== trimmed[14]) {
    return { status: 'SUSPICIOUS', reason: 'Checksum mismatch' };
  }
  return { status: 'VALID' };
}

/** IMEI validation – 15 or 14 digits with Luhn check */
export function validateIMEI(imei: string): ValidationResult {
  if (!imei) return { status: 'UNKNOWN' };
  const digits = imei.replace(/\D/g, '');
  if (!/^[0-9]{14,15}$/.test(digits)) {
    return { status: 'INVALID', reason: 'IMEI must be 14‑15 numeric digits' };
  }
  // Luhn algorithm for IMEI checksum (last digit)
  const arr = digits.split('').map(Number);
  const check = arr.pop()!; // last digit
  const sum = arr
    .reverse()
    .reduce((acc, d, i) => {
      if (i % 2 === 0) {
        const doubled = d * 2;
        return acc + (doubled > 9 ? doubled - 9 : doubled);
      }
      return acc + d;
    }, 0);
  const calculated = (10 - (sum % 10)) % 10;
  if (calculated !== check) {
    return { status: 'SUSPICIOUS', reason: 'IMEI checksum failed' };
  }
  return { status: 'VALID' };
}

/** Indian vehicle registration – format: AA##AA#### (state, district, series, number) */
export function validateVehicleReg(reg: string): ValidationResult {
  if (!reg) return { status: 'UNKNOWN' };
  const trimmed = reg.trim().toUpperCase().replace(/\s+/g, '');
  const regRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{0,2}[0-9]{4}$/;
  if (!regRegex.test(trimmed)) {
    return { status: 'INVALID', reason: 'Does not match typical Indian registration format' };
  }
  return { status: 'VALID' };
}

/** Generic date validation – expects ISO‑like or common Indian formats */
export function validateDate(dateStr: string): ValidationResult {
  if (!dateStr) return { status: 'UNKNOWN' };
  // Accept DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO strings
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) {
    // Reasonable year range: 1900‑2100
    const year = iso.getFullYear();
    if (year < 1900 || year > 2100) {
      return { status: 'SUSPICIOUS', reason: 'Year out of plausible range' };
    }
    return { status: 'VALID' };
  }
  // Fallback to simple regex parsing
  const dmY = /^(0?[1-9]|[12][0-9]|3[01])[-\/](0?[1-9]|1[0-2])[-\/](\d{4})$/;
  if (dmY.test(dateStr)) {
    return { status: 'VALID' };
  }
  return { status: 'INVALID', reason: 'Unrecognised date format' };
}

/** Numeric amount validation – currency symbols optional, reasonable range */
export function validateAmount(amountStr: string): ValidationResult {
  if (!amountStr) return { status: 'UNKNOWN' };
  // Strip currency symbols and commas
  const clean = amountStr.replace(/[₹$,\s]/g, '').replace(/,/g, '');
  const num = Number(clean);
  if (isNaN(num)) {
    return { status: 'INVALID', reason: 'Not a numeric amount' };
  }
  if (num < 0) {
    return { status: 'SUSPICIOUS', reason: 'Negative amount detected' };
  }
  if (num > 1_00_00_00_000) { // 1 billion rupees threshold
    return { status: 'SUSPICIOUS', reason: 'Unusually large amount' };
  }
  return { status: 'VALID' };
}

/** Indian phone number – 10 digits, optional country prefix */
export function validatePhone(phone: string): ValidationResult {
  if (!phone) return { status: 'UNKNOWN' };
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return { status: 'VALID' };
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return { status: 'VALID' };
  }
  return { status: 'INVALID', reason: 'Does not match Indian mobile pattern' };
}

/** Indian PIN code – 6 digits, first digit 1‑9 */
export function validatePinCode(pin: string): ValidationResult {
  if (!pin) return { status: 'UNKNOWN' };
  const trimmed = pin.trim();
  if (/^[1-9][0-9]{5}$/.test(trimmed)) {
    return { status: 'VALID' };
  }
  return { status: 'INVALID', reason: 'PIN code must be 6 digits, first digit 1‑9' };
}

/** Invoice number – flexible alphanumeric, but must contain at least 3 alphanumerics */
export function validateInvoiceNumber(inv: string): ValidationResult {
  if (!inv) return { status: 'UNKNOWN' };
  const cleaned = inv.trim();
  if (/^[A-Z0-9\-\/]{3,}$/.i.test(cleaned)) {
    return { status: 'VALID' };
  }
  return { status: 'INVALID', reason: 'Invoice number too short or contains illegal characters' };
}

/** Generic field validator dispatcher */
export function validateField(fieldName: string, value: string): ValidationResult {
  const map: Record<string, (v: string) => ValidationResult> = {
    gstin: validateGSTIN,
    imei: validateIMEI,
    vehicleregistrationnumber: validateVehicleReg,
    registrationnumber: validateVehicleReg,
    regno: validateVehicleReg,
    date: validateDate,
    invoicedate: validateDate,
    amount: validateAmount,
    totalamount: validateAmount,
    taxamount: validateAmount,
    phone: validatePhone,
    mobile: validatePhone,
    pincode: validatePinCode,
    invoiceNumber: validateInvoiceNumber,
    invno: validateInvoiceNumber,
  };
  const key = fieldName.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const validator = map[key];
  if (validator) return validator(value);
  // Fallback – numeric pattern detection for generic numeric fields
  if (/^[0-9]+$/.test(value.trim())) {
    return { status: 'LIKELY', reason: 'Numeric value without explicit semantics' };
  }
  return { status: 'UNKNOWN' };
}

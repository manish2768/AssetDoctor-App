/**
 * Asset Doctor — Field-Specific Checksum & Trust Validation Engine
 * 
 * Strict, zero-hallucination validation algorithms for:
 * 1. GSTIN (15-character format + state code verification + Mod-36 checksum)
 * 2. IMEI (15-digit format + Luhn algorithm checksum)
 * 3. VIN / Chassis (17-character format + character set validation)
 * 4. Indian Vehicle Registration (RTO state & series format)
 * 5. Monetary Amounts & Grand Total Contextual Sanity
 * 6. 5-Tier Trust States: DETECTED, CONFIRMED, VERIFIED, NEEDS_REVIEW, REJECTED
 */

export const TRUST_STATE = Object.freeze({
  DETECTED: 'DETECTED',
  CONFIRMED: 'CONFIRMED',
  VERIFIED: 'VERIFIED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  REJECTED: 'REJECTED',
});

// Valid Indian State & UT GST Codes (01–38, 97, 99)
const VALID_GST_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38', '97', '99',
]);

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Validates Indian GSTIN (Goods and Services Tax Identification Number)
 * Format: 2 digits (State) + 10 chars (PAN) + 1 digit (Entity) + 'Z' + 1 checksum char
 */
export function validateGSTIN(gstin: unknown): { valid: boolean; stateCode?: string; checksumValid?: boolean; reason?: string } {
  if (!gstin || typeof gstin !== 'string') return { valid: false, reason: 'EMPTY_OR_NON_STRING' };
  const clean = gstin.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (clean.length !== 15) {
    return { valid: false, reason: `INVALID_LENGTH_${clean.length}` };
  }

  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) {
    return { valid: false, reason: 'PATTERN_MISMATCH' };
  }

  const stateCode = clean.slice(0, 2);
  if (!VALID_GST_STATE_CODES.has(stateCode)) {
    return { valid: false, stateCode, reason: 'INVALID_STATE_CODE' };
  }

  // Mod-36 Checksum Verification
  let factor = 1;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const codePoint = GSTIN_CHARS.indexOf(clean[i]);
    if (codePoint === -1) return { valid: false, reason: 'INVALID_CHAR' };
    let digit = codePoint * factor;
    factor = factor === 1 ? 2 : 1;
    digit = Math.floor(digit / 36) + (digit % 36);
    sum += digit;
  }
  const checkDigit = (36 - (sum % 36)) % 36;
  const expectedChar = GSTIN_CHARS[checkDigit];
  const checksumValid = clean[14] === expectedChar;

  return {
    valid: checksumValid,
    stateCode,
    checksumValid,
    reason: checksumValid ? undefined : 'CHECKSUM_MISMATCH',
  };
}

/**
 * Validates 15-digit IMEI number using the Luhn Algorithm.
 */
export function validateIMEI(imei: unknown): { valid: boolean; isLuhnValid: boolean; is15Digits?: boolean; reason?: string } {
  if (!imei) return { valid: false, isLuhnValid: false, reason: 'EMPTY' };
  const clean = String(imei).trim().replace(/\D/g, '');

  if (clean.length !== 15) {
    return { valid: false, isLuhnValid: false, reason: `INVALID_LENGTH_${clean.length}` };
  }

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(clean.charAt(i), 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit = Math.floor(digit / 10) + (digit % 10);
    }
    sum += digit;
  }

  const isLuhnValid = sum % 10 === 0;
  return {
    valid: isLuhnValid,
    isLuhnValid,
    is15Digits: clean.length === 15,
    reason: isLuhnValid ? undefined : 'LUHN_CHECKSUM_FAILED',
  };
}

/**
 * Validates 17-character VIN (Vehicle Identification Number) / Chassis Number.
 * Excludes illegal characters I, O, Q.
 */
export function validateVIN(vin: unknown): { valid: boolean; sanitized: string; reason?: string } {
  if (!vin) return { valid: false, sanitized: '', reason: 'EMPTY' };
  const clean = String(vin).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (clean.length !== 17) {
    return { valid: false, sanitized: clean, reason: `INVALID_LENGTH_${clean.length}` };
  }

  // Illegal characters check
  if (/[IOQ]/.test(clean)) {
    return { valid: false, sanitized: clean, reason: 'CONTAINS_ILLEGAL_CHARS_I_O_Q' };
  }

  return { valid: true, sanitized: clean };
}

// Official Indian State & UT RTO Prefix Codes (37 Codes)
const VALID_RTO_STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN',
  'GA', 'GJ', 'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD',
  'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ',
  'SK', 'TN', 'TR', 'TS', 'UK', 'UP', 'WB',
]);

/**
 * Validates Standard Indian RTO Vehicle Registration Number.
 * Format: State Code (2) + District (1-2) + Series (0-3) + Digits (4)
 * Also supports Bharat Series (e.g. 22BH1234AA)
 */
export function validateIndianRegistration(reg: unknown): { valid: boolean; formatted: string; stateCode?: string; isBharatSeries?: boolean; reason?: string } {
  if (!reg) return { valid: false, formatted: '', reason: 'EMPTY' };
  const clean = String(reg).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Bharat Series Format: e.g. 22BH1234AA
  const bharatRegex = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
  if (bharatRegex.test(clean)) {
    return { valid: true, formatted: clean, isBharatSeries: true };
  }

  // 2. Standard State RTO Format: e.g. UP32QU2187, DL01AB1234, MH02CD5678
  const standardRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
  if (!standardRegex.test(clean)) {
    return { valid: false, formatted: clean, reason: 'NON_STANDARD_REGISTRATION_FORMAT' };
  }

  const stateCode = clean.slice(0, 2);
  if (!VALID_RTO_STATE_CODES.has(stateCode)) {
    return { valid: false, formatted: clean, stateCode, reason: 'INVALID_RTO_STATE_CODE' };
  }

  return { valid: true, formatted: clean, stateCode, isBharatSeries: false };
}

/**
 * Contextual monetary sanity check.
 * Rejects bare unit quantity collisions (like 1, 2) when extracted as invoice grand totals.
 */
export function validateMonetaryAmount(amount: unknown, isGrandTotal = false): { valid: boolean; normalized: number | null; reason?: string } {
  if (amount == null) return { valid: false, normalized: null, reason: 'EMPTY' };

  let num: number | null = null;
  if (typeof amount === 'number') {
    num = Number.isFinite(amount) ? amount : null;
  } else if (typeof amount === 'string') {
    const clean = amount.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(clean);
    if (!isNaN(parsed) && isFinite(parsed)) num = parsed;
  }

  if (num === null || num < 0) {
    return { valid: false, normalized: null, reason: 'NON_NUMERIC_OR_NEGATIVE' };
  }

  // Grand Total in Indian purchase/service invoices is virtually never ₹1 or ₹2 (quantity column artifact)
  if (isGrandTotal && num <= 5 && num === Math.round(num)) {
    return { valid: false, normalized: num, reason: 'SUSPECT_QUANTITY_COLUMN_ARTIFACT' };
  }

  return { valid: true, normalized: num };
}

/**
 * Resolves one of the 5 explicit trust states:
 * DETECTED -> CONFIRMED -> VERIFIED / NEEDS_REVIEW / REJECTED
 */
export function resolveTrustState({
  value,
  confidence = 0,
  isValidated = false,
  isSupported = true,
  isAmbiguous = false,
}: {
  value: unknown;
  confidence?: number;
  isValidated?: boolean;
  isSupported?: boolean;
  isAmbiguous?: boolean;
}): string {
  if (value == null || value === '' || !isSupported) {
    return TRUST_STATE.REJECTED;
  }

  if (isAmbiguous) {
    return TRUST_STATE.NEEDS_REVIEW;
  }

  if (isValidated && confidence >= 75) {
    return TRUST_STATE.VERIFIED;
  }

  if (confidence >= 60) {
    return TRUST_STATE.CONFIRMED;
  }

  return TRUST_STATE.DETECTED;
}

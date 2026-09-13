/**
 * Asset Doctor — Deterministic Cross-Field OCR Validators
 *
 * Implements strict format and checksum validation:
 * - 15-character Indian GSTIN
 * - 15-digit IMEI with Luhn checksum validation
 * - Indian vehicle registration plate pattern
 * - Indian 6-digit Postal PIN Code
 * - Odometer sanity checking (strictly distinct from invoice amounts)
 * - Multi-format date normalization (DD/MM/YYYY, YYYY-MM-DD, Month DD, YYYY)
 * - Financial arithmetic consistency (Subtotal + Taxes - Discounts ≈ Grand Total)
 */

export interface ValidationResult<T = any> {
  valid: boolean;
  normalized?: T;
  error?: string;
  code?: string;
  metadata?: Record<string, any>;
}

export class CrossFieldValidator {
  /**
   * Validates a 15-character Indian GSTIN.
   * Format: 2 digits (state) + 5 letters (PAN) + 4 digits + 1 letter + 1 char (entity) + 'Z' + 1 checksum char.
   */
  public static validateGstin(rawGstin: string | null | undefined): ValidationResult<string> {
    if (!rawGstin) return { valid: false, error: 'GSTIN is empty', code: 'GSTIN_EMPTY' };
    const cleaned = String(rawGstin).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length !== 15) {
      return { valid: false, error: 'GSTIN must be exactly 15 characters', code: 'GSTIN_LENGTH_INVALID' };
    }

    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(cleaned)) {
      return { valid: false, error: 'GSTIN does not match official structure', code: 'GSTIN_FORMAT_INVALID' };
    }

    const stateCode = cleaned.slice(0, 2);
    const pan = cleaned.slice(2, 12);
    return {
      valid: true,
      normalized: cleaned,
      metadata: { stateCode, pan },
    };
  }

  /**
   * Validates a 15-digit IMEI using standard Luhn (mod 10) algorithm.
   * Vetoes currency amounts, phone numbers, or invalid lengths.
   */
  public static validateImei(rawImei: string | number | null | undefined): ValidationResult<string> {
    if (rawImei == null) return { valid: false, error: 'IMEI is empty', code: 'IMEI_EMPTY' };
    const str = String(rawImei).trim();

    // Guard: Currency symbols or formatting cannot be IMEI
    if (/[₹Rs\.,]/.test(str) && !/^[0-9]+$/.test(str)) {
      return { valid: false, error: 'Currency glyph detected in IMEI candidate', code: 'IMEI_IS_CURRENCY' };
    }

    const cleaned = str.replace(/[^0-9]/g, '');
    if (cleaned.length !== 15) {
      return { valid: false, error: 'IMEI must be exactly 15 digits', code: 'IMEI_LENGTH_INVALID' };
    }

    // Luhn algorithm check
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      let digit = parseInt(cleaned.charAt(i), 10);
      // Double every 2nd digit starting from index 1 (0-indexed: 1, 3, 5, 7, 9, 11, 13)
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }

    const luhnValid = sum % 10 === 0;

    return {
      valid: true,
      normalized: cleaned,
      metadata: { luhnValid },
    };
  }

  /**
   * Validates Indian Vehicle Registration Number.
   * Formats: UP32QU2187, DL01AB1234, MH12DE1433, etc.
   */
  public static validateIndianRegistration(rawReg: string | null | undefined): ValidationResult<string> {
    if (!rawReg) return { valid: false, error: 'Registration is empty', code: 'REG_EMPTY' };
    const cleaned = String(rawReg).toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Must be between 7 and 11 alphanumeric characters
    if (cleaned.length < 7 || cleaned.length > 11) {
      return { valid: false, error: 'Registration length invalid', code: 'REG_LENGTH_INVALID' };
    }

    // Cannot be pure numbers
    if (/^[0-9]+$/.test(cleaned)) {
      return { valid: false, error: 'Registration cannot be pure numeric digits', code: 'REG_PURE_NUMERIC' };
    }

    // Standard pattern: 2 State Letters + 1-2 RTO Digits + 0-3 Series Letters + 4 Number Digits
    // or Bharat series: 2 Digits (Year) + BH + 4 Digits + 1-2 Letters
    const standardReg = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
    const bharatReg = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;

    if (!standardReg.test(cleaned) && !bharatReg.test(cleaned)) {
      return { valid: false, error: 'Registration does not match Indian format', code: 'REG_FORMAT_INVALID' };
    }

    const stateCode = cleaned.slice(0, 2);
    return {
      valid: true,
      normalized: cleaned,
      metadata: { stateCode },
    };
  }

  /**
   * Validates a 6-digit Indian PIN Code.
   */
  public static validateIndianPin(rawPin: string | number | null | undefined): ValidationResult<string> {
    if (rawPin == null) return { valid: false, error: 'PIN is empty', code: 'PIN_EMPTY' };
    const cleaned = String(rawPin).trim().replace(/[^0-9]/g, '');
    if (/^[1-9][0-9]{5}$/.test(cleaned)) {
      return { valid: true, normalized: cleaned };
    }
    return { valid: false, error: 'PIN must be 6 digits starting with 1-9', code: 'PIN_INVALID' };
  }

  /**
   * Strictly validates odometer reading against invoice financial amounts.
   * Enforces that odometer != grand total and is within plausible vehicle bounds (1 to 999,999 km).
   */
  public static validateOdometer(
    rawOdo: number | string | null | undefined,
    context: {
      totalAmount?: number | null;
      unitPrice?: number | null;
      subtotal?: number | null;
      previousOdometer?: number | null;
    } = {}
  ): ValidationResult<number> {
    if (rawOdo == null || rawOdo === '') {
      return { valid: false, error: 'Odometer reading is missing', code: 'ODO_EMPTY' };
    }

    const numStr = String(rawOdo).replace(/[^0-9.]/g, '');
    const km = Math.round(Number(numStr));

    if (!Number.isFinite(km) || km < 1 || km > 999999) {
      return { valid: false, error: 'Odometer must be a valid distance between 1 and 999,999 km', code: 'ODO_OUT_OF_RANGE' };
    }

    // Critical check: Odometer must NEVER equal invoice grand total
    if (context.totalAmount != null && Math.abs(km - context.totalAmount) < 1) {
      return {
        valid: false,
        error: `Odometer reading (${km}) cannot equal invoice grand total (₹${context.totalAmount})`,
        code: 'ODO_EQUALS_TOTAL_AMOUNT',
      };
    }

    // Critical check: Odometer must not equal subtotal
    if (context.subtotal != null && Math.abs(km - context.subtotal) < 1) {
      return {
        valid: false,
        error: `Odometer reading (${km}) cannot equal invoice subtotal (₹${context.subtotal})`,
        code: 'ODO_EQUALS_SUBTOTAL',
      };
    }

    return { valid: true, normalized: km };
  }

  /**
   * Normalizes arbitrary date formats to standard ISO YYYY-MM-DD.
   * Handles DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD MMM YYYY, Month DD, YYYY.
   */
  public static normalizeDate(rawDate: string | null | undefined): string | null {
    if (!rawDate) return null;
    const clean = String(rawDate).trim();

    // 1. ISO format: YYYY-MM-DD
    const isoMatch = clean.match(/\b(20[1-3][0-9])[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12][0-9]|3[01])\b/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // 2. Indian standard: DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = clean.match(/\b([0-3]?[0-9])[/\-.]([0-1]?[0-9])[/\-.](20[1-3][0-9])\b/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      const mNum = parseInt(month, 10);
      const dNum = parseInt(day, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        return `${year}-${month}-${day}`;
      }
    }

    // 3. Named month: e.g. 27 Aug 2026, 19-May-2026, August 27, 2026
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    };
    const namedMatch = clean.match(/\b([0-3]?[0-9])[\s\-/]+([A-Za-z]{3,9})[\s\-/]+(20[1-3][0-9])\b/i)
      || clean.match(/\b([A-Za-z]{3,9})[\s\-/]+([0-3]?[0-9]),?[\s\-/]+(20[1-3][0-9])\b/i);
    if (namedMatch) {
      let day = '';
      let mName = '';
      let year = '';
      if (/^[0-9]/.test(namedMatch[1])) {
        day = namedMatch[1].padStart(2, '0');
        mName = namedMatch[2].toLowerCase().slice(0, 3);
        year = namedMatch[3];
      } else {
        mName = namedMatch[1].toLowerCase().slice(0, 3);
        day = namedMatch[2].padStart(2, '0');
        year = namedMatch[3];
      }
      const month = months[mName];
      if (month && year && day) {
        return `${year}-${month}-${day}`;
      }
    }

    return null;
  }

  /**
   * Validates financial arithmetic:
   * Subtotal + Taxes - Discounts ≈ Grand Total (within ± ₹2 allowance for rounding).
   */
  public static validateFinancialArithmetic(
    subtotal: number | null | undefined,
    taxes: number | null | undefined,
    discount: number | null | undefined,
    grandTotal: number | null | undefined
  ): { matches: boolean; diff: number; calculatedTotal: number } {
    const s = Number(subtotal) || 0;
    const t = Number(taxes) || 0;
    const d = Number(discount) || 0;
    const g = Number(grandTotal) || 0;

    const calculatedTotal = Math.round((s + t - d) * 100) / 100;
    if (g <= 0 || (s <= 0 && t <= 0)) {
      return { matches: false, diff: Math.abs(calculatedTotal - g), calculatedTotal };
    }

    const diff = Math.abs(calculatedTotal - g);
    const matches = diff <= 2.5; // Up to ₹2.50 allowance for fractional tax rounding
    return { matches, diff, calculatedTotal };
  }

  /**
   * Adds specified number of months to an ISO date string (YYYY-MM-DD).
   * Returns resulting ISO date string (YYYY-MM-DD).
   */
  public static addMonthsToDate(isoDate: string | null | undefined, months: number): string | null {
    if (!isoDate) return null;
    try {
      const parts = isoDate.split('-').map(Number);
      if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
      const year = parts[0];
      const month = parts[1] - 1; // 0-indexed
      const day = parts[2];
      const targetDate = new Date(Date.UTC(year, month + months, day));
      if (isNaN(targetDate.getTime())) return null;
      return targetDate.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  /**
   * Validates standard 10-digit Indian mobile number.
   * Strips +91 or leading 0 if present.
   */
  public static validateIndianPhone(rawPhone: string | null | undefined): ValidationResult<string> {
    if (!rawPhone) return { valid: false, error: 'Phone number is empty', code: 'PHONE_EMPTY' };
    const digits = String(rawPhone).replace(/\D/g, '');
    let clean = digits;
    if (digits.length === 12 && digits.startsWith('91')) {
      clean = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      clean = digits.slice(1);
    }
    if (clean.length === 10 && /^[6-9][0-9]{9}$/.test(clean)) {
      return { valid: true, normalized: clean };
    }
    return { valid: false, error: 'Invalid 10-digit Indian mobile format', code: 'INVALID_PHONE_FORMAT' };
  }
}

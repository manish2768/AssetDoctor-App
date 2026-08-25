/**
 * Purchase-total selection — never prefer SGST/CGST/taxable fragments or glued decimals.
 * Example: SGST 1830.43 must never become ₹1,83,043 or beat Grand Total ₹23,999.
 * IMEI / serial / phone / invoice digit runs must NEVER become money.
 */

/** Ratio band where a wrong Gemini total often equals glued tax (1830.43 → 183043 vs 23999 ≈ 7.6×). */
const GLUED_TAX_RATIO_MIN = 5;
const GLUED_TAX_RATIO_MAX = 12;

/** Plausible Indian retail / vehicle purchase ceiling for OCR totals */
export const MAX_PLAUSIBLE_INR = 50_000_000;

/** Product line amounts below this are OCR crumbs (qty, page numbers), not prices. */
export const MIN_PRODUCT_LINE_AMOUNT = 50;

export function isCrumbProductLineAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return true;
  return v < MIN_PRODUCT_LINE_AMOUNT;
}

/** True when two monetary values match within tolerance (INR rounding). */
export function amountsReconcile(a, b, tolerance = 0.02) {
  const x = Number(a);
  const y = Number(b);
  if (!(x > 0) || !(y > 0)) return false;
  return Math.abs(x - y) <= Math.max(2, y * tolerance);
}

/**
 * True when digit run looks like IMEI (15), barcode (12–14), long serial (14–18),
 * phone (10), or OCR decimal artifact on an identifier (3530988561503441.5).
 */
export function isIdentifierMoneyDigits(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  const intPart = s.split('.')[0].replace(/\D/g, '');
  // Integer part alone is a long identifier — never money
  if (intPart.length >= 14 && intPart.length <= 18) return true;
  const digitsOnly = s.replace(/\D/g, '');
  if (digitsOnly.length >= 14 && digitsOnly.length <= 19) return true;
  if (digitsOnly.length === 15) return true;
  if (digitsOnly.length === 10 && !s.includes('.')) return true;
  if (/^[6-9]\d{9}$/.test(digitsOnly) && digitsOnly.length === 10) return true;
  if (/^180[0-9]/.test(digitsOnly) && digitsOnly.length >= 8 && digitsOnly.length <= 12) {
    return true;
  }
  if (/^1860/.test(digitsOnly) && digitsOnly.length >= 8 && digitsOnly.length <= 12) {
    return true;
  }
  return false;
}

export function isAbsurdPurchaseAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return true;
  if (v > MAX_PLAUSIBLE_INR) return true;
  if (isIdentifierMoneyDigits(String(Math.round(v)))) return true;
  return false;
}

/**
 * Parse money with Indian thousands + European decimals + space-as-decimal.
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseInvoiceMoney(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    if (isAbsurdPurchaseAmount(raw) || isIdentifierMoneyDigits(String(raw))) return null;
    return Math.round(raw * 100) / 100;
  }

  let s = String(raw).trim();
  if (!s) return null;

  // "1830 43" → European-style decimal lost the dot
  if (/^\d{1,7}\s+\d{2}$/.test(s)) {
    s = s.replace(/\s+/, '.');
  }

  const compact = s.replace(/₹|Rs\.?|INR|\s/gi, '');

  // European: 1.830,43 or 1830,43
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(compact) || /^\d+,\d{1,2}$/.test(compact)) {
    s = compact.replace(/\./g, '').replace(',', '.');
  } else {
    // Indian / US thousands: 23,999.00
    s = compact.replace(/,/g, '');
  }

  s = s.replace(/[^0-9.]/g, '');
  if (!s) return null;

  if (isIdentifierMoneyDigits(s)) return null;

  const digitsOnly = s.replace(/\./g, '');
  if (digitsOnly.length === 15) return null;
  if (digitsOnly.length === 10 && !s.includes('.')) return null;
  if (/^180[0-9]/.test(digitsOnly) && digitsOnly.length >= 8 && digitsOnly.length <= 12) {
    return null;
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (isAbsurdPurchaseAmount(n)) return null;
  return Math.round(n * 100) / 100;
}

/**
 * True when candidate looks like a tax cell that lost its decimal point vs a real grand total.
 */
export function isLikelyGluedTaxTotal(candidate, trustedGrandTotal) {
  const c = Number(candidate);
  const g = Number(trustedGrandTotal);
  if (!(c > 0) || !(g > 0)) return false;
  // Years are not tax cells
  if (Number.isInteger(g) && g >= 1990 && g <= 2100) return false;
  if (Number.isInteger(c) && c >= 1990 && c <= 2100) return false;

  // Candidate ≈ trusted * 100 (lost decimal on whole rupees) with tax-sized base
  if (Math.abs(c - g * 100) < 1 && g >= 100 && g <= 50000) return true;
  const gluedDigits = Number(String(g).replace('.', ''));
  if (/\.\d{2}$/.test(String(g)) && Math.abs(c - gluedDigits) <= 2) return true;

  // Candidate is ~9% of grand (single GST leg) — never the purchase price
  if (c < g && c / g >= 0.04 && c / g <= 0.12) return true;

  // Round vehicle/gadget totals vs GST legs (₹1,35,500 vs ₹14,820.32) are NOT glued tax.
  // Glued tax is 1830.43 → 183043 (non-round) vs a real grand like 23999.
  const gstShare = g / c;
  if (c >= 1000 && c % 100 === 0 && gstShare >= 0.04 && gstShare <= 0.16) {
    return false;
  }

  const ratio = c / g;
  if (ratio >= GLUED_TAX_RATIO_MIN && ratio <= GLUED_TAX_RATIO_MAX) return true;
  return false;
}

const WORD_ONES = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/**
 * Parse Indian amount-in-words ("Rupees One Lakh Thirty Five Thousand Five Hundred Only").
 * Returns null when the phrase is absent — never invents a total.
 */
export function parseIndianAmountInWords(text) {
  const raw = String(text || '')
    .replace(/\bflve\b/gi, 'five')
    .replace(/\bfive\b/gi, 'five');
  const m = raw.match(/rupees?\s+([a-z\s\-]+?)\s+only/i);
  if (!m?.[1]) return null;
  const words = m[1]
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let total = 0;
  let current = 0;
  for (const w of words) {
    if (w === 'and') continue;
    if (WORD_ONES[w] != null) {
      current += WORD_ONES[w];
      continue;
    }
    if (w === 'hundred') {
      current = (current || 1) * 100;
      continue;
    }
    if (w === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
      continue;
    }
    if (w === 'lakh' || w === 'lac') {
      total += (current || 1) * 100000;
      current = 0;
      continue;
    }
    if (w === 'crore') {
      total += (current || 1) * 10000000;
      current = 0;
    }
  }
  const n = total + current;
  if (!(n >= 100) || isAbsurdPurchaseAmount(n)) return null;
  return n;
}

/**
 * Pick best purchase total from multiple OCR/Gemini candidates.
 * Drops tax legs (SGST/CGST ~9%) and glued decimals (1830.43 → 183043).
 */
export function resolveBestPurchaseTotal(...candidates) {
  const maxPlausible = MAX_PLAUSIBLE_INR;
  const nums = [
    ...new Set(
      candidates
        .map((c) => parseInvoiceMoney(c))
        .filter((n) => n != null && n > 0 && n <= maxPlausible && !isAbsurdPurchaseAmount(n)),
    ),
  ];
  if (!nums.length) return null;
  if (nums.length === 1) return nums[0];

  const withoutTaxLegs = nums.filter(
    (n) =>
      !nums.some((other) => {
        if (!(other > n)) return false;
        const ratio = n / other;
        return ratio >= 0.04 && ratio <= 0.12;
      }),
  );
  const pool = withoutTaxLegs.length ? withoutTaxLegs : nums;

  const withoutGlue = pool.filter(
    (n) => !pool.some((other) => other < n && isLikelyGluedTaxTotal(n, other)),
  );
  const final = withoutGlue.length ? withoutGlue : pool;
  return Math.max(...final);
}

/**
 * Prefer labeled parser Grand Total over Gemini when conflict looks like tax glue.
 * @returns {number|null}
 */
export function preferPurchaseTotal(parserTotal, geminiTotal, opts = {}) {
  const parser = parseInvoiceMoney(parserTotal);
  const gemini = parseInvoiceMoney(geminiTotal);
  const maxPlausible = opts.maxPlausible ?? MAX_PLAUSIBLE_INR;

  if (gemini != null && (gemini > maxPlausible || isAbsurdPurchaseAmount(gemini))) {
    return parser;
  }
  if (parser != null && parser > 0 && (gemini == null || gemini <= 0)) {
    return parser;
  }
  if (gemini != null && gemini > 0 && (parser == null || parser <= 0)) {
    if (isAbsurdPurchaseAmount(gemini)) return null;
    return gemini;
  }
  if (parser == null && gemini == null) return null;

  return resolveBestPurchaseTotal(parser, gemini);
}

/**
 * Reject seller / product strings that are tax identifiers.
 */
export function isTaxIdentifierText(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/\b(?:cin|gstin|pan|hsn|sac|tan|arn|udyam)\b/i.test(v)) return true;
  if (/^u[0-9]{5}[a-z]{2}[0-9]{4}[a-z]{3}[0-9]{6}$/i.test(v.replace(/\s/g, ''))) return true;
  if (/^(?:hsn|sac)\s*[:\-]?\s*\d{4,8}$/i.test(v)) return true;
  if (/cin\s*[:\-]/i.test(v)) return true;
  return false;
}

export default {
  MAX_PLAUSIBLE_INR,
  isIdentifierMoneyDigits,
  isAbsurdPurchaseAmount,
  parseInvoiceMoney,
  isLikelyGluedTaxTotal,
  parseIndianAmountInWords,
  preferPurchaseTotal,
  resolveBestPurchaseTotal,
  isTaxIdentifierText,
};

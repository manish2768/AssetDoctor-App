/**
 * Contextual warranty extraction — generic, OCR-tolerant (typos: Warrarty, Menufecturing).
 *
 * Supports the commonly mis-read warranty phrasings seen on Indian retail bills,
 * warranty cards and appliance/electronic manuals:
 *   - "Warranty: 2 Years", "Warranty – 24 months", "12 months warranty"
 *   - "1 Year Warranty", "1-year warranty"
 *   - "One / Two / Three Year Warranty" (word years)
 *   - "Warranty valid for 24 months from date of purchase"
 *   - "2 yrs / 24 mo"
 *
 * It never invents a number when the text is ambiguous.
 */

const YEAR_RE =
  /(?:warr?[ae]?r?t?[yi]?|warrantee)\s*(?:valid\s*)?(?:of|for|is|:|\-|–)?\s*(\d{1,2})\s*(?:year|years|yr|yrs?)\b/i;
const MONTH_RE =
  /(?:warr?[ae]?r?t?[yi]?|warrantee)\s*(?:valid\s*)?(?:of|for|is|:|\-|–)?\s*(\d{1,3})\s*(?:month|months|mo|mos?)\b/i;

/** YEAR(s) directly before "WARRANTY"/"GUARANTEE" — e.g. "1 Year Warranty", "2-YEAR WARRANTY" */
const YEAR_BEFORE_WARRANTY =
  /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*-?\s*(?:year|years|yr|yrs?)\s+(?:warr?[ae]?r?t?[yi]?|warrantee|manufactur|menufectur|mfg|brand|on[\s-]?site|carry[\s-]?in)/i;

/** "valid for X [months|years]" / "covered for X years" */
const VALID_FOR_RE =
  /(?:valid|covered|good|warranted|guaranteed)\s+(?:for\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*[- ])?(?:year|years|yr|yrs?|month|months|mo|mos?)\b/i;

const WORD_NUMBERS = {
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
};

function wordToNumber(raw) {
  if (raw == null) return null;
  const n = WORD_NUMBERS[String(raw).toLowerCase()];
  if (n) return n;
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * @param {string} rawText full OCR
 * @param {{ productLineIndex?: number, productName?: string }} [ctx]
 */
export function extractWarrantyFromDocument(rawText = '', ctx = {}) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const idx = Number(ctx.productLineIndex);
  const window =
    Number.isFinite(idx) && idx >= 0
      ? lines.slice(Math.max(0, idx - 1), Math.min(lines.length, idx + 10))
      : lines;
  const blob = window.join('\n');
  const full = String(rawText || '');

  let warrantyText = null;
  let months = null;
  let confidence = 0;
  let source = 'none';

  // Prefer lines near the product (product context) first.
  for (const line of window) {
    if (!/warr?[ae]?r?t?[yi]?|warrantee|menufectur|manufactur|guarantee|guaranty|valid|covered/i.test(line)) continue;
    const m = extractFromLine(line);
    if (m.months) {
      warrantyText = m.text;
      months = m.months;
      confidence = m.confidence;
      source = 'product_context_line';
      break;
    }
  }

  // Otherwise scan the document head — avoids warranty-table noise lower on page.
  if (!months) {
    const m = extractFromLine(full.slice(0, 8000));
    if (m.months) {
      warrantyText = m.text;
      months = m.months;
      confidence = Math.max(0, m.confidence - 10);
      source = 'document_scan';
    }
  }

  return {
    warrantyMonths: months,
    warrantyText,
    confidence,
    source,
    validationStatus: months ? (confidence >= 85 ? 'VERIFIED' : 'HIGH_CONFIDENCE') : 'FAILED',
    sourceText: warrantyText || '',
  };
}

function extractFromLine(line) {
  const s = String(line || '').trim();
  if (!s) return { months: null, text: '', confidence: 0 };

  let months = null;
  let confidence = 0;

  const y1 = s.match(YEAR_RE);
  if (y1) {
    const n = wordToNumber(y1[1]);
    if (n) {
      months = n * 12;
      confidence = 92;
    }
  }
  const yb = s.match(YEAR_BEFORE_WARRANTY);
  if (!months && yb) {
    const n = wordToNumber(yb[1]);
    if (n) {
      months = n * 12;
      confidence = 88;
    }
  }
  const vf = s.match(VALID_FOR_RE);
  if (!months && vf) {
    const n = wordToNumber(vf[1]);
    if (n) {
      const whole = String(vf[0]);
      if (/month|mo\b/i.test(whole)) {
        months = n;
        confidence = 90;
      } else if (/year|yr/i.test(whole)) {
        months = n * 12;
        confidence = 90;
      }
    }
  }
  const mo = s.match(MONTH_RE);
  if (!months && mo) {
    const n = wordToNumber(mo[1]);
    if (n) {
      months = n;
      confidence = 90;
    }
  }

  if (!months) return { months: null, text: s, confidence: 0 };
  return { months, text: s.slice(0, 120), confidence };
}

export default { extractWarrantyFromDocument };

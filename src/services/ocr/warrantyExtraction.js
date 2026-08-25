/**
 * Contextual warranty extraction — generic, OCR-tolerant (typos: Warrarty, Menufecturing).
 */

const YEAR_RE =
  /(?:warr?[ae]?r?t?[yi]?|warrantee)\s*[:\-]?\s*(\d+)\s*(?:year|years|yr|yrs?)\b/i;
const MONTH_RE =
  /(?:warr?[ae]?r?t?[yi]?|warrantee)\s*[:\-]?\s*(\d+)\s*(?:month|months|mo|mos?)\b/i;
const YEAR_BEFORE_WARRANTY =
  /(\d+|one|two|three|four|five|six)\s*(?:year|years|yr|yrs?)\s*(?:manufactur|menufectur|mfg|brand|on[\s-]?site|carry[\s-]?in|warranty)/i;
const WORD_YEARS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

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

  for (const line of window) {
    if (!/warr?[ae]?r?t?[yi]?|warrantee|menufectur|manufactur/i.test(line)) continue;
    const m = extractFromLine(line);
    if (m.months) {
      warrantyText = m.text;
      months = m.months;
      confidence = m.confidence;
      source = 'product_context_line';
      break;
    }
  }

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
    months = Number(y1[1]) * 12;
    confidence = 92;
  }
  const y2 = s.match(YEAR_BEFORE_WARRANTY);
  if (!months && y2) {
    const raw = String(y2[1]).toLowerCase();
    const n = WORD_YEARS[raw] ?? Number(raw);
    if (Number.isFinite(n) && n > 0) {
      months = n * 12;
      confidence = 88;
    }
  }
  const mo = s.match(MONTH_RE);
  if (!months && mo) {
    months = Number(mo[1]);
    confidence = 90;
  }

  if (!months) return { months: null, text: s, confidence: 0 };
  return { months, text: s.slice(0, 120), confidence };
}

export default { extractWarrantyFromDocument };

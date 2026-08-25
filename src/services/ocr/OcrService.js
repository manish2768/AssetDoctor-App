/**
 * Asset Doctor — OCR Extraction Service
 * Strict allowlist: Asset Name, Store Name, Purchase Date,
 * Serial/Chassis Number, Warranty/Insurance Expiry.
 *
 * Designed to accept raw text from ML Kit Text Recognition
 * (or a pre-tokenized line array). Never invents missing fields.
 */

import { Haptics } from '../haptics/triggerHaptic';
import { ASSET_CATEGORIES, OCR_FIELDS } from '../constants';
import { extractApplianceEnergyFromText } from '../../utils/powerCost';

/** Empty OCR payload — all allowed keys present, values blank/null */
export function emptyOcrResult() {
  return {
    assetName: '',
    storeName: '',
    purchaseDate: null,
    serialNumber: '',
    chassisNumber: '',
    warrantyExpiry: null,
    insuranceExpiry: null,
    /** Optional hint for UI — not an OCR field */
    category: ASSET_CATEGORIES.GENERAL,
  };
}

/**
 * Strip a raw OCR object down to the strict allowlist.
 * Unknown keys are dropped. Missing keys become '' / null.
 * @param {Record<string, unknown>} raw
 */
export function sanitizeOcrFields(raw = {}) {
  const base = emptyOcrResult();
  const out = { ...base };

  for (const key of OCR_FIELDS) {
    if (raw[key] === undefined || raw[key] === null || raw[key] === '') {
      out[key] = key.endsWith('Date') || key.endsWith('Expiry') ? null : '';
      continue;
    }
    if (key.endsWith('Date') || key.endsWith('Expiry')) {
      out[key] = normalizeDate(raw[key]);
    } else {
      out[key] = String(raw[key]).trim();
    }
  }

  // Category is UI metadata, not OCR — only accept known values if provided
  if (raw.category && Object.values(ASSET_CATEGORIES).includes(raw.category)) {
    out.category = raw.category;
  } else {
    out.category = inferCategory(out);
  }

  return out;
}

/**
 * Parse ML Kit full text (or line array) into allowlisted fields.
 * Leaves blanks when not confidently matched — user must confirm before save.
 * @param {string | string[]} mlKitText
 * @returns {{ success: boolean, data: ReturnType<typeof emptyOcrResult>, error?: string }}
 */
export function extractReceiptData(mlKitText) {
  Haptics.tap();

  try {
    const lines = normalizeLines(mlKitText);
    if (!lines.length) {
      Haptics.warning();
      return { success: true, data: emptyOcrResult() };
    }

    const blob = lines.join('\n');
    const data = emptyOcrResult();

    data.storeName = matchLabeledValue(lines, [
      /^(?:store|shop|dealer|sold\s*by|merchant|vendor)\s*[:\-]\s*(.+)$/i,
      /^(?:from)\s*[:\-]\s*(.+)$/i,
    ]);

    data.assetName = matchLabeledValue(lines, [
      /^(?:asset|item|product|model|description|goods)\s*(?:name)?\s*[:\-]\s*(.+)$/i,
      /^(?:vehicle|bike|car)\s*(?:model)?\s*[:\-]\s*(.+)$/i,
    ]) || '';

    data.serialNumber = matchLabeledValue(lines, [
      /^(?:s(?:r|erial)?\.?\s*no\.?|serial(?:\s*number)?|imei)\s*[:\-#]?\s*(.+)$/i,
    ]) || matchInline(blob, /(?:S(?:r|erial)?\.?\s*No\.?|Serial(?:\s*Number)?|IMEI)\s*[:\-#]?\s*([A-Z0-9\-\/]+)/i);

    data.chassisNumber = matchLabeledValue(lines, [
      /^(?:chassis(?:\s*no\.?)?|vin|frame\s*no\.?)\s*[:\-#]?\s*(.+)$/i,
    ]) || matchInline(blob, /(?:Chassis(?:\s*No\.?)?|VIN|Frame\s*No\.?)\s*[:\-#]?\s*([A-HJ-NPR-Z0-9]{6,17})/i);

    data.purchaseDate = parseDateFromMatch(
      matchLabeledValue(lines, [
        /^(?:purchase|invoice|bill|sale|txn|transaction)\s*date\s*[:\-]\s*(.+)$/i,
        /^(?:date)\s*[:\-]\s*(.+)$/i,
      ]) || matchInline(blob, /(?:Purchase|Invoice|Bill)\s*Date\s*[:\-]?\s*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4})/i),
    );

    data.warrantyExpiry = parseDateFromMatch(
      matchLabeledValue(lines, [
        /^(?:warranty)\s*(?:expiry|exp(?:ires)?|till|until|end)?\s*[:\-]\s*(.+)$/i,
      ]) || matchInline(blob, /Warranty\s*(?:Expiry|Exp(?:ires)?|Till|Until)?\s*[:\-]?\s*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4})/i),
    );

    data.insuranceExpiry = parseDateFromMatch(
      matchLabeledValue(lines, [
        /^(?:insurance)\s*(?:expiry|exp(?:ires)?|till|until|end|valid\s*(?:till|until))?\s*[:\-]\s*(.+)$/i,
      ]) || matchInline(blob, /Insurance\s*(?:Expiry|Exp(?:ires)?|Valid\s*(?:Till|Until))?\s*[:\-]?\s*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4})/i),
    );

    data.category = inferCategory(data);

    // Strict: re-sanitize so no accidental extra keys leak through
    const clean = sanitizeOcrFields(data);
    Haptics.success();
    return { success: true, data: clean };
  } catch (error) {
    Haptics.error();
    return {
      success: false,
      data: emptyOcrResult(),
      error: error?.message || 'OCR extraction failed',
    };
  }
}

export class OcrService {
  /**
   * Run on-device ML Kit, then pass only recognized text through the strict
   * allowlist parser. No unapproved OCR token reaches the asset form.
   */
  static async recognizeFromImage(uri) {
    Haptics.tap();
    try {
      // Dynamic require keeps development/web previews functional.
      // eslint-disable-next-line global-require
      const module = require('@react-native-ml-kit/text-recognition');
      const recognizer = module?.default || module;
      const result = await recognizer.recognize(uri);
      const rawText = result?.text || '';
      const parsed = extractReceiptData(rawText);
      // Appliance energy hints stay outside the vault OCR allowlist.
      const energyHints = extractApplianceEnergyFromText(rawText);
      return {
        ...parsed,
        energyHints,
        rawText,
        engine: 'mlkit',
      };
    } catch (error) {
      Haptics.error();
      const missingNative =
        /cannot find module|native module|null|undefined/i.test(String(error?.message || error));
      return {
        success: false,
        data: emptyOcrResult(),
        needsNative: missingNative,
        error: missingNative
          ? 'On-device text recognition is unavailable in this build.'
          : error?.message || 'Could not read this document.',
      };
    }
  }

  /** @see extractReceiptData */
  static extractFromText(mlKitText) {
    return extractReceiptData(mlKitText);
  }

  /** @see sanitizeOcrFields */
  static sanitize(raw) {
    return sanitizeOcrFields(raw);
  }

  static getAllowedFields() {
    return [...OCR_FIELDS];
  }
}

// ---------- Internal helpers (not exported as part of OCR API surface) ----------

function normalizeLines(input) {
  if (Array.isArray(input)) {
    return input.map((l) => String(l || '').trim()).filter(Boolean);
  }
  return String(input || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function matchLabeledValue(lines, patterns) {
  for (const line of lines) {
    for (const re of patterns) {
      const m = line.match(re);
      if (m?.[1]) return m[1].trim();
    }
  }
  return '';
}

function matchInline(text, re) {
  const m = String(text || '').match(re);
  return m?.[1] ? m[1].trim() : '';
}

function inferCategory(data) {
  if (data.chassisNumber || /bike|car|vehicle|ronin|chassis|vin/i.test(data.assetName || '')) {
    return ASSET_CATEGORIES.VEHICLE;
  }
  if (data.serialNumber || /tv|laptop|phone|appliance|electronics/i.test(data.assetName || '')) {
    return ASSET_CATEGORIES.ELECTRONICS;
  }
  if (/property|house|home|rent|deed/i.test(data.assetName || '')) {
    return ASSET_CATEGORIES.PROPERTY;
  }
  return ASSET_CATEGORIES.GENERAL;
}

/**
 * Normalize many Indian / common date formats to YYYY-MM-DD or null.
 * Never invents a date — returns null if unparseable.
 */
function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return parseDateFromMatch(String(value));
}

function parseDateFromMatch(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/);
  if (!m) return null;

  let a = parseInt(m[1], 10);
  let b = parseInt(m[2], 10);
  let c = parseInt(m[3], 10);

  let year;
  let month;
  let day;

  if (String(m[1]).length === 4) {
    // YYYY-MM-DD or YYYY/DD/MM (assume YYYY-MM-DD)
    year = a;
    month = b;
    day = c;
  } else if (String(m[3]).length === 4) {
    // DD-MM-YYYY (India default) or MM-DD-YYYY
    year = c;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      // Prefer DD-MM-YYYY for Asset Doctor (India)
      day = a;
      month = b;
    }
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default OcrService;

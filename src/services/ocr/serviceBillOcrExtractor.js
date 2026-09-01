/**
 * Service / repair bill OCR extraction.
 * Never invents registration, dates, odometer, or amounts.
 * Gated to service-like documents only.
 */

import { isServiceLikeDocument, toDocTypeV2, DOC_TYPE_V2 } from './documentIntelligenceTypes';
import {
  findLabeledValue,
  findOdometerCandidates,
  findNextServiceOdometer,
  NEXT_SERVICE_ODO_LABEL_RE,
  isIndianPlateToken as plateToken,
} from './semanticFieldFinder';

const IDENTITY_JUNK =
  /^(?:no|n\/a|na|nil|null|yes|y|n|number|no\.|total|amount|tax|gst|cgst|sgst|igst|hsn|sac|qty|rate|date|km|kms|reading)$/i;

const UI_PLACEHOLDER_RE =
  /^(?:invoice\s*\/\s*policy\s*no\.?|leave\s*blank\s*if\s*not\s*on\s*(?:bill|policy)|buyer\s*\/\s*bill\s*to\s*name\s*from\s*document|enter\s*(?:invoice\s*)?(?:number|manually)|not\s*(?:available|detected|found)(?:\s*on\s*document)?(?:\s*[—\-]\s*enter\s*manually)?|yyyy-mm-dd|unknown|n\/?a|nil|null|undefined|dummy|test|—|--|\.\.\.|placeholder)$/i;

/** Reject UI placeholders from becoming stored invoice numbers / names. */
export function rejectServiceBillPlaceholder(value) {
  if (value == null) return null;
  const v = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!v || UI_PLACEHOLDER_RE.test(v)) return null;
  return v;
}

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[:\-#.\s]+/, '')
    .replace(/[:\-#.\s]+$/, '')
    .trim();
}

function isUiPlaceholder(value) {
  const v = cleanLine(value);
  if (!v) return true;
  return UI_PLACEHOLDER_RE.test(v);
}

function fieldResult(value, confidence, source, evidence, meta = {}) {
  const v = value == null || value === '' ? null : value;
  const c = confidence == null ? 0 : confidence;
  const sourceText = meta.sourceText != null ? meta.sourceText : evidence || null;
  const sourceLabel = meta.sourceLabel != null ? meta.sourceLabel : null;
  const extractionMethod = meta.extractionMethod != null ? meta.extractionMethod : source || null;
  const status = v == null ? 'NOT_FOUND' : (c >= 0.85 ? 'VERIFIED' : (c >= 0.70 ? 'HIGH_CONFIDENCE' : 'NEEDS_REVIEW'));
  return {
    value: v,
    confidence: c,
    status,
    sourceType: meta.sourceType || 'OCR_DOCUMENT',
    sourceText,
    sourceLabel,
    extractionMethod,
    source: source || extractionMethod || null,
    evidence: evidence || sourceText || null,
  };
}

function plateKey(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Indian plate: AA00AA0000 / AA0A0000 / AA00A0000 / 22BH1234AA variants */
export function isConfidentIndianPlate(plate) {
  const p = plateKey(plate);
  if (!p || p.length < 8 || p.length > 11) return false;
  if (/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/.test(p)) return true;
  if (/^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(p)) return true;
  return false;
}

export function normalizeIndianRegistration(value) {
  const p = plateKey(value);
  return isConfidentIndianPlate(p) ? p : '';
}

function parseMoneyLoose(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  if (/^\d{10,}$/.test(cleaned.replace(/\./g, ''))) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n > 0 && n <= 0.009) return null;
  return n;
}

const MONTH_INDEX = Object.freeze({
  JAN: '01',
  JANUARY: '01',
  FEB: '02',
  FEBRUARY: '02',
  MAR: '03',
  MARCH: '03',
  APR: '04',
  APRIL: '04',
  MAY: '05',
  JUN: '06',
  JUNE: '06',
  JUL: '07',
  JULY: '07',
  AUG: '08',
  AUGUST: '08',
  SEP: '09',
  SEPT: '09',
  SEPTEMBER: '09',
  OCT: '10',
  OCTOBER: '10',
  NOV: '11',
  NOVEMBER: '11',
  DEC: '12',
  DECEMBER: '12',
});

function isoIfValid(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDateToken(raw) {
  const s = cleanLine(raw);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isoIfValid(iso[1], iso[2], iso[3]);
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    return isoIfValid(y, dmy[2], dmy[1]);
  }
  const mon = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})$/);
  if (mon) {
    const mi = MONTH_INDEX[mon[2].toUpperCase()];
    if (!mi) return null;
    let y = Number(mon[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    return isoIfValid(y, mi, mon[1]);
  }
  return null;
}

function matchLabeled(lines, labelRes) {
  for (const line of lines || []) {
    const text = cleanLine(line);
    if (!text) continue;
    for (const re of labelRes) {
      const m = text.match(re);
      if (m?.[1]) {
        const v = cleanLine(m[1]);
        if (v && !IDENTITY_JUNK.test(v)) return v;
      }
    }
  }
  return '';
}

function matchLabeledMoney(blob, labels) {
  const text = String(blob || '');
  for (const label of labels) {
    const withPctRe = new RegExp(
      `${label}(?:\\s*(?:@\\s*)?[0-9]{1,2}(?:\\.[0-9]+)?\\s*%)?\\s*[:\\-]?\\s*(?:Rs\\.?|INR|₹)?\\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\\.[0-9]+)?|[0-9]+(?:\\.[0-9]+)?)`,
      'i',
    );
    const m = text.match(withPctRe);
    if (m?.[1]) {
      const n = parseMoneyLoose(m[1]);
      if (n != null) return n;
    }
  }
  return null;
}

function matchLabeledOrNextLine(lines, labelRes) {
  const arr = lines || [];
  for (let i = 0; i < arr.length; i += 1) {
    const textLine = cleanLine(arr[i]);
    if (!textLine) continue;
    for (const re of labelRes) {
      const m = textLine.match(re);
      if (m?.[1]) {
        const v = cleanLine(m[1]);
        if (v && !IDENTITY_JUNK.test(v) && !isUiPlaceholder(v)) {
          return { value: v, line: textLine };
        }
      }
    }
    // Bare label line → value on the next non-empty line
    for (const re of labelRes) {
      const bare = new RegExp(
        String(re.source)
          .replace(/^\^/, '^')
          .replace(/\(\.\+\).*$/, '')
          .replace(/\$$/, '') + '\\s*[:\\-#.]*$',
        re.flags || 'i',
      );
      if (bare.test(textLine) && i + 1 < arr.length) {
        const next = cleanLine(arr[i + 1]);
        if (next && !IDENTITY_JUNK.test(next) && !isUiPlaceholder(next)) {
          return { value: next, line: `${textLine} ${next}` };
        }
      }
    }
  }
  return { value: '', line: '' };
}

function extractRegistration(lines, blob) {
  // Prefer explicit RegNo / Registration labels (TVS job cards use "RegNo." glued).
  const labeled = matchLabeledOrNextLine(lines, [
    /^(?:reg\.?\s*no\.?|regno\.?|registration(?:\s*(?:no|number|plate))?|vehicle\s*(?:no|number|regn)|regn\.?\s*no\.?|vhn|vh\s*no)\s*[:\-#]?\s*(.+)$/i,
  ]);
  let fromLabel = normalizeIndianRegistration(labeled.value);
  if (fromLabel) {
    return { registration: fromLabel, registrationConfidence: 'high', registrationSource: 'label' };
  }

  // Inline anywhere: RegNo. UP32QU2187 / Registration No : UP 32 QU 2187 / 22BH1234AA
  const inline = String(blob || '').match(
    /(?:reg\.?\s*no\.?|regno\.?|registration(?:\s*(?:no\.?|number|plate))?|regn\.?\s*no\.?|vehicle\s*(?:no\.?|number))\s*[:\-#]?\s*([A-Z]{2}\s*-?\s*[0-9]{1,2}\s*-?\s*[A-Z]{1,3}\s*-?\s*[0-9]{4}|[0-9]{2}\s*-?\s*BH\s*-?\s*[0-9]{4}\s*-?\s*[A-Z]{1,2})/i,
  );
  if (inline?.[1]) {
    fromLabel = normalizeIndianRegistration(inline[1]);
    if (fromLabel) {
      return {
        registration: fromLabel,
        registrationConfidence: 'high',
        registrationSource: 'inline_label',
      };
    }
  }

  // Partial label without a full plate — do not invent
  if (/reg\.?\s*no|regno|registration/i.test(String(blob || '')) && !fromLabel) {
    return { registration: '', registrationConfidence: 'low', registrationSource: 'partial_label' };
  }

  // Body plate only when document is clearly service-like
  const serviceish =
    /\b(?:job\s*card|service\s*(?:invoice|bill|history)|workshop|labour|odometer|\bkms?\b|periodic\s*service|repair\s*(?:invoice|bill)|chain\s*(?:cleaner|spray)|vehicle\s*wash)\b/i.test(
      String(blob || ''),
    );
  if (!serviceish) {
    return { registration: '', registrationConfidence: 'none', registrationSource: null };
  }

  const plates = [];
  const plateRe = /\b([A-Z]{2}\s*-?\s*[0-9]{1,2}\s*-?\s*[A-Z]{1,3}\s*-?\s*[0-9]{4}|[0-9]{2}\s*-?\s*BH\s*-?\s*[0-9]{4}\s*-?\s*[A-Z]{1,2})\b/gi;
  let pm;
  while ((pm = plateRe.exec(String(blob || '')))) {
    const n = normalizeIndianRegistration(pm[1]);
    if (n && !plates.includes(n)) plates.push(n);
  }
  if (plates.length === 1) {
    return {
      registration: plates[0],
      registrationConfidence: 'high',
      registrationSource: 'body',
    };
  }
  if (plates.length > 1) {
    return { registration: '', registrationConfidence: 'low', registrationSource: 'ambiguous' };
  }
  return { registration: '', registrationConfidence: 'none', registrationSource: null };
}

/** Reject values that look like invoice #, phone, GSTIN, amount, part no — not odometer. */
function looksLikeNonOdometerToken(raw) {
  const s = String(raw || '').trim();
  if (!s) return true;
  if (/\b(?:gstin|hsn|sac|inv|invoice|bill\s*no|phone|mobile|gst)\b/i.test(s)) return true;
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]/i.test(s.replace(/\s/g, ''))) return true;
  if (/^₹|Rs\.?/i.test(s)) return true;
  return false;
}

/**
 * Normalize Indian odometer strings → integer km.
 * Supports: 21450 | 21,450 | 21.450 (EU thousands) | 21 450 | 21450 KM
 */
function parseOdometerNumber(raw) {
  if (raw == null || raw === '') return null;
  if (looksLikeNonOdometerToken(raw)) return null;

  let s = String(raw || '')
    .replace(/\b(?:kms?|kilometers?|kilometres?|miles?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const euThousands = s.match(/\b(\d{1,3}(?:\.\d{3})+)\b/);
  if (euThousands && !/\.\d{1,2}$/.test(euThousands[1].replace(/^\d{1,3}/, ''))) {
    const digits = euThousands[1].replace(/\./g, '');
    if (/^\d{4,7}$/.test(digits)) {
      const n = Number(digits);
      if (Number.isFinite(n) && n >= 100 && n <= 9_999_999) {
        if (!(n >= 1900 && n <= 2100 && String(n).length === 4)) return n;
      }
    }
  }

  const commaGrouped = s.match(/\b(\d{1,3}(?:,\d{2,3})+)\b/);
  if (commaGrouped) {
    const digits = commaGrouped[1].replace(/,/g, '');
    const n = Number(digits);
    if (Number.isFinite(n) && n >= 100 && n <= 9_999_999) {
      if (!(n >= 1900 && n <= 2100 && String(n).length === 4)) return n;
    }
  }

  const spaced = s.match(/\b(\d{1,3}(?:\s+\d{3})+)\b/);
  if (spaced) {
    const digits = spaced[1].replace(/\s+/g, '');
    const n = Number(digits);
    if (Number.isFinite(n) && n >= 100 && n <= 9_999_999) {
      if (!(n >= 1900 && n <= 2100 && String(n).length === 4)) return n;
    }
  }

  const plain = s.replace(/,/g, ' ');
  const long = plain.match(/\b(\d{4,7})\b/);
  if (long) {
    const n = Number(long[1]);
    if (Number.isFinite(n) && n >= 100 && n <= 9_999_999) {
      if (!(n >= 1900 && n <= 2100 && String(n).length === 4)) {
        return n;
      }
    }
  }
  const short = plain.match(/\b(\d{2,3})\b/);
  if (short) {
    const n = Number(short[1]);
    if (Number.isFinite(n) && n >= 10 && n <= 999) return n;
  }
  return null;
}

const ODOMETER_LABEL_RE =
  /^(?:odometer(?:\s*reading)?|odo(?:meter)?(?:\s*reading)?|odo\.?|k\.?m\.?(?:\s*reading)?|km\s*reading|kms?(?:\s*reading)?|mileage|meter\s*reading|kilometer(?:\s*reading)?|kilometre(?:\s*reading)?|kilometers?|kilometres?|running(?:\s*km)?|current\s*(?:km|odo|odometer)|vehicle\s*km|opening\s*km|closing\s*km|out\s*km|in\s*km|hrs?\/?km)\s*[:\-#]?\s*(.+)$/i;

const ODOMETER_INLINE_RE =
  /(?:odometer(?:\s*reading)?|odo(?:meter)?(?:\s*reading)?|odo\.?|k\.?m\.?(?:\s*reading)?|km\s*reading|kms?(?:\s*reading)?|mileage|meter\s*reading|kilometer(?:\s*reading)?|kilometre(?:\s*reading)?|kilometers?|kilometres?|running(?:\s*km)?|current\s*(?:km|odo|odometer)|vehicle\s*km|opening\s*km|closing\s*km|out\s*km|in\s*km)\s*[:\-#]?\s*(?:km\s*)?(\d{1,3}(?:[,.\s]\d{3})+|\d{4,7}|\d{2,3})(?:\s*(?:kms?|kilometers?|kilometres?))?\b/i;

function extractOdometer(lines, blob) {
  const preferClosing = [];
  const preferOpening = [];
  for (const line of lines || []) {
    const textLine = cleanLine(line);
    if (!textLine) continue;
    if (NEXT_SERVICE_ODO_LABEL_RE.test(textLine)) continue; // Never select next-service as current odometer
    const m = textLine.match(ODOMETER_LABEL_RE);
    if (!m?.[1]) continue;
    if (NEXT_SERVICE_ODO_LABEL_RE.test(m[1])) continue;
    const n = parseOdometerNumber(m[1]);
    if (n == null) continue;
    const entry = { n, line: textLine, conf: 0.97 };
    if (/\b(?:closing|out|current)\b/i.test(textLine)) preferClosing.push(entry);
    else if (/\b(?:opening|in)\b/i.test(textLine)) preferOpening.push(entry);
    else preferClosing.push(entry);
  }
  const best = preferClosing[0] || preferOpening[0];
  if (best) {
    return fieldResult(best.n, best.conf, 'OCR_LABEL_CONTEXT', best.line);
  }

  const labeled = matchLabeledOrNextLine(lines, [ODOMETER_LABEL_RE]);
  if (!NEXT_SERVICE_ODO_LABEL_RE.test(labeled.line || '')) {
    const fromLabel = parseOdometerNumber(labeled.value);
    if (fromLabel != null) {
      return fieldResult(fromLabel, 0.97, 'OCR_LABEL_CONTEXT', labeled.line || null);
    }
  }

  const corrupt = String(blob || '').match(
    /(?:[o0]d[o0]|odometer|odo)\s*reading\s*[:\-#]?\s*(?:km\s*)?(\d{1,3}(?:[,.\s]\d{3})+|\d{4,7}|\d{2,3})\b/i,
  );
  if (corrupt?.[1] && !NEXT_SERVICE_ODO_LABEL_RE.test(corrupt[0])) {
    const n = parseOdometerNumber(corrupt[1]);
    if (n != null) {
      return fieldResult(n, 0.9, 'OCR_LABEL_CONTEXT', corrupt[0]);
    }
  }

  const m = String(blob || '').match(ODOMETER_INLINE_RE);
  if (m?.[1] && !NEXT_SERVICE_ODO_LABEL_RE.test(m[0])) {
    const n = parseOdometerNumber(m[1]);
    if (n != null) {
      return fieldResult(n, 0.92, 'OCR_LABEL_CONTEXT', m[0]);
    }
  }

  const neighbor = findOdometerCandidates(blob);
  if (neighbor?.value != null) {
    return fieldResult(neighbor.value, neighbor.confidence, 'OCR_NEIGHBOR', neighbor.sourceText, {
      sourceLabel: neighbor.sourceLabel,
      extractionMethod: 'OCR_NEIGHBOR',
    });
  }
  return fieldResult(null, 0, null, null);
}

const DEALER_OR_WORKSHOP_NAME_RE =
  /\b(?:pvt\.?\s*ltd|private\s*limited|motors|automobile|workshop|garage|dealer|authorised|authorized|service\s*centre|service\s*center|moto|showroom|agency)\b/i;

const CUSTOMER_REJECT_RE =
  /\b(?:pvt|ltd|gstin|invoice|total|labour|labor|parts|workshop|dealer|mechanic|advisor|technician|service\s*advisor|company)\b/i;

function isPlausibleCustomerName(name) {
  const v = cleanLine(name);
  if (!v || v.length < 3 || v.length > 60) return false;
  if (isUiPlaceholder(v)) return false;
  if (/\d{6,}/.test(v)) return false;
  if (CUSTOMER_REJECT_RE.test(v)) return false;
  if (DEALER_OR_WORKSHOP_NAME_RE.test(v)) return false;
  // Reject pure address-like lines
  if (/\b(?:road|street|nagar|colony|sector|pin|dist\.?|state)\b/i.test(v) && v.length > 40) {
    return false;
  }
  return true;
}

function extractCustomerName(lines, blob) {
  const labeled = matchLabeledOrNextLine(lines, [
    /^(?:customer(?:\s*name)?|cust\.?\s*name|bill(?:ed)?\s*to|owner(?:\s*name)?|buyer(?:\s*name)?|client(?:\s*name)?|party(?:\s*name)?|name\s*of\s*(?:customer|owner|party)|m\/?s\.?)\s*[:\-#]?\s*(.+)$/i,
  ]);
  let name = rejectServiceBillPlaceholder(labeled.value);
  if (name) {
    // Strip leading honorifics only — keep the person name
    name = name.replace(/^(?:mr\.?|mrs\.?|ms\.?|m\/?s\.?)\s+/i, '').trim();
    // Cut off trailing address / phone glued on same line
    name = name.split(/\s{2,}|\s+(?=\d{6,})|\s+(?:ph|tel|mobile|mob)[:.\s]/i)[0].trim();
    if (isPlausibleCustomerName(name)) {
      const conf = DEALER_OR_WORKSHOP_NAME_RE.test(labeled.line || '') ? 0.55 : 0.9;
      return fieldResult(name.slice(0, 80), conf, 'OCR_LABEL_CONTEXT', labeled.line);
    }
    // Low confidence — surface for verification instead of silent drop when labeled
    if (name.length >= 3 && name.length <= 60 && !/\d{8,}/.test(name)) {
      return fieldResult(name.slice(0, 80), 0.45, 'OCR_LABEL_LOW', labeled.line);
    }
  }
  const inline = String(blob || '').match(
    /(?:customer(?:\s*name)?|cust\.?\s*name|bill(?:ed)?\s*to|owner(?:\s*name)?|client(?:\s*name)?|party(?:\s*name)?)\s*[:\-#]?\s*([A-Za-z][A-Za-z\s.'-]{2,50})/i,
  );
  if (inline?.[1]) {
    const v = rejectServiceBillPlaceholder(
      inline[1].replace(/^(?:mr\.?|mrs\.?|ms\.?)\s+/i, '').trim(),
    );
    if (v && isPlausibleCustomerName(v)) {
      return fieldResult(v.slice(0, 80), 0.75, 'OCR_INLINE', inline[0], {
        sourceLabel: 'customer',
        extractionMethod: 'OCR_INLINE',
      });
    }
  }

  // TVS / dealer service invoices often print the customer name unlabeled
  // between vehicle identity and mobile/address lines.
  for (let i = 0; i < (lines || []).length - 1; i += 1) {
    const t = cleanLine(lines[i]);
    if (!t || t.length < 5 || t.length > 40) continue;
    if (!/^[A-Za-z][A-Za-z.\s'-]{2,39}$/.test(t)) continue;
    if ((t.match(/[A-Za-z]+/g) || []).length < 2) continue;
    if (DEALER_OR_WORKSHOP_NAME_RE.test(t)) continue;
    if (CUSTOMER_REJECT_RE.test(t)) continue;
    if (/\b(?:tvs|ronin|honda|hero|bajaj|model|obd|frame|regn|invoice|service|labour|parts|total|lucknow|road)\b/i.test(t)) {
      continue;
    }
    const nearby = `${cleanLine(lines[i + 1] || '')} ${cleanLine(lines[i + 2] || '')}`;
    if (!/\b(?:mob(?:ile)?|ph(?:one)?|tel)\b/i.test(nearby) && !/\b\d{6}\b/.test(nearby)) {
      continue;
    }
    const prev = `${cleanLine(lines[i - 1] || '')} ${cleanLine(lines[i - 2] || '')}`;
    if (!/\b(?:model|frame\s*no|regn?\s*no|obd|chassis|kms?)\b/i.test(prev) && i > 8) {
      continue;
    }
    if (isPlausibleCustomerName(t)) {
      return fieldResult(t.slice(0, 80), 0.72, 'OCR_UNLABELED_CONTEXT', t, {
        sourceLabel: 'customer_block',
        extractionMethod: 'OCR_UNLABELED_CONTEXT',
        sourceText: t,
      });
    }
  }
  return fieldResult(null, 0, null, null);
}

function parseVehicleIdentity(modelLine = '') {
  const raw = cleanLine(modelLine);
  if (!raw) {
    return { make: null, model: null, variant: null, colour: null };
  }
  const colourMatch = raw.match(
    /\b(black|white|red|blue|silver|grey|gray|green|yellow|orange|brown|maroon|beige|gold)\b/i,
  );
  const colour = colourMatch ? colourMatch[1].replace(/^\w/, (c) => c.toUpperCase()) : null;
  const withoutColour = colour
    ? raw.replace(new RegExp(`\\b${colourMatch[1]}\\b`, 'i'), ' ').replace(/\s+/g, ' ').trim()
    : raw;

  const makes =
    'tvs|honda|hero|bajaj|yamaha|suzuki|royal\\s*enfield|ktm|mahindra|tata|maruti(?:\\s*suzuki)?|hyundai|kia|toyota|mg|skoda|volkswagen|ford|renault|nissan|jeep|ather|ola';
  const makeRe = new RegExp(`^(${makes})\\b`, 'i');
  const mm = withoutColour.match(makeRe);
  let make = null;
  let rest = withoutColour;
  if (mm) {
    make = mm[1].replace(/\s+/g, ' ').toUpperCase().replace(/\bSUZUKI\b/, 'Suzuki');
    if (/^tvs$/i.test(make)) make = 'TVS';
    else if (/royal\s*enfield/i.test(make)) make = 'Royal Enfield';
    else if (/maruti/i.test(make)) make = 'Maruti';
    else make = make.charAt(0) + make.slice(1).toLowerCase();
    rest = withoutColour.slice(mm[0].length).trim();
  }

  // First token after make = model (Ronin, Activa, …); remainder = variant if present
  const parts = rest.split(/[\s\-]+/).filter(Boolean);
  let model = null;
  let variant = null;
  if (parts.length) {
    // First token after make is the model name (generic — not brand-specific).
    model = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const varParts = parts.slice(1).filter((p) => !/^(?:ch|obd|ii|iib|lng|cng|bs[- ]?[ivx]+)$/i.test(p));
    // Keep short meaningful variant tokens only when clearly present (BASE, etc.)
    if (varParts.length && /^(?:base|std|standard|deluxe|disc|drum|abs)$/i.test(varParts[0])) {
      variant = varParts[0].toUpperCase();
    } else {
      variant = null; // never hallucinate full garbled OCR as variant
    }
  }
  return { make, model, variant, colour };
}

function stripTrailingTime(raw) {
  return String(raw || '')
    .replace(/\s+\d{1,2}:\d{2}(?::\d{2})?\s*$/, '')
    .trim();
}

function isNextDueDateLine(line) {
  return /\bnext\s*(?:service\s*)?(?:due|date)|(?:due|next)\s*date\b/i.test(String(line || ''));
}

/**
 * Prefer Invoice / Bill / Service / Job date. Never treat Next Due Date as service date.
 */
function extractServiceDate(lines, blob) {
  // Pass 1 — strong labels only (never bare "Date" on a Next Due line)
  for (const line of lines || []) {
    const text = cleanLine(line);
    if (!text || isNextDueDateLine(text)) continue;
    const m = text.match(
      /^(?:service\s*date|job\s*(?:date|card\s*date)|invoice\s*date|bill\s*date|inv\.?\s*date|invoice\s*dt\.?)\s*[:\-#]?\s*(.+)$/i,
    );
    if (!m?.[1]) continue;
    const fromLabel = parseDateToken(stripTrailingTime(m[1]));
    if (fromLabel) return fromLabel;
  }

  // Pass 2 — bare "Date:" only when the line is not a next-due line
  for (const line of lines || []) {
    const text = cleanLine(line);
    if (!text || isNextDueDateLine(text)) continue;
    const m = text.match(/^date\s*[:\-#]\s*(.+)$/i);
    if (!m?.[1]) continue;
    const fromLabel = parseDateToken(stripTrailingTime(m[1]));
    if (fromLabel) return fromLabel;
  }

  // Pass 3 — inline strong labels only (exclude "…Due Date…")
  const strong = String(blob || '').match(
    /(?:service\s*date|job\s*(?:card\s*)?date|invoice\s*date|bill\s*date|inv\.?\s*date)\s*[:\-#]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})(?:\s+\d{1,2}:\d{2})?/i,
  );
  if (strong?.[1]) {
    const iso = parseDateToken(strong[1]);
    if (iso) return iso;
  }
  return null;
}

function extractInvoiceNumber(lines, blob) {
  const labeled = matchLabeledOrNextLine(lines, [
    /^(?:invoice\s*(?:no\.?|number|#)|inv\.?\s*(?:no\.?|#)|bill\s*(?:no\.?|number|#)|tax\s*invoice\s*(?:no\.?|number)|job\s*(?:card\s*)?(?:no\.?|number|#)|jc\s*(?:no\.?|#))\s*[:\-#]?\s*(.+)$/i,
  ]);
  let raw = rejectServiceBillPlaceholder(labeled.value);
  if (raw && raw.length >= 2 && raw.length <= 40 && !IDENTITY_JUNK.test(raw)) {
    const token = raw.match(/^([A-Z0-9][A-Z0-9\/\-]{1,24})/i);
    const inv = (token?.[1] || raw).slice(0, 40);
    if (!rejectServiceBillPlaceholder(inv)) return fieldResult(null, 0, null, null);
    if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]/i.test(inv)) return fieldResult(null, 0, null, null);
    if (/^[6-9]\d{9}$/.test(inv.replace(/\D/g, ''))) return fieldResult(null, 0, null, null);
    if (/^(?:oice|invoice|number|no)$/i.test(inv)) return fieldResult(null, 0, null, null);
    return fieldResult(inv, 0.95, 'OCR_LABEL_CONTEXT', labeled.line);
  }
  const m = String(blob || '').match(
    /\b(?:invoice\s*(?:no\.?|number|#)|inv\.?\s*(?:no\.?|#)|job\s*card\s*(?:no\.?|number|#)|jc\s*(?:no\.?|#)|bill\s*(?:no\.?|number)|tax\s*invoice\s*(?:no\.?|number))\s*[:\-#]?\s*([A-Z0-9][A-Z0-9\/\-]{1,24})\b/i,
  );
  const hit = rejectServiceBillPlaceholder(m?.[1] ? cleanLine(m[1]) : '');
  if (!hit || /^(?:oice|invoice|number|no)$/i.test(hit) || /^[6-9]\d{9}$/.test(hit.replace(/\D/g, ''))) return fieldResult(null, 0, null, null);
  return fieldResult(hit.slice(0, 40), 0.85, 'OCR_INLINE', m?.[0] || null);
}

function isJunkShopName(value) {
  const t = cleanLine(value);
  if (!t || t.length < 3) return true;
  if (IDENTITY_JUNK.test(t)) return true;
  if (/^(?:invoice|inv|nvoice|bill|tax|gstin|reg\.?|regno|date|total|labour|parts)\b/i.test(t)) {
    return true;
  }
  if (/invoice\s*no|nvoice\s*no|bill\s*no/i.test(t) && t.length < 24) return true;
  return false;
}

function extractWorkshopName(lines, blob, existingShop = '') {
  if (existingShop && !isJunkShopName(existingShop)) return cleanLine(existingShop).slice(0, 80);
  const labeled = matchLabeledOrNextLine(lines, [
    /^(?:workshop|dealer(?:\s*name)?|service\s*centre|service\s*center|garage|authorised\s*dealer|authorized\s*dealer|vendor|sold\s*by|from)\s*[:\-#]?\s*(.+)$/i,
  ]);
  if (labeled.value && !isJunkShopName(labeled.value)) return labeled.value.slice(0, 80);

  for (const line of (lines || []).slice(0, 12)) {
    const t = cleanLine(line);
    if (t.length < 4 || t.length > 80) continue;
    if (/^(?:tax\s*invoice|job\s*card|service\s*invoice|bill|gstin|taxable|invoice\s*no|customer|bill\s*to)/i.test(t)) {
      continue;
    }
    if (isJunkShopName(t)) continue;
    if (/^\d+$/.test(t)) continue;
    if (DEALER_OR_WORKSHOP_NAME_RE.test(t)) {
      return t.slice(0, 80);
    }
  }
  return '';
}

function extractLineItems(lines) {
  const items = [];
  const skip =
    /^(?:sub\s*total|subtotal|grand\s*total|total|amount\s*payable|taxable|cgst|sgst|igst|gst|round\s*off|discount|labour\s*total|parts\s*total|odometer|odo|k\.?m\.?|current\s*km|running\s*km|next\s*service|registration|vehicle|invoice|job\s*card|gstin|hsn|sac|net\s*total)\b/i;
  for (const line of lines || []) {
    const t = cleanLine(line);
    if (!t || t.length < 3 || skip.test(t)) continue;
    if (NEXT_SERVICE_ODO_LABEL_RE.test(t) || /\b(?:current|running|opening|closing)\s*km\b/i.test(t)) continue;
    if (/\b\d{1,3}(?:[,.\s]\d{3})+\s*kms?\b/i.test(t)) continue;
    // Prefer trailing amount; TVS rows may include qty + taxable + tax columns.
    const moneyTokens = [...t.matchAll(/([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]+)?|[0-9]+\.[0-9]{2})\b/g)];
    if (!moneyTokens.length) continue;
    const last = moneyTokens[moneyTokens.length - 1];
    const amount = parseMoneyLoose(last[1]);
    if (amount == null || amount <= 0) continue;
    let name = cleanLine(t.slice(0, last.index)).replace(/\s+[0-9]+(?:\.[0-9]+)?\s*$/, '').trim();
    // Drop trailing qty / intermediate money columns from the name
    name = name.replace(/(?:\s+[0-9]+(?:\.[0-9]+)?)+\s*$/, '').trim();
    if (!name || name.length < 2 || IDENTITY_JUNK.test(name) || amount == null) continue;
    if (/^(?:total|tax|cgst|sgst|igst|labour|parts|round\s*off)$/i.test(name)) continue;
    items.push({
      index: items.length + 1,
      name: name.slice(0, 80),
      qty: 1,
      rate: amount,
      amount,
      isFee: false,
    });
    if (items.length >= 20) break;
  }
  return items;
}

function classifyPartsVsLabour(items = []) {
  const parts = [];
  const labour = [];
  for (const it of items) {
    const name = String(it?.name || '');
    if (
      /\b(?:labour|labor|service\s*charge|fitting|job\s*work|mechanic|wash|polish|cleaning\s*charge)\b/i.test(
        name,
      )
    ) {
      labour.push(it);
    } else if (
      /\b(?:chain\s*(?:cleaner|spray)|oil|filter|pad|spark|consumable|vas\d+|spare|part)\b/i.test(
        name,
      )
    ) {
      parts.push(it);
    } else {
      parts.push(it);
    }
  }
  return { parts, labour };
}

/**
 * True when OCR payload / blob looks like a service or repair bill.
 */
export function isServiceBillOcrDocument(data = {}, blob = '') {
  const docType = toDocTypeV2(
    data.documentTypeV2 ||
      data.document_type ||
      data.documentType ||
      data.scanDocumentType ||
      data.documentKind,
    { blob },
  );
  if (isServiceLikeDocument(docType)) return true;
  if (data.isServiceInvoice) return true;
  const text = String(blob || '');
  if (
    /\b(?:job\s*card|service\s*(?:invoice|bill)|workshop|labour\s*charges|periodic\s*service|repair\s*(?:invoice|bill)|vehicle\s*wash|chain\s*(?:cleaner|spray))\b/i.test(
      text,
    )
  ) {
    return true;
  }
  // TVS-style header: RegNo + KMs together strongly implies a workshop job card
  return /\breg\.?\s*no\.?\b|\bregno\b/i.test(text) && /\bkms?\b/i.test(text);
}

/**
 * Extract canonical service-bill fields. Never invents missing values.
 */
export function extractServiceBillFields(rawText = '', linesInput = null) {
  const blob = String(rawText || '');
  const lines =
    Array.isArray(linesInput) && linesInput.length
      ? linesInput.map((l) => cleanLine(l)).filter(Boolean)
      : blob
          .split(/\r?\n/)
          .map((l) => cleanLine(l))
          .filter(Boolean);

  const reg = extractRegistration(lines, blob);
  const serviceDate = extractServiceDate(lines, blob);
  const odoField = extractOdometer(lines, blob);
  const invField = extractInvoiceNumber(lines, blob);
  const customerField = extractCustomerName(lines, blob);
  const shopName = extractWorkshopName(lines, blob, '');
  const gstinMatch = String(blob || '').match(
    /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/i,
  );
  const items = extractLineItems(lines);
  const { parts, labour } = classifyPartsVsLabour(items);

  const modelLine =
    matchLabeled(lines, [/^(?:model|vehicle\s*model|veh\.?\s*model)\s*[:\-#]?\s*(.+)$/i]) ||
    lines.find(
      (l) =>
        /\b(?:tvs|honda|bajaj|hero|yamaha|royal\s*enfield|suzuki|mahindra|tata|maruti|hyundai|kia|toyota)\b/i.test(
          l,
        ),
    ) ||
    '';
  const vehicleId = parseVehicleIdentity(modelLine);

  let labourCost = matchLabeledMoney(blob, [
    'labour\\s*(?:charges|amount|cost)',
    'labor\\s*(?:charges|amount|cost)',
    'service\\s*charges?',
  ]);
  if (labourCost != null && labourCost <= 20) {
    labourCost = null;
  }
  if (labourCost == null && labour.length) {
    labourCost = labour.reduce((s, i) => s + (Number(i.amount) || 0), 0) || null;
  }

  const partsCost =
    matchLabeledMoney(blob, [
      'parts?\\s*(?:charges|amount|cost|total)',
      'spares?\\s*(?:total|amount)',
      'taxable\\s*(?:amount|value)?',
    ]) ?? (parts.length ? parts.reduce((s, i) => s + (Number(i.amount) || 0), 0) || null : null);

  const cgst = matchLabeledMoney(blob, ['cgst(?:\\s*total)?']);
  const sgst = matchLabeledMoney(blob, ['sgst(?:\\s*total)?']);
  const igst = matchLabeledMoney(blob, ['igst(?:\\s*total)?']);
  let taxAmount = matchLabeledMoney(blob, [
    'total\\s*tax',
    'tax\\s*amount',
    'gst\\s*amount',
    'total\\s*gst',
  ]);
  if (taxAmount == null) {
    const sum = [cgst, sgst, igst].filter((n) => n != null).reduce((a, b) => a + b, 0);
    taxAmount = sum > 0 ? Math.round(sum * 100) / 100 : null;
  }

  const totalAmount = matchLabeledMoney(blob, [
    'net\\s*total\\s*amount',
    'net\\s*(?:total|amount)',
    'grand\\s*total',
    'amount\\s*payable',
    'total\\s*amount',
    'invoice\\s*total',
    'total',
  ]);

  const nextServiceDueRaw = matchLabeled(lines, [
    /^(?:next\s*(?:service\s*)?(?:date|due)|next\s*due\s*date|due\s*date)\s*[:\-#]?\s*(.+)$/i,
  ]);
  const nextDueInline = String(blob || '').match(
    /(?:next\s*(?:service\s*)?(?:date|due)|next\s*due\s*date)\s*[:\-#]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i,
  );
  const nextServiceDueDate =
    parseDateToken(nextServiceDueRaw) ||
    (nextDueInline?.[1] ? parseDateToken(nextDueInline[1]) : null);
  const nextServiceDueOdometer = findNextServiceOdometer(blob);
  const nextServiceDue =
    nextServiceDueDate || (nextServiceDueOdometer ? `${nextServiceDueOdometer} KM` : null);

  const paymentLabeled = findLabeledValue(blob, {
    labels: [/payment\s*(?:mode|type|method)|mode\s*of\s*payment|paid\s*(?:by|via)|tender/i],
    accept: (v) =>
      /cash|card|upi|neft|rtgs|cheque|online|credit|debit|gpay|phonepe|paytm/i.test(v) && v.length <= 40,
    maxLinesAfter: 2,
  });
  const paymentMode = paymentLabeled?.value
    ? paymentLabeled.value.replace(/[^A-Za-z\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
    : '';
  const discount = matchLabeledMoney(blob, ['(?:less\\s*)?discount', 'disc\\.?']);

  const jcField = matchLabeledOrNextLine(lines, [
    /^(?:job\s*(?:card\s*)?(?:no|number|#)|jc\s*(?:no|#)?)\s*[:\-#]?\s*(.+)$/i,
  ]);
  const jobCardNumber = rejectServiceBillPlaceholder(jcField.value);

  // Frame / chassis — only when labeled on this bill (never invent from asset).
  const chassisLabeled = matchLabeledOrNextLine(lines, [
    /^(?:frame\s*(?:no|number|#)?|frameno|chassis\s*(?:no|number|#)?|vin)\s*[:\-#.]?\s*(.+)$/i,
  ]);
  let chassisNumber = '';
  let chassisEvidence = null;
  const chassisCandidate = rejectServiceBillPlaceholder(chassisLabeled.value);
  if (chassisCandidate) {
    const compact = String(chassisCandidate)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (/^[A-HJ-NPR-Z0-9]{10,17}$/i.test(compact)) {
      chassisNumber = compact;
      chassisEvidence = chassisLabeled.line || chassisCandidate;
    }
  }
  if (!chassisNumber) {
    const frameInline = String(blob || '').match(
      /\bframe\s*no\.?\s*[:\-#]?\s*([A-HJ-NPR-Z0-9]{10,17})\b/i,
    );
    const frameGlued = String(blob || '').match(
      /\bframeno\.?\s*[:\-#]?\s*([A-HJ-NPR-Z0-9]{10,17})\b/i,
    );
    const hit = frameInline || frameGlued;
    if (hit?.[1]) {
      chassisNumber = hit[1].toUpperCase();
      chassisEvidence = hit[0];
    }
  }

  const engineLabeled = matchLabeledOrNextLine(lines, [
    /^(?:engine\s*(?:no|number|#)?|eng\.?\s*no)\s*[:\-#.]?\s*(.+)$/i,
  ]);
  let engineNumber = '';
  const engineCandidate = rejectServiceBillPlaceholder(engineLabeled.value);
  if (engineCandidate) {
    const compact = String(engineCandidate)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    // Reject short OCR junk (e.g. OBDIB model token) and placeholders
    if (compact.length >= 6 && compact.length <= 20 && !/^OBD/i.test(compact)) {
      engineNumber = compact;
    }
  }

  const workPerformed = items
    .map((i) => i.name)
    .filter(Boolean)
    .slice(0, 12);

  const keepReg =
    reg.registrationConfidence === 'high' || reg.registrationConfidence === 'medium';
  let registration = keepReg ? reg.registration : '';
  let registrationConfidence = reg.registrationConfidence;
  let registrationSource = reg.registrationSource;
  if (!registration) {
    const nearbyPlate = findLabeledValue(blob, {
      labels: [
        /reg\.?\s*no\.?|regno\.?|registration|regn\.?\s*no/i,
        /vehicle\s*(?:no|number|regn)/i,
      ],
      accept: (v) => plateToken(v),
      maxLinesAfter: 4,
    });
    if (nearbyPlate?.value) {
      registration = String(nearbyPlate.value)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      registrationConfidence = 'high';
      registrationSource = 'semantic_label';
    }
  }
  const odometerKm = odoField.value;
  const odometerUnit = odometerKm != null ? 'km' : null;
  const invoiceNumber = invField.value || '';
  const customerName = customerField.value || '';

  const confidence = {
    registration: registration
      ? registrationConfidence === 'high'
        ? 0.95
        : 0.8
      : 0,
    odometerReading: odoField.confidence || 0,
    invoiceNumber: invField.confidence || 0,
    customerName: customerField.confidence || 0,
    serviceDate: serviceDate ? 0.9 : 0,
    totalAmount: totalAmount != null ? 0.85 : 0,
    workshop: shopName ? 0.8 : 0,
  };
  const evidence = {
    registration: reg.registrationSource || null,
    odometerReading: odoField.evidence,
    invoiceNumber: invField.evidence,
    customerName: customerField.evidence,
  };

  /** Critical fields below this threshold must be verified before save. */
  const VERIFY_THRESHOLD = 0.7;
  const lowConfidenceFields = [];
  const needsVerification = {};
  const criticalChecks = [
    ['customerName', customerName, confidence.customerName],
    ['registration', registration, confidence.registration],
    ['odometerKm', odometerKm, confidence.odometerReading],
    ['serviceDate', serviceDate, confidence.serviceDate],
    ['totalAmount', totalAmount, confidence.totalAmount],
  ];
  for (const [key, value, conf] of criticalChecks) {
    if (value == null || value === '') continue;
    if (conf < VERIFY_THRESHOLD) {
      lowConfidenceFields.push(key);
      needsVerification[key] = true;
    }
  }
  if (customerName && confidence.customerName < VERIFY_THRESHOLD) {
    needsVerification.customerNameHint = 'Please verify customer name';
  }
  if (odometerKm != null && confidence.odometerReading < VERIFY_THRESHOLD) {
    needsVerification.odometerHint = 'Please verify odometer reading';
  }

  const canonical = {
    documentType: 'SERVICE_INVOICE',
    seller: {
      name: shopName || null,
      gstin: gstinMatch?.[1] ? gstinMatch[1].toUpperCase() : null,
      address: null,
      phone: null,
    },
    customer: {
      name: customerName || null,
      phone: null,
      address: null,
    },
    vehicle: {
      registrationNumber: registration || null,
      make: vehicleId.make,
      model: vehicleId.model,
      variant: vehicleId.variant,
      colour: vehicleId.colour,
      vin: chassisNumber || null,
      chassisNumber: chassisNumber || null,
      engineNumber: engineNumber || null,
    },
    service: {
      serviceDate: serviceDate || null,
      invoiceDate: serviceDate || null,
      invoiceNumber: invoiceNumber || null,
      jobCardNumber: jobCardNumber || null,
      odometerReading: odometerKm,
      odometerUnit,
      serviceType: workPerformed.length ? 'service' : null,
    },
    financial: {
      subtotal: partsCost,
      cgst,
      sgst,
      igst,
      gst: taxAmount,
      discount,
      totalAmount,
    },
    confidence,
    evidence,
  };

  return {
    registration: registration || '',
    registrationConfidence,
    registrationSource,
    serviceDate: serviceDate || null,
    invoiceDate: serviceDate || null,
    odometerKm,
    odometerReading: odometerKm,
    odometerUnit,
    shopName,
    serviceProvider: shopName,
    invoiceNumber,
    customerName,
    buyerName: customerName,
    brandName: vehicleId.make || '',
    model: vehicleId.model || '',
    variant: vehicleId.variant || '',
    colour: vehicleId.colour || '',
    items,
    serviceItems: workPerformed,
    workPerformed: workPerformed.join(', '),
    parts: parts.map((p) => p.name).filter(Boolean),
    partsCost,
    labourCost,
    labour: labourCost,
    cgst,
    sgst,
    igst,
    taxAmount,
    tax: taxAmount,
    discount,
    totalAmount,
    paymentMode,
    nextServiceDue: nextServiceDue || null,
    nextServiceDueDate: nextServiceDueDate || null,
    nextServiceDueOdometer: nextServiceDueOdometer || null,
    jobCardNumber: jobCardNumber || '',
    chassisNumber: chassisNumber || '',
    engineNumber: engineNumber || '',
    chassisEvidence: chassisEvidence || null,
    documentType: 'service_invoice',
    documentKind: 'service_invoice',
    documentTypeV2: DOC_TYPE_V2.SERVICE_BILL,
    documentLabel: 'Service Bill',
    scanDocumentType: 'service_invoice',
    isServiceInvoice: true,
    requiresVehicleLink: true,
    isVehicleInvoice: false,
    canonicalServiceBill: canonical,
    serviceBillConfidence: confidence,
    serviceBillEvidence: evidence,
    lowConfidenceFields,
    needsVerification,
    customerNameNeedsVerify: Boolean(needsVerification.customerName),
    odometerNeedsVerify: Boolean(needsVerification.odometerKm),
  };
}

/**
 * Flag impossible odometer regressions vs prior service history.
 * Never silently overwrites history — callers should surface NEEDS_REVIEW.
 */
export function validateOdometerAgainstHistory(currentKm, previousKm) {
  const cur = currentKm != null ? Number(currentKm) : null;
  const prev = previousKm != null ? Number(previousKm) : null;
  if (cur == null || !Number.isFinite(cur)) {
    return { ok: false, needsReview: true, reason: 'missing_current' };
  }
  if (prev == null || !Number.isFinite(prev)) {
    return { ok: true, needsReview: false, reason: null };
  }
  if (cur + 50 < prev) {
    return { ok: false, needsReview: true, reason: 'odometer_regression' };
  }
  return { ok: true, needsReview: false, reason: null };
}

/**
 * Apply service-bill OCR onto an invoice/session object (mutates).
 */
export function applyServiceBillOcrToInvoice(data = {}, blob = '') {
  const text = String(blob || data.rawText || '');
  if (!isServiceBillOcrDocument(data, text)) return data;

  const lines = text
    .split(/\r?\n/)
    .map((l) => cleanLine(l))
    .filter(Boolean);
  const extracted = extractServiceBillFields(text, lines);

  data.documentType = 'service_invoice';
  data.documentKind = 'service_invoice';
  data.documentTypeV2 = DOC_TYPE_V2.SERVICE_BILL;
  data.scanDocumentType = 'service_invoice';
  data.documentLabel = data.documentLabel || 'Service Bill';
  data.isServiceInvoice = true;
  data.requiresVehicleLink = true;
  data.isVehicleInvoice = false;

  if (
    extracted.registration &&
    (extracted.registrationConfidence === 'high' || extracted.registrationConfidence === 'medium')
  ) {
    data.registration = extracted.registration;
  } else if (
    extracted.registrationConfidence === 'low' ||
    extracted.registrationConfidence === 'none'
  ) {
    if (!isConfidentIndianPlate(data.registration)) {
      data.registration = '';
    }
  }
  data.registrationConfidence = extracted.registrationConfidence;
  data.registrationSource = extracted.registrationSource;

  if (extracted.serviceDate) {
    // Always prefer the labelled invoice/service date over any earlier fallback
    // (e.g. Next Due Date / first-date-in-blob) that polluted invoiceDate.
    data.serviceDate = extracted.serviceDate;
    data.invoiceDate = extracted.serviceDate;
    data.purchaseDate = extracted.serviceDate;
    data.purchase_date = extracted.serviceDate;
    data.invoice_date = extracted.serviceDate;
  }
  if (extracted.odometerKm != null) {
    data.odometerKm = extracted.odometerKm;
    data.odometerReading = extracted.odometerKm;
    data.odometerUnit = extracted.odometerUnit || 'km';
  }
  if (extracted.shopName) {
    data.shopName = extracted.shopName;
    data.serviceProvider = extracted.shopName;
    data.sellerName = extracted.shopName;
  } else if (isJunkShopName(data.shopName)) {
    data.shopName = '';
    data.serviceProvider = '';
  }
  if (extracted.invoiceNumber) {
    data.invoiceNumber = extracted.invoiceNumber;
  } else if (isUiPlaceholder(data.invoiceNumber) || isJunkShopName(data.invoiceNumber)) {
    data.invoiceNumber = '';
  }
  if (extracted.customerName) {
    data.customerName = extracted.customerName;
    data.buyerName = extracted.customerName;
    data.buyer_name = extracted.customerName;
    data.owner_buyer_name = extracted.customerName;
  } else if (isUiPlaceholder(data.customerName)) {
    data.customerName = '';
    data.buyerName = '';
  }
  if (extracted.brandName) data.brandName = extracted.brandName;
  if (extracted.model) data.model = extracted.model;
  if (extracted.brandName || extracted.model) {
    const makeModel = [extracted.brandName, extracted.model].filter(Boolean).join(' ').trim();
    if (makeModel) {
      // Service bills: always surface clean MAKE MODEL (not part/variant description lines).
      data.productName = makeModel;
      data.itemName = makeModel;
    }
  }
  if (extracted.canonicalServiceBill) {
    data.canonicalServiceBill = extracted.canonicalServiceBill;
    data.serviceBillConfidence = extracted.serviceBillConfidence;
    data.serviceBillEvidence = extracted.serviceBillEvidence;
  }
  if (Array.isArray(extracted.lowConfidenceFields) && extracted.lowConfidenceFields.length) {
    data.lowConfidenceFields = extracted.lowConfidenceFields;
    data.needsVerification = extracted.needsVerification || {};
    data.customerNameNeedsVerify = Boolean(extracted.customerNameNeedsVerify);
    data.odometerNeedsVerify = Boolean(extracted.odometerNeedsVerify);
  }
  if (extracted.labourCost != null) data.labourCost = extracted.labourCost;
  if (extracted.partsCost != null) data.partsCost = extracted.partsCost;
  if (extracted.taxAmount != null) {
    data.taxAmount = extracted.taxAmount;
    data.tax = extracted.taxAmount;
  }
  if (extracted.cgst != null) data.cgst = extracted.cgst;
  if (extracted.sgst != null) data.sgst = extracted.sgst;
  if (extracted.igst != null) data.igst = extracted.igst;
  if (extracted.totalAmount != null) data.totalAmount = extracted.totalAmount;
  if (extracted.discount != null) data.discount = extracted.discount;
  if (extracted.paymentMode) data.paymentMode = extracted.paymentMode;
  if (extracted.nextServiceDue) data.nextServiceDue = extracted.nextServiceDue;
  if (extracted.nextServiceDueOdometer != null) data.nextServiceDueOdometer = extracted.nextServiceDueOdometer;
  if (extracted.nextServiceDueDate) data.nextServiceDueDate = extracted.nextServiceDueDate;
  if (Array.isArray(extracted.items) && extracted.items.length) {
    data.items = extracted.items;
    data.itemCount = extracted.items.length;
  }
  if (extracted.workPerformed) data.workPerformed = extracted.workPerformed;
  if (Array.isArray(extracted.parts) && extracted.parts.length) data.parts = extracted.parts;
  if (Array.isArray(extracted.serviceItems)) data.serviceItems = extracted.serviceItems;

  // Keep scanned service-bill data separate from existing asset / purchase OCR identity.
  // Only retain chassis/engine when this bill itself labels them.
  if (extracted.chassisNumber) {
    data.chassisNumber = extracted.chassisNumber;
  } else if (!/\b(?:chassis|frame\s*no|vin)\b/i.test(text)) {
    data.chassisNumber = '';
  }
  if (extracted.engineNumber) {
    data.engineNumber = extracted.engineNumber;
  } else if (!/\b(?:engine\s*(?:no|number)|eng\.?\s*no)\b/i.test(text)) {
    data.engineNumber = '';
  }

  if (!data.productName || /^(?:service|repair|job\s*card|invoice)$/i.test(String(data.productName))) {
    if (extracted.brandName && extracted.model) {
      data.productName = `${extracted.brandName} ${extracted.model}`.slice(0, 80);
    } else {
      const model =
        matchLabeled(lines, [/^(?:model|vehicle\s*model|veh\.?\s*model)\s*[:\-#]?\s*(.+)$/i]) ||
        lines.find(
          (l) =>
            /\b(?:tvs|honda|bajaj|hero|yamaha|royal\s*enfield)\b/i.test(l) &&
            /ronin|activa|pulsar|apache|splendor|classic/i.test(l),
        ) ||
        '';
      if (model && !isJunkShopName(model)) {
        data.productName = cleanLine(model).slice(0, 80);
      } else {
        data.productName = extracted.workPerformed
          ? `Service · ${extracted.workPerformed.slice(0, 48)}`
          : 'Service Bill';
      }
    }
  }

  // Service bills are always vehicle-linked documents for review binding
  data.showVehicleFields = true;
  data.assetDocCategory = 'VEHICLE';
  data.requiresVehicleLink = true;

  return data;
}

export { isJunkShopName };

export default {
  isConfidentIndianPlate,
  normalizeIndianRegistration,
  isServiceBillOcrDocument,
  extractServiceBillFields,
  applyServiceBillOcrToInvoice,
  rejectServiceBillPlaceholder,
  validateOdometerAgainstHistory,
  isJunkShopName,
};

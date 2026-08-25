/**
 * Canonical product-name validation for OCR → vault.
 * Strict semantic separation: PRODUCT vs MODEL vs IMEI vs SERIAL vs SKU vs HSN
 * vs INVOICE# vs PRICE/TAX vs QTY vs WARRANTY vs SELLER.
 * Never invent names — reject and leave blank / Unnamed Asset for user confirm.
 */

import { cleanVehicleModelName } from './lineItemVariantMerge';

/** Indian GSTIN shape */
export const PRODUCT_GSTIN_RE =
  /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/i;

const FALLBACK_PRODUCT_NAME = 'Unnamed Asset';

/** Leading punctuation / OCR brackets before a field label */
const STRIP_LEAD = /^[\s\[\(\{\"'\<\|\.\,\:\;\-]+/;

const LABELED_ID =
  /^(?:imei|imev|serial(?:\s*(?:no|number|#))?|s\/n|barcode|ean|upc|sku|hsn|sac|gstin|gst\s*(?:no|in|#)?|invoice(?:\s*(?:no|number|#))?|inv(?:oice)?\.?\s*(?:no|#)?|order(?:\s*(?:no|number|#))?|txn(?:\s*id)?|transaction(?:\s*id)?|tracking(?:\s*(?:no|id|number))?|awb|phone|mobile|tel|qty|quantity|tax(?:\s*%)?|cgst|sgst|igst|pin(?:\s*code)?|pincode|date|bill\s*(?:no|number))\s*[:\-#]?\s*/i;

const CONTAINS_ID_LABEL =
  /\b(?:imei|imev|serial\s*(?:no|number)|barcode|ean[\s\-]?13|gstin|invoice\s*(?:no|number|#)|order\s*(?:no|number|#)|txn\s*id|tracking\s*(?:no|id)|awb\b|hsn\b|sac\b)\b/i;

/** OCR glues "IMEI/Serial No:" → "[IMEVSerial No:" etc. */
const GARBLED_IMEI_SERIAL =
  /ime[ilvy0]?[\s\/\-_]*serial|serial[\s\/\-_]*no\.?|s\s*\/\s*n\b/i;

const PRODUCT_HINT =
  /\b(?:phone|mobile|handset|laptop|tv|led|ac|fridge|watch|earbud|headphone|tablet|console|camera|nothing|samsung|apple|iphone|oneplus|xiaomi|realme|vivo|oppo|motorola|boat|tvs|hero|honda|bajaj|ronin)\b/i;

/**
 * @param {string} name
 * @returns {string|null} rejection reason code, or null if acceptable
 */
export function rejectProductNameReason(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'empty';
  if (raw.length < 3) return 'too_short';
  if (raw.length > 120) return 'too_long';

  const compact = raw.replace(/\s+/g, ' ');
  const stripped = compact.replace(STRIP_LEAD, '').trim();
  const digitsOnly = raw.replace(/\D/g, '');
  const alnum = raw.replace(/[^A-Za-z0-9]/g, '');

  // Garbled vehicle OCR crumbs (dealer invoice column bleed)
  if (
    /\bRONIN\b/i.test(compact) &&
    /\b(?:Reck|Tbtmt|0BDHP|OBDHP)\b/i.test(compact) &&
    !/\bTVS\b/i.test(compact)
  ) {
    return 'ocr_garbage_vehicle';
  }

  // Garbled IMEI/Serial label fragments (primary production bug)
  if (GARBLED_IMEI_SERIAL.test(compact) || GARBLED_IMEI_SERIAL.test(stripped)) {
    if (!PRODUCT_HINT.test(compact)) return 'labeled_identifier';
  }
  if (/^\[?\s*ime[ilvy0]/i.test(compact) && /serial|no\s*[:\.]?/i.test(compact)) {
    return 'labeled_identifier';
  }
  // Incomplete label crumbs ending with ":" / "No:"
  if (
    /(?:imei|imev|serial|invoice|gstin|hsn|sku)\s*(?:no\.?)?\s*[:\-#]?\s*$/i.test(stripped) &&
    !PRODUCT_HINT.test(stripped)
  ) {
    return 'label_fragment';
  }

  if (LABELED_ID.test(compact) || LABELED_ID.test(stripped)) return 'labeled_identifier';
  if (CONTAINS_ID_LABEL.test(compact) && digitsOnly.length >= 6) return 'id_with_digits';
  if (CONTAINS_ID_LABEL.test(stripped) && digitsOnly.length >= 6) return 'id_with_digits';

  if (PRODUCT_GSTIN_RE.test(raw.replace(/\s/g, ''))) return 'gstin';
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(alnum) && alnum.length === 15) {
    return 'gstin';
  }

  // Pure / near-pure numeric identifiers (incl. 14–18 digit IMEI/serial runs)
  if (!/[A-Za-z]{3,}/.test(raw)) {
    if (digitsOnly.length >= 8) return 'pure_numeric';
    if (digitsOnly.length >= 14 && digitsOnly.length <= 18) return 'imei';
    return 'no_letters';
  }
  if (digitsOnly.length >= 14 && digitsOnly.length <= 18 && !PRODUCT_HINT.test(raw)) {
    return 'imei';
  }

  // IMEI (15), barcode EAN-13 / UPC-A, short barcodes
  if (/^\d{15}$/.test(digitsOnly) && digitsOnly.length === raw.replace(/\s/g, '').length) {
    return 'imei';
  }
  if (/^\d{15}$/.test(digitsOnly) && raw.replace(/[\s\-]/g, '') === digitsOnly) return 'imei';
  if (/^\d{12,14}$/.test(digitsOnly) && !/[A-Za-z]/.test(raw)) return 'barcode';
  if (/^\d{8}$/.test(digitsOnly) && !/[A-Za-z]/.test(raw)) return 'barcode';

  // Indian mobile / phone
  if (/^(?:\+?91[\s\-]?)?[6-9]\d{9}$/.test(raw.replace(/\s/g, ''))) return 'phone';
  if (/^[6-9]\d{9}$/.test(digitsOnly) && digitsOnly.length === 10 && !/[A-Za-z]{3,}/.test(raw)) {
    return 'phone';
  }

  // Invoice / order / txn shaped tokens without product words
  if (
    /^(?:inv|invoice|bill|order|ord|txn|tr[x]?n?|ref)[\s\-#:]*[A-Z0-9\-\/]{4,}$/i.test(compact) ||
    /^(?:inv|invoice|bill|order|ord|txn|tr[x]?n?|ref)[\s\-#:]*[A-Z0-9\-\/]{4,}$/i.test(stripped)
  ) {
    return 'invoice_or_order';
  }
  if (/^(?:INV|ORD|TXN|TRK|AWB)[\-\/]?[A-Z0-9]{4,}$/i.test(alnum)) return 'invoice_or_order';

  // HSN / SAC codes (typically 4–8 digits, sometimes with label)
  if (/^(?:hsn|sac)[\s:\-]*\d{4,8}$/i.test(compact) || /^(?:hsn|sac)[\s:\-]*\d{4,8}$/i.test(stripped)) {
    return 'hsn_sac';
  }
  if (/^\d{4,8}$/.test(raw) && !/[A-Za-z]/.test(raw)) return 'hsn_sac';

  // Tax percent
  if (/^(?:cgst|sgst|igst|gst|tax)\s*[@:]?\s*\d{1,2}(?:\.\d+)?\s*%?$/i.test(compact)) {
    return 'tax_percent';
  }
  if (/^\d{1,2}(?:\.\d+)?\s*%$/.test(compact)) return 'tax_percent';

  // Qty
  if (/^(?:qty|quantity|pcs|nos?\.?)\s*[:\-]?\s*\d+$/i.test(compact)) return 'quantity';
  if (/^\d+\s*(?:pcs|nos?\.?|units?|qty)$/i.test(compact)) return 'quantity';

  // Date-only
  if (/^\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}$/.test(compact)) return 'date';
  if (/^\d{4}-\d{2}-\d{2}$/.test(compact)) return 'date';

  // Pincode / address crumbs
  if (/^(?:pin(?:code)?|pin\s*code)\s*[:\-]?\s*[1-9]\d{5}$/i.test(compact)) return 'pincode';
  if (/^[1-9]\d{5}$/.test(raw) && !/[A-Za-z]/.test(raw)) return 'pincode';
  if (
    /\b(?:pin\s*code|pincode|uttar\s*pradesh|maharashtra|sector|nagar|colony|district|road|rd\.?|crossing|street|st\.?|avenue|lane|marg|chowk|bypass|patrakarpuram)\b/i.test(
      compact,
    ) && !PRODUCT_HINT.test(compact)
  ) {
    return 'address';
  }

  // Seller / legal entity — never the asset name (device: CLOUDSTORE RETAIL PRIVATE LIMITED)
  if (isSellerCompanyName(compact) && !PRODUCT_HINT.test(compact)) {
    return 'seller_company';
  }
  if (/^thank\s*you!?$/i.test(compact)) return 'junk_header';

  // Marketplace footer / contact / coupon — never a line item (physical Flipkart invoice)
  if (
    /helpcentre|help\s*center|www\.|\.com\/|https?:\/\//i.test(compact) ||
    /\bcoupon/i.test(compact) ||
    /amount\s*\/?\s*coupon/i.test(compact) ||
    (/\bcontact\b/i.test(compact) && (/\d{8,}/.test(compact) || /\.com/i.test(compact)))
  ) {
    return 'invoice_boilerplate';
  }

  // Generic junk headers
  if (
    /^(?:invoice|tax\s*invoice|bill|total|sub\s*total|grand\s*total|amount|taxable|particulars|description\s*of\s*goods|customer|dealer|date|number|product|includes?)$/i.test(
      compact,
    ) ||
    /^(?:invoice|tax\s*invoice|bill|total|sub\s*total|grand\s*total|amount|taxable|particulars|description\s*of\s*goods|customer|dealer|date|number|product|includes?)$/i.test(
      stripped,
    )
  ) {
    return 'junk_header';
  }

  if (
    /\b(?:gstin|cgst|sgst|igst|toll[\s\-]?free|customer\s*care|helpline|policy\s*no|1800\s*\d)\b/i.test(
      compact,
    )
  ) {
    return 'junk_header';
  }

  // Serial-like long alnum without spaces (often chassis mis-filed) — allow if has brand-like words
  if (
    /^[A-Z0-9\-]{10,}$/i.test(raw) &&
    !/\s/.test(raw) &&
    digitsOnly.length >= 6 &&
    !/\b(?:tvs|hero|honda|samsung|apple|lg|sony|volatas|voltas|nothing|xiaomi|oneplus)\b/i.test(
      raw,
    )
  ) {
    return 'serial_like';
  }

  return null;
}

export function isValidProductName(name) {
  return rejectProductNameReason(name) == null;
}

const SELLER_COMPANY_TAIL =
  /\b(?:pvt\.?\s*ltd\.?|private\s+limited|limited|llp|llc|inc\.?|corporation|enterprises)\s*\.?$/i;

/** Legal-entity / shop name — keep as seller, never as product. */
export function isSellerCompanyName(name) {
  const s = String(name || '').replace(/\s+/g, ' ').trim();
  if (!s) return false;
  if (/^thank\s*you!?$/i.test(s)) return true;
  if (/^\s*(?:sold\s*by|dealer|vendor|retailer)\b/i.test(s)) return true;
  if (
    /\b(?:motor\s*company|motors?\s*(?:company|limited)|company\s*limited|moto\s*legends)\b/i.test(s) &&
    !/\bRONIN\b/i.test(s)
  ) {
    return true;
  }
  if (SELLER_COMPANY_TAIL.test(s) && !PRODUCT_HINT.test(s)) return true;
  if (SELLER_COMPANY_TAIL.test(s) && !/\b(?:phone|ronin|pulsar|apache|jupiter|activa)\b/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * Recover the primary product line from raw OCR when the parser seeded a seller name.
 * Generic: first valid product-hint line, plus a following variant line (color / storage / trim).
 */
export function findPrimaryProductInLines(linesOrText) {
  const lines = Array.isArray(linesOrText)
    ? linesOrText
    : String(linesOrText || '')
        .split(/\r?\n/)
        .map((l) => String(l || '').trim())
        .filter(Boolean);

  let bestVehicle = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!PRODUCT_HINT.test(line)) continue;
    if (isSellerCompanyName(line)) continue;
    if (/^(?:download|includes?\s+hsrp|customer\s*care)/i.test(line)) continue;

    const vehicleCandidate = recoverVehicleProductName('', [line, lines[i + 1], lines[i + 2]].filter(Boolean));
    if (vehicleCandidate && vehicleCandidate.length > bestVehicle.length) {
      bestVehicle = vehicleCandidate;
    }

    const ev = evaluateProductName(line, { fromLineItem: true, labeledProduct: true, fromVehicleModel: true });
    if (!ev.ok || !ev.value) continue;
    let name = ev.value;
    let variant = '';
    const next = lines[i + 1] || '';
    const next2 = lines[i + 2] || '';
    if (/^\([^)]{2,48}\)$/.test(next) || (/\b\d+\s*GB\b/i.test(next) && next.length < 48)) {
      variant = next.replace(/^\(|\)$/g, '').trim();
      name = `${name} ${next}`.replace(/\s+/g, ' ').trim();
    } else if (
      next &&
      /\bRONIN\b/i.test(name) &&
      /\bRONIN\b/i.test(next) &&
      /\b(?:base|lightning|black|white|obd)/i.test(next)
    ) {
      name = recoverVehicleProductName(name, [line, next, next2]) || `${name} ${next}`.replace(/\s+/g, ' ').trim();
    }
    return { name, variant, index: i };
  }
  if (bestVehicle) return { name: bestVehicle, variant: '', index: 0 };
  return null;
}

/**
 * Best-effort vehicle model recovery from noisy OCR (TVS Ronin dealer invoices).
 * @param {string} seed
 * @param {string[]|string} linesOrText
 * @returns {string}
 */
export function recoverVehicleProductName(seed, linesOrText) {
  const lines = Array.isArray(linesOrText)
    ? linesOrText
    : String(linesOrText || '')
        .split(/\r?\n/)
        .map((l) => String(l || '').trim())
        .filter(Boolean);

  const candidates = [];
  for (const line of lines) {
    if (!/\bRONIN\b/i.test(line)) continue;
    if (/^(?:download|includes?\s+hsrp|customer\s*care|part\s*description)/i.test(line)) continue;
    if (/frame\s*no|engine\s*no|ex[\s-]?showroom/i.test(line) && !/\bRONIN\b/i.test(line.split(/frame|engine/i)[0])) {
      /* keep rows that start with model before frame/engine columns */
    }
    const cleaned = cleanVehicleModelName(line);
    if (cleaned && /\bRONIN\b/i.test(cleaned)) candidates.push(cleaned);
  }

  if (seed && /\bRONIN\b/i.test(seed)) {
    const cleanedSeed = cleanVehicleModelName(seed);
    if (cleanedSeed) candidates.push(cleanedSeed);
  }

  if (!candidates.length) return '';

  candidates.sort((a, b) => vehicleNameScore(b) - vehicleNameScore(a));

  const best = candidates[0];
  return isValidProductName(best) ? best : sanitizeProductName(best, { fromVehicleModel: true });
}

function vehicleNameScore(s) {
  return (
    (/\bTVS\b/i.test(s) ? 5 : 0) +
    (/\bLIGHTNING\b/i.test(s) ? 3 : 0) +
    (/\bBLACK\b/i.test(s) ? 2 : 0) +
    (/\bBASE\b/i.test(s) ? 2 : 0) +
    (/\bOBDIIB?\b/i.test(s) ? 1 : 0) -
    ((String(s).match(/\bRONIN\b/gi) || []).length > 1 ? 4 : 0) -
    (/\b(?:Reck|Tbtmt|0BDHP)\b/i.test(s) ? 5 : 0) +
    Math.min(String(s).length / 25, 3)
  );
}

/**
 * @returns {{ ok: boolean, value: string, reason: string|null, needsConfirm: boolean, confidence: number }}
 */
export function evaluateProductName(name, context = {}) {
  const cleaned = String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  const reason = rejectProductNameReason(cleaned);
  if (reason) {
    return {
      ok: false,
      value: '',
      reason,
      needsConfirm: true,
      confidence: 0,
      confirmHint: 'Please confirm the product name',
    };
  }

  let confidence = 0.72;
  if (context.fromLineItem) confidence += 0.12;
  if (context.fromVehicleModel) confidence += 0.15;
  if (context.labeledProduct) confidence += 0.1;
  if (cleaned.split(/\s+/).length >= 2) confidence += 0.05;
  if (cleaned.length < 5) confidence -= 0.15;
  confidence = Math.max(0.2, Math.min(0.98, confidence));

  const needsConfirm = confidence < 0.55;
  return {
    ok: true,
    value: cleaned,
    reason: null,
    needsConfirm,
    confidence: Math.round(confidence * 100),
    confirmHint: needsConfirm ? 'Please confirm the product name' : '',
  };
}

/** Strip rejected values; never invent a replacement */
export function sanitizeProductName(name, context = {}) {
  const result = evaluateProductName(name, context);
  return result.ok ? result.value : '';
}

/**
 * Pick first valid candidate from OCR alternatives, else Unnamed Asset.
 * @param {...unknown} candidates
 */
export function resolveDisplayProductName(...candidates) {
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const item of c) {
        const name = typeof item === 'string' ? item : item?.name || item?.productName;
        const cleaned = sanitizeProductName(name, { fromLineItem: true });
        if (cleaned) return cleaned;
      }
      continue;
    }
    const cleaned = sanitizeProductName(c);
    if (cleaned) return cleaned;
  }
  return FALLBACK_PRODUCT_NAME;
}

export { FALLBACK_PRODUCT_NAME };

export default {
  PRODUCT_GSTIN_RE,
  FALLBACK_PRODUCT_NAME,
  rejectProductNameReason,
  isValidProductName,
  isSellerCompanyName,
  findPrimaryProductInLines,
  recoverVehicleProductName,
  evaluateProductName,
  sanitizeProductName,
  resolveDisplayProductName,
};

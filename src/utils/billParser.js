/**
 * Sweet Bill Checker — lightweight regex bill parser + duplicate detection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { extractBillLineItems } from './billLineItems';

const DUPLICATE_KEY = '@asset_doctor/sweet_bill_duplicates_v1';

/**
 * Parse OCR text into GSTIN / date / total / warranty / line items.
 */
export function parseBillData(rawText = '') {
  const text = String(rawText || '');
  const gstin = extractGstin(text);
  const invoiceDate = extractInvoiceDate(text);
  const totalAmount = extractTotalAmount(text);
  const warrantyPeriodMonths = extractWarrantyMonths(text);
  const expiryDate =
    extractExpiryDate(text) ||
    (invoiceDate && warrantyPeriodMonths
      ? addMonths(invoiceDate, warrantyPeriodMonths)
      : null);

  const lineBlock = extractBillLineItems(text, { totalAmount, subtotal: null });

  // Re-run with computed total as hint when available
  const refined =
    totalAmount > 0
      ? extractBillLineItems(text, { totalAmount, subtotal: totalAmount })
      : lineBlock;

  return {
    gstin,
    invoiceDate,
    totalAmount,
    expiryDate,
    warrantyPeriodMonths,
    items: refined.items,
    itemCount: refined.itemCount,
    itemsSubtotal: refined.itemsSubtotal,
    rawText: text,
  };
}

/** Indian GSTIN — e.g. 22AAAAA0000A1Z5 / dealer "Dlr GST :" */
export function extractGstin(text) {
  const upper = String(text || '').toUpperCase();
  const labeled = upper.match(
    /(?:DLR\.?\s*GST|DEALER\s*GST|GSTIN(?:\s*(?:NO|NUMBER|#))?|GST\s*(?:NO|NUMBER|#)?)\s*[:\-]?\s*([0-9]{2}\s*[A-Z]{5}\s*[0-9]{4}\s*[A-Z]\s*[1-9A-Z]\s*Z\s*[0-9A-Z])/i,
  );
  if (labeled?.[1]) {
    const compact = labeled[1].replace(/\s+/g, '');
    if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(compact)) return compact;
  }
  const m = upper.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z1-9]Z[0-9A-Z])\b/);
  if (m?.[1]) return m[1];
  const compactAll = upper.replace(/[^A-Z0-9]/g, '');
  const loose = compactAll.match(/([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/);
  return loose?.[1] || '';
}

export function extractInvoiceDate(text) {
  const labeled =
    matchFirst(
      text,
      /(?:invoice|bill|purchase|sale)\s*date\s*[:\-]?\s*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4})/i,
    ) || matchFirst(text, /\bdate\s*[:\-]?\s*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4})/i);
  return normalizeDate(labeled) || normalizeDate(matchFirst(text, /\b(\d{4}-\d{2}-\d{2})\b/));
}

export function extractTotalAmount(text) {
  const labeled =
    matchFirst(
      text,
      /(?:grand\s*total|amount\s*payable|net\s*(?:payable|amount|total)|invoice\s*total|total\s*amount|ex[\s\-]?showroom\s*price|total\s*₹|₹\s*total)\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+\.?[0-9]*)/i,
    ) ||
    matchFirst(text, /(?:^|\n)\s*Total\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([1-9][0-9,]*(?:\.[0-9]+)?)/im);
  const inv = matchFirst(
    text,
    /(?:invoice|bill)\s*(?:no|number|#)\.?\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
  );
  const invDigits = String(inv || '').replace(/\D/g, '');
  const reject = (n) => {
    if (!Number.isFinite(n) || n <= 0) return true;
    const d = String(Math.round(n));
    if (invDigits && d === invDigits) return true;
    if (/^180[0-9]/.test(d) && d.length <= 12) return true;
    if (/^[6-9]\d{9}$/.test(d)) return true;
    if (n >= 1e7) return true;
    if (d === '2666' || d === '18002666') return true;
    return false;
  };

  if (!labeled) {
    // Only when grand total label missing: taxable + CGST + SGST (real printed tax lines)
    const sub = matchFirst(
      text,
      /(?:sub\s*total|taxable\s*(?:value|amount))\s*[:\-]?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+\.?[0-9]*)/i,
    );
    const cgst = matchFirst(text, /CGST\s*(?:@\s*[0-9.]+%\s*)?[:\-]?\s*(?:Rs\.?|₹)?\s*([0-9,]+\.?[0-9]*)/i);
    const sgst = matchFirst(text, /SGST\s*(?:@\s*[0-9.]+%\s*)?[:\-]?\s*(?:Rs\.?|₹)?\s*([0-9,]+\.?[0-9]*)/i);
    const igst = matchFirst(text, /IGST\s*(?:@\s*[0-9.]+%\s*)?[:\-]?\s*(?:Rs\.?|₹)?\s*([0-9,]+\.?[0-9]*)/i);
    const subN = sub ? Number(String(sub).replace(/,/g, '')) : null;
    if (subN && subN > 0) {
      const tax =
        (cgst ? Number(String(cgst).replace(/,/g, '')) : 0) +
        (sgst ? Number(String(sgst).replace(/,/g, '')) : 0) +
        (igst ? Number(String(igst).replace(/,/g, '')) : 0);
      // Ignore GST % rates mistaken as amounts
      const taxSafe = tax > 28 ? tax : 0;
      const total = Math.round((subN + taxSafe) * 100) / 100;
      return reject(total) ? null : total;
    }
    return null;
  }
  const n = Number(String(labeled).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0 || reject(n)) return null;
  return Math.round(n * 100) / 100;
}

export function extractExpiryDate(text) {
  const labeled = matchFirst(
    text,
    /(?:warranty|insurance|valid)\s*(?:expiry|exp(?:ires)?|till|until|end)?\s*[:\-]?\s*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4})/i,
  );
  return normalizeDate(labeled);
}

export function extractWarrantyMonths(text) {
  const years = matchFirst(text, /warranty\s*(?:of|for|:)?\s*([0-9]+)\s*(?:years?|yrs?)/i);
  if (years) return Number(years) * 12;
  const months = matchFirst(text, /warranty\s*(?:of|for|:)?\s*([0-9]+)\s*(?:months?|mos?)/i);
  if (months) return Number(months);
  return null;
}

/**
 * Duplicate helper: ONLY when seller GSTIN + invoice number both present & match
 * an already-committed fingerprint. (Legacy total+date key kept for old saves.)
 */
export function buildBillFingerprint({ gstin, invoiceNumber, totalAmount, invoiceDate } = {}) {
  const g = String(gstin || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
  const inv = String(invoiceNumber || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
  // Primary key: GSTIN + invoice number (exact)
  if (g && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(g) && inv.length >= 2) {
    return `INV::${g}::${inv}`;
  }
  // Do NOT fingerprint without GSTIN — avoids blocking fresh scans
  return '';
}

export async function isDuplicateBill(parsed) {
  const fingerprint = buildBillFingerprint({
    gstin: parsed?.gstin || parsed?.shopGstin,
    invoiceNumber: parsed?.invoiceNumber || parsed?.invoice_number,
    totalAmount: parsed?.totalAmount,
    invoiceDate: parsed?.invoiceDate || parsed?.purchaseDate,
  });
  if (!fingerprint) return { isDuplicate: false, fingerprint: '' };
  const list = await loadFingerprints();
  return { isDuplicate: list.includes(fingerprint), fingerprint };
}

export async function rememberBillFingerprint(parsedOrFingerprint) {
  const fingerprint =
    typeof parsedOrFingerprint === 'string'
      ? parsedOrFingerprint
      : buildBillFingerprint(parsedOrFingerprint);
  if (!fingerprint) return;
  const list = await loadFingerprints();
  if (list.includes(fingerprint)) return;
  await AsyncStorage.setItem(DUPLICATE_KEY, JSON.stringify([fingerprint, ...list].slice(0, 500)));
}

export async function saveParsedBillDraft(parsed, extras = {}) {
  const payload = {
    ...parsed,
    ...extras,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem('@asset_doctor/last_parsed_bill_v1', JSON.stringify(payload));
  return payload;
}

export async function loadParsedBillDraft() {
  try {
    const raw = await AsyncStorage.getItem('@asset_doctor/last_parsed_bill_v1');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function loadFingerprints() {
  try {
    const raw = await AsyncStorage.getItem(DUPLICATE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function matchFirst(text, re) {
  const m = String(text || '').match(re);
  return m?.[1] ? String(m[1]).trim() : '';
}

function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
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
    year = a;
    month = b;
    day = c;
  } else if (String(m[3]).length === 4) {
    year = c;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      // India default DD-MM-YYYY
      day = a;
      month = b;
    }
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100) return null;
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

function addMonths(isoDate, months) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

export default {
  parseBillData,
  extractGstin,
  extractInvoiceDate,
  extractTotalAmount,
  isDuplicateBill,
  rememberBillFingerprint,
  saveParsedBillDraft,
  loadParsedBillDraft,
};

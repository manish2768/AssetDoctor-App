/**
 * Keyword-first document classification + label-near field heuristics for Indian OCR text.
 * Used before / alongside Gemini so Insurance vs Invoice never flips wrongly.
 */

const DOC = Object.freeze({
  TAX_INVOICE: 'TAX_INVOICE',
  INSURANCE_POLICY: 'INSURANCE_POLICY',
  REGISTRATION_CERTIFICATE: 'REGISTRATION_CERTIFICATE',
  PUC_CERTIFICATE: 'PUC_CERTIFICATE',
  OTHER_RECEIPT: 'OTHER_RECEIPT',
});

const DATE_LIKE =
  /^(?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)$/;

function cleanLine(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .replace(/^[:\-–—|.\s]+|[:\-–—|.\s]+$/g, '')
    .trim();
}

function isJunkName(value) {
  const v = cleanLine(value);
  if (!v || v.length < 3) return true;
  if (DATE_LIKE.test(v)) return true;
  if (/^\d{6,}$/.test(v)) return true;
  if (/^(?:n\/a|na|nil|null|undefined|dummy|test|date|time|page)$/i.test(v)) return true;
  if (/\b(?:am|pm)\b/i.test(v) && /\d/.test(v) && v.length < 16) return true;
  // Labels / legal / contact noise — never a vendor or asset name
  if (
    /^(?:mrp|gstin|tax\s*invoice|invoice|retail\s*invoice|cash\s*memo|complaints?(?:\s+contact)?|customer\s*care|helpline|toll[\s\-]?free|handling\s*fee)\b/i.test(
      v,
    )
  ) {
    return true;
  }
  if (
    /\bgstin\b|\bmrp\s*[:\-]?|\bcomplaints?\s+contact\b|\btax\s*invoice\b|\bhandling\s*fee\b/i.test(
      v,
    )
  ) {
    return true;
  }
  // Footer / watermark / disclaimer OCR noise
  if (
    /original\s+for\s+recipient|computer\s+generated|subject\s+to\s+jurisdiction|disclaimer|watermark|qr\s*code|e-?invoice\s*qr/i.test(
      v,
    )
  ) {
    return true;
  }
  // CamelCase single-token garbage (e.g. "CautavArota")
  if (/^[A-Za-z]{10,}$/.test(v) && /[a-z][A-Z]/.test(v) && !/\s/.test(v)) {
    return true;
  }
  return false;
}

/**
 * Strict keyword classification (Insurance wins over Invoice when both appear).
 */
export function classifyDocumentTypeFromKeywords(rawText = '') {
  const text = String(rawText || '');
  const upper = text.toUpperCase();

  const insuranceHit =
    /\bPOLICY\s*NO\b/.test(upper) ||
    /\bPERIOD\s*OF\s*INSURANCE\b/.test(upper) ||
    /\bCERTIFICATE\s*OF\s*INSURANCE\b/.test(upper) ||
    /\bINSURANCE\s*POLICY\b/.test(upper) ||
    (/\bINSURANCE\b/.test(upper) &&
      (/\bPOLICY\b/.test(upper) || /\bPREMIUM\b/.test(upper) || /\bIDV\b/.test(upper)));

  if (insuranceHit) {
    return {
      document_type: DOC.INSURANCE_POLICY,
      vaultType: 'insurance',
      label: 'Insurance Policy',
      source: 'keyword',
    };
  }

  if (
    /\bREGISTRATION\s*CERTIFICATE\b/.test(upper) ||
    /\bCERTIFICATE\s*OF\s*REGISTRATION\b/.test(upper) ||
    /\bFORM\s*23\b/.test(upper)
  ) {
    return {
      document_type: DOC.REGISTRATION_CERTIFICATE,
      vaultType: 'rc',
      label: 'Registration Certificate',
      source: 'keyword',
    };
  }

  if (/\bPUC\b/.test(upper) || /\bPOLLUTION\s*UNDER\s*CONTROL\b/.test(upper)) {
    return {
      document_type: DOC.PUC_CERTIFICATE,
      vaultType: 'puc',
      label: 'PUC Certificate',
      source: 'keyword',
    };
  }

  const invoiceHit =
    /\bTAX\s*INVOICE\b/.test(upper) ||
    /\bTAXINVOICE\b/.test(upper) ||
    /\bINVOICE\b/.test(upper) ||
    /\bBILL\s*OF\s*SUPPLY\b/.test(upper) ||
    (/\bBILL\b/.test(upper) && /\bGSTIN\b/.test(upper));

  if (invoiceHit) {
    return {
      document_type: DOC.TAX_INVOICE,
      vaultType: 'bill',
      label: 'Tax Invoice',
      source: 'keyword',
    };
  }

  return null;
}

function captureAfterLabel(text, labelRes) {
  for (const re of labelRes) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const value = cleanLine(m[1]);
    if (!isJunkName(value)) return value;
  }
  return '';
}

function toIsoDate(raw) {
  const s = cleanLine(raw);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return '';
  let [, dd, mm, yy] = m;
  if (yy.length === 2) yy = Number(yy) > 50 ? `19${yy}` : `20${yy}`;
  const iso = `${yy.padStart(4, '0')}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return iso;
}

/**
 * Pull common insurance / invoice fields from raw OCR when Gemini leaves blanks.
 */
export function extractFieldsFromOcrText(rawText = '', forcedType = '') {
  const text = String(rawText || '');
  const docType =
    forcedType || classifyDocumentTypeFromKeywords(text)?.document_type || '';

  const vendor_dealer_name = captureAfterLabel(text, [
    /(?:insurer|insurance\s*company|issued\s*by|underwritten\s*by)\s*[:\-]?\s*([A-Za-z0-9 &.,'\-]{3,60})/i,
    /\b((?:ICICI|HDFC|BAJAJ|TATA|RELIANCE|GO\s*DIGIT|ACKO|UNITED\s*INDIA|NEW\s*INDIA|ORIENTAL|NATIONAL|CHOLA|MAGMA|FUTURE\s*GENERALI|SBI|KOTAK)[\w\s&.]*?(?:LOMBARD|GENERAL|INSURANCE|ASSURANCE)?)/i,
    /(?:dealer|sold\s*by|merchant|shop\s*name|from)\s*[:\-]?\s*([A-Za-z0-9 &.,'\-]{3,60})/i,
  ]);

  const owner_buyer_name = captureAfterLabel(text, [
    /(?:insured(?:\s*name)?|name\s*of\s*(?:the\s*)?insured|policy\s*holder|proposer)\s*[:\-]?\s*(?:mr\.?|mrs\.?|ms\.?)?\s*([A-Za-z][A-Za-z .']{2,50})/i,
    /(?:customer(?:\s*name)?|purchaser|buyer(?:\s*name)?|bill\s*to|consignee)\s*[:\-]?\s*(?:mr\.?|mrs\.?|ms\.?)?\s*([A-Za-z][A-Za-z .']{2,50})/i,
    /\b(?:mr\.?|mrs\.?|ms\.?)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\b/,
    /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\s*(?:S\/O|D\/O|W\/O|C\/O)\b/i,
  ]);

  const expiryRaw = captureAfterLabel(text, [
    /(?:period\s*of\s*insurance[^\n]{0,80}?\bto\b|valid\s*(?:till|upto|until)|expiry(?:\s*date)?|policy\s*end(?:\s*date)?|cover(?:age)?\s*to)\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
    /\bto\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  ]);
  const expiry_date = toIsoDate(expiryRaw);

  const invoice_or_policy_no = captureAfterLabel(text, [
    /(?:policy\s*(?:no|number|n[o°]#?)|certificate\s*(?:no|number))\s*[:\-]?\s*([A-Za-z0-9\/\-.]{4,40})/i,
    /(?:invoice\s*(?:no|number|n[o°]#?)|bill\s*(?:no|number)|inv\.?\s*no)\s*[:\-]?\s*([A-Za-z0-9\/\-.]{2,40})/i,
  ]);

  const purchase_or_issue_date = toIsoDate(
    captureAfterLabel(text, [
      /(?:from|issue(?:d)?\s*date|invoice\s*date|policy\s*start|commencement)\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
    ]),
  );

  let vendor = vendor_dealer_name;
  if (!vendor && docType === DOC.INSURANCE_POLICY) {
    const header = text.match(
      /\b((?:ICICI\s*LOMBARD|HDFC\s*ERGO|BAJAJ\s*ALLIANZ|TATA\s*AIG|RELIANCE\s*GENERAL|GO\s*DIGIT|ACKO|SBI\s*GENERAL)[A-Za-z\s&.]*)/i,
    );
    if (header?.[1] && !isJunkName(header[1])) vendor = cleanLine(header[1]);
  }

  const vehicle_registration_number = captureAfterLabel(text, [
    /(?:reg(?:istration)?(?:\s*(?:no|number|n[o°]|#))?|vehicle\s*(?:no|number)|rto\s*(?:no)?)\s*[:\-]?\s*([A-Z]{2}\s*\d{1,2}\s*[A-Z]{0,3}\s*\d{3,4})/i,
  ]) || (text.match(/\b([A-Z]{2}\s*\d{1,2}\s*[A-Z]{1,3}\s*\d{4})\b/i)?.[1] || '');

  const chassis_or_frame_no = captureAfterLabel(text, [
    /(?:chassis|frame|vin)\s*(?:no|number|n[o°]|#)?\s*[:\-]?\s*([A-Z0-9]{8,25})/i,
  ]);

  const engine_number = captureAfterLabel(text, [
    /(?:engine)\s*(?:no|number|n[o°]|#)?\s*[:\-]?\s*([A-Z0-9]{6,25})/i,
  ]);

  return {
    document_type: docType || '',
    vendor_dealer_name: isJunkName(vendor) ? '' : vendor,
    owner_buyer_name: isJunkName(owner_buyer_name) ? '' : owner_buyer_name,
    invoice_or_policy_no: invoice_or_policy_no || '',
    purchase_or_issue_date: purchase_or_issue_date || '',
    expiry_date: expiry_date || '',
    vehicle_registration_number: cleanLine(vehicle_registration_number).replace(/\s+/g, ''),
    chassis_or_frame_no: cleanLine(chassis_or_frame_no),
    engine_number: cleanLine(engine_number),
  };
}

/**
 * Prefer non-empty heuristic / Gemini values; drop date-like junk from vendor.
 */
export function mergeExtractPreferFilled(base = {}, fallback = {}) {
  const out = { ...base };
  const keys = [
    'vendor_dealer_name',
    'owner_buyer_name',
    'invoice_or_policy_no',
    'purchase_or_issue_date',
    'expiry_date',
    'asset_name',
    'chassis_or_frame_no',
    'vehicle_registration_number',
    'engine_number',
  ];
  for (const key of keys) {
    const cur = cleanLine(out[key]);
    const fb = cleanLine(fallback[key]);
    if ((!cur || isJunkName(cur)) && fb && !isJunkName(fb)) {
      out[key] = fb;
    }
  }
  if (isJunkName(out.vendor_dealer_name)) out.vendor_dealer_name = '';
  return out;
}

export function isJunkVendorOrName(value) {
  return isJunkName(value);
}

export default classifyDocumentTypeFromKeywords;

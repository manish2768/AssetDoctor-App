/**
 * Gemini 1.5 Flash — classify document type FIRST, then extract type-specific fields.
 * Prefer EXPO_PUBLIC_GEMINI_API_KEY / GEMINI_API_KEY (client) or Cloud Function proxy.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

import { ENV } from '../../config/env';
import {
  classifyDocumentTypeFromKeywords,
  extractFieldsFromOcrText,
  isJunkVendorOrName,
  mergeExtractPreferFilled,
} from '../ocr/ocrFieldHeuristics';

const MODEL = 'gemini-1.5-flash';

/** Canonical Gemini document classes (advanced classification) */
export const GEMINI_DOC_TYPES = Object.freeze({
  TAX_INVOICE: 'TAX_INVOICE',
  INSURANCE_POLICY: 'INSURANCE_POLICY',
  REGISTRATION_CERTIFICATE: 'REGISTRATION_CERTIFICATE',
  OTHER_RECEIPT: 'OTHER_RECEIPT',
  // Legacy aliases kept for older caches / prompts
  PURCHASE_INVOICE: 'TAX_INVOICE',
  VEHICLE_RC: 'REGISTRATION_CERTIFICATE',
  VEHICLE_INSURANCE: 'INSURANCE_POLICY',
  VEHICLE_PUC: 'OTHER_RECEIPT',
  OTHER: 'OTHER_RECEIPT',
});

/** Stable set used for equality checks after normalize */
export const DOC_CLASS = Object.freeze({
  TAX_INVOICE: 'TAX_INVOICE',
  INSURANCE_POLICY: 'INSURANCE_POLICY',
  REGISTRATION_CERTIFICATE: 'REGISTRATION_CERTIFICATE',
  PUC_CERTIFICATE: 'PUC_CERTIFICATE',
  OTHER_RECEIPT: 'OTHER_RECEIPT',
});

/** Map Gemini class → vault folder type used by DocumentVault / ReviewAsset */
export const GEMINI_TO_VAULT_TYPE = Object.freeze({
  TAX_INVOICE: 'bill',
  INSURANCE_POLICY: 'insurance',
  REGISTRATION_CERTIFICATE: 'rc',
  PUC_CERTIFICATE: 'puc',
  PUC: 'puc',
  OTHER_RECEIPT: 'other',
  PURCHASE_INVOICE: 'bill',
  VEHICLE_RC: 'rc',
  VEHICLE_INSURANCE: 'insurance',
  VEHICLE_PUC: 'puc',
  OTHER: 'other',
});

export const DOC_TYPE_LABELS = Object.freeze({
  TAX_INVOICE: 'Tax Invoice',
  INSURANCE_POLICY: 'Insurance Policy',
  REGISTRATION_CERTIFICATE: 'Registration Certificate',
  PUC_CERTIFICATE: 'PUC Certificate',
  PUC: 'PUC Certificate',
  OTHER_RECEIPT: 'Other Receipt',
});

const SYSTEM_PROMPT = `You are a strict Invoice OCR parser for Indian documents (Asset Doctor).

STEP 1 — CLASSIFY the document BEFORE extracting fields.
document_type MUST be exactly one of:
["TAX_INVOICE", "SALES_INVOICE", "SERVICE_INVOICE", "INSURANCE_POLICY", "REGISTRATION_CERTIFICATE", "PUC", "OTHER_RECEIPT"]

STRICT KEYWORD PRIORITY (apply in this order):
1) POLICY / INSURANCE / "POLICY NO" / "PERIOD OF INSURANCE" → INSURANCE_POLICY.
2) Job card / workshop / labour / odometer service → SERVICE_INVOICE.
3) "TAX INVOICE" / SALES INVOICE / BILL (with GSTIN) → TAX_INVOICE or SALES_INVOICE.
4) Registration Certificate / Form 23 / RC book → REGISTRATION_CERTIFICATE.
5) PUC / Pollution Under Control → PUC.
6) Else OTHER_RECEIPT.

STEP 2 — Return ONLY valid JSON (no markdown) with these keys:
{
  "document_type": "TAX_INVOICE",
  "product_name": "Nothing Phone (2a)",
  "item_name": "Nothing Phone (2a)",
  "asset_name": "Nothing Phone (2a)",
  "total_amount": 24999,
  "seller_name": "Retail Store Pvt Ltd",
  "vendor_name": "Retail Store Pvt Ltd",
  "vendor_dealer_name": "Retail Store Pvt Ltd",
  "buyer_name": "Rahul Sharma",
  "owner_buyer_name": "Rahul Sharma",
  "invoice_number": "INV-1001",
  "invoice_or_policy_no": "INV-1001",
  "purchase_date": "YYYY-MM-DD",
  "purchase_or_issue_date": "YYYY-MM-DD",
  "category": "Gadget",
  "serial_number": "",
  "chassis_or_frame_no": "",
  "vehicle_registration_number": "",
  "engine_number": "",
  "expiry_date": ""
}

PRODUCT NAME RULES (critical):
- product_name / item_name / asset_name MUST be the sold product or primary line-item description
  (phone model, TVS Ronin, fridge model, etc.).
- NEVER put city, state, pincode, street, "Bill To" address blocks, or shop address into product_name.
- If the product title is unclear, copy the highest-value line-item description from the item table.
- NEVER default to the word "Product". If truly missing, return "".
- NEVER put IMEI, serial, GSTIN, CGST/SGST amounts, or invoice numbers into product_name.
- serial_number is a SEPARATE field (IMEI/serial/chassis) — keep it out of product_name.

AMOUNT / PARTIES:
- total_amount = Net Total / Grand Total / Amount Payable ONLY (ignore tax sub-totals).
- seller_name / vendor_* = shop / dealer header (not footer disclaimers).
- buyer_name = Bill To / Customer / Purchaser / Insured name only (real printed name).
- invoice_number = Invoice No / Bill No / Policy No as applicable.
- purchase_date = YYYY-MM-DD only.

General:
- Missing fields → "" for strings, null for numbers. Never invent.
- Never map CGST/SGST/GSTIN into serial_number / IMEI / chassis.
- Always include document_type.
- If HINTS.expectedDocumentType is set, KEEP it unless OCR clearly contradicts it.`;

function apiKey() {
  return String(
    process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ENV.geminiApiKey || '',
  ).trim();
}

function safeJsonParse(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini returned non-JSON');
  return JSON.parse(body.slice(start, end + 1));
}

export function normalizeDocumentType(raw) {
  const t = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (t === 'TAX_INVOICE' || t === 'PURCHASE_INVOICE' || t === 'INVOICE' || t === 'BILL') {
    return DOC_CLASS.TAX_INVOICE;
  }
  if (
    t === 'INSURANCE_POLICY' ||
    t === 'VEHICLE_INSURANCE' ||
    t === 'INSURANCE' ||
    /INSURANCE|POLICY/.test(t)
  ) {
    return DOC_CLASS.INSURANCE_POLICY;
  }
  if (
    t === 'REGISTRATION_CERTIFICATE' ||
    t === 'VEHICLE_RC' ||
    t === 'RC' ||
    /REGISTRATION_CERT/.test(t)
  ) {
    return DOC_CLASS.REGISTRATION_CERTIFICATE;
  }
  if (t === 'PUC_CERTIFICATE' || t === 'VEHICLE_PUC' || t === 'PUC' || /PUC|POLLUTION/.test(t)) {
    return DOC_CLASS.PUC_CERTIFICATE;
  }
  if (t === 'OTHER_RECEIPT' || t === 'OTHER') return DOC_CLASS.OTHER_RECEIPT;
  return DOC_CLASS.OTHER_RECEIPT;
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value) {
  return String(value || '').trim();
}

function pickCategory(raw, documentType) {
  const c = str(raw);
  if (['Vehicle', 'Gadget', 'Home', 'Insurance'].includes(c)) return c;
  if (documentType === DOC_CLASS.INSURANCE_POLICY) return 'Insurance';
  if (documentType === DOC_CLASS.REGISTRATION_CERTIFICATE) return 'Vehicle';
  return 'Vehicle';
}

/**
 * Enforce type-specific nulling so RC/Insurance never look like purchase bills.
 */
export function applyDocumentTypeGuards(payload) {
  const documentType = normalizeDocumentType(
    payload.document_type || payload.documentType,
  );
  const vaultType = GEMINI_TO_VAULT_TYPE[documentType] || 'other';
  const next = {
    ...payload,
    document_type: documentType,
    documentType,
    vaultType,
  };

  if (documentType === DOC_CLASS.REGISTRATION_CERTIFICATE) {
    next.category = 'Vehicle';
    next.total_amount = null;
    next.purchaseAmount = null;
    next.totalAmount = null;
  }

  if (documentType === DOC_CLASS.INSURANCE_POLICY) {
    next.category = next.category === 'Insurance' ? 'Insurance' : 'Insurance';
    // Premium is optional — never invent a purchase price
    if (next.total_amount != null && Number(next.total_amount) <= 0) {
      next.total_amount = null;
    }
    next.purchaseAmount = next.total_amount;
    if (!next.expiry_date && next.expiryDate) next.expiry_date = next.expiryDate;
    if (!next.insuranceExpiry && next.expiry_date) next.insuranceExpiry = next.expiry_date;
  }

  if (documentType === DOC_CLASS.PUC_CERTIFICATE) {
    next.category = 'Vehicle';
    next.total_amount = null;
    next.purchaseAmount = null;
    next.totalAmount = null;
    if (!next.expiry_date && next.expiryDate) next.expiry_date = next.expiryDate;
    if (!next.pucExpiry && next.expiry_date) next.pucExpiry = next.expiry_date;
  }

  if (documentType === DOC_CLASS.TAX_INVOICE) {
    next.purchaseAmount = next.total_amount ?? next.purchaseAmount ?? null;
  }

  return next;
}

/**
 * Normalize Gemini JSON (snake_case schema + legacy camelCase) into a stable payload.
 */
export function normalizeGeminiPayload(data = {}) {
  const documentType = normalizeDocumentType(data.document_type || data.documentType);
  let assetName = str(
    data.product_name ||
      data.productName ||
      data.asset_name ||
      data.item_name ||
      data.assetName ||
      data.itemName ||
      [data.brand, data.model].filter(Boolean).join(' '),
  );
  if (isJunkAssetName(assetName)) assetName = '';

  const vendorRaw = str(
    data.seller_name ||
      data.sellerName ||
      data.vendor_dealer_name ||
      data.vendor_name ||
      data.vendorName ||
      data.vendor ||
      data.vendorDealerName ||
      data.shopName ||
      data.dealerName,
  );
  const vendor = isJunkVendorOrName(vendorRaw) ? '' : vendorRaw;

  let owner = str(
    data.buyer_name ||
      data.owner_buyer_name ||
      data.ownerBuyerName ||
      data.ownerName ||
      data.customerName ||
      data.buyerName,
  );
  if (isJunkVendorOrName(owner)) owner = '';

  const invoiceOrPolicy = str(
    data.invoice_number ||
      data.invoice_or_policy_no ||
      data.invoiceOrPolicyNo ||
      data.invoiceNumber ||
      data.policyNumber ||
      data.certificateNumber,
  );
  const purchaseOrIssue = str(
    data.purchase_date ||
      data.purchase_or_issue_date ||
      data.purchaseOrIssueDate ||
      data.invoiceDate ||
      data.issueDate ||
      data.registrationDate,
  );
  let totalAmount = numOrNull(
    data.total_amount ?? data.totalAmount ?? data.purchaseAmount,
  );
  // Guard: invoice number must never become purchase total
  if (
    totalAmount != null &&
    invoiceOrPolicy &&
    String(Math.round(Number(totalAmount))) === String(invoiceOrPolicy).replace(/\D/g, '')
  ) {
    totalAmount = null;
  }
  const chassis = str(
    data.chassis_or_frame_no || data.chassisOrFrameNo || data.chassisNumber || data.frameNumber,
  );
  const serialNumber = str(
    data.serial_number || data.serialNumber || data.imei || '',
  );
  // Keep IMEI/serial out of product title
  if (
    assetName &&
    serialNumber &&
    assetName.replace(/\D/g, '') === serialNumber.replace(/\D/g, '') &&
    serialNumber.replace(/\D/g, '').length >= 10
  ) {
    assetName = '';
  }
  const expiry = str(
    data.expiry_date || data.expiryDate || data.insuranceExpiry || data.fitnessExpiryDate,
  );
  const registration = str(
    data.vehicle_registration_number ||
      data.vehicleRegistrationNumber ||
      data.registration_number ||
      data.registrationNumber ||
      data.registration,
  );
  const category = pickCategory(data.category, documentType);

  const base = {
    document_type: documentType,
    documentType,
    vaultType: GEMINI_TO_VAULT_TYPE[documentType] || 'other',
    documentLabel: DOC_TYPE_LABELS[documentType] || 'Document',
    asset_name: assetName,
    item_name: assetName,
    assetName,
    brand: str(data.brand) || (assetName ? assetName.split(/\s+/)[0] : '') || '',
    model: str(data.model) || assetName,
    category,
    vendor_dealer_name: vendor,
    vendor,
    vendorDealerName: vendor,
    shopName: vendor,
    owner_buyer_name: owner,
    buyer_name: owner,
    ownerBuyerName: owner,
    ownerName: owner,
    customerName: owner,
    invoice_or_policy_no: invoiceOrPolicy,
    invoice_number: invoiceOrPolicy,
    invoiceOrPolicyNo: invoiceOrPolicy,
    invoiceNumber: invoiceOrPolicy,
    policyNumber:
      documentType === DOC_CLASS.INSURANCE_POLICY ? invoiceOrPolicy : str(data.policyNumber),
    purchase_or_issue_date: purchaseOrIssue,
    purchase_date: purchaseOrIssue,
    purchaseOrIssueDate: purchaseOrIssue,
    invoiceDate: purchaseOrIssue,
    issueDate: purchaseOrIssue,
    total_amount: totalAmount,
    totalAmount,
    purchaseAmount: totalAmount,
    chassis_or_frame_no: chassis,
    chassisOrFrameNo: chassis,
    chassisNumber: chassis,
    engine_number: str(data.engine_number || data.engineNumber),
    engineNumber: str(data.engine_number || data.engineNumber),
    registration_number: registration,
    registrationNumber: registration,
    vehicle_registration_number: registration,
    registration,
    expiry_date: expiry,
    expiryDate: expiry,
    insuranceExpiry:
      documentType === DOC_CLASS.INSURANCE_POLICY ? expiry : str(data.insuranceExpiry),
    pucExpiry:
      documentType === DOC_CLASS.PUC_CERTIFICATE
        ? expiry || str(data.pucExpiry)
        : str(data.pucExpiry),
    fitnessExpiryDate:
      documentType === DOC_CLASS.REGISTRATION_CERTIFICATE
        ? expiry
        : str(data.fitnessExpiryDate),
    calculatedExpiryDate: expiry,
    reminderText: str(data.reminderText || data.whatsappReminderText),
    whatsappReminderText: str(data.reminderText || data.whatsappReminderText),
    serialNumber: str(data.serialNumber),
    certificateNumber: str(data.certificateNumber),
    subCategory: str(data.subCategory),
    starRating: numOrNull(data.starRating),
    estimatedMonthlyUnits: numOrNull(data.estimatedMonthlyUnits),
    estimatedMonthlyBillCost: numOrNull(data.estimatedMonthlyBillCost),
    warrantyMonths: numOrNull(data.warrantyMonths),
  };

  return applyDocumentTypeGuards(base);
}

/** Reject watermark / footer OCR junk that is not a real product name. */
function isJunkAssetName(value) {
  const v = str(value);
  if (!v) return true;
  if (isJunkVendorOrName(v)) return true;
  if (/original\s+for\s+recipient|computer\s+generated|subject\s+to|disclaimer|watermark|qr\s*code/i.test(v)) {
    return true;
  }
  // Odd camel-case OCR garbage like "CautavArota" / single nonsense tokens
  if (/^[A-Za-z]{10,}$/.test(v) && /[a-z][A-Z]/.test(v) && !/\s/.test(v)) {
    return true;
  }
  if (/^(?:page|copy|duplicate|triplicate|e-?invoice|ack\.?|irn)$/i.test(v)) return true;
  return false;
}

/**
 * Extract structured asset fields from raw OCR text (and optional hints).
 * Always classifies document_type first.
 */
export async function extractAssetWithGemini(rawText, hints = {}) {
  const key = apiKey();
  if (!key) {
    return { success: false, error: 'GEMINI_API_KEY not configured', data: null };
  }
  if (!String(rawText || '').trim()) {
    return { success: false, error: 'No OCR text to enhance', data: null };
  }

  const keywordClass = classifyDocumentTypeFromKeywords(rawText);
  const forcedType =
    hints.expectedDocumentType ||
    keywordClass?.document_type ||
    '';
  const heuristicFields = extractFieldsFromOcrText(rawText, forcedType);

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { temperature: 0.1, maxOutputTokens: 1400 },
    });

    const prompt = `${SYSTEM_PROMPT}

OCR TEXT:
"""
${String(rawText).slice(0, 12000)}
"""

HINTS:
barcode=${hints.barcode || ''}
serialHint=${hints.serialHint || ''}
expectedDocumentType=${forcedType || ''}
keywordClassification=${keywordClass?.document_type || ''}

Remember:
- If POLICY / INSURANCE / PERIOD OF INSURANCE appear → INSURANCE_POLICY.
- asset_name / item_name = product table only (e.g. TVS RONIN) — NEVER footer/watermark junk.
- total_amount = Net Total / Grand Total ONLY (e.g. 135500) — NEVER tax sub-totals or invoice nos.
- vendor = dealership header; buyer_name from Customer/Buyer/S/W/D; invoice_number from Invoice No.
- purchase_date = YYYY-MM-DD. Missing fields → "" or null (never invent).
`;

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || '';
    let parsed = normalizeGeminiPayload(safeJsonParse(text));

    // Keyword classification wins when present
    if (keywordClass?.document_type) {
      parsed = normalizeGeminiPayload({
        ...parsed,
        document_type: keywordClass.document_type,
      });
    } else if (forcedType) {
      parsed = normalizeGeminiPayload({
        ...parsed,
        document_type: forcedType,
      });
    }

    const merged = mergeExtractPreferFilled(
      {
        vendor_dealer_name: parsed.vendor_dealer_name,
        owner_buyer_name: parsed.owner_buyer_name,
        invoice_or_policy_no: parsed.invoice_or_policy_no,
        purchase_or_issue_date: parsed.purchase_or_issue_date,
        expiry_date: parsed.expiry_date,
        asset_name: parsed.asset_name,
        chassis_or_frame_no: parsed.chassis_or_frame_no,
        vehicle_registration_number: parsed.vehicle_registration_number,
      },
      heuristicFields,
    );

    parsed = normalizeGeminiPayload({
      ...parsed,
      ...merged,
      document_type: parsed.document_type,
    });

    return {
      success: true,
      data: parsed,
      raw: text,
      model: MODEL,
      keywordClass,
      heuristicFields,
    };
  } catch (error) {
    // Soft fallback: still return heuristic extract so Review is not empty
    if (keywordClass || heuristicFields.owner_buyer_name || heuristicFields.vendor_dealer_name) {
      const fallback = normalizeGeminiPayload({
        document_type: forcedType || keywordClass?.document_type || DOC_CLASS.OTHER_RECEIPT,
        ...heuristicFields,
        asset_name: heuristicFields.asset_name || '',
        category:
          forcedType === DOC_CLASS.INSURANCE_POLICY ||
          keywordClass?.document_type === DOC_CLASS.INSURANCE_POLICY
            ? 'Insurance'
            : 'Vehicle',
      });
      return {
        success: true,
        data: fallback,
        raw: '',
        model: 'heuristic-fallback',
        error: error?.message || 'Gemini extraction failed',
        keywordClass,
        heuristicFields,
      };
    }
    return {
      success: false,
      error: error?.message || 'Gemini extraction failed',
      data: null,
    };
  }
}

/**
 * AI Claim Assistant chat turn.
 */
export async function claimAssistantReply({ asset, userMessage, history = [] }) {
  const key = apiKey();
  if (!key) {
    return {
      success: false,
      error: 'GEMINI_API_KEY not configured',
      reply:
        'Claim assistant is offline. Call the brand helpline from Asset Passport and keep your invoice handy.',
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
    });

    const context = {
      assetName: asset?.assetName,
      brand: asset?.brandName,
      category: asset?.categoryLabel || asset?.category,
      purchaseDate: asset?.purchaseDate,
      warrantyExpiry: asset?.warrantyExpiry,
      serialNumber: asset?.serialNumber,
      supportPhone: asset?.supportPhone,
      invoiceTotal: asset?.value,
    };

    const transcript = (history || [])
      .slice(-6)
      .map((m) => `${m.role}: ${m.text}`)
      .join('\n');

    const prompt = `You are Asset Doctor's warranty claim coach for Indian consumers.
Give concise, actionable steps: coverage check, documents to quote (invoice date/amount/serial), official toll-free if known, and claim sequence.
Never invent a phone number — if unknown, say to check the brand directory / invoice.
Asset JSON: ${JSON.stringify(context)}
Chat so far:
${transcript}
User: ${userMessage}
Reply in plain text under 180 words.`;

    const result = await model.generateContent(prompt);
    const reply = String(result?.response?.text?.() || '').trim();
    return { success: true, reply: reply || 'Please share more details about the fault.' };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Claim assistant failed',
      reply: 'Could not reach AI coach. Try again or call brand support.',
    };
  }
}

export const GeminiService = {
  extractAssetWithGemini,
  claimAssistantReply,
  normalizeGeminiPayload,
  applyDocumentTypeGuards,
  normalizeDocumentType,
  GEMINI_DOC_TYPES,
  DOC_CLASS,
  GEMINI_TO_VAULT_TYPE,
  DOC_TYPE_LABELS,
  MODEL,
};

export default GeminiService;

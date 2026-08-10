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
  OTHER_RECEIPT: 'Other Receipt',
});

const SYSTEM_PROMPT = `You are Asset Doctor's document intelligence for Indian papers.

STEP 1 — CLASSIFY the document BEFORE extracting fields.
document_type MUST be exactly one of:
["TAX_INVOICE", "INSURANCE_POLICY", "REGISTRATION_CERTIFICATE", "PUC_CERTIFICATE", "OTHER_RECEIPT"]

STRICT KEYWORD PRIORITY (apply in this order):
1) If OCR contains POLICY / INSURANCE / "POLICY NO" / "PERIOD OF INSURANCE" / "CERTIFICATE OF INSURANCE" → document_type = INSURANCE_POLICY (even if the word Invoice also appears).
2) Else if OCR contains "TAX INVOICE" / INVOICE / BILL (with GSTIN) → document_type = TAX_INVOICE.
3) Else if Registration Certificate / Form 23 / RC book → REGISTRATION_CERTIFICATE.
4) Else if PUC / Pollution Under Control → PUC_CERTIFICATE.
5) Else OTHER_RECEIPT.

STEP 2 — EXTRACT fields. Return ONLY valid JSON (no markdown):
{
  "document_type": "TAX_INVOICE" | "INSURANCE_POLICY" | "REGISTRATION_CERTIFICATE" | "PUC_CERTIFICATE" | "OTHER_RECEIPT",
  "asset_name": string,
  "category": "Vehicle" | "Gadget" | "Home" | "Insurance",
  "vendor_dealer_name": string,
  "owner_buyer_name": string,
  "invoice_or_policy_no": string,
  "purchase_or_issue_date": "YYYY-MM-DD" | "",
  "total_amount": number | null,
  "chassis_or_frame_no": string,
  "vehicle_registration_number": string,
  "expiry_date": "YYYY-MM-DD" | "",
  "engine_number": string,
  "registration_number": string
}

FIELD EXTRACTION (label-near matching — do not leave blank when digits/text exist after labels):

a) vendor_dealer_name:
   - Look for Company Header, Insurer, Authorized Signatory / Issuer Name.
   - Examples: "ICICI LOMBARD", "RAFTAAR MOTO LEGENDS PVT LTD".
   - NEVER put timestamps, clock times, or calendar dates into vendor_dealer_name.

b) owner_buyer_name:
   - Search near: "Insured Name", "Name of the Insured", "Mr.", "Mrs.", "Customer Name", "Purchaser", "Buyer", "S/O", "W/O", "D/O".
   - Example: "NIKLESH KUMAR".

c) expiry_date:
   - Look for: "To:", "Expiry Date", "Policy End Date", "Valid Till", "Period of Insurance ... To".
   - Always output YYYY-MM-DD when a date is found.

d) invoice_or_policy_no:
   - Extract exact "Policy No" / "Policy Number" OR "Invoice No" / "Bill No".
   - If digits (or alphanumeric) appear after these labels, you MUST fill this field — never leave blank.

STRICT RULES BY document_type:

IF TAX_INVOICE:
- asset_name = product / vehicle model (e.g. "TVS RONIN 1CH BASE LIGHTNING").
- vendor_dealer_name = shop / dealer.
- owner_buyer_name = buyer / customer if printed.
- invoice_or_policy_no = exact invoice number.
- purchase_or_issue_date = invoice date YYYY-MM-DD.
- total_amount = Grand Total / Net Amount Payable.
- category = Vehicle | Gadget | Home.

IF INSURANCE_POLICY:
- category = "Insurance".
- vendor_dealer_name = insurer (e.g. "ICICI LOMBARD") — NOT a date/time.
- owner_buyer_name = insured / policy holder (e.g. "NIKLESH KUMAR").
- invoice_or_policy_no = Policy No / Certificate No (REQUIRED when "Policy No" appears).
- purchase_or_issue_date = policy start / From date.
- expiry_date = policy end / To / Valid Till (REQUIRED when printed).
- total_amount = premium ONLY if clearly labelled; else null.
- asset_name = insured vehicle / product if printed; else insurer + " Policy".

IF REGISTRATION_CERTIFICATE:
- category = "Vehicle"; total_amount MUST be null.
- owner_buyer_name = registered owner; registration_number + chassis_or_frame_no when printed.

IF PUC_CERTIFICATE:
- category = "Vehicle"; total_amount MUST be null; expiry_date = PUC validity end.

IF OTHER_RECEIPT:
- Fill only confident fields.

General:
- Never invent missing values; use "" or null.
- Dates must be YYYY-MM-DD or "".
- Always include document_type.
- If HINTS.expectedDocumentType is set, KEEP that document_type unless OCR clearly contradicts it.`;

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
  if (t === 'PUC_CERTIFICATE' || t === 'VEHICLE_PUC' || /PUC|POLLUTION/.test(t)) {
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
  const assetName = str(
    data.asset_name ||
      data.assetName ||
      [data.brand, data.model].filter(Boolean).join(' '),
  );
  const vendorRaw = str(
    data.vendor_dealer_name || data.vendorDealerName || data.shopName || data.dealerName,
  );
  const vendor = isJunkVendorOrName(vendorRaw) ? '' : vendorRaw;
  const owner = str(
    data.owner_buyer_name || data.ownerBuyerName || data.ownerName || data.customerName,
  );
  const invoiceOrPolicy = str(
    data.invoice_or_policy_no ||
      data.invoiceOrPolicyNo ||
      data.invoiceNumber ||
      data.policyNumber ||
      data.certificateNumber,
  );
  const purchaseOrIssue = str(
    data.purchase_or_issue_date ||
      data.purchaseOrIssueDate ||
      data.invoiceDate ||
      data.issueDate ||
      data.registrationDate,
  );
  const totalAmount = numOrNull(
    data.total_amount ?? data.totalAmount ?? data.purchaseAmount,
  );
  const chassis = str(
    data.chassis_or_frame_no || data.chassisOrFrameNo || data.chassisNumber || data.frameNumber,
  );
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
    assetName,
    brand: str(data.brand) || assetName.split(/\s+/)[0] || '',
    model: str(data.model) || assetName,
    category,
    vendor_dealer_name: vendor,
    vendorDealerName: vendor,
    shopName: vendor,
    owner_buyer_name: owner,
    ownerBuyerName: owner,
    ownerName: owner,
    customerName: owner,
    invoice_or_policy_no: invoiceOrPolicy,
    invoiceOrPolicyNo: invoiceOrPolicy,
    invoiceNumber: invoiceOrPolicy,
    policyNumber:
      documentType === DOC_CLASS.INSURANCE_POLICY ? invoiceOrPolicy : str(data.policyNumber),
    purchase_or_issue_date: purchaseOrIssue,
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
- Fill vendor_dealer_name, owner_buyer_name, invoice_or_policy_no, expiry_date from labels.
- Never put dates/times into vendor_dealer_name.
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

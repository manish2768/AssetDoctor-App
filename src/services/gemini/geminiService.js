/**
 * Gemini 1.5 Flash — classify document type FIRST, then extract type-specific fields.
 * Prefer EXPO_PUBLIC_GEMINI_API_KEY / GEMINI_API_KEY (client) or Cloud Function proxy.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

import { ENV } from '../../config/env';

const MODEL = 'gemini-1.5-flash';

/** Canonical Gemini document classes */
export const GEMINI_DOC_TYPES = Object.freeze({
  PURCHASE_INVOICE: 'PURCHASE_INVOICE',
  VEHICLE_RC: 'VEHICLE_RC',
  VEHICLE_INSURANCE: 'VEHICLE_INSURANCE',
  VEHICLE_PUC: 'VEHICLE_PUC',
  OTHER: 'OTHER',
});

/** Map Gemini class → vault folder type used by DocumentVault / ReviewAsset */
export const GEMINI_TO_VAULT_TYPE = Object.freeze({
  PURCHASE_INVOICE: 'bill',
  VEHICLE_RC: 'rc',
  VEHICLE_INSURANCE: 'insurance',
  VEHICLE_PUC: 'puc',
  OTHER: 'other',
});

const SYSTEM_PROMPT = `You are Asset Doctor's document intelligence for Indian papers (invoices, RC, PUC, insurance).

STEP 1 — CLASSIFY the document BEFORE extracting fields.
documentType MUST be exactly one of:
["PURCHASE_INVOICE", "VEHICLE_RC", "VEHICLE_INSURANCE", "VEHICLE_PUC", "OTHER"]

Classification cues:
- VEHICLE_RC: "Registration Certificate", Form 23, RC book, owner name + regn no + chassis/engine, RTO, vehicle class, fitness.
- VEHICLE_PUC: Pollution Under Control, PUC certificate, emission test, PUC validity.
- VEHICLE_INSURANCE: motor insurance policy, IDV, premium, insurer, period of insurance, certificate of insurance, OD/TP.
- PURCHASE_INVOICE: tax invoice, GSTIN, bill of supply, dealer invoice, purchase amount, taxable value — NOT an RC/PUC/policy.
- OTHER: anything else.

STEP 2 — EXTRACT only fields allowed for that documentType.
Return ONLY valid JSON (no markdown) with this shape:
{
  "documentType": "PURCHASE_INVOICE" | "VEHICLE_RC" | "VEHICLE_INSURANCE" | "VEHICLE_PUC" | "OTHER",
  "brand": string,
  "model": string,
  "ownerName": string,
  "registrationNumber": string,
  "registration": string,
  "chassisNumber": string,
  "engineNumber": string,
  "vehicleClass": string,
  "registrationDate": "YYYY-MM-DD" | "",
  "fitnessExpiryDate": "YYYY-MM-DD" | "",
  "invoiceDate": "YYYY-MM-DD" | "",
  "purchaseAmount": number | null,
  "category": "Appliance" | "Vehicle" | "Gadget",
  "subCategory": string,
  "starRating": number | null,
  "calculatedExpiryDate": "YYYY-MM-DD" | "",
  "estimatedMonthlyUnits": number | null,
  "estimatedMonthlyBillCost": number | null,
  "whatsappReminderText": string,
  "reminderText": string,
  "serialNumber": string,
  "policyNumber": string,
  "certificateNumber": string,
  "issueDate": "YYYY-MM-DD" | "",
  "expiryDate": "YYYY-MM-DD" | "",
  "pucExpiry": "YYYY-MM-DD" | "",
  "insuranceExpiry": "YYYY-MM-DD" | "",
  "warrantyMonths": number | null
}

STRICT RULES BY documentType:

IF VEHICLE_RC:
- Extract: ownerName, registrationNumber (Indian plate e.g. UP 32 XX 1234), chassisNumber, engineNumber, vehicleClass, registrationDate, fitnessExpiryDate, brand, model.
- Set category = "Vehicle".
- DO NOT invent purchaseAmount, warranty, appliance energy fields — leave purchaseAmount null and starRating/estimatedMonthly* null.
- registration must equal registrationNumber (spaces allowed).
- calculatedExpiryDate may be fitnessExpiryDate if present.

IF PURCHASE_INVOICE:
- Extract: brand, model, purchaseAmount, invoiceDate, warranty via calculatedExpiryDate / warrantyMonths.
- category = Appliance | Vehicle | Gadget as appropriate.
- For AC/fridge/washer/geyser estimate monthly kWh + ₹ at ₹7.5/unit.
- DO NOT treat RC/PUC/insurance wording as a bill.

IF VEHICLE_INSURANCE:
- Extract: policyNumber (or certificateNumber), issueDate, expiryDate → also set insuranceExpiry = expiryDate.
- category = "Vehicle".
- purchaseAmount must be null (premium is NOT purchase amount).
- brand/model/registration only if clearly printed.

IF VEHICLE_PUC:
- Extract: certificateNumber, issueDate, expiryDate → also set pucExpiry = expiryDate.
- category = "Vehicle".
- purchaseAmount must be null.

IF OTHER:
- Fill only confident fields; leave the rest empty/null.

General:
- Never invent missing values; use "" or null.
- Strip raw chassis/numeric IDs from model (e.g. "TVS Ronin" not "TVS RONIN 2225").
- reminderText: short push/email-ready reminder with asset/doc + relevant expiry.
- Always include documentType.`;

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

function normalizeDocumentType(raw) {
  const t = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (Object.prototype.hasOwnProperty.call(GEMINI_DOC_TYPES, t)) return t;
  if (/^RC$|REGISTRATION_CERT/.test(t)) return GEMINI_DOC_TYPES.VEHICLE_RC;
  if (/INSURANCE|POLICY/.test(t)) return GEMINI_DOC_TYPES.VEHICLE_INSURANCE;
  if (/PUC|POLLUTION/.test(t)) return GEMINI_DOC_TYPES.VEHICLE_PUC;
  if (/INVOICE|BILL|PURCHASE/.test(t)) return GEMINI_DOC_TYPES.PURCHASE_INVOICE;
  return GEMINI_DOC_TYPES.OTHER;
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value) {
  return String(value || '').trim();
}

/**
 * Enforce type-specific nulling so RC/PUC/Insurance never look like purchase bills.
 */
export function applyDocumentTypeGuards(payload) {
  const documentType = normalizeDocumentType(payload.documentType);
  const vaultType = GEMINI_TO_VAULT_TYPE[documentType] || 'other';
  const next = { ...payload, documentType, vaultType };

  if (documentType === GEMINI_DOC_TYPES.VEHICLE_RC) {
    next.category = 'Vehicle';
    next.purchaseAmount = null;
    next.starRating = null;
    next.estimatedMonthlyUnits = null;
    next.estimatedMonthlyBillCost = null;
    next.warrantyMonths = null;
    next.pucExpiry = '';
    next.insuranceExpiry = '';
    if (!next.registration && next.registrationNumber) {
      next.registration = next.registrationNumber;
    }
    if (!next.registrationNumber && next.registration) {
      next.registrationNumber = next.registration;
    }
    if (!next.calculatedExpiryDate && next.fitnessExpiryDate) {
      next.calculatedExpiryDate = next.fitnessExpiryDate;
    }
  }

  if (documentType === GEMINI_DOC_TYPES.VEHICLE_INSURANCE) {
    next.category = 'Vehicle';
    next.purchaseAmount = null;
    next.starRating = null;
    next.estimatedMonthlyUnits = null;
    next.estimatedMonthlyBillCost = null;
    next.warrantyMonths = null;
    if (!next.insuranceExpiry && next.expiryDate) next.insuranceExpiry = next.expiryDate;
    if (!next.calculatedExpiryDate && next.insuranceExpiry) {
      next.calculatedExpiryDate = next.insuranceExpiry;
    }
  }

  if (documentType === GEMINI_DOC_TYPES.VEHICLE_PUC) {
    next.category = 'Vehicle';
    next.purchaseAmount = null;
    next.starRating = null;
    next.estimatedMonthlyUnits = null;
    next.estimatedMonthlyBillCost = null;
    next.warrantyMonths = null;
    if (!next.pucExpiry && next.expiryDate) next.pucExpiry = next.expiryDate;
    if (!next.calculatedExpiryDate && next.pucExpiry) {
      next.calculatedExpiryDate = next.pucExpiry;
    }
  }

  if (documentType === GEMINI_DOC_TYPES.PURCHASE_INVOICE) {
    // Keep energy/warranty fields; clear RC-only fitness unless useful as warranty
    if (!next.calculatedExpiryDate && next.fitnessExpiryDate) {
      next.fitnessExpiryDate = next.fitnessExpiryDate;
    }
  }

  return next;
}

export function normalizeGeminiPayload(data = {}) {
  const documentType = normalizeDocumentType(data.documentType);
  let category = ['Appliance', 'Vehicle', 'Gadget'].includes(data.category)
    ? data.category
    : documentType.startsWith('VEHICLE_')
      ? 'Vehicle'
      : 'Appliance';

  const registration = str(data.registrationNumber || data.registration);
  const base = {
    documentType,
    vaultType: GEMINI_TO_VAULT_TYPE[documentType] || 'other',
    brand: str(data.brand),
    model: str(data.model),
    ownerName: str(data.ownerName),
    registrationNumber: registration,
    registration,
    chassisNumber: str(data.chassisNumber),
    engineNumber: str(data.engineNumber),
    vehicleClass: str(data.vehicleClass),
    registrationDate: str(data.registrationDate),
    fitnessExpiryDate: str(data.fitnessExpiryDate),
    invoiceDate: str(data.invoiceDate),
    purchaseAmount: numOrNull(data.purchaseAmount),
    category,
    subCategory: str(data.subCategory),
    starRating: numOrNull(data.starRating),
    calculatedExpiryDate: str(data.calculatedExpiryDate),
    estimatedMonthlyUnits: numOrNull(data.estimatedMonthlyUnits),
    estimatedMonthlyBillCost: numOrNull(data.estimatedMonthlyBillCost),
    reminderText: str(data.reminderText || data.whatsappReminderText),
    whatsappReminderText: str(data.reminderText || data.whatsappReminderText),
    serialNumber: str(data.serialNumber),
    policyNumber: str(data.policyNumber),
    certificateNumber: str(data.certificateNumber),
    issueDate: str(data.issueDate),
    expiryDate: str(data.expiryDate),
    pucExpiry: str(data.pucExpiry),
    insuranceExpiry: str(data.insuranceExpiry),
    warrantyMonths: numOrNull(data.warrantyMonths),
  };

  return applyDocumentTypeGuards(base);
}

/**
 * Extract structured asset fields from raw OCR text (and optional hints).
 * Always classifies documentType first.
 */
export async function extractAssetWithGemini(rawText, hints = {}) {
  const key = apiKey();
  if (!key) {
    return { success: false, error: 'GEMINI_API_KEY not configured', data: null };
  }
  if (!String(rawText || '').trim()) {
    return { success: false, error: 'No OCR text to enhance', data: null };
  }

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { temperature: 0.1, maxOutputTokens: 1400 },
    });

    const hintType = hints.expectedDocumentType
      ? `expectedDocumentType=${hints.expectedDocumentType}`
      : 'expectedDocumentType=';

    const prompt = `${SYSTEM_PROMPT}

OCR TEXT:
"""
${String(rawText).slice(0, 12000)}
"""

HINTS:
barcode=${hints.barcode || ''}
serialHint=${hints.serialHint || ''}
${hintType}

Remember: classify documentType FIRST. Never label an RC / PUC / Insurance paper as PURCHASE_INVOICE.
`;

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || '';
    const parsed = normalizeGeminiPayload(safeJsonParse(text));
    return { success: true, data: parsed, raw: text, model: MODEL };
  } catch (error) {
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
  GEMINI_DOC_TYPES,
  GEMINI_TO_VAULT_TYPE,
  MODEL,
};

export default GeminiService;

/**
 * Consumer Asset VLM Service — Gemini 2.0 Flash Multimodal Ingestion Engine.
 *
 * Lightweight, end-to-end vision extraction focused strictly on consumer ownership metadata.
 * Completely bypasses legacy OCR, regexes, bounding boxes, and accounting/GST bloat.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '../../config/env';
import { resolveClientApiKey } from '../security/clientSecretPolicy';
import {
  PRIMARY_GEMINI_VLM_MODEL,
  generateContentWithFailover,
  safeParseGeminiJson,
} from './geminiModelConfig';

export const VLM_MODEL = PRIMARY_GEMINI_VLM_MODEL;

export type IdentifierType =
  | 'SERIAL_NUMBER'
  | 'CHASSIS_NUMBER'
  | 'ENGINE_NUMBER'
  | 'IMEI'
  | 'UNKNOWN';

export interface ConsumerAssetExtraction {
  product_name: string | null;
  brand: string | null;
  model_variant: string | null;
  serial_or_identifier: string | null;
  identifier_type: IdentifierType;
  seller_name: string | null;
  buyer_name: string | null;
  purchase_date: string | null;
  invoice_number: string | null;
  total_paid_amount: number | null;
  warranty_period: string | null;
  warranty_expiry_date: string | null;
}

export interface NormalizedConsumerAsset {
  productName: string;
  brand: string;
  model: string;
  serialNumber: string;
  chassisNumber: string;
  engineNumber: string;
  imei: string;
  identifierType: IdentifierType;
  serialOrIdentifier: string;
  shopName: string;
  customerName: string;
  invoiceDate: string;
  invoiceNumber: string;
  totalAmount: number | null;
  purchaseAmount: number | null;
  warrantyPeriod: string;
  warrantyExpiry: string;
  category?: string;
  rawVlmExtract: ConsumerAssetExtraction;
}

export const SYSTEM_PROMPT = `You are a consumer asset assistant. Analyze the image and extract ONLY essential ownership details: Asset Name, Brand, Model, Serial/IMEI/Chassis Number, Seller Name, Buyer Name, Purchase Date, Bill Number, Total Paid Amount, and Warranty. DO NOT calculate or extract GST, tax breakdowns, HSN codes, discounts, or line item details. If total amount is present, return it as a single numeric float. If any field is missing, set it to null.

Synonym & Indian Domain Rules:
- "Frame No", "Chassis No", "VIN" -> identifier_type: "CHASSIS_NUMBER"
- "IMEI", "IMEI 1", "IMEI 2" -> identifier_type: "IMEI"
- "Engine No", "Motor No" -> identifier_type: "ENGINE_NUMBER"
- "Serial No", "S/N", "Serial Number" -> identifier_type: "SERIAL_NUMBER"
- If no specific serial type can be determined but an identifier exists -> identifier_type: "UNKNOWN"
- For dates, return ISO format YYYY-MM-DD if recognizable, else null.
- For total_paid_amount, return ONLY the net final paid amount as a number (no currency symbols, no commas).`;
export const CONSUMER_ASSET_SYSTEM_PROMPT = SYSTEM_PROMPT;

export const EXTRACTION_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    product_name: { type: 'STRING' as const, nullable: true },
    brand: { type: 'STRING' as const, nullable: true },
    model_variant: { type: 'STRING' as const, nullable: true },
    serial_or_identifier: { type: 'STRING' as const, nullable: true },
    identifier_type: {
      type: 'STRING' as const,
      enum: ['SERIAL_NUMBER', 'CHASSIS_NUMBER', 'ENGINE_NUMBER', 'IMEI', 'UNKNOWN'],
    },
    seller_name: { type: 'STRING' as const, nullable: true },
    buyer_name: { type: 'STRING' as const, nullable: true },
    purchase_date: { type: 'STRING' as const, nullable: true },
    invoice_number: { type: 'STRING' as const, nullable: true },
    total_paid_amount: { type: 'NUMBER' as const, nullable: true },
    warranty_period: { type: 'STRING' as const, nullable: true },
    warranty_expiry_date: { type: 'STRING' as const, nullable: true },
  },
  required: [
    'product_name',
    'brand',
    'model_variant',
    'serial_or_identifier',
    'identifier_type',
    'seller_name',
    'buyer_name',
    'purchase_date',
    'invoice_number',
    'total_paid_amount',
    'warranty_period',
    'warranty_expiry_date',
  ],
};
export const CONSUMER_ASSET_SCHEMA = EXTRACTION_SCHEMA;

function getApiKey(): string {
  return resolveClientApiKey([
    process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY,
    ENV.geminiApiKey,
  ]);
}

/**
 * Normalizes VIN / Chassis numbers:
 * Strips whitespace, converts to uppercase, and replaces misread letter 'O' with digit '0'
 * if it matches a chassis/VIN format.
 */
export function normalizeChassisNumber(raw: string | null | undefined): string {
  if (!raw) return '';
  let cleaned = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (cleaned.length >= 10 && /^[A-HJ-NPR-Z0-9O]+$/.test(cleaned)) {
    cleaned = cleaned.replace(/O/g, '0');
  }
  return cleaned;
}

/**
 * Computes ISO expiry date (YYYY-MM-DD) from purchase date + warranty period string
 * (e.g. "1 Year", "2 Years", "6 Months", "12 Months", "3 Years", "18 Months").
 */
export function computeWarrantyExpiry(
  purchaseDateStr: string | null | undefined,
  warrantyPeriodStr: string | null | undefined,
): string | null {
  if (!purchaseDateStr) return null;
  const pDate = new Date(purchaseDateStr);
  if (Number.isNaN(pDate.getTime())) return null;

  if (!warrantyPeriodStr) return null;
  const period = String(warrantyPeriodStr).toLowerCase().trim();

  let monthsToAdd = 0;
  const yearMatch = period.match(/(\d+)\s*(?:yr|year|years|saal)/i);
  const monthMatch = period.match(/(\d+)\s*(?:mo|month|months|mahine)/i);

  if (yearMatch) {
    monthsToAdd += parseInt(yearMatch[1], 10) * 12;
  }
  if (monthMatch) {
    monthsToAdd += parseInt(monthMatch[1], 10);
  }

  if (monthsToAdd <= 0) {
    if (period.includes('one year') || period.includes('1yr')) monthsToAdd = 12;
    else if (period.includes('two year') || period.includes('2yr')) monthsToAdd = 24;
    else if (period.includes('three year') || period.includes('3yr')) monthsToAdd = 36;
    else if (period.includes('six month')) monthsToAdd = 6;
  }

  if (monthsToAdd <= 0) return null;

  const expiry = new Date(pDate.getTime());
  expiry.setMonth(expiry.getMonth() + monthsToAdd);

  const yyyy = expiry.getFullYear();
  const mm = String(expiry.getMonth() + 1).padStart(2, '0');
  const dd = String(expiry.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Sanitizes total paid amount to a clean number.
 */
export function sanitizeAmount(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  // Strip currency words/symbols like Rs., Rs, INR, ₹, etc.
  let cleaned = String(raw).replace(/(?:rs\.?|inr|₹)/gi, '').trim();
  // Strip commas
  cleaned = cleaned.replace(/,/g, '').trim();
  // Match the first valid numeric float
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = parseFloat(match[0]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Post-processes and normalizes raw VLM extraction into a clean format
 * ready for ReviewAssetScreen and AssetService.
 */
export function postProcessVlmExtraction(
  raw: ConsumerAssetExtraction,
): NormalizedConsumerAsset {
  const productName = (raw.product_name || '').trim();
  const brand = (raw.brand || '').trim();
  const model = (raw.model_variant || '').trim();
  const identifierType: IdentifierType = raw.identifier_type || 'UNKNOWN';

  let serialOrIdentifier = (raw.serial_or_identifier || '').trim();
  if (identifierType === 'CHASSIS_NUMBER') {
    serialOrIdentifier = normalizeChassisNumber(serialOrIdentifier);
  }

  let chassisNumber = '';
  let imei = '';
  let engineNumber = '';
  let serialNumber = '';

  if (identifierType === 'CHASSIS_NUMBER') {
    chassisNumber = serialOrIdentifier;
  } else if (identifierType === 'IMEI') {
    imei = serialOrIdentifier;
  } else if (identifierType === 'ENGINE_NUMBER') {
    engineNumber = serialOrIdentifier;
  } else if (identifierType === 'SERIAL_NUMBER') {
    serialNumber = serialOrIdentifier;
  } else {
    serialNumber = serialOrIdentifier;
  }

  const purchaseDate = (raw.purchase_date || '').trim();
  const warrantyPeriod = (raw.warranty_period || '').trim();

  let warrantyExpiry = (raw.warranty_expiry_date || '').trim();
  if (!warrantyExpiry && purchaseDate && warrantyPeriod) {
    const computed = computeWarrantyExpiry(purchaseDate, warrantyPeriod);
    if (computed) warrantyExpiry = computed;
  }

  const totalAmount = sanitizeAmount(raw.total_paid_amount);

  // Derive initial category hint
  let category = 'Other';
  const lowerName = `${productName} ${brand} ${model}`.toLowerCase();
  if (
    chassisNumber ||
    engineNumber ||
    /bike|scooter|car|motorcycle|ronin|tvs|honda|hero|bajaj|suzuki|hyundai|tata|ola|ather/i.test(lowerName)
  ) {
    category = 'Vehicle';
  } else if (
    imei ||
    /phone|buds|earphones|headphones|laptop|tablet|smartwatch|apple|samsung|nothing|cmf/i.test(lowerName)
  ) {
    category = 'Gadget';
  } else if (
    /ac|refrigerator|fridge|washing machine|geyser|microwave|purifier|tv|television/i.test(lowerName)
  ) {
    category = 'Home';
  }

  return {
    productName: productName || [brand, model].filter(Boolean).join(' ') || '',
    brand,
    model,
    serialNumber,
    chassisNumber,
    engineNumber,
    imei,
    identifierType,
    serialOrIdentifier,
    shopName: (raw.seller_name || '').trim(),
    customerName: (raw.buyer_name || '').trim(),
    invoiceDate: purchaseDate,
    invoiceNumber: (raw.invoice_number || '').trim(),
    totalAmount,
    purchaseAmount: totalAmount,
    warrantyPeriod,
    warrantyExpiry,
    category,
    rawVlmExtract: raw,
  };
}

export class ConsumerAssetVlmService {
  /**
   * Fast In-Memory Multimodal Extraction using Gemini 2.0 Flash.
   *
   * @param imageBase64 Base64 string of the preprocessed/cropped document image
   * @param mimeType Image MIME type (default: image/jpeg)
   */
  static async extractConsumerAsset(
    imageBase64: string,
    mimeType: string = 'image/jpeg',
  ): Promise<{
    success: boolean;
    data: NormalizedConsumerAsset | null;
    raw?: ConsumerAssetExtraction | null;
    error?: string;
    latencyMs?: number;
  }> {
    const t0 = Date.now();
    const key = getApiKey();

    if (!key) {
      return {
        success: false,
        data: null,
        error: 'Gemini API key is not configured.',
      };
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return {
        success: false,
        data: null,
        error: 'No image buffer provided for VLM extraction.',
      };
    }

    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
      const genAI = new GoogleGenerativeAI(key);

      const imagePart = {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/jpeg',
        },
      };

      const result = await generateContentWithFailover(
        genAI,
        {
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            responseSchema: EXTRACTION_SCHEMA,
          },
        },
        [SYSTEM_PROMPT, imagePart],
      );
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini VLM.');
      }

      const rawJson = safeParseGeminiJson<ConsumerAssetExtraction>(text);
      const normalized = postProcessVlmExtraction(rawJson);

      return {
        success: true,
        data: normalized,
        raw: rawJson,
        latencyMs: Date.now() - t0,
      };
    } catch (err: any) {
      console.warn('[ConsumerAssetVlmService] Extraction failed:', err?.message || err);
      return {
        success: false,
        data: null,
        error: err?.message || 'Failed to extract ownership details from invoice.',
        latencyMs: Date.now() - t0,
      };
    }
  }
}

export default ConsumerAssetVlmService;

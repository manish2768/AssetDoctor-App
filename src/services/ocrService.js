/**
 * Google Cloud Vision OCR — direct REST (Expo / OTA friendly).
 * Uses EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY from .env
 *
 * Text extraction is raw Vision DOCUMENT_TEXT_DETECTION.
 * Structured Indian GST fields are parsed in `./ocr/InvoiceOcrParser`
 * (shopName, GSTIN, product, IMEI, grand total, tax, line items).
 */

import { ENV } from '../config/env.js';
import { parseInvoiceText } from './ocr/InvoiceOcrParser.js';

const VISION_ANNOTATE_URL = 'https://vision.googleapis.com/v1/images:annotate';

function getApiKey() {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY ||
    ENV.googleCloudVisionApiKey ||
    ''
  ).trim();
}

/**
 * Call Cloud Vision DOCUMENT_TEXT_DETECTION with a base64 image payload.
 * @param {string} base64Image - raw base64 (no data: URL prefix required)
 * @returns {Promise<{ success: boolean, text: string, error?: string, raw?: object }>}
 */
export async function scanInvoiceImage(base64Image) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      success: false,
      text: '',
      error: 'Missing EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY',
    };
  }

  const content = String(base64Image || '').replace(/^data:image\/\w+;base64,/, '');
  if (!content || content.length < 32) {
    return { success: false, text: '', error: 'Invalid image data for OCR' };
  }

  const trimmed = content.length > 4_500_000 ? content.slice(0, 4_500_000) : content;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);

  try {
    const res = await fetch(`${VISION_ANNOTATE_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        requests: [
          {
            image: { content: trimmed },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            imageContext: {
              languageHints: ['en', 'hi'],
            },
          },
        ],
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        text: '',
        error: json?.error?.message || `Vision HTTP ${res.status}`,
        raw: json,
      };
    }

    const annotation = json?.responses?.[0];
    if (annotation?.error?.message) {
      return {
        success: false,
        text: '',
        error: annotation.error.message,
        raw: json,
      };
    }

    const text =
      annotation?.fullTextAnnotation?.text ||
      annotation?.textAnnotations?.[0]?.description ||
      '';

    return {
      success: true,
      text: String(text || ''),
      raw: json,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: error?.name === 'AbortError' ? 'Vision OCR timed out' : error?.message || 'Vision OCR failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Vision OCR + Indian GST / retail invoice parse (no dummy fallbacks).
 */
export async function scanAndParseInvoice(base64Image) {
  const ocr = await scanInvoiceImage(base64Image);
  if (!ocr.success) {
    return { ...ocr, data: null };
  }
  const parsed = parseInvoiceText(ocr.text);
  return {
    success: true,
    text: ocr.text,
    data: parsed.data,
    confidence: parsed.confidence,
    raw: ocr.raw,
  };
}

export const OcrServiceClient = {
  scanInvoiceImage,
  scanAndParseInvoice,
  parseInvoiceText,
  getApiKey,
};

export default OcrServiceClient;

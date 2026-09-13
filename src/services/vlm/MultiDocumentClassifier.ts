/**
 * Multi-Document Classifier — Gemini 2.0 Flash First-Stage Classifier.
 *
 * Reliably classifies incoming scans into:
 * - INVOICE: General retail bill, consumer electronics, vehicle purchase bill, appliance invoice
 * - INSURANCE: Vehicle / health / general insurance policy, certificate of insurance
 * - PUC: Pollution Under Control certificate, vehicle emission test document
 * - ELECTRICITY_BILL: Utility electricity bill / DISCOM power bill
 * - UNKNOWN: Document type not identifiable with high confidence
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveClientApiKey } from '../security/clientSecretPolicy';

export type DocumentType =
  | 'INVOICE'
  | 'VEHICLE_SERVICE'
  | 'INSURANCE'
  | 'PUC'
  | 'ELECTRICITY_BILL'
  | 'UNKNOWN';

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  reasoning: string;
  signals?: string[];
}

const CLASSIFIER_SYSTEM_PROMPT = `You are an expert Indian document intelligence classifier.
Analyze the provided document image and classify it into EXACTLY ONE of the following document types:
- "INVOICE": Purchase bill, sales invoice, cash memo, retail receipt for goods (vehicles, electronics, appliances, general products).
- "VEHICLE_SERVICE": Vehicle service bill, workshop repair invoice, periodic maintenance bill, job card invoice with labour/parts.
- "INSURANCE": Motor vehicle insurance policy, certificate of insurance, cover note, comprehensive/third-party policy document.
- "PUC": Pollution Under Control certificate, vehicle emission test certificate, PUC test slip.
- "ELECTRICITY_BILL": Power utility bill from electricity boards/DISCOMs (e.g., BESCOM, Tata Power, BSES, MSEDCL, UPPCL, Adani).
- "UNKNOWN": If the image is not a document, completely blurry, unreadable, or a non-matching document type.

Return a JSON object matching this schema:
{
  "document_type": "INVOICE" | "VEHICLE_SERVICE" | "INSURANCE" | "PUC" | "ELECTRICITY_BILL" | "UNKNOWN",
  "confidence": number between 0.0 and 1.0,
  "reasoning": "brief 1-sentence reason based on visible headers, labels, and text"
}

Signals to look for:
- VEHICLE_SERVICE: Service Invoice, Workshop, Job Card, Labour Charges, Parts Replaced, Periodic Maintenance, Odometer/KM, Next Service Due, Engine Oil.
- INSURANCE: Policy No, Insured, Insurer, IDV, Premium, Own Damage, Third Party, Period of Insurance, Covernote.
- PUC: Pollution Under Control, PUC Certificate, Emission Test, Valid Upto, Smoke Density, CO/HC, Test Date.
- ELECTRICITY_BILL: Electricity, Consumer No, CA No, Meter No, Units Consumed, kWh, Energy Charges, Due Date, DISCOM.
- INVOICE: Tax Invoice, Sales Invoice, Bill No, Total Amount, Sold by, Buyer, Warranty, Product description, Price.

If confidence is below 0.70, choose UNKNOWN.`;

const CLASSIFIER_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    document_type: {
      type: 'STRING' as const,
      enum: ['INVOICE', 'VEHICLE_SERVICE', 'INSURANCE', 'PUC', 'ELECTRICITY_BILL', 'UNKNOWN'],
    },
    confidence: { type: 'NUMBER' as const },
    reasoning: { type: 'STRING' as const },
  },
  required: ['document_type', 'confidence', 'reasoning'],
};

/**
 * Fast local heuristic classifier based on visible text patterns.
 * Used for offline verification or pre-screening.
 */
export function classifyByHeuristics(text: string): ClassificationResult | null {
  if (!text || text.trim().length < 15) return null;
  const lower = text.toLowerCase();

  // PUC Signals
  const pucMatches = [
    'pollution under control',
    'puc certificate',
    'p.u.c',
    'puc no',
    'emission test',
    'emission norms',
    'smoke density',
    'valid upto',
  ].filter((k) => lower.includes(k));

  if (pucMatches.length >= 2 || (pucMatches.length >= 1 && /co\s*\(%|hc\s*\(ppm\)/i.test(lower))) {
    return {
      documentType: 'PUC',
      confidence: 0.92,
      reasoning: `Matched PUC keywords: ${pucMatches.join(', ')}`,
      signals: pucMatches,
    };
  }

  // Insurance Signals
  const insMatches = [
    'policy schedule',
    'certificate of insurance',
    'policy number',
    'policy no',
    'period of insurance',
    'insured declared value',
    'idv',
    'own damage',
    'third party',
    'compulsory personal accident',
    'gross written premium',
    'insurance company',
    'general insurance',
    'tata aig',
    'hdfc ergo',
    'icici lombard',
    'bajaj allianz',
    'united india insurance',
    'new india assurance',
  ].filter((k) => lower.includes(k));

  if (insMatches.length >= 2) {
    return {
      documentType: 'INSURANCE',
      confidence: 0.94,
      reasoning: `Matched Insurance keywords: ${insMatches.join(', ')}`,
      signals: insMatches,
    };
  }

  // Electricity Bill Signals
  const elecMatches = [
    'electricity bill',
    'electric supply',
    'consumer no',
    'consumer id',
    'meter no',
    'meter reading',
    'units consumed',
    'energy charges',
    'fixed charges',
    'power corporation',
    'discom',
    'kwh',
    'connected load',
    'tata power',
    'bses',
    'bescom',
    'msedcl',
    'uppcl',
  ].filter((k) => lower.includes(k));

  if (elecMatches.length >= 2) {
    return {
      documentType: 'ELECTRICITY_BILL',
      confidence: 0.95,
      reasoning: `Matched Electricity Bill keywords: ${elecMatches.join(', ')}`,
      signals: elecMatches,
    };
  }

  // Vehicle Service Bill Signals (must evaluate before generic purchase invoice)
  const serviceMatches = [
    'service invoice',
    'job card',
    'workshop',
    'labour charges',
    'labor charges',
    'parts replaced',
    'periodic service',
    'service due',
    'odometer',
    'engine oil',
    'filter change',
    'wheel alignment',
    'scheduled maintenance',
    'next service',
    'mechanic',
  ].filter((k) => lower.includes(k));

  if (
    serviceMatches.length >= 2 ||
    (serviceMatches.length >= 1 && (lower.includes('labour') || lower.includes('job card') || lower.includes('odometer') || lower.includes('workshop')))
  ) {
    return {
      documentType: 'VEHICLE_SERVICE',
      confidence: 0.92,
      reasoning: `Matched Vehicle Service keywords: ${serviceMatches.join(', ')}`,
      signals: serviceMatches,
    };
  }

  // Invoice Signals
  const invMatches = [
    'tax invoice',
    'retail invoice',
    'cash memo',
    'bill of supply',
    'invoice no',
    'bill no',
    'grand total',
    'total amount',
    'product name',
    'item description',
  ].filter((k) => lower.includes(k));

  if (invMatches.length >= 2) {
    return {
      documentType: 'INVOICE',
      confidence: 0.88,
      reasoning: `Matched Invoice keywords: ${invMatches.join(', ')}`,
      signals: invMatches,
    };
  }

  return null;
}

import { generateContentWithFailover, safeParseGeminiJson } from './geminiModelConfig';

export class MultiDocumentClassifier {
  public static async classifyDocument(
    base64Image: string,
    mimeType: string = 'image/jpeg',
  ): Promise<ClassificationResult> {
    const apiKey = resolveClientApiKey([
      process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY,
    ]);
    if (!apiKey) {
      console.warn('[MultiDocumentClassifier] No Gemini API key available');
      return {
        documentType: 'UNKNOWN',
        confidence: 0.0,
        reasoning: 'API key missing',
      };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await generateContentWithFailover(
        genAI,
        {
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: CLASSIFIER_SCHEMA,
            temperature: 0.1,
          },
        },
        [
          { text: CLASSIFIER_SYSTEM_PROMPT },
          {
            inlineData: {
              data: base64Image,
              mimeType,
            },
          },
        ],
        15000,
      );

      const text = result.response.text();
      const parsed = safeParseGeminiJson<any>(text);

      const docType: DocumentType = [
        'INVOICE',
        'VEHICLE_SERVICE',
        'INSURANCE',
        'PUC',
        'ELECTRICITY_BILL',
      ].includes(parsed.document_type)
        ? parsed.document_type
        : 'UNKNOWN';

      return {
        documentType: docType,
        confidence: Number(parsed.confidence) || 0.5,
        reasoning: String(parsed.reasoning || ''),
      };
    } catch (err: any) {
      console.error('[MultiDocumentClassifier] VLM Error:', err?.message || err);
      return {
        documentType: 'UNKNOWN',
        confidence: 0.0,
        reasoning: err?.message || 'Classification failed',
      };
    }
  }
}

/**
 * Insurance VLM Service — Specialized Vision Extraction for Vehicle & General Insurance.
 *
 * Extracts policy details, vehicle linkage identifiers, IDV, premium, and validity dates.
 * Strictly separates insurance expiry from consumer warranty expiry.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveClientApiKey } from '../security/clientSecretPolicy';
import { normalizeChassisNumber, sanitizeAmount } from './ConsumerAssetVlmService';

export interface InsuranceExtraction {
  policy_number: string | null;
  insurer_name: string | null;
  policy_type: string | null;
  customer_name: string | null;
  vehicle_registration_number: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  insured_declared_value: number | null;
  premium_amount: number | null;
  policy_start_date: string | null;
  policy_expiry_date: string | null;
  coverage_details: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  is_insurance_policy?: boolean;
}

export interface NormalizedInsuranceData {
  documentType: 'INSURANCE';
  policyNumber: string;
  insurerName: string;
  policyType: string;
  customerName: string;
  vehicleRegistrationNumber: string;
  chassisNumber: string;
  chassisSuffix: string; // Last 4-6 digits for suffix matching
  engineNumber: string;
  engineSuffix: string;  // Last 4-6 digits for suffix matching
  idv: number | null;
  premium: number | null;
  policyStartDate: string;
  policyExpiryDate: string;
  coverageDetails: string;
  vehicleMake: string;
  vehicleModel: string;
  rawVlmExtract: InsuranceExtraction;
}

export const INSURANCE_SYSTEM_PROMPT = `You are an expert insurance document assistant.
Analyze this motor / vehicle insurance policy image and extract ONLY the insurance and vehicle identity details.
DO NOT calculate or invent values. If a field is missing or unreadable, set it to null.

Synonym rules:
- Insurer Name: Insurance Company (e.g. Tata AIG, HDFC ERGO, ICICI Lombard, Bajaj Allianz, Digit, etc.)
- Policy Number: Policy / Certificate / Covernote number.
- Policy Type: Comprehensive / Package, Standalone Own Damage (OD), Liability / Third Party (TP).
- IDV: Insured Declared Value (numeric float).
- Premium: Gross or Total Premium Paid (numeric float).
- Dates: Return ISO format YYYY-MM-DD.
- Registration Number: Vehicle plate / reg no (e.g. KA01AB1234, DL3CC1234).
- Chassis / VIN: 17-character VIN or whatever chassis/frame number appears.
- Engine Number: Engine / Motor number.
- Document Validity: Set is_insurance_policy to true if this is an insurance policy/certificate/cover note. If it is NOT an insurance document, set is_insurance_policy to false.`;

export const INSURANCE_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    is_insurance_policy: { type: 'BOOLEAN' as const },
    policy_number: { type: 'STRING' as const, nullable: true },
    insurer_name: { type: 'STRING' as const, nullable: true },
    policy_type: { type: 'STRING' as const, nullable: true },
    customer_name: { type: 'STRING' as const, nullable: true },
    vehicle_registration_number: { type: 'STRING' as const, nullable: true },
    chassis_number: { type: 'STRING' as const, nullable: true },
    engine_number: { type: 'STRING' as const, nullable: true },
    insured_declared_value: { type: 'NUMBER' as const, nullable: true },
    premium_amount: { type: 'NUMBER' as const, nullable: true },
    policy_start_date: { type: 'STRING' as const, nullable: true },
    policy_expiry_date: { type: 'STRING' as const, nullable: true },
    coverage_details: { type: 'STRING' as const, nullable: true },
    vehicle_make: { type: 'STRING' as const, nullable: true },
    vehicle_model: { type: 'STRING' as const, nullable: true },
  },
  required: [
    'is_insurance_policy',
    'policy_number',
    'insurer_name',
    'policy_type',
    'customer_name',
    'vehicle_registration_number',
    'chassis_number',
    'engine_number',
    'insured_declared_value',
    'premium_amount',
    'policy_start_date',
    'policy_expiry_date',
    'coverage_details',
    'vehicle_make',
    'vehicle_model',
  ],
};

export function postProcessInsuranceExtraction(raw: InsuranceExtraction): NormalizedInsuranceData {
  const normReg = String(raw.vehicle_registration_number || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const normChassis = normalizeChassisNumber(raw.chassis_number);
  const normEngine = String(raw.engine_number || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const chassisSuffix = normChassis.length >= 4 ? normChassis.slice(-6) : '';
  const engineSuffix = normEngine.length >= 4 ? normEngine.slice(-6) : '';

  return {
    documentType: 'INSURANCE',
    policyNumber: String(raw.policy_number || '').trim(),
    insurerName: String(raw.insurer_name || '').trim(),
    policyType: String(raw.policy_type || 'Comprehensive').trim(),
    customerName: String(raw.customer_name || '').trim(),
    vehicleRegistrationNumber: normReg,
    chassisNumber: normChassis,
    chassisSuffix,
    engineNumber: normEngine,
    engineSuffix,
    idv: sanitizeAmount(raw.insured_declared_value),
    premium: sanitizeAmount(raw.premium_amount),
    policyStartDate: String(raw.policy_start_date || '').trim(),
    policyExpiryDate: String(raw.policy_expiry_date || '').trim(),
    coverageDetails: String(raw.coverage_details || '').trim(),
    vehicleMake: String(raw.vehicle_make || '').trim(),
    vehicleModel: String(raw.vehicle_model || '').trim(),
    rawVlmExtract: raw,
  };
}

import { generateContentWithFailover, safeParseGeminiJson } from './geminiModelConfig';

export class InsuranceVlmService {
  public static async extractInsurance(
    base64Image: string,
    mimeType: string = 'image/jpeg',
  ): Promise<{ success: boolean; data?: NormalizedInsuranceData; isTypeMismatch?: boolean; error?: string }> {
    const apiKey = resolveClientApiKey([
      process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY,
    ]);
    if (!apiKey) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await generateContentWithFailover(
        genAI,
        {
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: INSURANCE_SCHEMA,
            temperature: 0.1,
          },
        },
        [
          { text: INSURANCE_SYSTEM_PROMPT },
          {
            inlineData: {
              data: base64Image,
              mimeType,
            },
          },
        ],
      );

      const text = result.response.text();
      const parsed: InsuranceExtraction = safeParseGeminiJson<InsuranceExtraction>(text);
      if (parsed.is_insurance_policy === false) {
        return {
          success: false,
          isTypeMismatch: true,
          error: 'Scanned document does not appear to be an insurance policy.',
        };
      }
      const normalized = postProcessInsuranceExtraction(parsed);

      return {
        success: true,
        data: normalized,
      };
    } catch (err: any) {
      console.error('[InsuranceVlmService] VLM extraction error:', err?.message || err);
      return {
        success: false,
        error: err?.message || 'Failed to extract insurance document',
      };
    }
  }
}

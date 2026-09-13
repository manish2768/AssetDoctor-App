/**
 * PUC VLM Service — Specialized Vision Extraction for Pollution Under Control (PUC) Certificates.
 *
 * Extracts certificate number, vehicle linkage identifiers, test date, and validity date.
 * Strictly maps validity to `pucValidUntil`, never to consumer warranty expiry.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveClientApiKey } from '../security/clientSecretPolicy';
import { normalizeChassisNumber } from './ConsumerAssetVlmService';

export interface PucExtraction {
  certificate_number: string | null;
  vehicle_registration_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  owner_name: string | null;
  fuel_type: string | null;
  test_date: string | null;
  valid_until: string | null;
  emission_values: string | null;
  issuing_authority: string | null;
}

export interface NormalizedPucData {
  documentType: 'PUC';
  certificateNumber: string;
  vehicleRegistrationNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  chassisNumber: string;
  chassisSuffix: string;
  engineNumber: string;
  engineSuffix: string;
  ownerName: string;
  fuelType: string;
  testDate: string;
  validUntil: string;
  emissionValues: string;
  issuingAuthority: string;
  rawVlmExtract: PucExtraction;
}

const PUC_SYSTEM_PROMPT = `You are an expert Indian vehicle document assistant.
Analyze this Pollution Under Control (PUC) certificate image and extract ONLY the emission test, vehicle identity, and certificate validity details.
DO NOT calculate or invent values. If a field is missing, set it to null.

Synonym rules:
- Certificate Number: PUC No, Certificate No, Test Slip No.
- Registration Number: Vehicle Regn No / Plate (e.g. DL01AB1234, MH02CD5678).
- Chassis / VIN: Frame No / Chassis No (e.g. last 5-17 characters).
- Engine Number: Engine No.
- Fuel Type: Petrol, Diesel, CNG, LPG, Electric / Hybrid.
- Test Date: Date of test / inspection (ISO YYYY-MM-DD).
- Valid Until: Validity date / Valid Upto / Expiry date (ISO YYYY-MM-DD).
- Emission Values: Carbon Monoxide (CO %), Hydrocarbons (HC ppm), or Smoke density readings.
- Issuing Authority: Testing center name, RTO code, or Authorized Agency name.`;

const PUC_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    certificate_number: { type: 'STRING' as const, nullable: true },
    vehicle_registration_number: { type: 'STRING' as const, nullable: true },
    vehicle_make: { type: 'STRING' as const, nullable: true },
    vehicle_model: { type: 'STRING' as const, nullable: true },
    chassis_number: { type: 'STRING' as const, nullable: true },
    engine_number: { type: 'STRING' as const, nullable: true },
    owner_name: { type: 'STRING' as const, nullable: true },
    fuel_type: { type: 'STRING' as const, nullable: true },
    test_date: { type: 'STRING' as const, nullable: true },
    valid_until: { type: 'STRING' as const, nullable: true },
    emission_values: { type: 'STRING' as const, nullable: true },
    issuing_authority: { type: 'STRING' as const, nullable: true },
  },
  required: [
    'certificate_number',
    'vehicle_registration_number',
    'vehicle_make',
    'vehicle_model',
    'chassis_number',
    'engine_number',
    'owner_name',
    'fuel_type',
    'test_date',
    'valid_until',
    'emission_values',
    'issuing_authority',
  ],
};

export function postProcessPucExtraction(raw: PucExtraction): NormalizedPucData {
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
    documentType: 'PUC',
    certificateNumber: String(raw.certificate_number || '').trim(),
    vehicleRegistrationNumber: normReg,
    vehicleMake: String(raw.vehicle_make || '').trim(),
    vehicleModel: String(raw.vehicle_model || '').trim(),
    chassisNumber: normChassis,
    chassisSuffix,
    engineNumber: normEngine,
    engineSuffix,
    ownerName: String(raw.owner_name || '').trim(),
    fuelType: String(raw.fuel_type || '').trim(),
    testDate: String(raw.test_date || '').trim(),
    validUntil: String(raw.valid_until || '').trim(),
    emissionValues: String(raw.emission_values || '').trim(),
    issuingAuthority: String(raw.issuing_authority || '').trim(),
    rawVlmExtract: raw,
  };
}

import { generateContentWithFailover, safeParseGeminiJson } from './geminiModelConfig';

export class PucVlmService {
  public static async extractPuc(
    base64Image: string,
    mimeType: string = 'image/jpeg',
  ): Promise<{ success: boolean; data?: NormalizedPucData; error?: string }> {
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
            responseSchema: PUC_SCHEMA,
            temperature: 0.1,
          },
        },
        [
          { text: PUC_SYSTEM_PROMPT },
          {
            inlineData: {
              data: base64Image,
              mimeType,
            },
          },
        ],
      );

      const text = result.response.text();
      const parsed: PucExtraction = safeParseGeminiJson<PucExtraction>(text);
      const normalized = postProcessPucExtraction(parsed);

      return {
        success: true,
        data: normalized,
      };
    } catch (err: any) {
      console.error('[PucVlmService] VLM extraction error:', err?.message || err);
      return {
        success: false,
        error: err?.message || 'Failed to extract PUC document',
      };
    }
  }
}

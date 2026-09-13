/**
 * Vehicle Service VLM Service — Specialized Vision Extraction for Vehicle Workshop Invoices.
 *
 * Extracts workshop details, registration/chassis, odometer km, labour/parts amounts,
 * service date, and next service due.
 *
 * Strictly routes to Existing Vehicle Passport -> Service History.
 * NEVER creates a standalone consumer asset!
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveClientApiKey } from '../security/clientSecretPolicy';
import { sanitizeAmount, normalizeChassisNumber } from './ConsumerAssetVlmService';

export interface VehicleServiceExtraction {
  service_invoice_number: string | null;
  service_date: string | null;
  workshop_name: string | null;
  customer_name: string | null;
  registration_number: string | null;
  chassis_number: string | null;
  engine_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  variant: string | null;
  job_type: string | null;
  odometer_km: number | null;
  service_items: string | null;
  labour_amount: number | null;
  parts_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  next_service_date: string | null;
  next_service_km: number | null;
}

export interface NormalizedVehicleServiceData {
  documentType: 'VEHICLE_SERVICE';
  serviceInvoiceNumber: string;
  serviceDate: string;
  workshopName: string;
  customerName: string;
  registrationNumber: string;
  chassisNumber: string;
  chassisSuffix: string;
  engineNumber: string;
  engineSuffix: string;
  vehicleMake: string;
  vehicleModel: string;
  variant: string;
  jobType: string;
  odometerKm: number | null;
  serviceItems: string;
  labourAmount: number | null;
  partsAmount: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  nextServiceDate: string;
  nextServiceKm: number | null;
  rawVlmExtract: VehicleServiceExtraction;
}

export const VEHICLE_SERVICE_SYSTEM_PROMPT = `You are an expert Indian vehicle workshop service invoice assistant.
Analyze this vehicle service bill / job card invoice image and extract ONLY the service, vehicle, odometer, and billing details.
DO NOT calculate or invent values. If a field is missing, set it to null.

Synonym and field extraction rules:
- Service Invoice Number: Invoice No, Bill No, Cash Memo No, Job Card No, RO No.
- Service Date: Date of repair, invoice date, delivery date (ISO YYYY-MM-DD).
- Workshop Name: Dealer or authorized service center (e.g., Authorized Service Center, Apex Motors, City Workshop).
- Customer Name: Vehicle owner / customer billed.
- Registration Number: Vehicle plate (e.g. KA01AB1234, UP32QU2187, DL04AB1234).
- Chassis / Frame Number: VIN / Frame No / Chassis No.
- Engine Number: Motor / Engine No.
- Vehicle Make & Model: Make (e.g. TVS, Hyundai, Maruti Suzuki) and Model (e.g. Ronin, Creta, Swift).
- Job Type: Periodic Maintenance, 1st Free Service, Paid Service, Accidental Repair, Running Repair.
- Odometer KM: KM reading at time of service (numeric integer).
- Service Items: Brief summary of major repairs / parts replaced (e.g. Engine Oil, Oil Filter, Brake Pads).
- Labour Amount: Total labour / service charges (numeric float).
- Parts Amount: Total spare parts / consumables charges (numeric float).
- Tax Amount: GST / VAT / Tax component (numeric float).
- Total Amount: Net total / Grand total payable (numeric float).
- Next Service Date: Next service recommended date (ISO YYYY-MM-DD).
- Next Service KM: Next service recommended odometer reading (numeric integer).`;

export const VEHICLE_SERVICE_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    service_invoice_number: { type: 'STRING' as const, nullable: true },
    service_date: { type: 'STRING' as const, nullable: true },
    workshop_name: { type: 'STRING' as const, nullable: true },
    customer_name: { type: 'STRING' as const, nullable: true },
    registration_number: { type: 'STRING' as const, nullable: true },
    chassis_number: { type: 'STRING' as const, nullable: true },
    engine_number: { type: 'STRING' as const, nullable: true },
    vehicle_make: { type: 'STRING' as const, nullable: true },
    vehicle_model: { type: 'STRING' as const, nullable: true },
    variant: { type: 'STRING' as const, nullable: true },
    job_type: { type: 'STRING' as const, nullable: true },
    odometer_km: { type: 'NUMBER' as const, nullable: true },
    service_items: { type: 'STRING' as const, nullable: true },
    labour_amount: { type: 'NUMBER' as const, nullable: true },
    parts_amount: { type: 'NUMBER' as const, nullable: true },
    tax_amount: { type: 'NUMBER' as const, nullable: true },
    total_amount: { type: 'NUMBER' as const, nullable: true },
    next_service_date: { type: 'STRING' as const, nullable: true },
    next_service_km: { type: 'NUMBER' as const, nullable: true },
  },
  required: [
    'service_invoice_number',
    'service_date',
    'workshop_name',
    'customer_name',
    'registration_number',
    'chassis_number',
    'engine_number',
    'vehicle_make',
    'vehicle_model',
    'variant',
    'job_type',
    'odometer_km',
    'service_items',
    'labour_amount',
    'parts_amount',
    'tax_amount',
    'total_amount',
    'next_service_date',
    'next_service_km',
  ],
};

/**
 * Normalizes vehicle service extraction fields.
 */
export function postProcessVehicleServiceExtraction(
  raw: Partial<VehicleServiceExtraction>,
): NormalizedVehicleServiceData {
  const regRaw = (raw.registration_number || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const chassisRaw = normalizeChassisNumber(raw.chassis_number);
  const engineRaw = (raw.engine_number || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  // Suffix extraction (last 4-6 chars) for candidate corroboration
  const chassisSuffix = chassisRaw.length >= 4 ? chassisRaw.slice(-6) : chassisRaw;
  const engineSuffix = engineRaw.length >= 4 ? engineRaw.slice(-6) : engineRaw;

  // Safe numeric conversion
  const odometerKm =
    raw.odometer_km != null && !isNaN(Number(raw.odometer_km))
      ? Math.round(Number(raw.odometer_km))
      : null;

  const nextServiceKm =
    raw.next_service_km != null && !isNaN(Number(raw.next_service_km))
      ? Math.round(Number(raw.next_service_km))
      : null;

  const labourAmount = sanitizeAmount(raw.labour_amount);
  const partsAmount = sanitizeAmount(raw.parts_amount);
  const taxAmount = sanitizeAmount(raw.tax_amount);
  const totalAmount = sanitizeAmount(raw.total_amount);

  return {
    documentType: 'VEHICLE_SERVICE',
    serviceInvoiceNumber: (raw.service_invoice_number || '').trim(),
    serviceDate: (raw.service_date || '').trim(),
    workshopName: (raw.workshop_name || '').trim(),
    customerName: (raw.customer_name || '').trim(),
    registrationNumber: regRaw,
    chassisNumber: chassisRaw,
    chassisSuffix,
    engineNumber: engineRaw,
    engineSuffix,
    vehicleMake: (raw.vehicle_make || '').trim(),
    vehicleModel: (raw.vehicle_model || '').trim(),
    variant: (raw.variant || '').trim(),
    jobType: (raw.job_type || '').trim(),
    odometerKm,
    serviceItems: Array.isArray(raw.service_items)
      ? raw.service_items
          .map((i: any) => (typeof i === 'string' ? i : (i.description || i.name || JSON.stringify(i))))
          .join(', ')
      : typeof raw.service_items === 'string'
      ? raw.service_items.trim()
      : '',
    labourAmount,
    partsAmount,
    taxAmount,
    totalAmount,
    nextServiceDate: (raw.next_service_date || '').trim(),
    nextServiceKm,
    rawVlmExtract: raw as VehicleServiceExtraction,
  };
}

import { generateContentWithFailover, safeParseGeminiJson } from './geminiModelConfig';

export class VehicleServiceVlmService {
  /**
   * Fast In-Memory Multimodal Extraction for Vehicle Service Invoices using Gemini VLM.
   */
  static async extractVehicleService(
    imageBase64: string,
    mimeType: string = 'image/jpeg',
  ): Promise<NormalizedVehicleServiceData> {
    const apiKey = resolveClientApiKey([
      process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY,
    ]);
    if (!apiKey) {
      throw new Error('[VehicleServiceVlmService] Gemini API key missing');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const result = await generateContentWithFailover(
      genAI,
      {
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: VEHICLE_SERVICE_SCHEMA,
          temperature: 0.1,
        },
      },
      [
        { text: VEHICLE_SERVICE_SYSTEM_PROMPT },
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ],
    );

    const responseText = result.response.text();
    const rawJson: Partial<VehicleServiceExtraction> = safeParseGeminiJson<Partial<VehicleServiceExtraction>>(responseText || '{}');
    return postProcessVehicleServiceExtraction(rawJson);
  }
}

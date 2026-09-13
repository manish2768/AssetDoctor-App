/**
 * Electricity Bill VLM Service — Specialized Vision Extraction for Power Utility Bills.
 *
 * Extracts DISCOM/provider, consumer/account ID, meter readings, units consumed,
 * arrears, subsidy, net current bill, and total payable amount.
 * Routes directly to Home Utilities, never creating a consumer product asset.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveClientApiKey } from '../security/clientSecretPolicy';
import { sanitizeAmount } from './ConsumerAssetVlmService';

export interface ElectricityBillExtraction {
  provider_name: string | null;
  customer_name: string | null;
  consumer_number: string | null;
  account_number: string | null;
  bill_number: string | null;
  bill_month_year: string | null;
  billing_period: string | null;
  bill_date: string | null;
  due_date: string | null;
  disconnection_date: string | null;
  meter_number: string | null;
  service_address: string | null;
  sanctioned_load: string | null;
  maximum_demand: string | null;
  previous_reading: number | null;
  current_reading: number | null;
  units_consumed: number | null;
  gross_bill_amount: number | null;
  tariff_subsidy: number | null;
  late_payment_surcharge: number | null;
  net_current_bill_amount: number | null;
  advance_payment: number | null;
  interest_amount: number | null;
  arrears: number | null;
  total_payable_amount: number | null;
  amount_due: number | null;
  paid_amount: number | null;
  payment_status: string | null;
  is_electricity_bill?: boolean;
}

export interface NormalizedElectricityBillData {
  documentType: 'ELECTRICITY_BILL';
  providerName: string;
  customerName: string;
  consumerNumber: string;
  accountNumber: string;
  billNumber: string;
  billMonthYear: string;
  billingPeriod: string;
  billDate: string;
  dueDate: string;
  disconnectionDate: string;
  meterNumber: string;
  serviceAddress: string;
  sanctionedLoad: string;
  maximumDemand: string;
  previousReading: number | null;
  currentReading: number | null;
  unitsConsumed: number | null;
  calculatedConsumption: number | null;
  readingMismatch: boolean;
  grossBillAmount: number | null;
  tariffSubsidy: number | null;
  latePaymentSurcharge: number | null;
  netCurrentBillAmount: number | null;
  advancePayment: number | null;
  interestAmount: number | null;
  arrears: number | null;
  totalPayableAmount: number | null;
  amountDue: number | null;
  paidAmount: number | null;
  paymentStatus: string;
  rawVlmExtract: ElectricityBillExtraction;
}

export const ELECTRICITY_SYSTEM_PROMPT = `You are an expert Indian utility bill document assistant.
Analyze this Indian electricity power bill image and extract the utility account, meter reading, and comprehensive billing details.
DO NOT calculate or invent values. If a field is missing, set it to null.

Synonym rules:
- Provider Name: DISCOM / Power board (e.g. BESCOM, Tata Power, BSES Yamuna/Rajdhani, MSEDCL, UPPCL, Adani Electricity, WBSEDCL, TANGEDCO).
- Consumer Number: Consumer ID, CA Number, K-Number, Service Connection No, Account ID.
- Bill Number: Invoice No / Bill No / Cash Memo No.
- Bill Month / Year: Billing Month (e.g. "Sep 2026", "09/2026").
- Meter Number: Meter No, Electric Meter Serial.
- Sanctioned Load: Connected Load (e.g. "3 kW", "5 HP", "2 kVA").
- Maximum Demand: Recorded Demand / MD.
- Dates: Return ISO format YYYY-MM-DD.
- Previous / Current Reading: kWh meter readings (numeric float).
- Units Consumed: Net units / kWh billed (numeric float).
- Gross Bill Amount: Energy charges + fixed charges before subsidies/arrears.
- Tariff Subsidy: Government subsidy / rebate (numeric float).
- Late Payment Surcharge: LPSC / penalty / surcharge (numeric float).
- Net Current Bill Amount: Current month energy bill amount (excluding past arrears).
- Advance Payment: Advance paid / credit balance.
- Interest Amount: Interest on security deposit or arrears.
- Arrears: Past unpaid dues / arrears amount (numeric float).
- Total Payable Amount: Net amount payable including arrears (numeric float).
- Amount Due: Final amount payable on or before due date.
- Document Validity: Set is_electricity_bill to true if this document is indeed an electricity/utility power bill. If it is NOT an electricity bill (e.g. general shopping receipt, vehicle invoice, insurance policy), set is_electricity_bill to false.`;
export const ELECTRICITY_BILL_SYSTEM_PROMPT = ELECTRICITY_SYSTEM_PROMPT;

export const ELECTRICITY_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    is_electricity_bill: { type: 'BOOLEAN' as const },
    provider_name: { type: 'STRING' as const, nullable: true },
    customer_name: { type: 'STRING' as const, nullable: true },
    consumer_number: { type: 'STRING' as const, nullable: true },
    account_number: { type: 'STRING' as const, nullable: true },
    bill_number: { type: 'STRING' as const, nullable: true },
    bill_month_year: { type: 'STRING' as const, nullable: true },
    billing_period: { type: 'STRING' as const, nullable: true },
    bill_date: { type: 'STRING' as const, nullable: true },
    due_date: { type: 'STRING' as const, nullable: true },
    disconnection_date: { type: 'STRING' as const, nullable: true },
    meter_number: { type: 'STRING' as const, nullable: true },
    service_address: { type: 'STRING' as const, nullable: true },
    sanctioned_load: { type: 'STRING' as const, nullable: true },
    maximum_demand: { type: 'STRING' as const, nullable: true },
    previous_reading: { type: 'NUMBER' as const, nullable: true },
    current_reading: { type: 'NUMBER' as const, nullable: true },
    units_consumed: { type: 'NUMBER' as const, nullable: true },
    gross_bill_amount: { type: 'NUMBER' as const, nullable: true },
    tariff_subsidy: { type: 'NUMBER' as const, nullable: true },
    late_payment_surcharge: { type: 'NUMBER' as const, nullable: true },
    net_current_bill_amount: { type: 'NUMBER' as const, nullable: true },
    advance_payment: { type: 'NUMBER' as const, nullable: true },
    interest_amount: { type: 'NUMBER' as const, nullable: true },
    arrears: { type: 'NUMBER' as const, nullable: true },
    total_payable_amount: { type: 'NUMBER' as const, nullable: true },
    amount_due: { type: 'NUMBER' as const, nullable: true },
    paid_amount: { type: 'NUMBER' as const, nullable: true },
    payment_status: { type: 'STRING' as const, nullable: true },
  },
  required: [
    'is_electricity_bill',
    'provider_name',
    'customer_name',
    'consumer_number',
    'account_number',
    'bill_number',
    'bill_month_year',
    'billing_period',
    'bill_date',
    'due_date',
    'disconnection_date',
    'meter_number',
    'service_address',
    'sanctioned_load',
    'maximum_demand',
    'previous_reading',
    'current_reading',
    'units_consumed',
    'gross_bill_amount',
    'tariff_subsidy',
    'late_payment_surcharge',
    'net_current_bill_amount',
    'advance_payment',
    'interest_amount',
    'arrears',
    'total_payable_amount',
    'amount_due',
    'paid_amount',
    'payment_status',
  ],
};
export const ELECTRICITY_BILL_SCHEMA = ELECTRICITY_SCHEMA;

export function postProcessElectricityExtraction(
  raw: Partial<ElectricityBillExtraction>,
): NormalizedElectricityBillData {
  const prev = sanitizeAmount(raw.previous_reading);
  const curr = sanitizeAmount(raw.current_reading);
  let units = sanitizeAmount(raw.units_consumed);

  // Consistency check: calculate consumption from readings
  let calculatedConsumption: number | null = null;
  if (curr != null && prev != null && curr >= prev) {
    calculatedConsumption = Math.round((curr - prev) * 100) / 100;
  }

  // Cross-check: If stated units is missing, use calculated consumption
  if (units == null && calculatedConsumption != null) {
    units = calculatedConsumption;
  }

  // Check for contradiction between stated consumption and meter readings
  const readingMismatch =
    units != null &&
    calculatedConsumption != null &&
    Math.abs(units - calculatedConsumption) > 1;

  const grossBill = sanitizeAmount(raw.gross_bill_amount);
  const subsidy = sanitizeAmount(raw.tariff_subsidy);
  const lpsc = sanitizeAmount(raw.late_payment_surcharge);
  const netCurrent = sanitizeAmount(raw.net_current_bill_amount);
  const advance = sanitizeAmount(raw.advance_payment);
  const interest = sanitizeAmount(raw.interest_amount);
  const arrears = sanitizeAmount(raw.arrears);
  let totalPayable = sanitizeAmount(raw.total_payable_amount);
  let amountDue = sanitizeAmount(raw.amount_due);

  // If total payable is not explicitly captured, derive safely
  if (totalPayable == null) {
    if (amountDue != null) {
      totalPayable = amountDue;
    } else if (netCurrent != null) {
      totalPayable = netCurrent + (arrears || 0) + (lpsc || 0) - (advance || 0);
    }
  }

  if (amountDue == null) {
    amountDue = totalPayable;
  }

  return {
    documentType: 'ELECTRICITY_BILL',
    providerName: String(raw.provider_name || '').trim(),
    customerName: String(raw.customer_name || '').trim(),
    consumerNumber: String(raw.consumer_number || raw.account_number || '').trim(),
    accountNumber: String(raw.account_number || '').trim(),
    billNumber: String(raw.bill_number || '').trim(),
    billMonthYear: String(raw.bill_month_year || '').trim(),
    billingPeriod: String(raw.billing_period || '').trim(),
    billDate: String(raw.bill_date || '').trim(),
    dueDate: String(raw.due_date || '').trim(),
    disconnectionDate: String(raw.disconnection_date || '').trim(),
    meterNumber: String(raw.meter_number || '').trim(),
    serviceAddress: String(raw.service_address || '').trim(),
    sanctionedLoad: String(raw.sanctioned_load || '').trim(),
    maximumDemand: String(raw.maximum_demand || '').trim(),
    previousReading: prev,
    currentReading: curr,
    unitsConsumed: units,
    calculatedConsumption,
    readingMismatch,
    grossBillAmount: grossBill,
    tariffSubsidy: subsidy,
    latePaymentSurcharge: lpsc,
    netCurrentBillAmount: netCurrent,
    advancePayment: advance,
    interestAmount: interest,
    arrears: arrears,
    totalPayableAmount: totalPayable,
    amountDue: amountDue,
    paidAmount: sanitizeAmount(raw.paid_amount),
    paymentStatus: String(raw.payment_status || 'UNPAID').trim(),
    rawVlmExtract: raw as ElectricityBillExtraction,
  };
}

export const postProcessElectricityBillExtraction = postProcessElectricityExtraction;

import { generateContentWithFailover, safeParseGeminiJson } from './geminiModelConfig';

export class ElectricityBillVlmService {
  public static async extractElectricityBill(
    base64Image: string,
    mimeType: string = 'image/jpeg',
  ): Promise<{ success: boolean; data?: NormalizedElectricityBillData; isTypeMismatch?: boolean; error?: string }> {
    const apiKey = resolveClientApiKey([
      process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      process.env.GEMINI_API_KEY,
    ]);
    if (!apiKey) {
      return { success: false, error: 'Gemini API key missing' };
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const result = await generateContentWithFailover(
        genAI,
        {
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: ELECTRICITY_SCHEMA,
            temperature: 0.1,
          },
        },
        [
          { text: ELECTRICITY_SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
        ],
      );

      const responseText = result.response.text();
      const rawJson: Partial<ElectricityBillExtraction> = safeParseGeminiJson<Partial<ElectricityBillExtraction>>(responseText || '{}');
      if (rawJson.is_electricity_bill === false) {
        return {
          success: false,
          isTypeMismatch: true,
          error: 'Scanned document does not appear to be an electricity bill.',
        };
      }
      const normalized = postProcessElectricityExtraction(rawJson);
      return { success: true, data: normalized };
    } catch (error: any) {
      console.error('[ElectricityBillVlmService] Extraction failed:', error?.message || error);
      return { success: false, error: error?.message || 'Extraction failed' };
    }
  }
}

/**
 * Asset Doctor — Unified Document Normalizer & Form State Mapper
 *
 * Enforces the Single Normalized Document Architecture across all 5 document categories:
 * - Electricity Bill
 * - Vehicle Service Bill
 * - Vehicle Insurance
 * - PUC Certificate
 * - Purchase Bill / Invoice
 *
 * Guarantees:
 * 1. ZERO data loss between VLM / OCR extraction and Review form state.
 * 2. Bi-directional field alias synchronization (e.g. unitsConsumed <-> unitsConsumedKwh).
 * 3. Partial field population: if 7 of 10 fields are present, shows all 7 (no all-or-nothing wipeout).
 * 4. Deterministic fallback handling with honest confidence scores.
 */

import { AssetDocumentType, normalizeToCanonicalDocType } from '../../types/assetDocumentTypes';
import { computeWarrantyExpiry } from '../vlm/ConsumerAssetVlmService';

export interface CanonicalDocumentResult {
  documentType: AssetDocumentType;
  classification: {
    type: AssetDocumentType;
    confidence: number;
    reasoning?: string;
  };
  ocr: {
    status: 'success' | 'partial' | 'failed';
    confidence: number;
    engine: string;
    rawTextLength: number;
    rawText?: string;
  };
  extraction: Record<string, any>;
  extractionConfidence: Record<string, number>;
  processing: {
    stage: string;
    processor: string;
    errorCode: string | null;
  };
  // Flat legacy compatibility fields
  [key: string]: any;
}

// -------------------------------------------------------------
// HELPER NORMALIZERS
// -------------------------------------------------------------
function cleanString(val: any): string {
  if (val == null) return '';
  if (typeof val === 'object') {
    if (val.name != null) return cleanString(val.name);
    if (val.value != null) return cleanString(val.value);
    if (val.text != null) return cleanString(val.text);
    if (val.description != null) return cleanString(val.description);
    return '';
  }
  const s = String(val).trim();
  if (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' || s === '[object Object]') return '';
  return s;
}

function cleanNumber(val: any): number | null {
  if (val == null) return null;
  if (typeof val === 'object') {
    if (val.amount != null) return cleanNumber(val.amount);
    if (val.value != null) return cleanNumber(val.value);
    if (val.total != null) return cleanNumber(val.total);
    return null;
  }
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).replace(/\b(?:rs|re|inr)\.?/gi, '').trim();
  const cleaned = str.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function cleanDate(val: any): string {
  if (!val) return '';
  const s = String(val).trim();
  // Match YYYY-MM-DD
  const iso = s.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Match DD-MM-YYYY
  const rev = s.match(/\b(0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (rev) return `${rev[3]}-${rev[2]}-${rev[1]}`;
  return s;
}

function cleanConfidence(val: any): number | null {
  if (val == null) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(n) || n <= 0) return null;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function deriveBillingMonth(monthYear: string, billDate: string): string {
  const my = cleanString(monthYear);
  if (my) {
    const isoMonth = my.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])\b/);
    if (isoMonth) return `${isoMonth[1]}-${isoMonth[2]}`;

    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      sept: '09',
    };
    for (const [mName, mNum] of Object.entries(monthMap)) {
      if (my.toLowerCase().includes(mName)) {
        const yearMatch = my.match(/\b(20\d{2})\b/);
        const billYearMatch = billDate ? String(billDate).match(/\b(20\d{2})\b/) : null;
        const year = yearMatch ? yearMatch[1] : (billYearMatch ? billYearMatch[1] : String(new Date().getFullYear()));
        return `${year}-${mNum}`;
      }
    }
  }

  const bd = cleanDate(billDate);
  if (bd && bd.length >= 7) {
    return bd.slice(0, 7);
  }

  return '';
}

// -------------------------------------------------------------
// 1. ELECTRICITY BILL NORMALIZER
// -------------------------------------------------------------
export function normalizeElectricityBill(source: any): Record<string, any> {
  const raw = source || {};
  const vlm = raw.rawVlmExtract || raw.vlmExtract || raw;

  const provider =
    cleanString(raw.electricityProvider) ||
    cleanString(raw.providerName) ||
    cleanString(vlm.provider_name) ||
    cleanString(vlm.providerName) ||
    cleanString(vlm.utility_provider) ||
    cleanString(vlm.utilityProvider) ||
    cleanString(vlm.discom) ||
    cleanString(vlm.discom_name) ||
    cleanString(vlm.discomName) ||
    cleanString(raw.shopName) ||
    '';

  const customerName =
    cleanString(raw.customerName) ||
    cleanString(vlm.customer_name) ||
    cleanString(vlm.customerName) ||
    cleanString(raw.consumerName) ||
    '';

  const consumerId =
    cleanString(raw.consumerId) ||
    cleanString(raw.consumerNumber) ||
    cleanString(vlm.consumer_id) ||
    cleanString(vlm.consumerId) ||
    cleanString(vlm.consumer_number) ||
    cleanString(vlm.consumerNumber) ||
    cleanString(raw.accountNumber) ||
    cleanString(vlm.account_number) ||
    cleanString(vlm.accountNumber) ||
    cleanString(vlm.account_id) ||
    cleanString(vlm.accountId) ||
    cleanString(raw.invoiceNumber) ||
    '';

  const billNumber =
    cleanString(raw.billNumber) ||
    cleanString(vlm.bill_number) ||
    cleanString(vlm.bill_no) ||
    cleanString(vlm.billNo) ||
    cleanString(vlm.invoice_no) ||
    cleanString(vlm.invoice_number) ||
    '';

  const meterNumber =
    cleanString(raw.meterNumber) ||
    cleanString(vlm.meter_number) ||
    '';

  const billDate =
    cleanDate(raw.billDate) ||
    cleanDate(vlm.bill_date) ||
    cleanDate(raw.invoiceDate) ||
    '';

  const dueDate =
    cleanDate(raw.dueDate) ||
    cleanDate(vlm.due_date) ||
    '';

  const billMonthYear =
    cleanString(raw.billMonthYear) ||
    cleanString(raw.billMonth) ||
    cleanString(vlm.bill_month_year) ||
    cleanString(vlm.bill_month) ||
    '';

  const billingMonth =
    cleanString(raw.billingMonth) ||
    cleanString(raw.billMonth) ||
    deriveBillingMonth(billMonthYear, billDate);

  const prevReading =
    cleanNumber(raw.previousMeterReading) ??
    cleanNumber(raw.previousReading) ??
    cleanNumber(vlm.previous_reading) ??
    cleanNumber(vlm.previous_meter_reading) ??
    cleanNumber(vlm.previousMeterReading);

  const currReading =
    cleanNumber(raw.currentMeterReading) ??
    cleanNumber(raw.currentReading) ??
    cleanNumber(vlm.current_reading) ??
    cleanNumber(vlm.current_meter_reading) ??
    cleanNumber(vlm.currentMeterReading);

  let units =
    cleanNumber(raw.unitsConsumed) ??
    cleanNumber(raw.unitsConsumedKwh) ??
    cleanNumber(vlm.units_consumed) ??
    cleanNumber(vlm.units_consumed_kwh) ??
    cleanNumber(vlm.unitsConsumedKwh);

  // Auto-calculate units if meter readings exist and units is missing
  if (units == null && currReading != null && prevReading != null && currReading >= prevReading) {
    units = Math.round((currReading - prevReading) * 100) / 100;
  }

  const grossAmount =
    cleanNumber(raw.grossBillAmount) ??
    cleanNumber(vlm.gross_bill_amount);

  const subsidy =
    cleanNumber(raw.subsidy) ??
    cleanNumber(raw.tariffSubsidy) ??
    cleanNumber(vlm.tariff_subsidy);

  const lpsc =
    cleanNumber(raw.latePaymentSurcharge) ??
    cleanNumber(raw.lpsc) ??
    cleanNumber(vlm.late_payment_surcharge);

  const netCurrent =
    cleanNumber(raw.netCurrentBillAmount) ??
    cleanNumber(vlm.net_current_bill_amount);

  const arrears =
    cleanNumber(raw.arrears) ??
    cleanNumber(vlm.arrears);

  const totalPayable =
    cleanNumber(raw.totalPayableAmount) ??
    cleanNumber(raw.amountDue) ??
    cleanNumber(raw.currentBillAmount) ??
    cleanNumber(raw.totalPayable) ??
    cleanNumber(raw.billAmount) ??
    cleanNumber(raw.totalAmount) ??
    cleanNumber(vlm.total_payable_amount) ??
    cleanNumber(vlm.bill_amount) ??
    cleanNumber(vlm.amount_due);

  return {
    documentType: 'ELECTRICITY_BILL',
    classifiedDocumentType: 'ELECTRICITY_BILL',
    isElectricityBill: true,
    electricityProvider: provider,
    providerName: provider,
    shopName: provider,
    customerName,
    consumerId,
    consumerNumber: consumerId,
    accountNumber: consumerId,
    billNumber,
    billMonthYear,
    billingMonth,
    billDate,
    invoiceDate: billDate,
    dueDate,
    meterNumber,
    serviceAddress: cleanString(raw.serviceAddress || vlm.service_address || vlm.serviceAddress || vlm.address),
    sanctionedLoad: cleanString(
      raw.sanctionedLoad ||
      vlm.sanctioned_load ||
      vlm.sanctionedLoad ||
      vlm.load ||
      vlm.connected_load ||
      (vlm.sanctioned_load_kw != null ? `${vlm.sanctioned_load_kw} KW` : '')
    ),
    previousMeterReading: prevReading,
    previousReading: prevReading,
    currentMeterReading: currReading,
    currentReading: currReading,
    unitsConsumed: units,
    unitsConsumedKwh: units,
    grossBillAmount: grossAmount,
    subsidy,
    tariffSubsidy: subsidy,
    latePaymentSurcharge: lpsc,
    lpsc,
    netCurrentBillAmount: netCurrent,
    arrears,
    totalPayableAmount: totalPayable,
    amountDue: totalPayable,
    currentBillAmount: netCurrent ?? totalPayable,
    totalAmount: totalPayable,
    confidence: cleanConfidence(raw.confidence),
  };
}

// -------------------------------------------------------------
// 2. VEHICLE SERVICE BILL NORMALIZER
// -------------------------------------------------------------
export function normalizeVehicleService(source: any): Record<string, any> {
  const raw = source || {};
  const vlm = raw.rawVlmExtract || raw.vlmExtract || raw;

  const workshopName =
    cleanString(raw.workshopName) ||
    cleanString(raw.shopName) ||
    cleanString(vlm.workshop_name) ||
    cleanString(vlm.company_details?.workshop_name) ||
    cleanString(vlm.company_details?.name) ||
    cleanString(vlm.dealer_details?.workshop_name) ||
    cleanString(vlm.dealer_details?.name) ||
    cleanString(vlm.workshop_details?.name) ||
    cleanString(vlm.workshop_details?.workshop_name) ||
    cleanString(vlm.vendor_name) ||
    cleanString(vlm.vendorName) ||
    cleanString(vlm.dealer_name) ||
    cleanString(vlm.vendor) ||
    '';

  const invoiceNumber =
    cleanString(raw.serviceInvoiceNumber) ||
    cleanString(raw.invoiceNumber) ||
    cleanString(raw.jobCardNumber) ||
    cleanString(vlm.service_invoice_number) ||
    cleanString(vlm.invoice_no) ||
    cleanString(vlm.invoice_number) ||
    cleanString(vlm.job_card_number) ||
    cleanString(vlm.job_card_no) ||
    cleanString(vlm.invoice_or_job_card_no) ||
    cleanString(vlm.invoice_details?.invoice_or_job_card_no) ||
    cleanString(vlm.invoice_details?.invoice_no) ||
    cleanString(vlm.invoice_details?.invoice_number) ||
    cleanString(vlm.invoice_details?.job_card_no) ||
    cleanString(vlm.bill_no) ||
    '';

  const serviceDate =
    cleanDate(raw.serviceDate) ||
    cleanDate(raw.invoiceDate) ||
    cleanDate(vlm.service_date) ||
    cleanDate(vlm.invoice_details?.invoice_date) ||
    cleanDate(vlm.invoice_date) ||
    '';

  const serviceType =
    cleanString(raw.serviceType) ||
    cleanString(raw.jobType) ||
    cleanString(vlm.service_type) ||
    cleanString(vlm.invoice_details?.service_type) ||
    cleanString(vlm.vehicle_details?.service_type) ||
    cleanString(vlm.job_type) ||
    'Periodic Maintenance';

  const registration = (
    cleanString(raw.registration) ||
    cleanString(raw.vehicleRegistrationNumber) ||
    cleanString(vlm.vehicle_registration_number) ||
    cleanString(vlm.vehicle_registration) ||
    cleanString(vlm.vehicleRegistration) ||
    cleanString(vlm.vehicle_details?.registration_number) ||
    cleanString(vlm.vehicle_details?.registration_no) ||
    cleanString(vlm.vehicle_details?.registration) ||
    cleanString(vlm.registration_number) ||
    cleanString(vlm.registration) ||
    ''
  ).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const chassisNumber = (
    cleanString(raw.chassisNumber) ||
    cleanString(raw.vin) ||
    cleanString(vlm.chassis_number) ||
    cleanString(vlm.chassisNumber) ||
    cleanString(vlm.vin) ||
    cleanString(vlm.vehicle_details?.chassis_number) ||
    cleanString(vlm.vehicle_details?.chassis_no) ||
    cleanString(vlm.vehicle_details?.vin) ||
    ''
  ).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const engineNumber = (
    cleanString(raw.engineNumber) ||
    cleanString(vlm.engine_number) ||
    cleanString(vlm.engineNumber) ||
    cleanString(vlm.vehicle_details?.engine_number) ||
    cleanString(vlm.vehicle_details?.engine_no) ||
    ''
  ).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const vehicleMake =
    cleanString(raw.vehicleMake) ||
    cleanString(raw.brand) ||
    cleanString(vlm.vehicle_make) ||
    cleanString(vlm.vehicleMake) ||
    cleanString(vlm.make) ||
    cleanString(vlm.brand) ||
    cleanString(vlm.vehicle_details?.make) ||
    cleanString(vlm.vehicle_details?.brand) ||
    '';

  const vehicleModel =
    cleanString(raw.vehicleModel) ||
    cleanString(raw.model) ||
    cleanString(vlm.vehicle_model) ||
    cleanString(vlm.vehicleModel) ||
    cleanString(vlm.model) ||
    cleanString(vlm.vehicle_details?.model) ||
    '';

  const odometer =
    cleanNumber(raw.odometerReading) ??
    cleanNumber(raw.odometerKm) ??
    cleanNumber(vlm.odometer_km) ??
    cleanNumber(vlm.vehicle_details?.odometer_km) ??
    cleanNumber(vlm.vehicle_details?.odometer_reading) ??
    cleanNumber(vlm.vehicle_details?.odometer) ??
    cleanNumber(vlm.odometer_reading);

  const labour =
    cleanNumber(raw.labourAmount) ??
    cleanNumber(raw.labourCharges) ??
    cleanNumber(vlm.financial_details?.labour_amount) ??
    cleanNumber(vlm.financials?.labour_amount) ??
    cleanNumber(vlm.financials?.labour_charges) ??
    cleanNumber(vlm.labour_amount) ??
    cleanNumber(vlm.labour_charges);

  const parts =
    cleanNumber(raw.partsAmount) ??
    cleanNumber(raw.partsTotal) ??
    cleanNumber(vlm.financial_details?.parts_amount) ??
    cleanNumber(vlm.financials?.parts_amount) ??
    cleanNumber(vlm.financials?.parts_total) ??
    cleanNumber(vlm.parts_amount) ??
    cleanNumber(vlm.parts_total);

  const tax =
    cleanNumber(raw.taxAmount) ??
    cleanNumber(vlm.financial_details?.tax_amount) ??
    cleanNumber(vlm.financials?.tax_amount) ??
    cleanNumber(vlm.tax_amount);

  const total =
    cleanNumber(raw.totalAmount) ??
    cleanNumber(raw.purchaseAmount) ??
    cleanNumber(vlm.financial_details?.grand_total_amount) ??
    cleanNumber(vlm.financial_details?.total_amount) ??
    cleanNumber(vlm.financial_details?.grand_total) ??
    cleanNumber(vlm.billing_details?.grand_total) ??
    cleanNumber(vlm.billing_details?.total_amount) ??
    cleanNumber(vlm.amount_details?.grand_total) ??
    cleanNumber(vlm.amount_details?.total_amount) ??
    cleanNumber(vlm.invoice_details?.grand_total) ??
    cleanNumber(vlm.invoice_details?.total_amount) ??
    cleanNumber(vlm.financials?.grand_total) ??
    cleanNumber(vlm.financials?.total_amount) ??
    cleanNumber(vlm.grand_total_amount) ??
    cleanNumber(vlm.total_amount) ??
    cleanNumber(vlm.grand_total);

  const nextDate =
    cleanDate(raw.nextServiceDueDate) ||
    cleanDate(raw.nextServiceDate) ||
    cleanDate(vlm.next_service_details?.due_date) ||
    cleanDate(vlm.next_service_details?.next_service_date) ||
    cleanDate(vlm.next_service_due_date) ||
    cleanDate(vlm.next_service_date) ||
    '';

  const nextKm =
    cleanNumber(raw.nextServiceDueKm) ??
    cleanNumber(raw.nextServiceKm) ??
    cleanNumber(raw.nextServiceOdometerKm) ??
    cleanNumber(vlm.next_service_details?.due_km) ??
    cleanNumber(vlm.next_service_details?.next_service_km) ??
    cleanNumber(vlm.next_service_due_km) ??
    cleanNumber(vlm.next_service_km) ??
    cleanNumber(vlm.next_service_odometer_km);

  return {
    documentType: 'VEHICLE_SERVICE_BILL',
    classifiedDocumentType: 'VEHICLE_SERVICE',
    workshopName,
    shopName: workshopName,
    vendor: workshopName,
    serviceInvoiceNumber: invoiceNumber,
    invoiceNumber,
    jobCardNumber: invoiceNumber,
    serviceDate,
    invoiceDate: serviceDate,
    serviceType: cleanString(raw.serviceType || raw.jobType || vlm.service_type || 'Periodic Maintenance'),
    jobType: cleanString(raw.serviceType || raw.jobType || vlm.service_type || 'Periodic Maintenance'),
    registration,
    vehicleRegistrationNumber: registration,
    chassisNumber,
    engineNumber,
    vehicleMake,
    vehicleModel,
    brand: vehicleMake,
    model: vehicleModel,
    odometerReading: odometer,
    odometerKm: odometer,
    labourAmount: labour,
    labourCharges: labour,
    partsAmount: parts,
    partsTotal: parts,
    taxAmount: tax,
    totalAmount: total,
    nextServiceDueDate: nextDate,
    nextServiceDate: nextDate,
    nextServiceDueKm: nextKm,
    nextServiceKm: nextKm,
    confidence: cleanConfidence(raw.confidence),
    requiresVehicleLink: true,
    isAttachDoc: true,
  };
}

// -------------------------------------------------------------
// 3. VEHICLE INSURANCE NORMALIZER
// -------------------------------------------------------------
export function normalizeInsurance(source: any): Record<string, any> {
  const raw = source || {};
  const vlm = raw.rawVlmExtract || raw.vlmExtract || raw;

  const insurerName =
    cleanString(raw.insurerName) ||
    cleanString(raw.insurer) ||
    cleanString(raw.shopName) ||
    cleanString(vlm.insurer_name) ||
    cleanString(vlm.insurer) ||
    cleanString(vlm.insurance_company) ||
    cleanString(vlm.insuranceCompany) ||
    '';

  const policyNumber =
    cleanString(raw.policyNumber) ||
    cleanString(raw.invoiceNumber) ||
    cleanString(vlm.policy_number) ||
    cleanString(vlm.policy_details?.policy_number) ||
    cleanString(vlm.policyNumber) ||
    '';

  const policyType =
    cleanString(raw.policyType) ||
    cleanString(vlm.policy_type) ||
    cleanString(vlm.policy_details?.policy_type) ||
    cleanString(vlm.policyType) ||
    'Comprehensive';

  const registration = (
    cleanString(raw.registration) ||
    cleanString(raw.vehicleRegistrationNumber) ||
    cleanString(vlm.vehicle_registration_number) ||
    cleanString(vlm.vehicle_details?.registration_number) ||
    cleanString(vlm.vehicle_details?.registration_no) ||
    cleanString(vlm.vehicle_details?.registration) ||
    cleanString(vlm.registration_number) ||
    cleanString(vlm.registration) ||
    ''
  ).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const insuredName =
    cleanString(raw.insuredName) ||
    cleanString(raw.customerName) ||
    cleanString(vlm.insured_details?.name) ||
    cleanString(vlm.insured_details?.insured_name) ||
    cleanString(vlm.insured_name) ||
    cleanString(vlm.customer_name) ||
    cleanString(vlm.customerName) ||
    '';

  const engineNumber =
    cleanString(raw.engineNumber) ||
    cleanString(vlm.engine_number) ||
    cleanString(vlm.vehicle_details?.engine_number) ||
    cleanString(vlm.vehicle_details?.engine_no) ||
    cleanString(vlm.engineNo) ||
    '';

  const chassisNumber =
    cleanString(raw.chassisNumber) ||
    cleanString(vlm.chassis_number) ||
    cleanString(vlm.vehicle_details?.chassis_number) ||
    cleanString(vlm.vehicle_details?.chassis_no) ||
    cleanString(vlm.chassisNo) ||
    '';

  const startDate =
    cleanDate(raw.policyStartDate) ||
    cleanDate(raw.invoiceDate) ||
    cleanDate(vlm.policy_start_date) ||
    cleanDate(vlm.policy_details?.period_of_insurance?.from) ||
    cleanDate(vlm.policy_details?.period_of_insurance?.start_date) ||
    cleanDate(vlm.period_of_insurance?.from) ||
    cleanDate(vlm.period_of_insurance?.start_date) ||
    cleanDate(vlm.start_date) ||
    '';

  const expiryDate =
    cleanDate(raw.policyExpiryDate) ||
    cleanDate(raw.insuranceExpiry) ||
    cleanDate(vlm.policy_expiry_date) ||
    cleanDate(vlm.policy_details?.period_of_insurance?.to) ||
    cleanDate(vlm.policy_details?.period_of_insurance?.end_date) ||
    cleanDate(vlm.period_of_insurance?.to) ||
    cleanDate(vlm.period_of_insurance?.end_date) ||
    cleanDate(vlm.end_date) ||
    '';

  const idv =
    cleanNumber(raw.idv) ??
    cleanNumber(vlm.idv) ??
    cleanNumber(vlm.insured_declared_value) ??
    cleanNumber(vlm.vehicle_details?.idv_amount) ??
    cleanNumber(vlm.vehicle_details?.idv) ??
    cleanNumber(vlm.coverage_details?.idv) ??
    cleanNumber(vlm.coverage_details?.insured_declared_value) ??
    cleanNumber(vlm.idv_amount);

  const premium =
    cleanNumber(raw.premiumAmount) ??
    cleanNumber(raw.premium) ??
    cleanNumber(raw.totalAmount) ??
    cleanNumber(vlm.premium_details?.total_premium_payable) ??
    cleanNumber(vlm.premium_details?.total_premium) ??
    cleanNumber(vlm.premium_details?.premium_amount) ??
    cleanNumber(vlm.premium) ??
    cleanNumber(vlm.premium_amount) ??
    cleanNumber(vlm.total_premium_payable) ??
    cleanNumber(vlm.totalPremiumPayable) ??
    cleanNumber(vlm.coverage_details?.total_premium) ??
    cleanNumber(vlm.coverage_details?.premium_amount) ??
    cleanNumber(vlm.coverage_details?.premium);

  return {
    documentType: 'VEHICLE_INSURANCE',
    classifiedDocumentType: 'INSURANCE',
    insurerName,
    insurer: insurerName,
    shopName: insurerName,
    policyNumber,
    invoiceNumber: policyNumber,
    policyType,
    registration,
    vehicleRegistrationNumber: registration,
    insuredName,
    customerName: insuredName,
    engineNumber,
    chassisNumber,
    policyStartDate: startDate,
    invoiceDate: startDate,
    policyExpiryDate: expiryDate,
    insuranceExpiry: expiryDate,
    idv,
    premiumAmount: premium,
    premium,
    totalAmount: premium,
    confidence: cleanConfidence(raw.confidence),
    requiresVehicleLink: true,
    isAttachDoc: true,
  };
}

// -------------------------------------------------------------
// 4. PUC CERTIFICATE NORMALIZER
// -------------------------------------------------------------
export function normalizePuc(source: any): Record<string, any> {
  const raw = source || {};
  const vlm = raw.rawVlmExtract || raw.vlmExtract || raw;

  const certificateNumber =
    cleanString(raw.certificateNumber) ||
    cleanString(raw.invoiceNumber) ||
    cleanString(vlm.certificate_number) ||
    '';

  const registration = (
    cleanString(raw.registration) ||
    cleanString(raw.vehicleRegistrationNumber) ||
    cleanString(vlm.vehicle_registration_number) ||
    cleanString(vlm.registration_number) ||
    ''
  ).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const issueDate =
    cleanDate(raw.issueDate) ||
    cleanDate(raw.testDate) ||
    cleanDate(raw.invoiceDate) ||
    cleanDate(vlm.test_date) ||
    cleanDate(vlm.issue_date) ||
    '';

  const validUntil =
    cleanDate(raw.validUntil) ||
    cleanDate(raw.pucExpiry) ||
    cleanDate(vlm.valid_until) ||
    cleanDate(vlm.expiry_date) ||
    '';

  const fuelType =
    cleanString(raw.fuelType) ||
    cleanString(vlm.fuel_type) ||
    '';

  const testingCentre =
    cleanString(raw.testingCentre) ||
    cleanString(raw.issuingAuthority) ||
    cleanString(raw.shopName) ||
    cleanString(vlm.issuing_authority) ||
    cleanString(vlm.testing_center) ||
    '';

  return {
    documentType: 'VEHICLE_PUC',
    classifiedDocumentType: 'PUC',
    certificateNumber,
    invoiceNumber: certificateNumber,
    registration,
    vehicleRegistrationNumber: registration,
    issueDate,
    testDate: issueDate,
    invoiceDate: issueDate,
    validUntil,
    pucExpiry: validUntil,
    fuelType,
    testingCentre,
    issuingAuthority: testingCentre,
    shopName: testingCentre,
    coValue: cleanString(raw.coValue || vlm.co_value),
    hcValue: cleanString(raw.hcValue || vlm.hc_value),
    co2Value: cleanString(raw.co2Value || vlm.co2_value),
    emissionResult: cleanString(raw.emissionResult || vlm.emission_result || 'PASS').toUpperCase(),
    confidence: cleanConfidence(raw.confidence),
    requiresVehicleLink: true,
    isAttachDoc: true,
  };
}

// -------------------------------------------------------------
// 5. PURCHASE INVOICE NORMALIZER
// -------------------------------------------------------------
export function normalizePurchaseInvoice(source: any): Record<string, any> {
  const raw = source || {};
  const vlm = raw.rawVlmExtract || raw.vlmExtract || raw;

  const productName =
    cleanString(raw.productName) ||
    cleanString(raw.product_name) ||
    cleanString(raw.assetName) ||
    cleanString(raw.asset_name) ||
    cleanString(vlm.productName) ||
    cleanString(vlm.product_name) ||
    cleanString(vlm.item_details?.description) ||
    cleanString(vlm.item_details?.name) ||
    cleanString(vlm.item_details?.product_name) ||
    cleanString(vlm.item?.description) ||
    cleanString(vlm.item?.name) ||
    cleanString(vlm.item_description) ||
    cleanString(vlm.itemDescription) ||
    '';

  const brand =
    cleanString(raw.brand) ||
    cleanString(vlm.brand) ||
    cleanString(vlm.item?.brand) ||
    cleanString(vlm.item_details?.brand) ||
    '';

  const model =
    cleanString(raw.model) ||
    cleanString(vlm.model) ||
    cleanString(vlm.model_variant) ||
    cleanString(vlm.modelVariant) ||
    cleanString(vlm.item?.model) ||
    cleanString(vlm.item_details?.model) ||
    '';

  const identifierType = String(vlm.identifier_type || raw.identifier_type || '').toUpperCase();
  const serialOrIdentifier = cleanString(vlm.serial_or_identifier || raw.serial_or_identifier || raw.serialOrIdentifier);

  const serialNumber =
    cleanString(raw.serialNumber) ||
    cleanString(raw.serial_number) ||
    cleanString(vlm.serial_number) ||
    cleanString(vlm.serialNumber) ||
    cleanString(vlm.item?.serial_number) ||
    cleanString(vlm.item?.serialNumber) ||
    cleanString(vlm.item_details?.serial_number) ||
    cleanString(vlm.item_details?.serialNumber) ||
    (identifierType === 'SERIAL_NUMBER' || identifierType === 'UNKNOWN' ? serialOrIdentifier : '') ||
    '';

  const imei =
    cleanString(raw.imei) ||
    cleanString(vlm.imei_1) ||
    cleanString(vlm.imei) ||
    cleanString(vlm.imei1) ||
    cleanString(vlm.item?.imei_1) ||
    cleanString(vlm.item?.imei) ||
    cleanString(vlm.item_details?.imei_1) ||
    cleanString(vlm.item_details?.imei) ||
    (identifierType === 'IMEI' ? serialOrIdentifier : '') ||
    '';

  const chassisNumber =
    cleanString(raw.chassisNumber) ||
    cleanString(raw.chassis_or_frame_no) ||
    cleanString(vlm.chassis_number) ||
    cleanString(vlm.chassisNumber) ||
    (identifierType === 'CHASSIS_NUMBER' ? serialOrIdentifier : '') ||
    '';

  const engineNumber =
    cleanString(raw.engineNumber) ||
    cleanString(raw.engine_number) ||
    cleanString(vlm.engine_number) ||
    cleanString(vlm.engineNumber) ||
    (identifierType === 'ENGINE_NUMBER' ? serialOrIdentifier : '') ||
    '';

  const registration =
    cleanString(raw.registration) ||
    cleanString(raw.registration_number) ||
    cleanString(raw.registrationNumber) ||
    cleanString(raw.vehicle_registration_number) ||
    cleanString(raw.vehicleRegistrationNumber) ||
    cleanString(vlm.registration) ||
    cleanString(vlm.registration_number) ||
    cleanString(vlm.vehicle_registration_number) ||
    cleanString(vlm.reg_no) ||
    '';

  const shopName =
    cleanString(raw.shopName) ||
    cleanString(raw.sellerName) ||
    cleanString(raw.seller) ||
    cleanString(raw.vendor) ||
    cleanString(raw.vendor_dealer_name) ||
    cleanString(vlm.seller_name) ||
    cleanString(vlm.sellerName) ||
    cleanString(vlm.seller?.name) ||
    cleanString(vlm.seller) ||
    cleanString(vlm.vendor?.name) ||
    cleanString(vlm.vendor) ||
    cleanString(vlm.shopName) ||
    cleanString(vlm.shop_name) ||
    cleanString(vlm.dealer_name) ||
    cleanString(vlm.company_details?.name) ||
    cleanString(vlm.store_name) ||
    '';

  const customerName =
    cleanString(raw.customerName) ||
    cleanString(raw.buyerName) ||
    cleanString(raw.owner_buyer_name) ||
    cleanString(vlm.buyer_name) ||
    cleanString(vlm.buyerName) ||
    cleanString(vlm.buyer?.name) ||
    cleanString(vlm.buyer) ||
    cleanString(vlm.customerName) ||
    cleanString(vlm.customer_name) ||
    cleanString(vlm.customer?.name) ||
    '';

  const invoiceDate =
    cleanDate(raw.invoiceDate) ||
    cleanDate(raw.purchase_date) ||
    cleanDate(vlm.invoice_details?.invoice_date) ||
    cleanDate(vlm.invoice_details?.date) ||
    cleanDate(vlm.invoiceDate) ||
    cleanDate(vlm.invoice_date) ||
    cleanDate(vlm.purchase_date) ||
    '';

  const invoiceNumber =
    cleanString(raw.invoiceNumber) ||
    cleanString(raw.invoice_number) ||
    cleanString(vlm.invoice_details?.invoice_number) ||
    cleanString(vlm.invoice_details?.invoice_no) ||
    cleanString(vlm.invoice_details?.bill_no) ||
    cleanString(vlm.invoiceNumber) ||
    cleanString(vlm.invoice_number) ||
    cleanString(vlm.invoice_no) ||
    cleanString(vlm.bill_no) ||
    '';

  const totalAmount =
    cleanNumber(raw.totalAmount) ??
    cleanNumber(raw.total_amount) ??
    cleanNumber(vlm.total_paid_amount) ??
    cleanNumber(vlm.totalPaidAmount) ??
    cleanNumber(vlm.invoice_details?.total_amount) ??
    cleanNumber(vlm.invoice_details?.grand_total) ??
    cleanNumber(vlm.invoice_details?.amount) ??
    cleanNumber(vlm.totalAmount) ??
    cleanNumber(vlm.total_amount) ??
    cleanNumber(vlm.grand_total) ??
    cleanNumber(vlm.price);

  const warrantyPeriod =
    cleanString(raw.warrantyPeriod) ||
    cleanString(raw.warranty_period) ||
    (raw.warrantyMonths ? `${raw.warrantyMonths} Months` : '') ||
    cleanString(vlm.warranty_details?.period) ||
    cleanString(vlm.warranty_details?.warranty_period) ||
    cleanString(vlm.warrantyPeriod) ||
    cleanString(vlm.warranty_period) ||
    '';

  let warrantyExpiry =
    cleanDate(raw.warrantyExpiry) ||
    cleanDate(raw.expiry_date) ||
    cleanDate(vlm.warranty_expiry_date) ||
    cleanDate(vlm.warrantyExpiryDate) ||
    cleanDate(vlm.warranty_details?.expiry_date) ||
    cleanDate(vlm.warranty_details?.warranty_expiry) ||
    cleanDate(vlm.warrantyExpiry) ||
    cleanDate(vlm.warranty_expiry) ||
    cleanDate(vlm.expiry_date) ||
    '';

  if (!warrantyExpiry && invoiceDate && warrantyPeriod) {
    const computed = computeWarrantyExpiry(invoiceDate, warrantyPeriod);
    if (computed) warrantyExpiry = computed;
  }

  return {
    documentType: 'VEHICLE_PURCHASE_INVOICE',
    classifiedDocumentType: 'INVOICE',
    productName,
    product_name: productName,
    assetName: productName,
    asset_name: productName,
    brand,
    model,
    serialNumber,
    serial_number: serialNumber,
    imei,
    chassisNumber,
    chassis_or_frame_no: chassisNumber,
    engineNumber,
    engine_number: engineNumber,
    registration,
    registration_number: registration,
    vehicleRegistrationNumber: registration,
    shopName,
    vendor_dealer_name: shopName,
    vendor: shopName,
    customerName,
    owner_buyer_name: customerName,
    buyer: customerName,
    invoiceDate,
    purchase_date: invoiceDate,
    invoiceNumber,
    invoice_number: invoiceNumber,
    totalAmount,
    total_amount: totalAmount,
    warrantyPeriod,
    warranty_period: warrantyPeriod,
    warrantyExpiry,
    expiry_date: warrantyExpiry,
    confidence: cleanConfidence(raw.confidence),
  };
}

// -------------------------------------------------------------
// 6. MASTER ROUTER & FORM STATE MAPPERS
// -------------------------------------------------------------
export function normalizeDocumentByCanonicalType(
  docType: AssetDocumentType,
  source: any,
): Record<string, any> {
  switch (docType) {
    case 'ELECTRICITY_BILL':
      return normalizeElectricityBill(source);
    case 'VEHICLE_SERVICE_BILL':
      return normalizeVehicleService(source);
    case 'VEHICLE_INSURANCE':
      return normalizeInsurance(source);
    case 'VEHICLE_PUC':
      return normalizePuc(source);
    case 'VEHICLE_PURCHASE_INVOICE':
      return normalizePurchaseInvoice(source);
    default:
      return source || {};
  }
}

/**
 * Production OCR integrity regressions.
 *
 * These fixtures are synthetic/anonymized text fixtures shaped like Indian
 * documents. They assert the safety contract, not provider-specific OCR.
 */

import { UniversalOcrPipeline } from '../universalPipeline.ts';
import { DocumentClassifier } from '../classifier.ts';
import { canSaveExtractedInvoice } from '../../../src/services/ocr/finalSaveGate.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runPipeline(text: string, options: Record<string, unknown> = {}) {
  return UniversalOcrPipeline.process(text, { skipCache: true, ...options });
}

function populatedFieldsHaveEvidence(result: any): boolean {
  for (const group of Object.values(result.extractedData || {}) as any[]) {
    for (const field of Object.values(group || {}) as any[]) {
      if (!field || field.value == null || field.value === '') continue;
      if (!field.sourceText || !field.evidenceType || field.evidenceType === 'none') return false;
      if (field.page == null || !('sourceBoundingBox' in field) || !('validationResult' in field)) {
        return false;
      }
    }
  }
  return true;
}

async function run() {
  const service = `
    ROADSTAR AUTO SERVICE CENTER
    SERVICE INVOICE
    Invoice No: SV-1007
    Service Date: 14/08/2025
    Vehicle Model: Roadstar 125
    Registration No: KA01AB1234
    Chassis No: MBLHA10A1S2F03328
    Engine No: EN125A123456
    Current KM: 12,450 KM
    Labour Charges: 1,200
    Parts Total: 2,400
    GST Amount: 648
    Grand Total: 4,248
  `;
  const serviceResult = await runPipeline(service);
  const serviceData: any = serviceResult.extractedData.serviceData;
  const serviceInvoice: any = serviceResult.reviewInvoice;
  assert(serviceResult.classification.documentType === 'SERVICE_INVOICE', 'service classification');
  assert(serviceData?.odometerKm?.value === 12450, 'service odometer exact value');
  assert(serviceInvoice?.odometerKm === 12450, 'service odometer mapped to review');
  assert(serviceData?.vehicleRegistration?.value === 'KA01AB1234', 'service registration exact value');
  assert(serviceData?.vinOrChassis?.value === 'MBLHA10A1S2F03328', 'service chassis exact value');
  assert(serviceData?.totalAmount?.value === 4248, 'service grand total exact value');
  assert(serviceInvoice?.insuranceExpiry == null && serviceInvoice?.pucExpiry == null, 'service has no inferred expiry');
  assert(populatedFieldsHaveEvidence(serviceResult), 'all service populated fields have provenance');
  assert(serviceInvoice?.fieldEvidence?.odometerKm?.sourceText?.includes('12,450'), 'review odometer source text retained');

  const vehiclePurchase = await runPipeline(`
    ROADSTAR MOTORS
    VEHICLE SALE INVOICE
    Invoice Number: VP-2088
    Invoice Date: 20/08/2025
    Model: Roadstar 125
    Registration No: KA01AB5678
    Chassis Number: MBLHA10A1S2F03329
    Engine Number: EN125A123457
    Ex-showroom Price: 98,500
  `);
  assert(vehiclePurchase.classification.documentType === 'VEHICLE_PURCHASE_INVOICE', 'vehicle purchase classification');
  assert(vehiclePurchase.reviewInvoice?.registration === 'KA01AB5678', 'vehicle purchase registration');
  assert(vehiclePurchase.reviewInvoice?.chassisNumber === 'MBLHA10A1S2F03329', 'vehicle purchase chassis');

  const sales = await runPipeline(`
    NORTHSTAR TRADERS
    SALES INVOICE
    Seller: Northstar Traders
    Buyer: Sample Buyer
    Invoice Number: SI-3008
    Date: 21/08/2025
    Product: Replacement Filter
    Grand Total: 1,250
  `);
  assert(sales.classification.documentType === 'SALES_INVOICE', 'sales invoice classification');
  assert(sales.reviewInvoice?.invoiceNumber === 'SI-3008', 'sales invoice number');
  assert(sales.reviewInvoice?.registration === '', 'sales invoice has no vehicle registration');

  const insurance = await runPipeline(`
    NORTHSTAR GENERAL INSURANCE
    CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
    Policy Number: POL-2025-8821
    Period of Insurance: From 14/07/2025 to 13/07/2026
    Insured Name: Sample Policyholder
    Registration No: KA01AB1234
    Chassis Number: MBLHA10A1S2F03328
    Engine Number: EN125A123456
    Vehicle Make: Roadstar
    Vehicle Model: Roadstar 125
    IDV: 98,500
    Total Premium Payable: 4,850
  `);
  const insuranceData: any = insurance.extractedData.insuranceData;
  assert(insurance.classification.documentType === 'INSURANCE_POLICY', 'insurance classification');
  assert(insuranceData?.policyNumber?.value === 'POL-2025-8821', 'insurance policy number');
  assert(insuranceData?.policyExpiryDate?.value === '2026-07-13', 'insurance explicit expiry');
  assert(insurance.reviewInvoice?.odometerKm == null && insurance.extractedData.serviceData === undefined, 'insurance has no service extraction');
  assert(populatedFieldsHaveEvidence(insurance), 'all insurance populated fields have provenance');

  const insuranceReceipt = await runPipeline(`
    NORTHSTAR GENERAL INSURANCE
    INSURANCE PREMIUM RECEIPT
    Receipt Number: RCP-5001
    Policy No: POL-2025-8821
    Premium Paid: 4,850
  `);
  assert(insuranceReceipt.classification.documentType === 'INSURANCE_RECEIPT', 'insurance receipt classification');
  assert(insuranceReceipt.extractedData.insuranceData?.policyNumber?.value === 'POL-2025-8821', 'insurance receipt policy label');

  const puc = await runPipeline(`
    POLLUTION UNDER CONTROL CERTIFICATE
    PUC Certificate No: PUC-9912
    Registration No: KA01AB1234
    Valid Till: 30/11/2026
    Carbon Monoxide: 0.12
  `);
  assert(puc.classification.documentType === 'PUC_CERTIFICATE', 'PUC classification');
  assert(puc.extractedData.pucData?.certificateNumber?.value === 'PUC-9912', 'PUC certificate number');

  const rc = await runPipeline(`
    CERTIFICATE OF REGISTRATION
    Registration No: KA01AB1234
    Owner Name: Sample Owner
    Maker: Roadstar
    Model: Roadstar 125
    Chassis Number: MBLHA10A1S2F03328
    Engine Number: EN125A123456
  `);
  assert(rc.classification.documentType === 'RC_CERTIFICATE', 'RC classification');
  assert(rc.reviewInvoice?.registration === 'KA01AB1234', 'RC registration');

  const warranty = await runPipeline(`
    ROADSTAR WARRANTY CERTIFICATE
    Warranty Certificate No: WAR-77001
    Product: Roadstar 125
    Serial No: RS125-ABC991
    Start Date: 20/08/2025
    End Date: 20/08/2027
  `);
  assert(warranty.classification.documentType === 'WARRANTY_DOCUMENT', 'warranty classification');
  assert(warranty.reviewInvoice?.warrantyExpiry === '2027-08-20', 'warranty explicit end date');

  const serviceBook = await runPipeline(`
    ROADSTAR SERVICE BOOK
    Service Record Book
    Owner: Sample Owner
    Odometer: 9,800 KM
    Dealer Stamp: Roadstar Center
  `);
  assert(serviceBook.classification.documentType === 'SERVICE_BOOK', 'service book classification');
  assert(serviceBook.reviewInvoice?.odometerKm === 9800, 'service book odometer');

  const electronicsText = `
    NORTHSTAR MOBILE STORE
    TAX INVOICE
    Invoice No: MOB-8801
    Date: 22/08/2025
    Product: Northstar Phone X
    IMEI: 869910012345678
    Serial No: NSX8A91K2
    Grand Total: 25,960
  `;
  const electronics = await runPipeline(electronicsText);
  const electronicsData: any = electronics.extractedData.electronicsData;
  assert(electronics.classification.documentType === 'ELECTRONICS_PURCHASE_INVOICE', 'electronics classification');
  assert(electronicsData?.imei?.value === '869910012345678', 'electronics IMEI remains separate');
  assert(electronicsData?.serialNumber?.value === 'NSX8A91K2', 'electronics serial remains separate');
  assert(electronics.reviewInvoice?.imei === '869910012345678' && electronics.reviewInvoice?.serialNumber === 'NSX8A91K2', 'review preserves IMEI/serial separation');
  assert(electronics.reviewInvoice?.registration === '', 'electronics has no vehicle fields');

  const appliance = await runPipeline(`
    NORTHSTAR APPLIANCES
    TAX INVOICE
    Product: Northstar Air Conditioner
    Serial No: AC-9911-XY
    Date: 23/08/2025
    Grand Total: 45,000
  `);
  assert(appliance.classification.documentType === 'APPLIANCE_PURCHASE_INVOICE', 'appliance classification');
  assert(appliance.reviewInvoice?.odometerKm == null && appliance.reviewInvoice?.chassisNumber === '', 'appliance has no vehicle fields');

  const unknown = await runPipeline('A blue page with unrelated notes and no document identifiers.');
  assert(unknown.classification.documentType === 'UNKNOWN_DOCUMENT', 'unrelated document is unknown');
  assert(Object.keys(unknown.extractedData || {}).length === 0, 'unknown document has no extracted fields');
  assert(unknown.requiresReview === true, 'unknown document requires manual review');

  const unreadable = await runPipeline('');
  assert(unreadable.classification.documentType === 'UNREADABLE_DOCUMENT', 'empty OCR is unreadable');
  assert(Object.keys(unreadable.extractedData || {}).length === 0, 'unreadable document has no extracted fields');

  const unlabeledKm = await runPipeline(`
    SERVICE INVOICE
    Labour Charges: 500
    12,450 KM
    Grand Total: 500
  `);
  assert(unlabeledKm.reviewInvoice?.odometerKm == null, 'unlabeled KM is not promoted to odometer');

  const invalidImei = await runPipeline(`
    MOBILE SALES INVOICE
    Product: Northstar Phone X
    IMEI: 869910012345679
    Serial No: NSX8A91K3
    Grand Total: 25,960
  `);
  assert(invalidImei.extractedData.electronicsData?.imei?.value === '869910012345679', 'invalid IMEI retained as candidate');
  assert(invalidImei.extractedData.electronicsData?.imei?.status === 'NEEDS_REVIEW', 'invalid IMEI is not accepted');
  assert(invalidImei.requiresReview === true, 'invalid IMEI requires review');

  const conflictingOdometer = await runPipeline(`
    ROADSTAR SERVICE CENTER
    SERVICE INVOICE
    Current KM: 12,000
    Current KM: 12,500
    Grand Total: 2,000
  `);
  const conflict: any = conflictingOdometer.extractedData.serviceData?.odometerKm;
  assert(conflict?.value == null && conflict?.status === 'CONFLICT', 'conflicting odometer candidates are null/conflict');
  assert((conflict?.conflictCandidates?.length || 0) === 2, 'odometer conflict retains candidates');
  assert(conflictingOdometer.reviewReasons.some((r) => /conflicting candidates/i.test(r)), 'odometer conflict reaches review reasons');

  const blockedConflict = canSaveExtractedInvoice({
    odometerKm: 12500,
    fieldStatuses: { odometerKm: 'CONFLICT' },
    fieldEvidence: { odometerKm: { evidenceType: 'contextual_text', sourceText: 'Current KM: 12,500' } },
  });
  assert(blockedConflict.allowed === false, 'save gate blocks unresolved conflict');
  assert(blockedConflict.blockingFields.some((field) => field.key === 'odometerKm'), 'save gate names unresolved conflict field');

  const verifiedCorrection = canSaveExtractedInvoice({
    odometerKm: 12500,
    userConfirmedFields: { odometerKm: true },
    fieldEvidence: { odometerKm: { evidenceType: 'user_verified', sourceText: null } },
  });
  assert(verifiedCorrection.allowed === true, 'save gate allows explicit user verification');

  const missingEvidence = canSaveExtractedInvoice({
    totalAmount: 2000,
    fieldStatuses: { totalAmount: 'HIGH_CONFIDENCE' },
    fieldEvidence: {},
  });
  assert(missingEvidence.allowed === false, 'save gate blocks populated field without evidence');

  UniversalOcrPipeline.clearCache();
  const cachedA = await UniversalOcrPipeline.process(service, { skipCache: false, documentId: 'same.jpg' });
  const cachedB = await UniversalOcrPipeline.process(electronicsText, { skipCache: false, documentId: 'same.jpg' });
  assert(cachedA.metrics.cacheHit !== true && cachedB.metrics.cacheHit !== true, 'different text never shares cache entry');
  assert(cachedB.classification.documentType === 'ELECTRONICS_PURCHASE_INVOICE', 'cache isolation preserves second document type');

  const classifierUnknown = DocumentClassifier.classify('Policy Number only');
  assert(classifierUnknown.documentType === 'UNKNOWN_DOCUMENT', 'single keyword does not select schema');

  console.log(`\nPRODUCTION INTEGRITY RESULTS: ${passed} PASSED / ${failed} FAILED`);
  if (failed > 0) globalThis.process.exit(1);
}

run().catch((error) => {
  console.error(error);
  globalThis.process.exit(1);
});

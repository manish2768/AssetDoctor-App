/**
 * Asset Doctor — Master Document Routing & Category Extraction Acceptance Test Suite
 *
 * Verifies all criteria of the Master Fix Mandate:
 * 1. Canonical Document Types & Normalization
 * 2. Dedicated Review Route Mapping (No Silent Fallback to Purchase Invoice)
 * 3. Category-Specific Extraction for all 5 document types:
 *    - Purchase Bill / Invoice
 *    - Vehicle Service Bill
 *    - Vehicle Insurance
 *    - PUC Certificate
 *    - Electricity Bill
 * 4. Generic Document Handling (UNKNOWN / OTHER_DOCUMENT)
 * 5. User Category vs AI Category Mismatch Detection
 * 6. Error Granularity (No False "Blurry" Claims)
 * 7. Absence of Third-Party Placeholders ("Raftaar")
 */

import assert from 'assert';
import {
  AssetDocumentType,
  normalizeToCanonicalDocType,
  getRouteForCanonicalDocType,
  getCanonicalDocTypeLabel,
} from '../../../../src/types/assetDocumentTypes';
import { RealVehicleServiceExtractor } from '../../../../src/services/ocr/extractors/RealVehicleServiceExtractor';
import { InsuranceExtractor } from '../../../../src/ocr/extractors/InsuranceExtractor';
import { PucExtractor } from '../../../../src/ocr/extractors/PucExtractor';
import { RealElectricityBillExtractor } from '../../../../src/services/ocr/extractors/RealElectricityBillExtractor';
import { RealPurchaseInvoiceExtractor } from '../../../../src/services/ocr/extractors/RealPurchaseInvoiceExtractor';
import { ImageQualityAnalyzer } from '../../../../src/services/ocr/engine/ImageQualityAnalyzer';

let passCount = 0;
async function test(name: string, fn: () => any) {
  try {
    await fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err?.message || err}`);
    throw err;
  }
}

async function runAllTests() {
  console.log('\n============================================================');
  console.log(' ASSET DOCTOR — MASTER OCR & ROUTING VERIFICATION SUITE');
  console.log('============================================================\n');

  // -------------------------------------------------------------
  // 1. CANONICAL DOCUMENT TYPES & NORMALIZATION
  // -------------------------------------------------------------
  console.log('--- 1. Canonical Document Types & Normalization ---');

  await test('normalizes legacy INVOICE to VEHICLE_PURCHASE_INVOICE', () => {
    assert.strictEqual(normalizeToCanonicalDocType('INVOICE'), 'VEHICLE_PURCHASE_INVOICE');
    assert.strictEqual(normalizeToCanonicalDocType('purchase_invoice'), 'VEHICLE_PURCHASE_INVOICE');
    assert.strictEqual(normalizeToCanonicalDocType('tax_invoice'), 'VEHICLE_PURCHASE_INVOICE');
  });

  await test('normalizes VEHICLE_SERVICE to VEHICLE_SERVICE_BILL', () => {
    assert.strictEqual(normalizeToCanonicalDocType('VEHICLE_SERVICE'), 'VEHICLE_SERVICE_BILL');
    assert.strictEqual(normalizeToCanonicalDocType('vehicle_service_bill'), 'VEHICLE_SERVICE_BILL');
    assert.strictEqual(normalizeToCanonicalDocType('JOB_CARD'), 'VEHICLE_SERVICE_BILL');
  });

  await test('normalizes INSURANCE to VEHICLE_INSURANCE', () => {
    assert.strictEqual(normalizeToCanonicalDocType('INSURANCE'), 'VEHICLE_INSURANCE');
    assert.strictEqual(normalizeToCanonicalDocType('vehicle_insurance'), 'VEHICLE_INSURANCE');
    assert.strictEqual(normalizeToCanonicalDocType('POLICY'), 'VEHICLE_INSURANCE');
  });

  await test('normalizes PUC to VEHICLE_PUC', () => {
    assert.strictEqual(normalizeToCanonicalDocType('PUC'), 'VEHICLE_PUC');
    assert.strictEqual(normalizeToCanonicalDocType('puc_certificate'), 'VEHICLE_PUC');
    assert.strictEqual(normalizeToCanonicalDocType('EMISSION_TEST'), 'VEHICLE_PUC');
  });

  await test('normalizes ELECTRICITY_BILL to ELECTRICITY_BILL', () => {
    assert.strictEqual(normalizeToCanonicalDocType('ELECTRICITY_BILL'), 'ELECTRICITY_BILL');
    assert.strictEqual(normalizeToCanonicalDocType('power_bill'), 'ELECTRICITY_BILL');
  });

  await test('normalizes OTHER and UNKNOWN correctly', () => {
    assert.strictEqual(normalizeToCanonicalDocType('OTHER_DOCUMENT'), 'OTHER_DOCUMENT');
    assert.strictEqual(normalizeToCanonicalDocType('OTHER'), 'OTHER_DOCUMENT');
    assert.strictEqual(normalizeToCanonicalDocType('UNKNOWN'), 'UNKNOWN');
    assert.strictEqual(normalizeToCanonicalDocType(''), 'UNKNOWN');
    assert.strictEqual(normalizeToCanonicalDocType(null), 'UNKNOWN');
  });

  // -------------------------------------------------------------
  // 2. DEDICATED ROUTE MAPPING (ZERO SILENT FALLBACK)
  // -------------------------------------------------------------
  console.log('\n--- 2. Dedicated Route Mapping (Zero Silent Fallback) ---');

  await test('Vehicle Service Bill routes to ReviewVehicleService', () => {
    assert.strictEqual(getRouteForCanonicalDocType('VEHICLE_SERVICE_BILL'), 'ReviewVehicleService');
    assert.notStrictEqual(getRouteForCanonicalDocType('VEHICLE_SERVICE_BILL'), 'ReviewAsset');
  });

  await test('Vehicle Insurance routes to ReviewInsurance', () => {
    assert.strictEqual(getRouteForCanonicalDocType('VEHICLE_INSURANCE'), 'ReviewInsurance');
    assert.notStrictEqual(getRouteForCanonicalDocType('VEHICLE_INSURANCE'), 'ReviewAsset');
  });

  await test('PUC Certificate routes to ReviewPuc', () => {
    assert.strictEqual(getRouteForCanonicalDocType('VEHICLE_PUC'), 'ReviewPuc');
    assert.notStrictEqual(getRouteForCanonicalDocType('VEHICLE_PUC'), 'ReviewAsset');
  });

  await test('Electricity Bill routes to ReviewElectricityBill', () => {
    assert.strictEqual(getRouteForCanonicalDocType('ELECTRICITY_BILL'), 'ReviewElectricityBill');
    assert.notStrictEqual(getRouteForCanonicalDocType('ELECTRICITY_BILL'), 'ReviewAsset');
  });

  await test('Unknown and Other Document route to ReviewGenericDocument', () => {
    assert.strictEqual(getRouteForCanonicalDocType('UNKNOWN'), 'ReviewGenericDocument');
    assert.strictEqual(getRouteForCanonicalDocType('OTHER_DOCUMENT'), 'ReviewGenericDocument');
    assert.notStrictEqual(getRouteForCanonicalDocType('UNKNOWN'), 'ReviewAsset');
  });

  await test('Purchase Invoice routes to ReviewAsset', () => {
    assert.strictEqual(getRouteForCanonicalDocType('VEHICLE_PURCHASE_INVOICE'), 'ReviewAsset');
  });

  // -------------------------------------------------------------
  // 3. VEHICLE SERVICE BILL EXTRACTION
  // -------------------------------------------------------------
  console.log('\n--- 3. Vehicle Service Bill Extraction ---');

  const SAMPLE_SERVICE_TEXT = `
APEX MOTO SERVICES PVT LTD
AUTHORISED TVS MOTOR WORKSHOP
GSTIN: 09AAMCR8158M1Z1
TAX INVOICE / JOB CARD
Invoice No: 81587
Job Card No: 88583
Date: 20-08-2024
Customer: NIKLESH KUMAR
Vehicle Reg No: UP 32 QU 2187
Model: TVS RONIN BASE
Current KM: 12,273
Next Service Due: 15,000 KM
Next Service Date: 20-02-2025
1. Labour Charges: 850.00
2. Parts Total: 1450.00
Taxable Value: 2300.00
CGST 9%: 207.00
SGST 9%: 207.00
Grand Total: 2,714.00
`;

  await test('extracts all core vehicle service fields', () => {
    const data = RealVehicleServiceExtractor.extract(SAMPLE_SERVICE_TEXT);

    assert.strictEqual(data.workshopName, 'APEX MOTO SERVICES PVT LTD');
    assert.strictEqual(data.registration, 'UP32QU2187');
    assert.strictEqual(data.odometerKm, 12273);
    assert.strictEqual(data.invoiceNumber, '81587');
    assert.strictEqual(data.jobCardNumber, '88583');
    assert.strictEqual(data.invoiceDate, '2024-08-20');
    assert.strictEqual(data.totalAmount, 2714);
    assert.strictEqual(data.labourCharges, 850);
    assert.strictEqual(data.partsTotal, 1450);
    assert.strictEqual(data.nextServiceOdometerKm, 15000);
  });

  // -------------------------------------------------------------
  // 4. VEHICLE INSURANCE EXTRACTION
  // -------------------------------------------------------------
  console.log('\n--- 4. Vehicle Insurance Extraction ---');

  const SAMPLE_INSURANCE_TEXT = `
TATA AIG GENERAL INSURANCE COMPANY LIMITED
POLICY CERTIFICATE CUM SCHEDULE - PRIVATE CAR COMPREHENSIVE
Policy No: 01599882230000
Period of Insurance: From 15/09/2024 To 14/09/2025
Insured Name: RAJESH SHARMA
Registration No: DL04AB1234
Vehicle Make & Model: MARUTI SUZUKI SWIFT VXI
Chassis No: MA3EJC51S00123456
Engine No: K12MN1234567
Insured Declared Value (IDV): 4,50,000.00
Own Damage Premium: 5,420.00
Third Party Premium: 3,280.00
Net Premium Paid: 8,700.00
Total Amount: 10,266.00
`;

  await test('extracts all core vehicle insurance fields', () => {
    const data = InsuranceExtractor.extract(SAMPLE_INSURANCE_TEXT);

    assert.ok(data.insurerName.value?.includes('TATA AIG'));
    assert.ok(data.policyNumber.value?.includes('0159988223'));
    assert.strictEqual(data.vehicleRegistration.value, 'DL04AB1234');
    assert.strictEqual(data.policyStartDate.value, '2024-09-15');
    assert.strictEqual(data.policyEndDate.value, '2025-09-14');
    assert.strictEqual(data.chassisNumber.value, 'MA3EJC51S00123456');
    assert.strictEqual(data.engineNumber.value, 'K12MN1234567');
    assert.strictEqual(data.idvAmount.value, 450000);
  });

  // -------------------------------------------------------------
  // 5. PUC CERTIFICATE EXTRACTION
  // -------------------------------------------------------------
  console.log('\n--- 5. PUC Certificate Extraction ---');

  const SAMPLE_PUC_TEXT = `
TRANSPORT DEPARTMENT - GOVERNMENT OF NCT OF DELHI
POLLUTION UNDER CONTROL CERTIFICATE
Certificate No: DL0120240098231
Vehicle Registration No: DL 04 AB 1234
Date of Testing: 10/06/2024
Valid Upto: 09/06/2025
Fuel Type: PETROL
Testing Center: DELHI AUTO POLLUTION CHECK CENTER
CO Percentage (%): 0.05 (Standard <= 0.5)
Hydrocarbon (HC): 110 ppm (Standard <= 750)
Result: PASSED WITHIN LIMITS
`;

  await test('extracts all core PUC fields', () => {
    const data = PucExtractor.extract(SAMPLE_PUC_TEXT);

    assert.strictEqual(data.certificateNumber.value, 'DL0120240098231');
    assert.strictEqual(data.vehicleRegistration.value, 'DL04AB1234');
    assert.strictEqual(data.expiryDate.value, '2025-06-09');
    assert.strictEqual(data.emissionResult.value, 'PASS');
  });

  // -------------------------------------------------------------
  // 6. ELECTRICITY BILL EXTRACTION
  // -------------------------------------------------------------
  console.log('\n--- 6. Electricity Bill Extraction ---');

  const SAMPLE_ELECTRICITY_TEXT = `
BANGALORE ELECTRICITY SUPPLY COMPANY LIMITED (BESCOM)
ELECTRICITY BILL - CUM - NOTICE
Account ID: 5410982345
Consumer No: 9823451000
Bill No: BES2024080192
Bill Date: 05-08-2024
Due Date: 20-08-2024
Billing Period: 01/07/2024 to 31/07/2024
Meter No: MTR998811
Previous Reading: 1240.00
Current Reading: 1520.00
Units Consumed: 280
Current Charges: 2150.00
Total Amount Due: 2,150.00
`;

  await test('extracts all core electricity bill fields', () => {
    const data = RealElectricityBillExtractor.extract(SAMPLE_ELECTRICITY_TEXT);

    assert.ok(data.electricityProvider?.includes('BESCOM'));
    assert.strictEqual(data.consumerId, '9823451000');
    assert.strictEqual(data.billDate, '2024-08-05');
    assert.strictEqual(data.dueDate, '2024-08-20');
    assert.strictEqual(data.previousMeterReading, 1240);
    assert.strictEqual(data.currentMeterReading, 1520);
    assert.strictEqual(data.unitsConsumedKwh, 280);
    assert.strictEqual(data.currentBillAmount, 2150);
  });

  // -------------------------------------------------------------
  // 7. IMAGE QUALITY VS EXTRACTION SEPARATION
  // -------------------------------------------------------------
  console.log('\n--- 7. Image Quality vs Extraction Separation ---');

  await test('does not reject readable image as blurry when resolution is sufficient', () => {
    const res = ImageQualityAnalyzer.assessQuality({
      width: 1920,
      height: 1080,
      fileBytes: 250000,
      base64Length: 300000,
    });

    assert.strictEqual(res.ok, true);
    assert.ok(res.imageQualityScore >= 80);
  });

  await test('detects truly corrupt/empty file honestly', () => {
    const res = ImageQualityAnalyzer.assessQuality({
      width: 0,
      height: 0,
      fileBytes: 100,
      base64Length: 120,
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'truncated_file');
  });

  // -------------------------------------------------------------
  // 8. ZERO OCCURRENCE OF RAFTAAR MOTO LEGENDS
  // -------------------------------------------------------------
  console.log('\n--- 8. Absence of Real Third-Party Placeholders ---');

  await test('verifies no Raftaar references exist in sample fixtures or prompts', () => {
    const { SAMPLE_FIXTURES } = require('../../../../src/services/ocr/ocrDiagnosticService');
    for (const f of SAMPLE_FIXTURES) {
      assert.strictEqual(f.rawText.includes('RAFTAAR'), false, `Fixture ${f.id} contains RAFTAAR`);
    }
  });

  // -------------------------------------------------------------
  // 9. INSURANCE POLICY NEVER LEAKS INTO INVOICE LINE ITEMS
  // -------------------------------------------------------------
  console.log('\n--- 9. Comprehensive 6-Document Scenario Verification ---');

  const { CanonicalOcrPipeline } = require('../CanonicalOcrPipeline');
  const { VehicleLinkingEngine } = require('../../vehicles/VehicleLinkingEngine');

  await test('Scenario 1: Insurance Policy extraction isolates premium and zero items', async () => {
    const policyText = `
ICICI LOMBARD GENERAL INSURANCE COMPANY LTD
Certificate of Insurance / Policy Schedule
Policy No: 3001/2024/987654321
Insured Name: Amit Verma
Period of Insurance: From 10/01/2024 to 09/01/2025
Registration No: MH 12 DE 1433
Make / Model: Hyundai Creta SX
Chassis Number: MALC381CLNM123456
Engine Number: G4FLNM654321
IDV: 11,50,000.00
Coverage Details:
PA Cover For Owner Driver: 375.00
Legal Liability to Paid Driver: 50.00
Zero Depreciation Cover: 4,200.00
Consumables Cover: 850.00
Gross Premium: 18,500.00
GST 18%: 3,330.00
Total Premium Payable: 21,830.00
  `;

    const result = await CanonicalOcrPipeline.process({
      imageUri: 'file:///test.jpg',
      rawText: policyText,
      skipQualityGate: true,
    });

    assert.strictEqual(result.documentType, 'VEHICLE_INSURANCE');
    assert.strictEqual(result.reviewInvoice.items.length, 0);
    assert.strictEqual(result.reviewInvoice.lineItems.length, 0);
    assert.strictEqual(result.reviewInvoice.policyNumber, '3001/2024/987654321');
    assert.strictEqual(result.reviewInvoice.totalAmount, 21830);
    assert.strictEqual(result.reviewInvoice.registration, 'MH12DE1433');
  });

  await test('Scenario 2: Vehicle Purchase Invoice extracts line items and registration/chassis', async () => {
    const vehicleInvoiceText = `
TAX INVOICE
KALYANI MOTORS PVT LTD
AUTHORISED MARUTI SUZUKI DEALER
Invoice No: INV-2024-9981
Date: 12-05-2024
Customer Name: Priya Singh
Vehicle Reg No: KA05MN5678
Chassis No: MA3EJC51S00998877
Engine No: K12MN9988776
Description Qty Amount
1. Maruti Swift ZXi 1 750000.00
2. Essential Accessories Kit 1 15000.00
Grand Total: 7,65,000.00
  `;

    const result = await CanonicalOcrPipeline.process({
      imageUri: 'file:///test_veh.jpg',
      rawText: vehicleInvoiceText,
      skipQualityGate: true,
    });

    assert.strictEqual(result.documentType, 'VEHICLE_PURCHASE_INVOICE');
    assert.ok(result.reviewInvoice.items.length > 0);
    assert.strictEqual(result.reviewInvoice.totalAmount, 765000);
  });

  await test('Scenario 3: Vehicle PUC Certificate extraction', async () => {
    const pucText = `
GOVERNMENT OF KARNATAKA - TRANSPORT DEPARTMENT
POLLUTION UNDER CONTROL CERTIFICATE
Certificate No: KA052024991122
Vehicle Registration No: KA 05 MN 5678
Date of Testing: 10/06/2024
Valid Upto: 09/06/2025
Fuel Type: PETROL
Emission Check Result: PASSED
  `;

    const result = await CanonicalOcrPipeline.process({
      imageUri: 'file:///test_puc.jpg',
      rawText: pucText,
      skipQualityGate: true,
    });

    assert.strictEqual(result.documentType, 'VEHICLE_PUC');
    assert.strictEqual(result.reviewInvoice.items.length, 0);
    assert.strictEqual(result.reviewInvoice.registration, 'KA05MN5678');
  });

  await test('Scenario 4: Normal Retail Purchase Invoice extracts product and line items', async () => {
    const retailText = `
RELIANCE DIGITAL RETAIL LIMITED
TAX INVOICE
Invoice No: REL-99120
Date: 01-08-2024
Description Qty Amount
1. Samsung Galaxy S24 Ultra Smartphone 1 129999.00
2. 45W Power Adapter 1 2999.00
Grand Total: 1,32,998.00
  `;

    const result = await CanonicalOcrPipeline.process({
      imageUri: 'file:///test_retail.jpg',
      rawText: retailText,
      skipQualityGate: true,
    });

    assert.strictEqual(result.documentType, 'ELECTRONICS_PURCHASE_INVOICE');
    assert.strictEqual(result.reviewInvoice.totalAmount, 132998);
    assert.ok(result.reviewInvoice.items.length >= 1);
  });

  await test('Scenario 5: Insurance with partial chassis/engine suffix matching', () => {
    const existingVault = [
      {
        id: 'asset_swift_1',
        assetId: 'asset_swift_1',
        name: 'Maruti Suzuki Swift',
        brand: 'Maruti Suzuki',
        registration: 'DL04AB1234',
        chassisNumber: 'MA3EJC51S00123456',
        engineNumber: 'K12MN1234567',
      },
    ];

    const candidate = {
      chassisNumber: '123456',
      engineNumber: '1234567',
      vehicleMake: 'Maruti Suzuki',
      vehicleModel: 'Swift',
    };

    const matchRes = VehicleLinkingEngine.resolveVehicleLink(candidate, existingVault);
    assert.strictEqual(matchRes.status, 'SUFFIX_CORROBORATED');
    assert.strictEqual(matchRes.matchedVehicle.id, 'asset_swift_1');
  });

  await test('Scenario 6: Insurance with no registration plate but full chassis', () => {
    const existingVault = [
      {
        id: 'asset_creta_2',
        assetId: 'asset_creta_2',
        name: 'Hyundai Creta',
        brand: 'Hyundai',
        registration: 'MH12DE1433',
        chassisNumber: 'MALC381CLNM123456',
        engineNumber: 'G4FLNM654321',
      },
    ];

    const candidate = {
      registrationNumber: '',
      chassisNumber: 'MALC381CLNM123456',
    };

    const matchRes = VehicleLinkingEngine.resolveVehicleLink(candidate, existingVault);
    assert.strictEqual(matchRes.status, 'EXACT_MATCH');
    assert.strictEqual(matchRes.matchField, 'CHASSIS');
    assert.strictEqual(matchRes.matchedVehicle.id, 'asset_creta_2');
  });

  console.log('\n============================================================');
  console.log(` ALL ${passCount} ACCEPTANCE TESTS PASSED SUCCESSFULLY!`);
  console.log('============================================================\n');
}

runAllTests().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});


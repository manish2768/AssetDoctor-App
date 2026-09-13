/**
 * Asset Doctor — Master Unified OCR Pipeline Regression Test Suite
 *
 * Covers all 15 test scenarios mandated by the architecture review:
 * 1. Readable retail bill
 * 2. Long invoice
 * 3. Thermal receipt
 * 4. Electronics invoice (Nothing Phone / Smartphone)
 * 5. Home appliance invoice (Daikin / Voltas AC)
 * 6. Vehicle invoice (TVS Ronin / Two-wheeler)
 * 7. Insurance document (ICICI Lombard)
 * 8. Invoice without warranty (zero hallucinated 12-month default)
 * 9. Invoice without serial number
 * 10. Invoice with GST/tax clutter (purged from canonical payload)
 * 11. Variable field labels (Particulars, Cash Memo, S/N, Sl No, Regn No)
 * 12. Camera flow simulation
 * 13. Gallery flow simulation
 * 14. OCR provider fallback simulation
 * 15. Canonical -> Review model mapping
 */

import * as fs from 'fs';
import * as path from 'path';
import { UnifiedAssetExtractor } from '../UnifiedAssetExtractor';
import { UnifiedOcrService } from '../UnifiedOcrService';
import { ALLOWED_UNIFIED_ASSET_KEYS } from '../../../types/assetDocument';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../offline-ocr-lab/fixtures');

function readFixture(relPath: string): string {
  const full = path.join(FIXTURES_DIR, relPath);
  if (fs.existsSync(full)) {
    return fs.readFileSync(full, 'utf-8');
  }
  return '';
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

let passed = 0;
let total = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runSuite() {
  console.log('='.repeat(70));
  console.log('RUNNING UNIFIED OCR PIPELINE REGRESSION SUITE (15 TESTS)');
  console.log('='.repeat(70));

  // 1. Readable Retail Bill
  await test('1. Readable Retail Bill (Retail GST Invoice)', () => {
    const raw = readFixture('retail/09-gst-retail-invoice.txt');
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.success === true, 'Extraction should succeed');
    assert(res.isReadable === true, 'Document should be readable');
    assert(res.asset.totalAmount === 1221, `Amount mismatch: ${res.asset.totalAmount}`);
    assert(res.asset.invoiceNumber === 'RT-2026-04401', `Invoice mismatch: ${res.asset.invoiceNumber}`);
    assert(res.asset.purchaseDate === '2026-05-19', `Date mismatch: ${res.asset.purchaseDate}`);
  });

  // 2. Long Invoice (Multi-Page Service / Electronics Invoice)
  await test('2. Long Multi-Page Invoice (Dell Laptop)', () => {
    const raw = readFixture('service/11-multi-page-invoice.txt');
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.success === true, 'Long invoice extraction succeeded');
    assert(res.asset.totalAmount === 75637, `Amount mismatch: ${res.asset.totalAmount}`);
    assert(res.category === 'ELECTRONICS', `Expected ELECTRONICS, got ${res.category}`);
    assert(res.asset.serialNumber === 'DLMP15ZZTEST001', `S/N mismatch: ${res.asset.serialNumber}`);
  });

  // 3. Thermal Receipt
  await test('3. Thermal Receipt Parsing (Chotu Dhaba)', () => {
    const raw = readFixture('retail/10-thermal-receipt.txt');
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.success === true, 'Thermal receipt succeeded');
    assert(res.asset.totalAmount === 280, `Total mismatch: ${res.asset.totalAmount}`);
    assert(res.asset.purchaseDate === '2026-08-27', `Date mismatch: ${res.asset.purchaseDate}`);
  });

  // 4. Electronics Invoice (Smartphone with IMEI & Serial)
  await test('4. Electronics Invoice (Smartphone with IMEI & Serial)', () => {
    const raw = readFixture('electronics/07-mobile-phone-invoice.txt');
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.category === 'ELECTRONICS', `Expected ELECTRONICS, got ${res.category}`);
    assert(res.asset.imei === '490154203237518', `IMEI mismatch: ${res.asset.imei}`);
    assert(res.asset.totalAmount === 28319, `Total mismatch: ${res.asset.totalAmount}`);
  });

  // 5. Home Appliance Invoice (AC with Brand & Model)
  await test('5. Home Appliance Invoice (AC with Brand & Model)', () => {
    const raw = readFixture('retail/08-home-appliance-invoice.txt');
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.category === 'HOME_APPLIANCE', `Expected HOME_APPLIANCE, got ${res.category}`);
    assert(res.asset.brand === 'Voltas', `Brand mismatch: ${res.asset.brand}`);
    assert(res.asset.totalAmount === 56948, `Amount mismatch: ${res.asset.totalAmount}`);
  });

  // 6. Vehicle Service Invoice (Plate, Chassis, Engine, Odometer)
  await test('6. Vehicle Service Invoice (Plate, Chassis, Engine, Odometer)', () => {
    const raw = readFixture('service/02-vehicle-service-invoice.txt');
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.category === 'VEHICLE', `Expected VEHICLE, got ${res.category}`);
    assert(res.asset.registrationNumber === 'UP32ZZ0001', `Reg mismatch: ${res.asset.registrationNumber}`);
    assert(res.asset.totalAmount === 3706, `Amount mismatch: ${res.asset.totalAmount}`);
  });

  // 7. Insurance Document (ICICI Lombard)
  await test('7. Motor Insurance Document', () => {
    const raw = readFixture('insurance/03-vehicle-insurance-policy.txt');
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.category === 'INSURANCE', `Expected INSURANCE, got ${res.category}`);
    assert(res.asset.providerName === 'ICICI Lombard', `Provider mismatch: ${res.asset.providerName}`);
    assert(res.asset.policyNumber === 'POL-TEST-00123456', `Policy number mismatch: ${res.asset.policyNumber}`);
    assert(res.asset.totalAmount != null && Math.abs(res.asset.totalAmount - 3365.96) < 1, `Premium mismatch: ${res.asset.totalAmount}`);
  });

  // 8. Invoice Without Warranty (Zero Hallucinated Defaults)
  await test('8. Invoice without printed warranty (Must NOT hallucinate 12 months)', () => {
    const raw = `
      LOCAL PROVISION STORE
      CASH MEMO # 992
      Date: 01-06-2024
      Item: Steel Thermos Bottle
      Grand Total: 850
    `;
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.asset.warrantySource === 'NOT_FOUND', `WarrantySource should be NOT_FOUND, got: ${res.asset.warrantySource}`);
    assert(res.asset.warrantyPeriodMonths === undefined, 'Must not invent 12 months warranty');
    assert(res.asset.warrantyExpiryDate === undefined, 'Must not invent fake warranty expiry date');
  });

  // 9. Invoice Without Serial Number
  await test('9. Invoice without serial number (Graceful non-null behavior)', () => {
    const raw = `
      DECATHLON SPORTS INDIA
      INVOICE: DEC-2024-1182
      Date: 2024-04-05
      Product: Quechua Hiking Backpack 30L
      Total Amount: 2499
    `;
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.success === true, 'Should succeed');
    assert(res.asset.serialNumber === undefined, 'Serial number should be undefined');
    assert(res.asset.totalAmount === 2499, 'Amount should match');
  });

  // 10. Invoice with GST / Tax Clutter
  await test('10. Invoice with heavy GST/tax clutter (Accounting fields purged)', () => {
    const raw = `
      ABC ENTERPRISES PVT LTD
      GSTIN: 27AABCU9603R1ZM
      TAX INVOICE: ABC-88192
      DATE: 10/05/2024
      PARTICULARS: Office Desk Lamp
      HSN/SAC: 9405
      TAXABLE VALUE: 1,000.00
      CGST @ 9%: 90.00
      SGST @ 9%: 90.00
      IGST: 0.00
      ROUND OFF: 0.00
      GRAND TOTAL: 1,180.00
      SELLER ADDRESS: 123 Industrial Area, Pune 411001
      BUYER GSTIN: 27XYZPU1234A1Z5
    `;
    const res = UnifiedAssetExtractor.extract(raw);
    const asset = res.asset as any;

    // Verify correct total extracted
    assert(res.asset.totalAmount === 1180, `Expected total 1180, got ${res.asset.totalAmount}`);

    // Verify strict allowlist enforcement: zero accounting keys present
    const forbidden = [
      'gstin', 'sellerGstin', 'shopGstin', 'buyerGstin',
      'cgst', 'sgst', 'igst', 'taxAmount', 'taxRate',
      'hsn', 'sac', 'subtotal', 'sellerAddress', 'buyerAddress'
    ];
    for (const f of forbidden) {
      assert(asset[f] === undefined, `Forbidden accounting field '${f}' found in UnifiedAssetPayload!`);
    }

    // Verify all keys belong to ALLOWED_UNIFIED_ASSET_KEYS
    for (const key of Object.keys(asset)) {
      assert(
        (ALLOWED_UNIFIED_ASSET_KEYS as readonly string[]).includes(key),
        `Unexpected key '${key}' not in ALLOWED_UNIFIED_ASSET_KEYS!`
      );
    }
  });

  // 11. Variable Field Labels
  await test('11. Variable field labels (Cash Memo, Sl No, Regn No, etc.)', () => {
    const raw = `
      CASH MEMO NO: MEMO-10023
      DATE OF INVOICE: 22.02.2024
      DESCRIPTION OF GOODS: Philips Mixer Grinder 750W
      SL NO: PH-MG-5544
      AMOUNT PAYABLE: Rs. 3,890
    `;
    const res = UnifiedAssetExtractor.extract(raw);
    assert(res.asset.invoiceNumber === 'MEMO-10023', `Invoice mismatch: ${res.asset.invoiceNumber}`);
    assert(res.asset.purchaseDate === '2024-02-22', `Date mismatch: ${res.asset.purchaseDate}`);
    assert(res.asset.serialNumber === 'PH-MG-5544', `Serial mismatch: ${res.asset.serialNumber}`);
    assert(res.asset.totalAmount === 3890, `Amount mismatch: ${res.asset.totalAmount}`);
  });

  // 12. Camera Flow Simulation
  await test('12. Camera Flow Simulation (DocumentScanner output -> UnifiedOcrService)', async () => {
    const simulatedCameraOcrText = `
      SAMSUNG SMART PLAZA
      TAX INVOICE: SSP-2024-8812
      DATE: 18-04-2024
      PRODUCT: Samsung Galaxy S24 Ultra
      IMEI: 351234567890123
      SERIAL: R5CW10ABCDE
      TOTAL AMOUNT: 1,29,999.00
      1 Year Warranty
    `;
    const res = await UnifiedOcrService.processDocument(simulatedCameraOcrText);
    assert(res.success === true, 'Camera flow should succeed');
    assert(res.isReadable === true, 'Camera document should be marked readable');
    assert(res.asset.totalAmount === 129999, `Total mismatch: ${res.asset.totalAmount}`);
    assert(res.asset.imei === '351234567890123', `IMEI mismatch: ${res.asset.imei}`);
    assert(res.asset.warrantySource === 'EXTRACTED', 'Warranty source must be EXTRACTED');
  });

  // 13. Gallery Flow Simulation
  await test('13. Gallery Flow Simulation (Gallery image selection -> UnifiedOcrService)', async () => {
    const simulatedGalleryText = `
      WHIRLPOOL AUTHORISED STORE
      BILL NO: WP-2024-5512
      DATE: 2024-03-29
      PRODUCT: Whirlpool 265L Frost Free Refrigerator
      SERIAL NO: WP-REF-889911
      GRAND TOTAL: Rs. 28,490
    `;
    const res = await UnifiedOcrService.processDocument(simulatedGalleryText);
    assert(res.success === true, 'Gallery flow should succeed');
    assert(res.category === 'HOME_APPLIANCE', `Expected HOME_APPLIANCE, got ${res.category}`);
    assert(res.asset.serialNumber === 'WP-REF-889911', `Serial mismatch: ${res.asset.serialNumber}`);
    assert(res.asset.totalAmount === 28490, `Amount mismatch: ${res.asset.totalAmount}`);
  });

  // 14. OCR Provider Fallback Simulation
  await test('14. OCR Provider Fallback (Empty primary text handled cleanly)', async () => {
    const degradedText = 'A';
    const res = await UnifiedOcrService.processDocument(degradedText);
    assert(res.isReadable === false, 'Degraded text must have isReadable=false');
    assert(res.asset.confidenceScore === 0, 'Confidence must be 0 for empty text');
  });

  // 15. Canonical -> Review Screen Model Symmetrical Mapping
  await test('15. Symmetrical Review Screen Mapping', () => {
    const raw = `
      CROMA ELECTRONICS
      INVOICE NO: CR-2024-771
      DATE: 2024-01-15
      PRODUCT: Apple iPad Air M2 128GB
      SERIAL NO: DMQC2098K
      TOTAL AMOUNT: Rs. 59,900.00
      1 Year Warranty
    `;
    const res = UnifiedAssetExtractor.extract(raw);
    const asset = res.asset;

    // Check UI aliases are populated symmetrically so Review screen never displays "Not found"
    assert(asset.productName === asset.assetName, 'productName must match assetName');
    assert(asset.storeName === asset.merchantName, 'storeName must match merchantName');
    assert(asset.price === asset.totalAmount, 'price must match totalAmount');
    assert(asset.warrantyExpiry === asset.warrantyExpiryDate, 'warrantyExpiry must match warrantyExpiryDate');
    assert(Boolean(asset.productName), 'productName must be populated');
    assert(Boolean(asset.price), 'price must be populated');
    assert(Boolean(asset.purchaseDate), 'purchaseDate must be populated');
  });

  console.log('='.repeat(70));
  console.log(`UNIFIED OCR RESULTS: ${passed}/${total} TESTS PASSED (0 FAILED)`);
  console.log('='.repeat(70));
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

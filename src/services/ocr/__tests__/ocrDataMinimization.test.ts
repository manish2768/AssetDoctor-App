/**
 * Asset Doctor — Phase 18 OCR Data Minimization & Type-Driven Architecture Test Suite
 *
 * Verifies all 18 criteria:
 * 1. GSTIN is ignored / not in canonical output
 * 2. Seller address is ignored
 * 3. Customer phone is not required
 * 4. Seller phone is optional
 * 5. Missing GSTIN does not reduce confidence
 * 6. Missing address does not reduce confidence
 * 7. Missing tax does not reduce confidence
 * 8. Missing line items does not reduce confidence
 * 9. Warranty duration correctly derives expiry
 * 10. Electronics does not show vehicle fields or odometer
 * 11. Vehicle service shows odometer
 * 12. Appliance does not show odometer
 * 13. Invoice number not confused with GSTIN
 * 14. Invoice number not confused with phone
 * 15. IMEI not confused with invoice amount
 * 16. Total amount validated
 * 17. Legacy GSTIN/address records still load
 * 18. New scan does not write GSTIN/address
 */

import { CanonicalOcrPipeline } from '../CanonicalOcrPipeline';
import { CrossFieldValidator } from '../engine/CrossFieldValidator';
import { GrandTotalEngine } from '../engine/GrandTotalEngine';
import { RealElectronicsExtractor } from '../extractors/RealElectronicsExtractor';
import { RealVehicleServiceExtractor } from '../extractors/RealVehicleServiceExtractor';
import { RealVehiclePurchaseExtractor } from '../extractors/RealVehiclePurchaseExtractor';
import { RealApplianceExtractor } from '../extractors/RealApplianceExtractor';
import { invoiceToAssetForm } from '../invoiceSchema';

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName} (${detail || ''})`);
  }
  console.log(`  ✓ PASS: ${testName}`);
}

async function runDataMinimizationTests() {
  console.log('================================================================');
  console.log('   PHASE 18 OCR DATA MINIMIZATION & TYPE-DRIVEN TEST SUITE');
  console.log('================================================================\n');

  // Test 1: GSTIN is ignored / not in canonical output
  console.log('--- Test 1: GSTIN is not in canonical output ---');
  {
    const rawText = `
      CASHIFY RETAIL STORE
      Plot 12, Sector 18, Noida, UP 201301
      GSTIN: 07AABCS1429B1Z0
      Tax Invoice
      Invoice No: CS-2026-9912
      Date: 19/05/2026
      Item: Apple iPhone 15 Pro Max
      IMEI: 490154203237518
      Grand Total: Rs. 1,34,900
    `;
    const result = await CanonicalOcrPipeline.process({ rawText });
    assert(result.fields.shopGstin === undefined, 'shopGstin is omitted from canonical fields');
    assert(result.reviewInvoice.shopGstin === undefined, 'shopGstin is omitted from reviewInvoice');
  }

  // Test 2: Seller address is ignored
  console.log('--- Test 2: Seller address is ignored ---');
  {
    const rawText = `
      CROMA ELECTRONICS
      Shop No. 4, Ground Floor, Mall of India, Noida, UP
      Tel: 9876543210
      Invoice No: CR-5542
      Date: 12/04/2026
      Item: Samsung OLED TV 55
      Serial No: SAM55OLED88219
      Grand Total: Rs. 84,990
    `;
    const result = await CanonicalOcrPipeline.process({ rawText });
    assert(result.fields.shopAddress === undefined, 'shopAddress is omitted from canonical fields');
    assert(result.reviewInvoice.shopAddress === undefined, 'shopAddress is omitted from reviewInvoice');
  }

  // Test 3: Customer phone is not required
  console.log('--- Test 3: Customer phone is not required ---');
  {
    const rawText = `
      VIJAY SALES
      Invoice No: VS-88910
      Date: 2026-06-15
      Product: Sony WH-1000XM5
      Serial: SONYWH881290
      Total: 29,990.00
    `;
    const result = await CanonicalOcrPipeline.process({ rawText });
    assert(result.extractionConfidence >= 0.85, 'High confidence without customer phone', `score: ${result.extractionConfidence}`);
    assert(result.status === 'EXTRACTED', 'Document succeeds without customer phone');
  }

  // Test 4: Seller phone is optional
  console.log('--- Test 4: Seller phone is optional ---');
  {
    // Case A: Seller phone present near shop header
    const rawWithPhone = `
      RELIANCE DIGITAL
      Customer Support Ph: 9811223344
      Invoice No: RD-1002
      Date: 2026-07-10
      Product: OnePlus 12
      IMEI: 869345041234567
      Total: Rs. 64,999
    `;
    const resWithPhone = await CanonicalOcrPipeline.process({ rawText: rawWithPhone });
    assert(resWithPhone.fields.sellerPhone === '9811223344', 'Seller phone extracted when strongly detected');

    // Case B: Seller phone absent
    const rawWithoutPhone = `
      RELIANCE DIGITAL
      Invoice No: RD-1003
      Date: 2026-07-10
      Product: OnePlus 12
      IMEI: 869345041234567
      Total: Rs. 64,999
    `;
    const resWithoutPhone = await CanonicalOcrPipeline.process({ rawText: rawWithoutPhone });
    assert(resWithoutPhone.fields.sellerPhone == null, 'Seller phone is null when absent');
    assert(resWithoutPhone.status === 'EXTRACTED', 'Pipeline succeeds without seller phone');
  }

  // Test 5: Missing GSTIN does not reduce confidence
  console.log('--- Test 5: Missing GSTIN does not reduce confidence ---');
  {
    const withoutGstin = `
      POOJA ELECTRONICS
      Invoice No: PE-404
      Date: 2026-05-10
      Item: MacBook Air M3
      Serial: C02G8891Q05D
      Total: Rs. 1,14,900
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: withoutGstin });
    assert(res.extractionConfidence >= 0.85, 'Confidence >= 0.85 without GSTIN', `score: ${res.extractionConfidence}`);
  }

  // Test 6: Missing address does not reduce confidence
  console.log('--- Test 6: Missing address does not reduce confidence ---');
  {
    const withoutAddress = `
      DIGITAL WORLD
      Invoice No: DW-901
      Date: 2026-03-22
      Item: iPad Air 11
      Serial: DLX88129031
      Total: Rs. 59,900
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: withoutAddress });
    assert(res.extractionConfidence >= 0.85, 'Confidence >= 0.85 without address', `score: ${res.extractionConfidence}`);
  }

  // Test 7: Missing tax does not reduce confidence
  console.log('--- Test 7: Missing tax does not reduce confidence ---');
  {
    const withoutTax = `
      BHARAT AUTO REPAIRS
      Job Card No: JC-2026-88
      Date: 2026-04-18
      Vehicle Reg: DL01AB1234
      Model: Honda City
      Odometer: 32,450 KM
      Amount Paid: Rs. 4,850
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: withoutTax });
    assert(res.extractionConfidence >= 0.90, 'Confidence >= 0.90 without tax breakdown', `score: ${res.extractionConfidence}`);
  }

  // Test 8: Missing line items does not reduce confidence
  console.log('--- Test 8: Missing line items does not reduce confidence ---');
  {
    const singleItemNoTable = `
      SHREE GANESH ENTERPRISES
      Invoice No: SGE-551
      Date: 2026-01-14
      Voltas 1.5 Ton Split AC
      Serial No: VOLT15AC8812
      Warranty: 12 Months
      Grand Total: Rs. 38,500
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: singleItemNoTable });
    assert(res.extractionConfidence >= 0.85, 'Confidence >= 0.85 for single item receipt', `score: ${res.extractionConfidence}`);
  }

  // Test 9: Warranty duration correctly derives expiry
  console.log('--- Test 9: Warranty duration derives expiry ---');
  {
    // 19 May 2026 + 12 Months -> 2027-05-19
    const derived = CrossFieldValidator.addMonthsToDate('2026-05-19', 12);
    assert(derived === '2027-05-19', '12 months from 2026-05-19 produces 2027-05-19', derived || '');

    // 2 Years (24 months)
    const derived2Years = CrossFieldValidator.addMonthsToDate('2026-01-01', 24);
    assert(derived2Years === '2028-01-01', '24 months from 2026-01-01 produces 2028-01-01', derived2Years || '');

    // End-to-end extraction derivation
    const rawWithWar = `
      APPLE AUTHORIZED RESELLER
      Invoice No: AP-9921
      Date: 19/05/2026
      Item: iPhone 15 Pro
      IMEI: 490154203237518
      Warranty: 12 Months
      Total: Rs. 1,29,900
    `;
    const ext = RealElectronicsExtractor.extract(rawWithWar);
    assert(ext.warrantyExpiry === '2027-05-19', 'Extractor derives warrantyExpiry as 2027-05-19', ext.warrantyExpiry || '');
  }

  // Test 10: Electronics does not show vehicle fields or odometer
  console.log('--- Test 10: Electronics does not show vehicle fields ---');
  {
    const elecText = `
      CHROMA ELECTRONICS
      Invoice No: CH-123
      Date: 2026-02-10
      Google Pixel 8 Pro
      IMEI: 869345041234567
      Total: Rs. 79,999
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: elecText });
    assert(res.documentType === 'ELECTRONICS_PURCHASE_INVOICE', 'Classified as electronics');
    assert(res.fields.registration === undefined, 'No vehicle registration in electronics');
    assert(res.fields.odometerKm === undefined, 'No odometer in electronics');
    assert(res.fields.chassisNumber === undefined, 'No chassis number in electronics');
  }

  // Test 11: Vehicle service shows odometer
  console.log('--- Test 11: Vehicle service shows odometer ---');
  {
    const serviceText = `
      SPEED MOTORS WORKSHOP
      Service Invoice
      Job Card: RO-901
      Date: 2026-08-01
      Registration: HR26DK8899
      Vehicle: Maruti Swift
      Odometer: 18,250 KM
      Next Service Target: 28,000 KM
      Grand Total: Rs. 6,420
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: serviceText });
    assert(res.documentType === 'VEHICLE_SERVICE_INVOICE', 'Classified as vehicle service');
    assert(res.fields.odometerKm === 18250, 'Odometer extracted as 18250', `${res.fields.odometerKm}`);
    assert(res.fields.registration === 'HR26DK8899', 'Registration extracted as HR26DK8899');
  }

  // Test 12: Appliance does not show odometer
  console.log('--- Test 12: Appliance does not show odometer ---');
  {
    const appText = `
      LG BEST SHOP
      Invoice No: LG-4401
      Date: 2026-03-15
      LG 260 Litre Frost Free Refrigerator
      Serial No: LGR260FF9912
      Total: Rs. 28,490
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: appText });
    assert(res.documentType === 'HOME_APPLIANCE_INVOICE', 'Classified as home appliance');
    assert(res.fields.odometerKm === undefined, 'Appliance has no odometer');
    assert(res.fields.registration === undefined, 'Appliance has no vehicle registration');
  }

  // Test 13: Invoice number not confused with GSTIN
  console.log('--- Test 13: Invoice number not confused with GSTIN ---');
  {
    const gstinAndInv = `
      SUPERTECH COMPUTERS
      GSTIN: 09AABCS1429B1Z5
      Invoice No: INV-2024-889
      Date: 2026-04-10
      Item: Dell XPS 15
      Serial: DELLXPS9910
      Total: Rs. 1,45,000
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: gstinAndInv });
    assert(res.fields.invoiceNumber === 'INV-2024-889', 'Invoice number is INV-2024-889, not GSTIN', res.fields.invoiceNumber);
  }

  // Test 14: Invoice number not confused with phone
  console.log('--- Test 14: Invoice number not confused with phone ---');
  {
    const phoneAndInv = `
      CITY ELECTRONICS
      Tel: 9876543210
      Invoice No: CE-771
      Date: 2026-05-12
      Item: iPad Mini
      Serial: IPADMINI8812
      Total: Rs. 44,900
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: phoneAndInv });
    assert(res.fields.invoiceNumber === 'CE-771', 'Invoice number is CE-771, not phone number', res.fields.invoiceNumber);
  }

  // Test 15: IMEI not confused with invoice amount
  console.log('--- Test 15: IMEI not confused with invoice amount ---');
  {
    const imeiAndAmount = `
      MOBILE STORE
      Invoice: MS-101
      Date: 2026-06-01
      OnePlus Nord 4
      IMEI: 869345041234567
      Total Amount: Rs. 29,999
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: imeiAndAmount });
    assert(res.fields.totalAmount === 29999, 'Total amount is ₹29,999, not IMEI digits', `${res.fields.totalAmount}`);
    assert(res.fields.imei === '869345041234567', 'IMEI is correctly assigned');
  }

  // Test 16: Total amount validated
  console.log('--- Test 16: Total amount validated by arithmetic ---');
  {
    const fin = CrossFieldValidator.validateFinancialArithmetic(10000, 1800, 500, 11300);
    assert(fin.matches, 'Financial arithmetic 10000 + 1800 - 500 = 11300 validated');
    assert(fin.calculatedTotal === 11300, 'Calculated total is exactly 11300');
  }

  // Test 17: Legacy GSTIN/address records still load
  console.log('--- Test 17: Legacy GSTIN/address records still load ---');
  {
    const legacyInvoice = {
      productName: 'Legacy Television',
      totalAmount: 45000,
      invoiceDate: '2023-01-10',
      shopName: 'Old Store',
      shopGstin: '07AABCS1429B1Z0',
      shopAddress: 'Old Delhi Road',
      customerPhone: '9811000000',
    };
    const form = invoiceToAssetForm(legacyInvoice);
    assert(form.invoiceMeta?.shopGstin === '07AABCS1429B1Z0', 'Legacy shopGstin preserved in invoiceMeta');
    assert(form.invoiceMeta?.shopAddress === 'Old Delhi Road', 'Legacy shopAddress preserved in invoiceMeta');
    assert(form.invoiceMeta?.customerPhone === '9811000000', 'Legacy customerPhone preserved in invoiceMeta');
  }

  // Test 18: New scan does not write GSTIN/address
  console.log('--- Test 18: New scan does not write GSTIN/address ---');
  {
    const newScanRaw = `
      NEW STORE
      GSTIN: 09AABCS1429B1Z5
      Address: Sector 62, Noida
      Invoice: NS-881
      Date: 2026-09-01
      Item: Sony Headphones
      Serial: SONY882190
      Total: Rs. 14,990
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: newScanRaw });
    // Verify canonical fields and reviewInvoice have zero GSTIN or address keys
    assert(res.fields.shopGstin === undefined, 'No shopGstin in new scan fields');
    assert(res.fields.shopAddress === undefined, 'No shopAddress in new scan fields');
    assert(res.reviewInvoice.shopGstin === undefined, 'No shopGstin in reviewInvoice');
    assert(res.reviewInvoice.shopAddress === undefined, 'No shopAddress in reviewInvoice');
  }

  console.log('\n================================================================');
  console.log('   ✓ ALL 18 PHASE 18 MINIMIZATION & TYPE-DRIVEN TESTS PASSED');
  console.log('================================================================\n');
}

runDataMinimizationTests().catch((err) => {
  console.error('\n✗ Test Suite Crashed:', err);
  process.exit(1);
});

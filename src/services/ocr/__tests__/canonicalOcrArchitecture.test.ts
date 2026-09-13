/**
 * Asset Doctor — Canonical OCR Architecture & Production Hardening Test Suite
 *
 * Comprehensive verification of:
 * - Case A: Electronics Purchase Invoice (Product, IMEI, Serial, Grand Total, Invoice No, Warranty)
 * - Case B: Vehicle Service Invoice (Workshop, Registration, Odometer, Service Date, Grand Total)
 * - Case C: Readable but difficult/thermal receipt
 * - Strict Separation of Image Quality Score and Extraction Confidence
 * - Deterministic Validators (Luhn IMEI, GSTIN, Indian Registration, Odometer Guard, Normalized Dates)
 * - Financial Arithmetic Verification (Subtotal + Taxes - Discounts ≈ Grand Total)
 * - Anti-Misclassification Protections (Negative Disclaimers like "IMEI does not apply")
 */

import { CanonicalOcrPipeline } from '../CanonicalOcrPipeline';
import { CrossFieldValidator } from '../engine/CrossFieldValidator';
import { GrandTotalEngine } from '../engine/GrandTotalEngine';
import { HybridDocumentClassifier } from '../engine/HybridDocumentClassifier';
import { ImageQualityAnalyzer } from '../engine/ImageQualityAnalyzer';
import { RealElectronicsExtractor } from '../extractors/RealElectronicsExtractor';
import { RealVehicleServiceExtractor } from '../extractors/RealVehicleServiceExtractor';
import { RealVehiclePurchaseExtractor } from '../extractors/RealVehiclePurchaseExtractor';
import { RealApplianceExtractor } from '../extractors/RealApplianceExtractor';

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    throw new Error(`Test failed: ${testName} (${detail || ''})`);
  }
  console.log(`  ✓ PASS: ${testName}`);
}

async function runCanonicalOcrArchitectureTests() {
  console.log('================================================================');
  console.log('   CANONICAL OCR ARCHITECTURE & PRODUCTION REGRESSION SUITE');
  console.log('================================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // 1. CrossFieldValidator Deterministic Formats & Checksums
  // ─────────────────────────────────────────────────────────────────
  console.log('--- 1. Deterministic Validators & Checksums ---');
  {
    // GSTIN Validation
    const validGstin = CrossFieldValidator.validateGstin('09ZZZZZ9999Z1ZZ');
    assert(validGstin.valid, 'Valid GSTIN accepted', validGstin.normalized);
    assert(validGstin.metadata?.stateCode === '09', 'GSTIN state code parsed as 09');

    const invalidGstin = CrossFieldValidator.validateGstin('INVALID123');
    assert(!invalidGstin.valid, 'Malformed GSTIN rejected');

    // IMEI Validation & Luhn Algorithm
    // Valid Luhn 15-digit IMEI: 490154203237518
    const validImei = CrossFieldValidator.validateImei('490154203237518');
    assert(validImei.valid, '15-digit Luhn IMEI accepted');
    assert(validImei.metadata?.luhnValid === true, 'Luhn checksum verified');

    // Currency glyph / price cannot be IMEI
    const currencyImei = CrossFieldValidator.validateImei('₹23,999');
    assert(!currencyImei.valid, 'Rupee currency glyph vetoed from IMEI');
    assert(currencyImei.code === 'IMEI_IS_CURRENCY', 'Currency rejection code matches');

    // Indian Registration Plate
    const validReg = CrossFieldValidator.validateIndianRegistration('UP32QU2187');
    assert(validReg.valid, 'Standard UP registration format accepted');
    assert(validReg.metadata?.stateCode === 'UP', 'State code UP parsed');

    const spacedReg = CrossFieldValidator.validateIndianRegistration('UP 32 ZZ 0001');
    assert(spacedReg.valid && spacedReg.normalized === 'UP32ZZ0001', 'Registration normalized without spaces');

    const numericReg = CrossFieldValidator.validateIndianRegistration('135500');
    assert(!numericReg.valid, 'Pure numeric string cannot be registration');

    // Odometer vs Grand Total Guard
    const odoValid = CrossFieldValidator.validateOdometer(12450, { totalAmount: 3706 });
    assert(odoValid.valid && odoValid.normalized === 12450, 'Plausible odometer accepted');

    const odoTrap = CrossFieldValidator.validateOdometer(3706, { totalAmount: 3706 });
    assert(!odoTrap.valid, 'Odometer equaling invoice grand total strictly rejected');
    assert(odoTrap.code === 'ODO_EQUALS_TOTAL_AMOUNT', 'Rejection code indicates total collision');

    // Date Normalization
    const dmyDate = CrossFieldValidator.normalizeDate('27/08/2026');
    assert(dmyDate === '2026-08-27', 'DD/MM/YYYY converted to ISO YYYY-MM-DD');

    const namedDate = CrossFieldValidator.normalizeDate('19-May-2026');
    assert(namedDate === '2026-05-19', 'DD-MMM-YYYY converted to ISO YYYY-MM-DD');

    // Financial Arithmetic
    const arithOk = CrossFieldValidator.validateFinancialArithmetic(23999, 4320, 0, 28319);
    assert(arithOk.matches, 'Subtotal + GST matches Grand Total within allowance');
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. Case A: Electronics Purchase Invoice (Screenshot Case A)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Case A: Electronics Purchase Invoice ---');
  {
    const fixtureText = `
TAX INVOICE
Nothing Technology Limited — Authorized Retailer
Shop 7, Sahara Ganj Mall, Lucknow — 226001
GSTIN: 09ZZZZZ9999Z1ZZ

Invoice No   : NP-INV-2026-1008        Date : 27/08/2026
Customer     : TEST CUSTOMER ONE
Phone        : 9000000001

─────────────────────────────────────────────────────────────────
Sr  Description           HSN    Qty  Unit Price   Total
─────────────────────────────────────────────────────────────────
1   Nothing Phone (2a)   8517     1   23,999    23,999
    IMEI 1  : 490154203237518
    IMEI 2  : 490154203237519
    Serial  : NP2A8X91K2TEST
    Colour  : Black
─────────────────────────────────────────────────────────────────
    Subtotal                                       23,999
    CGST @ 9%                                       2,160
    SGST @ 9%                                       2,160
─────────────────────────────────────────────────────────────────
    Grand Total                          Rs.     28,319
─────────────────────────────────────────────────────────────────
Warranty: 1 Year Manufacturer Warranty
Amount in Words: Twenty Eight Thousand Three Hundred Nineteen Only
    `.trim();

    const res = await CanonicalOcrPipeline.process({ imageUri: fixtureText });

    assert(res.documentType === 'ELECTRONICS_PURCHASE_INVOICE', 'Classified as ELECTRONICS_PURCHASE_INVOICE');
    assert(res.fields.productName?.includes('Nothing Phone'), 'Product name extracted as Nothing Phone');
    assert(res.fields.imei === '490154203237518', 'Primary IMEI extracted with Luhn validity');
    assert(res.fields.serialNumber === 'NP2A8X91K2TEST', 'Serial number extracted and not confused with amount');
    assert(res.fields.totalAmount === 28319, 'Grand Total extracted as ₹28,319');
    assert(res.fields.invoiceNumber === 'NP-INV-2026-1008', 'Invoice number extracted correctly');
    assert(res.fields.shopGstin === undefined, 'GSTIN omitted from canonical output per data minimization');
    assert(res.extractionConfidence >= 0.90, 'High extraction confidence (>= 90%)', String(res.extractionConfidence));
    assert(res.status === 'EXTRACTED', 'Status is EXTRACTED');
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. Case B: Vehicle Service Invoice (Screenshot Case B)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Case B: Vehicle Service Invoice ---');
  {
    const fixtureText = `
JOB CARD / SERVICE INVOICE
Sunrise Motors — Authorized TVS Service Centre
Plot 14, Industrial Area, Lucknow — 226016
GSTIN: 09ZZZZZ9999Z1ZZ

Job Card No  : JC-2026-08871
Invoice No   : SVC-2026-08871
Service Date : 27/08/2026

Customer Name: TEST CUSTOMER ONE
Phone        : 9000000001

Vehicle Details:
  Registration No : UP32ZZ0001
  Chassis No      : MD637ZZ11Z2F00001
  Engine No       : BNIFS9900001
  Model           : TVS Ronin 225
  Odometer        : 12450 KM
  Fuel Level      : Half

Labour & Parts:
  Parts Subtotal                   1,290
  Labour Charges                   1,850
  ─────────────────────────────────
  Subtotal                         3,140
  CGST @ 9%                          283
  SGST @ 9%                          283
  ─────────────────────────────────
  Grand Total                      3,706
  ─────────────────────────────────

Next service due at 18000 KM or 6 months.
    `.trim();

    const res = await CanonicalOcrPipeline.process({ imageUri: fixtureText });

    assert(res.documentType === 'VEHICLE_SERVICE_INVOICE', 'Classified as VEHICLE_SERVICE_INVOICE');
    assert(res.fields.shopName?.includes('Sunrise Motors'), 'Workshop name extracted as Sunrise Motors');
    assert(res.fields.registration === 'UP32ZZ0001', 'Registration extracted as UP32ZZ0001');
    assert(res.fields.odometerKm === 12450, 'Odometer correctly extracted as 12,450 km (NOT 3,706)');
    assert(res.fields.totalAmount === 3706, 'Grand Total extracted as ₹3,706');
    assert(res.fields.labourCharges === 1850, 'Labour charges extracted as ₹1,850');
    assert(res.fields.partsTotal === 1290, 'Parts subtotal extracted as ₹1,290');
    assert(res.fields.invoiceDate === '2026-08-27', 'Service date normalized');
    assert(res.status === 'EXTRACTED', 'Status is EXTRACTED');
    assert(res.extractionConfidence >= 0.90, 'Extraction confidence >= 90%');
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. Case C: Readable but Difficult / Thermal Receipt
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Case C: Readable Thermal Receipt (No 43% False Poor Scan) ---');
  {
    const thermalText = `
TAX INVOICE
CAFE COFFEE DAY
SHOP 4, CONNAUGHT PLACE, NEW DELHI
GSTIN: 07AAACG8888F1Z2
DATE: 15/09/2026  TIME: 14:30
BILL NO: CCD-99210

1  CAPPUCCINO REG       180.00
1  CHOCOLATE CROISSANT  160.00
------------------------------
SUBTOTAL                340.00
CGST @ 2.5%               8.50
SGST @ 2.5%               8.50
------------------------------
NET PAYABLE             357.00
------------------------------
THANK YOU VISIT AGAIN
    `.trim();

    const res = await CanonicalOcrPipeline.process({ imageUri: thermalText });

    assert(res.documentType === 'GENERIC_INVOICE', 'Thermal receipt classified as GENERIC_INVOICE');
    assert(res.fields.totalAmount === 357, 'Grand total extracted as ₹357');
    assert(res.fields.invoiceNumber === 'CCD-99210', 'Bill number extracted as CCD-99210');
    assert(res.imageQualityScore >= 80, 'Image quality score separates from size penalties', String(res.imageQualityScore));
    assert(res.status !== 'POOR_SCAN', 'Readable thermal receipt is NEVER rejected as POOR_SCAN');
    assert(res.needsRetake === false, 'needsRetake is false for readable receipt');
  }

  // ─────────────────────────────────────────────────────────────────
  // 5. Anti-Misclassification Protections (Negative Disclaimers)
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Anti-Misclassification Protections ---');
  {
    // Vehicle Invoice with "The IMEI field does not apply" must NOT become ELECTRONICS_INVOICE
    const vehicleWithImeiDisclaimer = `
TAX INVOICE
TVS Authorized Dealer — Sunrise Motors
Registration No : UP32ZZ0001
Chassis / Frame : MD637ZZ11Z2F00001
Engine No       : BNIFS9900001
Ex-Showroom Price : 1,35,500
Grand Total       : 1,80,900
NOTE: The IMEI field does not apply to vehicles.
    `.trim();

    const clf = HybridDocumentClassifier.classify(vehicleWithImeiDisclaimer);
    assert(clf.documentType === 'VEHICLE_PURCHASE_INVOICE', 'Vehicle disclaimer with "IMEI" does NOT become electronics');
    assert(clf.suggestedCategory === 'VEHICLE', 'Category is VEHICLE');

    // Home Appliance with "Serial No" must NOT become ELECTRONICS_INVOICE
    const acInvoice = `
TAX INVOICE
Voltas 1.5 Ton Split AC 5 Star Inverter
Indoor S/N : VOLT-AC-109281
Outdoor S/N : VOLT-OD-992182
Compressor Warranty : 10 Years
Subtotal : 38,000
Grand Total : 44,840
    `.trim();

    const acClf = HybridDocumentClassifier.classify(acInvoice);
    assert(acClf.documentType === 'HOME_APPLIANCE_INVOICE', 'Appliance with serial does NOT become electronics');
    assert(acClf.suggestedCategory === 'APPLIANCE', 'Category is APPLIANCE');
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. GrandTotalEngine Arithmetic Proof Boost
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 6. GrandTotalEngine Arithmetic Proof Boost ---');
  {
    const financialText = `
Parts Subtotal : 5,000.00
Labour Charges : 2,000.00
GST @ 18%      : 1,260.00
Amount Payable : 8,260.00
    `.trim();

    const fin = GrandTotalEngine.extractFinancials(financialText);
    assert(fin.grandTotal === 8260, 'Grand total extracted as 8,260');
    assert(fin.validatedByArithmetic === true, 'Mathematically verified by arithmetic breakdown');
    assert(fin.confidence === 0.99, 'Confidence boosted to 0.99 by mathematical proof');
  }

  // ─────────────────────────────────────────────────────────────────
  // 7. Quality Analyzer: Honest Separation of Scores
  // ─────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Quality Analyzer: Honest Separation of Scores ---');
  {
    // High-resolution capture with text
    const goodCapture = ImageQualityAnalyzer.assessQuality({
      width: 1920,
      height: 1080,
      textLength: 350,
      linesCount: 15,
      fileBytes: 25000, // Small compressed file
    });
    assert(goodCapture.ok, 'High-resolution capture is OK');
    assert(goodCapture.imageQualityScore >= 88, 'Not penalized for small file size', String(goodCapture.imageQualityScore));

    // Blurry / cropped low resolution
    const poorCapture = ImageQualityAnalyzer.assessQuality({
      width: 200,
      height: 200,
      textLength: 0,
      linesCount: 0,
    });
    assert(!poorCapture.ok, 'Low resolution (< 320px) fails quality gate');
    assert(poorCapture.needsRetake === true, 'needsRetake is true');
    assert(poorCapture.tips.length > 0, 'Actionable tips provided');
  }

  console.log('\n================================================================');
  console.log('   RESULT: All Canonical OCR Architecture Tests PASSED');
  console.log('================================================================\n');
}

runCanonicalOcrArchitectureTests().catch((e) => {
  console.error(e);
  process.exit(1);
});

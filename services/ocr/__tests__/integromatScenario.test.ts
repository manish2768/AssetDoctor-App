/**
 * Asset Doctor — Phase 3: Integromat / Make Production Intelligence Scenario Test Suite
 */

import { IntegromatScenarioEngine } from '../integromatScenarioEngine.ts';
import type { Asset } from '../../../src/types.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function runIntegromatSuite() {
  console.log('================================================================');
  console.log('ASSET DOCTOR — PHASE 3: INTEGROMAT / MAKE SCENARIO AUDIT');
  console.log('================================================================\n');

  const existingVaultAssets: Asset[] = [
    {
      assetId: 'ast_ronin_01',
      id: 'ast_ronin_01',
      assetName: 'TVS Ronin',
      registration: 'UP32QU2187',
      chassisNumber: 'MD637AN11S2F03328',
      engineNumber: 'BN1FS2302943',
      status: 'active',
    } as any,
  ];

  // -------------------------------------------------------------------------
  // TEST 1: ICICI Lombard Motor Insurance Policy Scenario
  // -------------------------------------------------------------------------
  console.log('--- 1. SCENARIO EXECUTION: ICICI LOMBARD MOTOR INSURANCE ---');
  const iciciText = `
    ICICI Lombard General Insurance Company Limited
    Policy Certificate cum Schedule
    Two Wheeler Package Policy
    Policy Number: 3005/2024/09871234
    Period of Insurance: From 15-Sep-2024 to 14-Sep-2025
    Insured Name: Manish Kumar
    Vehicle Registration No: UP32QU2187
    Make / Model: TVS Ronin 225
    Engine No: BN1FS2302943
    Chassis No: MD637AN11S2F03328
    IDV (Insured Declared Value): Rs. 1,42,500
    Total Premium Payable: Rs. 2,450.00
    Net Premium: 2076.00
    GST @ 18%: 374.00
  `;

  const outA = await IntegromatScenarioEngine.executeScenario({
    rawText: iciciText,
    existingAssets: existingVaultAssets,
  });

  assert(outA.success === true, 'Scenario completed successfully');
  assert(outA.traceId.startsWith('scan_'), `Generated valid Trace ID: ${outA.traceId}`);
  assert(outA.documentType === 'INSURANCE_POLICY', 'Correct early classification: INSURANCE_POLICY');
  assert(outA.fields.length >= 7, `Extracted ${outA.fields.length} structured fields`);

  // Verify strict Field Evidence contract schema
  const regField = outA.fields.find((f) => f.field === 'vehicleRegistration');
  assert(regField?.value === 'UP32QU2187', 'Extracted registration UP32QU2187');
  assert(regField?.trustState === 'VERIFIED', 'trustState is VERIFIED with matching evidence');
  assert(regField?.evidenceText === 'UP32QU2187', 'evidenceText matches text haystack');
  assert(typeof regField?.confidence === 'number' && regField.confidence >= 0.0 && regField.confidence <= 1.0, 'Confidence is strict Float in [0.0, 1.0]');

  // Asset Matching Isolation
  assert(outA.assetMatch.matchedAssetId === 'ast_ronin_01', 'Securely linked to TVS Ronin asset in vault');
  assert(outA.assetMatch.isAutoLinked === true, 'isAutoLinked is true on exact registration match');

  // -------------------------------------------------------------------------
  // TEST 2: TVS Ronin Vehicle Service Invoice Scenario
  // -------------------------------------------------------------------------
  console.log('\n--- 2. SCENARIO EXECUTION: TVS RONIN SERVICE INVOICE ---');
  const tvsText = `
    TAAR MOTO LEGENDS PVT LTD
    TVS Authorized Main Dealer
    GSTIN: 09AAMCR8158M1Z1
    TAX INVOICE / BILL OF SUPPLY
    Invoice No: TML/24-25/088583
    Invoice Date: 20/08/2024
    Customer: Manish Kumar   Phone: 9876543210
    Vehicle Reg: UP32QU2187
    Model: TVS RONIN
    Frame No / Chassis: MD637AN11S2F03328
    Engine No: BN1FS2302943
    Odometer / KM Reading: 12,450 km
    Labour Amount: 0.00
    Parts Amount: 220.34
    Taxable Amount: 220.34
    CGST 9%: 19.83
    SGST 9%: 19.83
    Grand Total: 260.00
  `;

  const outB = await IntegromatScenarioEngine.executeScenario({
    rawText: tvsText,
    existingAssets: existingVaultAssets,
  });

  assert(outB.documentType === 'SERVICE_INVOICE', 'Classified as SERVICE_INVOICE');
  const odoField = outB.fields.find((f) => f.field === 'odometerKm');
  assert(odoField?.value === 12450, 'Extracted Odometer: 12,450 KM');
  assert(odoField?.trustState === 'VERIFIED', 'Odometer trustState is VERIFIED');

  const totalField = outB.fields.find((f) => f.field === 'grandTotal');
  assert(totalField?.value === 260, 'Extracted Grand Total: ₹260');

  // Negative Table Header Check
  const qtyField = outB.fields.find((f) => f.field === 'productName' && String(f.value).toLowerCase() === 'qty');
  assert(qtyField === undefined, 'Table header "Qty" is NOT mapped to Product Name');

  // -------------------------------------------------------------------------
  // TEST 3: Nothing Phone Purchase Invoice Scenario
  // -------------------------------------------------------------------------
  console.log('\n--- 3. SCENARIO EXECUTION: NOTHING PHONE PURCHASE INVOICE ---');
  const nothingText = `
    Cloudtail India Private Limited / Cloudstore Retail
    Tax Invoice / Bill of Supply
    Invoice Number: DEL-2024-998811
    Date: 12-07-2024
    Customer: Manish Kumar
    Item Description: Nothing Phone (2a) 5G Black 128GB
    IMEI 1: 869910012345678
    Serial Number: NP2A-BLK-998877
    HSN: 85171300
    Qty: 1
    Price: 22000.00
    IGST 18%: 3960.00
    Grand Total: 25960.00
  `;

  const outC = await IntegromatScenarioEngine.executeScenario({
    rawText: nothingText,
    existingAssets: existingVaultAssets,
  });

  assert(outC.documentType === 'ELECTRONICS_PURCHASE_INVOICE', 'Classified as ELECTRONICS_PURCHASE_INVOICE');
  const imeiField = outC.fields.find((f) => f.field === 'imei');
  assert(imeiField?.value === '869910012345678', 'Extracted IMEI: 869910012345678');
  assert(imeiField?.trustState === 'VERIFIED', '15-digit Luhn IMEI trustState is VERIFIED');

  const phoneTotal = outC.fields.find((f) => f.field === 'grandTotal');
  assert(phoneTotal?.value === 25960, 'Grand Total is ₹25,960 (NOT ₹1)');

  // Asset Matching Isolation (Nothing Phone must NOT link to TVS Ronin)
  assert(outC.assetMatch.matchedAssetId === null, 'Asset isolation: Electronics invoice NOT linked to vehicle');
  assert(outC.assetMatch.isAutoLinked === false, 'isAutoLinked is false for new electronics asset');

  // -------------------------------------------------------------------------
  // TEST 4: Performance Profiling & Latency Breakdown (Observability)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. PERFORMANCE PROFILING & OBSERVABILITY ---');
  const m = outA.metrics;
  console.log(`  [Trace ID]          : ${m.traceId}`);
  console.log(`  [Preprocessing]     : ${m.preprocessing_ms} ms`);
  console.log(`  [ML Kit OCR]        : ${m.mlkit_ms} ms`);
  console.log(`  [Google Vision]     : ${m.googleVision_ms} ms`);
  console.log(`  [Azure Fallback]    : ${m.azure_ms} ms (fallbackUsed: ${m.fallbackUsed})`);
  console.log(`  [Classification]    : ${m.classification_ms} ms`);
  console.log(`  [Extraction]        : ${m.extraction_ms} ms`);
  console.log(`  [Gemini AI]         : ${m.gemini_ms} ms`);
  console.log(`  [Validation]        : ${m.validation_ms} ms`);
  console.log(`  [Asset Matching]    : ${m.matching_ms} ms`);
  console.log(`  [Firestore Logging] : ${m.firestore_ms} ms`);
  console.log(`  [Total Duration]    : ${m.total_ms} ms`);

  assert(m.gemini_ms === 0, 'Gemini LLM calls = 0 on normal flow (No unnecessary AI expense)');
  assert(m.azure_ms === 0, 'Azure Vision calls = 0 on normal flow (Circuit breaker skipped)');
  assert(m.total_ms < 500, `Scenario executes rapidly within ${m.total_ms} ms`);

  console.log('\n================================================================');
  console.log(`INTEGROMAT AUDIT RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runIntegromatSuite().catch((err) => {
  console.error('[INTEGROMAT AUDIT ERROR]', err);
  process.exit(1);
});

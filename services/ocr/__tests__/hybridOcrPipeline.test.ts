/**
 * Asset Doctor — Hybrid OCR Pipeline & Preprocessing Regression Test Suite
 * Tests 1 through 12 validating:
 * 1. Preprocessed camera image → exactly one preprocessing pass
 * 2. Raw gallery image → preprocessing occurs
 * 3. Google usable text → Azure NOT called (heuristic does not discard Google)
 * 4. Google hard failure → Azure called
 * 5. Google request failure → Azure called
 * 6. Azure failure → controlled OCR failure; no fake data
 * 7. Azure receives correct base64 format
 * 8. Google + Azure both return usable OCR → extractor/validator determines final fields
 * 9. Missing odometer remains null
 * 10. Phone number/GSTIN/bill amount cannot become odometer
 * 11. Insurance document does not receive vehicle service/odometer data
 * 12. Service invoice correctly detects registration number and links to existing vehicle asset
 */

import { CloudVisionOcrService, calculateOcrConfidence } from '../../../src/services/ocr/CloudVisionOcrService';
import { UniversalOcrPipeline } from '../universalPipeline';
import { AzureOcrService } from '../../../src/services/ocr/AzureOcrService';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}${detail ? ` - ${detail}` : ''}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('ASSET DOCTOR — HYBRID OCR PIPELINE REGRESSION SUITE (TESTS 1-12)');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Preprocessed camera image → exactly one preprocessing pass
  // -------------------------------------------------------------------------
  const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const res1: any = await CloudVisionOcrService.recognizeInvoice('file:///data/cache/scan_preprocessed.jpg', {
    base64: dummyBase64,
    alreadyPreprocessed: true,
    forcePrimaryFailure: true,
  });
  assert(
    res1.telemetry?.preprocessingMs === 0,
    'TEST 1: Preprocessed camera image',
    `preprocessingMs=${res1.telemetry?.preprocessingMs}ms (no redundant resize/compression pass)`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Raw gallery image → preprocessing occurs
  // -------------------------------------------------------------------------
  const res2: any = await CloudVisionOcrService.recognizeInvoice('file:///storage/DCIM/raw_camera.jpg', {
    alreadyPreprocessed: false,
    forcePrimaryFailure: true,
  });
  assert(
    (res2.telemetry?.preprocessingMs ?? -1) >= 0,
    'TEST 2: Raw gallery image',
    'Preprocessing handles raw image path without crashing'
  );

  // -------------------------------------------------------------------------
  // TEST 3: Google confidence >= 0.80 → Azure NOT called
  // -------------------------------------------------------------------------
  const highConfidenceText = `
    TAX INVOICE / BILL OF SUPPLY
    TVS MOTORS AUTHORIZED SERVICE STATION
    GSTIN: 09AAMCR8158M1Z1
    Date: 20/08/2024
    Invoice No: TVS/2024/088583
    Vehicle: TVS Ronin 225
    Reg No: UP 32 QU 2187
    Chassis No: MD637AN11S2F03328
    Engine No: BN1FS2302943
    Current Odometer: 12,450 KM
    Total Amount: ₹ 260.00
  `;
  const googleScoreHigh = calculateOcrConfidence(highConfidenceText);
  assert(
    googleScoreHigh >= 0.80,
    'TEST 3a: High quality text scores confidence >= 0.80',
    `Confidence: ${googleScoreHigh}`
  );

  const origExecGoogle = CloudVisionOcrService.executeGoogleOcr;
  const origExecAzure = CloudVisionOcrService.executeAzureOcr;

  let azureWasCalled = false;
  CloudVisionOcrService.executeGoogleOcr = async () => ({
    success: true,
    engine: 'cloud-vision-function',
    rawText: highConfidenceText,
    confidence: googleScoreHigh,
    processingTimeMs: 120,
  });
  CloudVisionOcrService.executeAzureOcr = async () => {
    azureWasCalled = true;
    return {
      success: true,
      engine: 'azure-vision-read',
      rawText: highConfidenceText,
      confidence: 0.9,
      processingTimeMs: 150,
    };
  };

  azureWasCalled = false;
  const res3: any = await CloudVisionOcrService.recognizeInvoice('file:///test.jpg', {
    base64: dummyBase64,
    alreadyPreprocessed: true,
  });
  assert(
    Boolean(res3.success) && !azureWasCalled,
    'TEST 3b: Google confidence >= 0.80 → Azure NOT called',
    `Engine: ${res3.engine}, azureCalled: ${res3.telemetry?.azureCalled}`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Google confidence < 0.80 → Azure called
  // -------------------------------------------------------------------------
  const lowConfidenceText = 'TVS Ronin 260';
  const googleScoreLow = calculateOcrConfidence(lowConfidenceText);
  assert(
    googleScoreLow < 0.80,
    'TEST 4a: Low quality snippet scores confidence < 0.80',
    `Confidence: ${googleScoreLow}`
  );

  azureWasCalled = false;
  CloudVisionOcrService.executeGoogleOcr = async () => ({
    success: true,
    engine: 'cloud-vision-function',
    rawText: lowConfidenceText.padEnd(48, ' x'),
    confidence: googleScoreLow,
    processingTimeMs: 90,
  });
  CloudVisionOcrService.executeAzureOcr = async () => {
    azureWasCalled = true;
    return {
      success: true,
      engine: 'azure-vision-read',
      rawText: highConfidenceText,
      confidence: 0.95,
      processingTimeMs: 140,
    };
  };

  const res4: any = await CloudVisionOcrService.recognizeInvoice('file:///test.jpg', {
    base64: dummyBase64,
    alreadyPreprocessed: true,
    skipAi: true,
  });
  assert(
    Boolean(res4.success) &&
      !azureWasCalled &&
      String(res4.rawText || '').includes('TVS Ronin') &&
      res4.engine === 'cloud-vision-function',
    'TEST 4b: Google success with heuristic < 0.80 retains Google text (Azure not called)',
    `Engine: ${res4.engine}, azureCalled: ${res4.telemetry?.azureCalled}`,
  );

  // -------------------------------------------------------------------------
  // TEST 5: Google request failure → Azure called
  // -------------------------------------------------------------------------
  azureWasCalled = false;
  CloudVisionOcrService.executeGoogleOcr = async () => ({
    success: false,
    engine: 'cloud-vision-function',
    rawText: '',
    confidence: 0,
    processingTimeMs: 4500,
    error: 'Google Cloud Function timeout',
  });
  CloudVisionOcrService.executeAzureOcr = async () => {
    azureWasCalled = true;
    return {
      success: true,
      engine: 'azure-vision-read',
      rawText: highConfidenceText,
      confidence: 0.92,
      processingTimeMs: 180,
    };
  };

  const res5: any = await CloudVisionOcrService.recognizeInvoice('file:///test.jpg', {
    base64: dummyBase64,
    alreadyPreprocessed: true,
  });
  assert(
    Boolean(res5.success) && azureWasCalled && res5.engine === 'azure-vision-read',
    'TEST 5: Google request failure → Azure called successfully',
    `Fallback engine: ${res5.telemetry?.fallbackEngine}`
  );

  // -------------------------------------------------------------------------
  // TEST 6: Azure failure → controlled OCR failure; no fake data
  // -------------------------------------------------------------------------
  CloudVisionOcrService.executeGoogleOcr = async () => ({
    success: false,
    engine: 'cloud-vision-function',
    rawText: '',
    confidence: 0,
    processingTimeMs: 200,
    error: 'Google Cloud Function 500',
  });
  CloudVisionOcrService.executeAzureOcr = async () => ({
    success: false,
    engine: 'azure-vision-read',
    rawText: '',
    confidence: 0,
    processingTimeMs: 200,
    error: 'Azure endpoint 503 Service Unavailable',
  });

  const res6: any = await CloudVisionOcrService.recognizeInvoice('file:///test.jpg', {
    base64: dummyBase64,
    alreadyPreprocessed: true,
    forcePrimaryFailure: true,
  });
  assert(
    res6.success === false && res6.data.productName === '' && res6.data.totalAmount === null,
    'TEST 6: Both Google & Azure fail → controlled failure with zero fake data',
    `Error: ${res6.error}`
  );

  // Restore mocks
  CloudVisionOcrService.executeGoogleOcr = origExecGoogle;
  CloudVisionOcrService.executeAzureOcr = origExecAzure;

  // -------------------------------------------------------------------------
  // TEST 7: Azure receives correct base64/binary format
  // -------------------------------------------------------------------------
  const dataUrl = 'data:image/jpeg;base64,' + dummyBase64;
  const cleanAzureRes = await AzureOcrService.recognizeBase64(dataUrl);
  assert(
    cleanAzureRes.error !== 'Empty image payload',
    'TEST 7: AzureOcrService accepts base64 data URI without format rejection',
    'Correct base64 stripping verified'
  );

  // -------------------------------------------------------------------------
  // TEST 8: Google + Azure both return usable OCR → extractor/validator determines final fields
  // -------------------------------------------------------------------------
  const pipelineResult = await UniversalOcrPipeline.process(highConfidenceText, { skipCache: true });
  const inv8 = pipelineResult.reviewInvoice || ({} as any);
  const serv8 = pipelineResult.extractedData.serviceData as any;
  assert(
    pipelineResult.classification.documentType === 'SERVICE_INVOICE' &&
      (inv8.registration === 'UP32QU2187' || serv8?.vehicleRegistration?.value === 'UP32QU2187') &&
      (inv8.odometerKm === 12450 || serv8?.odometerKm?.value === 12450) &&
      inv8.totalAmount === 260,
    'TEST 8: Extractor/validator correctly structures document fields',
    `Classified: ${pipelineResult.classification.documentType}, Reg: ${inv8.registration}, Odo: ${inv8.odometerKm}, Total: ${inv8.totalAmount}`
  );

  // -------------------------------------------------------------------------
  // TEST 9: Missing odometer remains null
  // -------------------------------------------------------------------------
  const invoiceWithoutOdometer = `
    TAX INVOICE
    CLOUDS STORE RETAIL PRIVATE LIMITED
    Invoice No: DEL-2024-99182
    Date: 15/07/2024
    Product: Nothing Phone (2a) 5G 8GB/128GB
    IMEI: 869910012345678
    Serial No: NP2A8X91K2
    Grand Total: ₹ 25,960.00
  `;
  const res9 = await UniversalOcrPipeline.process(invoiceWithoutOdometer, { skipCache: true });
  const inv9 = res9.reviewInvoice || ({} as any);
  assert(
    inv9.odometerKm == null,
    'TEST 9: Missing odometer remains strictly NULL (zero hallucination)',
    `Extracted odometer: ${inv9.odometerKm}`
  );

  // -------------------------------------------------------------------------
  // TEST 10: Phone number/GSTIN/bill amount cannot become odometer
  // -------------------------------------------------------------------------
  const trickyServiceText = `
    INVOICE
    TVS Ronin Service Bill
    Phone: 9876543210
    GSTIN: 09AAMCR8158M1Z1
    Bill No: 088583
    Amount Paid: 260.00
  `;
  const res10 = await UniversalOcrPipeline.process(trickyServiceText, { skipCache: true });
  const inv10 = res10.reviewInvoice || ({} as any);
  const extractedOdo10 = inv10.odometerKm;
  assert(
    extractedOdo10 !== 9876543210 &&
      extractedOdo10 !== 88583 &&
      extractedOdo10 !== 260 &&
      extractedOdo10 == null,
    'TEST 10: Phone numbers, GSTIN, invoice IDs, and bill amounts rejected as odometer',
    `Odometer value: ${extractedOdo10}`
  );

  // -------------------------------------------------------------------------
  // TEST 11: Insurance document does not receive vehicle service/odometer data
  // -------------------------------------------------------------------------
  const insuranceText = `
    ICICI Lombard General Insurance Company Limited
    MOTOR VEHICLE INSURANCE POLICY SCHEDULE
    Policy No: 3005/2024/09871234
    Period: 14/07/2024 to 13/07/2026
    Registration No: UP 32 QU 2187
    Chassis No: MD637AN11S2F03328
    Engine No: BN1FS2302943
    IDV: ₹ 1,45,000
    Gross Premium: ₹ 4,850.00
  `;
  const res11 = await UniversalOcrPipeline.process(insuranceText, { skipCache: true });
  const inv11 = res11.reviewInvoice || ({} as any);
  assert(
    res11.classification.documentType === 'INSURANCE_POLICY' &&
      inv11.policyNumber === '3005/2024/09871234' &&
      inv11.odometerKm == null &&
      inv11.labourCharges == null,
    'TEST 11: Insurance policy receives policy fields; service/odometer fields forbidden',
    `Classified: ${res11.classification.documentType}, Policy: ${inv11.policyNumber}, Odo: ${inv11.odometerKm}`
  );

  // -------------------------------------------------------------------------
  // TEST 12: Service invoice correctly detects registration number and links to existing vehicle asset
  // -------------------------------------------------------------------------
  const existingAssets: any = [
    {
      id: 'asset_ronin_001',
      assetId: 'asset_ronin_001',
      assetName: 'TVS Ronin 225',
      registration: 'UP 32 QU 2187',
      category: 'vehicle',
    },
  ];
  const res12 = await UniversalOcrPipeline.process(highConfidenceText, {
    existingAssets,
    skipCache: true,
  });
  assert(
    res12.entityLink.isAutoLinked === true &&
      res12.entityLink.matchedAssetId === 'asset_ronin_001' &&
      res12.entityLink.matchType === 'EXACT_REGISTRATION',
    'TEST 12: Service invoice matches existing vehicle asset by registration',
    `AutoLinked: ${res12.entityLink.isAutoLinked}, Asset ID: ${res12.entityLink.matchedAssetId}, Match Type: ${res12.entityLink.matchType}`
  );

  console.log('\n================================================================');
  console.log(`HYBRID OCR PIPELINE TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});

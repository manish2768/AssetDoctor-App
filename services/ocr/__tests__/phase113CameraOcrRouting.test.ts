/**
 * Phase 11.3 — Real camera OCR routing + latency regression.
 *
 * Kind: SYNTHETIC / UNIT / INTEGRATION (mocked providers).
 * NOT real-camera, real-device, or live Google/Azure API.
 */

import { CloudVisionOcrService, calculateOcrConfidence } from '../../../src/services/ocr/CloudVisionOcrService.js';
import {
  TOTAL_OCR_PROVIDER_BUDGET_MS,
  PROVIDER_ATTEMPT_TIMEOUT_MS,
  MIN_RETRY_BUDGET_MS,
  remainingOcrBudgetMs,
  computeProviderAttemptTimeoutMs,
  shouldRetryWithinBudget,
  shouldCallCloudOcr,
  shouldCallAzureFallback,
  shouldRunSecondMlKit,
  selectOcrRawText,
  resolveOcrProviderWinner,
  sanitizeOcrTelemetry,
} from '../../../src/services/ocr/ocrProviderOrchestrator.js';
import {
  planScanResize,
  shouldReencodeAlreadyPreprocessedImage,
  prepareScanImageForOcr,
  PREPROCESS_MAX_WIDTH,
} from '../../../src/services/ocr/scanImagePreprocess.js';
import { scoreScanQualitySignals } from '../../../src/services/ocr/scanQualityGate.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed += 1;
  } else {
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const DUMMY_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const HIGH_TEXT = `
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

const LOW_HEURISTIC_TEXT =
  'TVS Ronin motorcycle workshop copy without dates or totals xx';

async function withProviderMocks(run: () => Promise<void>) {
  const origGoogle = CloudVisionOcrService.executeGoogleOcr;
  const origAzure = CloudVisionOcrService.executeAzureOcr;
  const origMlKit = CloudVisionOcrService.recognizeTextViaMlKit;
  try {
    await run();
  } finally {
    CloudVisionOcrService.executeGoogleOcr = origGoogle;
    CloudVisionOcrService.executeAzureOcr = origAzure;
    CloudVisionOcrService.recognizeTextViaMlKit = origMlKit;
  }
}

export async function runPhase113CameraOcrRoutingSuite() {
  console.log('================================================================');
  console.log('ASSET DOCTOR — PHASE 11.3 CAMERA OCR ROUTING (SYNTHETIC)');
  console.log('================================================================\n');

  console.log('--- 1. ML Kit 0.86 does not skip cloud ---');
  assert(
    shouldCallCloudOcr({ mlKitConfidence: 0.86 }) === true,
    'shouldCallCloudOcr stays true at ML Kit heuristic 0.86',
  );
  assert(
    shouldCallCloudOcr({ mlKitConfidence: 0.86, skipCloudOcr: true }) === false,
    'Cloud skipped only when skipCloudOcr is explicit',
  );

  await withProviderMocks(async () => {
    let googleCalled = false as boolean;
    let mlKitCalls = 0;
    CloudVisionOcrService.recognizeTextViaMlKit = async () => {
      mlKitCalls += 1;
      return { success: true, text: HIGH_TEXT };
    };
    CloudVisionOcrService.executeGoogleOcr = async () => {
      googleCalled = true;
      return {
        success: true,
        engine: 'cloud-vision-function',
        rawText: HIGH_TEXT,
        confidence: 0.92,
        processingTimeMs: 80,
      };
    };
    CloudVisionOcrService.executeAzureOcr = async () => ({
      success: false,
      engine: 'azure-vision-read',
      rawText: '',
      confidence: 0,
      processingTimeMs: 0,
      error: 'azure should not run',
    });
    const res: any = await CloudVisionOcrService.recognizeInvoice('file:///cam.jpg', {
      base64: DUMMY_B64,
      alreadyPreprocessed: true,
      skipAi: true,
    });
    assert(googleCalled === true, 'ML Kit 0.86 path still calls Google', `googleCalled=${googleCalled}`);
    assert(
      res.telemetry?.googleCalled === true && String(res.engine || '').includes('cloud-vision'),
      'Winner is Google, not a silent ML Kit skip',
      `engine=${res.engine}`,
    );
    assert(mlKitCalls === 1, 'ML Kit runs once as a candidate, not as a hard skip', `mlKitCalls=${mlKitCalls}`);
  });

  console.log('\n--- 2. Google rawText with heuristic 0.79 is retained ---');
  const lowScore = calculateOcrConfidence(LOW_HEURISTIC_TEXT);
  assert(LOW_HEURISTIC_TEXT.trim().length > 20 && lowScore < 0.8, 'Fixture is usable but heuristic < 0.8', `score=${lowScore}`);
  await withProviderMocks(async () => {
    let azureCalled = false;
    CloudVisionOcrService.recognizeTextViaMlKit = async () =>
      ({ success: false, text: '', error: 'skip' } as any);
    CloudVisionOcrService.executeGoogleOcr = async () => ({
      success: true,
      engine: 'cloud-vision-function',
      rawText: LOW_HEURISTIC_TEXT,
      confidence: lowScore,
      processingTimeMs: 70,
    });
    CloudVisionOcrService.executeAzureOcr = async () => {
      azureCalled = true;
      return {
        success: true,
        engine: 'azure-vision-read',
        rawText: HIGH_TEXT,
        confidence: 0.95,
        processingTimeMs: 40,
      };
    };
    const res: any = await CloudVisionOcrService.recognizeInvoice('file:///cam.jpg', {
      base64: DUMMY_B64,
      alreadyPreprocessed: true,
      skipAi: true,
    });
    assert(
      res.success === true &&
        String(res.rawText || '').includes('TVS Ronin motorcycle') &&
        azureCalled === false &&
        res.engine === 'cloud-vision-function',
      'Successful Google text is kept; Azure not used for heuristic < 0.8',
      `engine=${res.engine} azure=${azureCalled}`,
    );
  });

  console.log('\n--- 3–5. Provider winner ---');
  const googleOk = {
    success: true,
    engine: 'cloud-vision-function',
    rawText: `${HIGH_TEXT}`,
    confidence: 0.79,
  };
  const azureFail = {
    success: false,
    engine: 'azure-vision-read',
    rawText: '',
    confidence: 0,
  };
  const azureOk = {
    success: true,
    engine: 'azure-vision-read',
    rawText: HIGH_TEXT.replace('260.00', '261.00'),
    confidence: 0.94,
  };
  const googleFail = {
    success: false,
    engine: 'cloud-vision-function',
    rawText: '',
    confidence: 0,
  };

  const gKeep = selectOcrRawText({ googleResult: googleOk, azureResult: azureFail });
  assert(
    gKeep.engine === 'cloud-vision-function' && gKeep.rawText.includes('UP 32 QU 2187'),
    'Google success + Azure failure → Google retained',
  );

  const aKeep = selectOcrRawText({ googleResult: googleFail, azureResult: azureOk });
  assert(aKeep.engine === 'azure-vision-read', 'Google failure + Azure success → Azure retained');

  const both = resolveOcrProviderWinner(googleOk, azureOk);
  assert(
    both.engine === 'azure-vision-read' && both.conflict === true && both.needsReview === true,
    'Both succeed → higher heuristic wins; disagreement flags review',
    `engine=${both.engine}`,
  );
  assert(
    shouldCallAzureFallback({ googleResult: googleOk, remainingBudgetMs: 8000 }) === false,
    'Azure fallback is not used after usable Google text',
  );
  assert(
    shouldCallAzureFallback({ googleResult: googleFail, remainingBudgetMs: 8000 }) === true,
    'Azure fallback is used after Google hard failure',
  );

  await withProviderMocks(async () => {
    CloudVisionOcrService.recognizeTextViaMlKit = async () => ({ success: false, text: '' });
    CloudVisionOcrService.executeGoogleOcr = async () => ({ ...googleFail, processingTimeMs: 30 });
    CloudVisionOcrService.executeAzureOcr = async () => ({ ...azureOk, processingTimeMs: 40 });
    const res: any = await CloudVisionOcrService.recognizeInvoice('file:///cam.jpg', {
      base64: DUMMY_B64,
      alreadyPreprocessed: true,
      skipAi: true,
    });
    assert(
      res.telemetry?.azureCalled === true && String(res.engine).includes('azure'),
      'Integration: Google fail → Azure used',
      `engine=${res.engine}`,
    );
  });

  console.log('\n--- 6–7. Timeout / retry budget ---');
  assert(PROVIDER_ATTEMPT_TIMEOUT_MS === 12000, 'Per-attempt timeout is 12s');
  assert(TOTAL_OCR_PROVIDER_BUDGET_MS === 14000, 'Total provider budget is 14s');
  assert(MIN_RETRY_BUDGET_MS === 3000, 'Retry requires at least 3s remaining');
  const firstTimeout = computeProviderAttemptTimeoutMs({
    remainingBudgetMs: TOTAL_OCR_PROVIDER_BUDGET_MS,
  });
  assert(firstTimeout === 12000, 'First Google attempt is capped at 12s, not 4.5s');
  const afterGoogleAbort = remainingOcrBudgetMs(0, 12000, TOTAL_OCR_PROVIDER_BUDGET_MS);
  assert(afterGoogleAbort === 2000, 'After a 12s Google abort, 2s remains');
  assert(
    shouldRetryWithinBudget({
      attempt: 0,
      remainingBudgetMs: afterGoogleAbort,
      error: { message: 'aborted' },
    }) === false,
    'Retry is refused when remaining budget < 3s',
  );
  const azureAfterAbort = computeProviderAttemptTimeoutMs({ remainingBudgetMs: afterGoogleAbort });
  assert(
    firstTimeout + azureAfterAbort <= TOTAL_OCR_PROVIDER_BUDGET_MS,
    'Google + Azure allocated timeouts never exceed the total budget',
    `sum=${firstTimeout + azureAfterAbort}`,
  );
  assert(
    shouldRetryWithinBudget({
      attempt: 0,
      remainingBudgetMs: 8000,
      error: { message: 'aborted' },
    }) === true,
    'Transient abort can retry when budget remains',
  );
  assert(
    shouldRetryWithinBudget({
      attempt: 1,
      remainingBudgetMs: 8000,
      error: { message: 'aborted' },
    }) === false,
    'Retry count cannot exceed OCR_TRANSIENT_RETRY_MAX',
  );

  console.log('\n--- 8. alreadyPreprocessed is not JPEG re-encoded ---');
  assert(
    shouldReencodeAlreadyPreprocessedImage(true) === false,
    'alreadyPreprocessed skips JPEG re-encode',
  );
  const prepared = await prepareScanImageForOcr('file:///preprocessed.jpg', {
    alreadyPreprocessed: true,
  });
  assert(
    prepared.reencoded === false &&
      prepared.steps.includes('already_preprocessed_base64_read') &&
      prepared.uri === 'file:///preprocessed.jpg',
    'prepareScanImageForOcr reads base64 only when already preprocessed',
    `steps=${prepared.steps.join(',')}`,
  );

  console.log('\n--- 9. Camera preprocess does not upscale ---');
  const skip = planScanResize(800, PREPROCESS_MAX_WIDTH);
  const down = planScanResize(2400, PREPROCESS_MAX_WIDTH);
  const unknown = planScanResize(undefined, PREPROCESS_MAX_WIDTH);
  assert(skip.resize === false && skip.reason === 'skip_upscale', '800px image is not upscaled to 1800');
  assert(down.resize === true && down.targetWidth === 1800, '2400px image is downscaled to 1800');
  assert(unknown.resize === false, 'Unknown size is not resized (never upscale)');

  console.log('\n--- 10. Second ML Kit skipped after usable OCR ---');
  assert(shouldRunSecondMlKit({ rawText: HIGH_TEXT }) === false, 'Usable text skips second ML Kit');
  assert(shouldRunSecondMlKit({ rawText: '' }) === true, 'Empty text still allows second ML Kit');
  await withProviderMocks(async () => {
    let mlKitCalls = 0;
    CloudVisionOcrService.recognizeTextViaMlKit = async () => {
      mlKitCalls += 1;
      return { success: true, text: HIGH_TEXT };
    };
    CloudVisionOcrService.executeGoogleOcr = async () => ({
      success: true,
      engine: 'cloud-vision-function',
      rawText: HIGH_TEXT,
      confidence: 0.9,
      processingTimeMs: 50,
    });
    CloudVisionOcrService.executeAzureOcr = async () => {
      throw new Error('Azure must not run');
    };
    await CloudVisionOcrService.recognizeInvoice('file:///cam.jpg', {
      base64: DUMMY_B64,
      alreadyPreprocessed: true,
      skipAi: true,
    });
    assert(mlKitCalls === 1, 'Second ML Kit is not executed after usable Google text', `mlKitCalls=${mlKitCalls}`);
  });

  console.log('\n--- Privacy-safe telemetry / quality gate ---');
  const tel = sanitizeOcrTelemetry({
    googleRawText: 'SECRET_BILL',
    azureRawText: 'SECRET_AZ',
    googleCalled: true,
    azureCalled: false,
    fallbackUsed: false,
    aborted: false,
    textChars: 11,
  });
  assert(
    !('googleRawText' in tel) &&
      !('azureRawText' in tel) &&
      tel.googleCalled === true &&
      tel.textChars === 11,
    'Telemetry keeps routing flags and strips raw OCR text',
  );

  const sizeOnly = scoreScanQualitySignals({ fileBytes: 12_000, base64Length: 8_000 });
  assert(
    sizeOnly.ok === true && sizeOnly.needsRetake === false,
    'Quality gate does not reject on file-size heuristic alone',
  );
  const tinyFrame = scoreScanQualitySignals({ width: 120, height: 80, base64Length: 400 });
  assert(tinyFrame.ok === false, 'Quality gate still rejects a truly tiny resolution frame');

  console.log('\n================================================================');
  console.log(`PHASE 11.3 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================================');
  if (failed > 0) {
    throw new Error(`Phase 11.3 failed: ${failed} assertion(s)`);
  }
}

runPhase113CameraOcrRoutingSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});

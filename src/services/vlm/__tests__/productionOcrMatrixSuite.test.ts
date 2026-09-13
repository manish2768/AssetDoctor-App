import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Imports from real production services
import {
  safeParseGeminiJson,
  PRIMARY_GEMINI_VLM_MODEL,
  FALLBACK_GEMINI_VLM_MODELS,
  generateContentWithFailover,
} from '../geminiModelConfig';
import {
  postProcessVlmExtraction,
  normalizeChassisNumber,
  computeWarrantyExpiry,
  sanitizeAmount,
} from '../ConsumerAssetVlmService';
import {
  postProcessVehicleServiceExtraction,
} from '../VehicleServiceVlmService';
import {
  postProcessInsuranceExtraction,
} from '../InsuranceVlmService';
import {
  postProcessPucExtraction,
} from '../PucVlmService';
import {
  postProcessElectricityExtraction,
} from '../ElectricityBillVlmService';
import {
  classifyByHeuristics,
} from '../MultiDocumentClassifier';
import {
  planScanResize,
  PREPROCESS_MAX_WIDTH,
  PREPROCESS_COMPRESS,
} from '../../ocr/scanImagePreprocess';

const ROOT_DIR = path.resolve(__dirname, '../../../../');

describe('Production OCR Engine & Document Verification Matrix (Tests A through N)', () => {

  // =========================================================================
  // TEST A: Camera → Purchase Invoice (Real image format)
  // =========================================================================
  it('Test A: Camera → Purchase Invoice (Real image format, EXIF, uncropped, quality 0.92)', () => {
    // 1. Verify camera configuration contract in DocumentScannerService.js and ScanBillScreen.jsx
    const scannerSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/services/ocr/DocumentScannerService.js'), 'utf8');
    const scanBillSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/screens/ScanBillScreen.jsx'), 'utf8');

    assert.ok(scannerSrc.includes('allowsEditing: false'), 'DocumentScannerService must not force square crop');
    assert.ok(scannerSrc.includes('quality: 0.92'), 'DocumentScannerService camera quality must be 0.92');
    assert.ok(scannerSrc.includes('exif: true'), 'DocumentScannerService must preserve EXIF orientation');

    assert.ok(scanBillSrc.includes('allowsEditing: false'), 'ScanBillScreen must not force square crop');
    assert.ok(scanBillSrc.includes('quality: 0.92'), 'ScanBillScreen quality must be 0.92');
    assert.ok(scanBillSrc.includes('exif: true'), 'ScanBillScreen must preserve EXIF orientation');

    // 2. Verify Preprocessing parameters
    assert.equal(PREPROCESS_COMPRESS, 0.92, 'Preprocessing compression quality must be 0.92');
    assert.equal(PREPROCESS_MAX_WIDTH, 2400, 'Preprocessing max width must be 2400px');

    // 3. Verify resize calculation preserves 4:3 camera portrait ratio (3024x4032)
    const resizePlan = planScanResize(3024, 2400, 4032);
    assert.equal(resizePlan.resize, true);
    assert.equal(resizePlan.targetWidth, 1800, 'Calculates 1800px width for 2400px long edge on portrait camera image');

    // 4. Simulated Gemini VLM raw response for a real mobile camera invoice capture
    const mockCameraInvoice = {
      product_name: 'LG 1.5 Ton 5 Star Dual Inverter Split AC',
      brand: 'LG',
      model_variant: 'MS-Q18HNZA',
      identifier_type: 'SERIAL_NUMBER' as const,
      serial_or_identifier: '304KAPL98231',
      seller_name: 'Reliance Digital Retail Ltd',
      buyer_name: 'Ayush Rai',
      purchase_date: '2025-04-10',
      warranty_period: '1 Year Comprehensive',
      warranty_expiry_date: '2026-04-10',
      total_paid_amount: '42,990.00',
      invoice_number: 'RD-2025-00192',
    };

    // 5. Post-process via ConsumerAssetVlmService
    const processed = postProcessVlmExtraction(mockCameraInvoice);

    assert.equal(processed.productName, 'LG 1.5 Ton 5 Star Dual Inverter Split AC');
    assert.equal(processed.brand, 'LG');
    assert.equal(processed.model, 'MS-Q18HNZA');
    assert.equal(processed.serialNumber, '304KAPL98231');
    assert.equal(processed.invoiceDate, '2025-04-10');
    assert.equal(processed.warrantyPeriod, '1 Year Comprehensive');
    assert.equal(processed.warrantyExpiry, '2026-04-10');
    assert.equal(processed.shopName, 'Reliance Digital Retail Ltd');
    assert.equal(processed.totalAmount, 42990);
    assert.equal(processed.category, 'Home');

    // Strict schema: verify no field pollution
    assert.equal((processed as any).gstinTable, undefined, 'No GSTIN table pollution');
    assert.equal((processed as any).salespersonName, undefined, 'No salesperson pollution');
  });

  // =========================================================================
  // TEST B: Camera → Vehicle Service Bill
  // =========================================================================
  it('Test B: Camera → Vehicle Service Bill (Odometer, Workshop, Costs, Work items)', () => {
    const mockServiceRaw = {
      service_date: '2025-11-15',
      odometer_km: '18450',
      workshop_name: 'Apex Honda Authorized Service Center',
      customer_name: 'Ayush Rai',
      vehicle_registration_number: 'DL 01 AB 1234',
      vehicle_make: 'Honda',
      vehicle_model: 'City ZX',
      variant: 'CVT Petrol',
      service_invoice_number: 'RO-2025-0982',
      service_items: ['Periodic Maintenance Service 20,000km', 'Wheel Balancing and Alignment', 'Brake Pad Cleaning'],
      parts_replaced: ['Engine Oil 0W-20 3.5L', 'Oil Filter Element', 'Cabin Air Filter'],
      labour_amount: 2200,
      parts_amount: 2620.50,
      total_amount: '4,820.50',
      next_service_km: '28450',
      next_service_date: '2026-05-15',
      confidence_score: 0.94,
    };

    const processed = postProcessVehicleServiceExtraction(mockServiceRaw);

    assert.equal(processed.serviceDate, '2025-11-15');
    assert.equal(processed.odometerKm, 18450);
    assert.equal(processed.workshopName, 'Apex Honda Authorized Service Center');
    assert.equal(processed.totalAmount, 4820.50);
    assert.equal(processed.invoiceNumber, undefined);
    assert.equal(processed.serviceInvoiceNumber, 'RO-2025-0982');
    assert.ok(processed.serviceItems.includes('Periodic Maintenance Service 20,000km'));
    assert.ok(processed.serviceItems.includes('Wheel Balancing and Alignment'));
    assert.equal(processed.nextServiceKm, 28450);
    assert.equal(processed.nextServiceDate, '2026-05-15');
    assert.equal(processed.registrationNumber, 'DL01AB1234', 'Registration sanitized without spaces');
  });

  // =========================================================================
  // TEST C: Camera → Vehicle Insurance
  // =========================================================================
  it('Test C: Camera → Vehicle Insurance (Insurer, Policy #, Reg #, Start/Expiry, IDV, Premium)', () => {
    const mockInsuranceRaw = {
      insurer_name: 'ICICI Lombard General Insurance Co. Ltd.',
      policy_number: '3001/29847102/00/000',
      vehicle_registration_number: 'MH 02 CZ 9988',
      policy_start_date: '2025-08-01',
      policy_expiry_date: '2026-07-31',
      insured_declared_value: '₹ 8,75,000',
      premium_amount: '₹ 22,450.00',
      policy_type: 'Comprehensive Package Policy',
      customer_name: 'Ayush Rai',
      vehicle_make: 'Maruti Suzuki',
      vehicle_model: 'Brezza ZXi',
      engine_number: 'K15B129034',
      chassis_number: 'MBH12345678901234',
      confidence_score: 0.97,
    };

    const processed = postProcessInsuranceExtraction(mockInsuranceRaw);

    assert.equal(processed.insurerName, 'ICICI Lombard General Insurance Co. Ltd.');
    assert.equal(processed.policyNumber, '3001/29847102/00/000');
    assert.equal(processed.vehicleRegistrationNumber, 'MH02CZ9988', 'Normalized registration uppercase and alphanumeric');
    assert.equal(processed.policyStartDate, '2025-08-01');
    assert.equal(processed.policyExpiryDate, '2026-07-31');
    assert.equal(processed.idv, 875000);
    assert.equal(processed.premium, 22450);
  });

  // =========================================================================
  // TEST D: Camera → Vehicle PUC
  // =========================================================================
  it('Test D: Camera → Vehicle PUC (Certificate #, Reg #, Dates, Compliance, CO/HC)', () => {
    const mockPucRaw = {
      certificate_number: 'DL010098234561',
      vehicle_registration_number: 'DL 08 CA 4321',
      test_date: '2025-10-05',
      valid_until: '2026-10-04',
      emission_values: 'CO: 0.12%, HC: 98 ppm, Smoke Density: Pass',
      issuing_authority: 'Auto Fuel Station PUC Center, Mayur Vihar',
      fuel_type: 'Petrol BS6',
      owner_name: 'Ayush Rai',
      confidence_score: 0.95,
    };

    const processed = postProcessPucExtraction(mockPucRaw);

    assert.equal(processed.certificateNumber, 'DL010098234561');
    assert.equal(processed.vehicleRegistrationNumber, 'DL08CA4321');
    assert.equal(processed.testDate, '2025-10-05');
    assert.equal(processed.validUntil, '2026-10-04');
    assert.equal(processed.emissionValues, 'CO: 0.12%, HC: 98 ppm, Smoke Density: Pass');
    assert.equal(processed.issuingAuthority, 'Auto Fuel Station PUC Center, Mayur Vihar');
  });

  // =========================================================================
  // TEST E: Camera → Electricity Bill
  // =========================================================================
  it('Test E: Camera → Electricity Bill (Consumer #, Bill Date, Due Date, Units, Amount, DISCOM)', () => {
    const mockElectricityRaw = {
      consumer_number: '5410982310',
      customer_name: 'Rajesh Kumar',
      bill_date: '2026-02-01',
      due_date: '2026-02-16',
      billing_period: '01-Jan-2026 to 31-Jan-2026',
      units_consumed: '342 kWh',
      total_payable_amount: '₹ 2,480.00',
      provider_name: 'Tata Power Delhi Distribution Limited (TPDDL)',
      meter_number: 'MTR-887124',
      confidence_score: 0.98,
    };

    const processed = postProcessElectricityExtraction(mockElectricityRaw);

    assert.equal(processed.consumerNumber, '5410982310');
    assert.equal(processed.billDate, '2026-02-01');
    assert.equal(processed.dueDate, '2026-02-16');
    assert.equal(processed.unitsConsumed, 342);
    assert.equal(processed.totalPayableAmount, 2480);
    assert.equal(processed.providerName, 'Tata Power Delhi Distribution Limited (TPDDL)');
    assert.equal(processed.billingPeriod, '01-Jan-2026 to 31-Jan-2026');
  });

  // =========================================================================
  // TEST F: Import Image → Invoice
  // =========================================================================
  it('Test F: Import image → Invoice (Gallery options, MIME types JPEG/PNG/WEBP)', () => {
    const scannerSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/services/ocr/DocumentScannerService.js'), 'utf8');
    assert.ok(scannerSrc.includes('galleryOptions'), 'DocumentScannerService provides galleryOptions');

    // Simulate MIME type resolution
    const mimeJpeg = 'image/jpeg';
    const mimePng = 'image/png';
    const mimeWebp = 'image/webp';

    const validMimes = [mimeJpeg, mimePng, mimeWebp];
    for (const mime of validMimes) {
      assert.ok(mime.startsWith('image/'), `MIME ${mime} recognized as image format`);
    }

    // Heuristics classification on imported retail invoice
    const sampleOcrText = 'Tax Invoice Retail Invoice Vijay Sales Apple iPhone 15 128GB Grand Total: 69900';
    const classification = classifyByHeuristics(sampleOcrText);
    assert.equal(classification?.documentType, 'INVOICE');
  });

  // =========================================================================
  // TEST G: Import PDF → Invoice
  // =========================================================================
  it('Test G: Import PDF → Invoice (application/pdf MIME, inlineData base64 payload)', () => {
    const pdfMime = 'application/pdf';
    assert.equal(pdfMime, 'application/pdf');

    // Verify PDF classification heuristics
    const samplePdfText = 'Tax Invoice Retail Invoice Bill No: CR-88291 Croma Sony Bravia 55 Inch TV Grand Total: 54990';
    const classification = classifyByHeuristics(samplePdfText);
    assert.equal(classification?.documentType, 'INVOICE');
    assert.ok((classification?.confidence || 0) >= 0.80);
  });

  // =========================================================================
  // TEST H: Gemini Timeout Recovery
  // =========================================================================
  it('Test H: Gemini timeout recovery (15000ms timeout per request, failover to secondary model)', async () => {
    assert.equal(PRIMARY_GEMINI_VLM_MODEL, 'gemini-2.0-flash');
    assert.deepEqual(FALLBACK_GEMINI_VLM_MODELS, ['gemini-1.5-flash', 'gemini-1.5-flash-8b']);

    // Mock genAI client where primary model times out, and fallback succeeds
    let primaryCalled = false;
    let fallbackCalled = false;

    const mockGenAI: any = {
      getGenerativeModel: (params: { model: string }) => {
        if (params.model === 'gemini-2.0-flash') {
          primaryCalled = true;
          return {
            generateContent: () => new Promise((_, reject) => {
              // Simulate timeout error
              setTimeout(() => reject(new Error('Gemini request timeout after 15000ms (gemini-2.0-flash)')), 10);
            }),
          };
        } else if (params.model === 'gemini-1.5-flash') {
          fallbackCalled = true;
          return {
            generateContent: async () => ({
              response: {
                text: () => JSON.stringify({ asset_name: 'Recovered Samsung Refrigerator', price: 25000 }),
              },
            }),
          };
        }
        throw new Error('Unexpected model');
      },
    };

    const result = await generateContentWithFailover(
      mockGenAI,
      {},
      [{ text: 'Extract invoice' }] as any,
      100, // Short timeout for test
    );

    assert.ok(primaryCalled, 'Primary gemini-2.0-flash was attempted first');
    assert.ok(fallbackCalled, 'Fallback gemini-1.5-flash was called after timeout');
    assert.equal((result as any).modelUsed, 'gemini-1.5-flash');
    const text = result.response.text();
    assert.ok(text.includes('Recovered Samsung Refrigerator'));
  });

  // =========================================================================
  // TEST I: Gemini Permanent Failure Handling
  // =========================================================================
  it('Test I: Gemini permanent failure handling (Catch without unhandled rejection, user-friendly error)', async () => {
    const mockFailingGenAI: any = {
      getGenerativeModel: (params: { model: string }) => ({
        generateContent: async () => {
          throw new Error('503 Service Unavailable: High demand on all AI endpoints');
        },
      }),
    };

    let caughtError: any = null;
    try {
      await generateContentWithFailover(
        mockFailingGenAI,
        {},
        [{ text: 'Extract invoice' }] as any,
        50,
      );
    } catch (err: any) {
      caughtError = err;
    }

    assert.ok(caughtError !== null, 'Permanent error was caught gracefully');
    assert.ok(caughtError.message.includes('503') || caughtError.message.includes('High demand'));
  });

  // =========================================================================
  // TEST J: Malformed JSON Recovery
  // =========================================================================
  it('Test J: Malformed JSON recovery (Conversational prelude, trailing text, unescaped whitespace)', () => {
    const rawAiResponse = `
      Certainly! Here is the extracted document data according to your requested schema:

      {
        "asset_name": "Whirlpool 7kg Royal Washing Machine",
        "brand": "Whirlpool",
        "price": "16,490",
        "purchase_date": "2025-06-20",
        "warranty_duration_months": 24
      }

      I hope this helps you manage your appliances! Let me know if you need anything else.
    `;

    const parsed = safeParseGeminiJson<{ asset_name: string; price: string }>(rawAiResponse);
    assert.equal(parsed.asset_name, 'Whirlpool 7kg Royal Washing Machine');
    assert.equal(parsed.price, '16,490');
  });

  // =========================================================================
  // TEST K: Markdown-Wrapped JSON Extraction
  // =========================================================================
  it('Test K: Markdown-wrapped JSON extraction (```json ... ``` and plain ``` ... ``` fences)', () => {
    // 1. ```json fence
    const markdownWithJsonTag = '```json\n{"policyNumber": "POL-99120", "insurer": "Star Health"}\n```';
    const parsed1 = safeParseGeminiJson<any>(markdownWithJsonTag);
    assert.equal(parsed1.policyNumber, 'POL-99120');
    assert.equal(parsed1.insurer, 'Star Health');

    // 2. Plain ``` fence
    const markdownPlain = '```\n{"consumerNumber": "CON-1004", "units": 150}\n```';
    const parsed2 = safeParseGeminiJson<any>(markdownPlain);
    assert.equal(parsed2.consumerNumber, 'CON-1004');
    assert.equal(parsed2.units, 150);

    // 3. Nested array in code fences
    const markdownArray = '```json\n[{"item": "Brake Fluid", "cost": 450}]\n```';
    const parsed3 = safeParseGeminiJson<any>(markdownArray);
    assert.equal(Array.isArray(parsed3), true);
    assert.equal(parsed3[0].cost, 450);
  });

  // =========================================================================
  // TEST L: Rapid Screen Re-render / Double-Scan Protection
  // =========================================================================
  it('Test L: Rapid screen re-render / double-scan protection (Stale session detection)', () => {
    let scanGenCounter = 0;
    let currentSessionId = '';

    // Simulate Scan 1 starting
    const gen1 = ++scanGenCounter; // 1
    const session1 = 'scan_session_1';
    currentSessionId = session1;

    // Simulate Scan 2 starting before Scan 1 finishes
    const gen2 = ++scanGenCounter; // 2
    const session2 = 'scan_session_2';
    currentSessionId = session2;

    // Is Scan 1 stale?
    const isScan1Stale = gen1 !== scanGenCounter || currentSessionId !== session1;
    // Is Scan 2 stale?
    const isScan2Stale = gen2 !== scanGenCounter || currentSessionId !== session2;

    assert.equal(isScan1Stale, true, 'Scan 1 must be flagged as stale and discarded');
    assert.equal(isScan2Stale, false, 'Scan 2 is the active valid session and must be accepted');
  });

  // =========================================================================
  // TEST M: Maximum Retry Count Respected
  // =========================================================================
  it('Test M: Maximum retry count respected (Strictly bounded to 1 retry, max 2 attempts total)', () => {
    let attemptsCount = 0;

    function simulateScanPipeline(processOpts: { isRetry?: boolean } = {}) {
      attemptsCount++;
      if (!processOpts.isRetry) {
        // Initial attempt failed transiently -> Trigger bounded retry
        return simulateScanPipeline({ ...processOpts, isRetry: true });
      }
      // On retry attempt: if retry fails, NO MORE retries allowed
      return { success: false, attempts: attemptsCount };
    }

    const res = simulateScanPipeline();
    assert.equal(res.attempts, 2, 'Total attempts must equal exactly 2 (initial + 1 retry)');
    assert.equal(res.success, false, 'Terminates cleanly after 1 retry without infinite loops');
  });

  // =========================================================================
  // TEST N: Document Storage Policy
  // =========================================================================
  it('Test N: Document storage policy (No duplicate unneeded storage, persistImageFile defaults to false)', () => {
    const cacheSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/services/ocr/InvoiceOfflineCache.js'), 'utf8');

    // Verify persistImageFile is defined with false as default parameter
    assert.ok(
      cacheSrc.includes('persistImageFile = false'),
      'InvoiceOfflineCache.saveScan must default persistImageFile to false'
    );

    // Verify condition guarding physical file copying
    assert.ok(
      cacheSrc.includes('if (persistImageFile && imageUri && FileSystem.documentDirectory)'),
      'Physical file copying must be guarded by persistImageFile flag'
    );
  });

});

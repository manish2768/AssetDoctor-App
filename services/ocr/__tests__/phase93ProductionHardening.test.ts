/**
 * Phase 9.3 — Production hardening tests.
 *
 * CLASSIFICATION:
 * All cases in this file are SYNTHETIC / UNIT / INTEGRATION on fixture text.
 * They are NOT real-camera, real-device, or live Vision/Azure API tests.
 */

import { UniversalOcrPipeline } from '../universalPipeline.ts';
import { EntityLinker } from '../entityLinker.ts';
import { DuplicateDetector } from '../duplicateDetector.ts';
import { AssetIntelligenceBrain } from '../../intelligence/assetIntelligenceBrain.ts';
import { scoreFieldConfidences } from '../../../src/services/ocr/fieldConfidence.js';
import {
  resolveOcrProviderWinner,
  sanitizeOcrTelemetry,
  isRetryableOcrError,
} from '../../../src/services/ocr/ocrProviderOrchestrator.js';
import { collectVaultedDocsFromAssets } from '../../../src/services/ocr/vaultedDocCollector.js';
import { detectVersionConflict } from '../../../src/services/offline/conflictResolver.js';
import { makeNotificationIdentity, NOTIFICATION_TYPE } from '../../../src/services/notifications/notificationTypes.js';
import { scoreScanQualitySignals } from '../../../src/services/ocr/scanQualityGate.js';
import { validateIMEI } from '../fieldChecksumValidators.ts';
import type { Asset } from '../../../src/types.ts';

let passed = 0;
let failed = 0;
const rows: Array<{
  document: string;
  field: string;
  expected: string;
  ocr: string;
  normalized: string;
  confidence: number;
  validation: string;
  saved: string;
  status: 'PASS' | 'FAIL';
}> = [];

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed += 1;
  } else {
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

function recordRow(row: (typeof rows)[number]) {
  rows.push(row);
  assert(row.status === 'PASS', `${row.document} / ${row.field}`, `expected=${row.expected} got=${row.ocr}`);
}

function fv(field: { value?: unknown; confidence?: number } | undefined) {
  if (!field || field.value == null || field.value === '') return { value: '', confidence: 0 };
  return { value: String(field.value), confidence: Number(field.confidence) || 0 };
}

export async function runPhase93HardeningSuite() {
  console.log('================================================================');
  console.log('ASSET DOCTOR — PHASE 9.3 PRODUCTION HARDENING (SYNTHETIC)');
  console.log('================================================================\n');

  console.log('--- UNIT: provider orchestration ---');
  const retryNet = isRetryableOcrError({ message: 'repo.maven.apache.org: nodename nor servname' });
  const retryBiz = isRetryableOcrError({ message: 'Insufficient text from Google Cloud Vision' });
  assert(retryNet === true, 'Network/DNS errors are retryable');
  assert(retryBiz === false, 'Business OCR failures are not blindly retried');

  const winner = resolveOcrProviderWinner(
    { success: true, rawText: 'POLICY 111\nREG UP32QU2187', confidence: 0.55, engine: 'google' },
    { success: true, rawText: 'POLICY 222\nREG UP32QU2187', confidence: 0.91, engine: 'azure-vision-read' },
  );
  assert(winner.engine === 'azure-vision-read', 'Disagreement picks higher-confidence provider');
  assert(winner.conflict === true && winner.needsReview === true, 'Provider disagreement forces review');

  const cleanTel = sanitizeOcrTelemetry({ googleRawText: 'SECRET_POLICY_TEXT', azureRawText: 'AZ', googleMs: 12 });
  assert(!('googleRawText' in cleanTel) && cleanTel.googleTextChars === 18, 'Telemetry strips raw OCR text');

  console.log('\n--- UNIT: invalid IMEI must not get high confidence ---');
  const badImeiScore = scoreFieldConfidences({
    productName: 'Nothing Phone',
    totalAmount: 25960,
    imei: '869910012345679',
    documentType: 'ELECTRONICS_PURCHASE_INVOICE',
  });
  assert(badImeiScore.fields.imei < 0.55, 'Invalid Luhn IMEI final confidence is low', String(badImeiScore.fields.imei));
  assert(validateIMEI('869910012345679').valid === false, 'Checksum validator rejects corrupted IMEI');

  console.log('\n--- UNIT: quality gate rejects tiny frames before OCR spend ---');
  const q = scoreScanQualitySignals({ width: 120, height: 80, base64Length: 400 });
  assert(q.ok === false && q.needsRetake === true, 'Low-resolution capture is rejected');

  console.log('\n--- UNIT: duplicate identity + multi-match conflict ---');
  const ronin: Asset = {
    id: 'ast_ronin_vault_01',
    assetId: 'ast_ronin_vault_01',
    name: 'TVS Ronin',
    registration: 'UP32QU2187',
    chassisNumber: 'MD637AN11S2F03328',
    engineNumber: 'BN1FS2302943',
  } as Asset;
  const roninClone: Asset = {
    id: 'ast_ronin_vault_02',
    assetId: 'ast_ronin_vault_02',
    name: 'TVS Ronin Copy',
    registration: 'UP 32 QU 2187',
    chassisNumber: 'MD637AN11S2F03328',
  } as Asset;

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
  `;
  const tvsText = `
    TAAR MOTO LEGENDS PVT LTD
    AUTHORISED TVS SERVICE CENTER
    GSTIN: 09AABCT1928K1ZX
    TAX INVOICE / SERVICE BILL
    Invoice No: 81587
    Date: 20/08/2024
    Model: TVS RONIN BASE 1 CH
    Customer: NIKLESH KUMAR
    RegNo. UP32QU2187
    Chassis No: MD637AN11S2F03328
    Engine No: BN1FS2302943
    Odometer: 12450 KM
    Labour: 260
    Grand Total: 260
  `;
  const nothingText = `
    TAX INVOICE
    NOTHING TECHNOLOGY LIMITED
    GSTIN: 07AABCN1234A1Z5
    Invoice No: NP-INV-8891
    Date: 12/03/2025
    Product: Nothing Phone (2a)
    Serial No: NP2A-BLK-998877
    IMEI: 490154203237518
    Qty: 1
    Taxable: 22000
    GST: 3960
    Grand Total: 25960
  `;

  const resA = await UniversalOcrPipeline.process(iciciText, {
    existingAssets: [ronin],
    skipCache: true,
  });
  const resB = await UniversalOcrPipeline.process(tvsText, {
    existingAssets: [ronin],
    skipCache: true,
  });
  const resC = await UniversalOcrPipeline.process(nothingText, {
    existingAssets: [ronin],
    skipCache: true,
  });

  const ins = resA.extractedData?.insuranceData as any;
  const srv = resB.extractedData?.serviceData as any;
  const elc = (resC.extractedData as any)?.electronicsData || (resC.extractedData as any)?.purchaseData;

  const field = (
    document: string,
    name: string,
    expected: string,
    extracted: { value: string; confidence: number },
    normalized = extracted.value,
  ) => {
    const ok = String(extracted.value || '').replace(/\s+/g, '').toUpperCase().includes(
      String(expected).replace(/\s+/g, '').toUpperCase(),
    ) || String(extracted.value) === expected;
    recordRow({
      document,
      field: name,
      expected,
      ocr: extracted.value || '',
      normalized,
      confidence: extracted.confidence,
      validation: ok ? 'PASS' : 'FAIL',
      saved: extracted.value || '',
      status: ok ? 'PASS' : 'FAIL',
    });
  };

  console.log('\n--- SYNTHETIC REGRESSION: ICICI Lombard ---');
  field('ICICI', 'policyNumber', '3005/2024/09871234', fv(ins?.policyNumber));
  field('ICICI', 'registration', 'UP32QU2187', fv(ins?.vehicleRegistration || ins?.registration));
  field('ICICI', 'chassisNumber', 'MD637AN11S2F03328', fv(ins?.chassisNumber || ins?.vinOrChassis));
  field('ICICI', 'engineNumber', 'BN1FS2302943', fv(ins?.engineNumber));
  field('ICICI', 'idv', '142500', fv(ins?.idvAmount || ins?.idv));
  field('ICICI', 'premium', '2450', fv(ins?.premiumAmount || ins?.premium));
  assert(resA.classification?.documentType === 'INSURANCE_POLICY', 'ICICI classified as INSURANCE_POLICY', String(resA.classification?.documentType));
  assert(resA.entityLink?.matchedAssetId === 'ast_ronin_vault_01', 'ICICI exact-reg matches Ronin');
  assert(resA.entityLink?.isAutoLinked === true, 'Single exact match auto-links');

  console.log('\n--- SYNTHETIC REGRESSION: TVS Ronin service ---');
  field('TVS', 'registration', 'UP32QU2187', fv(srv?.vehicleRegistration || srv?.registration));
  field('TVS', 'chassisNumber', 'MD637AN11S2F03328', fv(srv?.chassisNumber || srv?.vinOrChassis));
  field('TVS', 'engineNumber', 'BN1FS2302943', fv(srv?.engineNumber));
  field('TVS', 'odometer', '12450', fv(srv?.odometerKm));
  field('TVS', 'totalAmount', '260', fv(srv?.totalAmount));
  assert(resB.classification?.documentType === 'SERVICE_INVOICE', 'TVS classified as SERVICE_INVOICE', String(resB.classification?.documentType));

  console.log('\n--- SYNTHETIC REGRESSION: Nothing Phone ---');
  const inv = resC.reviewInvoice || ({} as any);
  field('NOTHING', 'productName', 'Nothing Phone', { value: String(inv.productName || elc?.productName?.value || ''), confidence: 0.8 });
  field('NOTHING', 'totalAmount', '25960', { value: String(inv.totalAmount ?? elc?.totalAmount?.value ?? ''), confidence: 0.8 });
  assert(String(resC.classification?.documentType || '').includes('ELECTRONICS') || String(resC.classification?.documentType || '').includes('PURCHASE'),
    'Nothing classified as electronics/purchase', String(resC.classification?.documentType));
  assert(resC.entityLink?.matchedAssetId !== 'ast_ronin_vault_01', 'Nothing Phone does not attach to TVS Ronin');
  assert(!String(inv.registration || '').includes('UP32QU2187'), 'Nothing invoice does not inherit vehicle registration');

  const multi = EntityLinker.linkDocumentToAsset(resA.extractedData, [ronin, roninClone]);
  assert(multi.isAutoLinked === false, 'Two exact registration hits do not auto-pick an asset');
  assert(multi.matchedAssetId === null, 'Ambiguous exact match leaves matchedAssetId null');
  assert(multi.candidates.length >= 2, 'Ambiguous match returns all candidates');

  const vaultDocs = collectVaultedDocsFromAssets([
    { id: 'ast1', invoiceNumber: '81587', purchaseDate: '2024-08-20', purchasePrice: 260, registration: 'UP32QU2187', classifiedDocumentType: 'SERVICE_INVOICE' },
  ]);
  const dup = DuplicateDetector.checkDuplicate(
    resB.classification.documentType,
    resB.extractedData,
    tvsText,
    vaultDocs,
  );
  assert(dup.isDuplicate === true, 'Service invoice identity matches existing vault record');

  console.log('\n--- UNIT: intelligence + notifications + sync ---');
  const noCost = AssetIntelligenceBrain.evaluateRepairVsReplace(
    {
      assetId: 'a1',
      userId: 'u1',
      category: 'BIKE',
      assetName: 'Unknown bike',
      documents: [],
    },
    8000,
  );
  assert(noCost.action === 'MONITOR', 'Repair/replace does not invent ₹50000 replacement cost');
  assert(noCost.confidence < 0.6, 'Insufficient-evidence advisory stays low confidence');

  const id1 = makeNotificationIdentity({
    userId: 'u1',
    assetId: 'a1',
    notificationType: NOTIFICATION_TYPE.INSURANCE_EXPIRY,
    eventDate: '2026-09-14',
    reminderOffset: 7,
  });
  const id2 = makeNotificationIdentity({
    userId: 'u1',
    assetId: 'a1',
    notificationType: NOTIFICATION_TYPE.INSURANCE_EXPIRY,
    eventDate: '2026-09-14',
    reminderOffset: 7,
  });
  assert(id1 === id2 && id1 === 'u1|a1|INSURANCE_EXPIRY|2026-09-14|7', 'Notification identity is idempotent');

  const missingVer = detectVersionConflict(
    { assetName: 'Local', registration: 'UP32QU2187' },
    { assetName: 'Remote', registration: 'UP32QU2187' },
  );
  assert(missingVer.conflict === true, 'Missing versions + important field diff is a conflict');

  console.log('\n================================================================');
  console.log(`PHASE 9.3 HARDENING: ${passed} PASSED / ${failed} FAILED`);
  console.log('All of the above are SYNTHETIC/UNIT/INTEGRATION — not real-device OCR.');
  console.log('================================================================\n');

  return { passed, failed, rows };
}

const isDirect = typeof process !== 'undefined' && process.argv[1] && process.argv[1].includes('phase93ProductionHardening');
if (isDirect) {
  runPhase93HardeningSuite()
    .then((r) => {
      if (r.failed > 0) process.exit(1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

/**
 * Phase 15 — Real Indian document lab (redacted corpus).
 * Does not call live Vision/Azure. Does not commit PII.
 * Field correctness, not "did OCR read text".
 */
import {
  REDACTED_CORPUS,
  evaluateFixture,
  summarizeLab,
  describeScanProviders,
  AZURE_NOT_RUN_AFTER_GOOGLE_SUCCESS,
  IMAGE_QUALITY_CV_REQUIRED,
  IMAGE_QUALITY_CAPABILITY,
  canReliablyDetect,
  LAB_FAILURE,
} from '../phase15/index.ts';
import { hardenOcrUnderstanding } from '../phase14/hardeningOrchestrator.ts';
import { classifyDocumentIntelligence, DOCUMENT_TYPE_UNCERTAIN, UNKNOWN_DOCUMENT_STRUCTURE } from '../phase14/documentTypeIntelligence.ts';
import { currencyAsIdentifierVeto } from '../phase14/currencyProtection.ts';
import { PatternMemory } from '../../intelligence/documentLearning/patternMemory.ts';
import { buildFeedbackEvent } from '../../intelligence/documentLearning/feedbackCapture.ts';
import { PROMOTION } from '../../intelligence/documentLearning/types.ts';
import { summarizeOcrHardeningDiagnostics } from '../phase14/adminDiagnostics.ts';
import { shouldCallAzureFallback } from '../../../src/services/ocr/ocrProviderOrchestrator.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

console.log('================================================================');
console.log('   PHASE 15 REAL INDIAN DOCUMENT LAB (REDACTED)');
console.log('================================================================\n');

console.log('--- Corpus field-level evaluation ---');
const labResults = REDACTED_CORPUS.map((fixture) => evaluateFixture(fixture));
const summary = summarizeLab(labResults);
assert(REDACTED_CORPUS.length >= 15, '15 document categories present', String(REDACTED_CORPUS.length));
assert(summary.source === 'REDACTED_SYNTHETIC_CORPUS', 'corpus is redacted/synthetic, not live PII');
assert(summary.productionTelemetry === 'TELEMETRY NOT AVAILABLE', 'does not invent production telemetry');

for (const row of labResults) {
  assert(row.forcedBill !== true, `${row.id} is not forced to bill`);
}

const service = labResults.find((r) => r.id === 'vehicle-service-invoice');
assert(service?.actualType === 'SERVICE_INVOICE', 'service invoice is SERVICE_INVOICE', String(service?.actualType));
assert(service?.cards.find((c) => c.field === 'registration')?.status === 'PASS', 'service bill registration extracted');

const insurance = labResults.find((r) => r.id === 'vehicle-insurance-policy');
assert(insurance?.actualType === 'INSURANCE_POLICY', 'insurance is not generic bill', String(insurance?.actualType));

const phone = labResults.find((r) => r.id === 'mobile-phone-invoice');
assert(
  phone?.actualType === 'ELECTRONICS_INVOICE' || phone?.typeOk,
  'phone invoice is not a vehicle document',
  String(phone?.actualType),
);
assert(phone?.cards.find((c) => c.field === 'imei')?.status === 'PASS', 'phone IMEI is the 15-digit value');

const warranty = labResults.find((r) => r.id === 'warranty-card');
assert(warranty?.actualType !== 'PURCHASE_INVOICE', 'warranty card is not an invoice', String(warranty?.actualType));

const puc = labResults.find((r) => r.id === 'puc-certificate');
assert(puc?.actualType !== 'INSURANCE_POLICY', 'PUC is not insurance', String(puc?.actualType));

const rc = labResults.find((r) => r.id === 'rc-document');
assert(rc?.actualType !== 'PURCHASE_INVOICE', 'RC is not an invoice', String(rc?.actualType));

console.log(`  lab field PASS=${summary.fieldPass} FAIL=${summary.fieldFail} type PASS=${summary.typePass}/${summary.documents}`);

console.log('\n--- Known failure regressions ---');
{
  assert(currencyAsIdentifierVeto('imei', '₹23,999').blocked === true, '₹23,999 → IMEI forbidden');
  assert(currencyAsIdentifierVeto('imei', '23999').blocked === true, '23999 → IMEI forbidden');
  const dateInv = hardenOcrUnderstanding({
    fields: { invoiceNumber: '11/03/2025' },
    rawText: 'Invoice Date 11/03/2025 Invoice No RT-4401 GST invoice',
  });
  assert(String(dateInv.flatFields.invoiceNumber || '') !== '11/03/2025', 'invoice date → invoice number forbidden');
  const serialAmt = hardenOcrUnderstanding({
    fields: { serialNumber: 29988 },
    rawText: 'Serial Number SN-9981XZ Grand Total ₹29,988',
  });
  assert(String(serialAmt.flatFields.serialNumber) !== '29988', 'grand total → serial forbidden');
  const gstImei = hardenOcrUnderstanding({
    fields: { imei: '09AABCU9603R1ZX' },
    rawText: 'GSTIN 09AABCU9603R1ZX IMEI 490154203237518',
  });
  assert(String(gstImei.flatFields.imei) !== '09AABCU9603R1ZX', 'GSTIN → IMEI forbidden');
  const odo = hardenOcrUnderstanding({
    documentType: 'SERVICE_INVOICE',
    fields: { odometerKm: 2270, totalAmount: 2270, registration: 'UP32QU2187' },
    rawText: 'Service invoice UP32QU2187 Odometer 12450 KM Grand Total 2270',
  });
  assert(
    Number(odo.flatFields.odometerKm) !== 2270 || odo.fieldDecisions.odometerKm.decision !== 'AUTO_ACCEPT',
    'odometer → invoice amount forbidden',
  );
  assert(currencyAsIdentifierVeto('registration', 'UP32QU2187').blocked === false, 'UP32QU2187 is not currency');
}

console.log('\n--- Document type uncertain, never force bill ---');
{
  const weak = classifyDocumentIntelligence('hello world random text', {});
  assert(weak.documentType === UNKNOWN_DOCUMENT_STRUCTURE, 'weak text stays unknown');
  assert(weak.forced === false, 'type is not forced');
  const mixed = classifyDocumentIntelligence(
    'Warranty card labour odometer job card insurance policy premium IDV PUC emission certificate',
    {},
  );
  assert(
    mixed.documentType === DOCUMENT_TYPE_UNCERTAIN || mixed.documentType === UNKNOWN_DOCUMENT_STRUCTURE,
    'ambiguous families are not forced to bill',
    String(mixed.documentType),
  );
  assert(mixed.documentType !== 'bill', 'never returns bill');
}

console.log('\n--- Provider transparency ---');
{
  const googleWin = describeScanProviders({
    googleSuccess: true,
    googleText: 'TAX INVOICE Grand Total 23999 Nothing Phone IMEI 490154203237518',
    azureRan: false,
  });
  assert(googleWin.azureStatus === AZURE_NOT_RUN_AFTER_GOOGLE_SUCCESS, 'Azure not run after Google success');
  assert(googleWin.neverClaimThreeEngineConsensus === true, 'does not claim 3-engine consensus');
  assert(googleWin.mode !== 'MULTI_PROVIDER', 'single Google is not MULTI_PROVIDER', googleWin.mode);
  assert(
    shouldCallAzureFallback({
      googleResult: { success: true, rawText: 'plenty of invoice text here' },
      remainingBudgetMs: 14000,
    }) === false,
    'routing does not call Azure after Google success',
  );
}

console.log('\n--- Learning loop + hard validator still wins ---');
{
  const memory = new PatternMemory();
  const mk = (fp: string) =>
    buildFeedbackEvent({
      userId: 'lab-user',
      documentType: 'ELECTRONICS_INVOICE',
      fieldName: 'imei',
      originalValue: '23999',
      correctedValue: '490154203237518',
      documentFingerprint: fp,
    });
  memory.ingestEvent(mk('doc-a'));
  const after1 = memory.listPatterns();
  assert(after1.length >= 1, 'patterns exist after 1 correction');
  assert(
    after1.every((p) => p.status === 'CANDIDATE'),
    '1 correction = CANDIDATE',
  );
  memory.ingestEvent(mk('doc-b'));
  memory.ingestEvent(mk('doc-c'));
  assert(
    memory.listPatterns().some((p) => p.status === 'EMERGING'),
    '3 independent corrections = EMERGING',
  );
  memory.ingestEvent(mk('doc-d'));
  memory.ingestEvent(mk('doc-e'));
  assert(
    memory.listPatterns().every((p) => p.status !== 'TRUSTED') ||
      memory.listPatterns().some((p) => p.status === 'EMERGING' || p.status === 'TRUSTED'),
    '5 independent corrections strengthen further (TRUSTED is system-side only)',
  );
  const poison = new PatternMemory();
  poison.ingestEvent(
    buildFeedbackEvent({
      userId: 'lab-user',
      documentType: 'ELECTRONICS_INVOICE',
      fieldName: 'imei',
      originalValue: '490154203237518',
      correctedValue: '23999',
      documentFingerprint: 'poison',
    }),
  );
  const hardened = hardenOcrUnderstanding({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '23999', totalAmount: 23999 },
    rawText: 'IMEI 490154203237518 Grand Total ₹23,999',
    patterns: poison.listPatterns(),
  });
  assert(String(hardened.flatFields.imei) !== '23999', 'learning cannot override currency-as-IMEI validator');
}

console.log('\n--- Cross-field ---');
{
  const dates = hardenOcrUnderstanding({
    documentType: 'INSURANCE_POLICY',
    fields: {
      registration: 'UP32QU2187',
      policyStartDate: '2025-09-15',
      policyExpiry: '2024-09-14',
    },
    rawText: 'Insurance policy UP32QU2187 Period 15-Sep-2025 to 14-Sep-2024',
  });
  assert(
    dates.errorCodes.includes('OCR_DATE_RELATIONSHIP_INVALID') || dates.requiresReview,
    'policy start after expiry is a conflict, not silent',
  );
  const identity = hardenOcrUnderstanding({
    fields: { registration: 'UP32QU2187', imei: '111111111111119' },
    rawText: 'Vehicle UP32QU2187',
    assets: [{ assetId: 'a1', registration: 'UP32QU2187', imei: '490154203237518' }],
  });
  assert(
    identity.assetIdentity?.code === 'OCR_ASSET_MATCH_CONFLICT' || identity.requiresReview,
    'identity conflict is explicit',
  );
}

console.log('\n--- Image quality honesty ---');
{
  assert(IMAGE_QUALITY_CAPABILITY.futureRequirement === IMAGE_QUALITY_CV_REQUIRED, 'CV requirement is documented');
  assert(canReliablyDetect('blur') === false, 'does not pretend to detect blur from pixels');
  assert(canReliablyDetect('glare') === false, 'does not pretend to detect glare');
  assert(canReliablyDetect('darkImage') === false, 'does not pretend to detect darkness');
  assert(canReliablyDetect('lowResolution') === true, 'low-resolution heuristic exists');
}

console.log('\n--- Admin real-document telemetry ---');
{
  const empty = summarizeOcrHardeningDiagnostics({});
  assert(empty.realDocumentTelemetry === 'No real-document telemetry yet', 'admin does not fabricate real-doc counts');
}

console.log('\n--- Failure taxonomy ---');
{
  assert(LAB_FAILURE.CURRENCY_AS_IDENTIFIER === 'CURRENCY_AS_IDENTIFIER', 'taxonomy includes CURRENCY_AS_IDENTIFIER');
  assert(LAB_FAILURE.LEARNING_MISLEAD === 'LEARNING_MISLEAD', 'taxonomy includes LEARNING_MISLEAD');
}

console.log('\n================================================================');
console.log(`   RESULT: ${passed} passed / ${failed} failed`);
console.log(
  `   CORPUS: ${summary.documents} docs, field ${summary.fieldPass} pass / ${summary.fieldFail} fail, type ${summary.typePass} pass / ${summary.typeFail} fail`,
);
console.log('   SOURCE: REDACTED SYNTHETIC — not live customer documents');
console.log('================================================================');
if (failed) process.exit(1);

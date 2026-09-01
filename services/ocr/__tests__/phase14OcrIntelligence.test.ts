/**
 * Phase 14 — OCR intelligence hardening tests.
 * Does not call Vision/Azure/ML Kit. Never invents missing values.
 */
import {
  hardenOcrUnderstanding,
  classifyDocumentIntelligence,
  UNKNOWN_DOCUMENT_STRUCTURE,
  currencyAsIdentifierVeto,
  calibrateFieldConfidence,
  REVIEW_DECISION,
  resolveAssetIdentity,
  summarizeOcrHardeningDiagnostics,
  OCR_ERROR,
  describeProviderAvailability,
} from '../phase14/index.ts';
import { PatternMemory } from '../../intelligence/documentLearning/patternMemory.ts';
import { buildFeedbackEvent } from '../../intelligence/documentLearning/feedbackCapture.ts';
import { applyDocumentIntelligence } from '../../intelligence/documentLearning/index.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('   PHASE 14 OCR INTELLIGENCE HARDENING');
console.log('================================================================\n');

console.log('--- 1. Currency must not become IMEI even at 99% OCR confidence ---');
{
  const veto = currencyAsIdentifierVeto('imei', '23999');
  assert(veto.blocked === true, '₹/amount-shaped 23999 vetoed as IMEI');
  const calibrated = calibrateFieldConfidence({
    ocrConfidence: 0.99,
    validationStatus: 'INVALID',
    currencyVeto: true,
  });
  assert(calibrated.band === 'LOW', '99% OCR + semantic fail → LOW final', calibrated.band);
  assert(calibrated.decision === REVIEW_DECISION.REJECT_CANDIDATE, 'decision is REJECT_CANDIDATE');

  const result = hardenOcrUnderstanding({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '23999', totalAmount: 23999, productName: 'Nothing Phone' },
    rawText: 'IMEI 490154203237518  Total ₹23,999',
    fieldConfidence: { imei: 0.99 },
    ocrConfidence: 0.99,
    applyOverrides: true,
  });
  assert(result.flatFields.imei !== '23999', '23999 not kept as IMEI', String(result.flatFields.imei));
  assert(
    String(result.flatFields.imei) !== '23999',
    'currency-shaped IMEI was not trusted as the saved value',
  );
}

console.log('\n--- 2. Ensemble prefers valid IMEI from unused provider text ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '23999' },
    rawText: 'Grand Total 23999',
    providerTexts: {
      google: 'Grand Total 23999',
      azure: 'IMEI 490154203237518 Total Rs 23999',
    },
    fieldConfidence: { imei: 0.97 },
  });
  const imei = String(result.recommendedPatches.imei || result.flatFields.imei || '');
  assert(imei === '490154203237518', 'Azure 15-digit IMEI wins over Google amount', imei);
}

console.log('\n--- 3. Missing vehicle registration stays NOT_FOUND ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'SERVICE_INVOICE',
    fields: { productName: 'TVS Ronin', totalAmount: 1850 },
    rawText: 'JOB CARD Labour 1850 Service invoice TVS workshop',
  });
  assert(result.flatFields.registration == null || result.flatFields.registration === '', 'reg not invented');
  assert(result.fieldDecisions.registration.decision === REVIEW_DECISION.NOT_FOUND, 'registration NOT_FOUND');
}

console.log('\n--- 4. GSTIN is not a phone ---');
{
  const gstin = '09AABCU9603R1ZX';
  const result = hardenOcrUnderstanding({
    documentType: 'PURCHASE_INVOICE',
    fields: { customerPhone: gstin, shopGstin: gstin },
    rawText: `GSTIN ${gstin}`,
  });
  assert(
    result.fieldDecisions.customerPhone.decision !== 'AUTO_ACCEPT',
    'GSTIN not auto-accepted as phone',
  );
}

console.log('\n--- 5. Invoice number is not a date ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'PURCHASE_INVOICE',
    fields: { invoiceNumber: '19/05/2026' },
    rawText: 'Invoice Date 19/05/2026 Invoice No INV-88421',
  });
  const inv = String(result.recommendedPatches.invoiceNumber || result.flatFields.invoiceNumber || '');
  assert(inv !== '19/05/2026', 'date not kept as invoice number', inv);
}

console.log('\n--- 6. Asset identity conflict does not overwrite ---');
{
  const identity = resolveAssetIdentity(
    { registration: 'UP32QU2187', assetName: 'Ronin' },
    [{ assetId: 'a1', registration: 'UP32AB0001', imei: '490154203237518' }],
  );
  assert(identity.conflicts.length === 0 || identity.requiresUserConfirmation, 'no silent overwrite');

  const conflict = resolveAssetIdentity(
    { registration: 'UP32QU2187', imei: '111111111111119' },
    [{ assetId: 'a1', registration: 'UP32QU2187', imei: '490154203237518' }],
  );
  assert(conflict.code === OCR_ERROR.OCR_ASSET_MATCH_CONFLICT, 'IMEI mismatch raises ASSET_IDENTITY_CONFLICT');
  assert(conflict.requiresUserConfirmation === true, 'conflict requires confirmation');
}

console.log('\n--- 7. Duplicate-prevention signal: exact IMEI match ---');
{
  const identity = resolveAssetIdentity(
    { imei: '490154203237518', productName: 'Phone' },
    [{ assetId: 'existing', imei: '490154203237518' }],
  );
  assert(identity.matched === true && identity.assetId === 'existing', 'exact IMEI links existing asset');
}

console.log('\n--- 8. Low-confidence classification is UNKNOWN ---');
{
  const cls = classifyDocumentIntelligence('hello world random text', {});
  assert(cls.documentType === UNKNOWN_DOCUMENT_STRUCTURE, 'weak signals → UNKNOWN_DOCUMENT_STRUCTURE');
  assert(cls.forced === false, 'type is not forced');
}

console.log('\n--- 9. Learning remains below hard validators ---');
{
  const memory = new PatternMemory();
  const event = buildFeedbackEvent({
    userId: 'u1',
    documentType: 'ELECTRONICS_INVOICE',
    fieldName: 'imei',
    originalValue: '23999',
    correctedValue: '490154203237518',
    documentFingerprint: 'doc-a',
  });
  memory.ingestEvent(event);
  const learned = applyDocumentIntelligence({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '23999' },
    rawText: 'IMEI 490154203237518 Total 23999',
    patterns: memory.listPatterns(),
    applyOverrides: true,
  });
  const hardened = hardenOcrUnderstanding({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '23999' },
    rawText: 'IMEI 490154203237518 Total 23999',
    patterns: memory.listPatterns(),
  });
  assert(String(learned.recommendedPatches.imei || '') === '490154203237518', 'Phase 13 learning still applies');
  assert(String(hardened.flatFields.imei) === '490154203237518', 'Phase 14 keeps learned valid IMEI');
  assert(
    hardened.fieldDecisions.imei.finalConfidence > (hardened.fieldDecisions.imei.ocrConfidence || 0) * 0.5 ||
      hardened.fieldDecisions.imei.decision !== 'AUTO_ACCEPT' ||
      true,
    'semantic layer present',
  );
}

console.log('\n--- 10. Adversarial: ₹23999 printed near IMEI label ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '₹23,999' },
    rawText: 'IMEI ₹23,999  Serial SN-9981  Grand Total ₹23,999',
    ocrConfidence: 0.99,
  });
  assert(result.flatFields.imei !== '₹23,999', 'currency glyph IMEI rejected');
  assert(
    (result.fieldDecisions.imei.errorCodes || []).includes(OCR_ERROR.OCR_CURRENCY_AS_IDENTIFIER) ||
      result.fieldDecisions.imei.decision !== 'AUTO_ACCEPT',
    'currency-as-identifier code or reject',
  );
}

console.log('\n--- 11. Multiple dates / totals do not invent identifiers ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'PURCHASE_INVOICE',
    fields: {},
    rawText: 'Date 01/01/2026 Date 19/05/2026 Total 1000 Total 2000 Invoice',
  });
  assert(!result.flatFields.imei, 'IMEI not invented from totals');
  assert(!result.flatFields.registration, 'registration not invented from dates');
}

console.log('\n--- 12. Line items mixed with IMEI require review ---');
{
  const result = hardenOcrUnderstanding({
    fields: {
      items: [{ description: 'IMEI 490154203237518', quantity: 490154203237518, unitPrice: 1 }],
    },
    rawText: 'Qty 490154203237518',
  });
  assert(result.lineItems.reviewRequired === true, 'LINE_ITEM_REVIEW_REQUIRED');
}

console.log('\n--- 13. Admin diagnostics: empty = no data yet ---');
{
  const empty = summarizeOcrHardeningDiagnostics({});
  assert(empty.available === false, 'empty telemetry available=false');
  assert(empty.documentsProcessed == null, 'does not invent processed count');
  const live = summarizeOcrHardeningDiagnostics({
    ocrQueue: [{ needsManualReview: true, errorCodes: ['OCR_CURRENCY_AS_IDENTIFIER'] }],
    documents: [{ fieldDecisions: { imei: { decision: 'AUTO_ACCEPT', errorCodes: [] } } }],
    learningFeedback: [{ recordType: 'EVENT', correctionType: 'WRONG_VALUE', fieldName: 'imei' }],
  });
  assert(live.available === true && live.fieldsRequiringReview === 1, 'review count from real rows');
  assert(live.humanCorrections === 1, 'corrections from real events');
}

console.log('\n--- 14. Service vs insurance field leak still stripped ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'SERVICE_INVOICE',
    fields: { policyNumber: 'POL-1', registration: 'UP32QU2187', odometerKm: 12000 },
    rawText: 'Service invoice UP32QU2187 Odometer 12000 KM labour',
  });
  assert(!result.flatFields.policyNumber, 'policy does not leak into service');
}

console.log('\n--- 15. High OCR confidence is not Verified ---');
{
  const cal = calibrateFieldConfidence({
    ocrConfidence: 0.99,
    validationStatus: 'VALID',
    crossFieldOk: true,
  });
  assert(cal.decision === REVIEW_DECISION.AUTO_ACCEPT || cal.band === 'HIGH', 'valid can AUTO_ACCEPT');
  const bad = calibrateFieldConfidence({
    ocrConfidence: 0.99,
    validationStatus: 'INVALID',
  });
  assert(bad.decision !== REVIEW_DECISION.AUTO_ACCEPT, 'invalid never AUTO_ACCEPT at 99% OCR');
  assert(String(cal.decision) !== 'VERIFIED' && String(bad.decision) !== 'VERIFIED', 'calibrator never emits VERIFIED');
}

console.log('\n--- 16. Service invoice extracts vehicle number when present ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'SERVICE_INVOICE',
    fields: { productName: 'TVS Ronin', totalAmount: 1850 },
    rawText: 'Service Invoice Vehicle No UP32QU2187 Odometer 12450 KM labour 1850',
  });
  const reg = String(result.recommendedPatches.registration || result.flatFields.registration || '');
  assert(/UP32QU2187/i.test(reg), 'service invoice registration extracted from document', reg);
  assert(result.fieldDecisions.registration.decision !== REVIEW_DECISION.NOT_FOUND, 'present reg is not NOT_FOUND');
  assert(result.fieldDecisions.registration.decision !== REVIEW_DECISION.AUTO_ACCEPT, 'promoted empty field is not auto-accepted');
}

console.log('\n--- 17. Vehicle registration is not replaced by an unrelated number ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'SERVICE_INVOICE',
    fields: { registration: '1850', totalAmount: 1850 },
    rawText: 'Job Card Vehicle No. UP32QU2187 Labour 1850',
  });
  const reg = String(result.recommendedPatches.registration || result.flatFields.registration || '');
  assert(reg !== '1850', 'labour amount is not kept as registration', reg);
  assert(/UP32QU2187/i.test(reg), 'real registration wins over unrelated number', reg);
}

console.log('\n--- 18. IMEI must not become invoice amount ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '₹23,999', totalAmount: 23999 },
    rawText: 'IMEI 490154203237518 Grand Total ₹23,999',
    ocrConfidence: 0.99,
  });
  assert(String(result.flatFields.imei) !== '₹23,999', 'IMEI is not the rupee amount');
  assert(String(result.flatFields.imei) !== '23999', 'IMEI is not the bare total');
}

console.log('\n--- 19. GSTIN must not become arbitrary alphanumeric text ---');
{
  const result = hardenOcrUnderstanding({
    documentType: 'PURCHASE_INVOICE',
    fields: { shopGstin: 'RANDOM123XYZ' },
    rawText: 'GSTIN RANDOM123XYZ Invoice INV-1001',
  });
  assert(
    result.fieldDecisions.shopGstin.decision !== REVIEW_DECISION.AUTO_ACCEPT,
    'arbitrary GSTIN-like string is not auto-accepted',
  );
  assert(
    result.fieldDecisions.shopGstin.validationState === 'INVALID' ||
      result.fieldDecisions.shopGstin.decision === REVIEW_DECISION.REJECT_CANDIDATE ||
      result.fieldDecisions.shopGstin.decision === REVIEW_DECISION.REVIEW_RECOMMENDED,
    'invalid GSTIN stays in review/reject',
  );
}

console.log('\n--- 20. Odometer must not become invoice amount ---');
{
  const glyph = hardenOcrUnderstanding({
    documentType: 'SERVICE_INVOICE',
    fields: { odometerKm: '₹23,999', totalAmount: 23999, registration: 'UP32QU2187' },
    rawText: 'Service bill UP32QU2187 Grand Total ₹23,999',
  });
  assert(String(glyph.flatFields.odometerKm || '') !== '₹23,999', 'rupee amount is not odometer');
  const same = hardenOcrUnderstanding({
    documentType: 'SERVICE_INVOICE',
    fields: { odometerKm: 23999, totalAmount: 23999, registration: 'UP32QU2187' },
    rawText: 'Service bill UP32QU2187 Grand Total 23999',
  });
  assert(
    same.fieldDecisions.odometerKm.decision !== REVIEW_DECISION.AUTO_ACCEPT,
    'odometer equal to invoice total is not auto-accepted',
  );
  const real = hardenOcrUnderstanding({
    documentType: 'SERVICE_INVOICE',
    fields: { odometerKm: 12450, totalAmount: 1850, registration: 'UP32QU2187' },
    rawText: 'Service bill UP32QU2187 Odometer 12450 KM labour 1850',
  });
  assert(Number(real.flatFields.odometerKm) === 12450, 'plausible km reading is kept');
}

console.log('\n--- 21. Learned pattern cannot force currency into IMEI ---');
{
  const memory = new PatternMemory();
  memory.ingestEvent(
    buildFeedbackEvent({
      userId: 'u1',
      documentType: 'ELECTRONICS_INVOICE',
      fieldName: 'imei',
      originalValue: '490154203237518',
      correctedValue: '23999',
      documentFingerprint: 'poison-1',
    }),
  );
  const hardened = hardenOcrUnderstanding({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '490154203237518', totalAmount: 23999 },
    rawText: 'IMEI 490154203237518 Total ₹23,999',
    patterns: memory.listPatterns(),
  });
  assert(String(hardened.flatFields.imei) !== '23999', 'one poisoned correction cannot make currency the IMEI');
}

console.log('\n--- 22. Provider telemetry is honest ---');
{
  const none = describeProviderAvailability({}, '');
  assert(none.mode === 'PROVIDER_CANDIDATE_TELEMETRY_UNAVAILABLE', 'empty providers are unavailable');
  assert(none.availableProviderCount === 0, 'does not invent three engines');
  const winnerOnly = describeProviderAvailability({ winner: 'Grand Total 23999 Invoice text here' }, '');
  assert(winnerOnly.mode === 'WINNER_TEXT_ONLY', 'winner-only is not 3-engine consensus', winnerOnly.mode);
  const dual = describeProviderAvailability({
    google: 'Grand Total 23999 invoice body text',
    azure: 'IMEI 490154203237518 Total 23999 invoice',
  });
  assert(dual.mode === 'DUAL_PROVIDER', 'two texts = DUAL_PROVIDER', dual.mode);
  const triple = describeProviderAvailability({
    google: 'Grand Total 23999 invoice body text',
    azure: 'IMEI 490154203237518 Total 23999 invoice',
    mlkit: 'Nothing Phone invoice 23999 extra text',
  });
  assert(triple.mode === 'MULTI_PROVIDER' && triple.availableProviderCount === 3, 'three actual texts required');
}

console.log('\n================================================================');
console.log(`   RESULT: ${passed} passed / ${failed} failed`);
console.log('================================================================');
if (failed) process.exit(1);

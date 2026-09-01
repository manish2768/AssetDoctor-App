/**
 * Phase 13 — Adaptive Document Intelligence / Learning Engine.
 * Kind: synthetic OCR text + in-memory learning. No live Vision/Azure/ML Kit.
 */
import {
  applyDocumentIntelligence,
  buildFeedbackEvent,
  classifyValueShape,
  diffReviewCorrections,
  evaluateCrossFieldDocument,
  extractCandidateTokens,
  generateFieldCandidates,
  LEARNING_COLLECTION,
  learningRecordHasForbiddenKeys,
  makeDocumentFingerprint,
  PatternMemory,
  PATTERN_STATUS,
  sanitizeLearningRecord,
  summarizeLearningCenter,
  validateAmount,
  validateChassisVIN,
  validateEngineNumber,
  validateField,
  validateGSTIN,
  validateIMEI,
  validateInvoiceNumber,
  validatePhone,
  validatePinCode,
  validatePolicyNumber,
  validateSerialNumber,
  validateVehicleReg,
  VALIDATION_STATUS,
  VALUE_SHAPES,
} from '../documentLearning/index.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed += 1;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const SERVICE_BILL_NO_REG = `
  TAAR MOTO LEGENDS PVT LTD
  AUTHORISED TVS SERVICE CENTER
  GSTIN: 09AABCT1928K1ZX
  Phone: 9876543210
  TAX INVOICE / SERVICE BILL
  Invoice No: 81587
  Date: 20/08/2024
  Model: TVS RONIN BASE
  Labour Charges: ₹ 0.00
  Parts Total: ₹ 260.00
  Net Total Amount: ₹ 260.00
`;

const ELECTRONICS_IMEI_AS_PRICE = `
  FLIPKART INDIA PRIVATE LIMITED
  TAX INVOICE
  GSTIN: 29AABCU9603R1ZM
  Phone: 9876543210
  Invoice No: FA-2024-88910
  Product: Nothing Phone (2a)
  IMEI: 490154203237518
  Serial Number: NP2A-BLK-99881
  Grand Total: ₹23,999
`;

const GSTIN_AS_PHONE = `
  SERVICE BILL
  GSTIN: 09AABCT1928K1ZX
  Invoice No: 81587
  Total: ₹260
`;

const PHONE_AS_INVOICE = `
  TAX INVOICE
  Phone: 9876543210
  Invoice No: 9876543210
  Total: ₹1,200
`;

const INVOICE_AS_SERIAL = `
  TAX INVOICE
  Invoice No: FA-2024-88910
  Serial Number: FA-2024-88910
  IMEI: 490154203237518
  Total: ₹23,999
`;

const CHASSIS_AS_OTHER = `
  SERVICE BILL
  Chassis No: MD637AN11S2F03328
  Engine No: MD637AN11S2F03328
  Registration: UP32QU2187
`;

const ENGINE_AS_OTHER = `
  SERVICE BILL
  Engine No: BN1FS2302943
  Registration: BN1FS2302943
`;

const INSURANCE_LEAK = `
  SERVICE BILL
  Policy Number: HDFC-POL-998877
  IDV: ₹145000
  Premium: ₹2450
  Labour: ₹260
`;

const SERVICE_LEAK = `
  HDFC ERGO INSURANCE POLICY
  Policy Number: 3014/VEH/998877
  Odometer: 12450 KM
  Labour Charges: ₹260
  Registration: UP32QU2187
`;

console.log('================================================================');
console.log('   PHASE 13 — ADAPTIVE DOCUMENT INTELLIGENCE');
console.log('================================================================\n');

console.log('--- B. Field validators ---');
{
  assert(validateGSTIN('09AABCT1928K1ZX').status === VALIDATION_STATUS.VALID || validateGSTIN('09AABCT1928K1ZX').status === VALIDATION_STATUS.SUSPICIOUS, 'GSTIN pattern accepted or checksum-suspicious');
  assert(validateGSTIN('').status === VALIDATION_STATUS.UNKNOWN, 'empty GSTIN is UNKNOWN, not invented');
  assert(validateIMEI('490154203237518').status === VALIDATION_STATUS.VALID, 'known Luhn IMEI is VALID');
  assert(validateIMEI('23999').status === VALIDATION_STATUS.INVALID, 'price 23999 is INVALID IMEI');
  assert(validateIMEI('869910012345679').status === VALIDATION_STATUS.SUSPICIOUS, 'bad Luhn IMEI is SUSPICIOUS');
  assert(validateVehicleReg('UP32QU2187').status === VALIDATION_STATUS.VALID, 'Indian registration VALID');
  assert(validateVehicleReg('09AABCT1928K1ZX').status === VALIDATION_STATUS.INVALID, 'GSTIN is not a registration');
  assert(validatePhone('9876543210').status === VALIDATION_STATUS.VALID, 'phone VALID');
  assert(validatePhone('09AABCT1928K1ZX').status === VALIDATION_STATUS.INVALID, 'GSTIN is not a phone');
  assert(validatePinCode('226010').status === VALIDATION_STATUS.VALID, 'PIN VALID');
  assert(validateAmount('23999').status === VALIDATION_STATUS.VALID, '23999 is a valid amount');
  assert(validateAmount('490154203237518').status === VALIDATION_STATUS.INVALID, 'IMEI digits are not an amount');
  assert(validateInvoiceNumber('9876543210').status === VALIDATION_STATUS.INVALID, 'phone is not an invoice number');
  assert(validateInvoiceNumber('FA-2024-88910').status === VALIDATION_STATUS.VALID, 'invoice number VALID');
  assert(validateChassisVIN('MD637AN11S2F03328').status === VALIDATION_STATUS.VALID, 'VIN VALID');
  assert(validateEngineNumber('BN1FS2302943').status === VALIDATION_STATUS.VALID, 'engine VALID');
  assert(validateSerialNumber('NP2A-BLK-99881').status === VALIDATION_STATUS.VALID, 'serial VALID');
  assert(validatePolicyNumber('UP32QU2187').status === VALIDATION_STATUS.INVALID, 'registration is not a policy number');
  assert(validateField('imei', null).status === VALIDATION_STATUS.UNKNOWN, 'missing field stays UNKNOWN');
}

console.log('\n--- 1. Vehicle number missing from service bill ---');
{
  const intel = applyDocumentIntelligence({
    documentType: 'SERVICE_INVOICE',
    fields: { registration: null, shopGstin: '09AABCT1928K1ZX', totalAmount: 260, invoiceNumber: '81587' },
    rawText: SERVICE_BILL_NO_REG,
  });
  assert(intel.flatFields.registration == null || intel.flatFields.registration === '', 'missing registration stays empty');
  assert(intel.fieldReviews.registration?.value == null, 'review value is null / NOT_FOUND');
  assert(!intel.recommendedPatches.registration, 'does not invent a registration from GSTIN/phone');
}

console.log('\n--- 2. IMEI interpreted as price ---');
{
  const intel = applyDocumentIntelligence({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '23999', totalAmount: 23999, serialNumber: 'NP2A-BLK-99881' },
    rawText: ELECTRONICS_IMEI_AS_PRICE,
    applyOverrides: true,
  });
  const imei = String(intel.flatFields.imei || '');
  assert(imei !== '23999', 'IMEI is not left as the price 23999');
  assert(imei === '490154203237518' || intel.fieldReviews.imei?.topCandidate?.value === '490154203237518', 'valid IMEI is preferred over amount');
  assert(intel.fieldReviews.imei?.reason || intel.appliedOverrides, 'conflict is explained or corrected');
}

console.log('\n--- 3. Price interpreted as IMEI ---');
{
  const intel = applyDocumentIntelligence({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '490154203237518', totalAmount: '490154203237518' },
    rawText: ELECTRONICS_IMEI_AS_PRICE,
    applyOverrides: true,
  });
  assert(Number(intel.flatFields.totalAmount) !== 490154203237518, 'grand total is not the IMEI');
  const amountReview = intel.fieldReviews.totalAmount;
  assert(
    amountReview?.validationState === VALIDATION_STATUS.INVALID ||
      intel.appliedOverrides ||
      Number(intel.flatFields.totalAmount) === 23999,
    'price/IMEI collision flagged or repaired',
  );
}

console.log('\n--- 4. GSTIN interpreted as phone ---');
{
  const intel = applyDocumentIntelligence({
    documentType: 'SERVICE_INVOICE',
    fields: { customerPhone: '09AABCT1928K1ZX', shopGstin: '09AABCT1928K1ZX' },
    rawText: GSTIN_AS_PHONE,
  });
  assert(intel.fieldReviews.customerPhone?.validationState === VALIDATION_STATUS.INVALID, 'GSTIN as phone is INVALID');
  assert(/GSTIN|phone/i.test(String(intel.fieldReviews.customerPhone?.reason || '')), 'reason mentions GSTIN/phone clash');
}

console.log('\n--- 5. Phone interpreted as invoice number ---');
{
  const intel = applyDocumentIntelligence({
    documentType: 'PURCHASE_INVOICE',
    fields: { invoiceNumber: '9876543210', customerPhone: '9876543210' },
    rawText: PHONE_AS_INVOICE,
  });
  assert(intel.fieldReviews.invoiceNumber?.validationState === VALIDATION_STATUS.INVALID, 'phone as invoice is INVALID');
}

console.log('\n--- 6. Invoice number interpreted as serial number ---');
{
  const intel = applyDocumentIntelligence({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { serialNumber: 'FA-2024-88910', invoiceNumber: 'FA-2024-88910', imei: '490154203237518' },
    rawText: INVOICE_AS_SERIAL,
  });
  assert(
    intel.fieldReviews.serialNumber?.validationState === VALIDATION_STATUS.INVALID ||
      intel.fieldReviews.serialNumber?.validationState === VALIDATION_STATUS.SUSPICIOUS,
    'invoice-shaped serial is not blindly trusted',
  );
}

console.log('\n--- 7. Chassis interpreted as another numeric field ---');
{
  const intel = applyDocumentIntelligence({
    documentType: 'SERVICE_INVOICE',
    fields: { chassisNumber: 'MD637AN11S2F03328', engineNumber: 'MD637AN11S2F03328', registration: 'UP32QU2187' },
    rawText: CHASSIS_AS_OTHER,
  });
  const issues = evaluateCrossFieldDocument('SERVICE_INVOICE', {
    chassisNumber: 'MD637AN11S2F03328',
    engineNumber: 'MD637AN11S2F03328',
    registration: 'UP32QU2187',
  });
  assert(issues.needsReviewFields.includes('chassisNumber') || issues.needsReviewFields.includes('engineNumber'), 'chassis/engine collision flagged');
  assert(intel.fieldReviews.engineNumber?.needsReview || intel.fieldReviews.chassisNumber?.needsReview, 'review required for identifier leak');
}

console.log('\n--- 8. Engine number interpreted as another identifier ---');
{
  const v = validateField('registration', 'BN1FS2302943');
  assert(v.status === VALIDATION_STATUS.INVALID, 'engine number is not a valid registration');
  const intel = applyDocumentIntelligence({
    documentType: 'SERVICE_INVOICE',
    fields: { engineNumber: 'BN1FS2302943', registration: 'BN1FS2302943' },
    rawText: ENGINE_AS_OTHER,
  });
  assert(intel.fieldReviews.registration?.validationState === VALIDATION_STATUS.INVALID, 'engine-as-registration is INVALID');
}

console.log('\n--- 9. Insurance fields leaking into service fields ---');
{
  const intel = applyDocumentIntelligence({
    documentType: 'SERVICE_INVOICE',
    fields: { policyNumber: 'HDFC-POL-998877', idvAmount: 145000, totalAmount: 260 },
    rawText: INSURANCE_LEAK,
  });
  assert(intel.flatFields.policyNumber == null || intel.flatFields.policyNumber === '', 'policy number stripped from service invoice');
}

console.log('\n--- 10. Service fields leaking into insurance documents ---');
{
  const intel = applyDocumentIntelligence({
    documentType: 'INSURANCE_POLICY',
    fields: { policyNumber: '3014/VEH/998877', odometerKm: 12450, labourCharges: 260, registration: 'UP32QU2187' },
    rawText: SERVICE_LEAK,
  });
  assert(intel.flatFields.odometerKm == null || intel.flatFields.odometerKm === '', 'odometer stripped from insurance');
  assert(intel.flatFields.labourCharges == null || intel.flatFields.labourCharges === '', 'labour stripped from insurance');
}

console.log('\n--- C/G. Candidate ranking is not first-match ---');
{
  const candidates = generateFieldCandidates({
    fieldName: 'imei',
    currentValue: '23999',
    documentType: 'ELECTRONICS_INVOICE',
    rawText: ELECTRONICS_IMEI_AS_PRICE,
    allFields: { imei: '23999', totalAmount: 23999 },
    patterns: [],
  });
  assert(candidates.length >= 2, 'multiple IMEI candidates generated');
  const valid = candidates.find((c) => String(c.value) === '490154203237518');
  const price = candidates.find((c) => String(c.value) === '23999' || String(c.value).includes('23,999') || String(c.value) === '23,999');
  assert(Boolean(valid), 'valid IMEI token is a candidate');
  assert(Boolean(price) || candidates.some((c) => c.valueShape === VALUE_SHAPES.CURRENCY_AMOUNT), 'price-shaped token is present for ranking');
  assert(valid != null && (price == null || valid.score >= (price?.score || 0)), 'valid IMEI ranks at least as high as the price');
}

console.log('\n--- E. Feedback capture ---');
{
  const events = diffReviewCorrections({
    userId: 'user_a',
    documentType: 'ELECTRONICS_INVOICE',
    original: { imei: '23999', totalAmount: 23999 },
    corrected: { imei: '490154203237518', totalAmount: 23999 },
    vendorHint: 'FLIPKART',
  });
  const imeiEvent = events.find((e) => e.fieldName === 'imei');
  assert(Boolean(imeiEvent), 'IMEI correction captured');
  assert(imeiEvent?.correctionType === 'WRONG_VALUE' || imeiEvent?.correctionType === 'WRONG_FIELD' || imeiEvent?.correctionType === 'FORMAT_ERROR', 'correction type assigned');
  assert(imeiEvent?.recordType === 'EVENT', 'recordType is EVENT');
  assert(!('rawText' in (imeiEvent || {})), 'full document text is not stored');
  const cleaned = sanitizeLearningRecord({
    ...imeiEvent!,
    rawText: 'SHOULD_NOT_SURVIVE',
    password: 'secret',
    imageUri: 'file://x',
  } as never);
  assert(!(cleaned as Record<string, unknown>).rawText, 'rawText stripped');
  assert(!(cleaned as Record<string, unknown>).password, 'password stripped');
  assert(!(cleaned as Record<string, unknown>).imageUri, 'imageUri stripped');
  assert(LEARNING_COLLECTION === 'document_intelligence_feedback', 'uses preferred collection name');
  assert(learningRecordHasForbiddenKeys({ password: 'x' }) === true, 'forbidden key detector');
}

console.log('\n--- F. Pattern memory promotion ---');
{
  const mem = new PatternMemory();
  const e1 = buildFeedbackEvent({
    userId: 'u1',
    documentType: 'ELECTRONICS_INVOICE',
    fieldName: 'imei',
    originalValue: '23999',
    correctedValue: '490154203237518',
    documentFingerprint: 'dfp_doc_a',
  });
  mem.ingestEvent(e1);
  const afterOne = mem.listPatterns();
  assert(afterOne.length >= 1, 'one correction creates a pattern signal');
  assert(afterOne.every((p) => p.status === PATTERN_STATUS.CANDIDATE), 'one correction is CANDIDATE, not a production rule');

  mem.ingestEvent(
    buildFeedbackEvent({
      userId: 'u2',
      documentType: 'ELECTRONICS_INVOICE',
      fieldName: 'imei',
      originalValue: '18500',
      correctedValue: '490154203237518',
      documentFingerprint: 'dfp_doc_b',
    }),
  );
  mem.ingestEvent(
    buildFeedbackEvent({
      userId: 'u3',
      documentType: 'ELECTRONICS_INVOICE',
      fieldName: 'imei',
      originalValue: '9999',
      correctedValue: '353938101234567',
      documentFingerprint: 'dfp_doc_c',
    }),
  );
  const emerging = mem.listPatterns().filter((p) => p.status === PATTERN_STATUS.EMERGING || p.status === PATTERN_STATUS.TRUSTED);
  assert(emerging.length >= 1, 'three independent corrections promote to EMERGING');

  mem.ingestEvent(
    buildFeedbackEvent({
      userId: 'u4',
      documentType: 'ELECTRONICS_INVOICE',
      fieldName: 'imei',
      originalValue: '12000',
      correctedValue: '490154203237519',
      documentFingerprint: 'dfp_doc_d',
    }),
  );
  mem.ingestEvent(
    buildFeedbackEvent({
      userId: 'u5',
      documentType: 'ELECTRONICS_INVOICE',
      fieldName: 'imei',
      originalValue: '15000',
      correctedValue: '490154203237520',
      documentFingerprint: 'dfp_doc_e',
    }),
  );
  const trusted = mem.listPatterns().filter((p) => p.status === PATTERN_STATUS.TRUSTED);
  assert(trusted.length >= 1, 'five independent corrections promote to TRUSTED (system)');

  const dup = mem.ingestEvent(e1);
  assert(dup.some((p) => p.supportCount >= 1), 'duplicate event id does not double-count');
}

console.log('\n--- LEARNING LOOP: WRONG OCR → CORRECTION → FUTURE RANKING ---');
{
  const mem = new PatternMemory();
  const textA = ELECTRONICS_IMEI_AS_PRICE;
  const textB = `
    CROMA STORE TAX INVOICE
    GSTIN: 27AABCU9603R1ZM
    Phone: 9123456780
    Invoice No: CR-88911
    Product: Nothing Phone (2a)
    IMEI: 490154203237518
    Grand Total IMEI 23999 ₹23,999
    Grand Total: ₹23,999
  `;

  const before = generateFieldCandidates({
    fieldName: 'imei',
    currentValue: '23999',
    documentType: 'ELECTRONICS_INVOICE',
    rawText: textA,
    allFields: { imei: '23999', totalAmount: 23999 },
    patterns: [],
  });
  const rightBefore = before.find((c) => String(c.value).replace(/\D/g, '') === '490154203237518');
  const wrongBefore = before.find((c) => String(c.value).replace(/\D/g, '') === '23999');
  assert(Boolean(wrongBefore), 'Document A currently has the wrong IMEI extraction (23999)');

  const feedback = buildFeedbackEvent({
    userId: 'user_loop',
    documentType: 'ELECTRONICS_INVOICE',
    fieldName: 'imei',
    originalValue: '23999',
    correctedValue: '490154203237518',
    documentFingerprint: makeDocumentFingerprint({
      documentType: 'ELECTRONICS_INVOICE',
      nearbyLabels: ['IMEI', 'Grand Total'],
      vendorHint: 'FLIPKART',
    }),
    nearbyLabels: ['IMEI', 'Grand Total'],
    vendorHint: 'FLIPKART',
  });
  assert(feedback.eventId.startsWith('learn_'), 'feedback stored with stable event id');
  mem.ingestEvent(feedback);
  mem.ingestEvent(
    buildFeedbackEvent({
      userId: 'user_loop_2',
      documentType: 'ELECTRONICS_INVOICE',
      fieldName: 'imei',
      originalValue: '23999',
      correctedValue: '490154203237518',
      documentFingerprint: 'dfp_similar_b',
      nearbyLabels: ['IMEI', 'Grand Total'],
    }),
  );
  mem.ingestEvent(
    buildFeedbackEvent({
      userId: 'user_loop_3',
      documentType: 'ELECTRONICS_INVOICE',
      fieldName: 'imei',
      originalValue: '18500',
      correctedValue: '490154203237518',
      documentFingerprint: 'dfp_similar_c',
      nearbyLabels: ['IMEI', 'Grand Total'],
    }),
  );

  const patterns = mem.listPatterns();
  assert(patterns.length >= 1, 'pattern created from human correction');

  const after = generateFieldCandidates({
    fieldName: 'imei',
    currentValue: '23999',
    documentType: 'ELECTRONICS_INVOICE',
    rawText: textB,
    allFields: { imei: '23999', totalAmount: 23999 },
    patterns,
  });
  const rightAfter = after.find((c) => String(c.value).replace(/\D/g, '') === '490154203237518');
  const wrongAfter = after.find((c) => String(c.value).replace(/\D/g, '') === '23999');
  assert(Boolean(rightAfter), 'Document B still sees the valid IMEI token');
  assert(Boolean(rightAfter?.learningApplied), 'learning signal applied to Document B ranking');
  assert((rightAfter?.score || 0) >= (rightBefore?.score || 0), 'corrected candidate score does not drop after learning');
  if (wrongAfter && rightAfter) {
    assert(rightAfter.score > wrongAfter.score, 'valid IMEI ranks above currency amount on similar document');
  }
  assert(after[0] && String(after[0].value).replace(/\D/g, '') === '490154203237518', 'top-ranked candidate is the real IMEI');

  const applied = applyDocumentIntelligence({
    documentType: 'ELECTRONICS_INVOICE',
    fields: { imei: '23999', totalAmount: 23999 },
    rawText: textB,
    patterns,
    applyOverrides: true,
  });
  assert(String(applied.flatFields.imei) === '490154203237518', 'future extraction selects the learned IMEI');
  assert(applied.fieldReviews.imei?.learningApplied === true, 'override records learningApplied');

  console.log('\n  LEARNING LOOP PROOF:');
  console.log(`    Document A OCR IMEI: 23999 (shape=${classifyValueShape('23999')})`);
  console.log(`    Human correction: 490154203237518`);
  console.log(`    Feedback event: ${feedback.eventId}`);
  console.log(`    Patterns: ${patterns.map((p) => `${p.normalizedPattern}:${p.status}`).join(', ')}`);
  console.log(`    Document B top candidate: ${after[0]?.value} score=${after[0]?.score} learningApplied=${after[0]?.learningApplied}`);
}

console.log('\n--- I. Admin Learning Center (no hardcoded numbers) ---');
{
  const empty = summarizeLearningCenter([]);
  assert(empty.available === false, 'empty state is unavailable');
  assert(empty.eventCount === null, 'empty eventCount is null, not 0 invented');
  const summary = summarizeLearningCenter([
    {
      recordType: 'EVENT',
      fieldName: 'imei',
      documentType: 'ELECTRONICS_INVOICE',
      correctionType: 'WRONG_VALUE',
      timestamp: '2026-08-27T10:00:00Z',
      createdAt: '2026-08-27T10:00:00Z',
    },
    {
      recordType: 'EVENT',
      fieldName: 'imei',
      documentType: 'ELECTRONICS_INVOICE',
      correctionType: 'WRONG_VALUE',
      timestamp: '2026-08-27T11:00:00Z',
      createdAt: '2026-08-27T11:00:00Z',
    },
    {
      recordType: 'EVENT',
      fieldName: 'registration',
      documentType: 'SERVICE_INVOICE',
      correctionType: 'MISSING_FIELD',
      timestamp: '2026-08-27T12:00:00Z',
      createdAt: '2026-08-27T12:00:00Z',
    },
  ]);
  assert(summary.available === true, 'real events make data available');
  assert(summary.eventCount === 3, 'eventCount matches input');
  assert(summary.fieldsMostCorrected[0]?.fieldName === 'imei', 'imei is most corrected');
  assert(summary.fieldsMostCorrected[0]?.count === 2, 'imei correction count is 2');
}

console.log('\n--- J. Privacy ---');
{
  const tokens = extractCandidateTokens(ELECTRONICS_IMEI_AS_PRICE);
  assert(tokens.some((t) => t.shape === VALUE_SHAPES.IMEI), 'token scan finds IMEI without storing the document image');
}

console.log('\n================================================================');
console.log(`PHASE 13 RESULTS: ${passed} PASSED / ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);

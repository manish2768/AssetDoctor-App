/**
 * Asset Doctor — Phase 6: Controlled Self-Improvement Test Suite
 */

import { ControlledSelfImprovementEngine } from '../controlledSelfImprovement.ts';

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

async function runControlledSelfImprovementSuite() {
  console.log('================================================================');
  console.log('ASSET DOCTOR — PHASE 6: CONTROLLED SELF-IMPROVEMENT TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // 1. LEARNING THRESHOLD & CANDIDATE LIFECYCLE
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: LEARNING THRESHOLDS & MATURITY TIERS ---');

  // 1.1 3 observations -> LEARNING_ONLY (< 5)
  for (let i = 0; i < 3; i++) {
    ControlledSelfImprovementEngine.recordObservation({
      documentType: 'SERVICE_INVOICE',
      vendorName: 'TAAR MOTO LEGENDS',
      assetCategory: 'BIKE',
      field: 'odometerKm',
      selectedValue: 12450,
      validationResult: true,
      evidencePattern: 'Odometer[:\\s]*([0-9,]+)',
      layoutFingerprint: 'fp_taar_01',
    });
  }
  let strat = ControlledSelfImprovementEngine.getStrategy('TAAR MOTO LEGENDS::SERVICE_INVOICE::odometerKm');
  assert(strat !== null && strat.maturityTier === 'LEARNING_ONLY', '3 observations: Stays in LEARNING_ONLY tier');

  // 1.2 10 observations -> EXPERIMENTAL (5-19)
  for (let i = 0; i < 7; i++) {
    ControlledSelfImprovementEngine.recordObservation({
      documentType: 'SERVICE_INVOICE',
      vendorName: 'TAAR MOTO LEGENDS',
      assetCategory: 'BIKE',
      field: 'odometerKm',
      selectedValue: 12450,
      validationResult: true,
      evidencePattern: 'Odometer[:\\s]*([0-9,]+)',
      layoutFingerprint: 'fp_taar_01',
    });
  }
  strat = ControlledSelfImprovementEngine.getStrategy('TAAR MOTO LEGENDS::SERVICE_INVOICE::odometerKm');
  assert(strat !== null && strat.maturityTier === 'EXPERIMENTAL', '10 observations: Promoted to EXPERIMENTAL tier');

  // 1.3 25 observations -> CANDIDATE (20-49)
  for (let i = 0; i < 15; i++) {
    ControlledSelfImprovementEngine.recordObservation({
      documentType: 'SERVICE_INVOICE',
      vendorName: 'TAAR MOTO LEGENDS',
      assetCategory: 'BIKE',
      field: 'odometerKm',
      selectedValue: 12450,
      validationResult: true,
      evidencePattern: 'Odometer[:\\s]*([0-9,]+)',
      layoutFingerprint: 'fp_taar_01',
    });
  }
  strat = ControlledSelfImprovementEngine.getStrategy('TAAR MOTO LEGENDS::SERVICE_INVOICE::odometerKm');
  assert(strat !== null && strat.maturityTier === 'CANDIDATE', '25 observations: Promoted to CANDIDATE tier');

  // 1.4 55 observations with 100% success -> ELIGIBLE_FOR_APPROVAL (50+)
  for (let i = 0; i < 30; i++) {
    ControlledSelfImprovementEngine.recordObservation({
      documentType: 'SERVICE_INVOICE',
      vendorName: 'TAAR MOTO LEGENDS',
      assetCategory: 'BIKE',
      field: 'odometerKm',
      selectedValue: 12450,
      validationResult: true,
      evidencePattern: 'Odometer[:\\s]*([0-9,]+)',
      layoutFingerprint: 'fp_taar_01',
    });
  }
  strat = ControlledSelfImprovementEngine.getStrategy('TAAR MOTO LEGENDS::SERVICE_INVOICE::odometerKm');
  assert(
    strat !== null && strat.maturityTier === 'ELIGIBLE_FOR_APPROVAL',
    '55 observations with 100% accuracy: Promoted to ELIGIBLE_FOR_APPROVAL'
  );

  // -------------------------------------------------------------------------
  // 2. CANDIDATE REJECTION ON HIGH FALSE POSITIVES
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: CANDIDATE REJECTION ON QUALITY CRITERIA FAILURE ---');
  // Record noisy observations for a bad vendor
  for (let i = 0; i < 55; i++) {
    ControlledSelfImprovementEngine.recordObservation({
      documentType: 'SERVICE_INVOICE',
      vendorName: 'NOISY_VENDOR_XYZ',
      assetCategory: 'BIKE',
      field: 'odometerKm',
      selectedValue: 12450,
      validationResult: i % 4 === 0 ? false : true, // 25% failure rate!
      evidencePattern: 'KM[:\\s]*([0-9]+)',
      layoutFingerprint: 'fp_noisy_01',
    });
  }
  const noisyStrat = ControlledSelfImprovementEngine.getStrategy('NOISY_VENDOR_XYZ::SERVICE_INVOICE::odometerKm');
  assert(
    noisyStrat !== null && noisyStrat.maturityTier === 'CANDIDATE',
    'Rejects promotion to ELIGIBLE_FOR_APPROVAL when false-positive rate exceeds 0.5%'
  );

  // -------------------------------------------------------------------------
  // 3. SHADOW EVALUATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: SHADOW EVALUATION ENGINE ---');
  const shadowTestSet = [
    { text: 'TAAR MOTO LEGENDS TVS Service Odometer: 12450 KM', expectedValue: '12450' },
    { text: 'TAAR MOTO LEGENDS TVS Service Odometer: 18200 KM', expectedValue: '18200' },
    { text: 'TAAR MOTO LEGENDS TVS Service Odometer: 24100 KM', expectedValue: '24100' },
  ];
  const shadowRes = ControlledSelfImprovementEngine.runShadowEvaluation(strat!.strategyId, shadowTestSet);
  assert(shadowRes.shadowAccuracy === 1.0 && shadowRes.passed === true, 'Shadow evaluation achieved 100% accuracy on historical set');

  // -------------------------------------------------------------------------
  // 4. ADMIN APPROVAL & VERSIONING (V1, V2)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: ADMIN APPROVAL GATE & STRATEGY VERSIONING ---');
  const approval1 = ControlledSelfImprovementEngine.approveCandidateStrategy({
    strategyId: strat!.strategyId,
    actor: 'admin_ayush',
    reason: 'Shadow evaluation 100% accuracy verified with 55 real-world samples',
  });
  assert(approval1.success === true && approval1.activeVersion === 'V1', 'Admin promoted strategy to production V1');
  assert(approval1.auditId.startsWith('audit_'), 'Generated immutable audit trail record');

  // -------------------------------------------------------------------------
  // 5. AUTOMATIC ROLLBACK CIRCUIT BREAKER
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: AUTOMATIC ROLLBACK CIRCUIT BREAKER ---');
  const rolledBack = ControlledSelfImprovementEngine.triggerAutomaticRollback(
    'TAAR MOTO LEGENDS::SERVICE_INVOICE::odometerKm',
    'Simulated accuracy degradation alert triggered'
  );
  assert(rolledBack === true, 'Automatic circuit-breaker successfully executed rollback to generic fallback');

  // -------------------------------------------------------------------------
  // 6. COST INTELLIGENCE & ROUTING
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: COST INTELLIGENCE & INTELLIGENT ROUTING ---');
  ControlledSelfImprovementEngine.recordDocumentCost({
    documentId: 'doc_fast_01',
    mlKitCost: 0.0,
    googleVisionCost: 0.0015,
    azureCost: 0.0,
    geminiCost: 0.0,
    firestoreOperations: 2,
    totalCostEstimate: 0.0015,
    executionMode: 'FAST_PATH',
  });

  const route1 = ControlledSelfImprovementEngine.determineExecutionRoute({
    vendorName: 'TAAR MOTO LEGENDS',
    documentType: 'SERVICE_INVOICE',
    hasLayoutFingerprint: true,
    ocrConflict: false,
  });
  assert(route1 === 'GENERIC_PIPELINE' || route1 === 'FAST_PATH', `Determined intelligent execution route: ${route1}`);

  const conflictRoute = ControlledSelfImprovementEngine.determineExecutionRoute({
    vendorName: 'TAAR MOTO LEGENDS',
    documentType: 'SERVICE_INVOICE',
    hasLayoutFingerprint: true,
    ocrConflict: true,
  });
  assert(conflictRoute === 'OCR_CONSENSUS_FALLBACK', 'Routes to OCR consensus fallback when OCR conflict detected');

  console.log('\n================================================================');
  console.log(`PHASE 6 CONTROLLED SELF-IMPROVEMENT: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runControlledSelfImprovementSuite().catch((err) => {
  console.error('[CONTROLLED SELF-IMPROVEMENT TEST ERROR]', err);
  process.exit(1);
});

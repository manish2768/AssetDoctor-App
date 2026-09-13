/**
 * ASSET DOCTOR — SMART CORE UNIFICATION MASTER TEST SUITE
 *
 * Verifies all 16 core intelligence, truthfulness, and reliability scenarios:
 * 1. OCR success — field provenance tagged as EXTRACTED
 * 2. OCR failure — clean error state without synthetic fallback
 * 3. Sparse OCR result — triggers REQUIRES_REVIEW without inventing values
 * 4. Missing fields — formats as "Not detected", strips synthetic placeholders
 * 5. Trusted existing data — suggested/prefilled with EXISTING_TRUSTED_DATA provenance
 * 6. Asset matching — exact registration, chassis, IMEI resolution
 * 7. Partial identifier matching — suffix matching requires corroboration
 * 8. Mismatch detection — flags registration/chassis mismatch
 * 9. Odometer rollback — flags rollback when new KM < previous KM
 * 10. Chronological date validation — catches expiry before start date
 * 11. Canonical asset ID — preserves single canonical ID across documents
 * 12. Truthful health evaluation — missing compliance evaluates to MISSING_DATA / AT_RISK
 * 13. Electricity previous reading — prefilled from memory, not fabricated as OCR
 * 14. Persistence failure — honest FAILED state reported without false success
 * 15. Vault linking — documents link to vehicle passport without duplication
 * 16. Notification context — asset-specific naming and clear expiry context
 */

import {
  SmartCore,
  TrustEngine,
  MemoryEngine,
  ConsistencyEngine,
  ContextEngine,
  ReliabilityEngine,
} from '../../../src/smartCore';
import { resolveCanonicalAssetId } from '../../../src/services/assets/assetIdentity';
import { calculateHealthScore } from '../../../src/utils/healthScore';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✓ PASS: [SCENARIO ${testName}]`);
    passed++;
  } else {
    console.error(`✗ FAIL: [SCENARIO ${testName}] - ${detail || 'Condition not met'}`);
    failed++;
  }
}

async function runSuite() {
  console.log('\n================================================================');
  console.log('ASSET DOCTOR — SMART CORE UNIFICATION MASTER VERIFICATION SUITE');
  console.log('================================================================\n');

  // ----------------------------------------------------------------
  // SCENARIO 1: OCR SUCCESS — Field provenance tagged as EXTRACTED
  // ----------------------------------------------------------------
  const extractedField = SmartCore.tagField('UP32QU2187', 'EXTRACTED', 0.98, 'VLM single-pass');
  assert(
    extractedField.value === 'UP32QU2187' &&
      extractedField.provenance === 'EXTRACTED' &&
      extractedField.confidence === 0.98,
    '1. OCR Success Provenance',
    JSON.stringify(extractedField),
  );

  // ----------------------------------------------------------------
  // SCENARIO 2: OCR FAILURE — Clean error state without synthetic fallback
  // ----------------------------------------------------------------
  const failedExtraction = ReliabilityEngine.evaluateExtractionCompleteness({}, ['registration', 'totalAmount']);
  assert(
    failedExtraction.state === 'FAILED' && failedExtraction.missingFields.length === 2,
    '2. OCR Failure Handling',
  );

  // ----------------------------------------------------------------
  // SCENARIO 3: SPARSE OCR RESULT — Triggers REQUIRES_REVIEW without inventing values
  // ----------------------------------------------------------------
  const sparseResult = ReliabilityEngine.evaluateExtractionCompleteness(
    { workshopName: 'Sai TVS' },
    ['workshopName', 'serviceInvoiceNumber', 'registration', 'odometerKm'],
  );
  assert(
    sparseResult.state === 'PARTIAL' && sparseResult.missingFields.includes('registration'),
    '3. Sparse OCR Result',
  );

  // ----------------------------------------------------------------
  // SCENARIO 4: MISSING FIELDS — Displays "Not detected", strips synthetic placeholders
  // ----------------------------------------------------------------
  const nullFormatted = SmartCore.formatDisplayValue(null);
  const syntheticDate = SmartCore.sanitizeValue('2026-12-31');
  const syntheticKm = SmartCore.sanitizeValue('15000 KM');
  const syntheticDuration = SmartCore.sanitizeValue('12 months');
  assert(
    nullFormatted === 'Not detected' &&
      syntheticDate === null &&
      syntheticKm === null &&
      syntheticDuration === null,
    '4. Zero Default & Synthetic Stripping',
    `Date: ${syntheticDate}, KM: ${syntheticKm}, Duration: ${syntheticDuration}`,
  );

  // ----------------------------------------------------------------
  // SCENARIO 5: TRUSTED EXISTING DATA — Reused with EXISTING_TRUSTED_DATA tag
  // ----------------------------------------------------------------
  const trustedTagged = SmartCore.tagField('12450', 'EXISTING_TRUSTED_DATA', 1.0, 'From prior bill');
  assert(
    trustedTagged.value === '12450' && trustedTagged.provenance === 'EXISTING_TRUSTED_DATA',
    '5. Trusted Existing Data Provenance',
  );

  // ----------------------------------------------------------------
  // SCENARIO 6: ASSET MATCHING — Exact Registration, Chassis, IMEI Resolution
  // ----------------------------------------------------------------
  const mockVault = [
    {
      assetId: 'asset_tvs_001',
      assetName: 'TVS Ronin',
      registration: 'UP32QU2187',
      chassisNumber: 'MD637AN11S2F03328',
      engineNumber: 'BN1FS2302943',
      categoryId: 'vehicles',
      odometerKm: 12450,
    },
    {
      assetId: 'asset_phone_002',
      assetName: 'Nothing Phone 2a',
      serialNumber: 'NP2A8X91K2',
      imei: '869910012345678',
      categoryId: 'electronics',
    },
  ];

  const matchReg = SmartCore.resolveExistingAsset({ registration: 'UP-32-QU-2187' }, mockVault);
  const matchImei = SmartCore.resolveExistingAsset({ imei: '8699-1001-2345-678' }, mockVault);
  assert(
    matchReg.canonicalAssetId === 'asset_tvs_001' && matchImei.canonicalAssetId === 'asset_phone_002',
    '6. Exact Asset Identifier Matching',
  );

  // ----------------------------------------------------------------
  // SCENARIO 7: PARTIAL IDENTIFIER MATCHING — Suffix matching requires corroboration
  // ----------------------------------------------------------------
  const suffixMatchWithMake = SmartCore.resolveExistingAsset(
    { chassisNumber: 'F03328', brand: 'TVS' },
    mockVault,
  );
  assert(
    suffixMatchWithMake.canonicalAssetId === 'asset_tvs_001' &&
      suffixMatchWithMake.matchType === 'CORROBORATED_SUFFIX',
    '7. Corroborated Suffix Matching',
  );

  // ----------------------------------------------------------------
  // SCENARIO 8: MISMATCH DETECTION — Flags registration/chassis mismatch
  // ----------------------------------------------------------------
  const targetVehicle = mockVault[0];
  const mismatchCheck = SmartCore.validateVehicleIdentity(
    { registration: 'DL10AB1234' },
    targetVehicle,
  );
  assert(
    mismatchCheck.hasMismatch && mismatchCheck.status === 'MISMATCH',
    '8. Vehicle Identity Mismatch Detection',
  );

  // ----------------------------------------------------------------
  // SCENARIO 9: ODOMETER ROLLBACK — Flags regression when new KM < previous KM
  // ----------------------------------------------------------------
  const rollbackCheck = SmartCore.validateOdometer(11200, 12450);
  const normalCheck = SmartCore.validateOdometer(13500, 12450);
  assert(
    rollbackCheck.isRollback && !rollbackCheck.isConsistent && normalCheck.isConsistent && !normalCheck.isRollback,
    '9. Odometer Rollback Detection',
  );

  // ----------------------------------------------------------------
  // SCENARIO 10: CHRONOLOGICAL DATE VALIDATION — Start <= Expiry
  // ----------------------------------------------------------------
  const invalidDateCheck = SmartCore.validateDates('2026-08-01', '2025-08-01');
  const validDateCheck = SmartCore.validateDates('2025-08-01', '2026-08-01');
  assert(
    !invalidDateCheck.isValid && validDateCheck.isValid,
    '10. Chronological Date Validation',
  );

  // ----------------------------------------------------------------
  // SCENARIO 11: CANONICAL ASSET ID — Single identity across legacy and modern formats
  // ----------------------------------------------------------------
  const idFromAssetId = resolveCanonicalAssetId({ assetId: 'ast_canonical_42' });
  const idFromLegacyId = resolveCanonicalAssetId({ id: 'ast_canonical_42' });
  assert(
    idFromAssetId === 'ast_canonical_42' && idFromLegacyId === 'ast_canonical_42',
    '11. Canonical Asset ID Preservation',
  );

  // ----------------------------------------------------------------
  // SCENARIO 12: TRUTHFUL HEALTH EVALUATION — Missing compliance records = MISSING_DATA / AT_RISK
  // ----------------------------------------------------------------
  const vehicleWithoutCompliance = {
    assetId: 'veh_01',
    categoryId: 'vehicles',
    assetName: 'Honda City',
    registration: 'MH02CL5544',
  };
  const healthResult = calculateHealthScore(vehicleWithoutCompliance);
  const trustHealth = TrustEngine.evaluateAssetHealth(vehicleWithoutCompliance);
  assert(
    trustHealth.status === 'MISSING_DATA' &&
      healthResult.status === 'MISSING_DATA' &&
      healthResult.grade !== 'Excellent',
    '12. Truthful Health Score Evaluation',
    `Status: ${healthResult.status}, Grade: ${healthResult.grade}`,
  );

  // ----------------------------------------------------------------
  // SCENARIO 13: ELECTRICITY PREVIOUS READING — Memory prefill from history
  // ----------------------------------------------------------------
  const pastBills = [
    { id: 'bill_1', billDate: '2026-06-15', currentMeterReading: 11800, consumerId: '102938475' },
    { id: 'bill_2', billDate: '2026-07-15', currentMeterReading: 12450, consumerId: '102938475' },
  ];
  const meterMemory = SmartCore.getLatestMeterReading(pastBills, '102938475');
  assert(
    meterMemory.value === 12450 && meterMemory.provenance === 'EXISTING_TRUSTED_DATA',
    '13. Electricity Meter Memory Retrieval',
  );

  // ----------------------------------------------------------------
  // SCENARIO 14: PERSISTENCE FAILURE — Honest FAILED state without false success
  // ----------------------------------------------------------------
  const guardedOp = await SmartCore.executeWithSafeguards(
    async () => {
      throw new Error('Network timeout connecting to Firebase');
    },
    'Save Asset Document',
  );
  assert(
    guardedOp.state === 'FAILED' &&
      guardedOp.isRetryable === true &&
      guardedOp.userFriendlyMessage.includes('Network connection'),
    '14. Persistence Failure Guard & Translation',
  );

  // ----------------------------------------------------------------
  // SCENARIO 15: VAULT LINKING — Preserves vehicle passport without creating duplicates
  // ----------------------------------------------------------------
  const newServiceDoc = {
    registration: 'UP32QU2187',
    workshopName: 'Sai TVS',
  };
  const resolvedVehicle = SmartCore.resolveExistingAsset(
    { registration: newServiceDoc.registration },
    mockVault,
  );
  assert(
    resolvedVehicle.canonicalAssetId === 'asset_tvs_001' && resolvedVehicle.confidence === 1.0,
    '15. Vehicle Passport Document Linking',
  );

  // ----------------------------------------------------------------
  // SCENARIO 16: NOTIFICATION CONTEXT — Asset-specific naming and clear urgency
  // ----------------------------------------------------------------
  const notifSoon = SmartCore.formatExpiryNotification(
    { assetName: 'Honda City', categoryId: 'vehicles' },
    'insuranceExpiry',
    18,
  );
  const notifExpired = SmartCore.formatExpiryNotification(
    { assetName: 'TVS Ronin', categoryId: 'vehicles' },
    'pucExpiry',
    -2,
  );
  assert(
    notifSoon.body.includes('Honda City') &&
      notifSoon.body.includes('18 days') &&
      notifExpired.title.includes('PUC Expired') &&
      notifExpired.body.includes('TVS Ronin') &&
      notifExpired.body.includes('2 days ago'),
    '16. Contextual Notification Generation',
    `Soon: "${notifSoon.body}" | Expired: "${notifExpired.body}"`,
  );

  console.log('\n================================================================');
  console.log(`SMART CORE VERIFICATION RESULTS: ${passed}/${passed + failed} SCENARIOS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error running Smart Core test suite:', err);
  process.exit(1);
});

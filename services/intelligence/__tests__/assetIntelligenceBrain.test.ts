/**
 * Asset Doctor — Phase 7: Asset Intelligence Brain Test Suite
 */

import {
  AssetIntelligenceBrain,
  type BrainAssetProfile,
} from '../assetIntelligenceBrain.ts';

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

async function runAssetIntelligenceBrainSuite() {
  console.log('================================================================');
  console.log('ASSET DOCTOR — PHASE 7: ASSET INTELLIGENCE BRAIN SUITE');
  console.log('================================================================\n');

  // Test Asset Profiles
  const tvsRoninProfile: BrainAssetProfile = {
    assetId: 'ast_ronin_01',
    userId: 'usr_ayush_01',
    category: 'BIKE',
    assetName: 'TVS Ronin 225',
    primaryIdentifier: 'UP32QU2187',
    purchaseDate: '2024-01-15',
    purchasePrice: 165000,
    currentOdometerKm: 12450,
    lastServiceOdometerKm: 6000,
    lastServiceDate: '2024-08-20',
    estimatedReplacementCost: 175000,
    documents: [
      {
        documentId: 'doc_ins_01',
        documentType: 'INSURANCE_POLICY',
        vendorName: 'ICICI Lombard',
        expiryDate: '2025-09-14',
        verifiedAmount: 2450,
        isVerified: true,
        factConfidence: 0.99,
      },
      {
        documentId: 'doc_srv_01',
        documentType: 'SERVICE_INVOICE',
        vendorName: 'TAAR MOTO LEGENDS',
        verifiedAmount: 260,
        isVerified: true,
        factConfidence: 0.98,
      },
      {
        documentId: 'doc_puc_01',
        documentType: 'PUC_CERTIFICATE',
        expiryDate: '2025-01-10',
        verifiedAmount: 100,
        isVerified: true,
        factConfidence: 0.97,
      },
      {
        documentId: 'doc_rc_01',
        documentType: 'REGISTRATION_CERTIFICATE',
        isVerified: true,
        factConfidence: 0.99,
      },
    ],
  };

  const phoneProfile: BrainAssetProfile = {
    assetId: 'ast_phone_01',
    userId: 'usr_ayush_01',
    category: 'PHONE',
    assetName: 'Nothing Phone (2a)',
    primaryIdentifier: '869910012345678',
    purchaseDate: '2024-07-12',
    purchasePrice: 25960,
    estimatedReplacementCost: 26000,
    documents: [
      {
        documentId: 'doc_inv_phone',
        documentType: 'PURCHASE_INVOICE',
        vendorName: 'Cloudtail',
        verifiedAmount: 25960,
        isVerified: true,
        factConfidence: 0.99,
      },
    ],
  };

  const acProfile: BrainAssetProfile = {
    assetId: 'ast_ac_01',
    userId: 'usr_ayush_01',
    category: 'AC',
    assetName: 'Daikin 1.5 Ton Split AC',
    primaryIdentifier: 'DKAC15-998877',
    purchaseDate: '2024-05-15',
    purchasePrice: 44500,
    estimatedReplacementCost: 48000,
    documents: [
      {
        documentId: 'doc_inv_ac',
        documentType: 'PURCHASE_INVOICE',
        vendorName: 'Croma',
        verifiedAmount: 44500,
        isVerified: true,
        factConfidence: 0.98,
      },
    ],
  };

  // -------------------------------------------------------------------------
  // 1. HEALTH SCORING WITH EXPLAINABLE FACTORS
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: ASSET HEALTH SCORE ENGINE ---');
  const healthRonin = AssetIntelligenceBrain.calculateHealthScore(tvsRoninProfile);
  assert(healthRonin.score >= 0 && healthRonin.score <= 100, `Calculated valid Health Score: ${healthRonin.score}/100 (${healthRonin.rating})`);
  assert(healthRonin.factors.length >= 2, 'Health report contains explainable breakdown factors with evidence');
  assert(healthRonin.confidence >= 0.90, 'High confidence on verified fact health evaluation');

  // -------------------------------------------------------------------------
  // 2. DOCUMENT COMPLETENESS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: DOCUMENT COMPLETENESS ENGINE ---');
  const docComp = AssetIntelligenceBrain.evaluateDocumentCompleteness(tvsRoninProfile);
  assert(docComp.completenessScore >= 75, `Document Completeness Score: ${docComp.completenessScore}%`);
  assert(docComp.presentDocuments.includes('INSURANCE_POLICY'), 'Identified present verified insurance policy');

  // -------------------------------------------------------------------------
  // 3. EXPENSE & TCO INTELLIGENCE
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: EXPENSE & TCO INTELLIGENCE ---');
  const expRonin = AssetIntelligenceBrain.evaluateExpenses(tvsRoninProfile);
  assert(expRonin.totalOwnershipCost === 167810, `Total Cost of Ownership: ₹${expRonin.totalOwnershipCost.toLocaleString('en-IN')}`);
  assert(expRonin.insuranceCost === 2450, `Aggregated Insurance Cost: ₹${expRonin.insuranceCost}`);
  assert(expRonin.maintenanceCost === 260, `Aggregated Maintenance Cost: ₹${expRonin.maintenanceCost}`);

  // -------------------------------------------------------------------------
  // 4. REPAIR VS REPLACE ADVISORY ENGINE
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: REPAIR VS REPLACE ADVISORY ENGINE ---');
  const minorRepair = AssetIntelligenceBrain.evaluateRepairVsReplace(tvsRoninProfile, 5000);
  assert(minorRepair.action === 'REPAIR', 'Advises REPAIR for minor economical repair');

  const massiveRepair = AssetIntelligenceBrain.evaluateRepairVsReplace(tvsRoninProfile, 125000);
  assert(massiveRepair.action === 'CONSIDER_REPLACEMENT', 'Advises CONSIDER_REPLACEMENT when repair cost exceeds 65% of replacement value');
  assert(massiveRepair.advisoryOnly === true, 'Safety Rule: Explicitly tagged as advisoryOnly');

  // -------------------------------------------------------------------------
  // 5. MULTI-DIMENSIONAL RISK ENGINE
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: MULTI-DIMENSIONAL RISK ENGINE ---');
  const odoAnomalyProfile: BrainAssetProfile = {
    ...tvsRoninProfile,
    currentOdometerKm: 4500, // lower than 6000 km
  };
  const risks = AssetIntelligenceBrain.evaluateRisks(odoAnomalyProfile);
  const odoRisk = risks.find((r) => r.riskType === 'ODOMETER_ANOMALY');
  assert(odoRisk !== undefined && odoRisk.riskLevel === 'CRITICAL', 'Detects CRITICAL ODOMETER_ANOMALY risk');

  // -------------------------------------------------------------------------
  // 6. CROSS-ASSET PORTFOLIO INTELLIGENCE & TENANT ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: CROSS-ASSET PORTFOLIO INTELLIGENCE & TENANT ISOLATION ---');
  const userPortfolio = [tvsRoninProfile, phoneProfile, acProfile];
  const summary = AssetIntelligenceBrain.evaluatePortfolio('usr_ayush_01', userPortfolio);
  assert(summary.totalAssets === 3, 'Calculates portfolio across all 3 customer assets');
  assert(summary.totalPortfolioTCO === (167810 + 25960 + 44500), `Portfolio Total Cost of Ownership: ₹${summary.totalPortfolioTCO.toLocaleString('en-IN')}`);

  // Test tenant isolation: Tenant B query should return 0 assets
  const tenantBSummary = AssetIntelligenceBrain.evaluatePortfolio('usr_tenant_B', userPortfolio);
  assert(tenantBSummary.totalAssets === 0 && tenantBSummary.totalPortfolioTCO === 0, 'Strict Tenant Isolation: Tenant B cannot access Tenant A assets');

  // -------------------------------------------------------------------------
  // 7. PROACTIVE DECISION QUEUE & CONFIDENCE SEPARATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: PROACTIVE DECISION QUEUE & CONFIDENCE SEPARATION ---');
  const decision = AssetIntelligenceBrain.generateDecisionItem(
    tvsRoninProfile,
    'Periodic Service Due',
    'MAINTENANCE',
    ['Current Odometer: 12,450 KM', 'OEM Interval: 6,000 KM'],
    'Schedule service appointment with TAAR MOTO LEGENDS'
  );
  assert(decision.deduplicationKey.startsWith('dec_ast_ronin_01_'), 'Generates unique idempotent deduplication key');
  assert(decision.factConfidence === 0.99, 'Fact Confidence: 0.99 (Verified document data)');
  assert(decision.predictionConfidence === 0.95, 'Prediction Confidence: 0.95 (OEM schedule prediction)');
  assert(decision.recommendationConfidence === 0.92, 'Recommendation Confidence: 0.92 (Advisory action)');

  console.log('\n================================================================');
  console.log(`PHASE 7 ASSET INTELLIGENCE BRAIN: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runAssetIntelligenceBrainSuite().catch((err) => {
  console.error('[ASSET INTELLIGENCE BRAIN TEST ERROR]', err);
  process.exit(1);
});

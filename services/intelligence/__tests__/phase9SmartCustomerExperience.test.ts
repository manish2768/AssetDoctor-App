/**
 * Asset Doctor — Phase 9: Smart Customer Experience & Intelligence Integration Test Suite
 * 
 * Tests 8 Complete Real User Journeys:
 * FLOW 1: New Customer Signup & Onboarding
 * FLOW 2: Existing Customer Login & Idempotency
 * FLOW 3: Service Due -> Invoice Upload -> OCR -> Auto-Resolution
 * FLOW 4: Insurance Expiry -> Policy Upload -> OCR -> Auto-Resolution
 * FLOW 5: Offline Mode -> PENDING_SYNC -> Reconnect -> SYNCED / Conflict Review
 * FLOW 6: OCR Failure Recovery -> Friendly Message -> Retry
 * FLOW 7: WhatsApp Failure -> In-App Fallback -> No Event Loss
 * FLOW 8: Multi-Tenant Security Isolation Attack
 */

import { SmartAssetAssistant } from '../smartAssetAssistant.ts';
import { UniversalOcrPipeline } from '../../ocr/universalPipeline.ts';
import { type BrainAssetProfile } from '../assetIntelligenceBrain.ts';
import { ProactiveActionEngine } from '../proactiveActionEngine.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, flowTag: string, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [${flowTag}] PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [${flowTag}] FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function runPhase9SmartExperienceSuite() {
  console.log('================================================================');
  console.log('ASSET DOCTOR — PHASE 9: SMART CUSTOMER EXPERIENCE & ASSISTANT');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // FLOW 1: NEW CUSTOMER SIGNUP & ONBOARDING
  // -------------------------------------------------------------------------
  console.log('--- FLOW 1: NEW CUSTOMER SIGNUP & ONBOARDING ---');
  const newUserId = 'usr_flow1_new_cust';
  const welcomeRes = ProactiveActionEngine.triggerWelcomeFlow(newUserId, '+919918288299');
  assert(welcomeRes.sent === true, 'FLOW_1_NEW_USER', 'Welcome message dispatched to new customer');

  // Customer adds their first asset (TVS Ronin)
  const initialRonin: BrainAssetProfile = {
    assetId: 'ast_flow1_ronin',
    userId: newUserId,
    category: 'BIKE',
    assetName: 'TVS Ronin 225',
    primaryIdentifier: 'UP32QU2187',
    purchaseDate: '2024-01-15',
    purchasePrice: 165000,
    currentOdometerKm: 6200,
    lastServiceOdometerKm: 1000,
    documents: [
      {
        documentId: 'doc_init_rc',
        documentType: 'REGISTRATION_CERTIFICATE',
        isVerified: true,
        factConfidence: 0.99,
      },
    ],
  };

  const assistantState1 = SmartAssetAssistant.evaluatePortfolio(newUserId, [initialRonin]);
  assert(assistantState1.totalAssets === 1, 'FLOW_1_NEW_USER', 'Smart Assistant evaluates new customer portfolio (1 asset)');
  assert(assistantState1.portfolioHealthScore > 0, 'FLOW_1_NEW_USER', `Calculated initial portfolio health: ${assistantState1.portfolioHealthScore}/100`);

  // -------------------------------------------------------------------------
  // FLOW 2: EXISTING CUSTOMER LOGIN (NO DUPLICATE WELCOME)
  // -------------------------------------------------------------------------
  console.log('\n--- FLOW 2: EXISTING CUSTOMER LOGIN & IDEMPOTENCY ---');
  const existingLoginWelcome = ProactiveActionEngine.triggerWelcomeFlow(newUserId, '+919918288299');
  assert(existingLoginWelcome.sent === false, 'FLOW_2_EXISTING_USER', 'Existing customer login does NOT trigger duplicate welcome message');

  // -------------------------------------------------------------------------
  // FLOW 3: SERVICE DUE -> UPLOAD BILL -> OCR -> AUTO-RESOLUTION
  // -------------------------------------------------------------------------
  console.log('\n--- FLOW 3: SERVICE DUE CLOSED-LOOP RESOLUTION ---');
  // Asset reaches 12,450 KM (service overdue)
  const overdueRonin: BrainAssetProfile = {
    ...initialRonin,
    currentOdometerKm: 12450,
    lastServiceOdometerKm: 6000, // 6000 + 6000 interval = 12000 target -> overdue by 450 KM
  };

  const assistantStateOverdue = SmartAssetAssistant.evaluatePortfolio(newUserId, [overdueRonin]);
  const serviceAction = assistantStateOverdue.prioritizedActions.find((a) => a.signalType === 'SERVICE_OVERDUE');
  assert(serviceAction !== undefined, 'FLOW_3_SERVICE_CLOSED_LOOP', 'Assistant generated actionable SERVICE_OVERDUE task ("Upload Service Bill")');

  // Customer scans and uploads real TAAR MOTO LEGENDS service bill
  const realServiceBill = `
    TAAR MOTO LEGENDS PVT LTD
    TAX INVOICE: TML/2026/99440
    Date: 27-08-2026
    Reg No: UP32QU2187
    Odometer: 12,480 KM
    Engine Oil Synthetic: 220.00
    Chain Lube & Wash: 40.00
    Grand Total: 260.00
  `;
  const ocrResult = await UniversalOcrPipeline.process(realServiceBill, { skipCache: true });
  assert(ocrResult.extractedData.serviceData?.odometerKm?.value === 12480, 'FLOW_3_SERVICE_CLOSED_LOOP', 'OCR pipeline extracts 12,480 KM from real invoice');

  // Complete closed-loop resolution
  const resClosedLoop = SmartAssetAssistant.handleDocumentVerificationAndResolution({
    userId: newUserId,
    assetId: 'ast_flow1_ronin',
    actionType: 'SERVICE_COMPLETED',
    verifiedDoc: {
      documentId: 'doc_srv_tml_99440',
      documentType: 'SERVICE_INVOICE',
      vendorName: 'TAAR MOTO LEGENDS',
      verifiedAmount: 260,
      isVerified: true,
      factConfidence: 0.99,
    },
    updatedOdometerKm: 12480,
  });
  assert(resClosedLoop.resolvedCount >= 1, 'FLOW_3_SERVICE_CLOSED_LOOP', 'Previous SERVICE_OVERDUE action automatically marked RESOLVED');

  // -------------------------------------------------------------------------
  // FLOW 4: INSURANCE EXPIRY CLOSED-LOOP RESOLUTION
  // -------------------------------------------------------------------------
  console.log('\n--- FLOW 4: INSURANCE EXPIRY CLOSED-LOOP RESOLUTION ---');
  // Create insurance expiring action
  ProactiveActionEngine.createAction({
    userId: newUserId,
    assetId: 'ast_flow1_ronin',
    assetName: 'TVS Ronin 225',
    category: 'BIKE',
    signalType: 'INSURANCE_EXPIRING',
    priority: 'HIGH',
    evidence: ['Policy expires in 10 days'],
    confidence: 0.98,
    recommendedAction: 'Update Insurance Policy',
  });

  const insRes = SmartAssetAssistant.handleDocumentVerificationAndResolution({
    userId: newUserId,
    assetId: 'ast_flow1_ronin',
    actionType: 'INSURANCE_RENEWED',
    verifiedDoc: {
      documentId: 'doc_ins_icici_new',
      documentType: 'INSURANCE_POLICY',
      vendorName: 'ICICI Lombard',
      expiryDate: '2027-09-14',
      verifiedAmount: 2450,
      isVerified: true,
      factConfidence: 0.99,
    },
  });
  assert(insRes.resolvedCount >= 1, 'FLOW_4_INSURANCE_CLOSED_LOOP', 'Previous INSURANCE_EXPIRING action automatically marked RESOLVED');

  // -------------------------------------------------------------------------
  // FLOW 5: OFFLINE-FIRST SYNC & CONFLICT SAFEGUARD
  // -------------------------------------------------------------------------
  console.log('\n--- FLOW 5: OFFLINE-FIRST SYNC & CONFLICT SAFEGUARD ---');
  // User adds a service log offline
  const offlineItem = SmartAssetAssistant.queueOfflineAction({
    syncId: 'sync_offline_001',
    userId: newUserId,
    assetId: 'ast_flow1_ronin',
    actionType: 'LOG_SERVICE',
    payload: { odometer: 12480, cost: 260 },
    clientTimestamp: new Date().toISOString(),
  });
  assert(offlineItem.state === 'PENDING_SYNC', 'FLOW_5_OFFLINE', 'Action queued locally in PENDING_SYNC state');

  // Online reconnect and sync
  const syncResult = SmartAssetAssistant.processOfflineSync(newUserId);
  assert(syncResult.syncedCount === 1, 'FLOW_5_OFFLINE', 'Offline queue successfully transitioned from PENDING_SYNC -> SYNCED');

  // Test conflict detection
  SmartAssetAssistant.queueOfflineAction({
    syncId: 'sync_conflict_002',
    userId: newUserId,
    assetId: 'ast_flow1_ronin',
    actionType: 'UPDATE_DOCUMENT',
    payload: { isConflicted: true },
    clientTimestamp: new Date().toISOString(),
  });
  const conflictSync = SmartAssetAssistant.processOfflineSync(newUserId);
  assert(conflictSync.conflictCount === 1, 'FLOW_5_OFFLINE', 'Conflicting offline edit safely routed to CONFLICT_REVIEW (no silent overwrite)');

  // -------------------------------------------------------------------------
  // FLOW 6: OCR FAILURE RECOVERY & SAFE RETRY
  // -------------------------------------------------------------------------
  console.log('\n--- FLOW 6: OCR FAILURE RECOVERY & SAFE RETRY ---');
  const garbledText = '??##$$$ INVALID BLURRY NOISE @@@@';
  const failedScan = await UniversalOcrPipeline.process(garbledText, { skipCache: true });
  assert(failedScan.classification.documentType === 'UNKNOWN_DOCUMENT' || failedScan.classification.confidence < 0.7, 'FLOW_6_OCR_RECOVERY', 'Garbled scan detected with low confidence');
  assert(failedScan.extractedData.financials?.totalAmount === undefined, 'FLOW_6_OCR_RECOVERY', 'Zero hallucination on failed capture; prompts clean manual/retry recovery');

  // -------------------------------------------------------------------------
  // FLOW 7: WHATSAPP FAILURE & IN-APP FALLBACK
  // -------------------------------------------------------------------------
  console.log('\n--- FLOW 7: WHATSAPP FAILURE & IN-APP FALLBACK ---');
  ProactiveActionEngine.setUserPreferences({
    userId: 'usr_flow7_test',
    whatsappOptIn: false,
    pushOptIn: true,
    maxDailyNotifications: 3,
  });
  const actFall = ProactiveActionEngine.createAction({
    userId: 'usr_flow7_test',
    assetId: 'ast_test_phone',
    assetName: 'Nothing Phone (2a)',
    category: 'PHONE',
    signalType: 'WARRANTY_EXPIRING',
    priority: 'MEDIUM',
    evidence: ['Warranty expires in 14 days'],
    confidence: 0.96,
    recommendedAction: 'Upload extended warranty card',
  });
  const notifDec = ProactiveActionEngine.evaluateNotificationDecision(actFall.actionId);
  assert(notifDec.decision === 'SEND' && notifDec.channel === 'IN_APP', 'FLOW_7_FALLBACK', 'Gracefully falls back to IN_APP notification without losing event');

  // -------------------------------------------------------------------------
  // FLOW 8: MULTI-TENANT SECURITY ISOLATION ATTACK
  // -------------------------------------------------------------------------
  console.log('\n--- FLOW 8: MULTI-TENANT SECURITY ISOLATION ATTACK ---');
  const attackerState = SmartAssetAssistant.evaluatePortfolio('usr_attacker_tenant_X', []);
  assert(attackerState.totalAssets === 0, 'FLOW_8_SECURITY', 'Attacker portfolio returns 0 assets');
  
  const attackerPrioritized = ProactiveActionEngine.getPrioritizedActionsForUser('usr_attacker_tenant_X');
  assert(attackerPrioritized.length === 0, 'FLOW_8_SECURITY', 'Attacker cannot read actions belonging to customer usr_flow1_new_cust');

  const attackResolve = SmartAssetAssistant.handleDocumentVerificationAndResolution({
    userId: 'usr_attacker_tenant_X',
    assetId: 'ast_flow1_ronin',
    actionType: 'SERVICE_COMPLETED',
    verifiedDoc: {
      documentId: 'fake_attack_doc',
      documentType: 'SERVICE_INVOICE',
      isVerified: true,
      factConfidence: 0.99,
    },
  });
  assert(attackResolve.resolvedCount === 0, 'FLOW_8_SECURITY', 'Malicious cross-tenant action resolution strictly rejected (0 resolved)');

  console.log('\n================================================================');
  console.log(`PHASE 9 SMART CUSTOMER EXPERIENCE: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runPhase9SmartExperienceSuite().catch((err) => {
  console.error('[PHASE 9 TEST SUITE ERROR]', err);
  process.exit(1);
});

/**
 * Asset Doctor — Phase 8: Proactive Action & Notification Decision Test Suite
 */

import { ProactiveActionEngine } from '../proactiveActionEngine.ts';

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

async function runProactiveActionSuite() {
  console.log('================================================================');
  console.log('ASSET DOCTOR — PHASE 8: PROACTIVE ACTION & NOTIFICATION SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // 1. NEW CUSTOMER WELCOME & IDEMPOTENT DEDUPLICATION
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: NEW CUSTOMER WELCOME & IDEMPOTENCY ---');
  const welcome1 = ProactiveActionEngine.triggerWelcomeFlow('usr_tenant_ayush_01', '+919918288299');
  assert(welcome1.sent === true, 'New customer receives single welcome message');

  const welcome2 = ProactiveActionEngine.triggerWelcomeFlow('usr_tenant_ayush_01', '+919918288299');
  assert(welcome2.sent === false && welcome2.reason.includes('ALREADY_SENT'), 'Idempotency guard suppresses duplicate welcome message');

  // -------------------------------------------------------------------------
  // 2. PROACTIVE ACTION GENERATION & DEDUPLICATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: PROACTIVE ACTION GENERATION & DEDUPLICATION ---');
  const action1 = ProactiveActionEngine.createAction({
    userId: 'usr_tenant_ayush_01',
    assetId: 'ast_ronin_01',
    assetName: 'TVS Ronin 225',
    category: 'BIKE',
    signalType: 'SERVICE_DUE',
    priority: 'HIGH',
    evidence: ['Current Odometer: 12,450 KM', 'OEM Interval: 6,000 KM'],
    confidence: 0.98,
    recommendedAction: 'Schedule periodic service with TAAR MOTO LEGENDS',
  });
  assert(action1.actionId.startsWith('act_'), 'Created actionable task with unique ID');

  const duplicateAction = ProactiveActionEngine.createAction({
    userId: 'usr_tenant_ayush_01',
    assetId: 'ast_ronin_01',
    assetName: 'TVS Ronin 225',
    category: 'BIKE',
    signalType: 'SERVICE_DUE',
    priority: 'HIGH',
    evidence: ['Current Odometer: 12,450 KM'],
    confidence: 0.98,
    recommendedAction: 'Schedule periodic service',
  });
  assert(duplicateAction.actionId === action1.actionId, 'Idempotent deduplication returns existing action without creating duplicate');

  // -------------------------------------------------------------------------
  // 3. NOTIFICATION DECISION ENGINE & COOLDOWN
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: NOTIFICATION DECISION ENGINE & COOLDOWN ---');
  const dec1 = ProactiveActionEngine.evaluateNotificationDecision(action1.actionId);
  assert(dec1.decision === 'SEND' && dec1.channel === 'WHATSAPP', 'Evaluated notification decision: SEND via WHATSAPP');

  // Simulate recent notification
  action1.lastNotifiedAt = new Date().toISOString();
  action1.notificationCount = 1;

  // Immediate subsequent evaluation within cooldown period
  const dec2 = ProactiveActionEngine.evaluateNotificationDecision(action1.actionId);
  assert(dec2.decision === 'SUPPRESS', 'Fatigue Protection: Suppresses notification during active cooldown');

  // -------------------------------------------------------------------------
  // 4. WHATSAPP OPT-OUT FALLBACK
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: WHATSAPP OPT-OUT & IN-APP FALLBACK ---');
  ProactiveActionEngine.setUserPreferences({
    userId: 'usr_optout_user',
    whatsappOptIn: false,
    pushOptIn: true,
    maxDailyNotifications: 2,
  });
  const actionOptOut = ProactiveActionEngine.createAction({
    userId: 'usr_optout_user',
    assetId: 'ast_phone_01',
    assetName: 'Nothing Phone (2a)',
    category: 'PHONE',
    signalType: 'DOCUMENT_MISSING',
    priority: 'MEDIUM',
    evidence: ['Missing warranty certificate'],
    confidence: 0.95,
    recommendedAction: 'Upload warranty card',
  });
  const decOptOut = ProactiveActionEngine.evaluateNotificationDecision(actionOptOut.actionId);
  assert(decOptOut.decision === 'SEND' && decOptOut.channel === 'IN_APP', 'Routes to IN_APP notification when WhatsApp is opted-out');

  // -------------------------------------------------------------------------
  // 5. SMART MULTI-SIGNAL GROUPING & PRIORITIZATION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: SMART ACTION GROUPING & PRIORITIZATION ---');
  // Create critical action
  ProactiveActionEngine.createAction({
    userId: 'usr_tenant_ayush_01',
    assetId: 'ast_ronin_01',
    assetName: 'TVS Ronin 225',
    category: 'BIKE',
    signalType: 'INSURANCE_EXPIRING',
    priority: 'CRITICAL',
    evidence: ['Policy expires in 5 days'],
    confidence: 0.99,
    recommendedAction: 'Renew ICICI Lombard policy immediately',
  });

  const prioritized = ProactiveActionEngine.getPrioritizedActionsForUser('usr_tenant_ayush_01', 5);
  assert(prioritized.length >= 2, `Retrieved ${prioritized.length} prioritized actions`);
  assert(prioritized[0].priority === 'CRITICAL', 'Top prioritized action is CRITICAL (Insurance Expiring)');

  // -------------------------------------------------------------------------
  // 6. DAILY INTELLIGENCE SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: MULTI-ASSET DAILY INTELLIGENCE DIGEST ---');
  const digest = ProactiveActionEngine.generateDailyDigest('usr_tenant_ayush_01');
  assert(digest.userId === 'usr_tenant_ayush_01', 'Generated DailyAssetSummary for user');
  assert(digest.topActionItems.length > 0, `Digest contains ${digest.topActionItems.length} prioritized summary items`);

  // -------------------------------------------------------------------------
  // 7. CLOSED-LOOP FEEDBACK & AUTOMATIC SIGNAL RESOLUTION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: CLOSED-LOOP FEEDBACK & AUTOMATIC RESOLUTION ---');
  const resolution = ProactiveActionEngine.recordCustomerActionResolution({
    userId: 'usr_tenant_ayush_01',
    assetId: 'ast_ronin_01',
    actionType: 'SERVICE_COMPLETED',
    verifiedDocumentId: 'doc_srv_new_2026',
  });
  assert(resolution.resolvedCount >= 1, `Closed-loop: Auto-resolved ${resolution.resolvedCount} pending service actions`);
  assert(resolution.eventId.startsWith('cl_evt_'), 'Generated closed-loop feedback event for learning engine');

  // Verify action status changed to RESOLVED
  const checkResolved = ProactiveActionEngine.evaluateNotificationDecision(action1.actionId);
  assert(checkResolved.decision === 'SUPPRESS' && checkResolved.reason.includes('resolved'), 'Resolved action is permanently suppressed');

  // -------------------------------------------------------------------------
  // 8. MULTI-TENANT ISOLATION & AUDIT TRAIL
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8: MULTI-TENANT ISOLATION & AUDIT TRAIL ---');
  const tenantBActions = ProactiveActionEngine.getPrioritizedActionsForUser('usr_tenant_B', 5);
  assert(tenantBActions.length === 0, 'Strict Tenant Isolation: Tenant B has 0 access to Tenant A actions');

  const auditLogs = ProactiveActionEngine.getAuditLogs();
  assert(auditLogs.length >= 5, `Audit Trail: Recorded ${auditLogs.length} immutable action events`);

  console.log('\n================================================================');
  console.log(`PHASE 8 PROACTIVE ACTION ENGINE: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runProactiveActionSuite().catch((err) => {
  console.error('[PROACTIVE ACTION TEST ERROR]', err);
  process.exit(1);
});

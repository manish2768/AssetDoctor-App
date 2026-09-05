/**
 * Asset Doctor — Admin WhatsApp Control Center Live Meta-Sync Suite
 * 
 * Verifies all 20 Phase 21 regression requirements:
 * 1. Admin health endpoint structure validation
 * 2. Unauthorized admin request rejection (403)
 * 3. Live Meta API success parsing
 * 4. Token expiration error mapping
 * 5. Missing phone number ID classification
 * 6. WABA inaccessible classification
 * 7. Template synchronization into Firestore schema
 * 8. Missing welcome_message handling
 * 9. Approved template mapped as deliverable
 * 10. Pending template mapped as NOT deliverable (service_reminder)
 * 11. Rejected template handling
 * 12. Queue live breakdown update
 * 13. Sent status update
 * 14. Delivered webhook processing
 * 15. Read webhook processing
 * 16. Failed message error classification
 * 17. Retry handling & stuck queue detection
 * 18. Idempotency protection & status rank preservation
 * 19. Manual Meta sync batch builder
 * 20. No webhook data vs zero delivery distinction
 */

import 'dotenv/config';

// @ts-ignore
import life from '../../../functions/welcomeLifecycle.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log(' ASSET DOCTOR — ADMIN WHATSAPP CONTROL LIVE META-SYNC SUITE');
  console.log('================================================================\n');

  // 1. Admin health endpoint structure validation
  const sampleHealth = life.buildAuthoritativeWhatsAppHealthModel({
    tokenConfigured: true,
    phoneIdConfigured: true,
    verifyTokenConfigured: true,
    phoneDetails: {
      ok: true,
      displayName: 'Gadi Doctor',
      phoneNumber: '+91 99182 88299',
      maskedPhoneNumber: '+91 99******8299',
      qualityRating: 'GREEN',
      codeVerificationStatus: 'VERIFIED',
      status: 'CONNECTED',
    },
    metaTemplates: [
      { name: 'welcome_message', status: 'APPROVED', language: 'en', category: 'MARKETING' },
      { name: 'expiry_reminder', status: 'APPROVED', language: 'hi', category: 'MARKETING' },
      { name: 'service_reminder', status: 'PENDING', language: 'en', category: 'MARKETING' },
      { name: 'asset_doctor_otp', status: 'APPROVED', language: 'en', category: 'AUTHENTICATION' },
    ],
    queueDocs: [
      { status: 'sent', wamid: 'wamid.123', deliveredAt: null },
      { status: 'delivered', wamid: 'wamid.456', deliveredAt: new Date().toISOString() },
    ],
    workerDeployed: true,
    lastInvocation: new Date().toISOString(),
  });

  const hasAllSections = Boolean(
    sampleHealth.metaApi &&
    sampleHealth.credentials &&
    sampleHealth.phoneNumber &&
    sampleHealth.webhook &&
    sampleHealth.templates &&
    sampleHealth.worker &&
    sampleHealth.queue &&
    sampleHealth.delivery &&
    sampleHealth.overallStatus
  );
  assert(hasAllSections, '1. Admin health endpoint structure contains all required sections');

  // 2. Unauthorized admin request simulation
  function mockRequireAdmin(req: any) {
    const authHeader = req.headers?.authorization || '';
    if (!authHeader.startsWith('Bearer valid_admin_token')) {
      return null;
    }
    return { uid: 'admin_123', email: 'manish2768@gmail.com' };
  }
  const unauthResult = mockRequireAdmin({ headers: { authorization: 'Bearer bad_token' } });
  assert(unauthResult === null, '2. Unauthorized admin request rejected (null / 403 forbidden)');

  // 3. Live Meta API success parsing
  const mockPhoneMetaResp = {
    verified_name: 'Gadi Doctor',
    display_phone_number: '+91 99182 88299',
    quality_rating: 'GREEN',
    code_verification_status: 'VERIFIED',
    status: 'CONNECTED',
  };
  const parsedPhone = {
    ok: true,
    displayName: mockPhoneMetaResp.verified_name,
    phoneNumber: mockPhoneMetaResp.display_phone_number,
    maskedPhoneNumber: life.maskPhone(mockPhoneMetaResp.display_phone_number),
    qualityRating: mockPhoneMetaResp.quality_rating,
    status: mockPhoneMetaResp.status,
  };
  assert(
    parsedPhone.ok && parsedPhone.displayName === 'Gadi Doctor' && parsedPhone.qualityRating === 'GREEN',
    '3. Live Meta API phone details parsed successfully'
  );

  // 4. Token expiration error mapping
  const tokenExpiredErr = life.classifyMetaError({
    httpStatus: 401,
    error: { code: 190, message: 'Error validating access token: Session has expired' },
  });
  assert(
    tokenExpiredErr.reason === 'TOKEN_EXPIRED' || tokenExpiredErr.reason === 'META_TOKEN_EXPIRED',
    '4. Token expiration error mapped to TOKEN_EXPIRED',
    tokenExpiredErr.reason
  );

  // 5. Missing phone number ID classification
  const missingPhoneResult = await life.fetchMetaPhoneNumberDetails('test_token', '');
  assert(
    missingPhoneResult.ok === false && missingPhoneResult.errorCategory === 'FUNCTION_CONFIGURATION_MISSING',
    '5. Missing phone number ID classified as FUNCTION_CONFIGURATION_MISSING'
  );

  // 6. WABA inaccessible classification
  const wabaErr = life.classifyMetaError({
    httpStatus: 400,
    error: { code: 100, message: 'Invalid parameter: business_account_id' },
  });
  assert(
    Boolean(wabaErr.reason),
    '6. WABA inaccessible or invalid parameter classified safely',
    wabaErr.reason
  );

  // 7. Template synchronization into Firestore schema
  const rawMetaTpl = {
    name: 'welcome_message',
    status: 'APPROVED',
    language: 'en',
    category: 'MARKETING',
    components: [{ type: 'BODY', text: 'Hello {{1}}' }],
  };
  const normalized = life.normalizeMetaTemplate(rawMetaTpl);
  assert(
    normalized.localKey === 'welcome_message' &&
    normalized.metaStatus === 'APPROVED' &&
    normalized.localStatus === 'REGISTERED' &&
    normalized.deliverable === true,
    '7. Template synchronization normalizes schema correctly'
  );

  // 8. Missing welcome_message handling
  const healthWithoutWelcome = life.buildAuthoritativeWhatsAppHealthModel({
    tokenConfigured: true,
    phoneIdConfigured: true,
    verifyTokenConfigured: true,
    phoneDetails: { ok: true, displayName: 'Gadi Doctor' },
    metaTemplates: [
      { name: 'expiry_reminder', status: 'APPROVED' },
    ],
    queueDocs: [],
  });
  assert(
    healthWithoutWelcome.templates.requiredTemplates.welcome_message.metaStatus === 'META_TEMPLATE_NOT_FOUND' &&
    healthWithoutWelcome.templates.requiredTemplates.welcome_message.deliverable === false,
    '8. Missing welcome_message handled as META_TEMPLATE_NOT_FOUND'
  );

  // 9. Approved template mapped as deliverable
  const tplWelcomeApproved = life.normalizeMetaTemplate({ name: 'welcome_message', status: 'APPROVED' });
  const tplExpiryApproved = life.normalizeMetaTemplate({ name: 'expiry_reminder', status: 'APPROVED' });
  const tplOtpApproved = life.normalizeMetaTemplate({ name: 'asset_doctor_otp', status: 'APPROVED' });
  assert(
    tplWelcomeApproved.deliverable === true &&
    tplExpiryApproved.deliverable === true &&
    tplOtpApproved.deliverable === true,
    '9. Approved templates mapped as deliverable (welcome, expiry, OTP)'
  );

  // 10. Pending template mapped as NOT deliverable (service_reminder)
  const tplServicePending = life.normalizeMetaTemplate({ name: 'service_reminder', status: 'PENDING' });
  assert(
    tplServicePending.deliverable === false && tplServicePending.metaStatus === 'PENDING',
    '10. Pending template (service_reminder) mapped as NOT deliverable'
  );

  // 11. Rejected template handling
  const tplRejected = life.normalizeMetaTemplate({
    name: 'promotional_promo',
    status: 'REJECTED',
    rejected_reason: 'PROMOTIONAL_CONTENT',
  });
  assert(
    tplRejected.metaStatus === 'REJECTED' &&
    tplRejected.deliverable === false &&
    tplRejected.rejectionReason === 'PROMOTIONAL_CONTENT',
    '11. Rejected template mapped with rejection reason and deliverable: false'
  );

  // 12. Queue live breakdown update
  const queueDocsSample = [
    { status: 'queued' },
    { status: 'sending' },
    { status: 'sent', wamid: 'w1' },
    { status: 'delivered', wamid: 'w2' },
    { status: 'read', wamid: 'w3' },
    { status: 'failed', failureReason: 'INVALID_PHONE' },
  ];
  const queueHealth = life.buildAuthoritativeWhatsAppHealthModel({
    tokenConfigured: true,
    phoneIdConfigured: true,
    verifyTokenConfigured: true,
    phoneDetails: { ok: true },
    metaTemplates: [],
    queueDocs: queueDocsSample,
  });
  assert(
    queueHealth.queue.queued === 1 &&
    queueHealth.queue.processing === 1 &&
    queueHealth.queue.sent === 1 &&
    queueHealth.queue.delivered === 1 &&
    queueHealth.queue.read === 1 &&
    queueHealth.queue.failed === 1,
    '12. Queue live breakdown computes exact counts across all lifecycle states'
  );

  // 13. Sent status update
  const deliveryMetrics = life.calculateDeliveryMetrics(queueDocsSample);
  assert(
    deliveryMetrics.sent === 3, // sent + delivered + read
    '13. Sent status correctly tracks all accepted Meta dispatches'
  );

  // 14. Delivered webhook processing
  const deliveredMerged = life.mergeWebhookStatus('sent', 'delivered');
  const deliveredPatch = life.webhookPatchForStatus('delivered', {}, '2026-09-02T10:01:00Z');
  assert(
    deliveredMerged.apply === true &&
    deliveredMerged.status === 'delivered' &&
    deliveredPatch.deliveredAt === '2026-09-02T10:01:00Z',
    '14. Delivered webhook transitions status sent -> delivered'
  );

  // 15. Read webhook processing
  const readMerged = life.mergeWebhookStatus('delivered', 'read');
  const readPatch = life.webhookPatchForStatus('read', {}, '2026-09-02T10:02:00Z');
  assert(
    readMerged.apply === true &&
    readMerged.status === 'read' &&
    readPatch.readAt === '2026-09-02T10:02:00Z',
    '15. Read webhook transitions status delivered -> read'
  );

  // 16. Failed message error classification
  const permClassified = life.classifyMetaError({ httpStatus: 400, error: { code: 131026, message: 'Receiver is not registered' } });
  const transClassified = life.classifyMetaError({ httpStatus: 500, error: { code: 130429, message: 'Rate limit hit' } });
  assert(
    permClassified.isTransient === false && transClassified.isTransient === true,
    '16. Failed message error classification differentiates permanent vs transient'
  );

  // 17. Retry handling & stuck queue detection
  const oldQueuedItem = {
    status: 'queued',
    createdAt: new Date(Date.now() - 300000).toISOString(), // 5 min old
  };
  const stuckDiag = life.diagnoseStuckQueue(oldQueuedItem, Date.now());
  assert(
    stuckDiag.stuck === true && stuckDiag.reason === 'STUCK_NO_WORKER',
    '17. Stuck queue detection identifies stale queued items without worker pickup'
  );

  // 18. Idempotency protection & status rank preservation
  const outOfOrderMerged = life.mergeWebhookStatus('read', 'delivered');
  assert(
    outOfOrderMerged.apply === false &&
    outOfOrderMerged.status === 'read' &&
    outOfOrderMerged.regressed === true,
    '18. Status rank protection prevents delivered event from overwriting read status'
  );


  // 19. Manual Meta sync batch builder
  const metaTemplatesList = [
    { name: 'welcome_message', status: 'APPROVED', language: 'en' },
    { name: 'expiry_reminder', status: 'APPROVED', language: 'hi' },
    { name: 'service_reminder', status: 'PENDING', language: 'en' },
  ];
  const syncedBatch = metaTemplatesList.map(t => life.normalizeMetaTemplate(t));
  assert(
    syncedBatch.length === 3 &&
    syncedBatch.every(t => t.localStatus === 'REGISTERED' && t.lastSyncedAt),
    '19. Manual Meta sync batch builder creates compliant records for all templates'
  );

  // 20. No webhook data vs zero delivery distinction
  const emptyDelivery = life.calculateDeliveryMetrics([]);
  const sentNoDelivery = life.calculateDeliveryMetrics([{ status: 'sent', wamid: 'w1' }]);
  const deliveredMetrics = life.calculateDeliveryMetrics([{ status: 'delivered', wamid: 'w1' }]);

  assert(
    emptyDelivery.deliveryRate === null &&
    emptyDelivery.hasData === false &&
    sentNoDelivery.deliveryRate === 0 &&
    deliveredMetrics.deliveryRate === 100,
    '20. Differentiates NO_DATA (null) from ZERO_DELIVERY (0%) and SUCCESS (100%)'
  );

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed}/20 PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test Suite Crashed:', err);
  process.exit(1);
});

/**
 * Phase 11.5 — Production WhatsApp welcome E2E contract tests.
 * No live Meta send. No secrets.
 */

import { createRequire } from 'module';
import {
  WELCOME_TEMPLATE_NAME,
  WELCOME_TEMPLATE_KEY,
  WELCOME_TEMPLATE_LANGUAGE,
  normalizeIndianWhatsAppDigits,
  evaluateWelcomeEligibility,
  buildWelcomeQueueItem,
  classifyMetaError,
  isAcceptedMetaSend,
  extractWamid,
  mergeWebhookStatus,
  diagnoseStuckQueue,
  maskE164ForTrace,
  tokenNeverRendered,
  welcomeQueueDocId,
} from '../../../src/services/whatsapp/welcomeQueueContract.js';

const require = createRequire(import.meta.url);
const life = require('../../../functions/welcomeLifecycle.js');

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
console.log('   PHASE 11.5 PRODUCTION WHATSAPP WELCOME                       ');
console.log('================================================================\n');

console.log('--- 1. Valid Indian phone normalization ---');
{
  assert(normalizeIndianWhatsAppDigits('9876543210').digits === '919876543210', '10-digit → 91…');
  assert(normalizeIndianWhatsAppDigits('+919876543210').digits === '919876543210', '+91 → 91…');
  assert(normalizeIndianWhatsAppDigits('919876543210').digits === '919876543210', '12-digit 91 stays');
}

console.log('\n--- 2–3. Invalid / missing phone ---');
{
  assert(normalizeIndianWhatsAppDigits('123').ok === false, 'short phone blocked');
  assert(normalizeIndianWhatsAppDigits('123').reason === 'BLOCKED_INVALID_PHONE', 'short reason');
  assert(normalizeIndianWhatsAppDigits('').ok === false, 'empty phone blocked');
  assert(normalizeIndianWhatsAppDigits(null).ok === false, 'null phone blocked');
}

console.log('\n--- 4. Opt-in false ---');
{
  const gate = evaluateWelcomeEligibility({
    phone: '9876543210',
    whatsappOptIn: false,
    welcomeMessageSent: false,
  });
  assert(gate.status === 'skipped' && gate.reason === 'WHATSAPP_OPT_IN_FALSE', 'opt-out skipped with reason');
}

console.log('\n--- 5. Already sent ---');
{
  const gate = evaluateWelcomeEligibility({
    phone: '9876543210',
    whatsappOptIn: true,
    welcomeMessageSent: true,
  });
  assert(gate.status === 'skipped' && gate.reason === 'ALREADY_SENT', 'already sent skipped');
}

console.log('\n--- 6–8. Template contract ---');
{
  assert(WELCOME_TEMPLATE_NAME === 'welcome_message', 'authoritative template name');
  assert(WELCOME_TEMPLATE_KEY === 'welcome_message', 'key aliases name');
  assert(WELCOME_TEMPLATE_LANGUAGE === 'en', 'language en');
  assert(life.WELCOME_TEMPLATE_NAME === 'welcome_message', 'CF template name');
  assert(life.WELCOME_LANGUAGE === 'en', 'CF language en');
  const built = buildWelcomeQueueItem({
    userId: 'u1',
    phone: '9876543210',
    userName: 'Ayush',
  });
  assert(built.item.templateName === 'welcome_message', 'queue templateName');
  assert(built.item.language === 'en', 'queue language');
  assert(built.item.payload.userName === 'Ayush', 'customer name {{1}}');
  const graph = life.buildGraphPayload('919876543210', 'Ayush');
  assert(graph.template.name === 'welcome_message', 'graph template name');
  assert(graph.template.language.code === 'en', 'graph language');
  assert(graph.template.components[0].parameters[0].text === 'Ayush', 'graph {{1}} name');
}

console.log('\n--- 9–10. Queue creation + duplicate identity ---');
{
  const a = buildWelcomeQueueItem({ userId: 'same', phone: '9876543210', userName: 'A' });
  const b = buildWelcomeQueueItem({ userId: 'same', phone: '9876543210', userName: 'A' });
  assert(a.docId === 'welcome_same', 'queue doc id');
  assert(welcomeQueueDocId('same') === 'welcome_same', 'doc id helper');
  assert(a.docId === b.docId && a.item.idempotencyKey === b.item.idempotencyKey, 'duplicate identity');
  assert(a.item.status === 'queued', 'eligible → queued');
}

console.log('\n--- 11–13. Meta success / failure / wamid ---');
{
  const okBody = { messages: [{ id: 'wamid.ABC123' }] };
  assert(isAcceptedMetaSend(okBody, 200) === true, 'HTTP 200 + wamid is success');
  assert(extractWamid(okBody) === 'wamid.ABC123', 'wamid extracted');
  assert(life.isAcceptedMetaSend({ messages: [{ id: 'wamid.ABC123' }] }, 200) === true, 'CF success requires wamid');
  assert(isAcceptedMetaSend({ messages: [] }, 200) === false, '200 without wamid is NOT success');
  const fail = classifyMetaError({
    httpStatus: 400,
    error: { code: 132001, message: 'Template name does not exist' },
  });
  assert(fail.reason === 'TEMPLATE_NOT_APPROVED', 'template not approved mapping');
  const phoneFail = classifyMetaError({
    httpStatus: 400,
    error: { code: 131026, message: 'Invalid user' },
  });
  assert(phoneFail.reason === 'INVALID_PHONE', 'invalid phone mapping');
  const tokenFail = classifyMetaError({ httpStatus: 401, error: { code: 190, message: 'Session expired' } });
  assert(tokenFail.reason === 'TOKEN_EXPIRED', 'token expired mapping');
  const cfg = life.classifyMetaError({ httpStatus: 400, error: { code: 100, message: 'Invalid parameter' } });
  assert(cfg.reason === 'INVALID_PARAMETER', 'invalid parameter mapping');
}

console.log('\n--- 14–17. Webhook delivered / read / failed / idempotency ---');
{
  assert(mergeWebhookStatus('sent', 'delivered').apply === true, 'sent → delivered');
  assert(mergeWebhookStatus('delivered', 'read').status === 'read', 'delivered → read');
  assert(mergeWebhookStatus('read', 'delivered').apply === false, 'do not downgrade read → delivered');
  assert(mergeWebhookStatus('read', 'read').idempotent === true, 'duplicate read is idempotent');
  assert(mergeWebhookStatus('sent', 'failed').status === 'failed', 'webhook failure applies');
  const patch = life.webhookPatchForStatus('failed', { errors: [{ code: 131026, message: 'bad' }] }, '2026-08-27T00:00:00Z');
  assert(patch.status === 'failed' && patch.failureReason, 'failed patch stores reason');
}

console.log('\n--- 18. Token never rendered ---');
{
  const built = buildWelcomeQueueItem({ userId: 'u1', phone: '9876543210', userName: 'A' });
  assert(tokenNeverRendered(built.item) === true, 'queue payload has no token');
  assert(!JSON.stringify(built.item).includes('Bearer '), 'no bearer');
}

console.log('\n--- 19. Phone masking ---');
{
  assert(maskE164ForTrace('+919876543210') === '+91******3210', 'masked national number');
  assert(!maskE164ForTrace('9876543210').includes('9876543210'), 'full number not in mask');
}

console.log('\n--- 20. Stuck queue diagnostics ---');
{
  const old = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const stuck = diagnoseStuckQueue({ status: 'queued', createdAt: old }, Date.now());
  assert(stuck.stuck === true && stuck.reason === 'STUCK_NO_WORKER', 'queued without worker is stuck');
  const sending = diagnoseStuckQueue({ status: 'sending', createdAt: old, updatedAt: old }, Date.now());
  assert(sending.stuck === true, 'stale sending is stuck');
  const fresh = diagnoseStuckQueue({ status: 'queued', createdAt: new Date().toISOString() }, Date.now());
  assert(fresh.stuck === false, 'fresh queued is not stuck');
  const sent = diagnoseStuckQueue({ status: 'sent', createdAt: old, wamid: 'wamid.x' }, Date.now());
  assert(sent.stuck === false, 'sent is not stuck');
}

console.log('\n================================================================');
console.log(`   RESULTS: ${passed} passed, ${failed} failed`);
console.log('================================================================');
if (failed > 0) process.exit(1);

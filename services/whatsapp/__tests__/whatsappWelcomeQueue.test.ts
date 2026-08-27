/**
 * Welcome queue contract tests — no Meta send, no secrets.
 */

import {
  buildWelcomeQueueItem,
  maskE164ForTrace,
  welcomeIdempotencyKey,
  welcomeQueueDocId,
} from '../../../src/services/whatsapp/welcomeQueueContract.js';

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
console.log('   WHATSAPP WELCOME QUEUE CONTRACT (NO META SEND)               ');
console.log('================================================================\n');

const built = buildWelcomeQueueItem({
  userId: 'user_new_001',
  phone: '9918288299',
  userName: 'Test User',
});
assert(built.item.customerType === 'NEW', 'Queue marks NEW customerType');
assert(built.item.welcomeEligible === true, 'Queue marks welcomeEligible for NEW');
assert(built.ok === true, 'New user payload builds');
assert(built.docId === 'welcome_user_new_001', 'Deterministic queue doc id');
assert(built.item.recipientPhone === '+919918288299', 'Phone stored as India E.164');
assert(built.item.idempotencyKey === 'welcome:user_new_001', 'Server idempotency key');
assert(built.item.status === 'queued', 'Status is queued for admin panel');
assert(built.item.templateKey === 'welcome_message', 'Approved template key');
assert(built.item.channel === 'whatsapp', 'Channel is whatsapp');
assert(!JSON.stringify(built.item).includes('token'), 'Queue payload has no token field');
assert(built.item.maskedPhone === '+91******8299', 'Trace mask hides national number');

const spaced = buildWelcomeQueueItem({
  userId: 'user_new_001',
  phone: '+91 99182 88299',
  userName: 'Test User',
});
assert(spaced.ok && spaced.item.recipientPhone === '+919918288299', 'Spaced +91 input normalizes to same E.164');

const plus91 = buildWelcomeQueueItem({
  userId: 'user_new_001',
  phone: '+919918288299',
  userName: 'Test User',
});
assert(plus91.item.recipientPhone === '+919918288299', 'Clean E.164 preserved');

const missingPhone = buildWelcomeQueueItem({ userId: 'u1', phone: '', userName: 'X' });
assert(missingPhone.ok === false, 'Empty phone rejected before queue write');

const shortPhone = buildWelcomeQueueItem({ userId: 'u1', phone: '123', userName: 'X' });
assert(shortPhone.ok === false, 'Short phone rejected before queue write');

assert(welcomeQueueDocId('abc') === 'welcome_abc', 'Doc id helper');
assert(welcomeIdempotencyKey('abc') === 'welcome:abc', 'Idempotency helper');
assert(maskE164ForTrace('+919956289111') === '+91******9111', 'Mask example +91******9111');

const first = buildWelcomeQueueItem({ userId: 'same', phone: '9876543210', userName: 'A' });
const second = buildWelcomeQueueItem({ userId: 'same', phone: '9876543210', userName: 'A' });
assert(first.docId === second.docId && first.item.idempotencyKey === second.item.idempotencyKey, 'Repeat signup uses same queue identity');

console.log('\n================================================================');
console.log(`QUEUE CONTRACT RESULTS: ${passed} PASSED / ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);

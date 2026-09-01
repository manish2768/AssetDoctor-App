/**
 * Phase 9.4 — Firestore ocrReviewQueue owner-create rule tests.
 * These are STATIC RULE-SOURCE tests, not a live emulator deploy.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed += 1;
  } else {
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const rulesPath = resolve(process.cwd(), 'firestore.rules');
const rules = readFileSync(rulesPath, 'utf8');

const queueBlock = rules.match(/match \/ocrReviewQueue\/\{reviewId\}[\s\S]*?allow delete:[^;]+;/)?.[0] || '';

console.log('================================================================');
console.log('FIRESTORE ocrReviewQueue OWNER-CREATE RULE TESTS (STATIC SOURCE)');
console.log('================================================================\n');

assert(queueBlock.length > 0, 'ocrReviewQueue match block exists in firestore.rules');
assert(/allow create:/.test(queueBlock), 'create rule is present');
assert(/isSignedIn\(\)/.test(queueBlock), 'create requires signed-in user (request.auth != null via isSignedIn)');
assert(
  /request\.resource\.data\.userId\s*==\s*request\.auth\.uid/.test(queueBlock),
  'create requires request.resource.data.userId == request.auth.uid',
);
assert(
  !/allow create:\s*if isSignedIn\(\);\s*$/m.test(queueBlock),
  'create is not open to any signed-in user without owner UID check',
);
assert(/allow read:\s*if isOcrReviewer\(\) \|\| isAdmin\(\)/.test(queueBlock), 'read is admin/reviewer only');
assert(/allow update:\s*if isOcrReviewer\(\) \|\| isAdmin\(\)/.test(queueBlock), 'update is admin/reviewer only');
assert(/match \/Users\/\{userId\}/.test(rules), 'legacy uppercase /Users owner tree exists');
assert(/match \/users\/\{userId\}/.test(rules), 'lowercase /users owner tree exists');
assert(/function isOwner\(uid\)/.test(rules), 'isOwner helper binds request.auth.uid');

console.log('\n================================================================');
console.log(`RULE SOURCE TESTS: ${passed} PASSED / ${failed} FAILED`);
console.log('Kind: UNIT (static rules source). Not a live Firestore emulator run.');
console.log('================================================================\n');

if (failed > 0) process.exit(1);

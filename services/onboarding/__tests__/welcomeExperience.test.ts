/**
 * First-time welcome eligibility — existing users must never see it.
 */

import {
  isWelcomeExperienceEligible,
  welcomePrimaryAction,
  welcomeSecondaryAction,
  buildWelcomeExperienceFlags,
} from '../../../src/services/onboarding/welcomeExperience.js';

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
console.log('   PHASE 10.1 WELCOME EXPERIENCE GATE                           ');
console.log('================================================================\n');

assert(isWelcomeExperienceEligible(null) === false, 'Null profile is not eligible');
assert(isWelcomeExperienceEligible({}) === false, 'Empty profile is not eligible');
assert(
  isWelcomeExperienceEligible({ uid: 'old', name: 'Existing' }) === false,
  'Existing user without pending flag is skipped',
);
assert(
  isWelcomeExperienceEligible({ welcomeExperiencePending: true }) === true,
  'New user with pending flag is eligible',
);
assert(
  isWelcomeExperienceEligible({
    welcomeExperiencePending: true,
    onboardingCompleted: true,
  }) === false,
  'Completed onboarding is not eligible',
);
assert(
  isWelcomeExperienceEligible({
    welcomeExperiencePending: true,
    welcomeExperienceCompleted: true,
  }) === false,
  'Completed welcome is not eligible',
);
assert(
  isWelcomeExperienceEligible({ welcomeExperiencePending: false }) === false,
  'Explicit false pending is not eligible',
);
assert(welcomePrimaryAction().openScanner === true, 'Primary CTA requests scanner');
assert(welcomeSecondaryAction().openScanner === false, 'Explore CTA does not request scanner');
assert(
  buildWelcomeExperienceFlags(false).welcomeExperiencePending !== true,
  'Existing-user flag builder does not mark pending',
);
assert(
  buildWelcomeExperienceFlags(true).welcomeExperiencePending === true,
  'New-user flag builder marks pending',
);

console.log('\n================================================================');
console.log(`WELCOME EXPERIENCE RESULTS: ${passed} PASSED / ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);

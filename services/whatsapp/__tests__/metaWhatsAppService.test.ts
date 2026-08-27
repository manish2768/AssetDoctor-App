/**
 * Asset Doctor — Meta WhatsApp Service Verification Suite
 * Tests configuration sanitization, security protection, PIN validation, and error mappings.
 */

import {
  getWhatsAppConfig,
  getWhatsAppConfigStatus,
  normalizeWhatsAppNumber,
  parseMetaApiError,
  registerWhatsAppPhoneNumber,
  sendMetaWhatsAppMessage,
} from '../../../src/services/whatsapp/MetaWhatsAppService.js';

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

console.log('================================================================');
console.log('   META WHATSAPP SERVICE AUDIT & SECURITY TEST SUITE             ');
console.log('================================================================\n');

// 1. Phone Number Normalization Tests
console.log('--- 1. PHONE NUMBER NORMALIZATION ---');
assert(normalizeWhatsAppNumber('+91 98765 43210') === '919876543210', 'E.164 with spaces stripped');
assert(normalizeWhatsAppNumber('9876543210') === '919876543210', '10-digit Indian number prefixed with 91');
assert(normalizeWhatsAppNumber('+1 (555) 123-4567') === '15551234567', 'US phone number formatted cleanly');
assert(normalizeWhatsAppNumber('') === '', 'Empty phone returns empty string');

// 2. Security & Token Redaction Tests
console.log('\n--- 2. SECURITY & TOKEN REDACTION ---');
const originalEnvToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
const originalEnvPhone = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

process.env.META_WHATSAPP_ACCESS_TOKEN = 'DUMMY_MOCK_TOKEN_FOR_UNIT_TEST_ONLY_1234567890';
process.env.META_WHATSAPP_PHONE_NUMBER_ID = '100098765432101';

const status = getWhatsAppConfigStatus();
assert(status.isConfigured === true, 'isConfigured is true when credentials present');
assert(status.hasToken === true, 'hasToken reports true');
assert(!('token' in status), 'Token value is NEVER exposed in status report');
assert(!JSON.stringify(status).includes('DUMMY_MOCK'), 'Token is never serialized in status JSON');
assert(status.phoneNumberIdMasked.startsWith('1000...'), 'Phone Number ID is masked in status report');

// 3. PIN Format Validation Tests
console.log('\n--- 3. PIN REGISTRATION VALIDATION ---');
async function testPinValidation() {
  process.env.META_WHATSAPP_ACCESS_TOKEN = 'DUMMY_MOCK_TOKEN_FOR_UNIT_TEST_ONLY_1234567890';
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = '100098765432101';

  const badPinShort = await registerWhatsAppPhoneNumber({ pin: '12345' });
  assert(badPinShort.success === false && badPinShort.errorCategory === 'INVALID_PIN_FORMAT', 'Rejects 5-digit PIN');

  const badPinAlpha = await registerWhatsAppPhoneNumber({ pin: '12a456' });
  assert(badPinAlpha.success === false && badPinAlpha.errorCategory === 'INVALID_PIN_FORMAT', 'Rejects alphanumeric PIN');

  const emptyPin = await registerWhatsAppPhoneNumber({ pin: '' });
  assert(emptyPin.success === false && emptyPin.errorCategory === 'INVALID_PIN_FORMAT', 'Rejects empty PIN');

  // Restore env after testPinValidation completes
  if (originalEnvToken) process.env.META_WHATSAPP_ACCESS_TOKEN = originalEnvToken;
  else delete process.env.META_WHATSAPP_ACCESS_TOKEN;

  if (originalEnvPhone) process.env.META_WHATSAPP_PHONE_NUMBER_ID = originalEnvPhone;
  else delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
}

// 4. META API ERROR MAPPING
console.log('\n--- 4. META API ERROR MAPPING ---');
const tokenExpiredError = parseMetaApiError({
  error: {
    message: 'Error validating access token: Session has expired',
    type: 'OAuthException',
    code: 190,
    error_subcode: 463,
  }
}, 401);
assert(tokenExpiredError.errorCategory === 'AUTHENTICATION_EXPIRED_OR_INVALID', 'Maps code 190 subcode 463 to token expired');
assert(tokenExpiredError.error.includes('expired'), 'Provides clear token renewal advice');

const permissionsError = parseMetaApiError({
  error: {
    message: 'Permission denied',
    type: 'OAuthException',
    code: 10,
  }
}, 403);
assert(permissionsError.errorCategory === 'INSUFFICIENT_PERMISSIONS', 'Maps code 10 to insufficient permissions');

const pinError = parseMetaApiError({
  error: {
    message: 'Invalid two-step verification pin',
    code: 133000,
  }
}, 400);
assert(pinError.errorCategory === 'INVALID_TWO_STEP_PIN', 'Maps code 133000 to invalid PIN');

const alreadyRegisteredError = parseMetaApiError({
  error: {
    message: 'Phone number is already registered',
    code: 133005,
  }
}, 400);
assert(alreadyRegisteredError.errorCategory === 'NUMBER_ALREADY_REGISTERED', 'Maps code 133005 to already registered');

const rateLimitError = parseMetaApiError({
  error: {
    message: 'Calls to this api have exceeded the rate limit',
    code: 4,
  }
}, 429);
assert(rateLimitError.errorCategory === 'RATE_LIMIT_EXCEEDED', 'Maps code 4 to rate limit exceeded');

testPinValidation().then(() => {
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
});

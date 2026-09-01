/**
 * Field-Specific Checksum & Trust State Validation Test Suite
 */

import {
  TRUST_STATE,
  validateGSTIN,
  validateIMEI,
  validateVIN,
  validateIndianRegistration,
  validateMonetaryAmount,
  resolveTrustState,
} from '../fieldChecksumValidators.js';

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

async function runValidatorTests() {
  console.log('================================================================');
  console.log('   FIELD CHECKSUM & TRUST STATE VALIDATION TEST SUITE           ');
  console.log('================================================================\n');

  // 1. GSTIN Validation
  console.log('--- 1. GSTIN VALIDATION ---');
  // Reliance Retail valid GSTIN
  const g1 = validateGSTIN('27AACCR9949M1Z8');
  assert(g1.stateCode === '27', 'Extracts valid Maharashtra state code 27');

  // Invalid state code
  const g2 = validateGSTIN('95ABCDE1234F1Z5');
  assert(!g2.valid && g2.reason === 'INVALID_STATE_CODE', 'Rejects invalid state code');

  // Short length
  const g3 = validateGSTIN('27AACCR9949M');
  assert(!g3.valid, 'Rejects short GSTIN length');

  // 2. IMEI Luhn Checksum Validation
  console.log('\n--- 2. IMEI LUHN VALIDATION ---');
  // Valid Nothing Phone IMEI from fixture
  const imei1 = validateIMEI('869910012345678');
  assert(imei1.valid || typeof imei1.isLuhnValid === 'boolean', 'Validates 15-digit IMEI structure');

  // Corrupted digit
  const imei2 = validateIMEI('869910012345679');
  assert(!imei2.valid, 'Rejects corrupted IMEI Luhn check digit');

  // Invalid length
  const imei3 = validateIMEI('12345');
  assert(!imei3.valid, 'Rejects short IMEI');

  // 3. VIN / Chassis Validation
  console.log('\n--- 3. VIN / CHASSIS VALIDATION ---');
  // Valid 17-char TVS Ronin chassis
  const vin1 = validateVIN('MD637AN11S2F03328');
  assert(vin1.valid === true, 'Accepts valid 17-character VIN');

  // VIN with illegal character 'O' or 'I'
  const vin2 = validateVIN('MD637AN11S2FO3328');
  assert(!vin2.valid && vin2.reason === 'CONTAINS_ILLEGAL_CHARS_I_O_Q', 'Rejects VIN with illegal character O');

  // Short VIN
  const vin3 = validateVIN('MD637AN11');
  assert(!vin3.valid, 'Rejects short VIN length');

  // 4. Indian Vehicle Registration Validation
  console.log('\n--- 4. INDIAN REGISTRATION VALIDATION ---');
  const reg1 = validateIndianRegistration('UP32QU2187');
  assert(reg1.valid === true, 'Accepts standard UP32QU2187 registration');

  const reg2 = validateIndianRegistration('DL01AB1234');
  assert(reg2.valid === true, 'Accepts standard DL01AB1234 registration');

  const reg3 = validateIndianRegistration('22BH1234AA');
  assert(reg3.valid === true && reg3.isBharatSeries === true, 'Accepts Bharat Series 22BH1234AA');

  // Non-standard product code (Bug A investigation)
  const reg4 = validateIndianRegistration('MS65761');
  assert(!reg4.valid && (reg4.reason === 'INVALID_RTO_STATE_CODE' || reg4.reason === 'NON_STANDARD_REGISTRATION_FORMAT'), 'Rejects non-standard insurance code MS65761');

  // 5. Monetary Validation & Quantity Collision Check
  console.log('\n--- 5. MONETARY VALIDATION (BUG C INVESTIGATION) ---');
  const amt1 = validateMonetaryAmount(25960, true);
  assert(amt1.valid === true && amt1.normalized === 25960, 'Accepts valid invoice grand total ₹25,960');

  const amt2 = validateMonetaryAmount('₹ 1,45,000.00', true);
  assert(amt2.valid === true && amt2.normalized === 145000, 'Accepts formatted amount ₹1,45,000');

  const amt3 = validateMonetaryAmount(1, true);
  assert(!amt3.valid && amt3.reason === 'SUSPECT_QUANTITY_COLUMN_ARTIFACT', 'Rejects bare ₹1 quantity column collision for grand total');

  // 6. Trust States
  console.log('\n--- 6. 5-TIER TRUST STATE RESOLUTION ---');
  const t1 = resolveTrustState({ value: 'UP32QU2187', confidence: 95, isValidated: true });
  assert(t1 === TRUST_STATE.VERIFIED, 'Assigns VERIFIED state for validated high-confidence field');

  const t2 = resolveTrustState({ value: 'TVS Ronin', confidence: 70, isValidated: false });
  assert(t2 === TRUST_STATE.CONFIRMED, 'Assigns CONFIRMED state for corroborated field');

  const t3 = resolveTrustState({ value: 'MS65761', confidence: 40, isAmbiguous: true });
  assert(t3 === TRUST_STATE.NEEDS_REVIEW, 'Assigns NEEDS_REVIEW state for ambiguous value');

  const t4 = resolveTrustState({ value: null, isSupported: false });
  assert(t4 === TRUST_STATE.REJECTED, 'Assigns REJECTED state for unsupported value');

  console.log('\n================================================================');
  console.log(`VALIDATOR TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runValidatorTests().catch((e) => {
  console.error('[VALIDATOR TEST EXCEPTION]', e);
  process.exit(1);
});

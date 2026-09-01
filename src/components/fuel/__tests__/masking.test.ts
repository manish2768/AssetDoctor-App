/**
 * Asset Doctor — Privacy masking tests for the Fuel Passport share cards.
 *
 * Verifies the card-level privacy rules (mask number plate / mask spend) that
 * consumers (MonthlyBlackCard, RefillImpactCard, share canvases) rely on.
 *
 * Run: npx tsx src/components/fuel/__tests__/masking.test.ts
 */

import { maskVehicleNumber, maskSpend } from '../../../services/fuel/fuelMetrics';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

function run() {
  console.log('================================================================');
  console.log('   FUEL PASSPORT MASKING (privacy controls & share)            ');
  console.log('================================================================\n');

  // Masked plate never leaks digits or letters.
  {
    const masked = maskVehicleNumber('MH 12 AB 9876', true);
    assert(!/[A-Z0-9]/.test(masked), 'Masked plate hides all alphanumerics', masked);
    assert(masked === '•• •• ••••', 'Masked plate is a fixed token');
  }

  // Unmasked plate returns uppercase original.
  {
    assert(maskVehicleNumber('mh12ab9876', false) === 'MH12AB9876', 'Unmasked plate uppercases');
  }

  // Spend masking.
  {
    assert(maskSpend(12999, true) === '₹ ••••', 'Spend masked exact');
    assert(!/12999/.test(maskSpend(12999, true)), 'Masked spend hides digits');
    assert(/12999/.test(String(maskSpend(12999, false)).replace(/,/g, '')), 'Unmasked spend shows digits');
  }

  console.log('\n================================================================');
  console.log(`MASKING: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run();

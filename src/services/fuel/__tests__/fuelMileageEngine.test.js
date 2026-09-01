/**
 * Fuel & Mileage — calculation engine test runner (Node-run, no Firebase).
 *
 * Verifies the deterministic fuel/mileage math: validation guard rails,
 * the full-tank-only mileage rule, cost-per-km, month summary aggregation and
 * vehicle-type resolution. No Firestore / native modules are touched, so this
 * can run on CI/machine without a device.
 *
 * Run: node src/services/fuel/__tests__/fuelMileageEngine.test.js
 */

import {
  validateFuelInput,
  deriveFuelConsumed,
  computeFuelCalculation,
  summarizeMonthlyFuel,
  getFuelVehicleType,
} from '../../../utils/fuelCalculator.js';
import {
  resolveFuelVehicleType,
  mileageVerdict,
  MAX_PLAUSIBLE_MILEAGE,
  MILEAGE_THRESHOLDS,
} from '../../../utils/fuelMilestone.js';

let passed = 0;
let failed = 0;

function assert(condition, name, detail) {
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
  console.log('   FUEL & MILEAGE CALCULATION ENGINE                             ');
  console.log('================================================================\n');

  // 1. Vehicle type resolution
  console.log('--- 1. VEHICLE TYPE RESOLUTION ---');
  {
    assert(resolveFuelVehicleType({ categoryId: 'car' }) === 'CAR', 'categoryId car resolves CAR');
    assert(resolveFuelVehicleType({ assetName: 'TVS Ronin 350' }) === 'BIKE', 'Name ronin resolves BIKE');
    assert(resolveFuelVehicleType({ assetName: 'Honda Activa 6G' }) === 'SCOOTER', 'Name activa resolves SCOOTER');
    assert(
      resolveFuelVehicleType({ vehicleType: 'COMMERCIAL' }) === 'COMMERCIAL',
      'Explicit vehicleType wins',
    );
    assert(resolveFuelVehicleType({ assetName: 'Hyundai Creta' }) === 'CAR', 'Name creta resolves CAR');
    assert(resolveFuelVehicleType({}) === 'OTHER', 'Unknown resolves OTHER (safe fallback)');
  }

  // 2. Validation guard rails
  console.log('\n--- 2. VALIDATION GUARD RAILS ---');
  {
    assert(
      validateFuelInput({ odometerKM: 10000, amountPaid: 500, entryMode: 'amount' }, 8000).valid === true,
      'Valid first entry passes',
    );
    assert(
      validateFuelInput({ odometerKM: 9999, amountPaid: 500, entryMode: 'amount' }, 10000).valid === false,
      'Odometer regression is rejected',
    );
    assert(
      validateFuelInput({ odometerKM: 10200, amountPaid: 0, liters: 0, entryMode: 'liters' }).valid === false,
      'Zero fuel quantity is rejected',
    );
    assert(
      validateFuelInput({ odometerKM: 0, amountPaid: 500, entryMode: 'amount' }).valid === false,
      'Zero odometer is rejected',
    );
    assert(
      validateFuelInput({ odometerKM: 10200, amountPaid: 0, liters: 0, entryMode: 'liters' }).odometerRegression
        ? false
        : true,
      'Zero fuel error has no odometer-regression flag',
    );
  }

  // 3. Full-tank-only mileage rule
  console.log('\n--- 3. FULL-TANK-ONLY MILEAGE RULE ---');
  {
    const prev = {
      id: 'fu_1',
      odometerKM: 10000,
      amountPaid: 1000,
      liters: 10,
      isFullTank: true,
    };
    // Current full tank on top of previous full tank -> real mileage.
    const full = computeFuelCalculation(
      { odometerKM: 10500, amountPaid: 1200, liters: 12, isFullTank: true, entryMode: 'liters' },
      prev,
      { categoryId: 'car' },
    );
    assert(full.isFirstEntry === false, 'Not the first entry');
    assert(full.mileage === 41.7, 'Mileage = 500km / 12L = 41.7 (currently: ' + full.mileage + ')');
    assert(full.costPerKm === 2.4, 'Cost/km = 1200 / 500 = 2.4');
    assert(full.distanceSincePrevious === 500, 'Distance since previous = 500km');

    // Partial (non-full) current tank -> NO fabricated mileage.
    const partial = computeFuelCalculation(
      { odometerKM: 10400, amountPaid: 600, liters: 6, isFullTank: false, entryMode: 'liters' },
      prev,
      { categoryId: 'car' },
    );
    assert(partial.mileage === null, 'Partial refill never fabricates mileage');
    assert(partial.needsNextFullTank === true, 'Partial refill requests a future full tank');
  }

  // 4. First entry cannot compute mileage
  console.log('\n--- 4. FIRST ENTRY ---');
  {
    const first = computeFuelCalculation(
      { odometerKM: 15000, amountPaid: 1000, liters: 8, isFullTank: true, entryMode: 'liters' },
      null,
      { categoryId: 'bike' },
    );
    assert(first.isFirstEntry === true, 'Recognized as first entry');
    assert(first.mileage === null, 'No mileage on first entry');
    assert(first.needsNextFullTank === true, 'Needs the next full tank to start computing');
  }

  // 5. Impossible / implausible mileage flagged
  console.log('\n--- 5. IMPLAUSIBLE MILEAGE FLAG ---');
  {
    const prev = { id: 'fu_x', odometerKM: 10000, liters: 0.1, isFullTank: true };
    const bad = computeFuelCalculation(
      { odometerKM: 20000, amountPaid: 1000, liters: 0.1, isFullTank: true, entryMode: 'liters' },
      prev,
      { categoryId: 'car' },
    );
    assert(bad.flaggedMileage === true, '>250 km/L is flagged and nulled');
    assert(bad.mileage === null, 'Flagged mileage is not displayed');
  }

  // 6. Mileage verdict thresholds
  console.log('\n--- 6. MILEAGE VERDICT THRESHOLDS ---');
  {
    assert(mileageVerdict(22, 'CAR').rank === 'excellent', '22 km/L car is excellent');
    assert(mileageVerdict(14, 'CAR').rank === 'average', '14 km/L car is average');
    assert(mileageVerdict(8, 'CAR').rank === 'low', '8 km/L car is low');
    assert(mileageVerdict(50, 'BIKE').rank === 'excellent', '50 km/L bike is excellent');
    assert(mileageVerdict(0, 'CAR') === null, 'Non-positive mileage has no verdict');
    assert(
      MILEAGE_THRESHOLDS.BIKE.excellentFrom === 45,
      'Bike excellent threshold is 45 km/L',
    );
  }

  // 7. Derive fuel consumed
  console.log('\n--- 7. DERIVE FUEL CONSUMED ---');
  {
    assert(
      deriveFuelConsumed({ liters: 12, entryMode: 'liters' }).fuelConsumed === 12,
      'Liters entry uses litres directly',
    );
    const fromAmount = deriveFuelConsumed({ amountPaid: 1000, fuelPricePerLiter: 100, entryMode: 'amount' });
    assert(fromAmount.fuelConsumed === 10, 'Amount fills derive litres (1000/100)');
    const missingPrice = deriveFuelConsumed({ amountPaid: 1000, entryMode: 'amount' });
    assert(missingPrice.fuelConsumed === null && missingPrice.needsFuelPrice === true,
      'Amount without price cannot derive litres silently');
  }

  // 8. Monthly summary aggregation
  console.log('\n--- 8. MONTHLY SUMMARY (FUEL WRAP) ---');
  {
    const ts = (day) => new Date(Date.UTC(2026, 4, day, 10)); // May 2026
    const logs = [
      { id: 'a', odometerKM: 10000, liters: 10, amountPaid: 1100, isFullTank: true, timestamp: ts(1) },
      { id: 'b', odometerKM: 10500, liters: 11, amountPaid: 1200, isFullTank: true, timestamp: ts(5) },
      { id: 'c', odometerKM: 11000, liters: 10, amountPaid: 1000, isFullTank: true, timestamp: ts(20) },
    ];
    const summary = summarizeMonthlyFuel('2026-05', 'ast_1', logs);
    assert(summary.entryCount === 3, 'Counts three May logs');
    assert(summary.totalDistanceKm === 1000, 'Total distance = 1000 km');
    assert(summary.totalFuelSpendInr === 3300, 'Total spend = ₹3,300');
    assert(summary.averageMileage === 47.7, 'Avg mileage = (500/11 + 500/10)/2 = 47.7 km/L');
    // Non-May logs are excluded.
    const otherTs = new Date(Date.UTC(2026, 3, 1, 10));
    const summary2 = summarizeMonthlyFuel('2026-05', 'ast_1', [
      { id: 'z', odometerKM: 99999, liters: 9, amountPaid: 900, isFullTank: true, timestamp: otherTs },
    ]);
    assert(summary2.entryCount === 0, 'April log excluded from May summary');
  }

  // 9. getFuelVehicleType re-routes to the same config
  console.log('\n--- 9. getFuelVehicleType ---');
  {
    assert(getFuelVehicleType({ categoryId: 'car' }) === 'CAR', 'getFuelVehicleType returns CAR');
    assert(getFuelVehicleType({}) === 'OTHER', 'getFuelVehicleType falls back to OTHER');
    assert(MAX_PLAUSIBLE_MILEAGE === 250, 'MAX_PLAUSIBLE_MILEAGE is 250');
  }

  console.log('\n================================================================');
  console.log(`FUEL & MILEAGE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run();

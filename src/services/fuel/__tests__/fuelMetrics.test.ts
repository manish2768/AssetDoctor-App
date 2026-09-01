/**
 * Asset Doctor — Fuel Metrics + Share service test runner (Node-run, no Firebase).
 *
 * Verifies the Fuel Passport & Refill Impact calculation + masking logic:
 *   - Normalize/dedupe/validate fuel logs
 *   - Trip distance = lastKm - firstKm (chronological)
 *   - Mileage never fabricated when litres missing
 *   - Running cost guarded
 *   - Efficiency verdict + city-average comparison
 *   - Monthly aggregation (chronological) + month filtering
 *   - Privacy masking (plate / spend / digits)
 *   - QR / install URL config integrity
 *
 * Run: npx tsx src/services/fuel/__tests__/fuelMetrics.test.ts
 */

import {
  computeTripMetrics,
  computeMonthlyMetrics,
  classifyEfficiency,
  cityAverageBenchmark,
  normalizeFuelLogs,
  maskVehicleNumber,
  maskSpend,
  maskNumberDigits,
  monthKeyOf,
} from '../fuelMetrics';

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

const stubAssets = { categoryId: 'car', assetName: 'Hyundai Creta' };

function logs(entries: Array<[number, number, number, boolean]>) {
  // entries: [odometer, liters, amount, fullTank]
  return entries.map(([odo, liters, amount, full], i) => ({
    id: `fu_${i}`,
    odometerKM: odo,
    liters,
    amountPaid: amount,
    isFullTank: full,
    timestamp: new Date(2026, 4, i + 1, 10).toISOString(),
  }));
}

function run() {
  console.log('================================================================');
  console.log('   FUEL METRICS + SHARE (Fuel Passport / Refill Impact)        ');
  console.log('================================================================\n');

  // 1. normalizeFuelLogs — dedupe, drop invalid, sort chronological
  console.log('--- 1. NORMALIZE FUEL LOGS ---');
  {
    const norm = normalizeFuelLogs([
      { odometerKM: 10500, liters: 12 },
      { odometerKM: 10000, liters: 10 },
      { odometerKM: 10500, liters: 5 }, // duplicate odo dropped
      { odometerKM: -1, liters: 3 }, // invalid dropped
      { odometerKM: 0, liters: 3 }, // invalid dropped
      null as any, // null dropped
      { odometerKM: 11000, liters: null }, // valid, no litres
    ]);
    assert(norm.length === 3, 'Dedupes, drops invalid, drops null');
    assert(norm[0].odometerKM === 10000 && norm[1].odometerKM === 10500 && norm[2].odometerKM === 11000, 'Sorted ascending by odometer');
  }

  // 2. Trip distance = lastKm - firstKm (chronological)
  console.log('\n--- 2. TRIP DISTANCE ---');
  {
    const trip = computeTripMetrics(logs([[10000, 10, 1000, true], [10500, 12, 1200, true]]), stubAssets);
    assert(trip.tripDistanceKm === 500, 'Trip distance = 10500 - 10000 = 500 km');
    assert(trip.hasEnoughData === true, 'Two valid entries → has span');
  }

  // 3. Mileage never fabricated when litres missing
  console.log('\n--- 3. MILEAGE SAFETY (NO FABRICATION) ---');
  {
    const noLiters = computeTripMetrics(
      [
        { odometerKM: 10000, amountPaid: 1000 },
        { odometerKM: 10500, amountPaid: 1200 },
      ],
      stubAssets,
    );
    assert(noLiters.tripDistanceKm === 500, 'Distance still computed without litres');
    assert(noLiters.tripMileageKmPerL === null, 'Mileage is null (no litres) — never fabricated');
    assert(noLiters.verdict === 'INSUFFICIENT', 'Verdict insufficient without mileage');

    const single = computeTripMetrics(logs([[10000, 10, 1000, true]]), stubAssets);
    assert(single.tripDistanceKm === null, 'Single log → no span → null distance');
    assert(single.hasEnoughData === false, 'Single log not enough data');
  }

  // 4. Running cost guarded
  console.log('\n--- 4. RUNNING COST ---');
  {
    const trip = computeTripMetrics(logs([[10000, 10, 1000, true], [10500, 12, 1200, true]]), stubAssets);
    assert(trip.runningCostPerKm === 4.4, 'Running cost = 2200 / 500 = 4.4 ₹/km');
    const noSpend = computeTripMetrics(
      [
        { odometerKM: 10000, liters: 10 },
        { odometerKM: 10500, liters: 12 },
      ],
      stubAssets,
    );
    assert(noSpend.runningCostPerKm === null, 'No spend → running cost null');
  }

  // 5. Efficiency verdict + city-average comparison
  console.log('\n--- 5. EFFICIENCY VERDICT + CITY-AVG COMPARISON ---');
  {
    // Car city average = 12 (averageFrom). 41.7 km/L → SUPER SAVER, "≥ 5%".
    const trip = computeTripMetrics(logs([[10000, 10, 1000, true], [10500, 12, 1200, true]]), stubAssets);
    assert(trip.verdict === 'SUPER_SAVER', 'Great mileage → SUPER SAVER');

    // Direct classify tests.
    assert(classifyEfficiency(13, 12, 100).verdict === 'SUPER_SAVER', '13 vs 12 → 8% better, super saver (>=105%)');
    assert(classifyEfficiency(12.4, 12, 100).verdict === 'BALANCED', '12.4 vs 12 → balanced (within ±)');
    assert(classifyEfficiency(8, 12, 100).verdict === 'HEAVY_THROTTLE', '8 vs 12 → heavy throttle (<85%)');
    assert(classifyEfficiency(19, 12, 100).verdict === 'SUPER_SAVER', '19 vs 12 → super saver (>=105%)');
    assert(classifyEfficiency(null, 12, 100).verdict === 'INSUFFICIENT', 'null mileage → insufficient');

    // Benchmark resolution.
    assert(cityAverageBenchmark({ categoryId: 'car' }) === 12, 'Car city avg = 12');
    assert(cityAverageBenchmark({ categoryId: 'scooter' }) === 30, 'Scooter city avg = 30');
    assert(cityAverageBenchmark({}) === null, 'Unknown vehicle → no benchmark (no fake claim)');
  }

  // 6. Implausible mileage flagged (no >250)
  console.log('\n--- 6. IMPLAUSIBLE MILEAGE ===');
  {
    const bad = computeTripMetrics(
      logs([[10000, 0.1, 100, true], [20000, 0.1, 100, true]]),
      stubAssets,
    );
    assert(bad.tripMileageKmPerL === null, '>250 km/L flagged → null (never fabricated)');
  }

  // 7. Monthly aggregation (chronological) + month filter
  console.log('\n--- 7. MONTHLY AGGREGATION ---');
  {
    const mayLogs = [
      { id: 'a', odometerKM: 10000, liters: 10, amountPaid: 1100, timestamp: new Date(Date.UTC(2026, 4, 1, 10)).toISOString() },
      { id: 'b', odometerKM: 10500, liters: 11, amountPaid: 1200, timestamp: new Date(Date.UTC(2026, 4, 5, 10)).toISOString() },
      { id: 'c', odometerKM: 11000, liters: 10, amountPaid: 1000, timestamp: new Date(Date.UTC(2026, 4, 20, 10)).toISOString() },
    ];
    const summary = computeMonthlyMetrics('2026-05', mayLogs as any, stubAssets);
    assert(summary.entryCount === 3, 'Counts all three May logs');
    assert(summary.totalDistanceKm === 1000, 'May distance = 11000 - 10000 = 1000 km');
    assert(summary.totalSpendInr === 3300, 'May spend = 3300');
    assert(summary.averageMileageKmPerL === 32.3, 'May avg mileage = 1000/31 = 32.3 km/L');

    // April log excluded.
    const other = computeMonthlyMetrics('2026-05', [
      { id: 'z', odometerKM: 99999, liters: 9, amountPaid: 900, timestamp: new Date(Date.UTC(2026, 3, 1, 10)).toISOString() },
    ] as any, stubAssets);
    assert(other.entryCount === 0, 'April log excluded from May summary');
  }

  // 8. Privacy masking
  console.log('\n--- 8. MASKING (PRIVACY) ---');
  {
    assert(maskVehicleNumber('UP32QU2187', true) === '•• •• ••••', 'Plate masked');
    assert(maskVehicleNumber('UP32QU2187', false).includes('UP32'), 'Plate unmasked shows raw');
    assert(maskVehicleNumber('', true) === '•• •• ••••', 'Empty plate falls back to masked token');
    assert(maskSpend(3300, true) === '₹ ••••', 'Spend masked');
    assert(maskSpend(3300, false) === '₹3,300', 'Spend unmasked');
    assert(maskSpend(null, false) === '—', 'Null spend → dash');
    assert(maskNumberDigits('UP32QU2187', true) === '••••••••••', 'Digit masking masks all alnum');
    assert(maskNumberDigits('UP32QU2187', false) === 'UP32QU2187', 'No mask when disabled');
  }

  // 9. monthKeyOf + config integrity
  console.log('\n--- 9. MONTH KEY + CONFIG ---');
  {
    const key = monthKeyOf(new Date(2026, 4, 1));
    assert(key === '2026-05', 'monthKeyOf formats YYYY-MM');
    // Ensure install URL is a valid https URL (from central config).
    try {
      const url = require('../../../config/installUrl').ASSET_DOCTOR_INSTALL_URL;
      assert(typeof url === 'string' && /^https:\/\//.test(url), 'Install URL is an https URL', url);
    } catch {
      assert(false, 'Install URL module loads');
    }
  }

  console.log('\n================================================================');
  console.log(`FUEL METRICS + SHARE: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run();

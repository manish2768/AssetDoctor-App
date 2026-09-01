/**
 * NetworkIntelligenceService — deterministic, Node-run spec (no Firebase/native).
 * Validates the in-memory NIG view across the required edge cases.
 *
 * Run: node src/services/intelligence/__tests__/networkIntelligenceService.test.js
 */

import { buildNetworkIntelligence } from '../NetworkIntelligenceService.js';

let passed = 0;
let failed = 0;

function assert(condition, name, detail) {
  if (condition) {
    console.log(`  \u2713 PASS: ${name}`);
    passed += 1;
  } else {
    console.error(`  \u2717 FAIL: ${name}${detail ? ` \u2014 ${detail}` : ''}`);
    failed += 1;
  }
}

function fx(v) {
  return Number.isFinite(v) ? v : null;
}

function appliance(overrides = {}) {
  return {
    assetId: overrides.assetId || `ast_${Math.random().toString(36).slice(2, 8)}`,
    assetName: overrides.assetName != null ? overrides.assetName : 'Appliance',
    roomId: overrides.roomId !== undefined ? overrides.roomId : 'living-room',
    powerWatts: overrides.powerWatts,
    dailyHours: overrides.dailyHours,
    energyProfile: overrides.energyProfile
      ? { ...overrides.energyProfile }
      : undefined,
    categoryId: overrides.categoryId || 'appliance',
    electricityTariff: overrides.electricityTariff,
    electricityBill: overrides.electricityBill,
    deletedAt: overrides.deletedAt,
  };
}

function run() {
  console.log('================================================================');
  console.log('   NETWORK INTELLIGENCE SERVICE (NIG)                           ');
  console.log('================================================================\n');

  // 1. Zero appliances
  console.log('--- 1. ZERO APPLIANCES ---');
  {
    const nig = buildNetworkIntelligence([]);
    assert(nig.empty === true, 'empty flag true for no assets');
    assert(nig.totalMonthlyKwh === 0, 'totalMonthlyKwh is 0');
    assert(nig.totalDailyKwh === 0, 'totalDailyKwh is 0');
    assert(nig.totalMonthlyCost === 0, 'totalMonthlyCost is 0');
    assert(nig.byRoom.length === 0, 'no rooms');
    assert(nig.topConsumers.length === 0, 'no top consumers');
    assert(nig.highestConsumer === null, 'no highest consumer');
    assert(nig.needingInputs.length === 0, 'no needing inputs');
    assert(nig.estimateVsActual.available === false, 'estimateVsActual unavailable');
    assert(nig.byAsset.length === 0, 'no byAsset rows');
    assert(nig.isEstimate === true && nig.displayPrefix === '~', 'empty aggregate still ESTIMATED');
  }

  // 2. One appliance with full inputs
  console.log('\n--- 2. ONE APPLIANCE (full inputs) ---');
  {
    const assets = [
      appliance({ assetId: 'a1', assetName: 'AC', powerWatts: 2000, dailyHours: 5 }),
    ];
    const nig = buildNetworkIntelligence(assets);
    assert(nig.assetCount === 1, 'assetCount is 1');
    assert(nig.totalMonthlyKwh === 300, 'monthly kWh = (2000/1000)*5*30 = 300');
    assert(nig.totalDailyKwh === 10, 'daily kWh = 300/30 = 10');
    assert(nig.totalMonthlyCost === 300 * nig.tariffResolved.value, 'monthly cost matches');
    assert(nig.highestConsumer !== null, 'has highest consumer');
    assert(nig.highestConsumer.assetId === 'a1', 'highest consumer is a1');
    assert(nig.highestConsumer.consumptionSharePct === 100, 'single consumer = 100% share');
    assert(nig.isEstimate === true, 'aggregate labelled ESTIMATED');
    assert(nig.displayPrefix === '~', 'display prefix ~');
    assert(nig.byAsset[0].isEstimate === true, 'row labelled ESTIMATED');
    assert(nig.needingInputs.length === 0, 'full-input asset needs nothing');
  }

  // 3. Multiple appliances + shares
  console.log('\n--- 3. MULTI APPLIANCE + SHARES ---');
  {
    const assets = [
      appliance({ assetId: 'fridge', assetName: 'Fridge', powerWatts: 150, dailyHours: 24, roomId: 'kitchen' }),
      appliance({ assetId: 'ac', assetName: 'AC', powerWatts: 2000, dailyHours: 5, roomId: 'bedroom' }),
      appliance({ assetId: 'tv', assetName: 'TV', powerWatts: 100, dailyHours: 4, roomId: 'living-room' }),
    ];
    const nig = buildNetworkIntelligence(assets);
    const total = 108 + 300 + 12; // 420
    assert(nig.totalMonthlyKwh === total, `total kWh = ${total}`);
    assert(nig.byAsset.length === 3, '3 asset rows');
    assert(nig.topConsumers.length === 3, '3 top consumers');
    assert(nig.highestConsumer.assetId === 'ac', 'AC is highest consumer');
    const bedroom = nig.byRoom.find((r) => r.roomId === 'bedroom');
    assert(bedroom && bedroom.consumptionSharePct === 71.4, 'bedroom share = 300/420');
    const fridge = nig.byAsset.find((a) => a.assetId === 'fridge');
    assert(fridge && fridge.consumptionSharePct === 25.7, 'fridge share %');
    assert(
      nig.byAsset.find((a) => a.assetId === 'ac').monthlyKwh === 300 &&
        nig.byAsset.find((a) => a.assetId === 'fridge').monthlyKwh === 108 &&
        nig.byAsset.find((a) => a.assetId === 'tv').monthlyKwh === 12,
      'per-asset monthly kWh correct',
    );
    assert(
      nig.topConsumers[0].assetId === 'ac' &&
        nig.topConsumers[1].assetId === 'fridge' &&
        nig.topConsumers[2].assetId === 'tv',
      'top consumers sorted desc',
    );
  }

  // 4. Missing room
  console.log('\n--- 4. MISSING ROOM ---');
  {
    const assets = [
      appliance({ assetId: 'x', assetName: 'Heater', powerWatts: 1000, dailyHours: 2, roomId: null }),
    ];
    const nig = buildNetworkIntelligence(assets);
    assert(nig.byRoom.length === 1, 'one room bucket');
    assert(nig.byRoom[0].roomId === null, 'unassigned room kept null');
    assert(nig.byAsset[0].roomId === null, 'asset roomId null');
  }

  // 5. Missing wattage / missing usage hours
  console.log('\n--- 5. MISSING INPUTS ---');
  {
    const assets = [
      appliance({ assetId: 'nowatt', assetName: 'NoWatts', roomId: 'r1' }), // no watts, no hours
      appliance({ assetId: 'nohours', assetName: 'NoHours', powerWatts: 500, roomId: 'r1' }), // no hours
      appliance({ assetId: 'full', assetName: 'Full', powerWatts: 800, dailyHours: 1, roomId: 'r1' }), // full
    ];
    const nig = buildNetworkIntelligence(assets);
    assert(nig.needingInputs.length === 2, '2 assets need inputs (no watts + no hours)');
    assert(
      nig.needingInputs.some((n) => n.assetId === 'nowatt') &&
        nig.needingInputs.some((n) => n.assetId === 'nohours'),
      'both incomplete assets flagged',
    );
    const fullRow = nig.byAsset.find((a) => a.assetId === 'full');
    assert(fullRow && fullRow.monthlyKwh === 24, 'full-input asset counted (0.8*1*30=24)');
    assert(fullRow.needsEnergyInputs === false, 'full asset does not need inputs');
  }

  // 6. Zero consumption
  console.log('\n--- 6. ZERO CONSUMPTION ---');
  {
    const assets = [
      appliance({ assetId: 'z1', assetName: 'Z', powerWatts: 2000, dailyHours: 0 }),
    ];
    const nig = buildNetworkIntelligence(assets);
    assert(nig.totalMonthlyKwh === 0, 'no kWh fabricated for 0 hours');
    assert(nig.estimateVsActual.available === false, 'no bill -> no estimateVsActual');
  }

  // 7. Estimate vs actual (real bill data)
  console.log('\n--- 7. ESTIMATE VS ACTUAL ---');
  {
    const assets = [
      appliance({
        assetId: 'a1',
        assetName: 'AC',
        powerWatts: 2000,
        dailyHours: 5,
        electricityBill: { unitsConsumed: 400, billingPeriod: '2026-05', totalAmount: 3000 },
      }),
      appliance({ assetId: 'a2', assetName: 'Fridge', powerWatts: 150, dailyHours: 24 }),
    ];
    const nig = buildNetworkIntelligence(assets);
    assert(nig.estimateVsActual.available === true, 'estimateVsActual available with bill');
    assert(nig.estimateVsActual.applianceKwh === 408, 'applianceKwh = 300 + 108 = 408');
    assert(nig.estimateVsActual.billKwh === 400, 'billKwh = 400');
    const expectedGap = Math.round(((400 - 408) / 400) * 1000) / 10; // -2
    assert(fx(nig.estimateVsActual.gapPct) === expectedGap, `gapPct = ${expectedGap}`);
  }

  // 8. 20+ appliances
  console.log('\n--- 8. 20+ APPLIANCES ---');
  {
    const assets = [];
    for (let i = 0; i < 25; i++) {
      assets.push(
        appliance({ assetId: `ast_${i}`, assetName: `A${i}`, powerWatts: 100, dailyHours: 2 }),
      );
    }
    const nig = buildNetworkIntelligence(assets);
    assert(nig.assetCount === 25, '25 assets counted');
    assert(nig.byAsset.length === 25, '25 rows');
    assert(nig.topConsumers.length === 25, '25 top consumers');
    assert(nig.totalMonthlyKwh === 150, 'total 150 kWh');
  }

  // 9. Deleted assets excluded
  console.log('\n--- 9. DELETED ASSETS EXCLUDED ---');
  {
    const assets = [
      appliance({ assetId: 'keep', assetName: 'Keep', powerWatts: 100, dailyHours: 1 }),
      appliance({ assetId: 'gone', assetName: 'Gone', powerWatts: 1000, dailyHours: 24, deletedAt: 12345 }),
    ];
    const nig = buildNetworkIntelligence(assets);
    assert(nig.assetCount === 1, 'deleted asset excluded');
    assert(nig.byAsset.length === 1, 'one row only');
    assert(nig.byAsset[0].assetId === 'keep', 'kept asset present');
  }

  console.log('\n================================================================');
  console.log(`NETWORK INTELLIGENCE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run();

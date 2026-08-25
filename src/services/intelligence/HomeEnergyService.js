/**
 * HomeEnergyService — aggregate estimates by home / room / asset (Phase 2).
 * Never invents kWh; unavailable assets are skipped.
 */

import { buildEnergyProfile, calculateEnergyEstimate } from './EnergyCalculationService';
import { ENERGY_VALUE_KIND } from './types';
import {
  compareBillMonths,
  aggregateHouseholdEnergy,
} from '../assets/energyIntelligence';
import { DEFAULT_TARIFF_PER_KWH } from '../../theme/branding';

function assetRoomKey(asset = {}) {
  return asset.roomId || asset.locationId || null;
}

/**
 * Per-asset estimate from stored profile or calculable inputs only.
 */
export function estimateForAsset(asset = {}, tariffPerKwh) {
  const profile = buildEnergyProfile(asset, tariffPerKwh != null ? { tariff: tariffPerKwh } : {});
  if (asset.energyProfile?.estimatedMonthlyConsumptionKwh != null) {
    const method = asset.energyProfile.calculationMethod;
    const isEstimate = method !== 'actual_meter';
    return {
      assetId: asset.assetId || asset.id,
      displayName: asset.nickname || asset.assetName || 'Asset',
      homeId: asset.homeId || null,
      roomId: assetRoomKey(asset),
      monthlyKWh: Number(asset.energyProfile.estimatedMonthlyConsumptionKwh),
      monthlyCost:
        asset.energyProfile.estimatedMonthlyCost != null
          ? Number(asset.energyProfile.estimatedMonthlyCost)
          : null,
      powerWatts: asset.energyProfile.ratedPowerWatts ?? asset.powerWatts ?? asset.wattage ?? null,
      usageHoursPerDay:
        asset.energyProfile.usageHoursPerDay ?? asset.avgDailyHours ?? asset.dailyHours ?? null,
      valueKind: isEstimate ? ENERGY_VALUE_KIND.ESTIMATED : ENERGY_VALUE_KIND.ACTUAL,
      isEstimate,
      available: true,
    };
  }
  const est = calculateEnergyEstimate(profile);
  if (!est.available) {
    return {
      assetId: asset.assetId || asset.id,
      displayName: asset.nickname || asset.assetName || 'Asset',
      homeId: asset.homeId || null,
      roomId: assetRoomKey(asset),
      monthlyKWh: null,
      monthlyCost: null,
      powerWatts: profile.powerWatts,
      usageHoursPerDay: profile.usageHoursPerDay,
      valueKind: ENERGY_VALUE_KIND.ESTIMATED,
      isEstimate: true,
      available: false,
    };
  }
  return {
    assetId: asset.assetId || asset.id,
    displayName: asset.nickname || asset.assetName || 'Asset',
    homeId: asset.homeId || null,
    roomId: assetRoomKey(asset),
    monthlyKWh: est.monthlyKWh,
    monthlyCost: est.monthlyCost,
    powerWatts: profile.powerWatts,
    usageHoursPerDay: profile.usageHoursPerDay,
    valueKind: est.valueKind,
    isEstimate: est.isEstimate !== false,
    available: true,
  };
}

/**
 * Aggregate home energy from assets (optional homeId filter).
 */
export function aggregateHomeEnergy(assets = [], opts = {}) {
  const list = (assets || []).filter((a) => a && !a.deletedAt);
  const scoped = opts.homeId
    ? list.filter((a) => String(a.homeId || '') === String(opts.homeId))
    : list;

  const perAsset = scoped
    .map((a) => estimateForAsset(a, opts.tariffPerKwh))
    .filter((r) => r.available);
  const byRoom = {};
  let monthlyKWh = 0;
  let monthlyCost = 0;
  for (const row of perAsset) {
    monthlyKWh += row.monthlyKWh || 0;
    monthlyCost += row.monthlyCost || 0;
    const key = row.roomId || 'unassigned';
    if (!byRoom[key]) {
      byRoom[key] = { roomId: row.roomId, monthlyKWh: 0, monthlyCost: 0, assets: [] };
    }
    byRoom[key].monthlyKWh += row.monthlyKWh || 0;
    byRoom[key].monthlyCost += row.monthlyCost || 0;
    byRoom[key].assets.push(row);
  }

  const topConsumers = [...perAsset].sort((a, b) => (b.monthlyKWh || 0) - (a.monthlyKWh || 0));
  const highestConsumer = topConsumers[0] || null;

  const needingInputs = scoped
    .filter((a) => !estimateForAsset(a, opts.tariffPerKwh).available)
    .map((a) => ({
      assetId: a.assetId || a.id,
      displayName: a.nickname || a.customAssetName || a.assetName || 'Asset',
      roomId: assetRoomKey(a),
      prompt: 'Add rated wattage and daily usage hours to estimate energy.',
    }));

  const monthCompare = compareBillMonths(list);
  const insights = buildEnergyCommandInsights(
    perAsset,
    needingInputs,
    byRoom,
    highestConsumer,
    monthCompare,
  );

  return {
    homeId: opts.homeId || null,
    isEstimate: true,
    valueKind: ENERGY_VALUE_KIND.ESTIMATED,
    displayPrefix: '~',
    totalMonthlyConsumptionKWh: Math.round(monthlyKWh * 10) / 10,
    estimatedMonthlyConsumptionKWh: Math.round(monthlyKWh * 10) / 10,
    estimatedMonthlyCost: Math.round(monthlyCost),
    monthCompare,
    highestConsumer,
    byRoom: Object.values(byRoom).map((r) => ({
      ...r,
      monthlyKWh: Math.round(r.monthlyKWh * 10) / 10,
      monthlyCost: Math.round(r.monthlyCost),
    })),
    byAsset: perAsset,
    topConsumers: topConsumers.slice(0, 10),
    needingInputs,
    insights,
    calculationLabel: 'Estimated home energy (usage assumptions apply)',
    formula: 'Monthly kWh = (W/1000) × Hours/Day × Days/Month',
    assetCount: scoped.length,
    assetsWithEnergy: perAsset.length,
    // Aliases for EnergyScreen / command cards
    monthOverMonth: monthCompare,
    highestConsumingAsset: highestConsumer,
    needingWattage: needingInputs,
  };
}

function buildEnergyCommandInsights(
  perAsset,
  needingInputs,
  byRoom,
  highestConsumer,
  monthCompare,
) {
  const insights = [];
  if (!perAsset.length && needingInputs.length) {
    insights.push({
      what: 'Not enough data yet.',
      why: 'No asset has wattage + hours yet — totals are not fabricated.',
      whatShouldIDo: 'Open Energy on each appliance and enter rated watts / daily hours.',
    });
    return insights;
  }
  if (!perAsset.length) {
    insights.push({
      what: 'Not enough data yet.',
      why: 'Add wattage and usage hours on electrical appliances.',
      whatShouldIDo: 'Scan an appliance bill or edit energy inputs.',
    });
    return insights;
  }
  if (highestConsumer) {
    insights.push({
      what: `${highestConsumer.displayName} is the highest consuming asset`,
      why: `~${highestConsumer.monthlyKWh} kWh/month from your entered wattage/usage.`,
      whatShouldIDo: 'Verify usage hours if the estimate looks high.',
    });
  }
  if (monthCompare?.available) {
    insights.push({
      what: monthCompare.message,
      why: `Prior bill ${monthCompare.previous?.unitsKwh ?? '—'} kWh → current ${monthCompare.current?.unitsKwh ?? '—'} kWh (from scanned bills).`,
      whatShouldIDo: 'Scan the next electricity bill to keep the trend accurate.',
    });
  } else if (monthCompare && !monthCompare.available) {
    insights.push({
      what: 'Not enough data yet.',
      why: 'Month-over-month change needs at least two electricity bills with units or amount.',
      whatShouldIDo: 'Scan your electricity bill after each cycle.',
    });
  }
  if (
    highestConsumer &&
    Number(highestConsumer.usageHoursPerDay) >= 10 &&
    Number(highestConsumer.monthlyKWh) > 0
  ) {
    insights.push({
      what: 'Energy saving opportunity',
      why: `${highestConsumer.displayName} is logged at ~${highestConsumer.usageHoursPerDay} h/day (~${highestConsumer.monthlyKWh} kWh/mo).`,
      whatShouldIDo: 'Reduce daily hours slightly and re-check the estimate — no invented savings %.',
    });
  }
  const rooms = Object.values(byRoom || {});
  if (rooms.length >= 2) {
    const sorted = [...rooms].sort((a, b) => (b.monthlyKWh || 0) - (a.monthlyKWh || 0));
    insights.push({
      what: 'Room comparison available',
      why: `Highest room load ~${sorted[0].monthlyKWh} kWh/month (${sorted[0].assets?.length || 0} asset(s)).`,
      whatShouldIDo: 'Compare identical ACs by room before changing usage.',
    });
  }
  if (needingInputs.length) {
    insights.push({
      what: `${needingInputs.length} asset(s) still need energy inputs`,
      why: 'Estimates skip assets without wattage/usage.',
      whatShouldIDo: needingInputs
        .slice(0, 3)
        .map((n) => n.displayName)
        .join(', '),
    });
  }
  return insights;
}

export function assetsForHome(assets = [], homeId) {
  if (!homeId) return (assets || []).filter((a) => a && !a.deletedAt);
  return (assets || []).filter(
    (a) => a && !a.deletedAt && String(a.homeId || '') === String(homeId),
  );
}

/** Portfolio-level energy insight rows for home insights engine (real data only). */
export function buildPortfolioEnergyInsights(assets = [], tariffPerKwh = DEFAULT_TARIFF_PER_KWH) {
  const eligible = (assets || []).filter((a) => a && !a.deletedAt);
  const household = aggregateHouseholdEnergy(eligible, tariffPerKwh);
  const home = aggregateHomeEnergy(eligible, { tariffPerKwh });
  const out = [];
  if (!home.assetsWithEnergy) {
    return out;
  }
  if (home.highestConsumer) {
    out.push({
      type: 'ENERGY',
      category: 'Energy',
      title: `${home.highestConsumer.displayName} uses the most electricity`,
      message: `~${home.highestConsumer.monthlyKWh} kWh/month (from your wattage/usage inputs).`,
      assetId: home.highestConsumer.assetId,
      reason: 'highest_consumer',
      source: 'energy_estimate',
      confidence: 0.6,
    });
  }
  if (home.monthCompare?.available) {
    out.push({
      type: 'ENERGY',
      category: 'Energy',
      title: home.monthCompare.message,
      message: 'Based on scanned electricity bills — not estimated.',
      assetId: null,
      reason: 'bill_month_change',
      source: 'electricity_bill',
      confidence: 0.8,
    });
  }
  const monthlyCost = household.estimatedMonthlyCost ?? household.estimatedMonthlyCostInr;
  const monthlyKwh =
    household.estimatedMonthlyConsumptionKwh ?? household.estimatedMonthlyConsumptionKWh;
  if (monthlyCost > 0) {
    out.push({
      type: 'ENERGY',
      category: 'Energy',
      title: `Estimated household energy ~₹${monthlyCost}/mo`,
      message: `~${monthlyKwh} kWh from ${(household.byAsset || household.topConsumers || []).length} appliance(s).`,
      assetId: home.highestConsumer?.assetId || null,
      reason: 'household_estimate',
      source: 'energy_estimate',
      confidence: 0.55,
    });
  }
  return out;
}

export const HomeEnergyService = {
  estimateForAsset,
  aggregateHomeEnergy,
  assetsForHome,
  buildPortfolioEnergyInsights,
};

export default HomeEnergyService;

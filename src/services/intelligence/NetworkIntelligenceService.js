/**
 * NetworkIntelligenceService — NIG (Network / Home Energy Intelligence Graph).
 *
 * Derived, in-memory view over the asset list. It does NOT write or read a
 * Firestore collection and never invents wattage, usage or electricity-bill
 * figures. It reuses the existing energy calculation services so the math is
 * defined in exactly one place.
 *
 * Builders reused (no duplication):
 *   - EnergyCalculationService (EnergyCalculationService.js)
 *   - HomeEnergyService       (HomeEnergyService.js)
 *   - aggregateHouseholdEnergy / collectElectricityBillMonths (../assets/energyIntelligence.js)
 *   - resolveAssetCapabilities (../assets/assetCapabilities.js)
 *
 * Estimates are always labelled ESTIMATED (displayPrefix '~', valueKind ESTIMATED).
 */

// EnergyCalculationService is reused transitively via HomeEnergyService.aggregateHomeEnergy.
import { aggregateHomeEnergy } from './HomeEnergyService';
import { ENERGY_VALUE_KIND } from './types';
import { DEFAULT_TARIFF_PER_KWH } from '../../theme/branding';
import { resolveAssetCapabilities, energyInputPrompt } from '../assets/assetCapabilities';
import {
  aggregateHouseholdEnergy,
  collectElectricityBillMonths,
} from '../assets/energyIntelligence';

/** Standard month length used ONLY for reporting daily kWh from monthly estimates. */
const REPORTING_DAYS_PER_MONTH = 30;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Resolve the tariff used for the network. Prefers an explicit asset tariff,
 * otherwise falls back to the platform default. Never fabricates a tariff.
 * @param {object[]} assets
 * @returns {number}
 */
export function resolveNetworkTariff(assets = []) {
  for (const a of assets || []) {
    if (!a || a.deletedAt) continue;
    const t =
      toNumber(a.electricityTariff) ??
      toNumber(a.energyProfile?.electricityTariff) ??
      toNumber(a.energyProfile?.tariff);
    if (t != null && t > 0) return t;
  }
  return DEFAULT_TARIFF_PER_KWH;
}

/**
 * Consumption / cost share percentages (0-100). Never divides by zero.
 */
function roundShare(value, total) {
  if (!(total > 0)) return 0;
  const pct = (Number(value) / total) * 100;
  return Math.round(pct * 10) / 10;
}

/**
 * Build the estimate-vs-actual comparison from real electricity-bill data.
 * If no usable bill units exist, `available` is false and nothing is invented.
 * @returns {{ available: boolean, applianceKwh:number|null, billKwh:number|null, gapPct:number|null }}
 */
function buildEstimateVsActual(assets = []) {
  const monthly = aggregateHouseholdEnergy(assets || []);
  const applianceKwh = toNumber(monthly.estimatedMonthlyConsumptionKwh);
  const billMonths = collectElectricityBillMonths(assets || []);
  const billKwh = billMonths.length
    ? toNumber(billMonths[0].unitsKwh)
    : null;

  const usableAppliance = applianceKwh != null && applianceKwh > 0;
  const usableBill = billKwh != null && billKwh > 0;
  if (!usableAppliance || !usableBill) {
    return {
      available: false,
      applianceKwh: usableAppliance ? Math.round(applianceKwh * 10) / 10 : null,
      billKwh: usableBill ? Math.round(billKwh * 10) / 10 : null,
      gapPct: null,
    };
  }

  const gapPct = Math.round(((billKwh - applianceKwh) / billKwh) * 1000) / 10;
  return {
    available: true,
    applianceKwh: Math.round(applianceKwh * 10) / 10,
    billKwh: Math.round(billKwh * 10) / 10,
    gapPct,
  };
}

/**
 * Build the Network Intelligence view (pure, in-memory).
 *
 * @param {object[]} assets — list of asset objects (may be empty).
 * @returns {object} NIG
 */
export function buildNetworkIntelligence(assets = []) {
  const list = (assets || []).filter((a) => a && !a.deletedAt);

  // Reuse the existing energy service for all aggregate math.
  const home = aggregateHomeEnergy(list);
  const tariff = resolveNetworkTariff(list);

  // byAsset rows carry per-appliance monthly kWh/cost.
  const byAsset = home.byAsset || [];
  const totalMonthlyKwh = Math.round((home.totalMonthlyConsumptionKWh || 0) * 10) / 10;
  const totalMonthlyCost = Math.round(home.estimatedMonthlyCost || 0);
  const totalDailyKwh =
    Math.round(byAsset.reduce((sum, r) => sum + (Number(r.monthlyKWh) || 0), 0) /
      REPORTING_DAYS_PER_MONTH * 10) / 10;

  // Per-asset detail enriched with daily + share info (no energy math re-run).
  const enriched = byAsset.map((r) => {
    const dailyKwh = Math.round(((Number(r.monthlyKWh) || 0) / REPORTING_DAYS_PER_MONTH) * 10) / 10;
    const consumptionSharePct = roundShare(r.monthlyKWh, totalMonthlyKwh);
    const costSharePct = roundShare(r.monthlyCost, totalMonthlyCost);
    const caps = resolveAssetCapabilities(r.assetId ? { ...list.find((a) => (a.assetId || a.id) === r.assetId) } : {});
    return {
      assetId: r.assetId,
      displayName: r.displayName,
      roomId: r.roomId || null,
      powerWatts: r.powerWatts != null ? Number(r.powerWatts) : null,
      usageHoursPerDay: r.usageHoursPerDay != null ? Number(r.usageHoursPerDay) : null,
      monthlyKwh: Number(r.monthlyKWh) || 0,
      monthlyCost: Number(r.monthlyCost) || 0,
      dailyKwh,
      monthlyCostInr: Number(r.monthlyCost) || 0,
      consumptionSharePct,
      costSharePct,
      isEstimate: r.isEstimate !== false && r.valueKind !== ENERGY_VALUE_KIND.ACTUAL,
      isActual: r.valueKind === ENERGY_VALUE_KIND.ACTUAL,
      valueKind: r.valueKind || ENERGY_VALUE_KIND.ESTIMATED,
      needsEnergyInputs: caps.needsEnergyInputs,
    };
  });

  // byRoom aggregations — daily derived from monthly, no formula re-run.
  const byRoom = (home.byRoom || []).map((room) => {
    const roomMonthlyKwh = Math.round((Number(room.monthlyKWh) || 0) * 10) / 10;
    return {
      roomId: room.roomId || null,
      displayName: room.roomId || 'Unassigned',
      monthlyKwh: roomMonthlyKwh,
      monthlyCost: Math.round(room.monthlyCost || 0),
      dailyKwh: Math.round((roomMonthlyKwh / REPORTING_DAYS_PER_MONTH) * 10) / 10,
      consumptionSharePct: roundShare(roomMonthlyKwh, totalMonthlyKwh),
      costSharePct: roundShare(room.monthlyCost, totalMonthlyCost),
      assetCount: (room.assets || []).length,
    };
  }).sort((a, b) => b.monthlyKwh - a.monthlyKwh);

  // topConsumers (already sorted by kWh by HomeEnergyService)
  const topConsumers = enriched
    .slice()
    .sort((a, b) => (b.monthlyKwh || 0) - (a.monthlyKwh || 0));
  const highestConsumer = topConsumers[0] || null;

  // Assets that still need energy inputs — derived from the canonical capability
  // model so both missing wattage and missing usage hours are flagged (no math invented).
  const needingInputs = list
    .filter((a) => {
      const caps = resolveAssetCapabilities(a);
      return caps.supportsEnergyTracking && caps.needsEnergyInputs;
    })
    .map((a) => ({
      assetId: a.assetId || a.id,
      displayName: a.nickname || a.customAssetName || a.assetName || 'Asset',
      roomId: a.roomId || a.locationId || null,
      prompt:
        energyInputPrompt(a) || 'Add rated wattage and daily usage hours to estimate energy.',
    }));

  // Estimate vs actual electricity-bill reconciliation (real bills only).
  const estimateVsActual = buildEstimateVsActual(list);

  const hasConsumption = totalMonthlyKwh > 0;

  return {
    // Identity / scope
    assetCount: list.length,
    applianceCount: list.length,
    assetsWithEnergy: home.assetsWithEnergy || 0,
    assetsNeedingInputs: needingInputs.length,

    // Aggregate estimates (always labelled ESTIMATED — derived, not metered)
    isEstimate: true,
    valueKind: ENERGY_VALUE_KIND.ESTIMATED,
    displayPrefix: '~',
    calculationLabel: 'Estimated home energy (usage assumptions apply)',
    formula: 'Monthly kWh = (W/1000) × Hours/Day × Days/Month',

    totalDailyKwh,
    totalMonthlyKwh,
    totalMonthlyCost,
    estimatedMonthlyConsumptionKwh: totalMonthlyKwh,
    estimatedMonthlyCost: totalMonthlyCost,
    tariffResolved: {
      value: tariff,
      unit: '₹/kWh',
      source:
        list.some((a) => toNumber(a.electricityTariff) > 0 || toNumber(a.energyProfile?.electricityTariff) > 0)
          ? 'asset-electricity-tariff'
          : 'platform-default',
      isDefault: !list.some((a) => toNumber(a.electricityTariff) > 0 || toNumber(a.energyProfile?.electricityTariff) > 0),
    },

    // Breakdowns
    byRoom,
    byAsset: enriched,
    topConsumers,
    highestConsumer,

    // Missing-data queue (never fabricated numbers)
    needingInputs,

    // Reconciliation with real bill data when it exists
    estimateVsActual,

    // Lightweight status flags for callers
    hasConsumption,
    hasAnyAssets: list.length > 0,
    empty: list.length === 0,
  };
}

const NetworkIntelligenceService = {
  build: buildNetworkIntelligence,
  resolveTariff: resolveNetworkTariff,
};

export default NetworkIntelligenceService;

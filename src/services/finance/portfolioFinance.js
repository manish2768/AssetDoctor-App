/**
 * Portfolio finance aggregation — single source for dashboard numbers.
 * Distinguishes purchase / estimated current / actual expense totals.
 */

import { getAssetFolderType } from '../../utils/assetFolders';
import { computePortfolioHealth } from '../health/computeAssetHealth';
import {
  resolvePurchasePrice,
  resolveCurrentEstimatedValue,
  calculateAssetAge,
} from './valuationEngine';
import { computeAssetOwnershipCost, computeCostPerPeriod } from './ownershipCostEngine';
import { computeProfileCompleteness } from './completenessScore';
import { buildEnergyCostDashboard } from './energyCostAnalytics';
import { CURRENCY_INR, formatInr } from './financeConstants';
import { resolveReplacementFlag } from './lifecycleAnalytics';
import { calculateHealthScore } from '../../utils/healthScore';
import { summarizeRepairFrequency } from './ownershipCostEngine';

const FOLDER_LABEL = {
  vehicle: 'Vehicles',
  appliances: 'Home Appliances',
  gadgets: 'Gadgets',
  documents: 'Documents',
  other: 'Other',
};

/**
 * Per-asset finance snapshot (offline-safe, pure).
 */
export function buildAssetFinanceSnapshot(asset = {}, opts = {}) {
  if (!asset || asset.deletedAt) return null;
  const id = asset.assetId || asset.id;
  const expenseRows =
    opts.expenseRows ||
    (opts.expenseRowsByAsset && id ? opts.expenseRowsByAsset[id] : null) ||
    null;
  const localOpts = { ...opts, expenseRows: expenseRows || undefined };
  const purchase = resolvePurchasePrice(asset);
  const current = resolveCurrentEstimatedValue(asset);
  const ownership = computeAssetOwnershipCost(asset, localOpts);
  const period = computeCostPerPeriod(ownership, asset);
  const completeness = computeProfileCompleteness(asset);
  const age = calculateAssetAge(asset);
  const folder = getAssetFolderType(asset);

  return {
    assetId: id,
    name: asset.nickname || asset.assetName || 'Asset',
    categoryId: asset.categoryId,
    folder,
    folderLabel: FOLDER_LABEL[folder] || 'Other',
    currencyCode: asset.currencyCode || CURRENCY_INR,
    purchase,
    currentEstimated: current,
    ownership,
    period,
    completeness,
    age,
  };
}

/**
 * Full portfolio dashboard DTO.
 * Method: sums purchase & estimated current independently from expense rollups.
 * Portfolio health: average of per-asset health scores (documented).
 */
export function buildPortfolioFinance(assets = [], opts = {}) {
  const list = (assets || []).filter((a) => {
    if (!a || a.deletedAt) return false;
    if (!opts.actorUserId) return true;
    const owner = a.ownerUid || a.uid;
    if (!owner || opts.actorUserId === owner) return true;
    const ownership = String(a.ownershipType || 'PERSONAL').toUpperCase();
    if (ownership === 'PERSONAL' || !a.householdId) return false;
    return true;
  });
  const snapshots = list
    .map((a) =>
      buildAssetFinanceSnapshot(a, {
        ...opts,
        expenseRows:
          opts.expenseRowsByAsset?.[a.assetId || a.id] || opts.expenseRows || undefined,
      }),
    )
    .filter(Boolean);

  let purchaseValue = 0;
  let purchaseKnown = 0;
  let currentEstimatedValue = 0;
  let currentKnown = 0;
  let maintenance = 0;
  let repairs = 0;
  let insurance = 0;
  let energy = 0;
  let accessories = 0;
  let other = 0;
  let ownershipTotal = 0;

  const byCategory = {};

  for (const s of snapshots) {
    if (s.purchase.available) {
      purchaseValue += s.purchase.value;
      purchaseKnown += 1;
    }
    if (s.currentEstimated.available) {
      currentEstimatedValue += s.currentEstimated.value;
      currentKnown += 1;
    }
    maintenance += s.ownership.service || 0;
    repairs += s.ownership.repair || 0;
    insurance += s.ownership.insurance || 0;
    energy += s.ownership.energy || 0;
    accessories += s.ownership.accessories || 0;
    other += (s.ownership.other || 0) + (s.ownership.fuel || 0) + (s.ownership.charging || 0);
    ownershipTotal += s.ownership.totalOwnershipCost || 0;

    const key = s.folder || 'other';
    if (!byCategory[key]) {
      byCategory[key] = {
        folder: key,
        label: s.folderLabel,
        count: 0,
        purchaseValue: 0,
        currentEstimatedValue: 0,
        ownershipCost: 0,
      };
    }
    byCategory[key].count += 1;
    if (s.purchase.available) byCategory[key].purchaseValue += s.purchase.value;
    if (s.currentEstimated.available) {
      byCategory[key].currentEstimatedValue += s.currentEstimated.value;
    }
    byCategory[key].ownershipCost += s.ownership.totalOwnershipCost || 0;
  }

  const health = computePortfolioHealth(list);
  // Documented method: arithmetic mean of asset health scores (empty → 100).
  const portfolioHealth = {
    ...health,
    method:
      'Arithmetic mean of individual Asset Health Scores (0–100). Empty portfolio = 100. Critical <40, Attention 40–74, Healthy ≥75.',
  };

  const energyDash = buildEnergyCostDashboard(list, opts);

  let requiringAttention = 0;
  let nearReplacement = 0;
  let monthlyMaintenance = 0;
  for (const a of list) {
    const id = a.assetId || a.id;
    const expenseRows = opts.expenseRowsByAsset?.[id] || [];
    const health = calculateHealthScore(a);
    const freq = summarizeRepairFrequency(expenseRows);
    const snap = snapshots.find((s) => s.assetId === id);
    const flag = resolveReplacementFlag(a, {
      age: snap?.age,
      repairFrequency: { last12Months: freq.numberOfRepairs || 0 },
      period: snap?.period,
      repairVsReplace: {},
    });
    if (flag === 'REVIEW_REPLACEMENT' || flag === 'WATCH') nearReplacement += 1;
    if ((health?.score != null && health.score < 75) || flag !== 'NORMAL') requiringAttention += 1;
    if (snap?.period?.available) monthlyMaintenance += snap.period.costPerMonth || 0;
  }

  const top = {
    highestValue: [...snapshots]
      .filter((s) => s.currentEstimated.available)
      .sort((a, b) => b.currentEstimated.value - a.currentEstimated.value)
      .slice(0, 5),
    highestMaintenance: [...snapshots]
      .sort(
        (a, b) =>
          b.ownership.service +
          b.ownership.repair -
          (a.ownership.service + a.ownership.repair),
      )
      .slice(0, 5),
    lowestCompleteness: [...snapshots]
      .sort((a, b) => a.completeness.percent - b.completeness.percent)
      .slice(0, 5),
  };

  return {
    currencyCode: CURRENCY_INR,
    totalAssets: list.length,
    // Keep these three families separate
    purchaseValue: Math.round(purchaseValue),
    purchaseKnownCount: purchaseKnown,
    purchaseLabel: 'Purchase Value',
    currentEstimatedValue: Math.round(currentEstimatedValue),
    currentKnownCount: currentKnown,
    currentLabel: 'Estimated Current Value',
    currentIsEstimate: true,
    expenses: {
      maintenance: Math.round(maintenance),
      repairs: Math.round(repairs),
      insurance: Math.round(insurance),
      energy: Math.round(energy),
      accessories: Math.round(accessories),
      other: Math.round(other),
      label: 'Actual / recorded expenses (where logged)',
    },
    totalOwnershipCost: Math.round(ownershipTotal),
    ownershipLabel: 'Total Ownership Cost',
    monthlyMaintenanceCost: Math.round(monthlyMaintenance),
    annualMaintenanceCost: Math.round(monthlyMaintenance * 12),
    assetsRequiringAttention: requiringAttention,
    assetsNearReplacement: nearReplacement,
    byCategory: Object.values(byCategory).sort((a, b) => b.purchaseValue - a.purchaseValue),
    portfolioHealth,
    energy: energyDash,
    top,
    snapshots,
    formatInr,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Monthly expense summary from expense rows (optional).
 */
export function summarizeMonthlyExpenses(expenseRows = [], now = new Date()) {
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const buckets = {
    service: 0,
    repair: 0,
    energy: 0,
    insurance: 0,
    other: 0,
  };
  for (const row of expenseRows || []) {
    const date = String(row.repairDate || row.date || row.serviceDate || '').slice(0, 7);
    if (date !== ym) continue;
    const amount = Number(row.costInr ?? row.cost ?? row.totalAmount) || 0;
    if (!(amount > 0)) continue;
    const cat = String(row.category || '').toLowerCase();
    if (/service/.test(cat)) buckets.service += amount;
    else if (/repair/.test(cat)) buckets.repair += amount;
    else if (/energy|power|electric/.test(cat)) buckets.energy += amount;
    else if (/insurance/.test(cat)) buckets.insurance += amount;
    else buckets.other += amount;
  }
  const total = Object.values(buckets).reduce((s, n) => s + n, 0);
  return {
    month: ym,
    ...Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, Math.round(v)])),
    total: Math.round(total),
  };
}

export function detectExpenseAnomaly(currentTotal, historicalAverage) {
  const cur = Number(currentTotal) || 0;
  const avg = Number(historicalAverage) || 0;
  if (!(avg > 0) || !(cur > 0)) return null;
  const pct = ((cur - avg) / avg) * 100;
  if (Math.abs(pct) < 25) return null;
  return {
    current: Math.round(cur),
    average: Math.round(avg),
    changePercent: Math.round(pct * 10) / 10,
    message:
      pct > 0
        ? 'Asset-related spending is higher than your recent average.'
        : 'Asset-related spending is lower than your recent average.',
  };
}

export default {
  buildAssetFinanceSnapshot,
  buildPortfolioFinance,
  summarizeMonthlyExpenses,
  detectExpenseAnomaly,
};

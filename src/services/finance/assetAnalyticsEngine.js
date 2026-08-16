/**
 * STEP 10 — Asset Analytics Engine
 * Pure functions over real asset + RepairLog rows. Never invents financial values.
 */

import { formatInr, VALUE_SOURCE, CURRENCY_INR, EXPENSE_BUCKET as BUCKET } from './financeConstants';
import {
  resolvePurchasePrice,
  resolveCurrentEstimatedValue,
  calculateConfigurableDepreciation,
  calculateAssetAge,
} from './valuationEngine';
import {
  computeAssetOwnershipCost,
  computeCostPerPeriod,
  computeCostPerUse,
  evaluateRepairVsReplace,
  categorizeExpenseRow,
} from './ownershipCostEngine';
import { computeProfileCompleteness } from './completenessScore';
import {
  resolveReplacementFlag,
  buildLifecycleReport,
} from './lifecycleAnalytics';
import { calculateHealthScore } from '../../utils/healthScore';
import {
  filterRowsByDateRange,
  buildMonthlyCostSeries,
  ANALYTICS_DATE_RANGES,
} from './dateRangeFilter';

/**
 * Ownership Cost Score (0–100, higher = more expensive to own).
 * Documented formula:
 *   score = clamp(0..100,
 *     0.40 * monthlyCostNorm +
 *     0.30 * repairFreqNorm +
 *     0.20 * ageNorm +
 *     0.10 * trendPenalty
 *   )
 * monthlyCostNorm: min(monthlyCost / 10000, 1) * 100
 * repairFreqNorm: min(repairs12 / 6, 1) * 100
 * ageNorm: min(ageYears / 10, 1) * 100
 * trendPenalty: 100 if increasing, 50 stable, 0 decreasing/unknown
 * Bands: Low <35, Moderate 35–64, High ≥65
 */
export function computeOwnershipCostScore({ period, repairFrequency, age, costTrend } = {}) {
  const monthly = Number(period?.costPerMonth) || 0;
  const repairs12 = Number(repairFrequency?.last12Months) || 0;
  const ageYears = Number(age?.years) || 0;
  const monthlyNorm = Math.min(monthly / 10000, 1) * 100;
  const repairNorm = Math.min(repairs12 / 6, 1) * 100;
  const ageNorm = Math.min(ageYears / 10, 1) * 100;
  const trendPenalty =
    costTrend === 'Increasing' ? 100 : costTrend === 'Stable' ? 50 : costTrend === 'Decreasing' ? 0 : 40;
  const score = Math.round(
    Math.min(100, Math.max(0, 0.4 * monthlyNorm + 0.3 * repairNorm + 0.2 * ageNorm + 0.1 * trendPenalty)),
  );
  const band = score >= 65 ? 'High' : score >= 35 ? 'Moderate' : 'Low';
  return {
    score,
    band,
    formula:
      '0.40×monthlyNorm + 0.30×repairFreqNorm + 0.20×ageNorm + 0.10×trendPenalty (documented)',
    available: Boolean(period?.available || repairs12 || age?.available),
  };
}

/**
 * Health vs Cost quadrant — configurable thresholds.
 */
export function resolveHealthVsCost(healthScore, ownershipBand, opts = {}) {
  const highHealth = Number(opts.highHealth) || 75;
  const highCost = ownershipBand === 'High';
  const healthy = Number.isFinite(healthScore) && healthScore >= highHealth;
  if (healthy && !highCost) return { label: 'Excellent', code: 'HIGH_HEALTH_LOW_COST' };
  if (healthy && highCost) return { label: 'Expensive but healthy', code: 'HIGH_HEALTH_HIGH_COST' };
  if (!healthy && !highCost) return { label: 'Monitor', code: 'LOW_HEALTH_LOW_COST' };
  return { label: 'Replacement Candidate', code: 'LOW_HEALTH_HIGH_COST' };
}

export function analyzeMaintenanceTrend(expenseRows = [], now = new Date()) {
  const months = {};
  for (const row of expenseRows || []) {
    const cat = categorizeExpenseRow(row);
    if (!cat || !cat.date) continue;
    const key = String(cat.date).slice(0, 7); // YYYY-MM
    if (!months[key]) months[key] = 0;
    months[key] += cat.amount;
  }
  const keys = Object.keys(months).sort();
  if (keys.length < 2) {
    return {
      available: false,
      trend: 'Insufficient data',
      last12Months: { service: 0, repair: 0, maintenance: 0, total: 0 },
      monthlySeries: [],
    };
  }
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 12);
  let service = 0;
  let repair = 0;
  let maintenance = 0;
  for (const row of expenseRows || []) {
    const cat = categorizeExpenseRow(row);
    if (!cat?.date) continue;
    const d = new Date(`${String(cat.date).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()) || d < cutoff) continue;
    if (cat.bucket === BUCKET.SERVICE) service += cat.amount;
    else if (cat.bucket === BUCKET.REPAIR) repair += cat.amount;
    else maintenance += cat.amount;
  }
  const half = Math.floor(keys.length / 2);
  const first = keys.slice(0, half).reduce((s, k) => s + months[k], 0) / Math.max(half, 1);
  const second =
    keys.slice(half).reduce((s, k) => s + months[k], 0) / Math.max(keys.length - half, 1);
  let trend = 'Stable';
  if (second > first * 1.15) trend = 'Increasing';
  else if (second < first * 0.85) trend = 'Decreasing';

  return {
    available: true,
    trend,
    last12Months: {
      service: Math.round(service),
      repair: Math.round(repair),
      maintenance: Math.round(maintenance),
      total: Math.round(service + repair + maintenance),
    },
    monthlySeries: keys.map((k) => ({ month: k, total: months[k], source: 'Actual Recorded' })),
  };
}

export function analyzeRepairFrequency(expenseRows = [], now = new Date()) {
  const isRepair = (row) => {
    const cat = categorizeExpenseRow(row);
    return cat && cat.bucket === BUCKET.REPAIR;
  };
  const inWindow = (row, days) => {
    const d = String(row.repairDate || row.date || '').slice(0, 10);
    if (!d) return false;
    const age = (now.getTime() - new Date(`${d}T12:00:00`).getTime()) / 86400000;
    return age >= 0 && age <= days;
  };
  const last3 = expenseRows.filter((r) => isRepair(r) && inWindow(r, 90)).length;
  const last6 = expenseRows.filter((r) => isRepair(r) && inWindow(r, 180)).length;
  const last12 = expenseRows.filter((r) => isRepair(r) && inWindow(r, 365)).length;
  const prev12 = expenseRows.filter((r) => {
    if (!isRepair(r)) return false;
    const d = String(r.repairDate || r.date || '').slice(0, 10);
    if (!d) return false;
    const age = (now.getTime() - new Date(`${d}T12:00:00`).getTime()) / 86400000;
    return age > 365 && age <= 730;
  }).length;

  return {
    last3Months: last3,
    last6Months: last6,
    last12Months: last12,
    previous12Months: prev12,
    message:
      last12 > 0
        ? `${last12} repair${last12 === 1 ? '' : 's'} in last 12 months`
        : 'No repair records in last 12 months',
    source: 'Actual Recorded',
  };
}

/**
 * Maintenance / service frequency from actual service-like records + asset fields.
 */
export function analyzeMaintenanceFrequency(asset = {}, expenseRows = [], now = new Date()) {
  const isService = (row) => {
    const cat = categorizeExpenseRow(row);
    return (
      cat &&
      (cat.bucket === BUCKET.SERVICE ||
        /maintenance|amc|service/i.test(String(row.category || '')))
    );
  };
  const dates = (expenseRows || [])
    .filter(isService)
    .map((r) => String(r.repairDate || r.serviceDate || r.date || '').slice(0, 10))
    .filter(Boolean)
    .sort();

  const lastFromRows = dates.length ? dates[dates.length - 1] : null;
  const lastService = lastFromRows || asset.lastServiceDate || null;
  const nextService = asset.nextServiceDue || null;
  const numberOfServices = dates.length;

  let averageIntervalDays = null;
  if (dates.length >= 2) {
    let sum = 0;
    for (let i = 1; i < dates.length; i += 1) {
      const a = new Date(`${dates[i - 1]}T12:00:00`).getTime();
      const b = new Date(`${dates[i]}T12:00:00`).getTime();
      sum += Math.max(0, (b - a) / 86400000);
    }
    averageIntervalDays = Math.round(sum / (dates.length - 1));
  }

  if (numberOfServices < 2 && !lastService && !nextService) {
    return {
      available: false,
      lastService: null,
      nextService: null,
      numberOfServices: 0,
      averageIntervalDays: null,
      message: 'Insufficient service history',
      source: 'Actual Recorded',
    };
  }

  return {
    available: true,
    lastService,
    nextService,
    numberOfServices,
    averageIntervalDays,
    message:
      numberOfServices >= 2
        ? `${numberOfServices} services · avg ${averageIntervalDays} days apart`
        : numberOfServices === 1
          ? '1 service recorded'
          : lastService || nextService
            ? 'Service dates from asset record'
            : 'Insufficient service history',
    source: 'Actual Recorded',
  };
}

function resolveCategoryProfile(asset = {}) {
  const id = String(asset.categoryId || asset.category || '').toLowerCase();
  if (['car', 'bike', 'scooter', 'ev', 'commercial'].includes(id)) {
    return id === 'ev' ? 'ev' : 'vehicle';
  }
  if (['mobile', 'laptop', 'tablet', 'smartwatch', 'camera'].includes(id)) return 'gadget';
  if (
    [
      'ac',
      'fridge',
      'refrigerator',
      'washing_machine',
      'tv',
      'geyser',
      'microwave',
      'water_purifier',
      'air_purifier',
    ].includes(id)
  ) {
    return 'appliance';
  }
  return 'other';
}

function dataQualityWarnings(asset, purchase, age, expenseRows) {
  const warnings = [];
  if (!purchase.available) warnings.push({ code: 'MISSING_PURCHASE_PRICE', message: 'Purchase price missing' });
  if (!age.available) warnings.push({ code: 'MISSING_PURCHASE_DATE', message: 'Purchase date missing' });
  if (!asset.warrantyExpiry) warnings.push({ code: 'MISSING_WARRANTY', message: 'Warranty missing' });
  if (!(expenseRows || []).length) {
    warnings.push({ code: 'INCOMPLETE_SERVICE_HISTORY', message: 'Service history incomplete' });
  }
  if (!asset.energyProfile?.estimatedMonthlyCost && !asset.powerWatts) {
    warnings.push({ code: 'ENERGY_UNAVAILABLE', message: 'Energy data unavailable' });
  }
  return warnings;
}

/**
 * Full per-asset analytics DTO — offline-safe when expenseRows provided from cache.
 */
export function buildAssetAnalytics(asset = {}, opts = {}) {
  if (!asset || asset.deletedAt) return null;
  const rangeKey = opts.dateRange || ANALYTICS_DATE_RANGES.ALL;
  const now = opts.now || new Date();
  const rangeResult = filterRowsByDateRange(
    opts.expenseRows || [],
    rangeKey,
    now,
    opts.customRange || {},
  );
  const expenseRows = rangeResult.rows;
  const userId = opts.userId || asset.ownerUid || asset.uid;

  // Security: caller must only pass authorized assets
  if (opts.actorUserId && userId && opts.actorUserId !== userId) {
    const ownership = String(asset.ownershipType || 'PERSONAL').toUpperCase();
    if (ownership === 'PERSONAL' || !asset.householdId) {
      return { available: false, error: 'UNAUTHORIZED', assetId: asset.assetId || asset.id };
    }
  }

  const purchase = resolvePurchasePrice(asset);
  const current = resolveCurrentEstimatedValue(asset);
  const depreciation = calculateConfigurableDepreciation(asset, opts);
  const age = calculateAssetAge(asset, now);
  const ownership = computeAssetOwnershipCost(asset, { ...opts, expenseRows });
  const period = computeCostPerPeriod(ownership, asset);
  const costPerUse = computeCostPerUse(asset, ownership);
  const completeness = computeProfileCompleteness(asset);
  const health = calculateHealthScore(asset);
  const repairFrequency = analyzeRepairFrequency(expenseRows, now);
  const maintenanceFrequency = analyzeMaintenanceFrequency(asset, expenseRows, now);
  const maintenanceTrend = analyzeMaintenanceTrend(expenseRows, now);
  const chartMonths =
    rangeKey === ANALYTICS_DATE_RANGES.LAST_3_MONTHS
      ? 3
      : rangeKey === ANALYTICS_DATE_RANGES.LAST_6_MONTHS
        ? 6
        : rangeKey === ANALYTICS_DATE_RANGES.ALL
          ? null
          : 12;
  const costTrendSeries = buildMonthlyCostSeries(expenseRows, chartMonths, now);
  const categoryProfile = resolveCategoryProfile(asset);

  const lastRepairCost = expenseRows
    .map(categorizeExpenseRow)
    .filter((r) => r && r.bucket === BUCKET.REPAIR)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]?.amount;

  const repairVsReplace = evaluateRepairVsReplace(asset, {
    repairCost: lastRepairCost || asset.lastRepairCost,
    repairCount: repairFrequency.last12Months,
  });

  const lifecycle = buildLifecycleReport(asset, {
    expenseRows,
    services: opts.services || [],
    analytics: { age, repairFrequency, period, repairVsReplace },
  });

  const ownershipScore = computeOwnershipCostScore({
    period,
    repairFrequency,
    age,
    costTrend: maintenanceTrend.trend,
  });

  const healthVsCost = resolveHealthVsCost(
    health?.score ?? asset.assetHealthScore,
    ownershipScore.band,
  );

  const replacementFlag = resolveReplacementFlag(
    asset,
    { age, repairFrequency, period, repairVsReplace },
    opts,
  );

  const warnings = dataQualityWarnings(asset, purchase, age, expenseRows);

  const breakdown = {
    purchase: {
      value: purchase.available ? purchase.value : null,
      available: purchase.available,
      source: purchase.available ? 'User Entered / Actual Recorded' : 'Not available',
      label: 'Purchase',
    },
    service: {
      value: ownership.service,
      available: true,
      source: ownership.sources?.expenses || 'Actual Recorded',
      label: 'Service',
    },
    repair: {
      value: ownership.repair,
      available: true,
      source: ownership.sources?.expenses || 'Actual Recorded',
      label: 'Repair',
    },
    insurance: {
      value: ownership.insurance,
      available: true,
      source: 'Actual Recorded / User Entered',
      label: 'Insurance',
    },
    maintenance: {
      value: Math.round(ownership.other || 0),
      available: true,
      source: 'Actual Recorded',
      label: 'Maintenance',
    },
    other: {
      value: Math.round(
        (ownership.accessories || 0) +
          (ownership.fuel || 0) +
          (ownership.charging || 0) +
          (ownership.energy || 0),
      ),
      available: true,
      source: 'Actual Recorded',
      label: 'Other',
    },
    total: {
      value: ownership.totalOwnershipCost,
      available: true,
      source: 'Calculated from recorded totals',
      label: 'Total Ownership Cost',
    },
  };

  return {
    available: true,
    assetId: asset.assetId || asset.id,
    name: asset.nickname || asset.assetName || 'Asset',
    categoryId: asset.categoryId,
    currencyCode: asset.currencyCode || CURRENCY_INR,
    formatInr,
    purchase,
    currentEstimated: {
      ...current,
      marketValueLabel:
        current.valueSource === VALUE_SOURCE.EXTERNAL_SOURCE
          ? 'Market Value'
          : current.available
            ? 'Estimated value'
            : 'Market value unavailable',
    },
    depreciation,
    age,
    ownership,
    period,
    costPerUse,
    breakdown,
    completeness,
    health: {
      score: health?.score ?? asset.assetHealthScore ?? null,
      band: health?.band || health?.grade || null,
      source: 'Asset Health Score engine',
    },
    battery: asset.batteryProfile
      ? {
          healthPercent: asset.batteryProfile.healthPercent ?? null,
          isEstimate: asset.batteryProfile.isEstimate === true,
          source: asset.batteryProfile.isEstimate ? 'Calculated Estimate' : 'Actual Recorded',
        }
      : { healthPercent: null, label: 'No data available' },
    energy: asset.energyProfile
      ? {
          estimatedMonthlyCost: asset.energyProfile.estimatedMonthlyCost ?? null,
          isEstimate: true,
          label: 'Estimated Energy Cost',
          source: 'Calculated Estimate',
        }
      : { estimatedMonthlyCost: null, label: 'Energy data unavailable' },
    charging:
      asset.energyProfile?.estimatedCostPerCharge != null
        ? {
            value: asset.energyProfile.estimatedCostPerCharge,
            isEstimate: true,
            source: 'Calculated Estimate',
          }
        : { label: 'Charging cost data unavailable' },
    repairFrequency,
    maintenanceFrequency,
    maintenanceTrend,
    costTrendSeries,
    dateRange: {
      key: rangeKey,
      label: rangeResult.bounds.label,
      filtered: rangeResult.filtered,
    },
    categoryProfile,
    warranty: {
      start: asset.warrantyStart || asset.purchaseDate || null,
      end: asset.warrantyExpiry || null,
      remainingDays: asset.warrantyExpiry
        ? Math.round(
            (new Date(`${String(asset.warrantyExpiry).slice(0, 10)}T12:00:00`).getTime() -
              now.getTime()) /
              86400000,
          )
        : null,
      source: asset.warrantyExpiry ? 'User Entered / Actual Recorded' : 'Not available',
    },
    vehicleExtras:
      categoryProfile === 'vehicle' || categoryProfile === 'ev'
        ? {
            insuranceExpiry: asset.insuranceExpiry || null,
            pucExpiry: asset.pucExpiry || null,
            registration: asset.registration || asset.vehicleNumber || null,
            odometerKm: asset.odometerKm != null ? Number(asset.odometerKm) : null,
          }
        : null,
    serviceHistoryNote:
      maintenanceFrequency.available && maintenanceFrequency.numberOfServices >= 2
        ? null
        : maintenanceFrequency.message || 'Insufficient service history',
    repairVsReplace: {
      ...repairVsReplace,
      advisory:
        repairVsReplace.advice === 'COMPARE_REPLACEMENT'
          ? 'Replacement may be worth considering.'
          : repairVsReplace.message,
    },
    lifecycle,
    ownershipScore,
    healthVsCost,
    replacementFlag,
    warnings,
    offlineReady: true,
  };
}

export function compareAssets(assets = [], opts = {}) {
  const rows = (assets || [])
    .map((a) =>
      buildAssetAnalytics(a, {
        ...opts,
        expenseRows: opts.expenseRowsByAsset?.[a.assetId || a.id] || [],
      }),
    )
    .filter((r) => r?.available);
  return {
    count: rows.length,
    rows: rows.map((r) => ({
      assetId: r.assetId,
      name: r.name,
      health: r.health.score,
      purchase: r.purchase.available ? r.purchase.value : null,
      estimatedValue: r.currentEstimated.available ? r.currentEstimated.value : null,
      ownershipCost: r.ownership.totalOwnershipCost,
      repairCost: r.breakdown.repair.value,
      ageLabel: r.age.label,
      warranty: r.warranty?.end || null,
      energyEstimate: r.energy.estimatedMonthlyCost,
      replacementFlag: r.replacementFlag,
    })),
  };
}

export default {
  buildAssetAnalytics,
  compareAssets,
  computeOwnershipCostScore,
  resolveHealthVsCost,
  analyzeMaintenanceTrend,
  analyzeRepairFrequency,
  analyzeMaintenanceFrequency,
};

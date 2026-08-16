/**
 * Ownership / expense cost engine — deterministic, traceable to stored totals.
 * Does not invent expenses. Missing buckets = 0 only when explicitly rolled up or provided.
 */

import { computeOwnershipCost as baseOwnership, repairVsReplaceInsight } from '../health/ownershipCost';
import { resolvePurchasePrice, resolveCurrentEstimatedValue, calculateAssetAge } from './valuationEngine';
import { CURRENCY_INR, REPAIR_ADVICE, EXPENSE_BUCKET } from './financeConstants';

/**
 * Normalize expense rows (RepairLogs / serviceHistory) into buckets.
 */
export function categorizeExpenseRow(row = {}) {
  const cat = String(row.category || row.serviceType || row.title || '').toLowerCase();
  const amount = Number(row.costInr ?? row.totalAmount ?? row.cost ?? row.amount) || 0;
  if (!(amount > 0)) return null;
  let bucket = EXPENSE_BUCKET.OTHER;
  if (/service|amc|periodic|job\s*card/.test(cat)) bucket = EXPENSE_BUCKET.SERVICE;
  else if (/repair|spare|gas\s*charg|labour|labor/.test(cat)) bucket = EXPENSE_BUCKET.REPAIR;
  else if (/insurance|premium|idv/.test(cat)) bucket = EXPENSE_BUCKET.INSURANCE;
  else if (/energy|electric|power|bill/.test(cat)) bucket = EXPENSE_BUCKET.ENERGY;
  else if (/fuel|petrol|diesel|cng/.test(cat)) bucket = EXPENSE_BUCKET.FUEL;
  else if (/charg/.test(cat)) bucket = EXPENSE_BUCKET.CHARGING;
  else if (/accessor|helmet|cover|case|charger/.test(cat)) bucket = EXPENSE_BUCKET.ACCESSORIES;
  else if (/service_history|maintenance/.test(cat)) bucket = EXPENSE_BUCKET.SERVICE;
  return {
    bucket,
    amount: Math.round(amount),
    date: row.repairDate || row.serviceDate || row.date || null,
    id: row.id || row.repairId || row.historyId || null,
  };
}

export function sumExpenseBuckets(rows = []) {
  const totals = {
    service: 0,
    repair: 0,
    insurance: 0,
    energy: 0,
    accessories: 0,
    fuel: 0,
    charging: 0,
    other: 0,
  };
  let count = 0;
  for (const row of rows || []) {
    const cat = categorizeExpenseRow(row);
    if (!cat) continue;
    totals[cat.bucket] = (totals[cat.bucket] || 0) + cat.amount;
    count += 1;
  }
  return { ...totals, expenseCount: count };
}

/**
 * Asset ownership cost — prefer persisted rollups, else expense rows, else zeros.
 */
export function computeAssetOwnershipCost(asset = {}, opts = {}) {
  const purchase = resolvePurchasePrice(asset);
  const fromRows = opts.expenseRows ? sumExpenseBuckets(opts.expenseRows) : null;

  const service =
    Number(opts.serviceCost ?? asset.serviceCostTotal ?? fromRows?.service) || 0;
  const repair =
    Number(opts.repairCost ?? asset.repairCostTotal ?? fromRows?.repair) || 0;
  const insurance =
    Number(
      opts.insuranceCost ??
        asset.insurancePremiumTotal ??
        asset.annualInsurancePremium ??
        fromRows?.insurance,
    ) || 0;
  const accessories =
    Number(opts.accessoriesCost ?? asset.accessoriesCostTotal ?? fromRows?.accessories) || 0;
  const energy =
    Number(opts.energyCost ?? asset.energyCostTotal ?? fromRows?.energy) || 0;
  const fuel = Number(opts.fuelCost ?? asset.fuelCostTotal ?? fromRows?.fuel) || 0;
  const charging =
    Number(opts.chargingCost ?? asset.chargingCostTotal ?? fromRows?.charging) || 0;
  const other =
    Number(opts.otherCost ?? asset.otherCostTotal ?? fromRows?.other) || 0;

  const base = baseOwnership(asset, {
    serviceCost: service,
    repairCost: repair + fuel + charging, // keep base engine simple; we expose detailed buckets below
    insuranceCost: insurance,
    accessoriesCost: accessories,
    energyCost: energy,
    otherCost: other,
  });

  const totalOwnershipCost = Math.round(
    (purchase.available ? purchase.value : 0) +
      service +
      repair +
      insurance +
      accessories +
      energy +
      fuel +
      charging +
      other,
  );

  return {
    currencyCode: asset.currencyCode || CURRENCY_INR,
    purchase: purchase.available ? purchase.value : 0,
    purchaseAvailable: purchase.available,
    service: Math.round(service),
    repair: Math.round(repair),
    insurance: Math.round(insurance),
    accessories: Math.round(accessories),
    energy: Math.round(energy),
    fuel: Math.round(fuel),
    charging: Math.round(charging),
    other: Math.round(other),
    totalOwnershipCost,
    label: 'Total Ownership Cost',
    // Traceability
    sources: {
      purchase: purchase.available ? 'asset.purchasePrice|value' : 'missing',
      expenses: fromRows ? 'expense_rows' : 'asset_rollups_or_zero',
    },
    legacy: base,
  };
}

/**
 * Cost per year / month — only when purchase date exists.
 */
export function computeCostPerPeriod(ownership, asset = {}) {
  const age = calculateAssetAge(asset);
  if (!age.available || !ownership?.totalOwnershipCost) {
    return {
      available: false,
      costPerYear: null,
      costPerMonth: null,
      label: 'Not available',
    };
  }
  // Avoid divide-by-zero: treat < 1 month as 1 month
  const months = Math.max(Number(age.months) || age.years * 12 || 0, 1 / 30);
  const years = Math.max(Number(age.years) || months / 12, 1 / 365);
  const costPerMonth = Math.round(ownership.totalOwnershipCost / months);
  const costPerYear = Math.round(ownership.totalOwnershipCost / years);
  return {
    available: true,
    costPerYear,
    costPerMonth,
    ownershipYears: age.years,
    ownershipMonths: age.months,
    label: 'Based on ownership duration',
    source: 'Actual Recorded ÷ ownership time',
  };
}

/**
 * Cost per use — only when data exists.
 */
export function computeCostPerUse(asset = {}, ownership = {}) {
  const odometer = Number(asset.odometerKm);
  if (Number.isFinite(odometer) && odometer > 0 && ownership.totalOwnershipCost > 0) {
    return {
      available: true,
      kind: 'per_km',
      value: Math.round((ownership.totalOwnershipCost / odometer) * 100) / 100,
      label: 'Cost per km (ownership ÷ odometer)',
      isEstimate: true,
    };
  }
  const ep = asset.energyProfile;
  if (ep?.estimatedCostPerKm != null) {
    return {
      available: true,
      kind: 'energy_per_km',
      value: Number(ep.estimatedCostPerKm),
      label: 'Estimated energy cost per km',
      isEstimate: true,
    };
  }
  if (ep?.estimatedMonthlyCost != null) {
    return {
      available: true,
      kind: 'energy_per_month',
      value: Number(ep.estimatedMonthlyCost),
      label: 'Estimated energy cost per month',
      isEstimate: true,
    };
  }
  return { available: false, value: null, label: 'Not available' };
}

/**
 * Repair vs replace advisory — never says "Replace it".
 */
export function evaluateRepairVsReplace(asset = {}, opts = {}) {
  const current = resolveCurrentEstimatedValue(asset);
  const repairCost = Number(opts.repairCost ?? asset.lastRepairCost ?? 0) || 0;
  const repairCount = Number(opts.repairCount ?? asset.repairCount ?? asset.repeatedRepairCount) || 0;
  const soft = repairVsReplaceInsight(asset, {
    repairCost,
    currentEstimatedValue: current.available ? current.value : null,
  });

  if (!current.available || !(repairCost > 0)) {
    return {
      advice: REPAIR_ADVICE.MONITOR,
      message: soft?.message || null,
      available: Boolean(soft),
    };
  }

  const ratio = repairCost / Math.max(current.value, 1);
  let advice = REPAIR_ADVICE.REPAIR;
  if (ratio >= 0.6 || repairCount >= 4) advice = REPAIR_ADVICE.COMPARE_REPLACEMENT;
  else if (ratio >= 0.35 || repairCount >= 2) advice = REPAIR_ADVICE.MONITOR;

  return {
    advice,
    available: true,
    repairCost: Math.round(repairCost),
    currentEstimatedValue: current.value,
    estimatedValueLabel: current.label,
    repairCount,
    ratio: Math.round(ratio * 100) / 100,
    message:
      advice === REPAIR_ADVICE.COMPARE_REPLACEMENT
        ? 'Repair cost is significant compared with estimated current value. Consider comparing repair and replacement options.'
        : advice === REPAIR_ADVICE.MONITOR
          ? 'Repair activity is notable. Monitor costs against estimated current value.'
          : 'Repair cost appears manageable relative to estimated current value.',
  };
}

/**
 * Repair frequency summary (12 months if dates exist).
 */
export function summarizeRepairFrequency(expenseRows = [], now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 12);
  const repairs = (expenseRows || [])
    .map(categorizeExpenseRow)
    .filter((r) => r && (r.bucket === EXPENSE_BUCKET.REPAIR || r.bucket === EXPENSE_BUCKET.SERVICE));

  const last12 = repairs.filter((r) => {
    if (!r.date) return true; // count undated toward total cautiously
    const d = new Date(`${String(r.date).slice(0, 10)}T12:00:00`);
    return !Number.isNaN(d.getTime()) && d >= cutoff;
  });

  const cost = last12.reduce((s, r) => s + r.amount, 0);
  return {
    numberOfRepairs: last12.length,
    repairCost: Math.round(cost),
    message:
      last12.length >= 3
        ? `${last12.length} service/repair records in the last 12 months.`
        : last12.length
          ? `${last12.length} service/repair record(s) in the last 12 months.`
          : null,
  };
}

export default {
  categorizeExpenseRow,
  sumExpenseBuckets,
  computeAssetOwnershipCost,
  computeCostPerPeriod,
  computeCostPerUse,
  evaluateRepairVsReplace,
  summarizeRepairFrequency,
};

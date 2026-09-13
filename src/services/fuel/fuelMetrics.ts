/**
 * Asset Doctor — Fuel Metrics calculation service (Fuel Passport & Refill card).
 *
 * Pure, deterministic, UI-free TypeScript. Reuses the existing fuel engine
 * (fuelCalculator / fuelMilestone) so this service stays the single source of
 * truth for:
 *   - Trip distance / mileage / running cost
 *   - Fuel efficiency verdict (SUPER SAVER / BALANCED / HEAVY THROTTLE)
 *   - City-average comparison
 *   - Monthly aggregation (chronological odometer)
 *
 * All mileage values are guarded so corrupted / partial fuel data can NEVER
 * produce a misleading number. Missing litres → mileage shows "--".
 *
 * Storage: Users/{uid}/Assets/{assetId}/fuelLogs/{logId}
 */

import {
  MAX_PLAUSIBLE_MILEAGE,
  resolveFuelVehicleType,
  thresholdsForVehicleType,
} from '../../utils/fuelMilestone';
import { isVehicleAsset } from '../../domain/asset/assetGuards';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FuelLog = {
  id?: string;
  assetId?: string;
  odometerKM: number;
  amountPaid?: number;
  liters?: number;
  isFullTank?: boolean;
  timestamp?: unknown;
  createdAt?: string;
};

export type FuelEfficiencyVerdict =
  | 'SUPER_SAVER'
  | 'BALANCED'
  | 'HEAVY_THROTTLE'
  | 'INSUFFICIENT';

export type BenchmarkSource = 'city_average' | 'excellent_only' | 'unavailable';

export interface TripMetrics {
  tripDistanceKm: number | null;
  tripMileageKmPerL: number | null;
  runningCostPerKm: number | null;
  fuelSpentInr: number | null;
  litersUsed: number | null;
  verdict: FuelEfficiencyVerdict;
  benchmarkText: string;
  benchmarkSource: BenchmarkSource;
  hasEnoughData: boolean;
}

export interface MonthlyFuelMetrics {
  monthKey: string;
  totalDistanceKm: number | null;
  averageMileageKmPerL: number | null;
  totalSpendInr: number | null;
  runningCostPerKm: number | null;
  litersUsed: number | null;
  entryCount: number;
  fullTankCount: number;
  verdict: FuelEfficiencyVerdict;
  hasSpan: boolean;
  filteredLogs?: FuelLog[];
  invalidCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round(value: number | null, decimals = 1): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function finiteNumber(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Convert a Firestore timestamp / ISO string / number into a Date (or null). */
export function fuelLogDate(log: FuelLog): Date | null {
  const ts = log?.timestamp;
  if (ts && typeof (ts as any).toDate === 'function') {
    try {
      return (ts as any).toDate();
    } catch {
      /* fall through */
    }
  }
  if (ts != null) {
    const d = new Date(ts as any);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (log?.createdAt) {
    const d = new Date(log.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Validate + enrich the raw fuel-logs array.
 * Handles: missing liters, missing amount, missing/invalid odometer,
 * duplicate odometer, odometer going backwards, null values, deletions.
 * Enforces asset ID isolation if targetAssetId is provided.
 * Returns logs sorted chronologically by odometer (ascending).
 */
export function normalizeFuelLogs(raw: FuelLog[] | undefined | null, targetAssetId?: string): FuelLog[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const sorted: FuelLog[] = [];

  raw.forEach((log) => {
    if (!log || typeof log !== 'object') return;
    // Strict asset isolation: reject foreign or unscoped logs
    if (targetAssetId) {
      if (!log.assetId || log.assetId !== targetAssetId) return;
    }
    const odo = finiteNumber(log.odometerKM);
    if (odo === null || odo <= 0) return;
    if (seen.has(odo)) return;
    seen.add(odo);
    sorted.push(log);
  });

  sorted.sort((a, b) => Number(a.odometerKM) - Number(b.odometerKM));
  return sorted;
}

/** Sanitised litres for a log (0 if missing). */
export function logLiters(log: FuelLog): number {
  const n = finiteNumber(log.liters);
  return n !== null && n > 0 ? n : 0;
}

/** Sanitised amount (₹) for a log (0 if missing). */
export function logAmount(log: FuelLog): number {
  const n = finiteNumber(log.amountPaid);
  return n !== null && n > 0 ? n : 0;
}

/**
 * City-average benchmark (km/L) for a vehicle type.
 * Reuses the existing trusted per-vehicle threshold table so the comparison
 * is never fabricated. Returns null when we cannot determine a reliable benchmark.
 */
export function cityAverageBenchmark(
  asset: { vehicleType?: string; categoryId?: string; assetName?: string } = {},
): number | null {
  const vehicleType = resolveFuelVehicleType(asset as any);
  if (!vehicleType || vehicleType === 'OTHER') return null;
  const thresholds = thresholdsForVehicleType(vehicleType);
  return finiteNumber(thresholds.averageFrom);
}

// ---------------------------------------------------------------------------
// Refill / Trip metrics
// ---------------------------------------------------------------------------

export function computeTripMetrics(
  rawLogs: FuelLog[] | undefined | null,
  asset: { id?: string; assetId?: string; vehicleType?: string; categoryId?: string; category?: string; assetName?: string } = {},
): TripMetrics {
  // Non-vehicles (e.g. AC, Geyser, Phone) NEVER calculate fuel/mileage (P1-4)
  if (asset && Object.keys(asset).length > 0 && !isVehicleAsset(asset)) {
    return {
      tripDistanceKm: null,
      tripMileageKmPerL: null,
      runningCostPerKm: null,
      fuelSpentInr: null,
      litersUsed: null,
      verdict: 'INSUFFICIENT',
      benchmarkText: 'Fuel tracking is only available for vehicles.',
      benchmarkSource: 'unavailable',
      hasEnoughData: false,
    };
  }

  const targetAssetId = (asset as any)?.id || (asset as any)?.assetId;
  const logs = normalizeFuelLogs(rawLogs, targetAssetId);
  const hasSpan = logs.length >= 2;

  if (!hasSpan) {
    return {
      tripDistanceKm: null,
      tripMileageKmPerL: null,
      runningCostPerKm: null,
      fuelSpentInr: null,
      litersUsed: null,
      verdict: 'INSUFFICIENT',
      benchmarkText: 'Log your next full-tank refill to unlock trip insights.',
      benchmarkSource: 'unavailable',
      hasEnoughData: false,
    };
  }

  const first = logs[0];
  const last = logs[logs.length - 1];
  const lastKm = finiteNumber(last?.odometerKM);
  const firstKm = finiteNumber(first?.odometerKM);

  let tripDistanceKm: number | null = null;
  if (lastKm !== null && firstKm !== null && lastKm > firstKm) {
    tripDistanceKm = round(lastKm - firstKm, 0);
  }

  let litersUsed: number | null = null;
  let sumLiters = 0;
  let hasPositiveLiters = false;
  logs.forEach((l) => {
    const liters = logLiters(l);
    if (liters > 0) {
      sumLiters += liters;
      hasPositiveLiters = true;
    }
  });
  if (hasPositiveLiters) litersUsed = round(sumLiters, 2);

  let sumSpend = 0;
  let hasPositiveSpend = false;
  logs.forEach((l) => {
    const amt = logAmount(l);
    if (amt > 0) {
      sumSpend += amt;
      hasPositiveSpend = true;
    }
  });

  let tripMileageKmPerL: number | null = null;
  if (tripDistanceKm && tripDistanceKm > 0 && litersUsed && litersUsed > 0) {
    const m = tripDistanceKm / litersUsed;
    if (Number.isFinite(m) && m > 0 && m <= MAX_PLAUSIBLE_MILEAGE) {
      tripMileageKmPerL = round(m, 1);
    }
  }

  let runningCostPerKm: number | null = null;
  if (tripDistanceKm && tripDistanceKm > 0 && hasPositiveSpend) {
    const c = sumSpend / tripDistanceKm;
    if (Number.isFinite(c) && c > 0) runningCostPerKm = round(c, 2);
  }

  const benchmark = cityAverageBenchmark(asset);
  const { verdict, benchmarkText, benchmarkSource } = classifyEfficiency(
    tripMileageKmPerL,
    benchmark,
    tripDistanceKm,
  );

  return {
    tripDistanceKm,
    tripMileageKmPerL,
    runningCostPerKm,
    fuelSpentInr: hasPositiveSpend ? round(sumSpend, 0) : null,
    litersUsed,
    verdict,
    benchmarkText,
    benchmarkSource,
    hasEnoughData: true,
  };
}

/**
 * Classify efficiency into SUPER SAVER / BALANCED / HEAVY THROTTLE.
 *   SUPER SAVER:    mileage >= cityAverage * 1.05
 *   BALANCED:       between ~85% and ~105% of cityAverage
 *   HEAVY THROTTLE: mileage < cityAverage * 0.85
 */
export function classifyEfficiency(
  mileageKmPerL: number | null,
  cityAverage: number | null,
  distanceKm: number | null,
): { verdict: FuelEfficiencyVerdict; benchmarkText: string; benchmarkSource: BenchmarkSource } {
  if (mileageKmPerL == null || mileageKmPerL <= 0) {
    return {
      verdict: 'INSUFFICIENT',
      benchmarkText: 'Fuel data needs one more valid reading',
      benchmarkSource: 'unavailable',
    };
  }

  if (cityAverage == null || cityAverage <= 0) {
    const excellentOnly = mileageKmPerL >= 18;
    return {
      verdict: excellentOnly ? 'SUPER_SAVER' : 'BALANCED',
      benchmarkText: excellentOnly ? '🔥 Excellent efficiency' : '⚡ Consistent efficiency',
      benchmarkSource: 'excellent_only',
    };
  }

  if (mileageKmPerL >= cityAverage * 1.05) {
    const better = Math.round(((mileageKmPerL - cityAverage) / cityAverage) * 100);
    return {
      verdict: 'SUPER_SAVER',
      benchmarkText: `🔥 ${better}% better than city avg`,
      benchmarkSource: 'city_average',
    };
  }
  if (mileageKmPerL < cityAverage * 0.85) {
    return {
      verdict: 'HEAVY_THROTTLE',
      benchmarkText: '🔴 Below city average — easy on the throttle',
      benchmarkSource: 'city_average',
    };
  }
  return {
    verdict: 'BALANCED',
    benchmarkText: '⚡ Right on the city average',
    benchmarkSource: 'city_average',
  };
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Monthly aggregation (Ride Passport)
// ---------------------------------------------------------------------------

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** @returns 'YYYY-MM' for the given Date (local) — or 'YYYY-MM' for now. */
export function monthKeyOf(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Canonical fuel log filtering function by calendar month.
 * Local mobile calendar semantics:
 *   start = 1st day of the specified month at 00:00:00.000 local time
 *   end = last day of the specified month at 23:59:59.999 local time
 *
 * Rules:
 *   Include a log ONLY if: logDate >= start AND logDate <= end
 *   Normalizes every log date.
 *   Logs with missing/invalid dates are excluded from monthly calculations and counted in invalidCount.
 *   Returns an array with .invalidCount and .filteredLogs properties for full compatibility.
 */
export function filterFuelLogsByMonth(
  logs: FuelLog[] | undefined | null,
  yearOrPeriod: number | string,
  month?: number,
): FuelLog[] & { filteredLogs: FuelLog[]; invalidCount: number } {
  const emptyResult: FuelLog[] & { filteredLogs: FuelLog[]; invalidCount: number } = [] as any;
  emptyResult.filteredLogs = [];
  emptyResult.invalidCount = 0;

  if (!Array.isArray(logs) || logs.length === 0) {
    return emptyResult;
  }

  let y: number;
  let m: number; // 1-indexed (1 = Jan .. 12 = Dec)

  if (typeof yearOrPeriod === 'string') {
    const parts = yearOrPeriod.split('-').map(Number);
    y = parts[0];
    m = parts[1];
  } else {
    y = Number(yearOrPeriod);
    m = Number(month);
  }

  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return emptyResult;
  }

  // Local start and end of month:
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  let invalidCount = 0;
  const filtered: FuelLog[] = [];

  for (const log of logs) {
    if (!log || typeof log !== 'object') continue;
    const d = fuelLogDate(log);
    if (!d || Number.isNaN(d.getTime())) {
      invalidCount += 1;
      continue;
    }
    const t = d.getTime();
    if (t >= start.getTime() && t <= end.getTime()) {
      filtered.push(log);
    }
  }

  const res: FuelLog[] & { filteredLogs: FuelLog[]; invalidCount: number } = filtered as any;
  res.filteredLogs = filtered;
  res.invalidCount = invalidCount;
  return res;
}

export function computeMonthlyMetrics(
  monthKey: string,
  rawLogs: FuelLog[] | undefined | null,
  asset: { id?: string; assetId?: string; vehicleType?: string; categoryId?: string; category?: string; assetName?: string } = {},
): MonthlyFuelMetrics {
  const empty: MonthlyFuelMetrics = {
    monthKey,
    totalDistanceKm: null,
    averageMileageKmPerL: null,
    totalSpendInr: null,
    runningCostPerKm: null,
    litersUsed: null,
    entryCount: 0,
    fullTankCount: 0,
    verdict: 'INSUFFICIENT',
    hasSpan: false,
    filteredLogs: [],
    invalidCount: 0,
  };
  if (asset && Object.keys(asset).length > 0 && !isVehicleAsset(asset)) return empty;
  if (!rawLogs || !Array.isArray(rawLogs) || rawLogs.length === 0) return empty;

  const targetAssetId = (asset as any)?.id || (asset as any)?.assetId;

  // Strict asset isolation: foreign or unscoped logs are strictly excluded
  const scopedLogs = targetAssetId
    ? rawLogs.filter((l) => l && l.assetId === targetAssetId)
    : rawLogs;

  const filteredMonthResult = filterFuelLogsByMonth(scopedLogs, monthKey);
  const inMonth = filteredMonthResult.filteredLogs;
  const invalidCount = filteredMonthResult.invalidCount;

  if (inMonth.length === 0) {
    return { ...empty, invalidCount };
  }

  const logs = normalizeFuelLogs(inMonth, targetAssetId);
  if (logs.length < 1) {
    return { ...empty, invalidCount };
  }

  // Monthly Distance = max(valid odometers) - min(valid odometers)
  // When < 2 logs or max <= min, distance is null (never fabricated, never negative)
  let totalDistanceKm: number | null = null;
  if (logs.length >= 2) {
    const firstOdo = finiteNumber(logs[0]?.odometerKM);
    const lastOdo = finiteNumber(logs[logs.length - 1]?.odometerKM);
    if (lastOdo !== null && firstOdo !== null && lastOdo > firstOdo) {
      totalDistanceKm = round(lastOdo - firstOdo, 0);
    }
  }

  let liters = 0;
  let literCount = 0;
  let spend = 0;
  let spendCount = 0;
  let fullTankCount = 0;

  logs.forEach((l) => {
    const lt = logLiters(l);
    if (lt > 0) {
      liters += lt;
      literCount += 1;
    }
    const amt = logAmount(l);
    if (amt > 0) {
      spend += amt;
      spendCount += 1;
    }
    if (Boolean(l.isFullTank)) fullTankCount += 1;
  });

  let averageMileageKmPerL: number | null = null;
  if (totalDistanceKm && totalDistanceKm > 0 && liters > 0) {
    const m = totalDistanceKm / liters;
    if (Number.isFinite(m) && m > 0 && m <= MAX_PLAUSIBLE_MILEAGE) {
      averageMileageKmPerL = round(m, 1);
    }
  }

  let runningCostPerKm: number | null = null;
  if (totalDistanceKm && totalDistanceKm > 0 && spend > 0) {
    const c = spend / totalDistanceKm;
    if (Number.isFinite(c) && c > 0) runningCostPerKm = round(c, 2);
  }

  const benchmark = cityAverageBenchmark(asset);
  const eff = classifyEfficiency(averageMileageKmPerL, benchmark, totalDistanceKm);

  return {
    monthKey,
    totalDistanceKm,
    averageMileageKmPerL,
    totalSpendInr: spendCount > 0 ? round(spend, 0) : null,
    runningCostPerKm,
    litersUsed: literCount > 0 ? round(liters, 2) : null,
    entryCount: logs.length,
    fullTankCount,
    verdict: eff.verdict,
    hasSpan: totalDistanceKm != null && totalDistanceKm > 0,
    filteredLogs: inMonth,
    invalidCount,
  };
}

export interface FuelAnalyticsInput {
  asset?: any;
  logs?: FuelLog[] | any[];
  mode?: 'MONTHLY' | 'LIFETIME';
  month?: string; // YYYY-MM
}

export interface FuelAnalyticsResult {
  mode: 'MONTHLY' | 'LIFETIME';
  monthKey?: string;
  totalSpend: number;
  totalDistanceKm: number | null;
  totalLitres: number;
  averageMileageKmPerL: number | null;
  costPerKm: number | null;
  refillCount: number;
  fullTankCount: number;
  verdict: FuelEfficiencyVerdict;
  hasSpan: boolean;
  filteredLogs: FuelLog[];
  invalidDateCount: number;
}

/**
 * Pure canonical calculation engine for both Monthly and Lifetime fuel analytics.
 * Strictly guarantees:
 * - Non-vehicles (e.g. appliances, gadgets) return empty/insufficient result (P1-4).
 * - Foreign or unscoped fuel logs are rejected/excluded (P1-5).
 * - No data fabrication when odometer span is missing.
 * - Accurate sums of spend and litres.
 * - Safe handling of zero distance / missing price.
 */
export function computeFuelAnalytics(input: FuelAnalyticsInput): FuelAnalyticsResult {
  const mode = input.mode || 'MONTHLY';
  const rawLogs = input.logs || [];
  const asset = input.asset || {};
  const monthKey = input.month || monthKeyOf();

  if (asset && Object.keys(asset).length > 0 && !isVehicleAsset(asset)) {
    return {
      mode,
      monthKey: mode === 'MONTHLY' ? monthKey : undefined,
      totalSpend: 0,
      totalDistanceKm: null,
      totalLitres: 0,
      averageMileageKmPerL: null,
      costPerKm: null,
      refillCount: 0,
      fullTankCount: 0,
      verdict: 'INSUFFICIENT',
      hasSpan: false,
      filteredLogs: [],
      invalidDateCount: 0,
    };
  }

  const targetAssetId = asset?.id || asset?.assetId || asset?._id;

  // Strict asset isolation: foreign or unscoped logs are strictly excluded
  const scopedLogs = targetAssetId
    ? rawLogs.filter((l) => l && l.assetId === targetAssetId)
    : rawLogs;

  if (mode === 'MONTHLY') {
    const monthly = computeMonthlyMetrics(monthKey, scopedLogs, asset);
    // Sort newest first by odometer / timestamp for UI history display
    const sortedDisplayLogs = [...(monthly.filteredLogs || [])].sort((a, b) => {
      const odoA = Number(a.odometerKM) || 0;
      const odoB = Number(b.odometerKM) || 0;
      return odoB - odoA;
    });

    return {
      mode: 'MONTHLY',
      monthKey,
      totalSpend: monthly.totalSpendInr ?? 0,
      totalDistanceKm: monthly.totalDistanceKm,
      totalLitres: monthly.litersUsed ?? 0,
      averageMileageKmPerL: monthly.averageMileageKmPerL,
      costPerKm: monthly.runningCostPerKm,
      refillCount: monthly.entryCount,
      fullTankCount: monthly.fullTankCount,
      verdict: monthly.verdict,
      hasSpan: monthly.hasSpan,
      filteredLogs: sortedDisplayLogs,
      invalidDateCount: monthly.invalidCount ?? 0,
    };
  }

  // LIFETIME Mode:
  const normalized = normalizeFuelLogs(scopedLogs, targetAssetId);

  let invalidDateCount = 0;
  for (const l of scopedLogs) {
    const d = fuelLogDate(l);
    if (!d || Number.isNaN(d.getTime())) invalidDateCount += 1;
  }

  if (normalized.length === 0) {
    return {
      mode: 'LIFETIME',
      totalSpend: 0,
      totalDistanceKm: null,
      totalLitres: 0,
      averageMileageKmPerL: null,
      costPerKm: null,
      refillCount: 0,
      fullTankCount: 0,
      verdict: 'INSUFFICIENT',
      hasSpan: false,
      filteredLogs: [],
      invalidDateCount,
    };
  }

  let totalDistanceKm: number | null = null;
  if (normalized.length >= 2) {
    const firstOdo = finiteNumber(normalized[0]?.odometerKM);
    const lastOdo = finiteNumber(normalized[normalized.length - 1]?.odometerKM);
    if (firstOdo !== null && lastOdo !== null && lastOdo > firstOdo) {
      totalDistanceKm = round(lastOdo - firstOdo, 0);
    }
  }

  let totalSpend = 0;
  let totalLitres = 0;
  let fullTankCount = 0;

  normalized.forEach((l) => {
    const amt = logAmount(l);
    if (amt > 0) totalSpend += amt;
    const lt = logLiters(l);
    if (lt > 0) totalLitres += lt;
    if (Boolean(l.isFullTank)) fullTankCount += 1;
  });

  let averageMileageKmPerL: number | null = null;
  if (totalDistanceKm && totalDistanceKm > 0 && totalLitres > 0) {
    const m = totalDistanceKm / totalLitres;
    if (Number.isFinite(m) && m > 0 && m <= MAX_PLAUSIBLE_MILEAGE) {
      averageMileageKmPerL = round(m, 1);
    }
  }

  let costPerKm: number | null = null;
  if (totalDistanceKm && totalDistanceKm > 0 && totalSpend > 0) {
    const c = totalSpend / totalDistanceKm;
    if (Number.isFinite(c) && c > 0) {
      costPerKm = round(c, 2);
    }
  }

  const benchmark = cityAverageBenchmark(asset);
  const eff = classifyEfficiency(averageMileageKmPerL, benchmark, totalDistanceKm);

  // Newest first for UI history display
  const sortedDisplayLogs = [...normalized].reverse();

  return {
    mode: 'LIFETIME',
    totalSpend: round(totalSpend, 0) ?? 0,
    totalDistanceKm,
    totalLitres: round(totalLitres, 2) ?? 0,
    averageMileageKmPerL,
    costPerKm,
    refillCount: normalized.length,
    fullTankCount,
    verdict: eff.verdict,
    hasSpan: totalDistanceKm !== null && totalDistanceKm > 0,
    filteredLogs: sortedDisplayLogs,
    invalidDateCount,
  };
}

// ---------------------------------------------------------------------------
// Vehicle number + spend masking (privacy controls)
// ---------------------------------------------------------------------------

export function maskVehicleNumber(registration: string | undefined | null, mask: boolean): string {
  const raw = String(registration || '').toUpperCase().trim();
  if (!raw) return '•• •• ••••';
  if (!mask) return raw;
  return '•• •• ••••';
}

export function maskSpend(amountInr: number | null | undefined, mask: boolean): string {
  const n = finiteNumber(amountInr);
  if (mask) return '₹ ••••';
  if (n === null || n <= 0) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function maskNumberDigits(input: string, mask: boolean): string {
  if (!mask) return String(input || '');
  return String(input || '').replace(/[A-Z0-9]/gi, '•');
}

export default {
  computeTripMetrics,
  computeMonthlyMetrics,
  computeFuelAnalytics,
  filterFuelLogsByMonth,
  classifyEfficiency,
  cityAverageBenchmark,
  normalizeFuelLogs,
  maskVehicleNumber,
  maskSpend,
  fuelLogDate,
  monthKeyOf,
};

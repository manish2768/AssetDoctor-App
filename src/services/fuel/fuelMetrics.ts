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
 * Returns logs sorted chronologically by odometer (ascending).
 */
export function normalizeFuelLogs(raw: FuelLog[] | undefined | null): FuelLog[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const sorted: FuelLog[] = [];

  raw.forEach((log) => {
    if (!log || typeof log !== 'object') return;
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
  asset: { vehicleType?: string; categoryId?: string; assetName?: string } = {},
): TripMetrics {
  const logs = normalizeFuelLogs(rawLogs);
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
// Monthly aggregation (Ride Passport)
// ---------------------------------------------------------------------------

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** @returns 'YYYY-MM' for the given Date (local) — or 'YYYY-MM' for now. */
export function monthKeyOf(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function computeMonthlyMetrics(
  monthKey: string,
  rawLogs: FuelLog[] | undefined | null,
  asset: { vehicleType?: string; categoryId?: string; assetName?: string } = {},
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
  };
  if (!rawLogs || !Array.isArray(rawLogs) || rawLogs.length === 0) return empty;

  const inMonth = rawLogs
    .map((log) => ({ log, date: fuelLogDate(log) }))
    .filter(
      ({ date }) => date != null && !Number.isNaN(date.getTime()) && dateKey(date) === monthKey,
    )
    .map(({ log }) => log);

  if (inMonth.length === 0) return empty;

  const logs = normalizeFuelLogs(inMonth);
  if (logs.length < 1) return empty;

  const firstOdo = finiteNumber(logs[0]?.odometerKM);
  const lastOdo = finiteNumber(logs[logs.length - 1]?.odometerKM);

  let totalDistanceKm: number | null = null;
  if (lastOdo !== null && firstOdo !== null && lastOdo > firstOdo) {
    totalDistanceKm = round(lastOdo - firstOdo, 0);
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
  classifyEfficiency,
  cityAverageBenchmark,
  normalizeFuelLogs,
  maskVehicleNumber,
  maskSpend,
  fuelLogDate,
  monthKeyOf,
};

/**
 * Fuel & Mileage calculation engine — pure, deterministic, UI-free.
 *
 * These functions have no side effects and no network access, so the exact
 * same trusted math runs on the client (for the instant result card) and can be
 * reused in Cloud Functions / tests without duplicating logic.
 *
 * Type annotations: see src/types/fuelTypes.ts.
 */

import {
  resolveFuelVehicleType,
  mileageVerdict,
  MAX_PLAUSIBLE_MILEAGE,
} from './fuelMilestone';

/**
 * Round a number to `decimals` places (default 1) without float drift.
 * @param {number|null} value
 * @param {number} decimals
 * @returns {number|null}
 */
function round(value, decimals = 1) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

/**
 * Resolve which fuel type configuration to use for an asset.
 * Re-exports from the single config module.
 */
export function getFuelVehicleType(asset) {
  return resolveFuelVehicleType(asset);
}

/**
 * Validate fuel input before attempting any save.
 * Returns { valid:boolean, error?:string }.
 *
 * @param {object} input normalized fuel input
 * @param {number} previousOdometerKM latest prior odometer (or null for first log)
 * @returns {{valid:boolean, error?:string, odometerRegression?:boolean}}
 */
export function validateFuelInput(input = {}, previousOdometerKM = null) {
  const odometerKM = Number(input.odometerKM);
  const amountPaid = Number(input.amountPaid);
  const liters = Number(input.liters);
  const entryMode = input.entryMode || (amountPaid > 0 ? 'amount' : 'liters');

  // CASE 4 / CASE 5: fuel quantity or amount must be positive.
  if (entryMode === 'liters') {
    if (!Number.isFinite(liters) || liters <= 0) {
      return { valid: false, error: 'Fuel quantity cannot be zero or empty.' };
    }
  } else {
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return { valid: false, error: 'Amount paid cannot be zero or empty.' };
    }
  }

  // CASE: odometer must be positive.
  if (!Number.isFinite(odometerKM) || odometerKM <= 0) {
    return { valid: false, error: 'Enter a valid odometer reading.' };
  }

  // CASE 2: odometer cannot go backwards vs the latest previous reading.
  if (Number.isFinite(Number(previousOdometerKM)) && previousOdometerKM > 0) {
    if (odometerKM < previousOdometerKM) {
      return {
        valid: false,
        odometerRegression: true,
        error: 'Odometer reading cannot be lower than your previous reading.',
      };
    }
  }

  return { valid: true };
}

/**
 * Derive fuel consumed in litres from the input.
 * - If liters were provided directly, use them.
 * - Else if amount was provided, use amount / fuelPricePerLiter (only when price exists).
 *
 * @param {object} input { amountPaid, liters, fuelPricePerLiter, entryMode }
 * @returns {{fuelConsumed:number|null, needsFuelPrice:boolean}}
 */
export function deriveFuelConsumed(input = {}) {
  const amountPaid = Number(input.amountPaid) || 0;
  const liters = Number(input.liters) || 0;
  const fuelPricePerLiter = Number(input.fuelPricePerLiter) || 0;
  const entryMode = input.entryMode || (amountPaid > 0 ? 'amount' : 'liters');

  if (entryMode === 'liters' && liters > 0) {
    return { fuelConsumed: liters, needsFuelPrice: false };
  }
  if (entryMode === 'amount' && amountPaid > 0) {
    if (fuelPricePerLiter > 0) {
      return { fuelConsumed: amountPaid / fuelPricePerLiter, needsFuelPrice: false };
    }
    // CASE 6: amount without a fuel price → cannot derive litres silently.
    return { fuelConsumed: null, needsFuelPrice: true };
  }
  return { fuelConsumed: null, needsFuelPrice: false };
}

/**
 * Compute the fuel calculation result for the current entry given the previous
 * valid fuel log for THIS asset.
 *
 * Full-tank rule (very important): real mileage is ONLY computed when both the
 * current and previous entries are full tank. Partial refuels never fabricate
 * mileage. Cost per KM is computed where mathematically valid.
 *
 * @param {object} input normalized fuel input for the current entry
 * @param {object|null} previous previous FuelLog or null (first entry)
 * @param {object} asset asset for vehicle-type resolution (verdict)
 * @returns {object} FuelCalculationResult
 */
export function computeFuelCalculation(input = {}, previous = null, asset = {}) {
  const odometerKM = Number(input.odometerKM);
  const amountPaid = Number(input.amountPaid) || 0;
  const isFullTank = Boolean(input.isFullTank);

  const vehicleType = resolveFuelVehicleType(asset);
  const firstEntry = !previous;

  let distanceSincePrevious = null;
  if (previous && Number.isFinite(Number(previous.odometerKM)) && previous.odometerKM > 0) {
    distanceSincePrevious = odometerKM - Number(previous.odometerKM); // already guarded non-negative by validation
  }

  const { fuelConsumed } = deriveFuelConsumed(input);

  // CASE: distance is 0 or negative → no real mileage, no cost per KM.
  const validDistance = distanceSincePrevious != null && distanceSincePrevious > 0;

  let mileage = null;
  let costPerKm = null;

  if (validDistance) {
    // Cost per KM is valid from any two odometer readings with a spend.
    if (amountPaid > 0) {
      const c = amountPaid / distanceSincePrevious;
      if (Number.isFinite(c) && c > 0) costPerKm = round(c, 2);
    }

    // Real mileage ONLY when full-tank → full-tank.
    const prevFullTank = previous ? Boolean(previous.isFullTank) : false;
    if (isFullTank && prevFullTank && fuelConsumed != null && fuelConsumed > 0) {
      const m = distanceSincePrevious / fuelConsumed;
      if (Number.isFinite(m) && m > 0) mileage = round(m, 1);
    }
  }

  // CASE 7: flag impossible mileage (>=0 but over the realistic cap or <=0 is already handled).
  let flagged = false;
  if (mileage != null) {
    if (mileage <= 0 || mileage > MAX_PLAUSIBLE_MILEAGE) {
      mileage = null;
      flagged = true;
    }
  }

  const needsNextFullTank =
    firstEntry ||
    (fuelConsumed == null && amountPaid > 0) ||
    !isFullTank ||
    (previous && !previous.isFullTank && isFullTank);

  const verdict = mileage != null && !flagged ? mileageVerdict(mileage, vehicleType) : null;

  return {
    mileage,
    costPerKm,
    distanceSincePrevious,
    needsNextFullTank,
    isFirstEntry: firstEntry,
    fuelConsumed,
    previousLogId: previous ? previous.id || null : null,
    verdict,
    flaggedMileage: flagged,
  };
}

/**
 * Build the monthly fuel summary from a list of fuel logs for one asset.
 * Uses only FULL-TANK span calculations when >=2 full-tank logs exist, and sums
 * spend/litres across the whole period.
 *
 * @param {string} period 'YYYY-MM'
 * @param {string} assetId
 * @param {Array<object>} logs
 * @returns {object} FuelSummary
 */
export function summarizeMonthlyFuel(period, assetId, logs = []) {
  const inPeriod = (logs || []).filter((log) => {
    if (assetId && log.assetId && String(log.assetId) !== String(assetId)) {
      return false;
    }
    const ts = log.timestamp;
    // timestamp may be a serverTimestamp placeholder or a date-like object.
    const date = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts || log.createdAt || log.date || 0);
    if (!date || isNaN(date.getTime())) return true; // If no date, match current period fallback
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return !period || key === period;
  });

  inPeriod.sort((a, b) => Number(a.odometerKM) - Number(b.odometerKM));

  let totalDistanceKm = 0;
  let totalFuelConsumedLitres = 0;
  let spendKm = 0;
  let spendCost = 0;
  const mileageSegments = [];
  let fullTankCount = 0;

  for (let i = 0; i < inPeriod.length; i++) {
    const log = inPeriod[i];
    totalFuelConsumedLitres += Number(log.liters) || 0;
    spendCost += Number(log.amountPaid) || 0;

    const prev = i > 0 ? inPeriod[i - 1] : null;
    if (prev && Number.isFinite(Number(prev.odometerKM))) {
      const d = Number(log.odometerKM) - Number(prev.odometerKM);
      if (d > 0) {
        totalDistanceKm += d;
        spendKm += d;
        if (Number(log.amountPaid) > 0) spendCost += 0; // already counted above
      }
    }
    if (log.isFullTank) fullTankCount += 1;

    // Mileage only from consecutive full-tank span.
    if (i > 0 && prev && prev.isFullTank && log.isFullTank) {
      const distance = Number(log.odometerKM) - Number(prev.odometerKM);
      const consumed = Number(log.liters) || 0;
      if (distance > 0 && consumed > 0) {
        const m = distance / consumed;
        if (Number.isFinite(m) && m > 0 && m <= MAX_PLAUSIBLE_MILEAGE) {
          mileageSegments.push(m);
        }
      }
    }
  }

  const averageMileage =
    mileageSegments.length > 0
      ? round(mileageSegments.reduce((s, m) => s + m, 0) / mileageSegments.length, 1)
      : null;
  const averageCostPerKm = spendKm > 0 ? round(spendCost / spendKm, 2) : null;

  return {
    period,
    assetId,
    totalDistanceKm: round(totalDistanceKm, 0) || 0,
    totalFuelSpendInr: round(spendCost, 0),
    totalFuelConsumedLitres: round(totalFuelConsumedLitres, 2) || 0,
    averageMileage,
    averageCostPerKm,
    entryCount: inPeriod.length,
    fullTankCount,
  };
}

export default {
  validateFuelInput,
  deriveFuelConsumed,
  computeFuelCalculation,
  summarizeMonthlyFuel,
  getFuelVehicleType,
};

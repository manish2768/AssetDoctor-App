/**
 * Asset Doctor — Vehicle Fuel Summary (for Home "Vehicle Insights")
 *
 * Thin, UI-safe helper that loads the latest validated fuel log for a single
 * vehicle and derives the "current mileage" (km/L) and "cost per km" figures
 * displayed on the Home vehicle card. All math stays in the shared pure
 * engine (fuelCalculator.js) and never fabricates numbers.
 */

import { FuelService } from './FuelService';

/**
 * Load a vehicle's most recent valid fuel logs and derive the displayed
 * mileage / cost figures. Never shows fake values for a first entry.
 *
 * @param {string} userId
 * @param {string} assetId
 * @returns {Promise<{ mileage: number|null, costPerKm: number|null, hasLogs: boolean, entryCount: number }>}
 */
export async function deriveVehicleFuelSummary(userId, assetId) {
  const empty = { mileage: null, costPerKm: null, hasLogs: false, entryCount: 0 };
  if (!userId || !assetId) return empty;

  try {
    const { success, logs } = await FuelService.listFuelLogs(userId, assetId);
    if (!success || !Array.isArray(logs) || logs.length === 0) return empty;

    // Newest odometer first (already sorted desc by the service).
    let latestMileage = null;
    let latestCostPerKm = null;
    const ordered = [...logs].sort((a, b) => Number(b.odometerKM) - Number(a.odometerKM));

    for (const log of ordered) {
      if (latestMileage == null && Number.isFinite(Number(log.calculatedMileage))) {
        latestMileage = Number(log.calculatedMileage);
      }
      if (latestCostPerKm == null && Number.isFinite(Number(log.costPerKm))) {
        latestCostPerKm = Number(log.costPerKm);
      }
      if (latestMileage != null && latestCostPerKm != null) break;
    }

    return {
      mileage: latestMileage,
      costPerKm: latestCostPerKm,
      hasLogs: true,
      entryCount: ordered.length,
    };
  } catch {
    return empty;
  }
}

export default { deriveVehicleFuelSummary };

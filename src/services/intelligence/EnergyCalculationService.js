/**
 * EnergyProfile + EnergyCalculationService — Phase 2.
 * Local deterministic math; ESTIMATED unless method is actual_meter.
 * Does not invent watts — returns unavailable when inputs missing.
 */

import { ENERGY_VALUE_KIND } from './types';

export const ENERGY_CALC_METHOD = Object.freeze({
  ACTUAL_METER: 'actual_meter',
  MANUFACTURER_ANNUAL: 'manufacturer_annual',
  RATED_POWER_USAGE: 'rated_power_usage',
  MODEL_ESTIMATE: 'model_estimate',
  CATEGORY_DEFAULT: 'category_default',
});

const DEFAULT_TARIFF = 7.5;

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

/**
 * Normalize energy fields linked to assetId (no invented watts).
 */
export function buildEnergyProfile(asset = {}, overrides = {}) {
  const assetId = asset.assetId || asset.id || null;
  const existing = asset.energyProfile || {};
  const powerWatts =
    overrides.powerWatts ??
    existing.ratedPowerWatts ??
    asset.powerWatts ??
    asset.wattage ??
    null;
  const usageHoursPerDay =
    overrides.usageHoursPerDay ??
    existing.usageHoursPerDay ??
    asset.dailyHours ??
    null;
  const usageDaysPerMonth =
    overrides.usageDaysPerMonth ?? existing.usageDaysPerMonth ?? asset.usageDaysPerMonth ?? null;
  const tariff =
    overrides.tariff ?? existing.electricityTariff ?? asset.electricityTariff ?? DEFAULT_TARIFF;
  const voltage =
    overrides.voltage ?? existing.voltage ?? asset.voltage ?? null;
  const method =
    overrides.calculationMethod ||
    existing.calculationMethod ||
    ENERGY_CALC_METHOD.RATED_POWER_USAGE;

  const hasInputs =
    powerWatts != null && Number(powerWatts) > 0 && usageHoursPerDay != null && Number(usageHoursPerDay) >= 0;

  return {
    assetId,
    powerWatts: powerWatts != null ? Number(powerWatts) : null,
    voltage: voltage != null && Number(voltage) > 0 ? Number(voltage) : null,
    energyRating: overrides.energyRating ?? existing.starRating ?? asset.starRating ?? null,
    usageHoursPerDay: usageHoursPerDay != null ? Number(usageHoursPerDay) : null,
    usageDaysPerMonth: usageDaysPerMonth != null ? Number(usageDaysPerMonth) : 30,
    estimatedMonthlyKWh: existing.estimatedMonthlyConsumptionKwh ?? null,
    estimatedMonthlyCost: existing.estimatedMonthlyCost ?? null,
    tariff: Number(tariff) || DEFAULT_TARIFF,
    batteryCapacity:
      overrides.batteryCapacity ?? existing.batteryCapacityKwh ?? asset.batteryCapacityKwh ?? null,
    chargingEfficiency: overrides.chargingEfficiency ?? existing.chargingEfficiency ?? null,
    energySource: overrides.energySource ?? existing.energySource ?? null,
    calculationMethod: method,
    hasInputs: Boolean(hasInputs),
    valueKind:
      method === ENERGY_CALC_METHOD.ACTUAL_METER
        ? ENERGY_VALUE_KIND.ACTUAL
        : ENERGY_VALUE_KIND.ESTIMATED,
  };
}

/**
 * @returns {object} EnergyEstimate
 */
export function calculateEnergyEstimate(energyProfile = {}) {
  if (!energyProfile?.hasInputs && !(energyProfile.powerWatts > 0)) {
    return {
      dailyKWh: null,
      monthlyKWh: null,
      monthlyCost: null,
      assumptions: ['Power rating and usage hours required.'],
      confidence: null,
      valueKind: ENERGY_VALUE_KIND.ESTIMATED,
      available: false,
      assetId: energyProfile.assetId || null,
      displayPrefix: '~',
      calculationLabel: 'Insufficient data',
      isEstimate: true,
    };
  }

  const watts = Math.max(0, Number(energyProfile.powerWatts) || 0);
  const hours = Math.max(0, Number(energyProfile.usageHoursPerDay) || 0);
  const days = Math.max(0, Number(energyProfile.usageDaysPerMonth) || 30);
  const tariff = Math.max(0, Number(energyProfile.tariff) || DEFAULT_TARIFF);
  const method = energyProfile.calculationMethod || ENERGY_CALC_METHOD.RATED_POWER_USAGE;
  // Monthly kWh = (W/1000) × Hours/Day × Days/Month; Cost = kWh × Tariff
  const dailyKwh = (watts / 1000) * hours;
  const monthlyKwh = dailyKwh * days;
  const isEstimate = method !== ENERGY_CALC_METHOD.ACTUAL_METER;

  return {
    dailyKWh: round1(dailyKwh),
    monthlyKWh: round1(monthlyKwh),
    monthlyCost: Math.round(monthlyKwh * tariff),
    formula: 'Monthly kWh = (W/1000) × Hours/Day × Days/Month',
    assumptions: [
      isEstimate ? 'Estimated from rated power and usage' : 'Actual meter consumption',
      `Tariff ₹${tariff}/kWh`,
      `${hours} h/day × ${days} days`,
      energyProfile.voltage != null ? `Voltage ${energyProfile.voltage} V` : null,
    ].filter(Boolean),
    confidence: isEstimate ? 0.55 : 0.95,
    valueKind: isEstimate ? ENERGY_VALUE_KIND.ESTIMATED : ENERGY_VALUE_KIND.ACTUAL,
    available: true,
    assetId: energyProfile.assetId || null,
    displayPrefix: isEstimate ? '~' : '',
    calculationLabel: isEstimate
      ? 'Estimated from rated power and usage'
      : 'Actual consumption',
    isEstimate,
  };
}

export const EnergyCalculationService = {
  buildProfile: buildEnergyProfile,
  calculate: calculateEnergyEstimate,
  ENERGY_CALC_METHOD,
  ENERGY_VALUE_KIND,
};

export default EnergyCalculationService;

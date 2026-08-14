/**
 * Resale Value Calculator
 * Vehicles: stepped market depreciation (Y1 -15%, Y2–3 -10%/yr, Y4+ -8%/yr)
 * Others: V = P * (1 - r)^n
 */

import { yearsSince } from './dates';
import { CONDITION_OPTIONS } from '../theme/branding';
import { clamp } from './format';

const RATES = {
  bike: 0.12,
  scooter: 0.12,
  car: 0.15,
  mobile: 0.2,
  ac: 0.14,
  tv: 0.18,
  fridge: 0.12,
  washing_machine: 0.13,
  laptop: 0.2,
  appliance: 0.16,
  property: 0.02,
  other: 0.15,
  Vehicle: 0.14,
  Electronics: 0.2,
  Property: 0.02,
  General: 0.15,
};

const VEHICLE_IDS = new Set(['bike', 'car', 'scooter', 'vehicle', 'vehicle_parts']);

/**
 * Stepped vehicle depreciation (no external API).
 * Year 1: -15%, Years 2–3: -10%/yr, Year 4+: -8%/yr
 * @returns {{ estimatedResale: number, ageYears: number, schedule: number[], note: string }}
 */
export function calculateVehicleMarketDepreciation({
  purchaseValue = 0,
  purchaseDate,
  registrationYear,
} = {}) {
  const P = Number(purchaseValue) || 0;
  let n = yearsSince(purchaseDate);
  if ((!Number.isFinite(n) || n <= 0) && registrationYear) {
    const y = Number(registrationYear);
    if (y >= 1980 && y <= 2100) {
      n = Math.max(0, new Date().getFullYear() - y);
    }
  }
  if (!Number.isFinite(n) || n < 0) n = 0;

  let value = P;
  const wholeYears = Math.floor(n);
  const frac = n - wholeYears;
  const schedule = [];

  for (let year = 1; year <= wholeYears; year += 1) {
    let rate = 0.08;
    if (year === 1) rate = 0.15;
    else if (year === 2 || year === 3) rate = 0.1;
    value *= 1 - rate;
    schedule.push({ year, rate, value: Math.round(value) });
  }
  if (frac > 0.01) {
    let rate = 0.08;
    const nextYear = wholeYears + 1;
    if (nextYear === 1) rate = 0.15;
    else if (nextYear === 2 || nextYear === 3) rate = 0.1;
    value *= 1 - rate * frac;
  }

  const estimated = Math.round(clamp(value, 0, P));
  return {
    estimatedResale: estimated,
    ageYears: Number(n.toFixed(2)),
    schedule,
    note: 'Approx based on standard market depreciation',
    formula: 'Y1 -15%, Y2–3 -10%/yr, Y4+ -8%/yr',
  };
}

export function isVehicleCategoryId(categoryId, category) {
  const id = String(categoryId || '').toLowerCase();
  const cat = String(category || '').toLowerCase();
  return (
    VEHICLE_IDS.has(id) ||
    /bike|car|scooter|vehicle/.test(id) ||
    /vehicle|bike|car|scooter/.test(cat)
  );
}

/**
 * @returns {{ estimatedResale: number, ageYears: number, depreciationRate: number, conditionFactor: number, breakdown: object }}
 */
export function calculateResaleValue({
  purchaseValue = 0,
  purchaseDate,
  registrationYear,
  categoryId,
  category,
  condition = 'good',
} = {}) {
  const P = Number(purchaseValue) || 0;
  const n = yearsSince(purchaseDate);
  const vehicle = isVehicleCategoryId(categoryId, category);

  if (vehicle) {
    const market = calculateVehicleMarketDepreciation({
      purchaseValue: P,
      purchaseDate,
      registrationYear,
    });
    const cond = CONDITION_OPTIONS.find((c) => c.id === condition) || CONDITION_OPTIONS[1];
    const estimated = Math.round(clamp(market.estimatedResale * cond.factor, 0, P));
    return {
      estimatedResale: estimated,
      ageYears: market.ageYears,
      depreciationRate: null,
      conditionFactor: cond.factor,
      vehicleMarket: true,
      note: market.note,
      breakdown: {
        purchaseValue: P,
        afterAge: market.estimatedResale,
        afterCondition: estimated,
        retainedPercent: P ? Math.round((estimated / P) * 100) : 0,
        formula: market.formula,
        schedule: market.schedule,
      },
    };
  }

  const r =
    RATES[categoryId] ??
    RATES[category] ??
    RATES.other;

  const cond = CONDITION_OPTIONS.find((c) => c.id === condition) || CONDITION_OPTIONS[1];
  const aged = P * Math.pow(1 - r, n);
  const estimated = Math.round(clamp(aged * cond.factor, 0, P));

  return {
    estimatedResale: estimated,
    ageYears: Number(n.toFixed(2)),
    depreciationRate: r,
    conditionFactor: cond.factor,
    vehicleMarket: false,
    breakdown: {
      purchaseValue: P,
      afterAge: Math.round(aged),
      afterCondition: estimated,
      retainedPercent: P ? Math.round((estimated / P) * 100) : 0,
      formula: 'V = P * (1 - r)^n',
    },
  };
}

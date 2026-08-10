/**
 * Resale Value Calculator
 * Formula: V = P * (1 - r)^n  (Phase 3 roadmap)
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

/**
 * @returns {{ estimatedResale: number, ageYears: number, depreciationRate: number, conditionFactor: number, breakdown: object }}
 */
export function calculateResaleValue({
  purchaseValue = 0,
  purchaseDate,
  categoryId,
  category,
  condition = 'good',
} = {}) {
  const P = Number(purchaseValue) || 0;
  const n = yearsSince(purchaseDate);
  const r =
    RATES[categoryId] ??
    RATES[category] ??
    RATES.other;

  const cond = CONDITION_OPTIONS.find((c) => c.id === condition) || CONDITION_OPTIONS[1];

  // V = P * (1 - r)^n , then apply condition factor
  const aged = P * Math.pow(1 - r, n);
  const estimated = Math.round(clamp(aged * cond.factor, 0, P));

  return {
    estimatedResale: estimated,
    ageYears: Number(n.toFixed(2)),
    depreciationRate: r,
    conditionFactor: cond.factor,
    breakdown: {
      purchaseValue: P,
      afterAge: Math.round(aged),
      afterCondition: estimated,
      retainedPercent: P ? Math.round((estimated / P) * 100) : 0,
      formula: 'V = P * (1 - r)^n',
    },
  };
}

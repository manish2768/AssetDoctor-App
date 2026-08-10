/**
 * Depreciation schedule tracker
 * Tracks book value over time (distinct from market resale estimate).
 */

import { yearsSince } from './dates';
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
  property: 0.02,
  other: 0.15,
};

/**
 * @returns {{
 *   bookValue: number,
 *   accumulatedDepreciation: number,
 *   ageYears: number,
 *   annualRate: number,
 *   schedule: Array<{ year: number, bookValue: number, depreciation: number }>
 * }}
 */
export function calculateDepreciation({
  purchaseValue = 0,
  purchaseDate,
  categoryId = 'other',
  salvagePercent = 0.1,
  maxYears = 10,
} = {}) {
  const cost = Math.max(0, Number(purchaseValue) || 0);
  const rate = RATES[categoryId] ?? RATES.other;
  const ageYears = yearsSince(purchaseDate);
  const salvage = cost * clamp(salvagePercent, 0, 0.5);

  let book = cost;
  const schedule = [];
  const wholeYears = Math.min(Math.floor(ageYears), maxYears);

  for (let y = 1; y <= maxYears; y += 1) {
    const dep = Math.max(0, Math.min(book - salvage, book * rate));
    book = Math.max(salvage, book - dep);
    schedule.push({
      year: y,
      depreciation: Math.round(dep),
      bookValue: Math.round(book),
    });
    if (y === wholeYears) break;
  }

  // Partial year adjustment beyond wholeYears
  const frac = ageYears - wholeYears;
  if (frac > 0.01 && wholeYears < maxYears) {
    const dep = Math.max(0, Math.min(book - salvage, book * rate * frac));
    book = Math.max(salvage, book - dep);
  }

  const bookValue = Math.round(clamp(book, salvage, cost));
  return {
    bookValue,
    accumulatedDepreciation: Math.round(cost - bookValue),
    ageYears: Number(ageYears.toFixed(2)),
    annualRate: rate,
    salvageValue: Math.round(salvage),
    schedule,
  };
}

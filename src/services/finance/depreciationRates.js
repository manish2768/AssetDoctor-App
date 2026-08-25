/**
 * Category depreciation rates (% of remaining / year style via existing engine).
 * Straight-line useful life (years) for STRAIGHT_LINE method.
 * Configurable — not universal market truth.
 */

export const DEPRECIATION_USEFUL_LIFE_YEARS = Object.freeze({
  car: 8,
  bike: 7,
  scooter: 6,
  ev: 8,
  commercial: 6,
  mobile: 3,
  laptop: 4,
  tablet: 4,
  smartwatch: 3,
  camera: 5,
  tv: 6,
  ac: 8,
  fridge: 10,
  refrigerator: 10,
  washing_machine: 8,
  geyser: 7,
  microwave: 6,
  water_purifier: 5,
  air_purifier: 5,
  other: 5,
});

/** Annual declining-balance style rates used by legacy calculator (fraction). */
export const CATEGORY_ANNUAL_DEPRECIATION_RATE = Object.freeze({
  car: 0.12,
  bike: 0.14,
  scooter: 0.15,
  ev: 0.13,
  commercial: 0.16,
  mobile: 0.35,
  laptop: 0.3,
  tablet: 0.3,
  smartwatch: 0.35,
  camera: 0.2,
  tv: 0.18,
  ac: 0.12,
  fridge: 0.1,
  refrigerator: 0.1,
  washing_machine: 0.12,
  geyser: 0.12,
  microwave: 0.15,
  water_purifier: 0.15,
  air_purifier: 0.15,
  other: 0.15,
});

export function resolveUsefulLifeYears(asset = {}) {
  if (Number(asset.usefulLifeYears) > 0) return Number(asset.usefulLifeYears);
  const key = String(asset.categoryId || asset.category || 'other')
    .toLowerCase()
    .replace(/\s+/g, '_');
  return DEPRECIATION_USEFUL_LIFE_YEARS[key] || DEPRECIATION_USEFUL_LIFE_YEARS.other;
}

export function resolveAnnualDepreciationRate(asset = {}) {
  if (Number(asset.depreciationRate) > 0) return Number(asset.depreciationRate);
  const key = String(asset.categoryId || asset.category || 'other')
    .toLowerCase()
    .replace(/\s+/g, '_');
  return CATEGORY_ANNUAL_DEPRECIATION_RATE[key] || CATEGORY_ANNUAL_DEPRECIATION_RATE.other;
}

export default {
  DEPRECIATION_USEFUL_LIFE_YEARS,
  CATEGORY_ANNUAL_DEPRECIATION_RATE,
  resolveUsefulLifeYears,
  resolveAnnualDepreciationRate,
};

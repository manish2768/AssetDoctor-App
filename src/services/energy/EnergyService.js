/**
 * Auto Energy & Electricity Consumption Engine
 * Assigns wattage / daily hours for electric appliances and aggregates costs.
 */

import { DEFAULT_TARIFF_PER_KWH, ASSET_CATEGORY_OPTIONS } from '../../theme/branding';
import {
  estimatePowerCost,
  isApplianceAsset,
  resolveAppliancePower,
} from '../../utils/powerCost';
import { SMART_CATEGORIES } from '../ocr/categoryClassifier';

/** Keyword → default wattage (W) and daily hours */
const WATTAGE_DEFAULTS = [
  { re: /\bac\b|air[\s\-]?cond/i, wattage: 1500, avgDailyHours: 8, powerFactor: 0.85 },
  { re: /geyser|water\s*heater/i, wattage: 2000, avgDailyHours: 1, powerFactor: 1 },
  { re: /microwave|oven/i, wattage: 1200, avgDailyHours: 0.5, powerFactor: 1 },
  { re: /washing\s*machine|washer/i, wattage: 500, avgDailyHours: 1, powerFactor: 0.8 },
  { re: /fridge|refrigerator/i, wattage: 150, avgDailyHours: 24, powerFactor: 0.9 },
  { re: /\btv\b|television|led/i, wattage: 100, avgDailyHours: 5, powerFactor: 0.95 },
  { re: /cooler|fan/i, wattage: 150, avgDailyHours: 8, powerFactor: 0.85 },
  { re: /dishwasher/i, wattage: 1200, avgDailyHours: 1, powerFactor: 0.9 },
  { re: /laptop|notebook/i, wattage: 65, avgDailyHours: 4, powerFactor: 0.7 },
  { re: /phone|mobile|tablet/i, wattage: 15, avgDailyHours: 2, powerFactor: 0.7 },
];

/**
 * Resolve default power rating from product name / categoryId.
 */
export function resolveDefaultPowerRating({
  productName = '',
  categoryId = '',
  smartCategory = '',
} = {}) {
  const text = `${productName} ${categoryId}`;
  for (const row of WATTAGE_DEFAULTS) {
    if (row.re.test(text)) {
      return {
        wattage: row.wattage,
        avgDailyHours: row.avgDailyHours,
        powerFactor: row.powerFactor,
        matched: true,
      };
    }
  }

  const meta = ASSET_CATEGORY_OPTIONS.find((c) => c.id === categoryId);
  if (meta && Number(meta.powerWatts) > 0) {
    return {
      wattage: meta.powerWatts,
      avgDailyHours: meta.dailyHours || 3,
      powerFactor: meta.powerFactor ?? 0.85,
      matched: true,
    };
  }

  if (
    smartCategory === SMART_CATEGORIES.HOME_APPLIANCES ||
    categoryId === 'appliance' ||
    categoryId === 'microwave' ||
    categoryId === 'geyser'
  ) {
    return { wattage: 200, avgDailyHours: 3, powerFactor: 0.85, matched: true };
  }

  return { wattage: 0, avgDailyHours: 0, powerFactor: 1, matched: false };
}

/**
 * When creating an asset, auto-flag electric appliances and assign defaults.
 * @returns {object} energy fields to merge into asset payload
 */
export function assignEnergyFieldsOnCreate(form = {}) {
  const productName = form.assetName || form.productName || '';
  const categoryId = form.categoryId || '';
  const smartCategory = form.smartCategory || form.invoiceMeta?.smartCategory || '';

  const isHomeBucket =
    smartCategory === SMART_CATEGORIES.HOME_APPLIANCES ||
    ['ac', 'fridge', 'tv', 'washing_machine', 'appliance', 'microwave', 'geyser'].includes(
      categoryId,
    );

  const defaults = resolveDefaultPowerRating({ productName, categoryId, smartCategory });
  const isElectric =
    form.isElectricAppliance === true ||
    isHomeBucket ||
    (defaults.matched && defaults.wattage > 0 && isHomeBucket);

  // Also treat laptop as electric for energy tab (optional light load)
  const forceElectric =
    isElectric ||
    categoryId === 'laptop' ||
    (smartCategory === SMART_CATEGORIES.HOME_APPLIANCES && defaults.wattage > 0);

  if (!forceElectric && !isHomeBucket) {
    return {
      isElectricAppliance: Boolean(form.isElectricAppliance),
      wattage: form.wattage != null ? Number(form.wattage) : Number(form.powerWatts) || 0,
      avgDailyHours:
        form.avgDailyHours != null ? Number(form.avgDailyHours) : Number(form.dailyHours) || 0,
      powerWatts: Number(form.powerWatts) || 0,
      dailyHours: Number(form.dailyHours) || 0,
      powerFactor: form.powerFactor != null ? Number(form.powerFactor) : 1,
    };
  }

  const wattage =
    Number(form.wattage) > 0
      ? Number(form.wattage)
      : Number(form.powerWatts) > 0
        ? Number(form.powerWatts)
        : defaults.wattage;
  const avgDailyHours =
    Number(form.avgDailyHours) > 0
      ? Number(form.avgDailyHours)
      : Number(form.dailyHours) > 0
        ? Number(form.dailyHours)
        : defaults.avgDailyHours;
  const powerFactor =
    form.powerFactor != null && form.powerFactor !== ''
      ? Number(form.powerFactor)
      : defaults.powerFactor;

  return {
    isElectricAppliance: true,
    wattage,
    avgDailyHours,
    powerWatts: wattage,
    dailyHours: avgDailyHours,
    powerFactor,
  };
}

/**
 * Filter electric appliances and aggregate daily/monthly consumption.
 */
export function aggregateEnergyPortfolio(assets = [], tariffPerKwh = DEFAULT_TARIFF_PER_KWH) {
  const tariff = Number(tariffPerKwh) > 0 ? Number(tariffPerKwh) : DEFAULT_TARIFF_PER_KWH;
  const electric = (assets || []).filter((a) => {
    if (a?.deletedAt) return false;
    if (a?.isElectricAppliance === true) return true;
    return isApplianceAsset(a);
  });

  const breakdown = electric.map((asset) => {
    const resolved = resolveAppliancePower({
      ...asset,
      powerWatts: asset.wattage || asset.powerWatts,
      dailyHours: asset.avgDailyHours || asset.dailyHours,
    });
    const daily = estimatePowerCost({
      powerWatts: resolved.powerWatts,
      hoursUsed: resolved.dailyHours,
      powerFactor: resolved.powerFactor,
      tariffPerKwh: tariff,
    });
    return {
      assetId: asset.assetId || asset.id,
      assetName: asset.assetName || 'Appliance',
      icon: asset.icon || '🔌',
      powerWatts: resolved.powerWatts,
      dailyHours: resolved.dailyHours,
      powerFactor: resolved.powerFactor,
      dailyKwh: daily.kwh,
      dailyCostInr: daily.costInr,
      monthlyKwh: Number((daily.kwh * 30).toFixed(2)),
      monthlyCostInr: Number((daily.costInr * 30).toFixed(2)),
    };
  });

  const dailyKwh = breakdown.reduce((s, r) => s + r.dailyKwh, 0);
  const dailyCost = breakdown.reduce((s, r) => s + r.dailyCostInr, 0);
  const maxDailyCost = Math.max(0, ...breakdown.map((r) => r.dailyCostInr));

  return {
    tariffPerKwh: tariff,
    tracked: breakdown.length,
    dailyKwh: Number(dailyKwh.toFixed(3)),
    costInr: Number(dailyCost.toFixed(2)),
    monthlyKwh: Number((dailyKwh * 30).toFixed(2)),
    monthlyCostInr: Number((dailyCost * 30).toFixed(2)),
    breakdown: breakdown
      .map((row) => ({
        ...row,
        /** 0–1 share of max for simple bar chart */
        barRatio: maxDailyCost > 0 ? row.dailyCostInr / maxDailyCost : 0,
      }))
      .sort((a, b) => b.dailyCostInr - a.dailyCostInr),
  };
}

export const EnergyService = {
  resolveDefaultPowerRating,
  assignEnergyFieldsOnCreate,
  aggregateEnergyPortfolio,
};

export default EnergyService;

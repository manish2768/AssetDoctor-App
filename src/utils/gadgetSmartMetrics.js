/**
 * Smart metrics for mobiles & laptops — battery health, live resale, battery replacement cost.
 */

import { yearsSince } from './dates';
import { calculateResaleValue } from './resaleCalculator';
import { clamp } from './format';

const GADGET_IDS = new Set(['mobile', 'phone', 'tablet', 'laptop']);

const BATTERY_REPLACEMENT = {
  mobile: 3500,
  phone: 3500,
  tablet: 4500,
  laptop: 6500,
};

export function isGadgetCategory(asset = {}) {
  const id = String(asset.categoryId || '').toLowerCase();
  const label = `${asset.categoryLabel || ''} ${asset.category || ''} ${asset.assetName || ''}`.toLowerCase();
  if (GADGET_IDS.has(id)) return true;
  return /mobile|phone|smartphone|laptop|notebook|tablet|ipad|macbook/.test(label);
}

/**
 * Battery health ≈ 100% − (10–12% × ageYears), floored at 55%.
 */
export function estimateBatteryHealth({ purchaseDate, categoryId } = {}) {
  const age = yearsSince(purchaseDate);
  const annualDrain = categoryId === 'laptop' ? 0.1 : 0.12;
  const health = clamp(Math.round(100 - age * annualDrain * 100), 55, 100);
  return {
    batteryHealthPercent: health,
    ageYears: Number(age.toFixed(2)),
    annualDrainPercent: Math.round(annualDrain * 100),
  };
}

export function estimateBatteryReplacementCost(categoryId = 'mobile') {
  return BATTERY_REPLACEMENT[categoryId] || BATTERY_REPLACEMENT.mobile;
}

/**
 * @returns {{ batteryHealthPercent: number, liveResaleValue: number, batteryReplacementCost: number, ageYears: number } | null}
 */
export function computeGadgetSmartMetrics(asset = {}) {
  if (!isGadgetCategory(asset)) return null;
  const purchaseValue = Number(asset.value || asset.purchaseAmount || 0);
  const purchaseDate = asset.purchaseDate || asset.invoiceDate || null;
  const categoryId = asset.categoryId || 'mobile';

  const battery = estimateBatteryHealth({ purchaseDate, categoryId });
  const resale = calculateResaleValue({
    purchaseValue,
    purchaseDate,
    categoryId,
    category: asset.category,
    condition: asset.condition || 'good',
  });

  // Soft-adjust resale by battery health (below 80% → proportional trim)
  const batteryFactor = clamp(battery.batteryHealthPercent / 100, 0.55, 1);
  const liveResaleValue = Math.round(resale.estimatedResale * (0.85 + 0.15 * batteryFactor));

  return {
    batteryHealthPercent: battery.batteryHealthPercent,
    liveResaleValue,
    batteryReplacementCost: estimateBatteryReplacementCost(categoryId),
    ageYears: battery.ageYears,
    estimatedResale: resale.estimatedResale,
  };
}

export default {
  isGadgetCategory,
  estimateBatteryHealth,
  estimateBatteryReplacementCost,
  computeGadgetSmartMetrics,
};

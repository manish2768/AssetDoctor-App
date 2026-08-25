/**
 * Battery intelligence foundation — never fake precision.
 * Prefer OS/API health when provided; otherwise mark Estimated.
 * Gating is capability-based (never name.includes heuristics).
 */

import { classifyFromCategoryId, GADGET_TYPE, POWERTRAIN } from './assetTaxonomy';
import { assetSupportsBatteryHealth } from './assetCapabilities';
import { estimateBatteryHealth } from '../../utils/gadgetSmartMetrics';

export const BATTERY_STATUS_THRESHOLDS = Object.freeze({
  excellent: 90,
  good: 80,
  fair: 70,
});

export function batteryStatusLabel(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n)) return null;
  if (n >= BATTERY_STATUS_THRESHOLDS.excellent) return 'Excellent';
  if (n >= BATTERY_STATUS_THRESHOLDS.good) return 'Good';
  if (n >= BATTERY_STATUS_THRESHOLDS.fair) return 'Fair';
  return 'Poor';
}

export function isBatteryRelevantAsset(asset = {}) {
  return assetSupportsBatteryHealth(asset);
}

/**
 * @returns {object|null} batteryProfile
 */
export function buildBatteryProfile(asset = {}, measured = {}) {
  if (!isBatteryRelevantAsset(asset)) return null;

  const original =
    measured.originalCapacity ??
    asset.batteryOriginalCapacity ??
    asset.specifications?.batteryCapacity?.value ??
    null;
  const current =
    measured.currentCapacity ??
    asset.batteryCurrentCapacity ??
    null;
  const cycles = measured.cycleCount ?? asset.batteryCycleCount ?? null;

  let healthPercent = null;
  let healthLabel = null;
  let isEstimated = true;
  let source = 'unavailable';

  if (measured.healthPercent != null && Number.isFinite(Number(measured.healthPercent))) {
    healthPercent = Math.round(Number(measured.healthPercent));
    isEstimated = false;
    source = measured.source || 'device_api';
  } else if (
    original != null &&
    current != null &&
    Number(original) > 0 &&
    Number(current) > 0
  ) {
    healthPercent = Math.round((Number(current) / Number(original)) * 100);
    isEstimated = true;
    source = 'capacity_ratio';
  } else {
    const tax = classifyFromCategoryId(asset.categoryId, asset.assetName);
    const allowAgeEstimate =
      tax.powertrain === POWERTRAIN.ELECTRIC ||
      [
        GADGET_TYPE.SMARTPHONE,
        GADGET_TYPE.LAPTOP,
        GADGET_TYPE.TABLET,
        GADGET_TYPE.SMARTWATCH,
        GADGET_TYPE.EARBUDS,
      ].includes(tax.gadgetType) ||
      ['mobile', 'phone', 'laptop', 'tablet', 'ev'].includes(
        String(asset.categoryId || '').toLowerCase(),
      );
    if (allowAgeEstimate && asset.purchaseDate) {
      const est = estimateBatteryHealth({
        purchaseDate: asset.purchaseDate,
        categoryId: asset.categoryId,
      });
      healthPercent = est.batteryHealthPercent;
      isEstimated = true;
      source = 'age_estimate';
    }
  }

  if (healthPercent != null) {
    healthPercent = Math.max(0, Math.min(100, healthPercent));
    healthLabel = batteryStatusLabel(healthPercent);
  }

  const tax = classifyFromCategoryId(asset.categoryId, asset.assetName);
  const unit =
    tax.powertrain === POWERTRAIN.ELECTRIC
      ? 'kWh'
      : tax.gadgetType === GADGET_TYPE.LAPTOP || tax.gadgetType === GADGET_TYPE.SMARTPHONE
        ? 'mAh'
        : 'mAh';

  return {
    healthPercent,
    healthLabel,
    isEstimated,
    displayTitle: isEstimated ? 'Estimated Battery Health' : 'Battery Health',
    originalCapacity: original != null ? Number(original) : null,
    currentCapacity: current != null ? Number(current) : null,
    cycleCount: cycles != null ? Number(cycles) : null,
    unit,
    source,
    confidence: isEstimated ? (source === 'capacity_ratio' ? 0.75 : 0.45) : 0.95,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export default {
  BATTERY_STATUS_THRESHOLDS,
  batteryStatusLabel,
  isBatteryRelevantAsset,
  buildBatteryProfile,
};

/**
 * Enrich asset create/update payloads with universal architecture fields.
 */

import { classifyFromCategoryId } from './assetTaxonomy';
import { createPublicAssetId } from './assetIdentity';
import { emptySpecifications, mergeSpecifications } from './assetSpecifications';
import { buildBatteryProfile } from './batteryIntelligence';
import { buildEnergyProfileOnCreate } from './energyIntelligence';

export function enrichUniversalAssetFields(form = {}, base = {}) {
  const tax = classifyFromCategoryId(base.categoryId || form.categoryId, base.assetName || form.assetName);
  const publicAssetId =
    form.publicAssetId || form.assetCode || createPublicAssetId(base.categoryId, base.assetName);

  const specifications = mergeSpecifications(
    emptySpecifications(),
    form.specifications || {},
  );

  // Seed common specs when present on form
  if (form.starRating != null) {
    specifications.starRating = {
      value: Number(form.starRating),
      unit: null,
      source: form.specSource || 'user',
      confidence: null,
      verified: true,
    };
  }
  if (form.capacityTons != null) {
    specifications.capacity = {
      value: Number(form.capacityTons),
      unit: 'TON',
      source: form.specSource || 'user',
      confidence: null,
      verified: true,
    };
  }

  const energyBundle = buildEnergyProfileOnCreate(form, base);
  const batteryProfile = buildBatteryProfile(
    { ...base, ...energyBundle, specifications },
    {
      healthPercent: form.batteryHealthPercentMeasured,
      originalCapacity: form.batteryOriginalCapacity,
      currentCapacity: form.batteryCurrentCapacity,
      cycleCount: form.batteryCycleCount,
      source: form.batterySource,
    },
  );

  return {
    ...energyBundle,
    publicAssetId,
    assetCode: publicAssetId,
    assetCategory: form.assetCategory || tax.assetCategory,
    vehicleType: form.vehicleType || tax.vehicleType || null,
    powertrain: form.powertrain || tax.powertrain || null,
    subcategory: form.subcategory || tax.subcategory || null,
    applianceType: form.applianceType || tax.applianceType || null,
    gadgetType: form.gadgetType || tax.gadgetType || null,
    nickname: form.nickname || form.locationLabel || '',
    locationId: form.locationId || form.roomId || null,
    locationPath: form.locationPath || form.roomName || '',
    homeId: form.homeId || null,
    floorId: form.floorId || null,
    roomId: form.roomId || form.locationId || null,
    specifications,
    batteryProfile,
    // Health score filled by AssetService.enrichMetrics on write
    assetHealthScore: null,
    assetHealthScoreVersion: 1,
  };
}

export default enrichUniversalAssetFields;

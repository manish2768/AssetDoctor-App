/**
 * Canonical asset capability model — derived from categoryId / taxonomy.
 * Do NOT use asset.name.includes() for capability decisions.
 * Battery health and energy tracking are independent flags.
 */

import {
  ASSET_CATEGORY,
  GADGET_TYPE,
  POWERTRAIN,
  APPLIANCE_TYPE,
  classifyFromCategoryId,
} from './assetTaxonomy.js';

/** categoryId values that must never show battery health */
const APPLIANCE_NO_BATTERY_IDS = new Set([
  'ac',
  'fridge',
  'washing_machine',
  'washer',
  'geyser',
  'microwave',
  'dishwasher',
  'tv',
  'appliance',
  'fan',
  'cooler',
  'air_cooler',
  'air_purifier',
  'water_purifier',
  'purifier',
  'inverter',
  'vacuum',
  'kitchen',
]);

/** Gadget subtypes that support battery health UI */
const BATTERY_GADGET_TYPES = new Set([
  GADGET_TYPE.SMARTPHONE,
  GADGET_TYPE.LAPTOP,
  GADGET_TYPE.TABLET,
  GADGET_TYPE.SMARTWATCH,
  GADGET_TYPE.EARBUDS,
]);

const BATTERY_GADGET_IDS = new Set(['mobile', 'phone', 'laptop', 'tablet', 'smartwatch', 'earbuds']);

function emptyCapabilities(taxonomy = null) {
  return {
    supportsBatteryHealth: false,
    supportsEnergyTracking: false,
    supportsCharging: false,
    supportsOdometer: false,
    supportsMileage: false,
    supportsFuelTracking: false,
    supportsInsurance: false,
    supportsPUC: false,
    supportsWarranty: true,
    supportsServiceHistory: false,
    needsEnergyInputs: false,
    taxonomy,
  };
}

/**
 * @param {object} asset — must include categoryId when known; assetName is secondary signal only via taxonomy
 * @returns {object} capability flags
 */
export function resolveAssetCapabilities(asset = {}) {
  const categoryId = String(asset.categoryId || '').toLowerCase().trim();
  const taxonomy = classifyFromCategoryId(asset.categoryId, asset.assetName || asset.productName || '');
  const caps = emptyCapabilities(taxonomy);

  const isEv =
    categoryId === 'ev' || taxonomy.powertrain === POWERTRAIN.ELECTRIC;
  const isVehicle = taxonomy.assetCategory === ASSET_CATEGORY.VEHICLE;
  const isAppliance =
    taxonomy.assetCategory === ASSET_CATEGORY.HOME_APPLIANCE ||
    APPLIANCE_NO_BATTERY_IDS.has(categoryId);
  const isGadget = taxonomy.assetCategory === ASSET_CATEGORY.GADGET;

  // --- Battery (strict allowlist) ---
  if (APPLIANCE_NO_BATTERY_IDS.has(categoryId) || isAppliance) {
    caps.supportsBatteryHealth = false;
  } else if (isEv) {
    caps.supportsBatteryHealth = true;
  } else if (BATTERY_GADGET_IDS.has(categoryId)) {
    caps.supportsBatteryHealth = true;
  } else if (isGadget && BATTERY_GADGET_TYPES.has(taxonomy.gadgetType)) {
    caps.supportsBatteryHealth = true;
  } else {
    caps.supportsBatteryHealth = false;
  }

  // --- Energy (independent of battery) ---
  if (isAppliance || isEv) {
    caps.supportsEnergyTracking = true;
  } else if (categoryId === 'inverter') {
    caps.supportsEnergyTracking = true;
  } else {
    caps.supportsEnergyTracking = false;
  }

  const hasWattage =
    Number(asset.powerWatts) > 0 ||
    Number(asset.ratedPowerWatts) > 0 ||
    Number(asset.energyProfile?.ratedPowerWatts) > 0;
  const hasUsage =
    Number(asset.dailyHours) > 0 ||
    Number(asset.usageHoursPerDay) > 0 ||
    Number(asset.energyProfile?.usageHoursPerDay) > 0;
  caps.needsEnergyInputs =
    caps.supportsEnergyTracking && !isEv && !(hasWattage && hasUsage);

  // --- EV / vehicle ---
  if (isEv) {
    caps.supportsCharging = true;
    caps.supportsOdometer = true;
    caps.supportsMileage = true;
    caps.supportsFuelTracking = false;
    caps.supportsInsurance = true;
    caps.supportsPUC = true;
    caps.supportsServiceHistory = true;
    caps.supportsEnergyTracking = true;
    caps.supportsBatteryHealth = true;
  } else if (isVehicle) {
    caps.supportsCharging = false;
    caps.supportsOdometer = true;
    caps.supportsMileage = true;
    caps.supportsFuelTracking = true;
    caps.supportsInsurance = true;
    caps.supportsPUC = true;
    caps.supportsServiceHistory = true;
  }

  if (isAppliance) {
    caps.supportsServiceHistory = true;
    caps.supportsInsurance = false;
    caps.supportsPUC = false;
    caps.supportsOdometer = false;
    caps.supportsMileage = false;
    caps.supportsFuelTracking = false;
    caps.supportsCharging = false;
  }

  if (isGadget && !isEv) {
    caps.supportsServiceHistory = caps.supportsBatteryHealth;
    caps.supportsInsurance = false;
    caps.supportsPUC = false;
  }

  caps.supportsWarranty = true;
  return Object.freeze(caps);
}

export function assetSupportsBatteryHealth(asset) {
  return resolveAssetCapabilities(asset).supportsBatteryHealth === true;
}

export function assetSupportsEnergyTracking(asset) {
  return resolveAssetCapabilities(asset).supportsEnergyTracking === true;
}

export function assetSupportsVehicleDocs(asset) {
  const c = resolveAssetCapabilities(asset);
  return c.supportsInsurance || c.supportsPUC || c.supportsOdometer;
}

/** Human prompt when energy module lacks inputs — never fabricate kWh */
export function energyInputPrompt(asset = {}) {
  const caps = resolveAssetCapabilities(asset);
  if (!caps.supportsEnergyTracking) return null;
  if (!caps.needsEnergyInputs) return null;
  if (caps.taxonomy?.powertrain === POWERTRAIN.ELECTRIC) {
    return 'Add battery capacity (kWh) and usage to estimate energy cost.';
  }
  return 'Add rated wattage and daily usage hours to estimate energy cost.';
}

export default {
  resolveAssetCapabilities,
  assetSupportsBatteryHealth,
  assetSupportsEnergyTracking,
  assetSupportsVehicleDocs,
  energyInputPrompt,
  APPLIANCE_NO_BATTERY_IDS,
  BATTERY_GADGET_TYPES,
};

/**
 * Configurable health / alert thresholds — deterministic, no AI.
 */

export const HEALTH_BANDS = Object.freeze({
  excellent: { min: 90, label: 'Excellent' },
  good: { min: 75, label: 'Good' },
  needsAttention: { min: 60, label: 'Needs Attention' },
  atRisk: { min: 40, label: 'At Risk' },
  critical: { min: 0, label: 'Critical' },
});

export const BATTERY_ALERT_THRESHOLDS = Object.freeze({
  attention: 80,
  critical: 70,
});

export const ENERGY_ANOMALY_PCT = 25; // significant increase vs prior period

export const EXPIRY_ALERT_DAYS = Object.freeze([30, 15, 7, 3, 1, 0]);

export const ALERT_PRIORITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

/** Recommended service intervals (days) — labeled Recommended, not manufacturer-required */
export const RECOMMENDED_SERVICE_INTERVAL_DAYS = Object.freeze({
  ac: 180,
  fridge: 365,
  washing_machine: 180,
  geyser: 365,
  car: 180,
  bike: 90,
  scooter: 90,
  commercial: 90,
  ev: 180,
  mobile: 365,
  laptop: 365,
  default: 180,
});

/** Max points per factor bucket (asset-specific profiles redistribute) */
export const DEFAULT_WEIGHTS = Object.freeze({
  documents: 20,
  warranty: 15,
  maintenance: 25,
  battery: 20,
  energy: 10,
  age: 10,
});

/**
 * Which factor buckets apply by taxonomy categoryId / assetCategory.
 */
export function resolveHealthProfile(asset = {}) {
  const id = String(asset.categoryId || '').toLowerCase();
  const powertrain = String(asset.powertrain || '').toUpperCase();
  const isEv = powertrain === 'ELECTRIC' || id === 'ev';
  const isVehicle = ['car', 'bike', 'scooter', 'commercial', 'ev', 'vehicle'].includes(id);
  const isGadget = ['mobile', 'laptop', 'tablet', 'phone'].includes(id);
  const isAc = id === 'ac';
  const isAppliance = ['ac', 'fridge', 'washing_machine', 'tv', 'microwave', 'geyser', 'appliance'].includes(id);

  if (isGadget) {
    return {
      key: 'gadget',
      weights: { documents: 15, warranty: 15, maintenance: 15, battery: 35, energy: 5, age: 15 },
      factors: ['documents', 'warranty', 'maintenance', 'battery', 'age'],
    };
  }
  if (isEv) {
    return {
      key: 'ev',
      weights: { documents: 15, warranty: 10, maintenance: 20, battery: 30, energy: 15, age: 10 },
      factors: ['documents', 'warranty', 'maintenance', 'battery', 'energy', 'age'],
    };
  }
  if (isVehicle) {
    return {
      key: 'vehicle',
      weights: { documents: 20, warranty: 10, maintenance: 35, battery: 0, energy: 5, age: 15, insurance: 15 },
      factors: ['documents', 'warranty', 'maintenance', 'age', 'insurance'],
    };
  }
  if (isAc) {
    return {
      key: 'ac',
      weights: { documents: 15, warranty: 15, maintenance: 30, battery: 0, energy: 25, age: 15 },
      factors: ['documents', 'warranty', 'maintenance', 'energy', 'age'],
    };
  }
  if (isAppliance) {
    return {
      key: 'appliance',
      weights: { documents: 15, warranty: 20, maintenance: 25, battery: 0, energy: 25, age: 15 },
      factors: ['documents', 'warranty', 'maintenance', 'energy', 'age'],
    };
  }
  return {
    key: 'default',
    weights: { ...DEFAULT_WEIGHTS },
    factors: ['documents', 'warranty', 'maintenance', 'age'],
  };
}

export function healthBandForScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return HEALTH_BANDS.needsAttention;
  if (n >= HEALTH_BANDS.excellent.min) return HEALTH_BANDS.excellent;
  if (n >= HEALTH_BANDS.good.min) return HEALTH_BANDS.good;
  if (n >= HEALTH_BANDS.needsAttention.min) return HEALTH_BANDS.needsAttention;
  if (n >= HEALTH_BANDS.atRisk.min) return HEALTH_BANDS.atRisk;
  return HEALTH_BANDS.critical;
}

export default {
  HEALTH_BANDS,
  BATTERY_ALERT_THRESHOLDS,
  ENERGY_ANOMALY_PCT,
  EXPIRY_ALERT_DAYS,
  ALERT_PRIORITY,
  RECOMMENDED_SERVICE_INTERVAL_DAYS,
  DEFAULT_WEIGHTS,
  resolveHealthProfile,
  healthBandForScore,
};

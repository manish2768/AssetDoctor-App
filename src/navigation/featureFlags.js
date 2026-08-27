/**
 * Asset Doctor — Feature Flags & Extension Architecture
 * Centralized feature flag management for current and future modules.
 */

export const FEATURE_FLAGS = Object.freeze({
  // Core Platform Modules (Enabled)
  UNIVERSAL_SCANNER: true,
  DOCUMENT_VAULT: true,
  ASSET_INTELLIGENCE: true,
  SMART_HEALTH_SCORE: true,
  UNIVERSAL_SEARCH: true,
  OFFLINE_SYNC: true,
  BIOMETRIC_VAULT_LOCK: true,

  // Future Modular Roadmap Extension Points (Architectural Stubs)
  AI_ASSET_ADVISOR: false,
  ASSET_MARKETPLACE: false,
  SERVICE_BOOKING: false,
  INSURANCE_INTEGRATION: false,
  WARRANTY_TRACKING_EXTENDED: false,
  RESALE_INTELLIGENCE: false,
  ASSET_VALUATION_ENGINE: false,
  MAINTENANCE_PREDICTION: false,
  ENERGY_INTELLIGENCE: true, // Available in dashboard
  FAMILY_ASSET_SHARING: false,
  BUSINESS_ASSET_MANAGEMENT: false,
  FLEET_MANAGEMENT: false,
  PARTNER_ECOSYSTEM: false,
});

/** Runtime overrides for testing / experimental rollouts */
const runtimeOverrides = new Map();

/**
 * Check if a specific feature flag is currently active.
 * @param {keyof typeof FEATURE_FLAGS} flagKey
 * @returns {boolean}
 */
export function isFeatureEnabled(flagKey) {
  if (runtimeOverrides.has(flagKey)) {
    return Boolean(runtimeOverrides.get(flagKey));
  }
  return Boolean(FEATURE_FLAGS[flagKey]);
}

/**
 * Set runtime override for a feature flag (useful for testing or staged rollouts).
 * @param {keyof typeof FEATURE_FLAGS} flagKey
 * @param {boolean} value
 */
export function setFeatureOverride(flagKey, value) {
  runtimeOverrides.set(flagKey, Boolean(value));
}

/**
 * Clear all runtime feature flag overrides.
 */
export function resetFeatureOverrides() {
  runtimeOverrides.clear();
}

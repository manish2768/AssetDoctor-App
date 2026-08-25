/**
 * Intelligence Engine V2 — shared types (Phase 2 architecture).
 * No fabricated values; missing data stays null/unknown.
 */

export const LOCATION_NODE_TYPE = Object.freeze({
  HOME: 'HOME',
  FLOOR: 'FLOOR',
  ROOM: 'ROOM',
});

/** Soft presets — not DB-enforced; custom names always allowed. */
export const ROOM_TYPE_PRESETS = Object.freeze([
  'Living Room',
  'Master Bedroom',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Study',
  'Garage',
  'Office',
  'Store Room',
  'Balcony',
  'Other',
]);

export const INSIGHT_TYPE = Object.freeze({
  MAINTENANCE: 'MAINTENANCE',
  WARRANTY: 'WARRANTY',
  REPAIR: 'REPAIR',
  REPLACEMENT: 'REPLACEMENT',
  ENERGY: 'ENERGY',
  DOCUMENT: 'DOCUMENT',
  BATTERY: 'BATTERY',
  COST: 'COST',
  LIFECYCLE: 'LIFECYCLE',
});

export const RECOMMENDATION_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  DISMISSED: 'DISMISSED',
  RESOLVED: 'RESOLVED',
  EXPIRED: 'EXPIRED',
});

export const CONFIDENCE_BAND = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNKNOWN: 'UNKNOWN',
});

export const REPAIR_REPLACE_DECISION = Object.freeze({
  REPAIR: 'REPAIR',
  REPLACE: 'REPLACE',
  MONITOR: 'MONITOR',
  COMPARE: 'COMPARE',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

/** Explainable alert / recommendation shape */
export function formatWhatWhyDo({ what, why, whatShouldIDo, priority = 'MEDIUM' } = {}) {
  return {
    what: String(what || '').trim() || 'Insight',
    why: String(why || '').trim() || 'Not enough data to explain yet.',
    whatShouldIDo:
      String(whatShouldIDo || '').trim() ||
      'Add more details (dates, costs, documents) so Asset Doctor can advise.',
    priority,
  };
}

export const ENERGY_VALUE_KIND = Object.freeze({
  ESTIMATED: 'ESTIMATED',
  ACTUAL: 'ACTUAL',
});

export function createInsightId(assetId, type, key) {
  return `ins_${String(assetId || 'x')}_${String(type || 't')}_${String(key || 'k')}`.replace(
    /[^a-zA-Z0-9_]/g,
    '_',
  );
}

export function createRecommendationId(assetId, type, key) {
  return `rec_${String(assetId || 'x')}_${String(type || 't')}_${String(key || 'k')}`.replace(
    /[^a-zA-Z0-9_]/g,
    '_',
  );
}

export function createClaimPackId(assetId) {
  return `claim_${String(assetId || 'x')}_${Date.now().toString(36)}`;
}

export default {
  LOCATION_NODE_TYPE,
  ROOM_TYPE_PRESETS,
  INSIGHT_TYPE,
  RECOMMENDATION_STATUS,
  CONFIDENCE_BAND,
  REPAIR_REPLACE_DECISION,
  ENERGY_VALUE_KIND,
  formatWhatWhyDo,
};

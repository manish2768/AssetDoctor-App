/**
 * Safe additive migrations for Intelligence Engine V2 (Phase 2).
 * Never deletes or renames production fields.
 */

/**
 * Ensure asset has location relationship fields (null-safe).
 */
export function migrateAssetLocationFields(asset = {}) {
  if (!asset || typeof asset !== 'object') return asset;
  const next = { ...asset };
  if (!('homeId' in next)) next.homeId = null;
  if (!('floorId' in next)) next.floorId = null;
  if (!('roomId' in next)) next.roomId = next.locationId || null;
  if (!('locationId' in next)) next.locationId = next.roomId || null;
  if (!('locationPath' in next)) next.locationPath = next.locationPath || '';
  return next;
}

/**
 * Ensure Locations documents have type for Digital Twin (default infer).
 */
export function migrateLocationNodeFields(location = {}) {
  if (!location || typeof location !== 'object') return location;
  const next = { ...location };
  if (!next.type) {
    if (!next.parentId) next.type = 'HOME';
    else if (String(next.name || '').toLowerCase().includes('floor')) next.type = 'FLOOR';
    else next.type = 'ROOM';
  }
  if (!('homeId' in next)) next.homeId = next.type === 'HOME' ? next.locationId || next.id : null;
  if (!('floorId' in next)) next.floorId = next.type === 'FLOOR' ? next.locationId || next.id : null;
  if (!('syncStatus' in next)) next.syncStatus = next.syncStatus || null;
  if (!('deletedAt' in next)) next.deletedAt = next.deletedAt || null;
  return next;
}

/**
 * Batch-migrate in-memory asset lists (offline cache friendly).
 */
export function migrateAssetListForIntelligence(assets = []) {
  return (assets || []).map(migrateAssetLocationFields);
}

export const INTELLIGENCE_SCHEMA_VERSION = 2;

export default {
  INTELLIGENCE_SCHEMA_VERSION,
  migrateAssetLocationFields,
  migrateLocationNodeFields,
  migrateAssetListForIntelligence,
};

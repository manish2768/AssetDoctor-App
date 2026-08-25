/**
 * In-memory intelligence cache — avoids full recalc on every render.
 */

const store = new Map();

export function intelligenceCacheKey(assetId, fingerprint = '') {
  return `${String(assetId || '')}::${String(fingerprint || '')}`;
}

export function getCachedIntelligence(key) {
  const row = store.get(key);
  if (!row) return null;
  if (row.expiresAt && Date.now() > row.expiresAt) {
    store.delete(key);
    return null;
  }
  return row.value;
}

export function setCachedIntelligence(key, value, ttlMs = 60_000) {
  store.set(key, {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
  });
  return value;
}

export function invalidateIntelligenceCache(assetId = null) {
  if (!assetId) {
    store.clear();
    return;
  }
  const prefix = `${String(assetId)}::`;
  for (const k of store.keys()) {
    if (k.startsWith(prefix) || k === String(assetId)) store.delete(k);
  }
}

export function intelligenceFingerprint(asset = {}, bundle = {}) {
  return [
    asset.assetId || asset.id || '',
    asset.updatedAt || asset.clientUpdatedAt || '',
    asset.warrantyExpiry || '',
    asset.repairCount ?? '',
    asset.energyProfile?.estimatedMonthlyCost ?? '',
    asset.assetHealthScore ?? asset.healthScore ?? '',
    (bundle.services || bundle.repairLogs || []).length,
    (bundle.documents || []).length,
    (bundle.expenses || []).length,
  ].join('|');
}

export default {
  intelligenceCacheKey,
  getCachedIntelligence,
  setCachedIntelligence,
  invalidateIntelligenceCache,
  intelligenceFingerprint,
};

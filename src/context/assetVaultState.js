/**
 * Pure vault list helpers for AssetProvider — optimistic CRUD + remote merge.
 * No React / Firebase imports so Node smoke tests can load this file.
 *
 * Canonical identity field is assetId (legacy id accepted via same fallback as assetIdOf).
 */

export function assetKey(asset) {
  if (!asset || typeof asset !== 'object') return '';
  const primary = asset.assetId != null ? String(asset.assetId).trim() : '';
  if (primary) return primary;
  const legacy = asset.id != null ? String(asset.id).trim() : '';
  return legacy;
}

export function upsertAssetInList(list = [], asset) {
  const id = assetKey(asset);
  if (!id) return Array.isArray(list) ? [...list] : [];
  const nextRow = { ...asset, id, assetId: id };
  const existing = Array.isArray(list) ? list : [];
  const without = existing.filter((row) => assetKey(row) !== id);
  return [nextRow, ...without];
}

export function removeAssetFromList(list = [], assetId) {
  const id = String(assetId || '');
  if (!id) return Array.isArray(list) ? [...list] : [];
  return (Array.isArray(list) ? list : []).filter((row) => assetKey(row) !== id);
}

export function patchAssetInList(list = [], assetId, patch = {}) {
  const id = String(assetId || '');
  if (!id) return Array.isArray(list) ? [...list] : [];
  return (Array.isArray(list) ? list : []).map((row) =>
    assetKey(row) === id ? { ...row, ...patch, id, assetId: id } : row,
  );
}

/**
 * Snapshot for rollback after a failed write.
 * @returns {object[]}
 */
export function snapshotAssets(list = []) {
  return (Array.isArray(list) ? list : []).map((row) => ({ ...row }));
}

/**
 * Cache warm is only for instant paint before the first remote snapshot.
 * Once remote has arrived (or a newer uid generation), ignore late cache reads.
 */
export function shouldApplyCacheWarm({ cancelled, generation, activeGeneration, gotRemote, list }) {
  if (cancelled) return false;
  if (generation !== activeGeneration) return false;
  if (gotRemote) return false;
  return Array.isArray(list) && list.length > 0;
}

/**
 * Remote snapshots always replace UI list for the active uid generation.
 * Pending local-only rows (offline queue) are merged back if missing from remote.
 */
export function mergeRemoteWithPendingLocal(remoteList = [], previousList = []) {
  const remote = Array.isArray(remoteList) ? remoteList : [];
  const previous = Array.isArray(previousList) ? previousList : [];
  const remoteIds = new Set(remote.map((row) => assetKey(row)).filter(Boolean));
  const pendingLocal = previous.filter((row) => {
    const id = assetKey(row);
    if (!id || remoteIds.has(id)) return false;
    if (row.deletedAt) return false;
    const sync = String(row.syncStatus || '');
    if (sync.includes('DELETE')) return false;
    return Boolean(row.pendingSync || row.optimistic || sync.startsWith('PENDING'));
  });
  if (!pendingLocal.length) return remote;
  return [...pendingLocal, ...remote];
}

/**
 * Auth isolation: never keep previous uid assets when the vault owner changes.
 */
export function emptyVaultForAuthChange() {
  return [];
}

export function filterActiveAssets(list = []) {
  return (Array.isArray(list) ? list : []).filter((row) => row && !row.deletedAt);
}

export default {
  assetKey,
  upsertAssetInList,
  removeAssetFromList,
  patchAssetInList,
  snapshotAssets,
  shouldApplyCacheWarm,
  mergeRemoteWithPendingLocal,
  emptyVaultForAuthChange,
  filterActiveAssets,
};

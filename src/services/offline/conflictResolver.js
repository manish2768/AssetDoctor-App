/**
 * Conflict detection helpers — optimistic versioning.
 * Never silently destroy important user fields.
 */

import { SYNC_STATUS } from './syncConstants';

const IMPORTANT_KEYS = new Set([
  'assetName',
  'nickname',
  'purchaseDate',
  'purchasePrice',
  'value',
  'warrantyExpiry',
  'insuranceExpiry',
  'pucExpiry',
  'serialNumber',
  'registration',
  'imei',
  'chassisNumber',
  'status',
  'ownershipType',
  'ownerUserId',
  'householdId',
]);

/**
 * @returns {{ conflict: boolean, reason?: string, localVersion?: number, remoteVersion?: number }}
 */
export function detectVersionConflict(local = {}, remote = {}) {
  const localVersion = Number(local.version ?? local.baseVersion);
  const remoteVersion = Number(remote.version);
  const importantDiff = () =>
    [...IMPORTANT_KEYS].some((key) => {
      if (local[key] === undefined) return false;
      return String(local[key] ?? '') !== String(remote[key] ?? '');
    });
  if (!Number.isFinite(localVersion) || !Number.isFinite(remoteVersion)) {
    if (importantDiff()) {
      return { conflict: true, reason: 'MISSING_VERSION_FIELD_DIFF' };
    }
    return { conflict: false };
  }
  if (localVersion === remoteVersion) return { conflict: false };
  // Local based on older remote → conflict if important fields differ
  if (localVersion < remoteVersion) {
    const changed = importantDiff();
    if (changed) {
      return {
        conflict: true,
        reason: 'UPDATE_VS_UPDATE',
        localVersion,
        remoteVersion,
      };
    }
  }
  return { conflict: false };
}

export function buildConflictRecord({
  entityType,
  entityId,
  userId,
  local,
  remote,
  reason,
}) {
  return {
    conflictId: `conflict_${entityType}_${entityId}_${Date.now()}`,
    entityType,
    entityId,
    userId,
    reason: reason || 'UPDATE_VS_UPDATE',
    status: SYNC_STATUS.CONFLICT,
    localSnapshot: sanitizeForConflict(local),
    remoteSnapshot: sanitizeForConflict(remote),
    createdAt: new Date().toISOString(),
  };
}

function sanitizeForConflict(obj = {}) {
  const out = {};
  for (const key of IMPORTANT_KEYS) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  out.version = obj.version;
  out.updatedAt = obj.updatedAt || obj.clientUpdatedAt || null;
  return out;
}

export function resolveConflictChoice(choice, local, remote) {
  if (choice === 'KEEP_LOCAL') {
    return {
      ...remote,
      ...local,
      version: Math.max(Number(remote.version) || 0, Number(local.version) || 0) + 1,
      syncStatus: SYNC_STATUS.PENDING_UPDATE,
      conflictResolved: 'KEEP_LOCAL',
    };
  }
  if (choice === 'USE_CLOUD') {
    return {
      ...remote,
      syncStatus: SYNC_STATUS.SYNCED,
      conflictResolved: 'USE_CLOUD',
    };
  }
  return null; // REVIEW — leave conflict open
}

export default {
  detectVersionConflict,
  buildConflictRecord,
  resolveConflictChoice,
};

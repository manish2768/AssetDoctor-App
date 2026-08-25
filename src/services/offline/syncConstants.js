/**
 * Sync metadata — shared by queue, vault cache, and SyncEngine.
 * Do not surface raw enums in cluttered UI; map to friendly copy.
 */

export const SYNC_STATUS = Object.freeze({
  SYNCED: 'SYNCED',
  PENDING_CREATE: 'PENDING_CREATE',
  PENDING_UPDATE: 'PENDING_UPDATE',
  PENDING_DELETE: 'PENDING_DELETE',
  PENDING_UPLOAD: 'PENDING_UPLOAD',
  SYNC_FAILED: 'SYNC_FAILED',
  CONFLICT: 'CONFLICT',
});

export const SYNC_ENTITY = Object.freeze({
  ASSET: 'ASSET',
  DOCUMENT: 'DOCUMENT',
  SERVICE: 'SERVICE',
  EXPENSE: 'EXPENSE',
  OCR: 'OCR',
  INVOICE: 'INVOICE',
});

export const QUEUE_JOB_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  FAILED: 'FAILED',
  DONE: 'DONE',
});

/** STEP 8 retry ladder (ms): 5s → 30s → 2m → 10m, then cap */
export const RETRY_DELAYS_MS = Object.freeze([5_000, 30_000, 120_000, 600_000]);

export const MAX_SYNC_ATTEMPTS = 10;

export function nextRetryAtIso(attempts) {
  const idx = Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1);
  return new Date(Date.now() + RETRY_DELAYS_MS[idx]).toISOString();
}

export function makeOperationId(entityType, entityId, operationType) {
  const e = String(entityType || 'X').toUpperCase();
  const id = String(entityId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const op = String(operationType || 'op').toUpperCase();
  return `opid_${e}_${id}_${op}`;
}

export function friendlySyncLabel(status) {
  switch (status) {
    case SYNC_STATUS.SYNCED:
      return 'Synced';
    case SYNC_STATUS.PENDING_CREATE:
    case SYNC_STATUS.PENDING_UPDATE:
    case SYNC_STATUS.PENDING_DELETE:
    case SYNC_STATUS.PENDING_UPLOAD:
      return 'Saved offline';
    case SYNC_STATUS.SYNC_FAILED:
      return 'Sync failed';
    case SYNC_STATUS.CONFLICT:
      return 'Needs review';
    default:
      return '';
  }
}

export default {
  SYNC_STATUS,
  SYNC_ENTITY,
  QUEUE_JOB_STATUS,
  RETRY_DELAYS_MS,
  MAX_SYNC_ATTEMPTS,
  nextRetryAtIso,
  makeOperationId,
  friendlySyncLabel,
};

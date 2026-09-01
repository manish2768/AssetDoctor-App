/**
 * Asset delete orchestration — Phase 13.1
 * Soft-delete (deletedAt) with offline queue, idempotency, linked-document handling,
 * and required audit. Does not invent collections.
 */

import { toErrorMessage } from '../../utils/errors';
import { SYNC_ENTITY, SYNC_STATUS, makeOperationId } from '../offline/syncConstants';

export const DELETE_UX = Object.freeze({
  confirmTitle: 'Delete this asset?',
  confirmMessage:
    'Your linked records will be handled according to your asset data. This action cannot be undone.',
  confirmLabel: 'Delete Asset',
  cancelLabel: 'Cancel',
  processing: 'Deleting asset…',
  success: 'Asset deleted successfully',
  failureTitle: "Couldn't delete this asset",
});

const inflight = new Map();

export function resetDeleteLocksForTests() {
  inflight.clear();
}

export function isNativeCryptoError(error) {
  const text = `${error?.code || ''} ${error?.message || error || ''}`;
  return /native crypto module|get secure random|getRandomValues|expo-crypto/i.test(text);
}

export function userFacingDeleteError(error, fallback = 'Please try again in a moment.') {
  if (!error) return fallback;
  if (isNativeCryptoError(error)) {
    return 'A secure on-device save failed. Close the app and try again. If it continues, free storage and retry.';
  }
  const msg = toErrorMessage(error, fallback);
  if (/native crypto module|get secure random/i.test(msg)) {
    return 'A secure on-device save failed. Close the app and try again. If it continues, free storage and retry.';
  }
  if (/sign in|unauth|not authenticated/i.test(msg)) {
    return 'Please sign in to delete this asset.';
  }
  if (/permission|denied|forbidden/i.test(msg)) {
    return 'You do not have permission to delete this asset.';
  }
  if (/network|offline|unavailable|timeout|timed out|connection/i.test(msg)) {
    return 'No connection. The delete is saved on this device and will sync when you are back online.';
  }
  return msg || fallback;
}

function isTransientError(error) {
  return /network|offline|unavailable|timeout|timed out|connection|retry-limit|unknown/i.test(
    `${error?.code || ''} ${error?.message || error || ''}`,
  );
}

function lockKey(userId, assetId) {
  return `${userId || ''}::${assetId || ''}`;
}

export function deleteOperationId(assetId) {
  return makeOperationId(SYNC_ENTITY.ASSET, assetId, 'DELETE');
}

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.assetId
 * @param {object} [params.existingAsset]
 * @param {object} [params.options]
 * @param {object} params.deps injectable collaborators
 */
export async function executeSoftDelete({ userId, assetId, existingAsset = null, options = {}, deps }) {
  if (!userId) {
    return { success: false, error: 'Please sign in to delete this asset.' };
  }
  if (!assetId) {
    return { success: false, error: 'This asset could not be identified.' };
  }

  const key = lockKey(userId, assetId);
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const run = runSoftDelete({ userId, assetId, existingAsset, options, deps });
  inflight.set(key, run);
  try {
    return await run;
  } finally {
    if (inflight.get(key) === run) inflight.delete(key);
  }
}

async function runSoftDelete({ userId, assetId, existingAsset, options, deps }) {
  const {
    isOnline,
    getRemoteAsset,
    persistRemoteSoftDelete,
    enqueue,
    removePendingJobs,
    markCacheDeleted,
    markLinkedDocuments,
    writeAudit,
  } = deps || {};

  const operationId = options.operationId || deleteOperationId(assetId);

  const already =
    existingAsset?.deletedAt ||
    existingAsset?.syncStatus === SYNC_STATUS.PENDING_DELETE;
  if (already) {
    return { success: true, alreadyDeleted: true, id: assetId };
  }

  const skipQueue = Boolean(options.skipOfflineQueue);
  let online = true;
  if (!skipQueue && typeof isOnline === 'function') {
    try {
      online = await isOnline();
    } catch {
      online = false;
    }
  }

  if (!online && !skipQueue) {
    return queueDelete({
      userId,
      assetId,
      operationId,
      enqueue,
      removePendingJobs,
      markCacheDeleted,
      markLinkedDocuments,
      writeAudit,
    });
  }

  if (typeof getRemoteAsset === 'function') {
    try {
      const remote = await getRemoteAsset(userId, assetId);
      if (remote && remote.deletedAt) {
        await settleLocalWithRetry({
          userId,
          assetId,
          markCacheDeleted,
          markLinkedDocuments,
          writeAudit,
          alreadyDeleted: true,
        });
        return { success: true, alreadyDeleted: true, id: assetId };
      }
      if (remote && remote.missing) {
        if (typeof removePendingJobs === 'function') {
          await removePendingJobs(userId, assetId);
        }
        await settleLocalWithRetry({
          userId,
          assetId,
          markCacheDeleted,
          markLinkedDocuments,
          writeAudit,
          queuedOffline: false,
          skipAudit: Boolean(options.skipOfflineQueue),
        });
        return { success: true, localOnly: true, id: assetId };
      }
    } catch {
      /* remote probe is best-effort */
    }
  }

  try {
    if (typeof persistRemoteSoftDelete === 'function') {
      await persistRemoteSoftDelete(userId, assetId);
    }
  } catch (error) {
    const shouldQueue = !skipQueue && isTransientError(error);
    if (shouldQueue) {
      return queueDelete({
        userId,
        assetId,
        operationId,
        enqueue,
        removePendingJobs,
        markCacheDeleted,
        markLinkedDocuments,
        writeAudit,
      });
    }
    return {
      success: false,
      error: userFacingDeleteError(error),
      technicalError: toErrorMessage(error),
    };
  }

  await settleLocalWithRetry({
    userId,
    assetId,
    markCacheDeleted,
    markLinkedDocuments,
    writeAudit,
    queuedOffline: false,
    skipAudit: Boolean(options.skipOfflineQueue),
  });

  return { success: true, id: assetId, queuedOffline: false };
}

async function queueDelete({
  userId,
  assetId,
  operationId,
  enqueue,
  removePendingJobs,
  markCacheDeleted,
  markLinkedDocuments,
  writeAudit,
}) {
  if (typeof removePendingJobs === 'function') {
    await removePendingJobs(userId, assetId);
  }
  if (typeof enqueue !== 'function') {
    return { success: false, error: 'Offline save is unavailable on this device.' };
  }
  await enqueue({
    type: 'softDeleteAsset',
    entityType: SYNC_ENTITY.ASSET,
    entityId: assetId,
    operationType: 'DELETE',
    operationId,
    payload: {
      userId,
      assetId,
      operationId,
      entityType: SYNC_ENTITY.ASSET,
      entityId: assetId,
    },
  });
  await settleLocalWithRetry({
    userId,
    assetId,
    markCacheDeleted,
    markLinkedDocuments,
    writeAudit,
    queuedOffline: true,
  });
  return { success: true, queuedOffline: true, id: assetId };
}

async function settleLocalWithRetry(args) {
  try {
    await settleLocal(args);
  } catch (firstError) {
    try {
      // eslint-disable-next-line global-require
      require('../../polyfills/installSecureCrypto').ensureCryptoSurface();
    } catch {
      /* polyfill already installed */
    }
    try {
      await settleLocal(args);
    } catch (retryError) {
      if (args.queuedOffline) {
        throw retryError;
      }
      if (typeof console !== 'undefined') {
        console.warn(
          '[AssetDelete] local cache/audit retry failed after remote delete:',
          retryError?.message || retryError,
        );
      }
    }
  }
}

async function settleLocal({
  userId,
  assetId,
  markCacheDeleted,
  markLinkedDocuments,
  writeAudit,
  queuedOffline = false,
  alreadyDeleted = false,
  skipAudit = false,
}) {
  if (typeof markCacheDeleted === 'function') {
    await markCacheDeleted(userId, assetId);
  }
  if (typeof markLinkedDocuments === 'function') {
    await markLinkedDocuments(userId, assetId);
  }
  if (!alreadyDeleted && !skipAudit && typeof writeAudit === 'function') {
    await writeAudit({
      userId,
      assetId,
      queuedOffline,
      action: 'asset_deleted',
    });
  }
}

export default {
  DELETE_UX,
  executeSoftDelete,
  userFacingDeleteError,
  isNativeCryptoError,
  deleteOperationId,
  resetDeleteLocksForTests,
};

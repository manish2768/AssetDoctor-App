/**
 * Central SyncEngine (STEP 8) — single sync orchestrator.
 * Reuses OfflineQueue + OfflineVaultCache — does not create a duplicate sync system.
 */

import { AppState } from 'react-native';

import { OfflineQueue } from './OfflineQueue';
import { OfflineVaultCache } from './OfflineVaultCache';
import { ConnectivityService, CONNECTIVITY } from './ConnectivityService';
import { SYNC_ENTITY, SYNC_STATUS, makeOperationId } from './syncConstants';
import { detectVersionConflict, buildConflictRecord } from './conflictResolver';
import { logSyncEvent } from './syncLog';
import { AssetService } from '../assets/AssetService';
import { DocumentVaultService } from '../documents/DocumentVaultService';
import { RepairLogService } from '../maintenance/MaintenanceService';
import { processPendingOcrJobs } from '../ocr/ocrOfflineQueue';
import { toErrorMessage } from '../../utils/errors';

let started = false;
let appStateSub = null;
let connectivityUnsub = null;
let lastFlushAt = 0;
let lastStatus = {
  connectivity: CONNECTIVITY.CONNECTING,
  pending: 0,
  failed: 0,
  conflicts: 0,
  message: '',
};
const statusListeners = new Set();

function emitStatus(patch = {}) {
  lastStatus = { ...lastStatus, ...patch, updatedAt: new Date().toISOString() };
  for (const fn of statusListeners) {
    try {
      fn(lastStatus);
    } catch {
      /* ignore */
    }
  }
}

async function refreshCounts(userId) {
  const list = userId ? await OfflineQueue.listForUser(userId) : await OfflineQueue.list();
  const failed = list.filter((j) => j.status === 'FAILED' || j.errorCode === 'MAX_RETRIES').length;
  let conflicts = 0;
  if (userId) {
    try {
      conflicts = (await OfflineVaultCache.listConflicts(userId)).length;
    } catch {
      conflicts = 0;
    }
  }
  emitStatus({
    pending: list.length,
    failed,
    conflicts,
    message:
      list.length === 0
        ? 'All data synced'
        : failed
          ? 'Some data couldn\'t sync.'
          : `Syncing ${list.length} item${list.length === 1 ? '' : 's'}...`,
  });
  return list.length;
}

const HANDLERS = {
  createAsset: async (payload) => {
    const startedAt = Date.now();
    const { userId, form, localImagePath, operationId } = payload || {};
    if (!userId) throw new Error('userId required');
    const result = await AssetService.createFromForm(userId, form, localImagePath, {
      skipOfflineQueue: true,
      operationId,
    });
    if (!result.success) throw new Error(result.error || 'createAsset sync failed');
    const assetId = result.id || form?.assetId;
    if (assetId) {
      await OfflineVaultCache.upsertAsset(userId, {
        ...(result.asset || form),
        assetId,
        id: assetId,
        syncStatus: SYNC_STATUS.SYNCED,
        pendingSync: false,
        lastSyncedAt: new Date().toISOString(),
      });
    }
    logSyncEvent({
      operationType: 'CREATE',
      entityType: SYNC_ENTITY.ASSET,
      entityId: assetId,
      success: true,
      durationMs: Date.now() - startedAt,
    });
  },

  updateAsset: async (payload) => {
    const startedAt = Date.now();
    const { userId, assetId, updates, localImagePath, operationId, baseVersion } = payload || {};
    if (!userId || !assetId) throw new Error('userId and assetId required');

    try {
      const remoteResult = await AssetService.fetchAssetSnapshot(userId, assetId);
      if (remoteResult?.success && remoteResult.asset) {
        const remote = remoteResult.asset;
        const conflict = detectVersionConflict(
          { ...updates, version: baseVersion, baseVersion },
          remote,
        );
        if (conflict.conflict) {
          await OfflineVaultCache.saveConflict(
            userId,
            buildConflictRecord({
              entityType: SYNC_ENTITY.ASSET,
              entityId: assetId,
              userId,
              local: { ...updates, version: baseVersion },
              remote,
              reason: conflict.reason,
            }),
          );
          await OfflineVaultCache.upsertAsset(userId, {
            ...remote,
            ...updates,
            assetId,
            syncStatus: SYNC_STATUS.CONFLICT,
            pendingSync: true,
          });
          throw new Error('CONFLICT');
        }
      }
    } catch (e) {
      if (String(e?.message) === 'CONFLICT') throw e;
      /* remote read failed — proceed with write */
    }

    const result = await AssetService.updateAsset(userId, assetId, updates, localImagePath, {
      skipOfflineQueue: true,
      operationId,
    });
    if (!result.success) throw new Error(result.error || 'updateAsset sync failed');
    await OfflineVaultCache.upsertAsset(userId, {
      assetId,
      id: assetId,
      ...updates,
      syncStatus: SYNC_STATUS.SYNCED,
      pendingSync: false,
      lastSyncedAt: new Date().toISOString(),
      version: (Number(baseVersion) || Number(updates.version) || 0) + 1,
    });
    logSyncEvent({
      operationType: 'UPDATE',
      entityType: SYNC_ENTITY.ASSET,
      entityId: assetId,
      success: true,
      durationMs: Date.now() - startedAt,
    });
  },

  softDeleteAsset: async (payload) => {
    const { userId, assetId, operationId } = payload || {};
    if (!userId || !assetId) throw new Error('userId and assetId required');
    const result = await AssetService.softDeleteAsset(userId, assetId, {
      skipOfflineQueue: true,
      operationId,
    });
    if (!result.success) throw new Error(result.error || 'softDelete sync failed');
    await OfflineVaultCache.markAssetDeleted(userId, assetId);
    logSyncEvent({
      operationType: 'DELETE',
      entityType: SYNC_ENTITY.ASSET,
      entityId: assetId,
      success: true,
    });
  },

  uploadDocument: async (payload) => {
    const { userId, assetId, document, operationId } = payload || {};
    const result = await DocumentVaultService.uploadDocument(userId, assetId, {
      ...(document || {}),
      skipOfflineQueue: true,
      operationId,
    });
    if (!result.success) throw new Error(result.error || 'document upload sync failed');
    logSyncEvent({
      operationType: 'UPLOAD',
      entityType: SYNC_ENTITY.DOCUMENT,
      entityId: document?.docId || assetId,
      success: true,
    });
  },

  uploadVaultInvoice: async (payload) => {
    const { userId, assetId, localPath } = payload || {};
    const result = await AssetService.retryPendingBillUpload(userId, assetId, localPath);
    if (!result?.success) throw new Error(result?.error || 'vault invoice upload sync failed');
    logSyncEvent({
      operationType: 'UPLOAD',
      entityType: SYNC_ENTITY.INVOICE,
      entityId: assetId,
      success: true,
    });
  },

  createRepairLog: async (payload) => {
    const { userId, assetId, repair, operationId } = payload || {};
    if (!userId || !assetId || !repair) throw new Error('repair payload required');
    const result = await RepairLogService.create(userId, assetId, {
      ...repair,
      skipOfflineQueue: true,
      operationId,
      repairId: repair.repairId || repair.id,
    });
    if (!result.success) throw new Error(result.error || 'repair sync failed');
    await OfflineVaultCache.markRepairSynced(
      userId,
      assetId,
      result.id || repair.repairId || repair.id,
    );
    logSyncEvent({
      operationType: 'CREATE',
      entityType: SYNC_ENTITY.EXPENSE,
      entityId: result.id,
      success: true,
    });
  },
};

export class SyncEngine {
  static getHandlers() {
    return HANDLERS;
  }

  static getStatus() {
    return { ...lastStatus };
  }

  static subscribe(listener) {
    statusListeners.add(listener);
    try {
      listener(lastStatus);
    } catch {
      /* ignore */
    }
    return () => statusListeners.delete(listener);
  }

  static async pendingCount(userId) {
    const list = userId ? await OfflineQueue.listForUser(userId) : await OfflineQueue.list();
    return list.length;
  }

  static async flushNow(opts = {}) {
    const now = Date.now();
    if (!opts.force && now - lastFlushAt < 2500) {
      return {
        success: true,
        skipped: true,
        remaining: await this.pendingCount(opts.userId),
        processed: 0,
      };
    }
    lastFlushAt = now;

    const online = await ConnectivityService.isOnline({ force: Boolean(opts.force) });
    emitStatus({
      connectivity: online ? CONNECTIVITY.ONLINE : CONNECTIVITY.OFFLINE,
    });
    if (!online) {
      await refreshCounts(opts.userId);
      return {
        success: true,
        offline: true,
        remaining: await this.pendingCount(opts.userId),
        processed: 0,
      };
    }

    emitStatus({ message: 'Syncing...' });
    try {
      const result = await OfflineQueue.flush(HANDLERS);

      // Drain OCR jobs when online (processor injected lazily)
      try {
        // eslint-disable-next-line global-require
        const { OcrService } = require('../ocr');
        if (typeof OcrService?.recognizeFromImage === 'function') {
          await processPendingOcrJobs(async (job) => {
            if (opts.userId && job.ownerUid && job.ownerUid !== opts.userId) {
              return { success: false, error: 'wrong user' };
            }
            const data = await OcrService.recognizeFromImage(job.localImageUri);
            return { success: true, data: data || {} };
          });
        }
      } catch {
        /* OCR drain best-effort */
      }

      await refreshCounts(opts.userId);
      if (result.hasHardFailures) {
        emitStatus({
          message: 'Some data couldn\'t sync.',
          failed: result.failed || 0,
        });
        try {
          // eslint-disable-next-line global-require
          const { markBackupFailure } = require('../security/BackupStatusService');
          await markBackupFailure(opts.userId, 'SYNC_PARTIAL');
        } catch {
          /* ignore */
        }
      } else if (result.remaining === 0) {
        emitStatus({
          message: 'All data synced',
          pending: 0,
          lastSuccessAt: new Date().toISOString(),
        });
        try {
          // eslint-disable-next-line global-require
          const { markBackupSuccess } = require('../security/BackupStatusService');
          await markBackupSuccess(opts.userId);
        } catch {
          /* ignore */
        }
      }
      return result;
    } catch (error) {
      logSyncEvent({
        operationType: 'FLUSH',
        success: false,
        errorCategory: toErrorMessage(error).slice(0, 80),
      });
      return {
        success: false,
        error: toErrorMessage(error),
        remaining: await this.pendingCount(opts.userId),
        processed: 0,
      };
    }
  }

  static async retryNow(userId) {
    await OfflineQueue.forceRetryAll(userId);
    return this.flushNow({ force: true, userId });
  }

  /** Call once from app root — replaces scattered per-screen sync. */
  static startAutoFlush(userIdGetter) {
    if (started) return () => {};
    started = true;

    ConnectivityService.start();
    connectivityUnsub = ConnectivityService.subscribe((status) => {
      emitStatus({ connectivity: status });
      if (status === CONNECTIVITY.ONLINE) {
        const uid = typeof userIdGetter === 'function' ? userIdGetter() : userIdGetter;
        this.flushNow({ userId: uid }).catch(() => {});
      }
    });

    const uid0 = typeof userIdGetter === 'function' ? userIdGetter() : userIdGetter;
    this.flushNow({ userId: uid0 }).catch(() => {});

    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const uid = typeof userIdGetter === 'function' ? userIdGetter() : userIdGetter;
        this.flushNow({ userId: uid }).catch(() => {});
      }
    });

    return () => {
      started = false;
      appStateSub?.remove?.();
      appStateSub = null;
      connectivityUnsub?.();
      connectivityUnsub = null;
      ConnectivityService.stop();
    };
  }

  static makeOperationId(...args) {
    return makeOperationId(...args);
  }
}

/** Backward-compatible alias — do not create a second sync API. */
export const OfflineSyncService = SyncEngine;

export default SyncEngine;

/**
 * Offline sync — flush queued mutations when app resumes / user taps Sync.
 */

import { AppState } from 'react-native';

import { OfflineQueue } from './OfflineQueue';
import { AssetService } from '../assets/AssetService';
import { DocumentVaultService } from '../documents/DocumentVaultService';
import { toErrorMessage } from '../../utils/errors';

let started = false;
let appStateSub = null;
let lastFlushAt = 0;

const HANDLERS = {
  createAsset: async (payload) => {
    const { userId, form, localImagePath } = payload || {};
    const result = await AssetService.createFromForm(userId, form, localImagePath, {
      skipOfflineQueue: true,
    });
    if (!result.success) {
      throw new Error(result.error || 'createAsset sync failed');
    }
  },
  updateAsset: async (payload) => {
    const { userId, assetId, updates, localImagePath } = payload || {};
    const result = await AssetService.updateAsset(userId, assetId, updates, localImagePath, {
      skipOfflineQueue: true,
    });
    if (!result.success) {
      throw new Error(result.error || 'updateAsset sync failed');
    }
  },
  uploadDocument: async (payload) => {
    const { userId, assetId, document } = payload || {};
    const result = await DocumentVaultService.uploadDocument(userId, assetId, {
      ...(document || {}),
      skipOfflineQueue: true,
    });
    if (!result.success) {
      throw new Error(result.error || 'document upload sync failed');
    }
  },
  uploadVaultInvoice: async (payload) => {
    const { userId, assetId, localPath } = payload || {};
    const result = await AssetService.retryPendingBillUpload(userId, assetId, localPath);
    if (!result?.success) {
      throw new Error(result?.error || 'vault invoice upload sync failed');
    }
  },
};

export class OfflineSyncService {
  static getHandlers() {
    return HANDLERS;
  }

  static async pendingCount() {
    const list = await OfflineQueue.list();
    return list.length;
  }

  static async flushNow() {
    const now = Date.now();
    if (now - lastFlushAt < 2500) {
      return { success: true, skipped: true, remaining: await this.pendingCount(), processed: 0 };
    }
    lastFlushAt = now;
    try {
      return await OfflineQueue.flush(HANDLERS);
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error),
        remaining: await this.pendingCount(),
        processed: 0,
      };
    }
  }

  /** Call once from app root */
  static startAutoFlush() {
    if (started) return () => {};
    started = true;

    this.flushNow().catch(() => {});

    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') this.flushNow().catch(() => {});
    });

    return () => {
      started = false;
      appStateSub?.remove?.();
      appStateSub = null;
    };
  }
}

export default OfflineSyncService;

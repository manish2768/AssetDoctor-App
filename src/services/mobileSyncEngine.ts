/**
 * Asset Doctor — Mobile Offline-First Sync Engine & Mutation Queue
 * Manages scoped offline storage, queued mutations, background sync, and conflict resolution.
 */

import { db, auth } from '../firebase.ts';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  serverTimestamp
} from 'firebase/firestore';

export type EntityType = 'asset' | 'document' | 'service_record' | 'user_profile';
export type OperationType = 'create' | 'update' | 'delete';
export type SyncStatus = 'PENDING_SYNC' | 'SYNCED' | 'FAILED_CONFLICT';

export interface QueuedMutation {
  operationId: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  payload: any;
  createdAt: string;
  retryCount: number;
  syncStatus: SyncStatus;
  conflictReason?: string;
  serverVersion?: number;
  localVersion?: number;
}

export interface SyncEngineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  conflictCount: number;
}

class MobileSyncEngine {
  private queueKey = 'assetdoctor_sync_queue';
  private syncListeners: ((status: SyncEngineStatus) => void)[] = [];
  private isSyncing = false;
  private lastSyncedAt: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncEngine] Network reconnected — flushing offline queue');
        this.flushQueue();
      });
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          this.flushQueue();
        }
      });
    }
  }

  /**
   * Get Storage Key Scoped to Authenticated User
   */
  private getUserKey(baseKey: string, userId?: string): string {
    const uid = userId || auth.currentUser?.uid || 'anonymous';
    return `assetdoctor_${uid}_${baseKey}`;
  }

  private memoryStore = new Map<string, string>();

  /**
   * Read Local Storage Scoped to User
   */
  public getLocalData<T>(key: string, defaultValue: T, userId?: string): T {
    try {
      const scopedKey = this.getUserKey(key, userId);
      let raw: string | null = null;
      if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(scopedKey);
      } else {
        raw = this.memoryStore.get(scopedKey) || null;
      }
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[SyncEngine] Error reading local data:', e);
    }
    return defaultValue;
  }

  /**
   * Save Local Storage Scoped to User
   */
  public setLocalData<T>(key: string, data: T, userId?: string): void {
    try {
      const scopedKey = this.getUserKey(key, userId);
      const str = JSON.stringify(data);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(scopedKey, str);
      } else {
        this.memoryStore.set(scopedKey, str);
      }
    } catch (e) {
      console.warn('[SyncEngine] Error saving local data:', e);
    }
  }

  /**
   * Get Current Mutation Queue
   */
  public getQueue(userId?: string): QueuedMutation[] {
    return this.getLocalData<QueuedMutation[]>(this.queueKey, [], userId);
  }

  /**
   * Save Mutation Queue
   */
  private saveQueue(queue: QueuedMutation[], userId?: string): void {
    this.setLocalData<QueuedMutation[]>(this.queueKey, queue, userId);
    this.notifyStatus();
  }

  /**
   * Enqueue a Mutation for Offline / Online Execution
   */
  public async enqueueMutation(
    entityType: EntityType,
    entityId: string,
    operation: OperationType,
    payload: any,
    userId?: string
  ): Promise<string> {
    const currentUid = userId || auth.currentUser?.uid;
    if (!currentUid) {
      console.warn('[SyncEngine] No user authenticated for mutation');
    }

    const uid = currentUid || 'guest_user';
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const mutation: QueuedMutation = {
      operationId,
      userId: uid,
      entityType,
      entityId,
      operation,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      syncStatus: 'PENDING_SYNC',
      localVersion: (payload && payload.version) ? payload.version : 1
    };

    const queue = this.getQueue(uid);
    // Check if an existing pending mutation for this entity exists; merge if appropriate
    const existingIdx = queue.findIndex(q => q.entityId === entityId && q.entityType === entityType && q.syncStatus === 'PENDING_SYNC');
    if (existingIdx >= 0) {
      if (operation === 'delete') {
        queue[existingIdx] = mutation;
      } else {
        queue[existingIdx].payload = { ...queue[existingIdx].payload, ...payload };
        queue[existingIdx].createdAt = mutation.createdAt;
      }
    } else {
      queue.push(mutation);
    }

    this.saveQueue(queue, uid);

    // If online, immediately attempt to flush
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.flushQueue(uid);
    }

    return operationId;
  }

  /**
   * Flush Pending Queue to Firestore with Conflict Arbitration
   */
  public async flushQueue(userId?: string): Promise<{ synced: number; conflicts: number; errors: number }> {
    if (this.isSyncing) return { synced: 0, conflicts: 0, errors: 0 };
    const currentUid = userId || auth.currentUser?.uid;
    if (!currentUid) return { synced: 0, conflicts: 0, errors: 0 };

    this.isSyncing = true;
    this.notifyStatus();

    let synced = 0;
    let conflicts = 0;
    let errors = 0;

    try {
      const queue = this.getQueue(currentUid);
      const pending = queue.filter(q => q.syncStatus === 'PENDING_SYNC');

      for (const item of pending) {
        try {
          const success = await this.executeFirestoreMutation(item);
          if (success) {
            item.syncStatus = 'SYNCED';
            synced++;
          } else {
            item.retryCount++;
            errors++;
          }
        } catch (err: any) {
          if (err?.message?.includes('conflict') || err?.code === 'failed-precondition') {
            item.syncStatus = 'FAILED_CONFLICT';
            item.conflictReason = err.message || 'Sync conflict — server has newer version';
            conflicts++;
          } else {
            item.retryCount++;
            errors++;
          }
        }
      }

      // Remove synced items from local queue after completion
      const remaining = queue.filter(q => q.syncStatus !== 'SYNCED');
      this.saveQueue(remaining, currentUid);
      this.lastSyncedAt = new Date().toISOString();
    } catch (e) {
      console.error('[SyncEngine] Error flushing queue:', e);
    } finally {
      this.isSyncing = false;
      this.notifyStatus();
    }

    return { synced, conflicts, errors };
  }

  /**
   * Execute Single Mutation Against Firestore
   */
  private async executeFirestoreMutation(mutation: QueuedMutation): Promise<boolean> {
    const { userId, entityType, entityId, operation, payload } = mutation;

    // Determine Firestore Document Reference
    let docRef: any;
    if (entityType === 'asset') {
      docRef = doc(db, 'Users', userId, 'Assets', entityId);
    } else if (entityType === 'document') {
      const assetId = payload.assetId || 'general';
      docRef = doc(db, 'Users', userId, 'Assets', assetId, 'Documents', entityId);
    } else if (entityType === 'service_record') {
      docRef = doc(db, 'service_records', entityId);
    } else if (entityType === 'user_profile') {
      docRef = doc(db, 'users', userId);
    } else {
      throw new Error(`Unsupported entity type: ${entityType}`);
    }

    // 1. Conflict Detection: Check server version vs local
    if (operation === 'update') {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const serverData = snap.data() as any;
          const serverUpdatedAt = serverData.updatedAt || serverData.lastModified;
          const localUpdatedAt = payload.updatedAt || payload.lastModified;

          if (serverUpdatedAt && localUpdatedAt && new Date(serverUpdatedAt) > new Date(localUpdatedAt)) {
            // Server data is newer; verify if there is an unresolvable field conflict
            const hasConflict = Object.keys(payload).some(
              key => serverData[key] !== undefined && serverData[key] !== payload[key] && key !== 'updatedAt'
            );
            if (hasConflict) {
              throw new Error('Sync conflict — review required (server has newer updates)');
            }
          }
        }
      } catch (e: any) {
        if (e.message?.includes('Sync conflict')) throw e;
        // Ignore read errors and proceed with write
      }
    }

    // 2. Perform Operation
    if (operation === 'create' || operation === 'update') {
      const cleanPayload = {
        ...payload,
        userId,
        syncStatus: 'SYNCED',
        syncedAt: new Date().toISOString()
      };
      await setDoc(docRef, cleanPayload, { merge: true });
      return true;
    } else if (operation === 'delete') {
      // Soft-delete or hard delete
      await setDoc(docRef, { isDeleted: true, deletedAt: new Date().toISOString() }, { merge: true });
      return true;
    }

    return false;
  }

  /**
   * Subscribe to Sync Status Changes
   */
  public subscribeStatus(callback: (status: SyncEngineStatus) => void): () => void {
    this.syncListeners.push(callback);
    callback(this.getStatus());
    return () => {
      this.syncListeners = this.syncListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Get Current Sync Status
   */
  public getStatus(): SyncEngineStatus {
    const queue = this.getQueue();
    const pendingCount = queue.filter(q => q.syncStatus === 'PENDING_SYNC').length;
    const conflictCount = queue.filter(q => q.syncStatus === 'FAILED_CONFLICT').length;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    return {
      isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      conflictCount
    };
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    this.syncListeners.forEach(cb => {
      try {
        cb(status);
      } catch (_) {}
    });
  }
}

export const syncEngine = new MobileSyncEngine();

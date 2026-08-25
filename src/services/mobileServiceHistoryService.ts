/**
 * Asset Doctor — Mobile Service History & Prediction Integration Service
 * Manages service records, real-time Firestore sync, offline caching, and Next Service Prediction.
 */

import { db, auth } from '../firebase.ts';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { syncEngine } from './mobileSyncEngine.ts';
import { predictNextServiceDue } from '../../services/servicePrediction/predictionEngine.ts';
import { matchOemSchedule } from '../../services/servicePrediction/oemDatabase.ts';
import type { Asset, ServiceRecord, NextServicePredictionResult } from '../types.ts';

export class MobileServiceHistoryService {
  private static getCacheKey(assetId: string): string {
    return `service_records_${assetId}`;
  }

  /**
   * Get Cached Service Records for an Asset
   */
  public static getCachedRecords(assetId: string, userId?: string): ServiceRecord[] {
    const key = this.getCacheKey(assetId);
    return syncEngine.getLocalData<ServiceRecord[]>(key, [], userId);
  }

  /**
   * Cache Service Records Locally
   */
  public static cacheRecords(assetId: string, records: ServiceRecord[], userId?: string): void {
    const key = this.getCacheKey(assetId);
    syncEngine.setLocalData<ServiceRecord[]>(key, records, userId);
  }

  /**
   * Calculate Next Service Prediction for an Asset (Offline or Online)
   */
  public static calculatePrediction(asset: Asset, records?: ServiceRecord[]): NextServicePredictionResult {
    const serviceHistory = records || this.getCachedRecords(asset.id);
    return predictNextServiceDue(asset, serviceHistory as any, {
      referenceDateIST: new Date()
    }) as any;
  }

  /**
   * Subscribe to Real-Time Service Records for an Asset
   */
  public static subscribeAssetServiceRecords(
    asset: Asset,
    onUpdate: (records: ServiceRecord[], prediction: NextServicePredictionResult) => void
  ): () => void {
    const userId = auth.currentUser?.uid || 'guest_user';
    const cached = this.getCachedRecords(asset.id, userId);

    // Initial emission with cached data
    onUpdate(cached, this.calculatePrediction(asset, cached));

    if (!userId || userId === 'guest_user') {
      return () => {};
    }

    try {
      // Listen to /service_records where assetId == asset.id
      const recordsRef = collection(db, 'service_records');
      const q = query(recordsRef, where('assetId', '==', asset.id));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const liveRecords: ServiceRecord[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            liveRecords.push({
              id: docSnap.id,
              ...data
            } as ServiceRecord);
          });

          // Sort chronologically
          liveRecords.sort((a, b) => (a.serviceDate > b.serviceDate ? 1 : -1));

          // Merge any pending offline mutations
          const queue = syncEngine.getQueue(userId);
          const pendingRecords = queue.filter(
            q => q.entityType === 'service_record' && q.syncStatus === 'PENDING_SYNC' && q.payload.assetId === asset.id
          );

          pendingRecords.forEach(p => {
            const existingIdx = liveRecords.findIndex(r => r.id === p.entityId);
            if (existingIdx >= 0) {
              liveRecords[existingIdx] = { ...liveRecords[existingIdx], ...p.payload };
            } else {
              liveRecords.push({ id: p.entityId, ...p.payload });
            }
          });

          this.cacheRecords(asset.id, liveRecords, userId);
          const prediction = predictNextServiceDue(asset, liveRecords as any, { referenceDateIST: new Date() }) as any;
          onUpdate(liveRecords, prediction);
        },
        (error) => {
          console.warn('[ServiceHistoryService] Firestore listener error, using cache:', error);
          const fallbackRecords = this.getCachedRecords(asset.id, userId);
          onUpdate(fallbackRecords, this.calculatePrediction(asset, fallbackRecords));
        }
      );

      return unsubscribe;
    } catch (e) {
      console.warn('[ServiceHistoryService] Snapshot subscription error:', e);
      return () => {};
    }
  }

  /**
   * Add a New Service Record (Offline-First)
   */
  public static async addServiceRecord(
    assetId: string,
    record: Omit<ServiceRecord, 'id'>,
    userId?: string
  ): Promise<string> {
    const uid = userId || auth.currentUser?.uid || 'guest_user';
    const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const fullRecord: ServiceRecord = {
      ...record,
      id: recordId,
      assetId,
      userId: uid,
      createdAt: new Date().toISOString()
    };

    // Save to local cache immediately
    const current = this.getCachedRecords(assetId, uid);
    current.push(fullRecord);
    current.sort((a, b) => (a.serviceDate > b.serviceDate ? 1 : -1));
    this.cacheRecords(assetId, current, uid);

    // Enqueue for cloud sync
    await syncEngine.enqueueMutation(
      'service_record',
      recordId,
      'create',
      fullRecord,
      uid
    );

    return recordId;
  }
}

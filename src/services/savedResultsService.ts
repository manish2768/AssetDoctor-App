/**
 * Asset Doctor — Customer Saved Results Service
 * Real-time Firestore sync & local caching for authenticated user calculation results.
 */

import { db, auth } from '../firebase';
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { GuestSessionService, GuestCalculation } from './guestSessionService';

export interface SavedCalculationResult {
  id: string;
  userId: string;
  toolType: 'REPAIR_VS_REPLACE' | 'DEPRECIATION' | 'WARRANTY' | 'TCO' | 'MAINTENANCE' | 'HEALTH_SCORE';
  assetName: string;
  assetCategory: string;
  summary: string;
  primaryMetricLabel: string;
  primaryMetricValue: string | number;
  details: Record<string, any>;
  calculatedAt: string;
  updatedAt?: string;
  syncStatus?: 'SYNCED' | 'PENDING_SYNC';
}

const SAVED_RESULTS_CACHE_PREFIX = 'assetdoctor_saved_results_';
const memoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (_) {}
  return memoryStore[key] || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch (_) {}
  memoryStore[key] = value;
}

export class SavedResultsService {
  /**
   * Get cached saved results for instant UI render
   */
  public static getCachedSavedResults(userId: string): SavedCalculationResult[] {
    if (!userId || userId === 'guest_user') return [];
    try {
      const raw = safeGetItem(`${SAVED_RESULTS_CACHE_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('[SavedResultsService] Failed to read cached results:', e);
    }
    return [];
  }

  /**
   * Cache saved results locally
   */
  public static cacheSavedResults(userId: string, results: SavedCalculationResult[]): void {
    if (!userId || userId === 'guest_user') return;
    try {
      safeSetItem(`${SAVED_RESULTS_CACHE_PREFIX}${userId}`, JSON.stringify(results));
    } catch (e) {
      console.warn('[SavedResultsService] Failed to cache saved results:', e);
    }
  }

  /**
   * Subscribe to real-time saved results in Firestore (/Users/{uid}/SavedResults)
   */
  public static subscribeSavedResults(
    userId: string,
    onUpdate: (results: SavedCalculationResult[]) => void,
    onError?: (err: any) => void
  ): () => void {
    if (!userId || userId === 'guest_user') {
      onUpdate([]);
      return () => {};
    }

    // 1. Emit cached immediately
    const cached = this.getCachedSavedResults(userId);
    if (cached.length > 0) {
      onUpdate(cached);
    }

    // 2. Real-time Firestore listener
    try {
      const resultsRef = collection(db, 'Users', userId, 'SavedResults');
      const q = query(resultsRef);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const liveResults: SavedCalculationResult[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            liveResults.push({
              id: docSnap.id,
              userId,
              toolType: data.toolType || 'REPAIR_VS_REPLACE',
              assetName: data.assetName || 'Custom Asset',
              assetCategory: data.assetCategory || 'General',
              summary: data.summary || '',
              primaryMetricLabel: data.primaryMetricLabel || 'Outcome',
              primaryMetricValue: data.primaryMetricValue || '',
              details: data.details || {},
              calculatedAt: data.calculatedAt || new Date().toISOString(),
              updatedAt: data.updatedAt,
              syncStatus: 'SYNCED'
            });
          });

          // Sort by newest calculatedAt
          liveResults.sort((a, b) => new Date(b.calculatedAt).getTime() - new Date(a.calculatedAt).getTime());

          this.cacheSavedResults(userId, liveResults);
          onUpdate(liveResults);
        },
        (error) => {
          console.warn('[SavedResultsService] Firestore listener error, using cache:', error);
          if (onError) onError(error);
          onUpdate(this.getCachedSavedResults(userId));
        }
      );

      return unsubscribe;
    } catch (e) {
      console.warn('[SavedResultsService] Failed to attach snapshot listener:', e);
      return () => {};
    }
  }

  /**
   * Save a calculation result for authenticated user
   */
  public static async saveCalculationResult(
    userId: string,
    calc: Omit<SavedCalculationResult, 'id' | 'userId' | 'calculatedAt'>
  ): Promise<SavedCalculationResult> {
    const uid = userId || auth.currentUser?.uid;
    if (!uid || uid === 'guest_user') {
      throw new Error('Authentication required to save persistent calculation results.');
    }

    const resultId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRecord: SavedCalculationResult = {
      ...calc,
      id: resultId,
      userId: uid,
      calculatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'SYNCED'
    };

    // 1. Update local cache immediately
    const current = this.getCachedSavedResults(uid);
    const updated = [newRecord, ...current.filter(r => r.id !== resultId)];
    this.cacheSavedResults(uid, updated);

    // 2. Persist to Firestore
    try {
      const docRef = doc(db, 'Users', uid, 'SavedResults', resultId);
      await setDoc(docRef, newRecord);
    } catch (e) {
      console.warn('[SavedResultsService] Failed to persist to Firestore:', e);
    }

    return newRecord;
  }

  /**
   * Delete a saved calculation result
   */
  public static async deleteCalculationResult(userId: string, resultId: string): Promise<void> {
    const uid = userId || auth.currentUser?.uid;
    if (!uid || uid === 'guest_user') return;

    // 1. Remove from local cache immediately
    const current = this.getCachedSavedResults(uid);
    const filtered = current.filter(r => r.id !== resultId);
    this.cacheSavedResults(uid, filtered);

    // 2. Delete from Firestore
    try {
      const docRef = doc(db, 'Users', uid, 'SavedResults', resultId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('[SavedResultsService] Failed to delete from Firestore:', e);
    }
  }

  /**
   * Migrate guest calculations to authenticated user's vault upon sign in
   */
  public static async migrateGuestCalculations(userId: string): Promise<number> {
    const guestItems = GuestSessionService.getGuestCalculations();
    if (guestItems.length === 0 || !userId || userId === 'guest_user') return 0;

    let migratedCount = 0;
    for (const item of guestItems) {
      try {
        await this.saveCalculationResult(userId, {
          toolType: item.toolType,
          assetName: item.assetName,
          assetCategory: item.assetCategory,
          summary: item.summary,
          primaryMetricLabel: item.primaryMetricLabel,
          primaryMetricValue: item.primaryMetricValue,
          details: item.details
        });
        migratedCount++;
      } catch (e) {
        console.warn('[SavedResultsService] Migration failed for item:', item.assetName, e);
      }
    }

    // Clear guest calculations once migrated
    GuestSessionService.clearGuestCalculations();
    return migratedCount;
  }
}

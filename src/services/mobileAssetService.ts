/**
 * Asset Doctor — Mobile Asset Service
 * Real-time Firestore sync with offline-first caching and schema normalization.
 */

import { db, auth } from '../firebase.ts';
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDocs,
  where
} from 'firebase/firestore';
import { syncEngine } from './mobileSyncEngine.ts';
import type { Asset, AssetCategory, WarrantyStatus } from '../types.ts';
import { calculateExpiryDays } from '../utils/assetUtils.ts';

const ASSETS_CACHE_KEY = 'cached_assets';

export function normalizeAssetData(id: string, raw: any): Asset {
  const name = raw.name || raw.assetName || raw.model || raw.title || 'Untitled Asset';
  const brand = raw.brand || raw.brandName || raw.make || '';
  const category: AssetCategory = (raw.category || raw.categoryLabel || 'Other') as AssetCategory;
  const price = typeof raw.price === 'number' ? raw.price : parseFloat(raw.price || raw.totalAmount || '0') || 0;
  const purchaseDate = raw.purchaseDate || raw.invoiceDate || raw.serviceDate || new Date().toISOString().split('T')[0];
  const warrantyMonths = raw.warrantyMonths || 12;
  const expiryDate = raw.expiryDate || raw.warrantyExpiry || raw.warrantyExpiryDate || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];

  const { daysRemaining, status } = calculateExpiryDays(expiryDate);

  return {
    id,
    name,
    brand,
    category,
    price,
    purchaseDate,
    warrantyMonths,
    expiryDate,
    insuranceExpiryDate: raw.insuranceExpiryDate || raw.insuranceExpiry || undefined,
    pucExpiryDate: raw.pucExpiryDate || raw.pucExpiry || undefined,
    serviceDate: raw.serviceDate || raw.lastServiceDate || undefined,
    maintenanceDueDate: raw.maintenanceDueDate || raw.nextServiceDue || undefined,
    maintenanceType: raw.maintenanceType || undefined,
    serialNumber: raw.serialNumber || raw.chassisNumber || raw.registration || undefined,
    imei: /^\d{15}$/.test(String(raw.imei || '').replace(/\D/g, ''))
      ? String(raw.imei).replace(/\D/g, '')
      : undefined,
    vendor: raw.vendor || raw.dealer || raw.workshop || undefined,
    notes: raw.notes || '',
    receiptImageUrl: raw.receiptImageUrl || raw.documentUrl || undefined,
    imageUrl: raw.imageUrl || undefined,
    daysRemaining: daysRemaining ?? 365,
    status: (status as WarrantyStatus) || 'active',
    gstin: raw.gstin || undefined,
    scamGuardStatus: raw.scamGuardStatus || undefined,
    serviceLogs: raw.serviceLogs || [],
    // Extended mobile fields
    odometerKm: raw.odometerKm || raw.currentOdometer || raw.currentKm || undefined,
    registration: raw.registration || raw.registrationNumber || raw.vehicleNumber || undefined,
    modelYear: raw.modelYear || raw.year || undefined,
    fuelType: raw.fuelType || undefined,
    syncStatus: raw.syncStatus || 'SYNCED',
    isDeleted: Boolean(raw.isDeleted)
  } as Asset;
}

export class MobileAssetService {
  /**
   * Get Cached Assets Instantly
   */
  public static getCachedAssets(userId?: string): Asset[] {
    const cached = syncEngine.getLocalData<Asset[]>(ASSETS_CACHE_KEY, [], userId);
    return cached.filter(a => !(a as any).isDeleted);
  }

  /**
   * Save Assets to Local Cache
   */
  public static cacheAssets(assets: Asset[], userId?: string): void {
    syncEngine.setLocalData(ASSETS_CACHE_KEY, assets, userId);
  }

  /**
   * Canonical & Compatibility Wrappers for Local Asset Persistence
   */
  public static setLocalAssetData(userId: string, assets: Asset[]): void {
    this.cacheAssets(assets, userId);
  }

  public static getLocalAssetData(userId: string): Asset[] {
    return this.getCachedAssets(userId);
  }

  /**
   * Subscribe to Real-Time Assets (Firestore + Local Fallback)
   */
  public static subscribeUserAssets(
    userId: string,
    onUpdate: (assets: Asset[]) => void,
    onError?: (err: any) => void
  ): () => void {
    // 1. Immediately emit cached assets for instant UI render
    const cached = this.getCachedAssets(userId);
    if (cached.length > 0) {
      onUpdate(cached);
    }

    if (!userId || userId === 'guest_user') {
      return () => {};
    }

    // 2. Setup Real-Time Firestore Listener on /Users/{uid}/Assets
    try {
      const assetsRef = collection(db, 'Users', userId, 'Assets');
      const q = query(assetsRef);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const liveAssets: Asset[] = [];
          snapshot.forEach((docSnap) => {
            const raw = docSnap.data();
            if (!raw.isDeleted) {
              liveAssets.push(normalizeAssetData(docSnap.id, raw));
            }
          });

          // Check if there are local offline mutations pending that have not synced yet
          const queue = syncEngine.getQueue(userId);
          const pendingAssets = queue.filter(q => q.entityType === 'asset' && q.syncStatus === 'PENDING_SYNC');

          pendingAssets.forEach(p => {
            const existingIdx = liveAssets.findIndex(a => a.id === p.entityId);
            if (p.operation === 'delete') {
              if (existingIdx >= 0) liveAssets.splice(existingIdx, 1);
            } else if (p.operation === 'create' || p.operation === 'update') {
              const merged = normalizeAssetData(p.entityId, { ...(existingIdx >= 0 ? liveAssets[existingIdx] : {}), ...p.payload, syncStatus: 'PENDING_SYNC' });
              if (existingIdx >= 0) {
                liveAssets[existingIdx] = merged;
              } else {
                liveAssets.unshift(merged);
              }
            }
          });

          this.cacheAssets(liveAssets, userId);
          onUpdate(liveAssets);
        },
        (error) => {
          console.warn('[AssetService] Live Firestore listener error, using cache:', error);
          if (onError) onError(error);
          // Fallback to cache on error/offline
          onUpdate(this.getCachedAssets(userId));
        }
      );

      return unsubscribe;
    } catch (e) {
      console.warn('[AssetService] Failed to attach snapshot listener:', e);
      return () => {};
    }
  }

  /**
   * Create or Update Asset (Offline-First)
   */
  public static async saveAsset(asset: Partial<Asset>, userId?: string): Promise<string> {
    const uid = userId || auth.currentUser?.uid || 'guest_user';
    const assetId = asset.id || `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const isNew = !asset.id;

    const payload = {
      ...asset,
      id: assetId,
      updatedAt: new Date().toISOString()
    };

    // Update local cache immediately
    const current = this.getCachedAssets(uid);
    const normalized = normalizeAssetData(assetId, { ...payload, syncStatus: 'PENDING_SYNC' });
    const idx = current.findIndex(a => a.id === assetId);

    if (idx >= 0) {
      current[idx] = normalized;
    } else {
      current.unshift(normalized);
    }
    this.cacheAssets(current, uid);

    // Enqueue mutation for cloud sync
    await syncEngine.enqueueMutation(
      'asset',
      assetId,
      isNew ? 'create' : 'update',
      payload,
      uid
    );

    return assetId;
  }

  /**
   * Delete Asset (Offline-First Soft Delete)
   */
  public static async deleteAsset(assetId: string, userId?: string): Promise<void> {
    const uid = userId || auth.currentUser?.uid || 'guest_user';

    // Remove from local cache immediately
    const current = this.getCachedAssets(uid);
    const filtered = current.filter(a => a.id !== assetId);
    this.cacheAssets(filtered, uid);

    // Enqueue delete mutation
    await syncEngine.enqueueMutation(
      'asset',
      assetId,
      'delete',
      { isDeleted: true },
      uid
    );
  }
}

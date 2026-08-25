import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from './AuthProvider';
import { AssetService, createAssetId } from '../services/assets/AssetService';
import { ExpiryAlertService } from '../services/notifications/ExpiryAlertService';
import { calculatePortfolioHealth } from '../utils/healthScore';
import { estimatePortfolioDailyCost } from '../utils/powerCost';
import { aggregateEnergyPortfolio } from '../services/energy/EnergyService';
import { Haptics } from '../services/haptics';
import { DEMO_ASSETS, isDemoAssetId } from '../data/demoAssets';
import { OfflineVaultCache } from '../services/offline/OfflineVaultCache';
import { DocumentVaultService } from '../services/documents/DocumentVaultService';
import { resolveVaultDocumentMeta } from '../services/ocr/documentTypeClassifier';
import {
  findVehicleAsset,
  isVehicleAttachDocument,
  isVehicleCategory,
  listVehicleAssets,
  normalizeRegistration,
} from '../utils/vehicleFolder';
import { renewVehicleDocument } from '../services/vehicles/DocumentRenewalService';
import { matchVehicleForDocument } from '../services/vehicles/VehicleMatchService';

const AssetContext = createContext(null);

export function AssetProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionUid, setSessionUid] = useState(null);

  // Warm persisted auth session so Edit/Delete work while Firebase restores
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { loadAuthSession } = require('../services/authService');
        const session = await loadAuthSession();
        if (!cancelled && session?.uid) setSessionUid(session.uid);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, isAuthenticated]);

  const effectiveUid = user?.uid || sessionUid || null;

  useEffect(() => {
    const uid = effectiveUid;
    if (!uid) {
      try {
        const { normalizeAssetList } = require('../services/storageService');
        setAssets(normalizeAssetList(DEMO_ASSETS));
      } catch {
        setAssets(DEMO_ASSETS);
      }
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    // Prefer live Firestore only when Firebase user is confirmed
    if (user?.uid) {
      let settled = false;
      const finish = (list) => {
        if (settled) return;
        settled = true;
        if (Array.isArray(list)) setAssets(list);
        setLoading(false);
      };

      // Warm local encrypted cache immediately
      OfflineVaultCache.getAssets(user.uid)
        .then((list) => {
          if (!settled && Array.isArray(list) && list.length) setAssets(list);
        })
        .catch(() => {});

      const unsub = AssetService.listenToUserAssets(
        user.uid,
        (list) => finish(list),
        () => finish(undefined),
      );
      // Strict 5s: never leave Dashboard on "Loading vault…" forever
      const timer = setTimeout(() => finish(undefined), 5000);
      return () => {
        settled = true;
        clearTimeout(timer);
        try {
          unsub?.();
        } catch {
          /* ignore */
        }
      };
    }

    // Session-only: load encrypted offline cache for this uid
    OfflineVaultCache.getAssets(uid)
      .then((list) => {
        if (Array.isArray(list) && list.length) setAssets(list);
        else {
          try {
            const { normalizeAssetList } = require('../services/storageService');
            setAssets(normalizeAssetList(DEMO_ASSETS));
          } catch {
            setAssets(DEMO_ASSETS);
          }
        }
      })
      .catch(() => setAssets(DEMO_ASSETS))
      .finally(() => setLoading(false));
    return undefined;
  }, [effectiveUid, user?.uid]);

  useEffect(() => {
    if (!isAuthenticated || !assets.length) return;
    if (assets.some((a) => a.isDemo)) return;
    ExpiryAlertService.syncPortfolioAlerts(assets).catch(() => {});
  }, [assets, isAuthenticated]);

  const createAsset = useCallback(
    async (form, localImagePath) => {
      const uid = user?.uid || sessionUid;
      if (!uid) {
        return { success: false, error: 'Please sign in to save assets to your vault.' };
      }
      const effectiveUid = uid;

      const attachDoc = isVehicleAttachDocument(form);
      const linkedById = form.linkAssetId
        ? assets.find((a) => (a.assetId || a.id) === form.linkAssetId)
        : null;
      const match = matchVehicleForDocument(assets, form);
      const existing = linkedById || match.matched || findVehicleAsset(assets, form) || null;

      // Insurance / PUC / RC / Warranty → renew onto vehicle passport (never duplicate vehicle)
      if (attachDoc) {
        if (!existing) {
          const vehicles = listVehicleAssets(assets);
          return {
            success: false,
            needsVehicleLink: true,
            vehicles,
            matchBy: null,
            error:
              vehicles.length > 0
                ? 'Select the vehicle this document belongs to.'
                : 'Add the vehicle invoice first, then scan Insurance / PUC / RC onto it.',
          };
        }
        const assetId = existing.assetId || existing.id;
        const renewed = await renewVehicleDocument({
          userId: effectiveUid,
          assetId,
          form,
          localImagePath: localImagePath || null,
          existingAsset: existing,
        });
        if (!renewed.success) {
          return {
            success: false,
            error: renewed.error || 'Could not renew document on vehicle',
          };
        }
        return {
          success: true,
          id: assetId,
          merged: true,
          renewed: true,
          archivedCount: renewed.archivedCount || 0,
          matchBy: match.matchBy || (linkedById ? 'link' : null),
          asset: renewed.asset,
        };
      }

      // Same vehicle (link / registration / chassis) → merge into existing passport
      if (existing && (isVehicleCategory(form) || form.isVehicleInvoice || form.linkAssetId)) {
        const assetId = existing.assetId || existing.id;
        const vaultMeta = resolveVaultDocumentMeta(form);
        const updates = {
          ...(form.warrantyExpiry ? { warrantyExpiry: form.warrantyExpiry } : {}),
          ...(form.pucExpiry ? { pucExpiry: form.pucExpiry } : {}),
          ...(form.insuranceExpiry ? { insuranceExpiry: form.insuranceExpiry } : {}),
          ...(form.nextServiceDue ? { nextServiceDue: form.nextServiceDue } : {}),
          ...(form.chassisNumber && !/^(?:no|n\/a|na|nil)$/i.test(String(form.chassisNumber).trim())
            ? { chassisNumber: form.chassisNumber }
            : {}),
          ...(form.engineNumber && !/^(?:no|n\/a|na|nil)$/i.test(String(form.engineNumber).trim())
            ? { engineNumber: form.engineNumber }
            : {}),
          ...(form.serialNumber ? { serialNumber: form.serialNumber } : {}),
          ...(form.value ? { value: form.value } : {}),
          ...(form.purchaseDate ? { purchaseDate: form.purchaseDate } : {}),
          ...(form.assetName ? { assetName: form.assetName } : {}),
          ...(form.storeName ? { storeName: form.storeName } : {}),
          ...(form.invoiceMeta ? { invoiceMeta: form.invoiceMeta } : {}),
          ...(form.odometerKm != null ? { odometerKm: form.odometerKm } : {}),
          registration: existing.registration || form.registration || '',
        };
        const updated = await AssetService.updateAsset(effectiveUid, assetId, updates, null);
        if (!updated?.success) {
          return {
            success: false,
            error: updated?.error || 'Could not update existing vehicle passport',
          };
        }
        if (localImagePath) {
          await DocumentVaultService.uploadDocument(effectiveUid, assetId, {
            localPath: localImagePath,
            type: vaultMeta.type,
            label: vaultMeta.label,
          }).catch(() => {});
        }
        return {
          success: true,
          id: assetId,
          merged: true,
          asset: { ...existing, ...updates },
        };
      }

      const id = form.assetId || createAssetId();
      const formWithId = {
        ...form,
        assetId: id,
        ownerPhoneNumber: user?.phoneNumber || '',
        registration: form.registration
          ? String(form.registration).toUpperCase().replace(/\s+/g, ' ').trim()
          : '',
      };
      if (localImagePath) {
        const vaultMeta = resolveVaultDocumentMeta(formWithId);
        await OfflineVaultCache.cacheDocument(effectiveUid, id, {
          docId: `scan_${id}`,
          type: vaultMeta.type,
          label: vaultMeta.label,
          mimeType: 'image/jpeg',
          localPath: localImagePath,
          pendingSync: true,
        }).catch(() => {});
      }
      const result = await AssetService.createFromForm(effectiveUid, formWithId, localImagePath);
      if (!result.success && result.queuedOffline) {
        const offlineRow = {
          ...(result.asset || formWithId),
          id: result.id || id,
          assetId: result.id || id,
          pendingSync: true,
          syncStatus: 'PENDING_CREATE',
          createdAt: new Date().toISOString(),
        };
        await OfflineVaultCache.upsertAsset(effectiveUid, offlineRow).catch(() => {});
        setAssets((current) => {
          const exists = current.some((a) => (a.assetId || a.id) === offlineRow.assetId);
          if (exists) {
            return current.map((a) =>
              (a.assetId || a.id) === offlineRow.assetId ? { ...a, ...offlineRow } : a,
            );
          }
          return [offlineRow, ...current];
        });
        return { success: true, queuedOffline: true, id: offlineRow.assetId };
      }
      return result;
    },
    [user?.uid, sessionUid, user?.phoneNumber, assets],
  );

  const updateAsset = useCallback(
    async (assetId, updates, localImagePath) => {
      const uid = user?.uid || sessionUid;
      if (!uid) return { success: false, error: 'Please sign in to edit assets.' };
      if (!assetId) return { success: false, error: 'assetId required' };
      if (isDemoAssetId(assetId)) {
        return { success: false, error: 'Demo asset — sign in to save your own.' };
      }
      const result = await AssetService.updateAsset(
        uid,
        assetId,
        updates,
        localImagePath,
      );
      if (!result.success && result.queuedOffline) {
        await OfflineVaultCache.upsertAsset(uid, {
          assetId,
          id: assetId,
          ...updates,
          pendingSync: true,
          syncStatus: 'PENDING_UPDATE',
        }).catch(() => {});
        setAssets((current) =>
          current.map((asset) =>
            (asset.assetId || asset.id) === assetId
              ? { ...asset, ...updates, pendingSync: true, syncStatus: 'PENDING_UPDATE' }
              : asset,
          ),
        );
        return { success: true, queuedOffline: true, id: assetId };
      }
      return result;
    },
    [user?.uid, sessionUid],
  );

  const removeAsset = useCallback(
    async (assetId) => {
      const uid = user?.uid || sessionUid;
      if (!uid) return { success: false, error: 'Please sign in to delete assets.' };
      if (isDemoAssetId(assetId)) {
        return { success: false, error: 'Demo asset — sign in to manage your vault.' };
      }
      Haptics.tap();
      const result = await AssetService.softDeleteAsset(uid, assetId);
      if (result?.success) {
        setAssets((current) =>
          current.filter((a) => (a.assetId || a.id) !== assetId),
        );
      }
      return result;
    },
    [user?.uid, sessionUid],
  );

  const portfolioHealth = useMemo(() => calculatePortfolioHealth(assets), [assets]);
  const dailyPower = useMemo(() => {
    const aggregated = aggregateEnergyPortfolio(assets);
    if (aggregated.tracked > 0) return aggregated;
    return estimatePortfolioDailyCost(assets);
  }, [assets]);
  const urgent = useMemo(() => ExpiryAlertService.getUrgentAssets(assets), [assets]);

  const value = useMemo(
    () => ({
      assets,
      loading,
      createAsset,
      updateAsset,
      removeAsset,
      portfolioHealth,
      dailyPower,
      urgent,
      isGuestDemo: !isAuthenticated,
      getAsset: (id) => assets.find((a) => a.id === id || a.assetId === id),
    }),
    [assets, loading, createAsset, updateAsset, removeAsset, portfolioHealth, dailyPower, urgent, isAuthenticated],
  );

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
}

export function useAssets() {
  const ctx = useContext(AssetContext);
  if (!ctx) throw new Error('useAssets must be used within AssetProvider');
  return ctx;
}

export default AssetProvider;

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
import { filterActiveAssets, removeAssetFromList } from './assetVaultState';
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
      let isFirstEmission = true;

      // Warm local encrypted cache immediately
      OfflineVaultCache.getAssets(user.uid)
        .then((list) => {
          if (isFirstEmission && Array.isArray(list) && list.length) {
            setAssets(filterActiveAssets(list));
          }
        })
        .catch(() => {});

      const unsub = AssetService.listenToUserAssets(
        user.uid,
        (list) => {
          isFirstEmission = false;
          if (Array.isArray(list)) {
            setAssets(filterActiveAssets(list));
          }
          setLoading(false);
        },
        (error) => {
          console.warn('[AssetProvider] Live listen error:', error?.message || error);
          setLoading(false);
        },
      );
      // Fallback timeout to clear loading spinner if network is silent
      const timer = setTimeout(() => setLoading(false), 3000);
      return () => {
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
        if (Array.isArray(list) && list.length) setAssets(filterActiveAssets(list));
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
        if (renewed.asset) {
          const mergedRenewed = {
            ...existing,
            ...renewed.asset,
            assetId,
            id: assetId,
          };
          await OfflineVaultCache.upsertAsset(effectiveUid, mergedRenewed).catch(() => {});
          setAssets((current) =>
            current.map((a) =>
              (a.assetId || a.id) === assetId ? mergedRenewed : a,
            ),
          );
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
        const isServiceDoc =
          form.scanDocumentType === 'vehicle_service' ||
          form.documentType === 'VEHICLE_SERVICE' ||
          form.reviewFamily === 'service';

        let nextServiceHistory = Array.isArray(existing.serviceHistory) ? [...existing.serviceHistory] : [];
        if (isServiceDoc) {
          const serviceEntry = {
            id: form.serviceInvoiceNumber || `srv_${Date.now()}`,
            serviceInvoiceNumber: form.serviceInvoiceNumber || form.invoiceNumber || '',
            serviceDate: form.serviceDate || form.invoiceDate || new Date().toISOString().slice(0, 10),
            workshopName: form.workshopName || form.shopName || '',
            odometerKm: form.odometerKm ?? null,
            jobType: form.jobType || '',
            labourAmount: form.labourAmount ?? null,
            partsAmount: form.partsAmount ?? null,
            taxAmount: form.taxAmount ?? null,
            totalAmount: form.totalAmount || form.purchaseAmount || null,
            nextServiceDate: form.nextServiceDate || form.nextServiceDue || '',
            nextServiceKm: form.nextServiceKm ?? null,
            createdAt: new Date().toISOString(),
          };
          nextServiceHistory.push(serviceEntry);
        }

        const isTrustedUpdate =
          form.isTrustedUpdate !== false &&
          !form.hasConflict &&
          !form.isConflict;

        const updates = isTrustedUpdate ? {
          ...(form.warrantyExpiry ? { warrantyExpiry: form.warrantyExpiry } : {}),
          ...(form.warrantyMonths != null ? { warrantyMonths: Number(form.warrantyMonths) } : {}),
          ...(form.assetName ? { assetName: form.assetName } : {}),
          ...(form.brandName || form.brand ? { brandName: form.brandName || form.brand, brand: form.brandName || form.brand } : {}),
          ...(form.model || form.modelName ? { model: form.model || form.modelName } : {}),
          ...(form.rtoCode ? { rtoCode: form.rtoCode } : {}),
          ...(form.fuelNorm ? { fuelNorm: form.fuelNorm } : {}),
          ...(form.fuelType ? { fuelType: form.fuelType } : {}),
          ...(form.emissionNorm ? { emissionNorm: form.emissionNorm } : {}),
          ...(form.condition ? { condition: form.condition } : {}),
          ...(form.supportPhone ? { supportPhone: form.supportPhone } : {}),
          ...(form.supportUrl ? { supportUrl: form.supportUrl } : {}),
          ...(form.lastServiceDate ? { lastServiceDate: form.lastServiceDate } : {}),
          ...(form.dailyHours != null ? { dailyHours: Number(form.dailyHours) } : {}),
          ...(form.powerWatts != null ? { powerWatts: Number(form.powerWatts) } : {}),
          ...(form.powerFactor != null ? { powerFactor: Number(form.powerFactor) } : {}),
          ...(isServiceDoc ? { serviceHistory: nextServiceHistory } : {}),
          ...(form.pucExpiry || form.pucValidUntil
            ? {
                pucExpiry: form.pucExpiry || form.pucValidUntil,
                pucValidUntil: form.pucValidUntil || form.pucExpiry,
              }
            : {}),
          ...(form.certificateNumber || form.pucCertificateNumber
            ? { pucCertificateNumber: form.certificateNumber || form.pucCertificateNumber }
            : {}),
          ...(form.insuranceExpiry || form.policyExpiryDate
            ? {
                insuranceExpiry: form.insuranceExpiry || form.policyExpiryDate,
                insuranceExpiryDate: form.policyExpiryDate || form.insuranceExpiry,
              }
            : {}),
          ...(form.policyNumber
            ? {
                policyNumber: form.policyNumber,
                insurancePolicyNumber: form.policyNumber,
              }
            : {}),
          ...(form.insurerName ? { insuranceInsurer: form.insurerName } : {}),
          ...(form.idv != null ? { insuranceIdv: form.idv } : {}),
          ...(form.premium != null ? { insurancePremium: form.premium } : {}),
          ...(form.nextServiceDate || form.nextServiceDue ? { nextServiceDue: form.nextServiceDate || form.nextServiceDue } : {}),
          ...(form.nextServiceKm != null ? { nextServiceKm: form.nextServiceKm } : {}),
          ...(form.nextServiceOdometerKm != null ? { nextServiceOdometerKm: form.nextServiceOdometerKm } : {}),
          ...(form.chassisNumber && !/^(?:no|n\/a|na|nil)$/i.test(String(form.chassisNumber).trim())
            ? { chassisNumber: form.chassisNumber }
            : {}),
          ...(form.engineNumber && !/^(?:no|n\/a|na|nil)$/i.test(String(form.engineNumber).trim())
            ? { engineNumber: form.engineNumber }
            : {}),
          ...(form.serialNumber ? { serialNumber: form.serialNumber } : {}),
          ...(form.value ? { value: form.value } : {}),
          ...(form.purchaseDate ? { purchaseDate: form.purchaseDate } : {}),
          ...(form.storeName ? { storeName: form.storeName } : {}),
          ...(form.invoiceMeta ? { invoiceMeta: form.invoiceMeta } : {}),
          ...(form.odometerKm != null ? { odometerKm: form.odometerKm } : {}),
          registration: form.registration || existing.registration || '',
        } : {
          registration: form.registration || existing.registration || '',
        };
        const updated = await AssetService.updateAsset(effectiveUid, assetId, updates, null);
        if (!updated?.success) {
          return {
            success: false,
            error: updated?.error || 'Could not update existing vehicle passport',
          };
        }
        const mergedAsset = {
          ...existing,
          ...(updated.asset || {}),
          ...updates,
          assetId,
          id: assetId,
        };
        await OfflineVaultCache.upsertAsset(effectiveUid, mergedAsset).catch(() => {});
        setAssets((current) =>
          current.map((a) => ((a.assetId || a.id) === assetId ? mergedAsset : a)),
        );
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
          asset: mergedAsset,
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
      if (result.success || result.queuedOffline) {
        const resolvedId = result.id || id;
        const newAssetRow = {
          ...(result.asset || formWithId),
          id: resolvedId,
          assetId: resolvedId,
          syncStatus: result.queuedOffline ? 'PENDING_CREATE' : 'SYNCED',
          pendingSync: Boolean(result.queuedOffline),
          createdAt: result.asset?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await OfflineVaultCache.upsertAsset(effectiveUid, newAssetRow).catch(() => {});
        setAssets((current) => {
          const exists = current.some((a) => (a.assetId || a.id) === resolvedId);
          if (exists) {
            return current.map((a) =>
              (a.assetId || a.id) === resolvedId ? { ...a, ...newAssetRow } : a,
            );
          }
          return [newAssetRow, ...current];
        });
        return {
          success: true,
          queuedOffline: Boolean(result.queuedOffline),
          id: resolvedId,
          asset: newAssetRow,
        };
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
      if (result.success || result.queuedOffline) {
        await OfflineVaultCache.upsertAsset(uid, {
          assetId,
          id: assetId,
          ...updates,
          pendingSync: Boolean(result.queuedOffline),
          syncStatus: result.queuedOffline ? 'PENDING_UPDATE' : 'SYNCED',
          clientUpdatedAt: new Date().toISOString(),
        }).catch(() => {});
        setAssets((current) =>
          current.map((asset) =>
            (asset.assetId || asset.id) === assetId
              ? {
                  ...asset,
                  ...updates,
                  pendingSync: Boolean(result.queuedOffline),
                  syncStatus: result.queuedOffline ? 'PENDING_UPDATE' : (asset.syncStatus || 'SYNCED'),
                  clientUpdatedAt: new Date().toISOString(),
                }
              : asset,
          ),
        );
        return { success: true, queuedOffline: Boolean(result.queuedOffline), id: assetId };
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
      const existing = assets.find((a) => (a.assetId || a.id) === assetId) || null;
      const result = await AssetService.softDeleteAsset(uid, assetId, { existingAsset: existing });
      if (result?.success) {
        await OfflineVaultCache.removeAsset(uid, assetId).catch(() => {});
        setAssets((current) => removeAssetFromList(current, assetId));
      }
      return result;
    },
    [user?.uid, sessionUid, assets],
  );

  const refreshAssets = useCallback(async () => {
    const uid = user?.uid || sessionUid;
    if (!uid) return [];
    try {
      const list = await AssetService.getUserAssets(uid);
      if (Array.isArray(list)) {
        const active = filterActiveAssets(list);
        setAssets(active);
        await OfflineVaultCache.cacheAssets(uid, active).catch(() => {});
        return active;
      }
    } catch (e) {
      console.warn('[AssetProvider] refreshAssets error:', e?.message || e);
    }
    return assets;
  }, [user?.uid, sessionUid, assets]);

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
      refreshAssets,
      portfolioHealth,
      dailyPower,
      urgent,
      isGuestDemo: !isAuthenticated,
      getAsset: (id) => assets.find((a) => a.id === id || a.assetId === id),
    }),
    [assets, loading, createAsset, updateAsset, removeAsset, refreshAssets, portfolioHealth, dailyPower, urgent, isAuthenticated],
  );

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
}

export function useAssets() {
  const ctx = useContext(AssetContext);
  if (!ctx) throw new Error('useAssets must be used within AssetProvider');
  return ctx;
}

export default AssetProvider;

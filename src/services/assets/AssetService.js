/**
 * Asset Doctor — Asset Management Service
 * Uploads bill images to Firebase Storage, persists asset docs in Firestore,
 * and integrates strict OCR payloads with haptic feedback on all outcomes.
 */

import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

import {
  ASSET_CATEGORIES,
  COLLECTIONS,
  STORAGE_PATHS,
} from '../constants';
import { Haptics, triggerHaptic } from '../haptics/triggerHaptic';
import { calculateHealthScore } from '../../utils/healthScore';
import { calculateResaleValue } from '../../utils/resaleCalculator';
import { calculateDepreciation } from '../../utils/depreciation';
import { calculateTCO } from '../../utils/tcoCalculator';
import { defaultWattsForCategory } from '../../utils/powerCost';
import { ASSET_CATEGORY_OPTIONS } from '../../theme/branding';
import { ASSET_STATUS } from '../../constants/assetStatus';
import { ExpiryAlertService } from '../notifications/ExpiryAlertService';
import { OfflineQueue } from '../offline/OfflineQueue';
import { OfflineVaultCache } from '../offline/OfflineVaultCache';
import { ConnectivityService } from '../offline/ConnectivityService';
import { SYNC_STATUS, SYNC_ENTITY, makeOperationId } from '../offline/syncConstants';
import { normalizeAssetList } from '../storageService';
import { resolveVaultDocumentMeta } from '../ocr/documentTypeClassifier';
import { toErrorMessage, runDetached } from '../../utils/errors';
import {
  persistScannedImage,
  uploadVaultInvoiceImage,
  enqueueInvoiceImageRetry,
} from '../vault/VaultInvoiceUpload';
import { toVaultValue } from '../../utils/parseMoneyValue';
import { lookupBrandHelpline } from '../../constants/brandDirectory';
import { cleanAssetDisplayName } from '../../utils/displayAssetName';
import { computeGadgetSmartMetrics } from '../../utils/gadgetSmartMetrics';
import { enqueueReminder } from '../reminders/ReminderService';
import { enrichUniversalAssetFields } from './enrichUniversalAsset';

/**
 * @typedef {Object} AssetDocument
 * @property {string} assetId
 * @property {string} assetName
 * @property {string} category
 * @property {string} storeName
 * @property {string|null} purchaseDate
 * @property {string} serialNumber
 * @property {string} chassisNumber
 * @property {string|null} warrantyExpiry
 * @property {string|null} pucExpiry
 * @property {string|null} insuranceExpiry
 * @property {number} [value]
 * @property {string} [registration]
 * @property {string} billImageUrl
 * @property {string} [billStoragePath]
 */

function assetsRef(userId) {
  return firestore()
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .collection(COLLECTIONS.ASSETS);
}

function extensionFromPath(localImagePath) {
  const match = String(localImagePath || '').match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = (match?.[1] || 'jpg').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
}

export function createAssetId() {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Firestore rejects `undefined` anywhere in nested objects (invoiceMeta, etc.). */
function stripUndefinedDeep(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)).filter((item) => item !== undefined);
  }
  const out = {};
  for (const [key, nested] of Object.entries(value)) {
    if (nested === undefined) continue;
    const cleaned = stripUndefinedDeep(nested);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

function isTransientError(error) {
  return /network|offline|unavailable|timeout|timed out|connection|retry-limit|unknown/i.test(
    `${error?.code || ''} ${error?.message || error || ''}`,
  );
}

function offlineFriendlyMessage() {
  return 'Saved offline. Changes will sync automatically.';
}

async function queueAssetCreate(effectiveUserId, form, localImagePath, options = {}) {
  const stableAssetId = form.assetId || createAssetId();
  const formWithId = { ...form, assetId: stableAssetId };
  const queuedImagePath = localImagePath
    ? await OfflineVaultCache.persistPendingFile(effectiveUserId, localImagePath)
    : null;
  const operationId =
    options.operationId ||
    makeOperationId(SYNC_ENTITY.ASSET, stableAssetId, 'CREATE');
  await OfflineQueue.enqueue({
    type: 'createAsset',
    entityType: SYNC_ENTITY.ASSET,
    entityId: stableAssetId,
    operationType: 'CREATE',
    operationId,
    payload: {
      userId: effectiveUserId,
      form: formWithId,
      localImagePath: queuedImagePath,
      operationId,
      entityType: SYNC_ENTITY.ASSET,
      entityId: stableAssetId,
    },
  });
  const localAsset = {
    ...formWithId,
    id: stableAssetId,
    assetId: stableAssetId,
    uid: effectiveUserId,
    ownerUid: effectiveUserId,
    syncStatus: SYNC_STATUS.PENDING_CREATE,
    pendingSync: true,
    version: Number(form.version) || 1,
    createdAt: new Date().toISOString(),
    clientUpdatedAt: new Date().toISOString(),
    deletedAt: null,
  };
  await OfflineVaultCache.upsertAsset(effectiveUserId, localAsset);
  return {
    success: false,
    queuedOffline: true,
    id: stableAssetId,
    asset: localAsset,
    error: offlineFriendlyMessage(),
  };
}


function enrichMetrics(partial, repairs = [], powerLogs = []) {
  const health = calculateHealthScore(partial);
  const resale = calculateResaleValue({
    purchaseValue: partial.value,
    purchaseDate: partial.purchaseDate,
    categoryId: partial.categoryId,
    category: partial.category,
    condition: partial.condition || 'good',
  });
  const dep = calculateDepreciation({
    purchaseValue: partial.value,
    purchaseDate: partial.purchaseDate,
    categoryId: partial.categoryId,
  });
  const tco = calculateTCO({
    asset: partial,
    repairs,
    powerLogs,
    annualInsurancePremium: partial.annualInsurancePremium || 0,
  });
  return {
    healthScore: health.score,
    healthGrade: health.grade,
    // Universal Asset Health Intelligence fields
    assetHealthScore: health.score,
    assetHealthScoreVersion: health.version || 1,
    healthBand: health.band || health.grade,
    healthBreakdown: health.breakdown || null,
    healthWhy: health.why || health.tips || [],
    estimatedResale: resale.estimatedResale,
    currentEstimatedValue: resale.estimatedResale,
    bookValue: dep.bookValue,
    accumulatedDepreciation: dep.accumulatedDepreciation,
    tco: tco.tco,
  };
}

function resolveCategoryMeta(categoryId, fallbackCategory) {
  const found = ASSET_CATEGORY_OPTIONS.find((c) => c.id === categoryId);
  if (found) {
    return {
      categoryId: found.id,
      category: found.group,
      categoryLabel: found.label,
      icon: found.icon,
      powerWatts: found.powerWatts || 0,
      powerFactor: found.powerFactor ?? 1,
      dailyHours: found.dailyHours || 0,
    };
  }
  return {
    categoryId: categoryId || 'other',
    category: fallbackCategory || ASSET_CATEGORIES.GENERAL,
    categoryLabel: fallbackCategory || 'Other',
    icon: '📦',
    powerWatts: 0,
    powerFactor: 1,
    dailyHours: 0,
  };
}

export class AssetService {
  /**
   * Create asset from Add Asset form (manual entry, optional bill photo).
   * @param {string} userId
   * @param {object} form
   * @param {string} [localImagePath]
   */
  static async createFromForm(userId, form = {}, localImagePath, options = {}) {
    triggerHaptic('impactMedium');

    const effectiveUserId = userId || null;

    try {
      if (!effectiveUserId) throw new Error('Please sign in to save assets to your vault.');
      if (!form.assetName?.trim()) throw new Error('Asset name is required');

      // Offline-first: persist locally immediately when network is unavailable.
      if (!options.skipOfflineQueue) {
        const online = await ConnectivityService.isOnline();
        if (!online) {
          Haptics.success();
          return queueAssetCreate(effectiveUserId, form, localImagePath, options);
        }
      }

      const cat = resolveCategoryMeta(form.categoryId, form.category);
      const stableAssetId = form.assetId || createAssetId();
      const docRef = assetsRef(effectiveUserId).doc(stableAssetId);
      let billImageUrl = '';
      let billStoragePath = '';
      let pendingImageLocalPath = '';

      // OCR / scan path: never upload full-res bill images — Firestore JSON (+ micro-thumb) only.
      const skipHeavyImageUpload =
        Boolean(form.ocrDataOnly) ||
        Boolean(options.ocrDataOnly) ||
        Boolean(form.skipBillUpload) ||
        options.skipBillUpload === true ||
        (Boolean(form.ocrExtract || form.billThumbDataUrl) && options.storeBillImage !== true);

      if (localImagePath && !skipHeavyImageUpload) {
        const uploaded = await uploadVaultInvoiceImage(effectiveUserId, localImagePath);
        if (uploaded.success) {
          billImageUrl = uploaded.downloadUrl;
          billStoragePath = uploaded.storagePath;
          pendingImageLocalPath = uploaded.localPath || '';
        } else {
          try {
            pendingImageLocalPath = await persistScannedImage(localImagePath, effectiveUserId);
          } catch {
            pendingImageLocalPath = localImagePath;
          }
        }
      }

      const base = {
        // Cloud ownership — never treat device AsyncStorage as source of truth
        uid: effectiveUserId,
        ownerUid: effectiveUserId,
        ownerPhoneNumber: form.ownerPhoneNumber || form.phoneNumber || '',
        assetId: docRef.id,
        assetName: cleanAssetDisplayName(form.assetName, {
          registration: form.registration,
        }) || String(form.assetName).trim(),
        categoryId: cat.categoryId,
        category: cat.category,
        categoryLabel: cat.categoryLabel,
        icon: cat.icon,
        status: form.status || ASSET_STATUS.ACTIVE,
        vendorId: form.vendorId || null,
        brandName: form.brandName || '',
        supportPhone:
          form.supportPhone ||
          lookupBrandHelpline(`${form.brandName || ''} ${form.assetName || ''}`)?.phone ||
          '',
        supportUrl: form.supportUrl || '',
        storeName: form.storeName || '',
        purchaseDate: form.purchaseDate || null,
        serialNumber: form.serialNumber || '',
        imei: form.imei || form.invoiceMeta?.imei || '',
        chassisNumber: form.chassisNumber || '',
        engineNumber: form.engineNumber || '',
        rtoCode: form.rtoCode || '',
        fuelNorm: form.fuelNorm || form.emissionNorm || form.fuelType || '',
        warrantyExpiry: form.warrantyExpiry || null,
        insuranceExpiry: form.insuranceExpiry || null,
        pucExpiry: form.pucExpiry || null,
        nextServiceDue: form.nextServiceDue || null,
        value: toVaultValue(form.value, 0),
        purchasePrice: toVaultValue(form.purchasePrice ?? form.value, 0),
        registration: form.registration || '',
        condition: form.condition || 'good',
        annualInsurancePremium: Number(form.annualInsurancePremium) || 0,
        salePrice: 0,
        soldAt: null,
        powerWatts: Number(form.powerWatts) || cat.powerWatts || defaultWattsForCategory(cat.categoryId),
        powerFactor:
          form.powerFactor != null && form.powerFactor !== ''
            ? Number(form.powerFactor)
            : cat.powerFactor ?? 1,
        dailyHours:
          Number(form.dailyHours) > 0 ? Number(form.dailyHours) : Number(cat.dailyHours) || 0,
        odometerKm: form.odometerKm != null && form.odometerKm !== '' ? Number(form.odometerKm) : null,
        nextServiceOdometerKm:
          form.nextServiceOdometerKm != null && form.nextServiceOdometerKm !== ''
            ? Number(form.nextServiceOdometerKm)
            : null,
        billImageUrl,
        billStoragePath,
        billThumbDataUrl: form.billThumbDataUrl || null,
        ocrExtract: form.ocrExtract || form.invoiceMeta?.ocrExtract || null,
        classifiedDocumentType:
          form.classifiedDocumentType ||
          form.geminiDocumentType ||
          form.invoiceMeta?.classifiedDocumentType ||
          '',
        hasBill: Boolean(
          (billImageUrl && form.scanDocumentType !== 'rc') ||
            form.ocrExtract ||
            form.billThumbDataUrl,
        ),
        pendingBillUpload: Boolean(pendingImageLocalPath && !billImageUrl),
        invoiceMeta: form.invoiceMeta || null,
        pendingSync: false,
        deletedAt: null,
        clientUpdatedAt: new Date().toISOString(),
        syncStatus: SYNC_STATUS.SYNCED,
        version: Number(form.version) || 1,
        lastSyncedAt: new Date().toISOString(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      const universal = enrichUniversalAssetFields(form, base);
      const gadget = computeGadgetSmartMetrics({ ...base, ...universal });
      const withEnergy = {
        ...base,
        ...universal,
        smartCategory: form.smartCategory || '',
        trackImei: Boolean(form.trackImei),
        trackPucService: Boolean(form.trackPucService),
        seasonalServiceAlerts: Boolean(form.seasonalServiceAlerts),
        estimatedMonthlyUnits:
          form.estimatedMonthlyUnits ?? universal.estimatedMonthlyUnits ?? null,
        estimatedMonthlyBillCost:
          form.estimatedMonthlyBillCost ?? universal.estimatedMonthlyBillCost ?? null,
        reminderText: form.reminderText || form.whatsappReminderText || form.invoiceMeta?.reminderText || form.invoiceMeta?.whatsappReminderText || '',
        batteryHealthPercent:
          universal.batteryProfile?.healthPercent ?? gadget?.batteryHealthPercent ?? null,
        liveResaleValue: gadget?.liveResaleValue ?? null,
        batteryReplacementCost: gadget?.batteryReplacementCost ?? null,
      };
      const assetPayload = stripUndefinedDeep({ ...withEnergy, ...enrichMetrics(withEnergy) });
      await docRef.set(assetPayload);

      if (assetPayload.reminderText) {
        const trigger = assetPayload.warrantyExpiry || assetPayload.pucExpiry || assetPayload.insuranceExpiry;
        if (trigger) {
          runDetached(
            enqueueReminder(effectiveUserId, {
              assetId: docRef.id,
              email: form.ownerEmail || form.email || '',
              message: assetPayload.reminderText,
              triggerAt: trigger,
              type: 'gemini_asset_reminder',
            }),
            'enqueue-reminder',
          );
        }
      }

      if (pendingImageLocalPath && !billImageUrl) {
        await enqueueInvoiceImageRetry({
          userId: effectiveUserId,
          assetId: docRef.id,
          localPath: pendingImageLocalPath,
        });
        runDetached(
          this.retryPendingBillUpload(effectiveUserId, docRef.id, pendingImageLocalPath),
          'retry-bill-upload',
        );
      }

      if (billImageUrl) {
        const vaultMeta = resolveVaultDocumentMeta(form);
        const scanDocRef = docRef.collection('Documents').doc(`scan_${stableAssetId}`);
        await scanDocRef.set({
          docId: scanDocRef.id,
          type: vaultMeta.type,
          label: vaultMeta.label,
          fileUrl: billImageUrl,
          storagePath: billStoragePath,
          mimeType: 'image/jpeg',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      runDetached(ExpiryAlertService.scheduleForAsset(assetPayload), 'schedule-alerts');

      Haptics.success();
      return {
        success: true,
        id: docRef.id,
        asset: assetPayload,
        imagePending: Boolean(pendingImageLocalPath && !billImageUrl),
      };
    } catch (error) {
      Haptics.error();
      const shouldQueue = !options.skipOfflineQueue && isTransientError(error);
      if (shouldQueue) {
        try {
          return await queueAssetCreate(effectiveUserId, form, localImagePath, options);
        } catch {
          /* ignore queue errors */
        }
      }
      return {
        success: false,
        error: shouldQueue ? offlineFriendlyMessage() : toErrorMessage(error, 'Failed to create asset'),
        queuedOffline: shouldQueue,
      };
    }
  }

  /**
   * Soft-delete (preferred) — keeps history; CRON skips deletedAt != null
   */
  static async softDeleteAsset(userId, assetId, options = {}) {
    Haptics.tap();
    try {
      if (!options.skipOfflineQueue) {
        const online = await ConnectivityService.isOnline();
        if (!online) {
          const operationId =
            options.operationId ||
            makeOperationId(SYNC_ENTITY.ASSET, assetId, 'DELETE');
          await OfflineQueue.enqueue({
            type: 'softDeleteAsset',
            entityType: SYNC_ENTITY.ASSET,
            entityId: assetId,
            operationType: 'DELETE',
            operationId,
            payload: { userId, assetId, operationId, entityType: SYNC_ENTITY.ASSET, entityId: assetId },
          });
          await OfflineVaultCache.markAssetDeleted(userId, assetId);
          Haptics.success();
          return { success: true, queuedOffline: true };
        }
      }
      await assetsRef(userId).doc(assetId).set(
        {
          deletedAt: firestore.FieldValue.serverTimestamp(),
          status: ASSET_STATUS.RETIRED,
          syncStatus: SYNC_STATUS.SYNCED,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await OfflineVaultCache.markAssetDeleted(userId, assetId);
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      const shouldQueue = !options.skipOfflineQueue && isTransientError(error);
      if (shouldQueue) {
        try {
          const operationId =
            options.operationId ||
            makeOperationId(SYNC_ENTITY.ASSET, assetId, 'DELETE');
          await OfflineQueue.enqueue({
            type: 'softDeleteAsset',
            entityType: SYNC_ENTITY.ASSET,
            entityId: assetId,
            operationType: 'DELETE',
            operationId,
            payload: { userId, assetId, operationId },
          });
          await OfflineVaultCache.markAssetDeleted(userId, assetId);
          return { success: true, queuedOffline: true };
        } catch {
          /* ignore */
        }
      }
      return { success: false, error: toErrorMessage(error) };
    }
  }

  /** Alias used by vaultService.deleteAsset */
  static async deleteAsset(userId, assetId) {
    return this.softDeleteAsset(userId, assetId);
  }

  static async setStatus(userId, assetId, status, extra = {}) {
    Haptics.tap();
    try {
      if (!Object.values(ASSET_STATUS).includes(status)) {
        throw new Error('Invalid asset status');
      }
      const patch = {
        status,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        clientUpdatedAt: new Date().toISOString(),
        ...extra,
      };
      if (status === ASSET_STATUS.SOLD) {
        patch.soldAt = extra.soldAt || new Date().toISOString().slice(0, 10);
        patch.salePrice = Number(extra.salePrice) || 0;
      }
      await assetsRef(userId).doc(assetId).set(patch, { merge: true });
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: toErrorMessage(error) };
    }
  }

  /**
   * Upload bill / receipt image to Firebase Storage (vault_invoices/{userId}/{ts}.jpg).
   */
  static async uploadBill(userId, localImagePath, fileKey = Date.now()) {
    Haptics.tap();
    if (!userId) throw new Error('userId is required to upload a bill');
    if (!localImagePath) throw new Error('localImagePath is required');

    const uploaded = await uploadVaultInvoiceImage(userId, localImagePath);
    if (!uploaded.success) {
      throw new Error(uploaded.error || 'Bill upload failed');
    }
    return {
      downloadUrl: uploaded.downloadUrl,
      storagePath: uploaded.storagePath,
      fileName: uploaded.fileName || `${fileKey}.jpg`,
    };
  }

  /** Background retry after metadata-first save */
  static async retryPendingBillUpload(userId, assetId, localPath) {
    const uploaded = await uploadVaultInvoiceImage(userId, localPath);
    if (!uploaded.success) return uploaded;
    await assetsRef(userId).doc(assetId).set(
      {
        billImageUrl: uploaded.downloadUrl,
        billStoragePath: uploaded.storagePath,
        hasBill: true,
        pendingBillUpload: false,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await assetsRef(userId)
      .doc(assetId)
      .collection('Documents')
      .doc(`scan_${assetId}`)
      .set(
        {
          docId: `scan_${assetId}`,
          type: 'bill',
          label: 'Purchase Bill / Invoice',
          fileUrl: uploaded.downloadUrl,
          storagePath: uploaded.storagePath,
          mimeType: 'image/jpeg',
          createdAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    return uploaded;
  }

  /**
   * Update an existing asset (no new upload unless localImagePath provided).
   * @param {string} userId
   * @param {string} assetId
   * @param {Partial<AssetDocument>} updates
   * @param {string} [localImagePath]
   */
  static async updateAsset(userId, assetId, updates = {}, localImagePath, options = {}) {
    Haptics.tap();

    const queueUpdate = async () => {
      const queuedImagePath = localImagePath
        ? await OfflineVaultCache.persistPendingFile(userId, localImagePath)
        : null;
      const baseVersion = Number(updates.version ?? options.baseVersion) || 0;
      const operationId =
        options.operationId ||
        makeOperationId(SYNC_ENTITY.ASSET, assetId, 'UPDATE');
      await OfflineQueue.enqueue({
        type: 'updateAsset',
        entityType: SYNC_ENTITY.ASSET,
        entityId: assetId,
        operationType: 'UPDATE',
        operationId,
        payload: {
          userId,
          assetId,
          updates,
          localImagePath: queuedImagePath,
          operationId,
          baseVersion,
          entityType: SYNC_ENTITY.ASSET,
          entityId: assetId,
        },
      });
      await OfflineVaultCache.upsertAsset(userId, {
        assetId,
        id: assetId,
        ...updates,
        syncStatus: SYNC_STATUS.PENDING_UPDATE,
        pendingSync: true,
        version: baseVersion,
        clientUpdatedAt: new Date().toISOString(),
      });
      return {
        success: false,
        queuedOffline: true,
        id: assetId,
        error: offlineFriendlyMessage(),
      };
    };

    try {
      if (!userId || !assetId) throw new Error('userId and assetId are required');

      if (!options.skipOfflineQueue) {
        const online = await ConnectivityService.isOnline();
        if (!online) {
          Haptics.success();
          return queueUpdate();
        }
      }

      const patch = {
        updatedAt: firestore.FieldValue.serverTimestamp(),
        clientUpdatedAt: new Date().toISOString(),
        // Keep ownership fields stable across merges
        uid: userId,
        ownerUid: userId,
        syncStatus: SYNC_STATUS.SYNCED,
        pendingSync: false,
        lastSyncedAt: new Date().toISOString(),
        version: firestore.FieldValue.increment(1),
      };

      const allow = [
        'assetName',
        'category',
        'categoryId',
        'categoryLabel',
        'status',
        'storeName',
        'brandName',
        'supportPhone',
        'supportUrl',
        'purchaseDate',
        'serialNumber',
        'chassisNumber',
        'engineNumber',
        'rtoCode',
        'fuelNorm',
        'fuelType',
        'emissionNorm',
        'warrantyExpiry',
        'warrantyMonths',
        'insuranceExpiry',
        'pucExpiry',
        'value',
        'registration',
        'condition',
        'powerWatts',
        'powerFactor',
        'dailyHours',
        'odometerKm',
        'nextServiceOdometerKm',
        'lastServiceOdometerKm',
        'serviceIntervalKm',
        'nextServiceDue',
        'icon',
        'invoiceMeta',
        'activeDocumentIds',
        'ocrExtract',
        'billThumbDataUrl',
        'classifiedDocumentType',
        // Universal asset architecture (publicAssetId is permanent — never overwrite if already set)
        'nickname',
        'locationId',
        'locationPath',
        'specifications',
        'batteryProfile',
        'energyProfile',
        'assetCategory',
        'vehicleType',
        'powertrain',
        'subcategory',
        'applianceType',
        'gadgetType',
        'starRating',
        'usageDaysPerMonth',
        'electricityTariff',
        'batteryCapacityKwh',
        'energyConsumptionPer100Km',
        'rangeKm',
      ];

      for (const key of allow) {
        if (updates[key] !== undefined) patch[key] = updates[key];
      }

      // publicAssetId / assetCode are permanent — only set if caller provides and doc lacked them
      if (updates.publicAssetId || updates.assetCode) {
        const existing = await assetsRef(userId).doc(assetId).get();
        const prior = existing.data() || {};
        if (!prior.publicAssetId && !prior.assetCode) {
          patch.publicAssetId = updates.publicAssetId || updates.assetCode;
          patch.assetCode = patch.publicAssetId;
        }
      }

      if (localImagePath) {
        const { downloadUrl, storagePath } = await this.uploadBill(
          userId,
          localImagePath,
          assetId,
        );
        patch.billImageUrl = downloadUrl;
        patch.billStoragePath = storagePath;
      }

      const cleaned = stripUndefinedDeep(patch);
      await assetsRef(userId).doc(assetId).set(cleaned, { merge: true });
      Haptics.success();
      return { success: true, id: assetId };
    } catch (error) {
      Haptics.error();
      const shouldQueue = !options.skipOfflineQueue && isTransientError(error);
      if (shouldQueue) {
        try {
          return await queueUpdate();
        } catch {
          /* ignore */
        }
      }
      return {
        success: false,
        error: shouldQueue ? offlineFriendlyMessage() : (error?.message || 'Failed to update asset'),
        queuedOffline: shouldQueue,
      };
    }
  }

  /** Lightweight read for conflict detection during sync. */
  static async fetchAssetSnapshot(userId, assetId) {
    try {
      if (!userId || !assetId) return { success: false };
      const snap = await assetsRef(userId).doc(assetId).get();
      if (!snap.exists) return { success: false };
      return { success: true, asset: { id: snap.id, assetId: snap.id, ...snap.data() } };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  /**
   * One-shot fetch for dashboards / offline-friendly boot.
   * @param {string} userId
   */
  static async getUserAssets(userId) {
    Haptics.tap();

    try {
      const snapshot = await assetsRef(userId).orderBy('createdAt', 'desc').get();
      const assets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      await OfflineVaultCache.cacheAssets(userId, assets);
      return { success: true, assets };
    } catch (error) {
      Haptics.error();
      const cached = await OfflineVaultCache.getAssets(userId);
      return {
        success: cached.length > 0,
        offline: cached.length > 0,
        assets: cached,
        error: cached.length ? null : error?.message || 'Failed to load assets',
      };
    }
  }

  /**
   * Real-time listener for user dashboard.
   * @param {string} userId
   * @param {(assets: object[]) => void} onUpdate
   * @param {(error: Error) => void} [onError]
   * @returns {() => void} unsubscribe
   */
  static listenToUserAssets(userId, onUpdate, onError) {
    if (!userId) {
      onUpdate([]);
      return () => {};
    }

    return assetsRef(userId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          const assets = normalizeAssetList(
            snapshot.docs
              .map((doc) => ({ id: doc.id, ...doc.data() }))
              .filter((a) => !a.deletedAt),
          );
          OfflineVaultCache.cacheAssets(userId, assets).catch(() => {});
          onUpdate(assets);
        },
        async (error) => {
          Haptics.error();
          const cached = await OfflineVaultCache.getAssets(userId);
          if (cached.length) onUpdate(normalizeAssetList(cached));
          else if (onError) onError(error);
          else onUpdate([]);
        },
      );
  }
}

export default AssetService;

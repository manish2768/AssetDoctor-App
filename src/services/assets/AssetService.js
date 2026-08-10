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
import { resolveVaultDocumentMeta } from '../ocr/documentTypeClassifier';
import { toErrorMessage, runDetached } from '../../utils/errors';
import {
  persistScannedImage,
  uploadVaultInvoiceImage,
  enqueueInvoiceImageRetry,
} from '../vault/VaultInvoiceUpload';
import { toVaultValue } from '../../utils/parseMoneyValue';
import { lookupBrandHelpline } from '../../constants/brandDirectory';
import { assignEnergyFieldsOnCreate } from '../energy/EnergyService';
import { cleanAssetDisplayName } from '../../utils/displayAssetName';
import { computeGadgetSmartMetrics } from '../../utils/gadgetSmartMetrics';
import { enqueueReminder } from '../reminders/ReminderService';

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
    estimatedResale: resale.estimatedResale,
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

    try {
      if (!userId) throw new Error('userId is required');
      if (!form.assetName?.trim()) throw new Error('Asset name is required');

      const cat = resolveCategoryMeta(form.categoryId, form.category);
      const stableAssetId = form.assetId || createAssetId();
      const docRef = assetsRef(userId).doc(stableAssetId);
      let billImageUrl = '';
      let billStoragePath = '';
      let pendingImageLocalPath = '';

      if (localImagePath) {
        const uploaded = await uploadVaultInvoiceImage(userId, localImagePath);
        if (uploaded.success) {
          billImageUrl = uploaded.downloadUrl;
          billStoragePath = uploaded.storagePath;
          pendingImageLocalPath = uploaded.localPath || '';
        } else {
          try {
            pendingImageLocalPath = await persistScannedImage(localImagePath, userId);
          } catch {
            pendingImageLocalPath = localImagePath;
          }
        }
      }

      const base = {
        // Cloud ownership — never treat device AsyncStorage as source of truth
        uid: userId,
        ownerUid: userId,
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
        hasBill: Boolean(billImageUrl && form.scanDocumentType !== 'rc'),
        pendingBillUpload: Boolean(pendingImageLocalPath && !billImageUrl),
        invoiceMeta: form.invoiceMeta || null,
        pendingSync: false,
        deletedAt: null,
        clientUpdatedAt: new Date().toISOString(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      const energy = assignEnergyFieldsOnCreate({ ...form, ...base });
      const gadget = computeGadgetSmartMetrics({ ...base, ...energy });
      const withEnergy = {
        ...base,
        ...energy,
        smartCategory: form.smartCategory || '',
        trackImei: Boolean(form.trackImei),
        trackPucService: Boolean(form.trackPucService),
        seasonalServiceAlerts: Boolean(form.seasonalServiceAlerts),
        estimatedMonthlyUnits:
          form.estimatedMonthlyUnits ?? energy.estimatedMonthlyUnits ?? null,
        estimatedMonthlyBillCost:
          form.estimatedMonthlyBillCost ?? energy.estimatedMonthlyBillCost ?? null,
        reminderText: form.reminderText || form.whatsappReminderText || form.invoiceMeta?.reminderText || form.invoiceMeta?.whatsappReminderText || '',
        batteryHealthPercent: gadget?.batteryHealthPercent ?? null,
        liveResaleValue: gadget?.liveResaleValue ?? null,
        batteryReplacementCost: gadget?.batteryReplacementCost ?? null,
      };
      const assetPayload = stripUndefinedDeep({ ...withEnergy, ...enrichMetrics(withEnergy) });
      await docRef.set(assetPayload);

      if (assetPayload.reminderText) {
        const trigger = assetPayload.warrantyExpiry || assetPayload.pucExpiry || assetPayload.insuranceExpiry;
        if (trigger) {
          runDetached(
            enqueueReminder(userId, {
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
          userId,
          assetId: docRef.id,
          localPath: pendingImageLocalPath,
        });
        runDetached(
          this.retryPendingBillUpload(userId, docRef.id, pendingImageLocalPath),
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
          const queuedImagePath = localImagePath
            ? await OfflineVaultCache.persistPendingFile(userId, localImagePath)
            : null;
          await OfflineQueue.enqueue({
            type: 'createAsset',
            payload: { userId, form, localImagePath: queuedImagePath },
          });
        } catch {
          /* ignore queue errors */
        }
      }
      return {
        success: false,
        error: toErrorMessage(error, 'Failed to create asset'),
        queuedOffline: shouldQueue,
      };
    }
  }

  /**
   * Soft-delete (preferred) — keeps history; CRON skips deletedAt != null
   */
  static async softDeleteAsset(userId, assetId) {
    Haptics.tap();
    try {
      await assetsRef(userId).doc(assetId).set(
        {
          deletedAt: firestore.FieldValue.serverTimestamp(),
          status: ASSET_STATUS.RETIRED,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
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

    try {
      if (!userId || !assetId) throw new Error('userId and assetId are required');

      const patch = {
        updatedAt: firestore.FieldValue.serverTimestamp(),
        clientUpdatedAt: new Date().toISOString(),
        // Keep ownership fields stable across merges
        uid: userId,
        ownerUid: userId,
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
      ];

      for (const key of allow) {
        if (updates[key] !== undefined) patch[key] = updates[key];
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
          const queuedImagePath = localImagePath
            ? await OfflineVaultCache.persistPendingFile(userId, localImagePath)
            : null;
          await OfflineQueue.enqueue({
            type: 'updateAsset',
            payload: { userId, assetId, updates, localImagePath: queuedImagePath },
          });
        } catch {
          /* ignore */
        }
      }
      return {
        success: false,
        error: error?.message || 'Failed to update asset',
        queuedOffline: shouldQueue,
      };
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
          const assets = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((a) => !a.deletedAt);
          OfflineVaultCache.cacheAssets(userId, assets).catch(() => {});
          onUpdate(assets);
        },
        async (error) => {
          Haptics.error();
          const cached = await OfflineVaultCache.getAssets(userId);
          if (cached.length) onUpdate(cached);
          else if (onError) onError(error);
          else onUpdate([]);
        },
      );
  }
}

export default AssetService;

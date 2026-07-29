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
import { sanitizeOcrFields } from '../ocr/OcrService';

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

export class AssetService {
  /**
   * Upload bill / receipt image to Firebase Storage.
   * @param {string} userId
   * @param {string} localImagePath - local file:// or absolute path for putFile
   * @returns {Promise<{ downloadUrl: string, storagePath: string, fileName: string }>}
   */
  static async uploadBill(userId, localImagePath) {
    Haptics.tap();

    if (!userId) throw new Error('userId is required to upload a bill');
    if (!localImagePath) throw new Error('localImagePath is required');

    const fileName = `bill_${Date.now()}.${extensionFromPath(localImagePath)}`;
    const storagePath = STORAGE_PATHS.bills(userId, fileName);
    const reference = storage().ref(storagePath);

    await reference.putFile(localImagePath);
    const downloadUrl = await reference.getDownloadURL();

    return { downloadUrl, storagePath, fileName };
  }

  /**
   * Save scanned asset: upload bill → write Firestore doc under Users/{uid}/Assets.
   * OCR data is sanitized to the strict field allowlist before write.
   * @param {string} userId
   * @param {Record<string, unknown>} parsedOCRData
   * @param {string} localImagePath
   * @param {Partial<AssetDocument>} [extra] - value, pucExpiry, registration, etc.
   * @returns {Promise<{ success: boolean, id?: string, asset?: AssetDocument, error?: string }>}
   */
  static async saveAsset(userId, parsedOCRData, localImagePath, extra = {}) {
    triggerHaptic('impactMedium');

    try {
      if (!userId) throw new Error('userId is required');

      const ocr = sanitizeOcrFields(parsedOCRData || {});
      const { downloadUrl, storagePath } = await this.uploadBill(userId, localImagePath);

      const docRef = assetsRef(userId).doc();

      /** @type {AssetDocument} */
      const assetPayload = {
        assetId: docRef.id,
        assetName: ocr.assetName || 'Unknown Asset',
        category: ocr.category || ASSET_CATEGORIES.GENERAL,
        storeName: ocr.storeName || '',
        purchaseDate: ocr.purchaseDate || null,
        serialNumber: ocr.serialNumber || '',
        chassisNumber: ocr.chassisNumber || '',
        warrantyExpiry: ocr.warrantyExpiry || null,
        insuranceExpiry: ocr.insuranceExpiry || null,
        // Non-OCR extras (user / form)
        pucExpiry: extra.pucExpiry ?? null,
        value: typeof extra.value === 'number' ? extra.value : Number(extra.value) || 0,
        registration: extra.registration || ocr.serialNumber || ocr.chassisNumber || '',
        billImageUrl: downloadUrl,
        billStoragePath: storagePath,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await docRef.set(assetPayload);
      Haptics.success();
      return { success: true, id: docRef.id, asset: assetPayload };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to save asset' };
    }
  }

  /**
   * Update an existing asset (no new upload unless localImagePath provided).
   * @param {string} userId
   * @param {string} assetId
   * @param {Partial<AssetDocument>} updates
   * @param {string} [localImagePath]
   */
  static async updateAsset(userId, assetId, updates = {}, localImagePath) {
    Haptics.tap();

    try {
      if (!userId || !assetId) throw new Error('userId and assetId are required');

      const patch = { updatedAt: firestore.FieldValue.serverTimestamp() };

      const allow = [
        'assetName',
        'category',
        'storeName',
        'purchaseDate',
        'serialNumber',
        'chassisNumber',
        'warrantyExpiry',
        'insuranceExpiry',
        'pucExpiry',
        'value',
        'registration',
      ];

      for (const key of allow) {
        if (updates[key] !== undefined) patch[key] = updates[key];
      }

      if (localImagePath) {
        const { downloadUrl, storagePath } = await this.uploadBill(userId, localImagePath);
        patch.billImageUrl = downloadUrl;
        patch.billStoragePath = storagePath;
      }

      await assetsRef(userId).doc(assetId).set(patch, { merge: true });
      Haptics.success();
      return { success: true, id: assetId };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to update asset' };
    }
  }

  /**
   * Delete asset doc and best-effort remove Storage bill image.
   * @param {string} userId
   * @param {string} assetId
   * @param {string} [billStoragePath]
   */
  static async deleteAsset(userId, assetId, billStoragePath) {
    Haptics.tap();

    try {
      if (!userId || !assetId) throw new Error('userId and assetId are required');

      const ref = assetsRef(userId).doc(assetId);
      const snap = await ref.get();
      const path = billStoragePath || snap.data()?.billStoragePath;

      await ref.delete();

      if (path) {
        try {
          await storage().ref(path).delete();
        } catch {
          // Storage cleanup is best-effort
        }
      }

      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Failed to delete asset' };
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
      return { success: true, assets };
    } catch (error) {
      Haptics.error();
      return { success: false, assets: [], error: error?.message || 'Failed to load assets' };
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
          const assets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          onUpdate(assets);
        },
        (error) => {
          Haptics.error();
          if (onError) onError(error);
          else onUpdate([]);
        },
      );
  }
}

export default AssetService;

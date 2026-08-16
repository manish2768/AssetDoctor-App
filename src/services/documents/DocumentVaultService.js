/**
 * Document Vault Service
 * Upload RC / PUC / Bills / Insurance photos to Storage + Firestore subcollection.
 */

import firestore from '@react-native-firebase/firestore';

import { COLLECTIONS } from '../constants';
import { Haptics, triggerHaptic } from '../haptics/triggerHaptic';
import { DOCUMENT_TYPES } from '../../theme/branding';
import { OfflineQueue } from '../offline/OfflineQueue';
import { OfflineVaultCache } from '../offline/OfflineVaultCache';
import { uploadLocalFile } from '../storage/StorageUploadService';
import { storageRef } from '../../config/firebaseStorage';

function docsRef(userId, assetId) {
  return firestore()
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .collection(COLLECTIONS.ASSETS)
    .doc(assetId)
    .collection('Documents');
}

function extFromPath(path) {
  const m = String(path || '').match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = (m?.[1] || 'jpg').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'heic'].includes(ext) ? ext : 'jpg';
}

function isTransientError(error) {
  return /network|offline|unavailable|timeout|timed out|connection|unknown|object-not-found|retry/i.test(
    `${error?.code || ''} ${error?.message || error || ''}`,
  );
}

export class DocumentVaultService {
  static getDocumentTypes() {
    return DOCUMENT_TYPES;
  }

  /**
   * Upload a document file and attach metadata under the asset.
   * @param {string} userId
   * @param {string} assetId
   * @param {{ localPath: string, type: string, label?: string, mimeType?: string }} payload
   */
  static async uploadDocument(userId, assetId, payload) {
    triggerHaptic('impactMedium');
    const localDocId =
      payload?.docId || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let cachedDraft = null;

    try {
      const { localPath, type, label, mimeType } = payload || {};
      if (!userId || !assetId) throw new Error('userId and assetId are required');
      if (!localPath) throw new Error('Document file path is required');

      const typeMeta =
        DOCUMENT_TYPES.find((d) => d.id === type) || DOCUMENT_TYPES[DOCUMENT_TYPES.length - 1];
      cachedDraft = await OfflineVaultCache.cacheDocument(userId, assetId, {
        docId: localDocId,
        type: typeMeta.id,
        label: label || typeMeta.label,
        mimeType: mimeType || (extFromPath(localPath) === 'pdf' ? 'application/pdf' : 'image/jpeg'),
        localPath,
        pendingSync: true,
      });
      const fileName = `${localDocId}.${extFromPath(localPath)}`;
      const storagePath = `users/${userId}/assets/${assetId}/docs/${fileName}`;
      const mime =
        mimeType || (extFromPath(localPath) === 'pdf' ? 'application/pdf' : 'image/jpeg');
      const uploaded = await uploadLocalFile(
        storagePath,
        cachedDraft.localCachePath || localPath,
        {
          contentType: mime,
          // Already cached by OfflineVaultCache when possible; still re-persist
          // content:// / ImagePicker temp URIs that skip the cache path.
          skipPersist: Boolean(
            cachedDraft.localCachePath &&
              String(cachedDraft.localCachePath).includes('asset-doctor'),
          ),
          persistFolder: `docs/${userId}/${assetId}`,
        },
      );
      if (!uploaded.success) {
        throw Object.assign(new Error(uploaded.error || 'Document upload failed'), {
          code: uploaded.code,
        });
      }
      const fileUrl = uploaded.downloadUrl;
      if (!fileUrl) {
        throw new Error('Upload completed but download URL is missing');
      }

      const docRef = docsRef(userId, assetId).doc(localDocId);
      const record = {
        docId: docRef.id,
        type: typeMeta.id,
        label: label || typeMeta.label,
        fileUrl,
        storagePath,
        mimeType: mimeType || (fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        pendingSync: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await docRef.set(record);
      await OfflineVaultCache.cacheDocument(userId, assetId, {
        ...record,
        localCachePath: cachedDraft.localCachePath,
      });

      // Flag bill presence on parent asset for health score
      if (typeMeta.id === 'bill') {
        await firestore()
          .collection(COLLECTIONS.USERS)
          .doc(userId)
          .collection(COLLECTIONS.ASSETS)
          .doc(assetId)
          .set({ hasBill: true, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
      }

      Haptics.success();
      return { success: true, document: record };
    } catch (error) {
      Haptics.error();
      const shouldQueue =
        isTransientError(error) &&
        userId &&
        assetId &&
        cachedDraft?.localCachePath &&
        !payload?.skipOfflineQueue;
      if (shouldQueue) {
        const operationId = `opid_DOCUMENT_${localDocId}_UPLOAD`;
        await OfflineQueue.enqueue({
          type: 'uploadDocument',
          entityType: 'DOCUMENT',
          entityId: localDocId,
          operationType: 'UPLOAD',
          operationId,
          payload: {
            userId,
            assetId,
            operationId,
            entityType: 'DOCUMENT',
            entityId: localDocId,
            document: {
              ...payload,
              docId: localDocId,
              localPath: cachedDraft.localCachePath,
              syncStatus: 'PENDING_UPLOAD',
            },
          },
        }).catch(() => {});
      }
      return {
        success: false,
        queuedOffline: Boolean(shouldQueue),
        error:
          error?.message ||
          (shouldQueue
            ? 'Saved offline — upload will retry automatically'
            : 'Document upload failed'),
      };
    }
  }

  static listenToDocuments(userId, assetId, onUpdate, onError) {
    if (!userId || !assetId) {
      onUpdate([]);
      return () => {};
    }
    OfflineVaultCache.listDocuments(userId, assetId).then(onUpdate).catch(() => {});
    return docsRef(userId, assetId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        async (snap) => {
          const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const cached = await OfflineVaultCache.cacheRemoteDocuments(userId, assetId, remote);
          onUpdate(OfflineVaultCache.mergeDocuments(remote, cached));
        },
        async (err) => {
          Haptics.error();
          const cached = await OfflineVaultCache.listDocuments(userId, assetId);
          if (cached.length) onUpdate(cached);
          else if (onError) onError(err);
          else onUpdate([]);
        },
      );
  }

  static async deleteDocument(userId, assetId, docId, storagePath) {
    Haptics.tap();
    try {
      await OfflineQueue.removeMatching('uploadDocument', { userId, assetId, docId });
      await docsRef(userId, assetId).doc(docId).delete();
      await OfflineVaultCache.removeDocument(userId, assetId, docId);
      if (storagePath) {
        try {
          await storageRef(storagePath).delete();
        } catch {
          /* best-effort */
        }
      }
      Haptics.success();
      return { success: true };
    } catch (error) {
      Haptics.error();
      return { success: false, error: error?.message || 'Delete failed' };
    }
  }

  /** Flatten docs for WhatsApp / share helpers */
  static async listDocuments(userId, assetId) {
    try {
      const snap = await docsRef(userId, assetId).orderBy('createdAt', 'desc').get();
      const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const cached = await OfflineVaultCache.cacheRemoteDocuments(userId, assetId, remote);
      return OfflineVaultCache.mergeDocuments(remote, cached);
    } catch {
      return OfflineVaultCache.listDocuments(userId, assetId);
    }
  }
}

export default DocumentVaultService;

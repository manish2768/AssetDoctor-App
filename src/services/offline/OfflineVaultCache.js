/**
 * Offline CACHE only — not the primary store for vault data.
 * Source of truth: Firestore Users/{uid}/Assets (+ Storage for files).
 * Local JSON is AES-encrypted via EncryptedVaultStorage (SecureStore key).
 */

import * as FileSystem from 'expo-file-system/legacy';

import { EncryptedVaultStorage } from '../security/EncryptedVaultStorage';

const ASSET_KEY = (userId) => `@asset_doctor/assets_v2/${userId}`;
const DOC_KEY = (userId, assetId) => `@asset_doctor/docs_v2/${userId}/${assetId}`;
const KEY_DOC_TYPES = new Set([
  'rc',
  'puc',
  'insurance',
  'warranty',
  'bill',
  'property_papers',
  'rent_agreement',
  'policy',
  'guarantee',
  'service_coupon',
  'amc',
  'other',
]);

function safePart(value) {
  return String(value || 'file').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function extensionFor(doc) {
  if (doc?.mimeType === 'application/pdf') return 'pdf';
  const match = String(doc?.localPath || doc?.fileUrl || '').match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1]?.toLowerCase() || 'jpg';
}

async function readList(key) {
  try {
    const parsed = await EncryptedVaultStorage.getJSON(key, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class OfflineVaultCache {
  static async clearUser(userId) {
    if (!userId) return;
    // eslint-disable-next-line global-require
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const keys = await AsyncStorage.getAllKeys();
    const ownedKeys = keys.filter(
      (key) =>
        key === ASSET_KEY(userId) ||
        key.startsWith(`@asset_doctor/docs_v2/${userId}/`),
    );
    if (ownedKeys.length) await EncryptedVaultStorage.multiRemove(ownedKeys);
    if (FileSystem.documentDirectory) {
      const directory = `${FileSystem.documentDirectory}asset-doctor/${safePart(userId)}/`;
      await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => {});
    }
  }

  static async persistPendingFile(userId, localPath) {
    if (!FileSystem.documentDirectory || !localPath) return localPath;
    const directory = `${FileSystem.documentDirectory}asset-doctor/${safePart(userId)}/pending/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const destination = `${directory}${Date.now()}.${extensionFor({ localPath })}`;
    await FileSystem.copyAsync({ from: localPath, to: destination });
    return destination;
  }

  static async cacheAssets(userId, assets = []) {
    if (!userId) return;
    // Lazy require avoids circular import with storageService
    const { normalizeAssetList } = require('../storageService');
    const normalized = normalizeAssetList(assets);
    const serializable = normalized.map((asset) => {
      const clean = {};
      for (const [key, value] of Object.entries(asset)) {
        if (
          value === null ||
          ['string', 'number', 'boolean'].includes(typeof value) ||
          Array.isArray(value)
        ) {
          clean[key] = value;
        }
      }
      return clean;
    });
    await EncryptedVaultStorage.setJSON(ASSET_KEY(userId), serializable);
  }

  static async getAssets(userId) {
    const list = await readList(ASSET_KEY(userId));
    try {
      const { normalizeAssetList } = require('../storageService');
      return normalizeAssetList(list);
    } catch {
      return list;
    }
  }

  static async listDocuments(userId, assetId) {
    return readList(DOC_KEY(userId, assetId));
  }

  static async cacheDocument(userId, assetId, document) {
    if (!userId || !assetId || !document) return document;
    const docId = document.docId || document.id || `local_${Date.now()}`;
    const existing = await this.listDocuments(userId, assetId);
    const previous =
      existing.find((item) => (item.docId || item.id) === docId) || {};
    let localCachePath = document.localCachePath || previous.localCachePath || '';

    if (!localCachePath && KEY_DOC_TYPES.has(document.type) && FileSystem.documentDirectory) {
      const directory = `${FileSystem.documentDirectory}asset-doctor/${safePart(
        userId,
      )}/${safePart(assetId)}/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const destination = `${directory}${safePart(docId)}.${extensionFor(document)}`;

      if (document.localPath) {
        await FileSystem.copyAsync({ from: document.localPath, to: destination });
        localCachePath = destination;
      } else if (document.fileUrl) {
        const info = await FileSystem.getInfoAsync(destination);
        if (!info.exists) await FileSystem.downloadAsync(document.fileUrl, destination);
        localCachePath = destination;
      }
    }

    const record = {
      ...previous,
      ...document,
      id: docId,
      docId,
      localCachePath,
      offlineCached: Boolean(localCachePath),
      cachedAt: new Date().toISOString(),
    };
    const next = [record, ...existing.filter((item) => (item.docId || item.id) !== docId)];
    await EncryptedVaultStorage.setJSON(DOC_KEY(userId, assetId), next);
    return record;
  }

  static async cacheRemoteDocuments(userId, assetId, documents = []) {
    const out = [];
    for (const document of documents) {
      try {
        // eslint-disable-next-line no-await-in-loop
        out.push(await this.cacheDocument(userId, assetId, document));
      } catch {
        out.push(document);
      }
    }
    return out;
  }

  static async removeDocument(userId, assetId, docId, { keepFile = false } = {}) {
    const existing = await this.listDocuments(userId, assetId);
    const target = existing.find((item) => (item.docId || item.id) === docId);
    if (target?.localCachePath && !keepFile) {
      await FileSystem.deleteAsync(target.localCachePath, { idempotent: true }).catch(() => {});
    }
    const next = existing.filter((item) => (item.docId || item.id) !== docId);
    await EncryptedVaultStorage.setJSON(DOC_KEY(userId, assetId), next);
  }

  static mergeDocuments(remote = [], cached = []) {
    const map = new Map();
    for (const doc of [...cached, ...remote]) {
      const key = doc.docId || doc.id;
      const previous = map.get(key) || {};
      map.set(key, { ...previous, ...doc });
    }
    return [...map.values()];
  }
}

export default OfflineVaultCache;

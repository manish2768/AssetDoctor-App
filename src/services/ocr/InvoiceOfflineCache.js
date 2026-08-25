/**
 * Offline cache for scanned invoices + images.
 * Index/metadata encrypted via EncryptedVaultStorage; image files stay under app documents.
 */

import * as FileSystem from 'expo-file-system/legacy';

import { EncryptedVaultStorage } from '../security/EncryptedVaultStorage';

const INDEX_KEY = '@asset_doctor/invoice_scan_cache_v1';

async function readIndex() {
  try {
    const parsed = await EncryptedVaultStorage.getJSON(INDEX_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export class InvoiceOfflineCache {
  static async saveScan({
    scanId,
    userId,
    imageUri,
    invoice,
    audit,
    rawText,
    engine,
  }) {
    const id = scanId || `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let localImageUri = imageUri || '';
    try {
      if (imageUri && FileSystem.documentDirectory) {
        const dir = `${FileSystem.documentDirectory}asset-doctor/invoices/${userId || 'guest'}/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const dest = `${dir}${id}.jpg`;
        await FileSystem.copyAsync({ from: imageUri, to: dest });
        localImageUri = dest;
      }
    } catch {
      localImageUri = imageUri || '';
    }

    const record = {
      scanId: id,
      userId: userId || null,
      localImageUri,
      invoice: invoice || {},
      audit: audit || null,
      // Cap OCR text; encrypted at rest with vault key
      rawText: String(rawText || '').slice(0, 20000),
      engine: engine || 'unknown',
      savedAt: new Date().toISOString(),
    };

    const index = await readIndex();
    const next = [record, ...index.filter((r) => r.scanId !== id)].slice(0, 40);
    await EncryptedVaultStorage.setJSON(INDEX_KEY, next);
    await EncryptedVaultStorage.setJSON(`${INDEX_KEY}:${id}`, record);
    return record;
  }

  static async get(scanId) {
    if (!scanId) return null;
    try {
      return await EncryptedVaultStorage.getJSON(`${INDEX_KEY}:${scanId}`, null);
    } catch {
      return null;
    }
  }

  static async list() {
    return readIndex();
  }

  static async clearUser(userId) {
    const index = await readIndex();
    const keep = userId ? index.filter((r) => r.userId && r.userId !== userId) : [];
    const drop = userId ? index.filter((r) => !r.userId || r.userId === userId) : index;
    await EncryptedVaultStorage.setJSON(INDEX_KEY, keep);
    for (const row of drop) {
      await EncryptedVaultStorage.removeItem(`${INDEX_KEY}:${row.scanId}`).catch(() => {});
      if (row.localImageUri) {
        try {
          await FileSystem.deleteAsync(row.localImageUri, { idempotent: true });
        } catch {
          /* ignore */
        }
      }
    }
  }
}

export default InvoiceOfflineCache;

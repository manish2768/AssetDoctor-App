/**
 * Offline cache for scanned invoices + images (AsyncStorage + local file copy).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const INDEX_KEY = '@asset_doctor/invoice_scan_cache_v1';

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
        const dir = `${FileSystem.documentDirectory}asset-doctor/invoices/`;
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
      rawText: String(rawText || '').slice(0, 20000),
      engine: engine || 'unknown',
      savedAt: new Date().toISOString(),
    };

    const index = await this.list();
    const next = [record, ...index.filter((r) => r.scanId !== id)].slice(0, 40);
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
    await AsyncStorage.setItem(`${INDEX_KEY}:${id}`, JSON.stringify(record));
    return record;
  }

  static async get(scanId) {
    if (!scanId) return null;
    try {
      const raw = await AsyncStorage.getItem(`${INDEX_KEY}:${scanId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static async list() {
    try {
      const raw = await AsyncStorage.getItem(INDEX_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export default InvoiceOfflineCache;

/**
 * Vault invoice image upload — persistent cache + resilient Storage write.
 * Path format: vault_invoices/{userId}/{timestamp}.jpg
 *
 * ALWAYS FileSystem.copyAsync into documentDirectory before putFile —
 * prevents storage/object-not-found when camera/gallery temp URIs expire.
 */

import { OfflineQueue } from '../offline/OfflineQueue';
import {
  persistLocalUploadFile,
  uploadLocalFile,
} from '../storage/StorageUploadService';

/**
 * Copy camera/gallery URI into app document cache so putFile always has a stable file.
 * @param {string} scannedImageUri
 * @param {string} [userId]
 * @returns {Promise<string>} local file:// path inside documentDirectory
 */
export async function persistScannedImage(scannedImageUri, userId = 'anon') {
  if (!scannedImageUri) throw new Error('scannedImageUri is required');
  const safeUser = String(userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  return persistLocalUploadFile(scannedImageUri, {
    folder: `vault_invoices/${safeUser}`,
    ext: 'jpg',
  });
}

/** RN Firebase putFile: try native path variants (with/without file://). */
export function toNativeUploadPath(uri) {
  const raw = String(uri || '');
  if (raw.startsWith('file://')) return raw.replace('file://', '');
  return raw;
}

export function vaultInvoiceStoragePath(userId, stamp = Date.now()) {
  const safeUser = String(userId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `vault_invoices/${safeUser}/${stamp}.jpg`;
}

/**
 * Upload invoice image to Storage after caching locally with copyAsync.
 * @returns {Promise<{ success: boolean, downloadUrl?: string, storagePath?: string, localPath?: string, error?: string }>}
 */
export async function uploadVaultInvoiceImage(userId, scannedImageUri) {
  let localPath = '';
  try {
    if (!userId) throw new Error('userId is required');
    if (!scannedImageUri) throw new Error('scannedImageUri is required');

    localPath = await persistScannedImage(scannedImageUri, userId);
    const storagePath = vaultInvoiceStoragePath(userId, Date.now());
    const uploaded = await uploadLocalFile(storagePath, localPath, {
      contentType: 'image/jpeg',
      skipPersist: true,
      persistFolder: `vault_invoices/${userId}`,
    });

    if (!uploaded.success) {
      return {
        success: false,
        error: uploaded.error || 'Invoice image upload failed',
        code: uploaded.code || null,
        localPath: uploaded.localPath || localPath || null,
      };
    }

    return {
      success: true,
      downloadUrl: uploaded.downloadUrl,
      storagePath: uploaded.storagePath,
      localPath: uploaded.localPath || localPath,
      fileName: storagePath.split('/').pop(),
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Invoice image upload failed',
      code: error?.code || null,
      localPath: localPath || null,
    };
  }
}

/**
 * Queue a background retry for invoice image sync after metadata was saved.
 */
export async function enqueueInvoiceImageRetry({
  userId,
  assetId,
  localPath,
  storagePath,
}) {
  if (!userId || !assetId || !localPath) return;
  await OfflineQueue.enqueue({
    type: 'uploadVaultInvoice',
    payload: {
      userId,
      assetId,
      localPath,
      storagePath: storagePath || vaultInvoiceStoragePath(userId, Date.now()),
    },
  });
}

export const VaultInvoiceUpload = {
  persistScannedImage,
  uploadVaultInvoiceImage,
  enqueueInvoiceImageRetry,
  vaultInvoiceStoragePath,
  toNativeUploadPath,
};

export default VaultInvoiceUpload;

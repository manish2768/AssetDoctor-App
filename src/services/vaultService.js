/**
 * Compatibility shim for older imports of vaultService.
 * Prefer `./vault/VaultInvoiceUpload` + DocumentVaultService + AssetService.
 */

export {
  persistScannedImage,
  uploadVaultInvoiceImage,
  enqueueInvoiceImageRetry,
  vaultInvoiceStoragePath,
  toNativeUploadPath,
  VaultInvoiceUpload,
} from './vault/VaultInvoiceUpload';

export { DocumentVaultService } from './documents/DocumentVaultService';

import { AssetService } from './assets/AssetService';

/**
 * Soft-delete asset from the vault (keeps history; hides from lists).
 * @param {string} userId
 * @param {string} assetId
 */
export async function deleteAsset(userId, assetId) {
  return AssetService.deleteAsset(userId, assetId);
}

export const VaultService = {
  deleteAsset,
  persistScannedImage: (...args) =>
    import('./vault/VaultInvoiceUpload').then((m) => m.persistScannedImage(...args)),
};

export default VaultService;

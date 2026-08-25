/**
 * Shared Firebase Storage upload — persist local URI, putFile with contentType,
 * wait for task success, then getDownloadURL (never race ahead of the write).
 */

import * as FileSystem from 'expo-file-system/legacy';

import { storageRef, DEFAULT_STORAGE_BUCKET } from '../../config/firebaseStorage';

function guessContentType(pathOrMime, explicitMime) {
  if (explicitMime && typeof explicitMime === 'string') return explicitMime;
  const lower = String(pathOrMime || '').toLowerCase();
  if (lower.includes('application/pdf') || lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function extensionForContentType(contentType) {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/heic' || contentType === 'image/heif') return 'heic';
  return 'jpg';
}

function toPutFilePathCandidates(uri) {
  const raw = String(uri || '');
  if (!raw) return [];
  if (raw.startsWith('file://')) {
    return [raw.replace('file://', ''), raw];
  }
  return [raw, `file://${raw}`];
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Copy camera/gallery/content URI into a stable app-local file before putFile.
 * Prevents storage/object-not-found when temp URIs expire mid-upload.
 */
export async function persistLocalUploadFile(sourceUri, { folder = 'uploads', ext = 'jpg' } = {}) {
  if (!sourceUri) throw new Error('Local file URI is required');
  if (!FileSystem.documentDirectory) {
    throw new Error('FileSystem.documentDirectory unavailable');
  }

  const dir = `${FileSystem.documentDirectory}asset-doctor/${folder}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });

  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists || (info.size != null && info.size < 16)) {
    throw new Error('Cached upload file missing or empty after copy');
  }
  return dest;
}

async function putFileAndWait(reference, localPath, metadata) {
  const candidates = toPutFilePathCandidates(localPath);
  let lastError = null;

  for (const path of candidates) {
    try {
      const task = reference.putFile(path, metadata);
      // Ensure the upload Task fully settles before getDownloadURL.
      const snapshot = await Promise.resolve(task);
      const state = snapshot?.state || snapshot?.task?.snapshot?.state;
      if (state && state !== 'success' && state !== 4) {
        // TaskState.SUCCESS === 'success' (string) on RN Firebase
        throw new Error(`Upload finished with unexpected state: ${state}`);
      }
      return snapshot;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('putFile failed for all path variants');
}

async function getDownloadUrlAfterUpload(reference, { retries = 4, delayMs = 350 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      // Confirm object exists in bucket before asking for a download URL.
      await reference.getMetadata();
      return await reference.getDownloadURL();
    } catch (error) {
      lastError = error;
      const code = String(error?.code || '');
      const msg = String(error?.message || '');
      const notFound =
        code.includes('object-not-found') || /object-not-found|no object exists/i.test(msg);
      if (!notFound || attempt === retries - 1) break;
      await sleep(delayMs * (attempt + 1));
    }
  }
  throw lastError || new Error('getDownloadURL failed after upload');
}

/**
 * Upload a local file to Firebase Storage and return its download URL.
 *
 * @param {string} storagePath  e.g. vault_invoices/{uid}/{ts}.jpg
 * @param {string} localUri     file:// or content:// (will be persisted first)
 * @param {{ contentType?: string, persistFolder?: string, skipPersist?: boolean }} [options]
 */
export async function uploadLocalFile(storagePath, localUri, options = {}) {
  const contentType = guessContentType(localUri, options.contentType);
  const ext = extensionForContentType(contentType);

  let localPath = localUri;
  if (!options.skipPersist) {
    localPath = await persistLocalUploadFile(localUri, {
      folder: options.persistFolder || 'uploads',
      ext,
    });
  }

  const reference = storageRef(storagePath);
  const metadata = {
    contentType,
    customMetadata: {
      uploadedAt: String(Date.now()),
      bucket: DEFAULT_STORAGE_BUCKET,
    },
  };

  try {
    await putFileAndWait(reference, localPath, metadata);
    const downloadUrl = await getDownloadUrlAfterUpload(reference);
    return {
      success: true,
      downloadUrl,
      storagePath,
      localPath,
      contentType,
      bucket: DEFAULT_STORAGE_BUCKET,
    };
  } catch (error) {
    const code = error?.code || null;
    const message = error?.message || 'Storage upload failed';
    return {
      success: false,
      error: code ? `${message}` : message,
      code,
      storagePath,
      localPath,
      bucket: DEFAULT_STORAGE_BUCKET,
    };
  }
}

export const StorageUploadService = {
  persistLocalUploadFile,
  uploadLocalFile,
  guessContentType,
};

export default StorageUploadService;

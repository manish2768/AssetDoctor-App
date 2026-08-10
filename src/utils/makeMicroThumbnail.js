/**
 * Tiny preview thumbnails for OCR scans — never store full-res bills in Storage.
 */

import * as FileSystem from 'expo-file-system/legacy';

import { compressScanImage } from './compressScanImage';

/**
 * Build a micro JPEG thumbnail (local URI + optional base64 data URL).
 * @param {string} uri
 * @returns {Promise<{ uri: string, dataUrl: string|null, width: number }>}
 */
export async function makeMicroThumbnail(uri) {
  if (!uri) return { uri: '', dataUrl: null, width: 0 };
  try {
    const thumbUri = await compressScanImage(uri, { maxWidth: 240, compress: 0.35 });
    let dataUrl = null;
    try {
      const b64 = await FileSystem.readAsStringAsync(thumbUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Cap ~80KB of base64 to keep Firestore docs light
      if (b64 && b64.length < 90_000) {
        dataUrl = `data:image/jpeg;base64,${b64}`;
      }
    } catch {
      dataUrl = null;
    }
    return { uri: thumbUri || uri, dataUrl, width: 240 };
  } catch (error) {
    console.warn('[makeMicroThumbnail]', error?.message || error);
    return { uri, dataUrl: null, width: 0 };
  }
}

export default makeMicroThumbnail;

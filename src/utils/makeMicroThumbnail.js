/**
 * Tiny preview thumbnails for OCR scans — never store full-res bills in Storage.
 * Soft-loads FileSystem so Expo Go / missing native bits cannot fatal at import.
 */

import { compressScanImage } from './compressScanImage';
import { getFileSystem } from './safeNativeModules';

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
      const FileSystem = getFileSystem();
      if (FileSystem?.readAsStringAsync) {
        const encoding = FileSystem.EncodingType?.Base64 || 'base64';
        const b64 = await FileSystem.readAsStringAsync(thumbUri, { encoding });
        if (b64 && b64.length < 90_000) {
          dataUrl = `data:image/jpeg;base64,${b64}`;
        }
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

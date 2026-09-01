/**
 * Resize / compress bill photos before OCR / Gemini to avoid OOM crashes.
 * Soft-loads expo-image-manipulator — never throws at import or call time.
 */

import { getImageManipulator } from './safeNativeModules';

export const SCAN_IMAGE_MAX_WIDTH = 1400;
export const SCAN_IMAGE_COMPRESS = 0.7;

/**
 * @param {string} uri
 * @param {{ maxWidth?: number, compress?: number }} [opts]
 * @returns {Promise<string>} local file uri (original on any failure)
 */
export async function compressScanImage(uri, opts = {}) {
  const maxWidth = opts.maxWidth || SCAN_IMAGE_MAX_WIDTH;
  const compress = opts.compress ?? SCAN_IMAGE_COMPRESS;
  if (!uri) return uri;

  try {
    const ImageManipulator = getImageManipulator();
    if (!ImageManipulator?.manipulateAsync) {
      console.warn('[compressScanImage] expo-image-manipulator unavailable — using original');
      return uri;
    }
    const format = ImageManipulator.SaveFormat?.JPEG || 'jpeg';
    const actions = opts.neverUpscale ? [] : [{ resize: { width: maxWidth } }];
    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress, format, base64: false },
    );
    return result?.uri || uri;
  } catch (error) {
    console.warn('[compressScanImage]', error?.message || error);
    return uri;
  }
}

export default compressScanImage;

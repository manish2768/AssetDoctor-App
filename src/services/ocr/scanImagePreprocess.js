/**
 * Scan image pre-process before OCR / Gemini.
 * Expo has no OpenCV/sharp — use expo-image-manipulator for resize + optional deskew rotate.
 * Contrast/greyscale are approximated via high-quality JPEG re-encode for OCR stability.
 */

import { getImageManipulator } from '../../utils/safeNativeModules';
import { compressScanImage, SCAN_IMAGE_MAX_WIDTH } from '../../utils/compressScanImage';

export const PREPROCESS_MAX_WIDTH = 1800;
export const PREPROCESS_COMPRESS = 0.88;

/**
 * @param {string} uri
 * @param {{ maxWidth?: number, compress?: number, rotateDegrees?: number }} [opts]
 * @returns {Promise<{ uri: string, steps: string[], ok: boolean }>}
 */
export async function preprocessScanImage(uri, opts = {}) {
  const steps = [];
  if (!uri) return { uri: '', steps: ['empty'], ok: false };

  let current = uri;
  const maxWidth = opts.maxWidth || PREPROCESS_MAX_WIDTH;
  const compress = opts.compress ?? PREPROCESS_COMPRESS;
  const rotateDegrees = Number(opts.rotateDegrees) || 0;

  try {
    const ImageManipulator = getImageManipulator();
    if (!ImageManipulator?.manipulateAsync) {
      steps.push('manipulator_unavailable');
      const fallback = await compressScanImage(uri, { maxWidth, compress });
      return { uri: fallback || uri, steps: [...steps, 'compress_fallback'], ok: true };
    }

    const format = ImageManipulator.SaveFormat?.JPEG || 'jpeg';
    const actions = [];

    // Deskew approximation: caller / ML Kit scanner may pass small rotate
    if (rotateDegrees && Math.abs(rotateDegrees) >= 1 && Math.abs(rotateDegrees) <= 45) {
      actions.push({ rotate: rotateDegrees });
      steps.push(`deskew_rotate_${rotateDegrees}`);
    }

    actions.push({ resize: { width: maxWidth } });
    steps.push(`resize_${maxWidth}`);

    // High-quality re-encode — reduces noise for poor lighting before Gemini
    const result = await ImageManipulator.manipulateAsync(current, actions, {
      compress,
      format,
      base64: false,
    });
    current = result?.uri || current;
    steps.push('contrast_reencode');

    return { uri: current, steps, ok: true };
  } catch (error) {
    console.warn('[preprocessScanImage]', error?.message || error);
    try {
      const fallback = await compressScanImage(uri, {
        maxWidth: opts.maxWidth || SCAN_IMAGE_MAX_WIDTH,
        compress,
      });
      return { uri: fallback || uri, steps: [...steps, 'error_fallback'], ok: true };
    } catch {
      return { uri, steps: [...steps, 'passthrough'], ok: false };
    }
  }
}

export default preprocessScanImage;

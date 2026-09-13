/**
 * Adaptive scan image pre-process before OCR / Gemini.
 * Canonical camera pass: max width 1800, JPEG ~0.88, never upscale.
 * alreadyPreprocessed means this canonical pass already ran — do not JPEG again.
 */

import { getImageManipulator } from '../../utils/safeNativeModules';
import { compressScanImage } from '../../utils/compressScanImage';

export const PREPROCESS_MAX_WIDTH = 2400;
export const PREPROCESS_COMPRESS = 0.92;

export function planScanResize(sourceWidth, maxWidth = PREPROCESS_MAX_WIDTH, sourceHeight = null) {
  const max = Number(maxWidth) || PREPROCESS_MAX_WIDTH;
  const w = Number(sourceWidth);
  const h = Number(sourceHeight);
  if (!Number.isFinite(w) || w <= 0) {
    return { resize: false, targetWidth: null, reason: 'skip_resize_unknown_size' };
  }
  if (Number.isFinite(h) && h > 0) {
    const longEdge = Math.max(w, h);
    if (longEdge <= max) {
      return { resize: false, targetWidth: w, targetHeight: h, reason: 'skip_upscale' };
    }
    if (w >= h) {
      return { resize: true, targetWidth: max, reason: `resize_${max}` };
    }
    const targetWidth = Math.round(w * (max / h));
    return { resize: true, targetWidth, reason: `resize_portrait_${max}` };
  }
  if (w <= max) {
    return { resize: false, targetWidth: w, reason: 'skip_upscale' };
  }
  return { resize: true, targetWidth: max, reason: `resize_${max}` };
}

/** alreadyPreprocessed = canonical preprocess already applied. Never re-encode JPEG. */
export function shouldReencodeAlreadyPreprocessedImage(alreadyPreprocessed) {
  return alreadyPreprocessed !== true;
}

function getFileSystem() {
  try {
    return require('expo-file-system/legacy') || require('expo-file-system');
  } catch {
    return null;
  }
}

async function probeImageSize(uri) {
  try {
    if (typeof process !== 'undefined' && process.release && process.env.NODE_ENV !== 'react-native') {
      return null;
    }
    const rnName = 'react-native';
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const rn = require(rnName);
    const Image = rn?.Image;
    if (!Image?.getSize) return null;
    return await new Promise((resolve) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve(null),
      );
    });
  } catch {
    return null;
  }
}

export async function readScanImageBase64(uri) {
  if (!uri) return null;
  try {
    const fs = getFileSystem();
    if (!fs?.readAsStringAsync) return null;
    return await fs.readAsStringAsync(uri, {
      encoding: fs.EncodingType?.Base64 || 'base64',
    });
  } catch {
    return null;
  }
}

/**
 * Camera / gallery OCR image prep.
 * alreadyPreprocessed: read base64 only — no JPEG 0.9 re-encode.
 */
export async function prepareScanImageForOcr(capturedUri, opts = {}) {
  if (!capturedUri) return { uri: '', base64: null, steps: ['empty'], ok: false };
  if (opts.alreadyPreprocessed === true) {
    const [base64, size] = await Promise.all([
      readScanImageBase64(capturedUri),
      probeImageSize(capturedUri),
    ]);
    return {
      uri: capturedUri,
      base64,
      steps: ['already_preprocessed_base64_read'],
      ok: true,
      reencoded: false,
      width: size?.width,
      height: size?.height,
    };
  }
  const pre = await preprocessScanImage(capturedUri, {
    maxWidth: opts.maxWidth || PREPROCESS_MAX_WIDTH,
    compress: opts.compress ?? PREPROCESS_COMPRESS,
    base64: true,
    rotateDegrees: opts.rotateDegrees,
  });
  return {
    uri: pre?.uri || capturedUri,
    base64: pre?.base64 || null,
    steps: pre?.steps || ['preprocess_single_pass'],
    width: pre?.width,
    height: pre?.height,
    ok: Boolean(pre?.ok),
    reencoded: true,
  };
}

/**
 * @param {string} uri
 * @param {{ maxWidth?: number, compress?: number, rotateDegrees?: number, base64?: boolean }} [opts]
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
      const fallback = await compressScanImage(uri, {
        maxWidth,
        compress,
        neverUpscale: true,
      });
      return { uri: fallback || uri, steps: [...steps, 'compress_fallback'], ok: true };
    }

    const format = ImageManipulator.SaveFormat?.JPEG || 'jpeg';
    const actions = [];
    const size = await probeImageSize(current);
    if (size?.width) steps.push(`src_${size.width}x${size.height}`);

    if (rotateDegrees && Math.abs(rotateDegrees) >= 1 && Math.abs(rotateDegrees) <= 45) {
      actions.push({ rotate: rotateDegrees });
      steps.push(`deskew_rotate_${rotateDegrees}`);
    }

    const plan = planScanResize(size?.width, maxWidth, size?.height);
    steps.push(plan.reason);
    if (plan.resize && plan.targetWidth) {
      actions.push({ resize: { width: plan.targetWidth } });
    }

    const returnBase64 = Boolean(opts.base64);
    const result = await ImageManipulator.manipulateAsync(current, actions, {
      compress: Math.max(compress, 0.92),
      format,
      base64: returnBase64,
    });
    current = result?.uri || current;
    steps.push('jpeg_0_92');

    return {
      uri: current,
      base64: result?.base64 || null,
      steps,
      ok: true,
      width: size?.width,
      height: size?.height,
    };
  } catch (error) {
    console.warn('[preprocessScanImage]', error?.message || error);
    try {
      const fallback = await compressScanImage(uri, {
        maxWidth,
        compress,
        neverUpscale: true,
      });
      return { uri: fallback || uri, steps: [...steps, 'error_fallback'], ok: true };
    } catch {
      return { uri, steps: [...steps, 'passthrough'], ok: false };
    }
  }
}

export default preprocessScanImage;

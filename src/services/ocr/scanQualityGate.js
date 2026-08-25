/**
 * Lightweight capture quality gate before OCR (no OpenCV).
 * Returns actionable guidance when the frame is unsafe to OCR.
 *
 * NOTE: Without native blur/glare CV, this uses size/detail heuristics.
 * Always prefer ML Kit document scanner crop when available.
 */

import * as FileSystem from 'expo-file-system/legacy';

export const QUALITY_TIPS = Object.freeze([
  'Keep the document flat',
  'Avoid glare',
  'Move closer',
  'Ensure all four corners are visible',
  'Improve lighting',
  'Keep text in focus',
]);

/**
 * @param {string} uri
 * @param {{ base64?: string|null }} [opts]
 * @returns {Promise<{
 *   ok: boolean,
 *   imageQualityScore: number,
 *   score: number,
 *   documentDetected: boolean,
 *   needsRetake: boolean,
 *   issues: string[],
 *   tips: string[],
 *   code?: string,
 *   message?: string
 * }>}
 */
export async function assessScanImageQuality(uri, opts = {}) {
  if (!uri) {
    return {
      ok: false,
      imageQualityScore: 0,
      score: 0,
      documentDetected: false,
      needsRetake: true,
      issues: ['missing'],
      tips: QUALITY_TIPS,
      code: 'missing',
      message: 'Image quality is too low to read this document clearly.',
    };
  }

  let score = 100;
  let code = '';
  let message = '';
  const issues = [];

  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    const size = Number(info?.size) || 0;
    if (size > 0 && size < 18_000) {
      score -= 45;
      code = 'too_small';
      issues.push('small_text', 'partial_document');
      message = 'Image quality is too low to read this document clearly. Move closer and fill the frame.';
    } else if (size > 0 && size < 40_000) {
      score -= 20;
      code = code || 'low_detail';
      issues.push('small_text');
      message = message || 'Document looks small. Move closer and keep the bill flat.';
    }
  } catch {
    /* size check optional */
  }

  const b64 = String(opts.base64 || '');
  if (b64.length > 200) {
    if (b64.length < 12_000) {
      score -= 30;
      code = code || 'low_detail';
      issues.push('blur', 'low_brightness');
      message =
        message ||
        'Image quality is too low to read this document clearly. Hold steady and improve lighting.';
    }
  }

  const needsRetake = score < 55;
  const documentDetected = score >= 40;

  if (needsRetake) {
    return {
      ok: false,
      imageQualityScore: Math.max(0, score),
      score: Math.max(0, score),
      documentDetected,
      needsRetake: true,
      issues: issues.length ? issues : ['low_quality'],
      tips: QUALITY_TIPS,
      code: code || 'low_quality',
      message:
        message ||
        'Image quality is too low to read this document clearly.',
    };
  }

  return {
    ok: true,
    imageQualityScore: Math.min(100, score),
    score: Math.min(100, score),
    documentDetected: true,
    needsRetake: false,
    issues: [],
    tips: [],
    code: '',
    message: '',
  };
}

export default assessScanImageQuality;

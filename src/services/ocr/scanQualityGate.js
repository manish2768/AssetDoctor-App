/**
 * Lightweight capture quality gate before OCR.
 * Returns actionable guidance only when the frame is truly unsafe to OCR.
 *
 * Rebuilt using ImageQualityAnalyzer to separate capture quality from extraction completeness.
 */

import { ImageQualityAnalyzer, ACTIONABLE_QUALITY_TIPS } from './engine/ImageQualityAnalyzer';

export const QUALITY_TIPS = ACTIONABLE_QUALITY_TIPS;

/**
 * Pure quality score from captured-file signals.
 * @param {{ fileBytes?: number, base64Length?: number, width?: number, height?: number, textLength?: number, linesCount?: number }} signals
 */
export function scoreScanQualitySignals(signals = {}) {
  return ImageQualityAnalyzer.assessQuality(signals);
}

/**
 * Assesses captured image quality before sending to OCR.
 * @param {string} uri
 * @param {{ base64?: string|null, width?: number, height?: number }} [opts]
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
      tips: [...QUALITY_TIPS],
      code: 'missing',
      message: 'Image quality is too low to read this document clearly.',
    };
  }

  let fileBytes = 0;
  try {
    const FileSystem = require('expo-file-system/legacy') || require('expo-file-system');
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    fileBytes = Number(info?.size) || 0;
  } catch {
    /* size check optional */
  }

  return ImageQualityAnalyzer.assessQuality({
    fileBytes,
    base64Length: String(opts.base64 || '').length,
    width: opts.width,
    height: opts.height,
  });
}

export default assessScanImageQuality;

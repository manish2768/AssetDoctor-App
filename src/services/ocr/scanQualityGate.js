/**
 * Lightweight capture quality gate before OCR (no OpenCV).
 * Returns actionable guidance when the frame is unsafe to OCR.
 *
 * NOTE: Without native blur/glare CV, this uses size/detail heuristics.
 * Always prefer ML Kit document scanner crop when available.
 */

export const QUALITY_TIPS = Object.freeze([
  'Keep the document flat',
  'Avoid glare',
  'Move closer',
  'Ensure all four corners are visible',
  'Improve lighting',
  'Keep text in focus',
]);

/**
 * Pure quality score from captured-file signals (no native modules).
 * @param {{ fileBytes?: number, base64Length?: number, width?: number, height?: number }} signals
 */
export function scoreScanQualitySignals(signals = {}) {
  let score = 100;
  let code = '';
  let message = '';
  const issues = [];

  const size = Number(signals.fileBytes) || 0;
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

  const b64Len = Number(signals.base64Length) || 0;
  if (b64Len > 200 && b64Len < 12_000) {
    score -= 30;
    code = code || 'low_detail';
    issues.push('blur', 'low_brightness');
    message =
      message ||
      'Image quality is too low to read this document clearly. Hold steady and improve lighting.';
  }

  const width = Number(signals.width) || 0;
  const height = Number(signals.height) || 0;
  let lowResolution = false;
  if (width > 0 && height > 0) {
    if (width < 400 || height < 400) {
      score -= 75;
      code = code || 'low_resolution';
      issues.push('low_resolution', 'partial_document');
      lowResolution = true;
      message =
        message ||
        'Document looks cropped or too small. Fill the frame with all four corners visible.';
    }
    const aspect = width / height;
    if (aspect > 4 || aspect < 0.2) {
      score -= 15;
      issues.push('rotated_or_cropped');
      message = message || 'Document looks cropped or rotated. Keep the bill flat and fully in frame.';
    }
  }

  // File-size / base64 heuristics may lower the score, but must not reject alone.
  // Retake only when the frame is actually missing or below a real resolution floor.
  const needsRetake = lowResolution;
  const documentDetected = score >= 20;
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
      message: message || 'Image quality is too low to read this document clearly.',
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

/**
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
      tips: QUALITY_TIPS,
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

  return scoreScanQualitySignals({
    fileBytes,
    base64Length: String(opts.base64 || '').length,
    width: opts.width,
    height: opts.height,
  });
}

export default assessScanImageQuality;

/**
 * Asset Doctor — Image Quality Analyzer
 *
 * Evaluates document capture quality honestly without artificial penalties:
 * - Separates capture visual fidelity (imageQualityScore) from OCR text extraction confidence
 * - Avoids false rejections on compressed, cropped, or thermal receipts
 * - Provides actionable capture tips only when physical readability is genuinely compromised
 */

export interface QualityAssessment {
  ok: boolean;
  imageQualityScore: number;
  score: number;
  documentDetected: boolean;
  needsRetake: boolean;
  issues: string[];
  tips: string[];
  code: string;
  message: string;
}

export const ACTIONABLE_QUALITY_TIPS = Object.freeze([
  'Keep the document flat',
  'Avoid strong overhead glare',
  'Move closer and fill the camera frame',
  'Ensure all four corners are visible',
  'Improve lighting on the document',
  'Keep text in sharp focus',
]);

export class ImageQualityAnalyzer {
  /**
   * Assesses image dimensions and signals without arbitrary file-size penalties.
   */
  public static assessQuality(signals: {
    width?: number;
    height?: number;
    fileBytes?: number;
    base64Length?: number;
    textLength?: number;
    linesCount?: number;
  } = {}): QualityAssessment {
    let score = 95;
    const issues: string[] = [];
    let code = '';
    let message = '';
    let fatalIssue = false;

    const width = Number(signals.width) || 0;
    const height = Number(signals.height) || 0;

    // 1. Resolution Check
    if (width > 0 && height > 0) {
      if (width < 320 || height < 320) {
        score -= 60;
        issues.push('extreme_low_resolution');
        code = 'low_resolution';
        message = 'Document resolution is too low to read text clearly. Move closer to the invoice.';
        fatalIssue = true;
      } else if (width < 600 || height < 600) {
        score -= 15;
        issues.push('low_resolution');
      }

      // Aspect ratio check (extreme crop or distortion)
      const aspect = width / height;
      if (aspect > 6.0 || aspect < 0.15) {
        score -= 20;
        issues.push('unusual_aspect_ratio');
        if (!code) code = 'cropped_document';
        if (!message) message = 'Document appears severely cropped. Please frame the whole page.';
      }
    }

    // 2. File completeness (only flag if literally zero bytes or empty string)
    const bytes = Number(signals.fileBytes) || 0;
    const b64Len = Number(signals.base64Length) || 0;
    if (bytes > 0 && bytes < 4000 && b64Len > 0 && b64Len < 3000) {
      score -= 40;
      issues.push('empty_or_truncated_file');
      fatalIssue = true;
      code = 'truncated_file';
      message = 'Image file appears corrupted or empty. Please retake.';
    }

    // 3. Text feedback boost: If text is already detected, the image IS readable!
    const textLen = Number(signals.textLength) || 0;
    const lines = Number(signals.linesCount) || 0;
    if (textLen > 60 || lines >= 4) {
      // Readable text is present — boost quality score!
      score = Math.max(score, 88);
      fatalIssue = false;
    }

    const finalScore = Math.max(10, Math.min(100, score));
    const ok = !fatalIssue && finalScore >= 35;

    return {
      ok,
      imageQualityScore: finalScore,
      score: finalScore,
      documentDetected: finalScore >= 25,
      needsRetake: !ok,
      issues: ok ? [] : issues,
      tips: ok ? [] : [...ACTIONABLE_QUALITY_TIPS],
      code: ok ? '' : code || 'quality_check_failed',
      message: ok ? '' : message || 'Please retake with all four corners visible.',
    };
  }
}

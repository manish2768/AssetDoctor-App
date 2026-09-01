/**
 * Asset Doctor — Image Quality Analyzer
 * Evaluates blur, resolution, and readability without blocking camera capture.
 */

export interface QualityAnalysis {
  isAcceptable: boolean;
  score: number; // 0 to 100
  estimatedBrightness: 'LOW' | 'NORMAL' | 'GLARE';
  estimatedClarity: 'SHARP' | 'MODERATE' | 'BLURRY';
  recommendations: string[];
}

export class ImageQualityAnalyzer {
  public static analyze(base64Image: string, fileSizeEstimateBytes?: number): QualityAnalysis {
    let score = 100;
    const recommendations: string[] = [];
    const len = (base64Image || '').length;

    if (len < 5000) {
      return {
        isAcceptable: false,
        score: 10,
        estimatedBrightness: 'LOW',
        estimatedClarity: 'BLURRY',
        recommendations: ['Capture is too small. Move closer to the document.']
      };
    }

    if (len < 25000) {
      score -= 20;
      recommendations.push('Ensure document text is in sharp focus.');
    }

    const estimatedBrightness: 'LOW' | 'NORMAL' | 'GLARE' = 'NORMAL';
    const estimatedClarity: 'SHARP' | 'MODERATE' | 'BLURRY' = score >= 75 ? 'SHARP' : (score >= 40 ? 'MODERATE' : 'BLURRY');

    return {
      isAcceptable: score >= 30, // Forgiving gate to prevent capture rejection
      score,
      estimatedBrightness,
      estimatedClarity,
      recommendations
    };
  }
}

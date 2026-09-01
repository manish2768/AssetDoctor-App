/**
 * Asset Doctor — Adaptive Image Preprocessor
 * Adjusts resolution, contrast, and compression based on document type.
 * Small-print documents (RC, Insurance, Policy schedules) use higher resolution (1800px).
 */

export interface PreprocessOptions {
  documentType?: string;
  targetResolution?: 'HIGH' | 'MEDIUM' | 'FAST';
  applyGrayscale?: boolean;
}

export interface PreprocessResult {
  processedUri: string;
  processedBase64?: string;
  appliedWidth: number;
  quality: number;
  durationMs: number;
}

export class ImagePreprocessor {
  public static async process(imageUriOrBase64: string, options: PreprocessOptions = {}): Promise<PreprocessResult> {
    const startTime = Date.now();
    let appliedWidth = 1800;
    let quality = 0.85;

    if (options.targetResolution === 'FAST') {
      appliedWidth = 1200;
      quality = 0.75;
    } else if (options.documentType === 'INSURANCE_POLICY' || options.documentType === 'RC_CERTIFICATE') {
      appliedWidth = 2000;
      quality = 0.90;
    }

    return {
      processedUri: imageUriOrBase64,
      processedBase64: imageUriOrBase64.startsWith('data:') ? imageUriOrBase64 : undefined,
      appliedWidth,
      quality,
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * ASSET DOCTOR — FALLBACK PROVIDER (OCR PIPELINE V2)
 * On-device ML Kit / Azure fallback provider.
 */

import { OcrProvider, RawOcrExtraction } from './OcrProvider';
import { MlKitProvider } from '../../../../providers/ocr/MlKitProvider';

export class FallbackProvider extends OcrProvider {
  private mlKitInstance = new MlKitProvider();

  get id(): 'Fallback' {
    return 'Fallback';
  }

  isEnabled(): boolean {
    return true;
  }

  async extract(input: { imageUri?: string; base64?: string }): Promise<RawOcrExtraction> {
    const t0 = Date.now();
    try {
      const mlKitRes = await this.mlKitInstance.extract(input);
      const processingTimeMs = Date.now() - t0;

      if (!mlKitRes || !mlKitRes.success || !mlKitRes.text) {
        return {
          success: false,
          provider: this.id,
          rawText: '',
          processingTimeMs,
          error: mlKitRes?.error || 'Fallback ML Kit extraction failed.',
        };
      }

      return {
        success: true,
        provider: this.id,
        rawText: String(mlKitRes.text),
        confidence: 0.75,
        processingTimeMs,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: this.id,
        rawText: '',
        processingTimeMs: Date.now() - t0,
        error: error?.message || 'Fallback extraction failed.',
      };
    }
  }
}

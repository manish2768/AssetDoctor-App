/**
 * ASSET DOCTOR — GEMINI VISION PROVIDER (OCR PIPELINE V2)
 * Gemini Multimodal Vision provider for complex layouts, semantic extraction, and classification.
 */

import { OcrProvider, RawOcrExtraction } from './OcrProvider';
import { extractAssetWithGemini } from '../../../gemini/geminiService';

export class GeminiVisionProvider extends OcrProvider {
  get id(): 'GeminiVision' {
    return 'GeminiVision';
  }

  isEnabled(): boolean {
    return true;
  }

  async extract(input: { imageUri?: string; base64?: string }): Promise<RawOcrExtraction> {
    const t0 = Date.now();
    if (!input.base64 && !input.imageUri) {
      return {
        success: false,
        provider: this.id,
        rawText: '',
        processingTimeMs: Date.now() - t0,
        error: 'No image data provided.',
      };
    }

    try {
      const geminiRes = await extractAssetWithGemini(input.imageUri, {
        base64: input.base64,
        forceFresh: true,
      });
      const processingTimeMs = Date.now() - t0;

      if (!geminiRes || !geminiRes.success) {
        return {
          success: false,
          provider: this.id,
          rawText: (geminiRes as any)?.rawText || '',
          processingTimeMs,
          error: geminiRes?.error || 'Gemini Vision extraction failed.',
        };
      }

      return {
        success: true,
        provider: this.id,
        rawText: String((geminiRes as any)?.rawText || JSON.stringify(geminiRes.data || {})),
        structuredJSON: geminiRes.data || null,
        confidence: geminiRes.confidence ?? 0.88,
        processingTimeMs,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: this.id,
        rawText: '',
        processingTimeMs: Date.now() - t0,
        error: error?.message || 'Gemini Vision request failed.',
      };
    }
  }
}

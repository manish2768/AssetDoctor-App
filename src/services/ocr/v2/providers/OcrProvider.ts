/**
 * ASSET DOCTOR — OCR PROVIDER ABSTRACTION (OCR PIPELINE V2)
 * Abstract provider base class for pluggable OCR and Vision engines.
 */

export interface RawOcrExtraction {
  success: boolean;
  provider: 'DocumentAI' | 'GeminiVision' | 'CloudVision' | 'MlKit' | 'Fallback';
  rawText: string;
  structuredJSON?: Record<string, any> | null;
  processingTimeMs: number;
  confidence?: number;
  error?: string;
}

export abstract class OcrProvider {
  abstract get id(): 'DocumentAI' | 'GeminiVision' | 'CloudVision' | 'MlKit' | 'Fallback';

  abstract isEnabled(): boolean;

  abstract extract(input: { imageUri?: string; base64?: string }): Promise<RawOcrExtraction>;
}

/**
 * Asset Doctor — Azure Vision Read API Fallback Engine
 * Uses Azure Computer Vision Read endpoint.
 */

import { AzureOcrService } from '../../services/ocr/AzureOcrService.js';

export class AzureVisionEngine {
  public static async recognize(base64Image: string, authToken?: string): Promise<{ success: boolean; rawText: string; durationMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      const res = await AzureOcrService.recognizeBase64(base64Image);
      return {
        success: res.success,
        rawText: res.text || '',
        durationMs: Date.now() - startTime,
        error: res.error
      };
    } catch (e: any) {
      return {
        success: false,
        rawText: '',
        durationMs: Date.now() - startTime,
        error: e?.message || 'Azure Vision fallback failed'
      };
    }
  }
}

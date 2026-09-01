/**
 * Asset Doctor — On-Device ML Kit OCR Engine
 * Zero network latency, full offline availability.
 */

export interface TextBlock {
  text: string;
  lines: string[];
}

export class LocalOcrEngine {
  public static async recognize(imageUri: string): Promise<{ success: boolean; rawText: string; blocks?: TextBlock[]; durationMs: number; error?: string }> {
    const startTime = Date.now();
    try {
      // Dynamic import for React Native ML Kit
      // eslint-disable-next-line global-require
      const module = require('@react-native-ml-kit/text-recognition');
      const recognizer = module?.default || module;
      if (!recognizer?.recognize) {
        throw new Error('ML Kit native recognizer not available in current environment');
      }
      const result = await recognizer.recognize(imageUri);
      return {
        success: true,
        rawText: result?.text || '',
        blocks: result?.blocks || [],
        durationMs: Date.now() - startTime
      };
    } catch (e: any) {
      return {
        success: false,
        rawText: '',
        durationMs: Date.now() - startTime,
        error: e?.message || 'Local ML Kit OCR failed'
      };
    }
  }
}

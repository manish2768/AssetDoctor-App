import { OcrRouter, type ProcessOptions } from './OcrRouter.ts';
import type { OcrResult } from './OcrResult.ts';

export class UniversalOcrPipeline {
  public static async process(
    rawTextOrBase64OrUri: string,
    options: ProcessOptions = {}
  ): Promise<OcrResult> {
    return OcrRouter.process(rawTextOrBase64OrUri, options);
  }
}

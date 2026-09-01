/**
 * ASSET DOCTOR — CLOUD VISION PROVIDER (OCR PIPELINE V2)
 * Google Cloud Vision OCR provider wrapper via Cloud Function.
 */

import { OcrProvider, RawOcrExtraction } from './OcrProvider';
import auth from '@react-native-firebase/auth';

const DEFAULT_URL =
  'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceVision';

export class CloudVisionProvider extends OcrProvider {
  get id(): 'CloudVision' {
    return 'CloudVision';
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const user = auth().currentUser;
      if (user) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }

      const url = process.env.EXPO_PUBLIC_OCR_VISION_URL || DEFAULT_URL;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: input.base64 || '' }),
      });

      const json = await res.json().catch(() => ({}));
      const processingTimeMs = Date.now() - t0;

      if (!res.ok || !json?.text || json.text.trim().length < 10) {
        return {
          success: false,
          provider: this.id,
          rawText: json?.text || '',
          processingTimeMs,
          error: json?.error || 'Insufficient text from Cloud Vision.',
        };
      }

      return {
        success: true,
        provider: this.id,
        rawText: String(json.text),
        confidence: 0.9,
        processingTimeMs,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: this.id,
        rawText: '',
        processingTimeMs: Date.now() - t0,
        error: error?.message || 'Cloud Vision request failed.',
      };
    }
  }
}

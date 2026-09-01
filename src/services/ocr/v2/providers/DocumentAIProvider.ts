/**
 * ASSET DOCTOR — DOCUMENT AI PROVIDER (OCR PIPELINE V2)
 * Google Cloud Document AI provider proxy. Server-side processor credentials.
 */

import auth from '@react-native-firebase/auth';
import { OcrProvider, RawOcrExtraction } from './OcrProvider';
import { FEATURE } from '../../../../config/featureFlags';

const DEFAULT_URL =
  'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceDocumentAi';

export class DocumentAIProvider extends OcrProvider {
  get id(): 'DocumentAI' {
    return 'DocumentAI';
  }

  isEnabled(): boolean {
    return Boolean(FEATURE.DOCUMENT_AI_ENABLED);
  }

  async extract(input: { imageUri?: string; base64?: string }): Promise<RawOcrExtraction> {
    const t0 = Date.now();
    if (!this.isEnabled()) {
      return {
        success: false,
        provider: this.id,
        rawText: '',
        processingTimeMs: Date.now() - t0,
        error: 'Document AI is currently disabled.',
      };
    }

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

      const url = process.env.EXPO_PUBLIC_OCR_DOCUMENT_AI_URL || DEFAULT_URL;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: input.base64 || '' }),
      });

      const json = await res.json().catch(() => ({}));
      const processingTimeMs = Date.now() - t0;

      if (!res.ok || !json?.success) {
        return {
          success: false,
          provider: this.id,
          rawText: '',
          processingTimeMs,
          error: json?.error || `Document AI HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        provider: this.id,
        rawText: String(json.text || ''),
        structuredJSON: json.structured || null,
        confidence: json.confidence ?? 0.9,
        processingTimeMs,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: this.id,
        rawText: '',
        processingTimeMs: Date.now() - t0,
        error: error?.message || 'Document AI request failed.',
      };
    }
  }
}

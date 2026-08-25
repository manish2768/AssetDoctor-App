/**
 * Google Document AI — client calls Cloud Function only.
 * Processor ID and service-account credentials stay on the server.
 * If Document AI is not configured, the Function returns 501 and this provider fails clearly.
 */

import auth from '@react-native-firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';

import { FEATURE } from '../../config/featureFlags';
import { OcrProvider } from './OcrProvider';

const DEFAULT_URL =
  'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceDocumentAi';

export class GoogleDocumentAiProvider extends OcrProvider {
  get id() {
    return 'document_ai';
  }

  isEnabled() {
    return FEATURE.DOCUMENT_AI_ENABLED;
  }

  async extract({ imageUri, base64 } = {}) {
    if (!this.isEnabled()) {
      return {
        success: false,
        text: '',
        engine: this.id,
        error: 'Document AI is disabled (EXPO_PUBLIC_DOCUMENT_AI_ENABLED).',
      };
    }

    const raw =
      base64 ||
      (imageUri
        ? await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 })
        : '');
    if (!raw) return { success: false, text: '', engine: this.id, error: 'No image' };
    const trimmed = raw.length > 4_500_000 ? raw.slice(0, 4_500_000) : raw;

    const headers = { 'Content-Type': 'application/json' };
    const user = auth().currentUser;
    if (user) {
      headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }

    const url = process.env.EXPO_PUBLIC_OCR_DOCUMENT_AI_URL || DEFAULT_URL;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: trimmed }),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 501 || json?.code === 'DOCUMENT_AI_NOT_CONFIGURED') {
        return {
          success: false,
          text: '',
          engine: this.id,
          error:
            json?.error ||
            'Document AI is not configured on the server. Set DOCUMENT_AI_ENABLED and DOCUMENT_AI_PROCESSOR.',
        };
      }
      if (!res.ok || !json?.success) {
        return {
          success: false,
          text: '',
          engine: this.id,
          error: json?.error || `Document AI HTTP ${res.status}`,
        };
      }
      return {
        success: true,
        text: String(json.text || ''),
        engine: json.engine || this.id,
        structured: json.structured || null,
      };
    } catch (error) {
      return {
        success: false,
        text: '',
        engine: this.id,
        error: error?.message || 'Document AI request failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export default GoogleDocumentAiProvider;

/**
 * Cloud Vision via authenticated Cloud Function. Credentials never in the APK.
 */

import auth from '@react-native-firebase/auth';
import * as FileSystem from 'expo-file-system/legacy';

import { ENV } from '../../config/env';
import { OcrProvider } from './OcrProvider';

const DEFAULT_URL =
  'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceVision';

export class CloudVisionProvider extends OcrProvider {
  get id() {
    return 'cloud_vision';
  }

  async extract({ imageUri, base64 } = {}) {
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

    const url = ENV.ocrVisionUrl || DEFAULT_URL;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: trimmed }),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        return {
          success: false,
          text: '',
          engine: this.id,
          error: json?.error || `Cloud Vision HTTP ${res.status}`,
        };
      }
      return { success: true, text: String(json.text || ''), engine: json.engine || this.id };
    } catch (error) {
      return { success: false, text: '', engine: this.id, error: error?.message || 'Cloud Vision failed' };
    } finally {
      clearTimeout(timer);
    }
  }
}

export default CloudVisionProvider;

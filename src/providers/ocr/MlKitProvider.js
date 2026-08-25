/**
 * On-device ML Kit text recognition.
 */

import { OcrProvider } from './OcrProvider';

export class MlKitProvider extends OcrProvider {
  get id() {
    return 'mlkit';
  }

  async extract({ imageUri } = {}) {
    if (!imageUri) return { success: false, text: '', engine: this.id, error: 'No image' };
    try {
      // eslint-disable-next-line global-require
      const module = require('@react-native-ml-kit/text-recognition');
      const recognizer = module?.default || module;
      const result = await recognizer.recognize(imageUri);
      const text = result?.text || '';
      if (!text) return { success: false, text: '', engine: this.id, error: 'ML Kit returned no text' };
      return { success: true, text, engine: 'mlkit-fallback' };
    } catch (error) {
      const missingNative = /cannot find module|native module|null|undefined/i.test(
        String(error?.message || error),
      );
      return {
        success: false,
        text: '',
        engine: this.id,
        error: missingNative
          ? 'On-device OCR unavailable in this build.'
          : error?.message || 'ML Kit OCR failed',
      };
    }
  }
}

export default MlKitProvider;

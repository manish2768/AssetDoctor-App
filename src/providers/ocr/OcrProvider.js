/**
 * OCR provider contract.
 * Every engine returns { success, text, engine, error?, structured? }.
 * Structured extras (Document AI entities) are optional — the app maps into NormalizedDocument.
 */

export class OcrProvider {
  get id() {
    return 'ocr';
  }

  /**
   * @param {{ imageUri?: string, base64?: string }} _input
   * @returns {Promise<{ success: boolean, text: string, engine: string, error?: string, structured?: object|null }>}
   */
  async extract(_input) {
    throw new Error('OcrProvider.extract must be implemented');
  }
}

export default OcrProvider;

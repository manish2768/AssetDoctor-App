/**
 * Asset Doctor — Unified OCR Service
 *
 * Single production OCR entry point:
 * Flow:
 *   imageUri
 *   → Validate
 *   → Safe OCR Preprocessing (single high-res pass, non-destructive)
 *   → OCR Provider (Primary ML Kit / Cloud Vision → Fallback)
 *   → rawText
 *   → UnifiedAssetExtractor
 *   → Canonical OcrExtractionResponse
 *
 * Zero accounting/tax/ledger concepts.
 * Provider fallback occurs ONLY at raw OCR text acquisition.
 */

import { OcrExtractionResponse } from '../../types/assetDocument';
import { UnifiedAssetExtractor } from './UnifiedAssetExtractor';

export interface UnifiedOcrOptions {
  base64?: string | null;
  authToken?: string | null;
  forceCloudVision?: boolean;
  skipPreprocessing?: boolean;
}

export interface VisionClient {
  recognize(imageUri: string, base64?: string): Promise<{ text: string; confidence?: number }>;
}

const CLOUD_VISION_URL =
  process.env.EXPO_PUBLIC_OCR_VISION_URL ||
  'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceVision';

export class UnifiedOcrService {
  /**
   * Main entry point for processing a scanned document image (Camera or Gallery).
   */
  public static async processDocument(
    imageUri: string,
    options: UnifiedOcrOptions = {}
  ): Promise<OcrExtractionResponse> {
    const t0 = Date.now();

    // 1. Validate imageUri
    if (!imageUri || typeof imageUri !== 'string') {
      return UnifiedAssetExtractor.extract('');
    }

    // Direct raw text bypass (for tests and offline string evaluation)
    if (imageUri.includes('\n') || (imageUri.length > 100 && !imageUri.startsWith('file://') && !imageUri.startsWith('http') && !imageUri.startsWith('data:') && !imageUri.startsWith('/'))) {
      const res = UnifiedAssetExtractor.extract(imageUri);
      res.provider = 'DirectText';
      return res;
    }

    try {
      // 2. Safe Preprocessing: Get high-fidelity machine-readable image
      const prepImage = options.skipPreprocessing
        ? { uri: imageUri, base64: options.base64 || null }
        : await this.safePreprocessImage(imageUri, options.base64);

      // 3. Acquire Raw OCR Text via Minimal Provider Pipeline
      let rawText = '';
      let providerUsed = 'None';

      // Tier A: Native ML Kit on mobile device (Fast, local, offline-capable)
      if (!options.forceCloudVision) {
        try {
          const mlKitResult = await this.recognizeWithMlKit(prepImage.uri);
          if (mlKitResult && mlKitResult.trim().length >= 10) {
            rawText = mlKitResult.trim();
            providerUsed = 'MlKit';
          }
        } catch (mlErr: any) {
          console.warn('[UnifiedOcrService] ML Kit recognition skipped or failed:', mlErr?.message);
        }
      }

      // Tier B: Cloud Vision Proxy Fallback (High accuracy, multi-language)
      if (!rawText || rawText.length < 10) {
        try {
          const cloudResult = await this.recognizeWithCloudVision(prepImage.uri, prepImage.base64);
          if (cloudResult && cloudResult.trim().length >= 10) {
            rawText = cloudResult.trim();
            providerUsed = 'GoogleVision';
          }
        } catch (cloudErr: any) {
          console.warn('[UnifiedOcrService] Cloud Vision recognition failed:', cloudErr?.message);
        }
      }

      // Tier C: Azure Fallback removed (migrated to Gemini Vision)

      // 4. Feed rawText into UnifiedAssetExtractor
      const extractionResponse = UnifiedAssetExtractor.extract(rawText);
      extractionResponse.provider = providerUsed;
      extractionResponse.executionTimeMs = Date.now() - t0;

      return extractionResponse;
    } catch (err: any) {
      console.error('[UnifiedOcrService] Document processing encountered an error:', err);
      const fallback = UnifiedAssetExtractor.extract('');
      fallback.warnings = [err?.message || 'Document processing failed'];
      return fallback;
    }
  }

  /**
   * Safe Preprocessing
   * Single pass: clamps max dimension to 2000px and 0.85 JPEG compression.
   * Never OCRs thumbnails; preserves small text clarity.
   */
  private static async safePreprocessImage(
    imageUri: string,
    existingBase64?: string | null
  ): Promise<{ uri: string; base64: string | null }> {
    try {
      const ImageManipulator = require('expo-image-manipulator');
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 2000 } }],
        {
          compress: 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      return {
        uri: manipResult.uri,
        base64: manipResult.base64 || existingBase64 || null,
      };
    } catch {
      // If native manipulator is unavailable, use original
      let base64 = existingBase64 || null;
      if (!base64) {
        try {
          const FileSystem = require('expo-file-system');
          base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {}
      }
      return { uri: imageUri, base64 };
    }
  }

  /**
   * ML Kit Provider
   */
  private static async recognizeWithMlKit(imageUri: string): Promise<string> {
    const TextRecognition = require('@react-native-ml-kit/text-recognition')?.default;
    if (!TextRecognition || typeof TextRecognition.recognize !== 'function') {
      throw new Error('ML Kit not installed or not available on this platform');
    }
    const result = await TextRecognition.recognize(imageUri);
    return result?.text || '';
  }

  /**
   * Cloud Vision Function Provider
   */
  private static async recognizeWithCloudVision(
    imageUri: string,
    base64?: string | null
  ): Promise<string> {
    let imgBase64 = base64;
    if (!imgBase64) {
      try {
        const FileSystem = require('expo-file-system');
        imgBase64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {}
    }

    if (!imgBase64) {
      throw new Error('Could not read image base64 for Cloud Vision');
    }

    const payload = JSON.stringify({
      imageBase64: imgBase64,
      deviceModel: 'UnifiedOcrService',
    });

    const response = await fetch(CLOUD_VISION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Cloud Vision HTTP ${response.status}`);
    }

    const json = await response.json();
    return json?.fullText || json?.text || json?.rawText || '';
  }
}

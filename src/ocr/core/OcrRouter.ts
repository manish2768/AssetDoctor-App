import type { OcrResult, SupportedDocumentClass } from './OcrResult.ts';
import { OcrCache } from '../cache/OcrCache.ts';
import { LocalOcrEngine } from '../engines/LocalOcrEngine.ts';
import { GoogleVisionEngine } from '../engines/GoogleVisionEngine.ts';
import { AzureVisionEngine } from '../engines/AzureVisionEngine.ts';
import { OcrDocumentClassifier } from './OcrDocumentClassifier.ts';
import { ServiceInvoiceExtractor } from '../extractors/ServiceInvoiceExtractor.ts';
import { InsuranceExtractor } from '../extractors/InsuranceExtractor.ts';
import { SalesInvoiceExtractor } from '../extractors/SalesInvoiceExtractor.ts';
import { ApplianceInvoiceExtractor } from '../extractors/ApplianceInvoiceExtractor.ts';
import { ElectronicsInvoiceExtractor } from '../extractors/ElectronicsInvoiceExtractor.ts';
import { PurchaseInvoiceExtractor } from '../extractors/PurchaseInvoiceExtractor.ts';
import { PucExtractor } from '../extractors/PucExtractor.ts';
import { RcExtractor } from '../extractors/RcExtractor.ts';
import { WarrantyExtractor } from '../extractors/WarrantyExtractor.ts';
import { GenericDocumentExtractor } from '../extractors/GenericDocumentExtractor.ts';
import { AssetIdentityResolver } from '../linking/AssetIdentityResolver.ts';
import type { MatchCandidate } from '../linking/AssetMatcher.ts';

export interface ProcessOptions {
  mode?: 'LIVE' | 'VAULT';
  existingAssets?: MatchCandidate[];
  authToken?: string;
  skipCache?: boolean;
}

export class OcrRouter {
  public static async process(
    rawTextOrBase64OrUri: string,
    options: ProcessOptions = {}
  ): Promise<OcrResult> {
    const totalStart = Date.now();
    const mode = options.mode || 'VAULT';
    const isBase64 = rawTextOrBase64OrUri.startsWith('data:') || (rawTextOrBase64OrUri.length > 500 && !rawTextOrBase64OrUri.includes('\n'));
    const isRawText = rawTextOrBase64OrUri.includes('\n') || rawTextOrBase64OrUri.length < 500;

    const fingerprint = OcrCache.computeFingerprint(rawTextOrBase64OrUri);
    if (!options.skipCache) {
      const cached = OcrCache.get(fingerprint);
      if (cached) return cached;
    }

    let rawText = '';
    let selectedEngine: 'local-mlkit' | 'google-vision' | 'azure-vision' | 'manual' = 'manual';
    let localOcrMs = 0;
    let googleOcrMs = 0;
    let azureOcrMs = 0;

    if (isRawText) {
      rawText = rawTextOrBase64OrUri;
      selectedEngine = 'local-mlkit';
    } else if (mode === 'LIVE') {
      const localRes = await LocalOcrEngine.recognize(rawTextOrBase64OrUri);
      localOcrMs = localRes.durationMs;
      if (localRes.success && localRes.rawText) {
        rawText = localRes.rawText;
        selectedEngine = 'local-mlkit';
      }
    } else {
      const gStart = Date.now();
      const googleRes = await GoogleVisionEngine.recognize(rawTextOrBase64OrUri, options.authToken);
      googleOcrMs = Date.now() - gStart;

      if (googleRes.success && googleRes.rawText && googleRes.rawText.length > 20) {
        rawText = googleRes.rawText;
        selectedEngine = 'google-vision';
      } else {
        const aStart = Date.now();
        const azureRes = await AzureVisionEngine.recognize(rawTextOrBase64OrUri, options.authToken);
        azureOcrMs = Date.now() - aStart;

        if (azureRes.success && azureRes.rawText) {
          rawText = azureRes.rawText;
          selectedEngine = 'azure-vision';
        } else {
          const lStart = Date.now();
          const localRes = await LocalOcrEngine.recognize(rawTextOrBase64OrUri);
          localOcrMs = Date.now() - lStart;
          if (localRes.success && localRes.rawText) {
            rawText = localRes.rawText;
            selectedEngine = 'local-mlkit';
          }
        }
      }
    }

    // 2. DOCUMENT CLASSIFICATION FIRST
    const classStart = Date.now();
    const classification = OcrDocumentClassifier.classify(rawText);
    const classificationMs = Date.now() - classStart;

    // 3. ACTIVATE DEDICATED EXTRACTOR ONLY
    const extStart = Date.now();
    let fields: Record<string, any> = {};

    switch (classification.documentType) {
      case 'SERVICE_INVOICE':
        fields = ServiceInvoiceExtractor.extract(rawText);
        break;
      case 'INSURANCE_POLICY':
        fields = InsuranceExtractor.extract(rawText);
        break;
      case 'SALES_INVOICE':
        fields = SalesInvoiceExtractor.extract(rawText);
        break;
      case 'APPLIANCE_INVOICE':
        fields = ApplianceInvoiceExtractor.extract(rawText);
        break;
      case 'ELECTRONICS_INVOICE':
        fields = ElectronicsInvoiceExtractor.extract(rawText);
        break;
      case 'PURCHASE_INVOICE':
        fields = PurchaseInvoiceExtractor.extract(rawText);
        break;
      case 'PUC_CERTIFICATE':
        fields = PucExtractor.extract(rawText);
        break;
      case 'RC_CERTIFICATE':
        fields = RcExtractor.extract(rawText);
        break;
      case 'WARRANTY_DOCUMENT':
        fields = WarrantyExtractor.extract(rawText);
        break;
      case 'GENERIC_DOCUMENT':
      default:
        fields = GenericDocumentExtractor.extract(rawText);
        break;
    }
    const extractionMs = Date.now() - extStart;

    // 4. SMART ASSET LINKING
    const matchStart = Date.now();
    const candidate: MatchCandidate = {
      registration: fields.vehicleRegistration?.value,
      chassisNumber: fields.chassisNumber?.value,
      engineNumber: fields.engineNumber?.value,
      serialNumber: fields.serialNumber?.value,
      imei: fields.imei?.value,
      model: fields.model?.value || fields.vehicleModel?.value || fields.productName?.value,
      assetName: fields.productName?.value || fields.vehicleModel?.value
    };
    const identityMatch = AssetIdentityResolver.resolve(candidate, options.existingAssets || []);
    const assetMatchingMs = Date.now() - matchStart;

    const totalMs = Date.now() - totalStart;

    const result: OcrResult = {
      success: Boolean(rawText && rawText.length > 5),
      engine: selectedEngine,
      documentType: classification.documentType,
      rawText,
      fields,
      warnings: [],
      timing: {
        classificationMs,
        localOcrMs,
        googleOcrMs,
        azureOcrMs,
        extractionMs,
        assetMatchingMs,
        totalMs
      },
      fingerprint,
      requiresReview: classification.confidence < 0.85 || identityMatch.requiresUserConfirmation,
      reviewReasons: identityMatch.requiresUserConfirmation ? [identityMatch.reason] : [],
      matchedAssetId: identityMatch.assetId,
      matchType: identityMatch.matchType
    };

    if (result.success && !options.skipCache) {
      OcrCache.set(fingerprint, result);
    }

    return result;
  }
}

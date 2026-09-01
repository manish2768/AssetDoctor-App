/**
 * ASSET DOCTOR — OCR PIPELINE V2 MASTER ORCHESTRATOR
 * Clean, production-grade 9-stage document processing pipeline:
 * Document Input -> Quality Check -> Preprocessing -> Classification -> Provider Extraction
 * -> Schema Validation -> Normalization -> Cross-Field Validation -> Confidence & Review Gate -> Auditable Result
 */

// @ts-ignore
import CryptoJS from 'crypto-js';
import {
  DocumentOCRResult,
  ExtractedFields,
  FieldConfidenceScore,
  ProcessingStatus,
  ValidationWarning,
  AuditTrailEvent,
  ManualCorrectionRecord,
} from './schemas/documentSchemas';
import { classifyDocumentV2 } from './classifier/documentClassifierV2';
import { validateAndExtractOdometer } from './validation/odometerValidator';
import { validateVehicleIdentity } from './validation/vehicleIdentityValidator';
import { DocumentAIProvider } from './providers/DocumentAIProvider';
import { GeminiVisionProvider } from './providers/GeminiVisionProvider';
import { CloudVisionProvider } from './providers/CloudVisionProvider';
import { FallbackProvider } from './providers/FallbackProvider';
import { assessScanImageQuality } from '../scanQualityGate';
import { prepareScanImageForOcr } from '../scanImagePreprocess';
import { UniversalOcrPipeline } from '../../../../services/ocr/universalPipeline';
import { AssetMatcher } from '../../../ocr/linking/AssetMatcher';

export interface ProcessOptions {
  existingAsset?: any | null;
  existingAssets?: any[] | null;
  previousOdometer?: number | null;
  userId?: string | null;
  skipQualityCheck?: boolean;
}

export class OcrPipelineV2 {
  private static documentAiProvider = new DocumentAIProvider();
  private static geminiVisionProvider = new GeminiVisionProvider();
  private static cloudVisionProvider = new CloudVisionProvider();
  private static fallbackProvider = new FallbackProvider();

  /**
   * Main entry point executing OCR Pipeline V2 on a captured image URI or base64 data.
   */
  public static async process(
    imageUri: string,
    options: ProcessOptions = {}
  ): Promise<DocumentOCRResult> {
    const t0 = Date.now();
    const processingId = `proc_${t0}_${Math.random().toString(36).slice(2, 8)}`;
    const warnings: ValidationWarning[] = [];
    const errors: string[] = [];

    // Stage 1 & 3: Preprocessing
    let base64 = '';
    let processedUri = imageUri;
    try {
      const pre = await prepareScanImageForOcr(imageUri);
      processedUri = pre.uri || imageUri;
      base64 = pre.base64 || '';
    } catch (prepErr: any) {
      warnings.push({
        field: 'preprocessing',
        code: 'PREPROCESSING_WARNING',
        message: prepErr?.message || 'Preprocessing defaulted to original image.',
        severity: 'WARNING',
      });
    }

    const documentHash = base64 ? CryptoJS.SHA256(base64).toString() : `hash_${t0}`;

    // Stage 2: Image Quality Check
    if (!options.skipQualityCheck) {
      try {
        const quality = await assessScanImageQuality(processedUri, { base64 });
        if (quality && quality.ok === false) {
          return {
            processingId,
            documentHash,
            ocrPipelineVersion: 'v2',
            documentType: 'UNKNOWN_DOCUMENT',
            documentCategory: 'GENERAL',
            documentConfidence: 0,
            identityConfidence: 0,
            fields: {},
            fieldConfidenceMap: {},
            lineItems: [],
            rawText: '',
            provider: 'Fallback',
            processingStatus: 'FAILED',
            validationStatus: 'INVALID',
            warnings: [
              {
                field: 'imageQuality',
                code: 'IMAGE_QUALITY_LOW',
                message: quality.message || 'Image quality too low to read document.',
                severity: 'CRITICAL',
              },
            ],
            errors: [quality.message || 'Image quality gate rejected capture.'],
            processedAt: new Date().toISOString(),
          };
        }
      } catch {
        /* proceed if quality check unavailable */
      }
    }

    // Stage 4 & 5: Provider Extraction Strategy
    let providerName: DocumentOCRResult['provider'] = 'CloudVision';
    let rawText = '';
    let providerConfidence = 0.85;
    let structuredFromProvider: any = null;

    if (this.documentAiProvider.isEnabled()) {
      const docAiRes = await this.documentAiProvider.extract({ imageUri: processedUri, base64 });
      if (docAiRes.success && docAiRes.rawText) {
        providerName = 'DocumentAI';
        rawText = docAiRes.rawText;
        providerConfidence = docAiRes.confidence ?? 0.95;
        structuredFromProvider = docAiRes.structuredJSON;
      }
    }

    if (!rawText) {
      const cvRes = await this.cloudVisionProvider.extract({ imageUri: processedUri, base64 });
      if (cvRes.success && cvRes.rawText) {
        providerName = 'CloudVision';
        rawText = cvRes.rawText;
        providerConfidence = cvRes.confidence ?? 0.9;
      }
    }

    if (!rawText) {
      const fallbackRes = await this.fallbackProvider.extract({ imageUri: processedUri, base64 });
      if (fallbackRes.success && fallbackRes.rawText) {
        providerName = 'MlKit';
        rawText = fallbackRes.rawText;
        providerConfidence = fallbackRes.confidence ?? 0.75;
      } else {
        errors.push('All OCR providers failed to extract text from document.');
        return {
          processingId,
          documentHash,
          ocrPipelineVersion: 'v2',
          documentType: 'UNKNOWN_DOCUMENT',
          documentCategory: 'GENERAL',
          documentConfidence: 0,
          identityConfidence: 0,
          fields: {},
          fieldConfidenceMap: {},
          lineItems: [],
          rawText: '',
          provider: 'Fallback',
          processingStatus: 'FAILED',
          validationStatus: 'INVALID',
          warnings,
          errors,
          processedAt: new Date().toISOString(),
        };
      }
    }

    // Stage 4: Document Classification FIRST
    const classification = classifyDocumentV2(rawText);

    // Stage 6 & 7: Universal Parsing & Extraction
    let extracted: any = {};
    try {
      const uniRes = await UniversalOcrPipeline.process(rawText, {
        existingAssets: options.existingAsset ? [options.existingAsset] : [],
        skipCache: true,
      });
      extracted = uniRes.reviewInvoice || {};
    } catch (parseErr: any) {
      warnings.push({
        field: 'parser',
        code: 'PARSER_FALLBACK',
        message: parseErr?.message || 'Universal parser warning.',
        severity: 'WARNING',
      });
    }

    // Combine structured extraction with Gemini Vision if category classification needs semantic help
    if (
      classification.confidence < 0.75 ||
      classification.documentType === 'UNKNOWN_DOCUMENT' ||
      !extracted.totalAmount
    ) {
      const geminiRes = await this.geminiVisionProvider.extract({ imageUri: processedUri, base64 });
      if (geminiRes.success && geminiRes.structuredJSON) {
        extracted = { ...extracted, ...geminiRes.structuredJSON };
        providerName = 'GeminiVision';
      }
    }

    // Stage 8: Odometer & Vehicle Identity Validation
    const odometerResult = validateAndExtractOdometer(rawText, {
      previousOdometer: options.previousOdometer,
      rawOdometerCandidate: extracted.odometerKm ?? extracted.odometerReading,
    });

    const existingAssetsList = options.existingAssets || (options.existingAsset ? [options.existingAsset] : []);
    const assetMatch = AssetMatcher.match(
      {
        assetId: extracted.assetId,
        registration: extracted.registration || extracted.vehicleRegistrationNumber,
        chassisNumber: extracted.chassisNumber || extracted.chassisNo || extracted.vin,
        engineNumber: extracted.engineNumber || extracted.engineNo,
        serialNumber: extracted.serialNumber,
        imei: extracted.imei,
        model: extracted.model || extracted.productName || extracted.vehicleModel,
      },
      existingAssetsList
    );

    const assetResolution = {
      matchedAssetId: assetMatch.matched ? assetMatch.assetId : null,
      resolutionMethod: assetMatch.matchType,
      matchConfidence: assetMatch.confidence,
      requiresReview: assetMatch.requiresUserConfirmation || Boolean(assetMatch.conflictReason),
      conflictReason: assetMatch.conflictReason || null,
      candidateAssets: assetMatch.candidates || [],
    };

    const identityResult = validateVehicleIdentity(
      {
        vehicleRegistrationNumber: extracted.registration || extracted.vehicleRegistrationNumber,
        chassisNumber: extracted.chassisNumber || extracted.chassisNo,
        engineNumber: extracted.engineNumber || extracted.engineNo,
        vin: extracted.vin,
      },
      assetMatch.matched ? existingAssetsList.find((a) => (a.assetId || a.id) === assetMatch.assetId) : options.existingAsset
    );

    // Filter fields according to category (e.g. no IMEI on vehicle documents)
    const fields: ExtractedFields = {};
    const isVehicle = classification.documentCategory === 'VEHICLE';

    if (isVehicle) {
      fields.vehicleRegistrationNumber = identityResult.normalizedRegistration || extracted.registration || null;
      fields.normalizedRegistrationNumber = identityResult.normalizedRegistration;
      fields.ownerName = extracted.customerName || extracted.ownerName || null;
      fields.vehicleMake = extracted.vehicleMake || extracted.make || null;
      fields.vehicleModel = extracted.vehicleModel || extracted.model || null;
      fields.engineNumber = extracted.engineNumber || null;
      fields.chassisNumber = extracted.chassisNumber || null;
      fields.vin = extracted.vin || null;

      fields.invoiceNumber = extracted.invoiceNumber || null;
      fields.jobCardNumber = extracted.jobCardNumber || null;
      fields.invoiceDate = extracted.invoiceDate || extracted.date || null;
      fields.serviceDate = extracted.serviceDate || fields.invoiceDate;

      fields.odometerReading = odometerResult.value;
      fields.odometerUnit = odometerResult.unit;
      fields.odometerConfidence = odometerResult.confidence;

      fields.totalAmount = extracted.totalAmount ? Number(extracted.totalAmount) : null;
      fields.taxAmount = extracted.taxAmount ? Number(extracted.taxAmount) : null;
      fields.subtotal = extracted.subtotal ? Number(extracted.subtotal) : null;

      fields.workshopName = extracted.workshopName || extracted.shopName || null;
      fields.workshopGSTIN = extracted.workshopGSTIN || extracted.gstin || null;

      fields.policyNumber = extracted.policyNumber || null;
      fields.policyStartDate = extracted.policyStartDate || null;
      fields.policyEndDate = extracted.policyEndDate || null;
      fields.insurerName = extracted.insurerName || null;

      fields.pucNumber = extracted.pucNumber || null;
      fields.pucExpiryDate = extracted.pucExpiryDate || extracted.pucExpiry || null;
    } else {
      // Appliance / Electronics
      fields.productName = extracted.productName || extracted.title || null;
      fields.brand = extracted.brand || extracted.shopName || null;
      fields.modelNumber = extracted.modelNumber || null;
      fields.serialNumber = extracted.serialNumber || null;

      fields.invoiceNumber = extracted.invoiceNumber || null;
      fields.invoiceDate = extracted.invoiceDate || extracted.date || null;
      fields.purchaseDate = extracted.purchaseDate || fields.invoiceDate;

      fields.totalAmount = extracted.totalAmount ? Number(extracted.totalAmount) : null;
      fields.taxAmount = extracted.taxAmount ? Number(extracted.taxAmount) : null;

      fields.storeName = extracted.shopName || extracted.vendor || null;
      fields.customerName = extracted.customerName || null;

      fields.warrantyStartDate = extracted.warrantyStartDate || fields.invoiceDate;
      fields.warrantyEndDate = extracted.warrantyEndDate || extracted.warrantyExpiry || null;
    }

    fields.lineItems = Array.isArray(extracted.items) ? extracted.items : [];

    // Stage 9: Field Confidence Matrix & Manual Review Gating
    const fieldConfidenceMap: Record<string, FieldConfidenceScore> = {};

    const calculateFieldScore = (fieldKey: string, val: any): FieldConfidenceScore => {
      let conf = val != null ? 0.9 : 0.2;
      let level: FieldConfidenceScore['level'] = conf >= 0.85 ? 'HIGH' : conf >= 0.6 ? 'MEDIUM' : 'LOW';

      if (fieldKey === 'odometerReading') {
        conf = odometerResult.confidence;
        level = conf >= 0.85 ? 'HIGH' : conf >= 0.6 ? 'MEDIUM' : 'LOW';
      }

      if (fieldKey === 'vehicleRegistrationNumber') {
        conf = identityResult.normalizedRegistration ? 0.95 : 0.3;
        level = conf >= 0.85 ? 'HIGH' : 'LOW';
      }

      return {
        field: fieldKey,
        value: val,
        confidence: conf,
        level,
        source: 'semantic',
      };
    };

    for (const [k, v] of Object.entries(fields)) {
      if (k === 'lineItems') continue;
      fieldConfidenceMap[k] = calculateFieldScore(k, v);
    }

    // Evaluate Review Condition Rules
    const criticalFieldsMissing =
      (isVehicle && !fields.vehicleRegistrationNumber && !fields.invoiceNumber) ||
      !fields.totalAmount;

    const identityMismatch = !identityResult.updateAllowed;
    const odometerNeedsReview = odometerResult.validationStatus === 'NEEDS_REVIEW';

    const documentConfidence = Math.min(
      providerConfidence,
      classification.confidence,
      identityResult.identityConfidence
    );

    let processingStatus: ProcessingStatus = 'READY';
    let validationStatus: DocumentOCRResult['validationStatus'] = 'VALID';

    if (
      documentConfidence < 0.85 ||
      criticalFieldsMissing ||
      identityMismatch ||
      odometerNeedsReview
    ) {
      processingStatus = 'REVIEW_REQUIRED';
      validationStatus = 'NEEDS_REVIEW';
      warnings.push({
        field: 'reviewGate',
        code: 'REVIEW_REQUIRED',
        message: identityMismatch
          ? 'Vehicle identity conflict detected. Manual review required.'
          : 'Low confidence or missing critical fields require manual review.',
        severity: 'CRITICAL',
      });
    }

    const result: DocumentOCRResult = {
      processingId,
      documentHash,
      ocrPipelineVersion: 'v2',
      documentType: classification.documentType,
      documentCategory: classification.documentCategory,
      assetType: classification.assetType,
      assetResolution,
      documentConfidence,
      identityConfidence: identityResult.identityConfidence,
      fields,
      fieldConfidenceMap,
      lineItems: fields.lineItems || [],
      rawText,
      provider: providerName,
      providerMetrics: {
        processingTimeMs: Date.now() - t0,
        providerConfidence,
      },
      processingStatus,
      validationStatus,
      warnings,
      errors,
      processedAt: new Date().toISOString(),
    };

    return result;
  }
}

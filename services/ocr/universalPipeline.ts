/**
 * Universal OCR Document Intelligence Pipeline
 * Master orchestrator: Classification -> Extraction -> Validation -> Duplicate Check -> Entity Linking -> Review Queue
 */

import type {
  UniversalDocumentType,
  UniversalExtractedData,
  UniversalOcrDocumentResult,
  ProcessingMetrics
} from './types.ts';
import type { Asset } from '../../src/types.ts';
import { DocumentClassifier } from './classifier.ts';
import { ServiceExtractor } from './extractors/serviceExtractor.ts';
import { InsuranceExtractor } from './extractors/insuranceExtractor.ts';
import { PucExtractor } from './extractors/pucExtractor.ts';
import { RcExtractor } from './extractors/rcExtractor.ts';
import { PurchaseWarrantyExtractor } from './extractors/purchaseWarrantyExtractor.ts';
import { OcrValidator } from './validator.ts';
import { EntityLinker } from './entityLinker.ts';
import { DuplicateDetector, type VaultedDocumentRecord } from './duplicateDetector.ts';
import { ReviewQueueService } from './reviewQueueService.ts';

export interface PipelineOptions {
  userId?: string;
  assetId?: string;
  existingAssets?: Asset[];
  existingVaultedDocs?: VaultedDocumentRecord[];
  previousVerifiedOdometer?: number;
}

export class UniversalOcrPipeline {
  /**
   * Processes document text through the complete document-intelligence pipeline.
   */
  public static async process(
    rawText: string,
    options: PipelineOptions = {}
  ): Promise<UniversalOcrDocumentResult> {
    const startTime = Date.now();
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // 1. CLASSIFICATION STAGE
    const classStart = Date.now();
    const classification = DocumentClassifier.classify(rawText);
    const classificationTime = Date.now() - classStart;

    // 2. DOCUMENT-SPECIFIC EXTRACTION STAGE
    const extStart = Date.now();
    const extractedData: UniversalExtractedData = {};

    switch (classification.documentType) {
      case 'SERVICE_INVOICE':
      case 'REPAIR_BILL':
        extractedData.serviceData = ServiceExtractor.extract(rawText);
        break;

      case 'INSURANCE_POLICY':
      case 'INSURANCE_RENEWAL':
        extractedData.insuranceData = InsuranceExtractor.extract(rawText);
        break;

      case 'PUC_CERTIFICATE':
        extractedData.pucData = PucExtractor.extract(rawText);
        break;

      case 'RC_CERTIFICATE':
        extractedData.rcData = RcExtractor.extract(rawText);
        break;

      case 'PURCHASE_INVOICE':
        extractedData.purchaseData = PurchaseWarrantyExtractor.extractPurchaseInvoice(rawText);
        break;

      case 'WARRANTY_DOCUMENT':
      case 'EXTENDED_WARRANTY':
      case 'AMC_CONTRACT':
        extractedData.warrantyData = PurchaseWarrantyExtractor.extractWarranty(rawText);
        break;

      case 'APPLIANCE_INVOICE':
      case 'APPLIANCE_WARRANTY':
        extractedData.applianceData = PurchaseWarrantyExtractor.extractAppliance(rawText);
        break;

      case 'GENERIC_DOCUMENT':
      case 'UNKNOWN':
      default:
        // Try fallback service/purchase extraction
        extractedData.serviceData = ServiceExtractor.extract(rawText);
        extractedData.purchaseData = PurchaseWarrantyExtractor.extractPurchaseInvoice(rawText);
        break;
    }
    const extractionTime = Date.now() - extStart;

    // 3. CROSS-FIELD VALIDATION STAGE
    const valStart = Date.now();
    const validation = OcrValidator.validate(
      classification.documentType,
      extractedData,
      options.previousVerifiedOdometer
    );
    const validationTime = Date.now() - valStart;

    // 4. DUPLICATE DETECTION STAGE
    const duplicateCheck = DuplicateDetector.checkDuplicate(
      classification.documentType,
      extractedData,
      rawText,
      options.existingVaultedDocs || []
    );

    // 5. CROSS-DOCUMENT ENTITY LINKING STAGE
    const entityLink = EntityLinker.linkDocumentToAsset(
      extractedData,
      options.existingAssets || []
    );

    // 6. REVIEW QUEUE EVALUATION
    const reviewReasons: string[] = [];
    if (classification.isLowConfidence || classification.confidence < 0.85) {
      reviewReasons.push(`Low classification confidence (${Math.round(classification.confidence * 100)}%)`);
    }
    if (validation.issues.length > 0) {
      reviewReasons.push(`Validation issues detected: ${validation.issues.map(i => i.message).join('; ')}`);
    }
    if (duplicateCheck.isDuplicate) {
      reviewReasons.push(duplicateCheck.reason || 'Duplicate document detected');
    }
    if (entityLink.candidates.length > 0 && !entityLink.isAutoLinked) {
      reviewReasons.push(entityLink.notes);
    }

    // Check important field confidence
    const checkFields = [
      extractedData.serviceData?.odometerKm,
      extractedData.insuranceData?.policyNumber,
      extractedData.pucData?.certificateNumber,
      extractedData.rcData?.registrationNumber
    ];
    for (const f of checkFields) {
      if (f && f.confidence < 0.70) {
        reviewReasons.push(`Low confidence for field "${f.sourceLabel || 'Important Field'}" (${Math.round(f.confidence * 100)}%)`);
      }
    }

    const requiresReview = reviewReasons.length > 0;
    const totalProcessingTimeMs = Date.now() - startTime;

    const metrics: ProcessingMetrics = {
      uploadToOcrMs: 120, // Simulated network/upload latency
      ocrDurationMs: classificationTime + 50,
      extractionDurationMs: extractionTime,
      validationDurationMs: validationTime,
      totalProcessingTimeMs
    };

    const result: UniversalOcrDocumentResult = {
      documentId,
      classification,
      extractedData,
      validation,
      entityLink,
      duplicateCheck,
      metrics,
      requiresReview,
      reviewReasons,
      rawOcrText: rawText,
      createdAt: new Date().toISOString()
    };

    // Queue in Review Queue if needed
    if (requiresReview) {
      ReviewQueueService.evaluateAndQueue(
        result,
        options.userId || 'guest_user',
        options.assetId || entityLink.matchedAssetId || undefined
      );
    }

    return result;
  }
}

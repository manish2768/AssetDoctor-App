/**
 * Universal OCR Document Intelligence Pipeline — canonical entry point.
 *
 * IMAGE/TEXT → CLASSIFY → TYPE-SPECIFIC EXTRACT → VALIDATE → OPTIONAL ASSET MATCH → REVIEW
 *
 * Extraction NEVER reads previous assets, previous scans, or OEM schedules.
 * Asset matching is a separate stage and MUST NOT mutate OCR evidence.
 */

import type {
  UniversalDocumentType,
  UniversalExtractedData,
  UniversalOcrDocumentResult,
  ProcessingMetrics,
} from './types.ts';
import type { Asset } from '../../src/types.ts';
import { DocumentClassifier } from './classifier.ts';
import { ServiceExtractor } from './extractors/serviceExtractor.ts';
import { InsuranceExtractor } from './extractors/insuranceExtractor.ts';
import { PucExtractor } from './extractors/pucExtractor.ts';
import { RcExtractor } from './extractors/rcExtractor.ts';
import { PurchaseWarrantyExtractor } from './extractors/purchaseWarrantyExtractor.ts';
import { ElectronicsExtractor } from './extractors/electronicsExtractor.ts';
import { OcrValidator } from './validator.ts';
import { EntityLinker } from './entityLinker.ts';
import { DuplicateDetector, type VaultedDocumentRecord } from './duplicateDetector.ts';
import { sanitizeExtractedData } from './evidenceValidator.ts';
import { applyExtractedDataSafety } from './fieldSafety.ts';
import {
  buildReviewInvoice,
  buildCanonicalFields,
  buildProvenanceMap,
  buildDocumentLineItems,
} from './reviewModel.ts';
import { familyFromDocumentType } from './reviewSchema.ts';
import {
  cacheKeyForExtraction,
  createScanContext,
  PIPELINE_VERSION,
} from './scanSession.ts';

export interface PipelineOptions {
  userId?: string;
  assetId?: string;
  existingAssets?: Asset[];
  existingVaultedDocs?: VaultedDocumentRecord[];
  previousVerifiedOdometer?: number;
  skipCache?: boolean;
  scanSessionId?: string;
  documentId?: string;
  imageHash?: string | null;
}

const ocrResultCache = new Map<string, UniversalOcrDocumentResult>();
const MAX_CACHE = 40;

function stampSession(extracted: UniversalExtractedData, scanSessionId: string, documentId: string) {
  for (const group of Object.values(extracted)) {
    if (!group || typeof group !== 'object') continue;
    for (const field of Object.values(group as Record<string, any>)) {
      if (field && typeof field === 'object' && 'value' in field) {
        field.scanSessionId = scanSessionId;
        field.sourceDocumentId = documentId;
        if (!field.provenance) field.provenance = field.sourceType || 'OCR_DOCUMENT';
      }
    }
  }
}

function extractForType(docType: UniversalDocumentType, rawText: string): UniversalExtractedData {
  const extractedData: UniversalExtractedData = {};

  switch (docType) {
    case 'SERVICE_INVOICE':
    case 'REPAIR_BILL':
    case 'SERVICE_BOOK':
      extractedData.serviceData = ServiceExtractor.extract(rawText);
      break;

    case 'INSURANCE_POLICY':
    case 'INSURANCE_RECEIPT':
    case 'INSURANCE_RENEWAL':
      extractedData.insuranceData = InsuranceExtractor.extract(rawText);
      break;

    case 'PUC_CERTIFICATE':
      extractedData.pucData = PucExtractor.extract(rawText);
      break;

    case 'RC_CERTIFICATE':
      extractedData.rcData = RcExtractor.extract(rawText);
      break;

    case 'ELECTRONICS_PURCHASE_INVOICE':
      extractedData.electronicsData = ElectronicsExtractor.extract(rawText);
      break;

    case 'APPLIANCE_PURCHASE_INVOICE':
    case 'APPLIANCE_INVOICE':
      extractedData.applianceData = PurchaseWarrantyExtractor.extractAppliance(rawText);
      break;

    case 'PURCHASE_INVOICE':
    case 'VEHICLE_PURCHASE_INVOICE':
    case 'SALES_INVOICE':
      extractedData.purchaseData = PurchaseWarrantyExtractor.extractPurchaseInvoice(rawText);
      break;

    case 'WARRANTY_DOCUMENT':
    case 'EXTENDED_WARRANTY':
    case 'AMC_CONTRACT':
    case 'APPLIANCE_WARRANTY':
      extractedData.warrantyData = PurchaseWarrantyExtractor.extractWarranty(rawText);
      break;

    case 'OTHER_PURCHASE_DOCUMENT':
      // A sufficiently classified generic receipt may expose explicitly
      // labeled generic purchase fields. Evidence sanitization below removes
      // vehicle/service-only keys for this family; UNKNOWN remains empty.
      extractedData.purchaseData = PurchaseWarrantyExtractor.extractPurchaseInvoice(rawText);
      break;
    case 'GENERIC_DOCUMENT':
    case 'GENERIC_INVOICE':
    case 'UNKNOWN':
    case 'OTHER':
      // OTHER is intentionally non-semantic. A document that was not
      // classified into a supported family must not receive guessed fields.
      break;
    case 'UNKNOWN_DOCUMENT':
    case 'UNREADABLE_DOCUMENT':
    default: {
      // Unknown and unreadable documents are review-only. Running a generic
      // extractor here turns arbitrary text into fabricated invoice fields.
      break;
    }
  }

  return extractedData;
}

function logPerf(metrics: ProcessingMetrics) {
  const line =
    `[OCR_PERF] preprocess=${metrics.preprocessMs ?? 0}ms ` +
    `ocr=${metrics.ocrDurationMs}ms ` +
    `classification=${metrics.classificationMs ?? 0}ms ` +
    `extraction=${metrics.extractionDurationMs}ms ` +
    `validation=${metrics.validationDurationMs}ms ` +
    `assetMatch=${metrics.assetMatchMs ?? 0}ms ` +
    `total=${metrics.totalProcessingTimeMs}ms` +
    (metrics.cacheHit ? ' cache=HIT' : '');
  console.log(line);
}

export class UniversalOcrPipeline {
  public static readonly version = PIPELINE_VERSION;

  public static async process(
    rawText: string,
    options: PipelineOptions = {},
  ): Promise<UniversalOcrDocumentResult> {
    const startTime = Date.now();
    const ctx = createScanContext({
      scanSessionId: options.scanSessionId,
      documentId: options.documentId,
      imageHash: options.imageHash || null,
    });
    const key = cacheKeyForExtraction({
      imageHash: options.imageHash,
      rawText,
    });

    if (!options.skipCache && ocrResultCache.has(key)) {
      const cached = ocrResultCache.get(key)!;
      const replay: UniversalOcrDocumentResult = {
        ...cached,
        scanSessionId: ctx.scanSessionId,
        documentId: ctx.documentId,
        metrics: {
          ...cached.metrics,
          ocrDurationMs: 0,
          extractionDurationMs: 0,
          validationDurationMs: 0,
          classificationMs: 0,
          assetMatchMs: 0,
          totalProcessingTimeMs: Date.now() - startTime,
          cacheHit: true,
        },
      };
      replay.reviewInvoice = buildReviewInvoice(replay);
      logPerf(replay.metrics);
      return replay;
    }

    // 1. CLASSIFICATION FIRST
    const classStart = Date.now();
    const classification = DocumentClassifier.classify(rawText);
    classification.type = classification.documentType;
    classification.subtype = classification.documentSubtype;
    const classificationMs = Date.now() - classStart;

    // 2. TYPE-SPECIFIC EXTRACTION (no cross-type fallback)
    const extStart = Date.now();
    let extractedData = extractForType(classification.documentType, rawText);
    extractedData = sanitizeExtractedData(
      extractedData,
      rawText,
      classification.documentType,
    ) as UniversalExtractedData;
    extractedData = applyExtractedDataSafety(extractedData, rawText);
    stampSession(extractedData, ctx.scanSessionId, ctx.documentId);
    const extractionTime = Date.now() - extStart;

    // 3. VALIDATION — previous odometer is a WARNING only, never a fill source
    const valStart = Date.now();
    const validation = OcrValidator.validate(
      classification.documentType,
      extractedData,
      options.previousVerifiedOdometer,
    );
    const validationTime = Date.now() - valStart;

    // 4. DUPLICATE CHECK (identity of THIS document vs vaulted docs)
    const duplicateCheck = DuplicateDetector.checkDuplicate(
      classification.documentType,
      extractedData,
      rawText,
      options.existingVaultedDocs || [],
    );

    // 5. ASSET MATCHING — separate object, does not mutate extractedData
    const matchStart = Date.now();
    const entityLink = EntityLinker.linkDocumentToAsset(
      extractedData,
      options.existingAssets || [],
    );
    const assetMatchMs = Date.now() - matchStart;

    const reviewReasons: string[] = [];
    if (classification.isLowConfidence || classification.confidence < 0.7) {
      reviewReasons.push(
        `Low classification confidence (${Math.round(classification.confidence * 100)}%)`,
      );
    }
    if (validation.issues.length > 0) {
      reviewReasons.push(
        `Validation issues detected: ${validation.issues.map((i) => i.message).join('; ')}`,
      );
    }
    if (duplicateCheck.isDuplicate) {
      reviewReasons.push(duplicateCheck.reason || 'Duplicate document detected');
    }
    if (entityLink.candidates.length > 0 && !entityLink.isAutoLinked) {
      reviewReasons.push(entityLink.notes);
    }

    const checkFields = [
      extractedData.serviceData?.odometerKm,
      extractedData.insuranceData?.policyNumber,
      extractedData.pucData?.certificateNumber,
      extractedData.rcData?.registrationNumber,
    ];
    for (const f of checkFields) {
      if (f && f.confidence < 0.7) {
        reviewReasons.push(
          `Low confidence for field "${f.sourceLabel || 'Important Field'}" (${Math.round(f.confidence * 100)}%)`,
        );
      }
    }

    for (const [groupName, group] of Object.entries(extractedData)) {
      if (!group || typeof group !== 'object') continue;
      for (const [fieldName, field] of Object.entries(group as Record<string, any>)) {
        if (!field || typeof field !== 'object') continue;
        if (field.status === 'CONFLICT') {
          reviewReasons.push(`Conflicting candidates for ${groupName}.${fieldName}`);
        } else if (field.status === 'NEEDS_REVIEW') {
          reviewReasons.push(`Field requires review: ${groupName}.${fieldName}`);
        }
      }
    }

    const totalProcessingTimeMs = Date.now() - startTime;
    const metrics: ProcessingMetrics = {
      uploadToOcrMs: 0,
      preprocessMs: 0,
      ocrDurationMs: 0,
      classificationMs,
      extractionDurationMs: extractionTime,
      validationDurationMs: validationTime,
      assetMatchMs,
      totalProcessingTimeMs,
      cacheHit: false,
    };

    const canonicalFields = buildCanonicalFields(extractedData, classification.documentType);
    const provenanceMap = buildProvenanceMap(canonicalFields);

    const result: UniversalOcrDocumentResult = {
      documentId: ctx.documentId,
      scanSessionId: ctx.scanSessionId,
      sourceImage: options.imageHash || null,
      imageHash: ctx.imageHash,
      classification,
      fields: canonicalFields,
      lineItems: [],
      provenance: provenanceMap,
      confidence: Math.round((classification?.confidence || 0) * 100),
      extractedData,
      validation,
      entityLink,
      assetMatch: entityLink,
      matchedAssetId: entityLink.matchedAssetId,
      matchType: entityLink.matchType,
      duplicateCheck,
      metrics,
      requiresReview: reviewReasons.length > 0,
      reviewReasons,
      rawOcrText: rawText,
      createdAt: new Date().toISOString(),
      cacheKey: key,
      reviewFamily: familyFromDocumentType(classification.documentType),
    };
    result.reviewInvoice = buildReviewInvoice(result);
    result.lineItems = buildDocumentLineItems(result.reviewInvoice || {});

    ocrResultCache.set(key, result);
    if (ocrResultCache.size > MAX_CACHE) {
      const first = ocrResultCache.keys().next().value;
      if (first) ocrResultCache.delete(first);
    }

    logPerf(metrics);
    return result;
  }

  public static clearCache() {
    ocrResultCache.clear();
  }
}

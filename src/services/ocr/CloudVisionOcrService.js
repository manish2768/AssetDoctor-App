/**
 * Cloud Vision OCR client — prefers authenticated Cloud Function in production,
 * then optional client Vision key (dev only), then ML Kit.
 */

function getFileSystem() {
  try {
    return require('expo-file-system/legacy') || require('expo-file-system');
  } catch {
    return null;
  }
}

import { ENV } from '../../config/env.js';
import { Haptics } from '../haptics/triggerHaptic.js';
import { scanInvoiceImage } from '../ocrService.js';
import { emptyInvoiceData } from './invoiceSchema.js';
import { parseBillData } from '../../utils/billParser.js';
import { extractApplianceEnergyFromText } from '../../utils/powerCost.js';
import { allowClientLlmKeys } from '../security/clientSecretPolicy.js';
import { recordRawOcr, recordFinalMapping, resetOcrTrail } from './ocrDebugTrail.js';
import {
  withOcrRetryWithinBudget,
  remainingOcrBudgetMs,
  shouldCallCloudOcr,
  shouldCallAzureFallback,
  shouldRunSecondMlKit,
  selectOcrRawText,
  isUsableOcrProviderResult,
  resolveOcrProviderWinner,
  sanitizeOcrTelemetry,
  buildOcrObservability,
  PROVIDER_ATTEMPT_TIMEOUT_MS,
} from './ocrProviderOrchestrator.js';

const DEFAULT_VISION_URL =
  'https://asia-south1-assetdoctor-5fd25.cloudfunctions.net/scanInvoiceVision';

function visionUrl() {
  return process.env.EXPO_PUBLIC_OCR_VISION_URL || ENV.ocrVisionUrl || DEFAULT_VISION_URL;
}

let cloudFunctionDisabled = false;

/**
 * Calculates a deterministic document-level OCR confidence score (0.0 to 1.0)
 * from structural signals: text volume, line count, dates, amounts, and identifiers.
 * @param {string} rawText
 * @returns {number} confidence score between 0.0 and 1.0
 */
export function calculateOcrConfidence(rawText) {
  if (!rawText || typeof rawText !== 'string') return 0;
  const text = rawText.trim();
  if (text.length < 20) return 0.1;

  let score = 0.2; // Base score for non-empty text

  // 1. Text volume & structure (up to 0.35)
  if (text.length >= 250) {
    score += 0.25;
  } else if (text.length >= 100) {
    score += 0.15;
  } else if (text.length >= 40) {
    score += 0.08;
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 8) {
    score += 0.1;
  } else if (lines.length >= 4) {
    score += 0.05;
  }

  // 2. Key document indicators (up to 0.45)
  const hasDate =
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i.test(
      text,
    );
  if (hasDate) score += 0.15;

  const hasAmount =
    /(?:total|amount|rs\.?|inr|₹|grand\s*total|net\s*amount|balance|charges|premium|idv)\s*[:.]?\s*[\d,]+(?:\.\d{2})?/i.test(
      text,
    ) || /(?:₹|rs\.?)\s*[\d,]+(?:\.\d{2})?/i.test(text);
  if (hasAmount) score += 0.15;

  const hasDocId =
    /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b|\b[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}\b|\b(?:invoice|policy|bill|puc|rc|chassis|engine|imei|serial)\s*(?:no|number|#|id|code)?\s*[:.-]?\s*[A-Za-z0-9\/-]+/i.test(
      text,
    );
  if (hasDocId) score += 0.15;

  // 3. Document type keyword presence (up to 0.10)
  const hasDocKeywords =
    /(?:tax\s+invoice|service\s+invoice|insurance|policy|certificate|job\s*card|pollution\s+under\s+control|registration\s+certificate|warranty|cash\s*memo|bill\s+of\s+supply)/i.test(
      text,
    );
  if (hasDocKeywords) score += 0.1;

  // 4. Garbage / low-quality text penalty
  const alphanumericCount = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const alphaRatio = alphanumericCount / text.length;
  if (alphaRatio < 0.45) {
    score -= 0.25;
  } else if (alphaRatio < 0.6) {
    score -= 0.1;
  }

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

export class CloudVisionOcrService {
  /**
   * Execute Google Cloud Vision OCR via authenticated backend proxy
   * @param {string} imageUri
   * @param {string} [base64]
   * @returns {Promise<{ success: boolean, engine: string, rawText: string, confidence: number, processingTimeMs: number, error?: string }>}
   */
  static async executeGoogleOcr(imageUri, base64 = null, budgetOpts = {}) {
    const startedAt = budgetOpts.startedAt || Date.now();
    return withOcrRetryWithinBudget(
      async ({ timeoutMs }) => {
        const tStart = Date.now();
        try {
          const proxy = await this.recognizeTextViaCloudFunction(imageUri, base64, { timeoutMs });
          const processingTimeMs = Date.now() - tStart;
          if (proxy.success && proxy.text && proxy.text.trim().length > 20) {
            const confidence = calculateOcrConfidence(proxy.text);
            return {
              success: true,
              engine: 'cloud-vision-function',
              rawText: proxy.text,
              confidence,
              processingTimeMs,
              aborted: Boolean(proxy.aborted),
            };
          }
          return {
            success: false,
            engine: 'cloud-vision-function',
            rawText: proxy.text || '',
            confidence: proxy.text ? calculateOcrConfidence(proxy.text) : 0,
            processingTimeMs,
            aborted: Boolean(proxy.aborted),
            error: proxy.error || 'Insufficient text from Google Cloud Vision',
          };
        } catch (err) {
          return {
            success: false,
            engine: 'cloud-vision-function',
            rawText: '',
            confidence: 0,
            processingTimeMs: Date.now() - tStart,
            aborted: /abort/i.test(String(err?.message || '')),
            error: err?.message || 'Google Cloud Vision request failed',
          };
        }
      },
      { startedAt },
    );
  }

  /**
   * Execute Microsoft Azure Computer Vision OCR with base64 conversion guarantee
   * @param {string} imageUri
   * @param {string} [base64]
   * @returns {Promise<{ success: boolean, engine: string, rawText: string, confidence: number, processingTimeMs: number, error?: string }>}
   */
  static async executeAzureOcr(imageUri, base64 = null, budgetOpts = {}) {
    // Azure Document Intelligence completely removed from active pipeline
    return {
      success: false,
      engine: 'azure-vision-read',
      rawText: '',
      confidence: 0,
      processingTimeMs: 0,
      error: 'Azure OCR disabled — pipeline migrated to Gemini Vision',
    };
  }

  static async recognizeInvoice(imageUri, options = {}) {
    Haptics.tap();
    if (!imageUri) {
      return {
        success: false,
        data: emptyInvoiceData(),
        sweetBill: parseBillData(''),
        error: 'No image provided',
      };
    }

    const t0 = options.t0ScanInitiated || Date.now();
    const preprocessingStart = Date.now();
    let precomputedBase64 =
      typeof options?.base64 === 'string' && options.base64.length > 0
        ? options.base64
        : null;

    // Handle alreadyPreprocessed flag correctly:
    // If alreadyPreprocessed=true, never re-compress or re-resize; read base64 directly if needed.
    // If alreadyPreprocessed is false / missing and base64 is missing, run single-pass preprocessing.
    if (!precomputedBase64 && imageUri) {
      try {
        if (options.alreadyPreprocessed === true) {
          const fs = getFileSystem();
          if (fs) {
            precomputedBase64 = await fs.readAsStringAsync(imageUri, {
              encoding: fs.EncodingType?.Base64 || 'base64',
            });
          }
        } else {
          try {
            const { preprocessScanImage } = require('./scanImagePreprocess');
            const pre = await preprocessScanImage(imageUri, { base64: true });
            if (pre?.base64) precomputedBase64 = pre.base64;
          } catch {
            const fs = getFileSystem();
            if (fs) {
              precomputedBase64 = await fs.readAsStringAsync(imageUri, {
                encoding: fs.EncodingType?.Base64 || 'base64',
              });
            }
          }
        }
      } catch (prepErr) {
        console.warn('[CloudVisionOcr] Base64 preparation error:', prepErr?.message || prepErr);
      }
    }
    const preprocessingEnd = Date.now();
    const preprocessingMs = preprocessingEnd - preprocessingStart;

    let imageHash = options.imageHash || null;
    if (!imageHash && precomputedBase64) {
      try {
        const CryptoJS = require('crypto-js');
        imageHash = CryptoJS.SHA256(precomputedBase64).toString();
      } catch {
        imageHash = null;
      }
    }

    const ocrWallStart = Date.now();
    let rawText = '';
    let engine = 'none';
    let cloudError = null;

    const forcePrimaryFailure = Boolean(
      options.forcePrimaryFailure ||
        (typeof process !== 'undefined' &&
          process.env &&
          process.env.FORCE_PRIMARY_OCR_FAILURE === 'true'),
    );
    const forcePrimaryLowConfidence = Boolean(
      options.forcePrimaryLowConfidence ||
        (typeof process !== 'undefined' &&
          process.env &&
          process.env.FORCE_PRIMARY_OCR_LOW_CONFIDENCE === 'true'),
    );
    if (forcePrimaryLowConfidence) options._providerNeedsReview = true;

    let mlKitSuccess = false;
    let mlKitCalls = 0;
    let googleCalled = false;
    let azureCalled = false;
    let primaryFailed = false;
    let fallbackStarted = false;
    let fallbackUsed = false;
    let fallbackEngine = null;
    let fallbackCompleted = false;
    let aborted = false;

    let t3MlKitStart = 0;
    let t3MlKitDone = 0;
    let googleMs = 0;
    let azureMs = 0;
    let googleResult = null;
    let azureResult = null;
    let mlKitCandidate = '';
    let mlKitConfidence = 0;
    const providerBudgetStartedAt = Date.now();

    // 1) Fast On-device ML Kit — candidate only. Heuristic NEVER skips cloud.
    if (!forcePrimaryFailure) {
      try {
        t3MlKitStart = Date.now();
        mlKitCalls += 1;
        const local = await this.recognizeTextViaMlKit(imageUri);
        t3MlKitDone = Date.now();
        if (local.success && local.text && String(local.text).trim()) {
          mlKitCandidate = local.text;
          mlKitSuccess = true;
          mlKitConfidence = calculateOcrConfidence(local.text);
        }
      } catch (localErr) {
        // Proceed to cloud cascade; keep any partial candidate
      }
    } else {
      primaryFailed = true;
      console.log('[OCR_FALLBACK_TEST] PRIMARY_FAILED=true');
    }

    // 2) Google Cloud Vision when cloud verification is enabled (default).
    const cloudEnabled = shouldCallCloudOcr({
      skipCloudOcr: options.skipCloudOcr,
      forcePrimaryFailure,
      mlKitConfidence,
    });
    if (cloudEnabled) {
      googleCalled = true;
      googleResult = await this.executeGoogleOcr(imageUri, precomputedBase64, {
        startedAt: providerBudgetStartedAt,
      });
      googleMs = googleResult.processingTimeMs;
      aborted = aborted || Boolean(googleResult.aborted);

      if (googleResult.success && String(googleResult.rawText || '').trim()) {
        // Keep Google text even when heuristic < 0.8
        if (googleResult.confidence < 0.8) {
          options._providerNeedsReview = true;
        }
      } else {
        cloudError = googleResult.error;
        primaryFailed = true;
      }
    }

    // Azure Document Intelligence removed from execution pipeline

    // 4) Client Vision key — development / explicit opt-in only
    if (
      !isUsableOcrProviderResult(googleResult) &&
      !isUsableOcrProviderResult(azureResult) &&
      allowClientLlmKeys() &&
      !forcePrimaryFailure
    ) {
      try {
        const direct = await this.recognizeTextViaApiKey(imageUri, precomputedBase64);
        if (direct.success && direct.text) {
          googleResult = {
            success: true,
            engine: 'cloud-vision-api-key',
            rawText: direct.text,
            confidence: calculateOcrConfidence(direct.text),
            processingTimeMs: 0,
          };
          cloudError = null;
        } else if (!cloudError) {
          cloudError = direct.error;
        }
      } catch (error) {
        if (!cloudError) cloudError = error?.message || 'Cloud Vision API key call failed';
      }
    }

    const selected = selectOcrRawText({
      mlKitText: mlKitCandidate,
      mlKitEngine: 'mlkit-ondevice',
      googleResult,
      azureResult,
    });
    rawText = selected.rawText;
    engine = selected.engine;
    if (selected.needsReview) options._providerNeedsReview = true;
    if (selected.conflict) options._providerConflict = true;
    fallbackUsed = fallbackUsed || (azureCalled && String(engine || '').includes('azure'));

    // 5) Second ML Kit only if no usable text exists yet
    if (shouldRunSecondMlKit({ rawText }) && !forcePrimaryFailure) {
      mlKitCalls += 1;
      const local = await this.recognizeTextViaMlKit(imageUri);
      if (local.success && local.text && local.text.trim().length > 0) {
        rawText = local.text;
        engine = 'mlkit-partial';
      } else if (!cloudError) {
        cloudError = local.error;
      }
    }

    console.log(
      `[OCR_TRACE_02_OCR] engine=${engine} rawChars=${(rawText || '').length} googleCalled=${googleCalled} azureCalled=${azureCalled} mlKitCalls=${mlKitCalls} cloudError=${cloudError ? 'yes' : 'no'}`,
    );

    if (!rawText) {
      Haptics.error();
      const totalMs = Date.now() - t0;
      console.log(
        `[OCR_PERF] googleMs=${googleMs}ms azureMs=${azureMs}ms preprocessingMs=${preprocessingMs}ms extractionMs=0ms totalMs=${totalMs}ms`,
      );
      console.log(
        `[OCR_ROUTE] engine=${engine} googleCalled=${googleCalled} azureCalled=${azureCalled} fallbackUsed=${fallbackUsed} aborted=${aborted} textChars=0 mlKitCalls=${mlKitCalls}`,
      );
      return {
        success: false,
        data: emptyInvoiceData(),
        sweetBill: parseBillData(''),
        engine,
        telemetry: sanitizeOcrTelemetry({
          googleMs,
          azureMs,
          preprocessingMs,
          extractionMs: 0,
          totalMs,
          googleConfidence: googleResult?.confidence ?? null,
          azureConfidence: azureResult?.confidence ?? null,
          googleRawText: googleResult?.rawText || null,
          azureRawText: azureResult?.rawText || null,
          mlKitSuccess,
          mlKitCalls,
          googleCalled,
          azureCalled,
          fallbackUsed,
          aborted,
          textChars: 0,
          primaryFailed,
          fallbackStarted,
          fallbackEngine,
          fallbackCompleted,
          requestId: options.scanSessionId || null,
        }),
        error: cloudError || 'Could not read text from this invoice.',
      };
    }
    const ocrMs = Date.now() - ocrWallStart;

    try {
      resetOcrTrail();
      recordRawOcr(rawText, engine);
    } catch {
      /* debug optional */
    }

    const pipelineStarted = Date.now();
    const { UnifiedAssetExtractor } = require('./UnifiedAssetExtractor');
    const unifiedExtraction = UnifiedAssetExtractor.extract(rawText);
    const baseUnified = unifiedExtraction?.asset || {};

    let canonicalResult = null;
    try {
      const { CanonicalOcrPipeline } = require('./CanonicalOcrPipeline');
      canonicalResult = await CanonicalOcrPipeline.process({
        imageUri,
        rawText,
        base64: precomputedBase64,
        existingAssets: options.existingAssets || [],
        skipQualityGate: true,
      });
    } catch (canErr) {
      console.warn('[CloudVisionOcr] Canonical pipeline error, using fallback:', canErr?.message || canErr);
    }

    let universalResult = null;
    if (!canonicalResult || canonicalResult.status === 'POOR_SCAN' || (!canonicalResult.fields?.productName && !canonicalResult.fields?.totalAmount)) {
      try {
        const { UniversalOcrPipeline } = require('../../../services/ocr/universalPipeline');
        universalResult = await UniversalOcrPipeline.process(rawText, {
          existingAssets: options.existingAssets || [],
          existingVaultedDocs: options.existingVaultedDocs || [],
          previousVerifiedOdometer: options.previousVerifiedOdometer,
          scanSessionId: options.scanSessionId,
          documentId: options.documentId,
          imageHash,
          skipCache: Boolean(options.skipCache),
        });
      } catch (uniErr) {
        console.warn('[CloudVisionOcr] Universal pipeline fallback:', uniErr?.message || uniErr);
      }
    }

    // SweetBill remains an independent audit signal.
    const sweetBill = parseBillData(rawText);
    const energyHints = extractApplianceEnergyFromText(rawText);

    let data = {
      ...emptyInvoiceData(),
      ...baseUnified,
      rawText,
      rawOcrText: rawText,
      isDocumentReadable: unifiedExtraction.isReadable,
      isComplete: unifiedExtraction.isComplete,
      needsManualReview: unifiedExtraction.needsReview,
      unifiedAsset: baseUnified,
    };

    if (canonicalResult?.reviewInvoice) {
      Object.assign(data, canonicalResult.reviewInvoice);
    } else if (universalResult?.reviewInvoice) {
      Object.assign(data, universalResult.reviewInvoice);
    }

    data.ocrPipelineVersion = 'unified_canonical';
    if (canonicalResult) {
      data.canonicalOcr = canonicalResult;
      data.documentCategory = baseUnified.documentCategory || canonicalResult.category;
      data.documentType = canonicalResult.documentType;
      data.classifiedDocumentType = canonicalResult.documentType;
      const rawConf = canonicalResult.overallConfidence ?? canonicalResult.extractionConfidence ?? baseUnified.confidenceScore ?? 0.85;
      data.documentConfidence = rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf);
      data.confidence = data.documentConfidence;
      data.qualityScore = canonicalResult.imageQualityScore;
      data.needsManualReview = unifiedExtraction.needsReview || canonicalResult.status === 'NEEDS_REVIEW' || canonicalResult.status === 'POOR_SCAN';
      data.fieldStatuses = canonicalResult.fieldStatuses || {};
      data.fieldDecisions = canonicalResult.fieldDecisions || {};
      if (canonicalResult.fields) {
        for (const [k, v] of Object.entries(canonicalResult.fields)) {
          if (v !== undefined && v !== null && v !== '' && (data[k] === undefined || data[k] === '')) {
            data[k] = v;
          }
        }
      }
    }

    console.log(
      `[OCR_TRACE_05_CANONICAL] docType=${data.documentType || 'UNKNOWN'} category=${data.documentCategory || 'GENERAL'} status=${canonicalResult?.status || 'FALLBACK'} confidence=${data.documentConfidence ?? 0}`,
    );

    // Ensure all critical review aliases are symmetrically mapped from Canonical / UnifiedAssetExtractor
    data.rawText = rawText;
    data.rawOcrText = rawText;

    const isSpecializedDoc = [
      'VEHICLE_INSURANCE',
      'VEHICLE_PUC',
      'VEHICLE_RC',
      'VEHICLE_SERVICE',
      'VEHICLE_SERVICE_INVOICE',
      'VEHICLE_SERVICE_BILL',
      'ELECTRICITY_BILL',
    ].includes(String(data.documentType || data.classifiedDocumentType || '').toUpperCase());

    if (isSpecializedDoc) {
      data.productName = data.productName || data.assetName || data.itemName || baseUnified.productName || '';
      data.assetName = data.productName;
      data.itemName = data.productName;
      data.shopName = data.shopName || data.vendor || data.sellerName || data.vendorName || data.insurerName || data.insurer || baseUnified.merchantName || '';
      data.vendor = data.shopName;
      data.vendorName = data.shopName;
      data.sellerName = data.shopName;
      data.invoiceNumber = data.invoiceNumber || data.policyNumber || data.certificateNumber || data.consumerId || data.billNumber || baseUnified.invoiceNumber || '';
      data.invoiceDate = data.invoiceDate || data.purchaseDate || data.policyStartDate || baseUnified.purchaseDate || '';
      data.purchaseDate = data.invoiceDate;
      data.totalAmount = data.totalAmount ?? data.premiumAmount ?? data.premium ?? data.currentBillAmount ?? data.grandTotal ?? baseUnified.totalAmount ?? null;
      data.price = data.totalAmount;
      data.serialNumber = data.serialNumber || baseUnified.serialNumber || '';
      data.imei = data.imei || baseUnified.imei || '';
      data.registration = data.registration || data.vehicleRegistrationNumber || baseUnified.registrationNumber || '';
      data.chassisNumber = data.chassisNumber || baseUnified.vin || '';
      data.engineNumber = data.engineNumber || '';
      data.warrantyMonths = data.warrantyMonths ?? baseUnified.warrantyPeriodMonths ?? null;
      data.warrantyExpiry = data.warrantyExpiry || baseUnified.warrantyExpiryDate || '';
      // Force clear any generic line items that leaked into specialized docs
      data.items = [];
      data.lineItems = [];
      data.itemCount = 0;
    } else {
      data.productName = baseUnified.productName || data.productName || data.assetName || data.itemName || '';
      data.assetName = data.productName;
      data.itemName = data.productName;
      data.shopName = baseUnified.merchantName || data.shopName || data.vendor || data.sellerName || data.vendorName || '';
      data.vendor = data.shopName;
      data.vendorName = data.shopName;
      data.sellerName = data.shopName;
      data.invoiceNumber = baseUnified.invoiceNumber || data.invoiceNumber || data.billNumber || '';
      data.invoiceDate = baseUnified.purchaseDate || data.invoiceDate || data.purchaseDate || '';
      data.purchaseDate = data.invoiceDate;
      data.totalAmount = data.totalAmount ?? baseUnified.totalAmount ?? data.grandTotal ?? null;
      data.price = data.totalAmount;
      data.serialNumber = baseUnified.serialNumber || data.serialNumber || '';
      data.imei = baseUnified.imei || data.imei || '';
      data.registration = baseUnified.registrationNumber || data.registration || '';
      data.chassisNumber = baseUnified.vin || data.chassisNumber || '';
      data.warrantyMonths = baseUnified.warrantyPeriodMonths ?? data.warrantyMonths ?? null;
      data.warrantyExpiry = baseUnified.warrantyExpiryDate || data.warrantyExpiry || '';
    }

    // Purge accounting fields permanently from domain payload
    delete data.shopGstin;
    delete data.sellerGstin;
    delete data.cgst;
    delete data.sgst;
    delete data.igst;
    delete data.taxAmount;
    delete data.taxRate;
    delete data.hsn;
    delete data.sac;
    delete data.subtotal;
    delete data.itemsSubtotal;
    delete data.paymentMode;

    data.isDocumentReadable = Boolean(
      data.productName ||
      data.shopName ||
      data.totalAmount != null ||
      data.invoiceNumber ||
      data.invoiceDate ||
      (rawText && rawText.length >= 10)
    );

    console.log(
      `[OCR_TRACE_06_NORMALIZER] hasProduct=${Boolean(data.productName)} hasShop=${Boolean(data.shopName)} hasTotal=${data.totalAmount != null} hasDate=${Boolean(data.invoiceDate)} hasInvNum=${Boolean(data.invoiceNumber)}`,
    );

    if (universalResult) {
      data.universalOcr = {
        documentId: universalResult.documentId,
        scanSessionId: universalResult.scanSessionId,
        classification: universalResult.classification,
        metrics: universalResult.metrics,
        validation: universalResult.validation,
        duplicateCheck: universalResult.duplicateCheck,
        entityLink: universalResult.entityLink,
        reviewFamily: universalResult.reviewFamily,
        reviewReasons: universalResult.reviewReasons,
      };
    }
    data.classification = universalResult?.classification || data.classification;
    data.scanSessionId = options.scanSessionId || universalResult?.scanSessionId || data.scanSessionId;
    data.documentId = universalResult?.documentId || data.documentId;
    data.providerConflict = Boolean(options._providerConflict);

    data.pipelineMs = Date.now() - pipelineStarted;

    try {
      if (options._providerNeedsReview || options._providerConflict) {
        data.needsManualReview = true;
        data.ocrProviderConflict = Boolean(options._providerConflict);
      }
      if (universalResult?.duplicateCheck?.isDuplicate) {
        data.needsManualReview = true;
        data.duplicateCheck = universalResult.duplicateCheck;
      }
      data.ocrVerified = false;
      recordFinalMapping({
        finalPrice: data.totalAmount,
        productName: data.productName,
        shopName: data.shopName,
        confidence: data.confidence,
        fieldConfidence: data.fieldConfidence || {},
        rawTextSample: rawText,
      });
    } catch {
      /* optional */
    }

    console.log(
      `[OCR_TRACE_08_AUDIT] needsReview=${Boolean(data.needsManualReview)} readable=${Boolean(data.isDocumentReadable)} quality=${data.qualityScore ?? 0}`,
    );

    const extractionMs = data.pipelineMs || 0;
    const totalMs = Date.now() - t0;

    Haptics.success();
    const observability = buildOcrObservability({
      requestId: options.scanSessionId,
      documentId: data.documentId,
      documentType: data.documentType || data.documentKind,
      ocrProvider: engine,
      processingTime: totalMs,
      confidence: data.confidence ?? 0,
      status: data.needsManualReview ? 'NEEDS_REVIEW' : 'EXTRACTED',
      errorCode: null,
    });
    console.log(
      `[OCR_PERF] requestId=${observability.requestId || '-'} googleMs=${googleMs}ms azureMs=${azureMs}ms preprocessingMs=${preprocessingMs}ms extractionMs=${extractionMs}ms totalMs=${totalMs}ms`,
    );
    console.log(
      `[OCR_ROUTE] engine=${engine} googleCalled=${googleCalled} azureCalled=${azureCalled} fallbackUsed=${fallbackUsed} aborted=${aborted} textChars=${String(rawText || '').length} mlKitCalls=${mlKitCalls}`,
    );

    let diagnosticCase = 'HEALTHY';
    if (!rawText || rawText.trim().length < 25) {
      diagnosticCase = 'CASE_A_EMPTY_OCR_TEXT';
    } else if (!data.productName && data.totalAmount == null && !data.shopName) {
      diagnosticCase = 'CASE_B_PARSER_EXTRACT_FAILED';
    } else if (data.needsManualReview || data.totalAmount == null || !data.invoiceDate || !data.invoiceNumber) {
      diagnosticCase = data.needsManualReview ? 'NEEDS_REVIEW' : 'PARTIAL_EXTRACTION';
    } else if (data.confidence == null || data.confidence < 50) {
      diagnosticCase = 'CASE_E_LOW_CONFIDENCE_REVIEW';
    }
    console.log(
      `[OCR_DIAGNOSTIC] stage=${diagnosticCase} docType=${data.documentType || 'UNKNOWN'} textChars=${String(rawText || '').length} hasProduct=${Boolean(data.productName)} hasTotal=${data.totalAmount != null} hasShop=${Boolean(data.shopName)} confidence=${data.confidence}`,
    );
    return {
      success: true,
      data,
      sweetBill,
      confidence: data.confidence ?? 0,
      needsManualReview: Boolean(data.needsManualReview),
      energyHints,
      gemini: null,
      rawText,
      engine,
      cloudError: engine === 'mlkit-fallback' ? cloudError : null,
      telemetry: sanitizeOcrTelemetry({
        scanId: options.scanSessionId || `scan_${Date.now()}`,
        requestId: options.scanSessionId || null,
        documentId: options.documentId,
        imageBytes: precomputedBase64 ? Math.round((precomputedBase64.length * 3) / 4) : 0,
        t0ScanInitiated: options.t0ScanInitiated || ocrWallStart,
        googleMs,
        azureMs,
        preprocessingMs,
        extractionMs,
        totalMs,
        googleConfidence: googleResult?.confidence ?? null,
        azureConfidence: azureResult?.confidence ?? null,
        googleRawText: googleResult?.rawText || null,
        azureRawText: azureResult?.rawText || null,
        t3MlKitStart,
        t3MlKitDone,
        pipelineMetrics: universalResult?.metrics,
        mlKitSuccess,
        mlKitCalls,
        googleCalled,
        azureCalled,
        fallbackUsed,
        aborted,
        textChars: String(rawText || '').length,
        primaryFailed,
        fallbackStarted,
        fallbackEngine,
        fallbackCompleted,
        totalOcrMs: ocrMs,
        pipelineMs: extractionMs,
        providerConflict: Boolean(options._providerConflict),
      }),
    };
  }

  static async recognizeTextViaApiKey(imageUri, precomputedBase64 = null) {
    const fs = getFileSystem();
    const base64 =
      precomputedBase64 ||
      (fs ? await fs.readAsStringAsync(imageUri, {
        encoding: fs.EncodingType?.Base64 || 'base64',
      }) : '');
    return scanInvoiceImage(base64);
  }

  static async recognizeTextViaCloudFunction(imageUri, precomputedBase64 = null, opts = {}) {
    const fs = getFileSystem();
    const base64 =
      precomputedBase64 ||
      (fs ? await fs.readAsStringAsync(imageUri, {
        encoding: fs.EncodingType?.Base64 || 'base64',
      }) : '');
    const trimmed = base64.length > 4_500_000 ? base64.slice(0, 4_500_000) : base64;

    let user = null;
    try {
      const authMod = require('@react-native-firebase/auth');
      const auth = authMod?.default || authMod;
      user = auth().currentUser;
    } catch {
      // Offline / unit test runtime
    }
    const headers = { 'Content-Type': 'application/json' };
    if (user) {
      try {
        const token = await user.getIdToken();
        headers.Authorization = `Bearer ${token}`;
      } catch {
        /* token optional */
      }
    }

    if (cloudFunctionDisabled) {
      return { success: false, error: 'Cloud Vision proxy disabled (404/unavailable)' };
    }

    const timeoutMs = Math.max(
      1,
      Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : 6000,
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(visionUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: trimmed }),
        signal: controller.signal,
      });
      if (res.status === 404) {
        cloudFunctionDisabled = true;
        return { success: false, error: 'Cloud Vision endpoint not found (404)' };
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        return {
          success: false,
          error: json?.error || `Cloud Vision HTTP ${res.status}`,
        };
      }
      return { success: true, text: String(json.text || '') };
    } catch (err) {
      const aborted = /abort/i.test(String(err?.message || err || ''));
      return {
        success: false,
        aborted,
        error: aborted ? 'aborted' : err?.message || 'Cloud Vision request failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  static async recognizeTextViaMlKit(imageUri) {
    try {
      // eslint-disable-next-line global-require
      const module = require('@react-native-ml-kit/text-recognition');
      const recognizer = module?.default || module;
      const normalizedPath =
        typeof imageUri === 'string' && imageUri.startsWith('/')
          ? `file://${imageUri}`
          : imageUri;
      const result = await recognizer.recognize(normalizedPath);
      return { success: true, text: result?.text || '' };
    } catch (error) {
      console.warn('[ML_KIT_RECOGNIZE_ERROR]:', error?.message || error);
      const missingNative =
        /cannot find module|native module|null|undefined/i.test(String(error?.message || error));
      return {
        success: false,
        needsNative: missingNative,
        error: missingNative
          ? 'On-device OCR unavailable in this build.'
          : error?.message || 'ML Kit OCR failed',
      };
    }
  }
}

export default CloudVisionOcrService;

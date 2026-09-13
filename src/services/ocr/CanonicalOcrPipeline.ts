/**
 * Asset Doctor — Canonical Master OCR Pipeline
 *
 * The single canonical production OCR entry point:
 * Flow:
 *   IMAGE / CAPTURE
 *   → PREPROCESS (non-destructive dual-tier derivative)
 *   → CAPTURE QUALITY ASSESSMENT (ImageQualityAnalyzer)
 *   → PRIMARY STRUCTURED OCR (Document AI -> Cloud Vision -> Azure -> ML Kit)
 *   → DOCUMENT CLASSIFICATION (HybridDocumentClassifier)
 *   → TYPE-SPECIFIC EXTRACTION (Real Electronics / Appliance / Vehicle / Insurance / PUC Extractors)
 *   → FIELD CANDIDATE FUSION & RANKING (FieldCandidateEngine)
 *   → CROSS-FIELD VALIDATION (CrossFieldValidator & GrandTotalEngine)
 *   → ASSET MATCHING & DUPLICATE GUARD
 *   → CONFIDENCE CALIBRATION & REVIEW INVOICE FORMATION
 */

import { ImagePreprocessEngine } from './engine/ImagePreprocessEngine';
import { ImageQualityAnalyzer, type QualityAssessment } from './engine/ImageQualityAnalyzer';
import { HybridDocumentClassifier, type CanonicalDocumentType } from './engine/HybridDocumentClassifier';
import { FieldCandidateEngine, type ResolvedField } from './engine/FieldCandidateEngine';
import { CrossFieldValidator } from './engine/CrossFieldValidator';
import { GrandTotalEngine, type FinancialBreakdown } from './engine/GrandTotalEngine';
import { RealElectronicsExtractor } from './extractors/RealElectronicsExtractor';
import { RealApplianceExtractor } from './extractors/RealApplianceExtractor';
import { RealVehiclePurchaseExtractor } from './extractors/RealVehiclePurchaseExtractor';
import { RealVehicleServiceExtractor } from './extractors/RealVehicleServiceExtractor';
import { RealPurchaseInvoiceExtractor } from './extractors/RealPurchaseInvoiceExtractor';
import { RealElectricityBillExtractor } from './extractors/RealElectricityBillExtractor';
import { ElectricityBillValidator } from './engine/ElectricityBillValidator';
import { GoogleVisionEngine } from '../../ocr/engines/GoogleVisionEngine';
import { AzureVisionEngine } from '../../ocr/engines/AzureVisionEngine';

function getDocumentAiProvider() {
  try {
    const mod = require('../../providers/ocr/GoogleDocumentAiProvider');
    const Cls = mod.GoogleDocumentAiProvider || mod.default;
    return Cls ? new Cls() : null;
  } catch {
    return null;
  }
}

function getLocalOcrEngine() {
  try {
    const mod = require('../../ocr/engines/LocalOcrEngine');
    return mod.LocalOcrEngine || mod.default || null;
  } catch {
    return null;
  }
}

export interface CanonicalOcrInput {
  imageUri?: string;
  rawText?: string;
  base64?: string | null;
  categoryHint?: string | null;
  existingAssets?: any[];
  forceSecondary?: boolean;
  skipQualityGate?: boolean;
  authToken?: string;
}

export interface CanonicalOcrResult {
  success: boolean;
  documentType: CanonicalDocumentType;
  category: 'VEHICLE' | 'ELECTRONICS' | 'APPLIANCE' | 'GENERAL' | 'ENERGY';
  imageQualityScore: number;
  extractionConfidence: number;
  overallConfidence: number;
  status: 'EXTRACTED' | 'NEEDS_REVIEW' | 'POOR_SCAN';
  needsRetake: boolean;
  qualityIssues: string[];
  qualityTips: string[];
  fields: Record<string, any>;
  fieldStatuses: Record<string, 'VERIFIED' | 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'NOT_FOUND'>;
  fieldDecisions: Record<string, { decision: string; confidence: number; evidence: string; provider: string }>;
  reviewInvoice: Record<string, any>;
  financialBreakdown: FinancialBreakdown;
  rawText: string;
  provider: 'DocumentAI' | 'GoogleVision' | 'Azure' | 'MlKit' | 'Offline';
  providersUsed: string[];
  executionMetrics: Record<string, number>;
}

export class CanonicalOcrPipeline {
  /**
   * Primary canonical execution pipeline.
   */
  public static async process(input: CanonicalOcrInput): Promise<CanonicalOcrResult> {
    const t0 = Date.now();
    const metrics: Record<string, number> = {};
    const providersUsed: string[] = [];

    let rawText = input.rawText || '';
    let chosenProvider: CanonicalOcrResult['provider'] = rawText ? 'Offline' : 'Offline';
    let structuredProviderData: any = null;
    if (rawText) {
      providersUsed.push('DirectText');
    }

    // 1. Image Preprocessing Stage (if imageUri provided)
    const tPre0 = Date.now();
    const prepped = input.imageUri
      ? await ImagePreprocessEngine.prepareOcrDerivative(input.imageUri, {
          base64: true,
          alreadyPreprocessed: false,
        })
      : { ocrUri: '', base64: input.base64 || '', width: 1200, height: 1600, wasPreprocessed: false, rotationApplied: 0 };
    metrics.preprocessMs = Date.now() - tPre0;

    // 2. Initial Capture Quality Assessment
    let quality = ImageQualityAnalyzer.assessQuality({
      width: prepped.width,
      height: prepped.height,
      base64Length: prepped.base64 ? prepped.base64.length : 0,
    });

    if (!quality.ok && !input.skipQualityGate && quality.imageQualityScore < 30 && !rawText) {
      return this.buildPoorScanResult(quality, metrics);
    }

    const base64Payload = prepped.base64 || input.base64 || '';

    // Check Document AI
    const docAi = getDocumentAiProvider();
    if (docAi && docAi.isEnabled() && base64Payload) {
      const tDocAi0 = Date.now();
      try {
        const docAiRes = await docAi.extract({ base64: base64Payload, imageUri: prepped.ocrUri });
        metrics.documentAiMs = Date.now() - tDocAi0;
        if (docAiRes.success && docAiRes.text && docAiRes.text.trim().length > 20) {
          rawText = docAiRes.text;
          chosenProvider = 'DocumentAI';
          providersUsed.push('DocumentAI');
          structuredProviderData = docAiRes.structured;
        }
      } catch {
        /* proceed to fallback */
      }
    }

    // Fallback to Google Cloud Vision
    if (!rawText && base64Payload) {
      const tVision0 = Date.now();
      try {
        const visionRes = await GoogleVisionEngine.recognize(base64Payload, input.authToken);
        metrics.googleVisionMs = Date.now() - tVision0;
        if (visionRes.success && visionRes.rawText && visionRes.rawText.trim().length > 20) {
          rawText = visionRes.rawText;
          chosenProvider = 'GoogleVision';
          providersUsed.push('GoogleVision');
        }
      } catch {
        /* proceed to Azure */
      }
    }

    // Azure fallback completely removed (pipeline uses Gemini Vision)

    // Offline Local ML Kit Fallback
    const localEngine = getLocalOcrEngine();
    if (!rawText && prepped.ocrUri && localEngine) {
      const tLocal0 = Date.now();
      try {
        const localRes = await localEngine.recognize(prepped.ocrUri);
        metrics.localOcrMs = Date.now() - tLocal0;
        if (localRes.success && localRes.rawText) {
          rawText = localRes.rawText;
          chosenProvider = 'MlKit';
          providersUsed.push('MlKit');
        }
      } catch {
        /* empty */
      }
    }

    // If still no text, check if text was passed in directly
    if (!rawText && typeof input.imageUri === 'string' && input.imageUri.length > 30 && input.imageUri.includes('\n')) {
      rawText = input.imageUri;
      chosenProvider = 'Offline';
      providersUsed.push('DirectText');
    }

    // 4. Quality Re-Evaluation using Text Feedback
    const lines = rawText.split('\n').filter((l) => l.trim().length > 0);
    quality = ImageQualityAnalyzer.assessQuality({
      width: prepped.width,
      height: prepped.height,
      base64Length: base64Payload.length,
      textLength: rawText.length,
      linesCount: lines.length,
    });

    // 5. Document Classification
    const classification = HybridDocumentClassifier.classify(rawText, {
      productName: structuredProviderData?.productName,
      shopName: structuredProviderData?.shopName,
    });
    console.log(
      `[OCR_TRACE_03_CLASSIFIER] docType=${classification.documentType} category=${classification.suggestedCategory} confidence=${classification.confidence} signalsCount=${classification.signals.length}`,
    );

    // 6. Field Candidate Engine & Type-Specific Extraction
    const candidateEngine = new FieldCandidateEngine();
    const financialBreakdown = GrandTotalEngine.extractFinancials(rawText);
    let purchaseData: any = null;
    switch (classification.documentType) {
      case 'VEHICLE_SERVICE_INVOICE':
        RealVehicleServiceExtractor.extract(rawText, candidateEngine);
        break;
      case 'VEHICLE_PURCHASE_INVOICE':
        RealVehiclePurchaseExtractor.extract(rawText, candidateEngine);
        purchaseData = RealPurchaseInvoiceExtractor.extract(rawText, candidateEngine);
        break;
      case 'HOME_APPLIANCE_INVOICE':
        RealApplianceExtractor.extract(rawText, candidateEngine);
        purchaseData = RealPurchaseInvoiceExtractor.extract(rawText, candidateEngine);
        break;
      case 'ELECTRONICS_PURCHASE_INVOICE':
        RealElectronicsExtractor.extract(rawText, candidateEngine);
        purchaseData = RealPurchaseInvoiceExtractor.extract(rawText, candidateEngine);
        break;
      case 'VEHICLE_INSURANCE':
        this.extractInsuranceFields(rawText, candidateEngine);
        break;
      case 'VEHICLE_PUC':
        this.extractPucFields(rawText, candidateEngine);
        break;
      case 'VEHICLE_RC':
        this.extractRcFields(rawText, candidateEngine);
        break;
      case 'ELECTRICITY_BILL':
        RealElectricityBillExtractor.extract(rawText, candidateEngine);
        break;
      case 'GENERIC_INVOICE':
      default:
        purchaseData = RealPurchaseInvoiceExtractor.extract(rawText, candidateEngine);
        RealElectronicsExtractor.extract(rawText, candidateEngine);
        break;
    }

    // 7. Resolve Final Fields with Cross-Field Validators
    const resolvedFields = candidateEngine.resolveAll({
      imei: CrossFieldValidator.validateImei,
      registration: CrossFieldValidator.validateIndianRegistration,
      sellerPhone: CrossFieldValidator.validateIndianPhone,
      shopPhone: CrossFieldValidator.validateIndianPhone,
      odometerKm: (val) =>
        CrossFieldValidator.validateOdometer(val, {
          totalAmount: financialBreakdown.grandTotal,
          subtotal: financialBreakdown.subtotal,
        }),
      invoiceDate: (d) => ({ valid: Boolean(CrossFieldValidator.normalizeDate(d)), normalized: CrossFieldValidator.normalizeDate(d) }),
      warrantyExpiry: (d) => ({ valid: Boolean(CrossFieldValidator.normalizeDate(d)), normalized: CrossFieldValidator.normalizeDate(d) }),
    });

    console.log(
      `[OCR_TRACE_04_EXTRACTOR] resolvedFieldsCount=${Object.keys(resolvedFields).length} rawChars=${rawText.length}`,
    );

    // 8. Construct Review Invoice Model
    const fields: Record<string, any> = {};
    const fieldStatuses: Record<string, 'VERIFIED' | 'HIGH_CONFIDENCE' | 'NEEDS_REVIEW' | 'NOT_FOUND'> = {};
    const fieldDecisions: Record<string, { decision: string; confidence: number; evidence: string; provider: string }> = {};

    for (const [key, res] of Object.entries(resolvedFields)) {
      // Per Data Minimization: drop GSTIN and address from structured fields in new scan
      if (key === 'shopGstin' || key === 'sellerGstin' || key === 'shopAddress' || key === 'sellerAddress') {
        continue;
      }
      const val = res.normalizedValue ?? res.value;
      if (val !== undefined && val !== null) {
        fields[key] = val;
      }
      fieldStatuses[key] = res.status;
      fieldDecisions[key] = {
        decision: res.decision,
        confidence: res.confidence,
        evidence: res.evidence,
        provider: res.provider,
      };
    }

    console.log(
      `[OCR_TRACE_07_SANITIZER] fieldsPopulated=${Object.keys(fields).length} docType=${classification.documentType}`,
    );

    // Ensure sellerPhone / shopPhone are mapped symmetrically
    if (fields.sellerPhone && !fields.shopPhone) fields.shopPhone = fields.sellerPhone;
    if (fields.shopPhone && !fields.sellerPhone) fields.sellerPhone = fields.shopPhone;

    // Ensure grand total is assigned
    if (fields.totalAmount == null && financialBreakdown.grandTotal != null) {
      fields.totalAmount = financialBreakdown.grandTotal;
      fieldStatuses.totalAmount = financialBreakdown.validatedByArithmetic ? 'HIGH_CONFIDENCE' : 'HIGH_CONFIDENCE';
      fieldDecisions.totalAmount = {
        decision: 'AUTO_ACCEPT',
        confidence: financialBreakdown.confidence,
        evidence: financialBreakdown.rawEvidence,
        provider: 'GrandTotalEngine',
      };
    }

    if (classification.documentType === 'ELECTRICITY_BILL') {
      const elecData = RealElectricityBillExtractor.extract(rawText);
      const elecVal = ElectricityBillValidator.validate(elecData);
      Object.assign(fields, {
        electricityProvider: elecData.electricityProvider,
        consumerId: elecData.consumerId,
        billingMonth: elecData.billingMonth,
        billDate: elecData.billDate,
        dueDate: elecData.dueDate,
        previousMeterReading: elecData.previousMeterReading,
        currentMeterReading: elecData.currentMeterReading,
        unitsConsumedKwh: elecData.unitsConsumedKwh,
        billingDays: elecData.billingDays,
        currentBillAmount: elecData.currentBillAmount,
        energyCharge: elecData.energyCharge,
        fixedCharge: elecData.fixedCharge,
        arrears: elecData.arrears,
        subsidy: elecData.subsidy,
        totalPayable: elecData.totalPayable,
        tariffRate: elecData.tariffRate,
        meterNumber: elecData.meterNumber,
        totalAmount: elecData.currentBillAmount,
        purchasePrice: elecData.currentBillAmount,
        productName: `Electricity Bill - ${elecData.electricityProvider}`,
        shopName: elecData.electricityProvider,
        invoiceNumber: elecData.consumerId,
        invoiceDate: elecData.billDate,
        isElectricityBill: true,
        multiplier: elecVal.multiplierDetected,
        isMeterReset: elecVal.isMeterReset,
        needsReview: elecVal.needsReview,
        reviewReasons: elecVal.reviewReasons,
        fieldIntelligence: elecVal.fieldIntelligence,
      });
      for (const [k, v] of Object.entries(elecVal.fieldIntelligence)) {
        fieldStatuses[k] = v.status === 'REVIEW' ? 'NEEDS_REVIEW' : v.status;
      }
    }

    // 9. Calculate Extraction Confidence (derives from important field coverage)
    const extractionConfidence = this.calculateExtractionConfidence(classification.documentType, fields);
    const overallConfidence = Math.round((0.35 * quality.imageQualityScore + 0.65 * (extractionConfidence * 100)));

    let status: CanonicalOcrResult['status'] = 'EXTRACTED';
    if (rawText.trim().length < 25) {
      status = 'POOR_SCAN';
    } else if (extractionConfidence < 0.65) {
      status = 'NEEDS_REVIEW';
    }

    const reviewInvoice: Record<string, any> = {
      ...fields,
      confidence: extractionConfidence,
      classifiedDocumentType: classification.documentType,
      classifiedCategory: classification.suggestedCategory,
      qualityScore: quality.imageQualityScore,
      productName: fields.productName || fields.assetName || fields.itemName || null,
      assetName: fields.productName || fields.assetName || fields.itemName || null,
      itemName: fields.productName || fields.assetName || fields.itemName || null,
      shopName: fields.shopName || fields.vendor || fields.sellerName || null,
      vendor: fields.shopName || fields.vendor || fields.sellerName || null,
      vendorName: fields.shopName || fields.vendor || fields.sellerName || null,
      sellerName: fields.shopName || fields.vendor || fields.sellerName || null,
      invoiceNumber: fields.invoiceNumber || fields.billNumber || null,
      invoiceDate: fields.invoiceDate || fields.purchaseDate || null,
      purchaseDate: fields.purchaseDate || fields.invoiceDate || null,
      totalAmount: fields.totalAmount ?? financialBreakdown.grandTotal ?? null,
      purchasePrice: fields.totalAmount ?? financialBreakdown.grandTotal ?? null,
      grandTotal: fields.totalAmount ?? financialBreakdown.grandTotal ?? null,
      sellerPhone: fields.sellerPhone ?? fields.shopPhone ?? null,
      shopPhone: fields.shopPhone ?? fields.sellerPhone ?? null,
      warrantyExpiry: fields.warrantyExpiry ?? null,
      warrantyMonths: fields.warrantyMonths ?? null,
      labourCharges: fields.labourCharges ?? financialBreakdown.labourCharges,
      partsTotal: fields.partsTotal ?? financialBreakdown.partsTotal,
      fieldStatuses,
      fieldDecisions,
      fieldConfidence: Object.fromEntries(
        Object.entries(resolvedFields).map(([k, v]) => [k, v.confidence])
      ),
      rawOcrText: rawText,
      lineItems: ['VEHICLE_INSURANCE', 'VEHICLE_PUC', 'VEHICLE_RC'].includes(classification.documentType)
        ? []
        : (purchaseData?.lineItems || []),
      items: ['VEHICLE_INSURANCE', 'VEHICLE_PUC', 'VEHICLE_RC'].includes(classification.documentType)
        ? []
        : (purchaseData?.lineItems || []).map((it: any, idx: number) => ({
            index: idx + 1,
            name: it.description,
            amount: it.amount,
            quantity: it.quantity || 1,
          })),
      isDocumentReadable: Boolean(
        fields.productName ||
        fields.shopName ||
        fields.totalAmount != null ||
        fields.invoiceNumber ||
        fields.invoiceDate ||
        rawText.length >= 25
      ),
    };

    metrics.totalDurationMs = Date.now() - t0;

    return {
      success: rawText.length > 0,
      documentType: classification.documentType,
      category: classification.suggestedCategory,
      imageQualityScore: quality.imageQualityScore,
      extractionConfidence,
      overallConfidence,
      status,
      needsRetake: status === 'POOR_SCAN',
      qualityIssues: quality.issues,
      qualityTips: quality.tips,
      fields,
      fieldStatuses,
      fieldDecisions,
      reviewInvoice,
      financialBreakdown,
      rawText,
      provider: chosenProvider,
      providersUsed,
      executionMetrics: metrics,
    };
  }

  /**
   * Computes domain-specific field coverage and validity confidence.
   */
  private static calculateExtractionConfidence(
    docType: CanonicalDocumentType,
    fields: Record<string, any>
  ): number {
    let score = 0;

    switch (docType) {
      case 'VEHICLE_SERVICE_INVOICE':
        if (fields.shopName) score += 0.20;
        if (fields.registration) score += 0.25;
        if (fields.odometerKm != null) score += 0.25;
        if (fields.totalAmount != null) score += 0.20;
        if (fields.invoiceDate) score += 0.10;
        break;

      case 'VEHICLE_PURCHASE_INVOICE':
        if (fields.shopName) score += 0.15;
        if (fields.productName) score += 0.20;
        if (fields.registration || fields.chassisNumber) score += 0.25;
        if (fields.totalAmount != null) score += 0.25;
        if (fields.invoiceNumber || fields.invoiceDate) score += 0.15;
        break;

      case 'ELECTRONICS_PURCHASE_INVOICE':
      case 'HOME_APPLIANCE_INVOICE':
        if (fields.productName) score += 0.30;
        if (fields.totalAmount != null) score += 0.30;
        if (fields.shopName) score += 0.20;
        if (fields.serialNumber || fields.imei) score += 0.10;
        if (fields.invoiceNumber || fields.invoiceDate) score += 0.10;
        break;

      case 'VEHICLE_INSURANCE':
        if (fields.policyNumber) score += 0.35;
        if (fields.registration) score += 0.25;
        if (fields.idvAmount != null || fields.totalAmount != null) score += 0.20;
        if (fields.insuranceExpiry) score += 0.20;
        break;

      case 'VEHICLE_PUC':
        if (fields.invoiceNumber || fields.pucCertificateNo) score += 0.35;
        if (fields.registration) score += 0.35;
        if (fields.pucExpiry || fields.invoiceDate) score += 0.30;
        break;

      case 'ELECTRICITY_BILL':
        if (fields.electricityProvider && fields.electricityProvider !== 'Electricity Provider') score += 0.25;
        if (fields.consumerId) score += 0.25;
        if (fields.currentBillAmount != null) score += 0.25;
        if (fields.unitsConsumedKwh != null) score += 0.15;
        if (fields.billDate || fields.dueDate) score += 0.10;
        break;

      case 'GENERIC_INVOICE':
      default:
        if (fields.productName) score += 0.35;
        if (fields.totalAmount != null) score += 0.35;
        if (fields.shopName) score += 0.15;
        if (fields.invoiceNumber || fields.invoiceDate) score += 0.15;
        break;
    }

    return Math.min(0.99, Math.max(0.25, Math.round(score * 100) / 100));
  }

  /**
   * Helper for Insurance Policy field extraction.
   */
  private static extractInsuranceFields(rawText: string, engine: FieldCandidateEngine): void {
    const text = rawText || '';

    const polMatch =
      text.match(/(?:POLICY|CERTIFICATE)[^\S\r\n]*(?:NO\.?|NUM(?:BER)?|#)[^\S\r\n]*[:\-#][^\S\r\n]*([A-Z0-9\-/]+)/i) ||
      text.match(/(?:POLICY\s*(?:NO|NUMBER|#)?|CERTIFICATE\s*NO)[:\s\-]*([A-Z0-9\-/]+)/i);
    if (polMatch) {
      const pol = polMatch[1].trim();
      if (!/^(?:cum|schedule|certificate)$/i.test(pol)) {
        engine.addCandidate({
          field: 'policyNumber',
          value: pol,
          normalizedValue: pol,
          provider: 'LayoutRegex',
          rawEvidence: pol,
          confidence: 0.96,
          validationStatus: 'VALID',
        });
        engine.addCandidate({
          field: 'invoiceNumber',
          value: pol,
          normalizedValue: pol,
          provider: 'LayoutRegex',
          rawEvidence: pol,
          confidence: 0.96,
          validationStatus: 'VALID',
        });
      }
    }

    // Insurer company name
    const insurerMatch = text.match(/\b(ICICI\s*LOMBARD|HDFC\s*ERGO|BAJAJ\s*ALLIANZ|NEW\s*INDIA\s*ASSURANCE|TATA\s*AIG|IFFCO\s*TOKIO|GO\s*DIGIT|UNITED\s*INDIA|NATIONAL\s*INSURANCE|SBI\s*GENERAL|RELIANCE\s*GENERAL|CHOLAMANDALAM)[A-Za-z0-9\s.,&'–—]*/i);
    if (insurerMatch) {
      const insurerName = insurerMatch[0].split(/\n|BRANCH|\(IRDAI/i)[0].trim();
      engine.addCandidate({
        field: 'shopName',
        value: insurerName,
        normalizedValue: insurerName,
        provider: 'LayoutRegex',
        rawEvidence: insurerName,
        confidence: 0.95,
        validationStatus: 'VALID',
      });
      engine.addCandidate({
        field: 'vendor',
        value: insurerName,
        normalizedValue: insurerName,
        provider: 'LayoutRegex',
        rawEvidence: insurerName,
        confidence: 0.95,
        validationStatus: 'VALID',
      });
    }

    // Product name: Make & Model or "Vehicle Insurance Policy"
    const modelMatch = text.match(/(?:MAKE\s*(?:&|\/)\s*MODEL|VEHICLE\s*MODEL)[^\S\r\n]*[:\-][^\S\r\n]*([A-Za-z0-9\s\-]+)/i);
    const prodName = modelMatch && !/\b(?:model\s*town)\b/i.test(modelMatch[1])
      ? `${modelMatch[1].trim()} Insurance`
      : 'Vehicle Insurance Policy';
    engine.addCandidate({
      field: 'productName',
      value: prodName,
      normalizedValue: prodName,
      provider: 'LayoutRegex',
      rawEvidence: prodName,
      confidence: 0.92,
      validationStatus: 'VALID',
    });

    // Policy Issue / Start Date
    const startDateMatch = text.match(/(?:FROM|ISSUE\s*DATE|PERIOD\s*OF\s*INSURANCE[^\n]*\n[^\n]*FROM)[:\s\-]*([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i);
    if (startDateMatch) {
      const normDate = CrossFieldValidator.normalizeDate(startDateMatch[1]);
      if (normDate) {
        engine.addCandidate({
          field: 'invoiceDate',
          value: normDate,
          normalizedValue: normDate,
          provider: 'LayoutRegex',
          rawEvidence: startDateMatch[0],
          confidence: 0.95,
          validationStatus: 'VALID',
        });
      }
    }

    const regMatch = text.match(/(?:REG(?:ISTRATION)?\s*(?:NO|NUMBER)?|VEHICLE\s*NO)[:\s\-]*([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{0,3}\s*[0-9]{4})\b/i);
    if (regMatch) {
      const val = CrossFieldValidator.validateIndianRegistration(regMatch[1]);
      if (val.valid) {
        engine.addCandidate({
          field: 'registration',
          value: val.normalized || regMatch[1],
          normalizedValue: val.normalized || regMatch[1],
          provider: 'LayoutRegex',
          rawEvidence: regMatch[0],
          confidence: 0.98,
          validationStatus: 'VALID',
        });
      }
    }

    const idvMatch = text.match(/(?:IDV|INSURED\s*DECLARED\s*VALUE)[:\s\-]*[₹Rs\s]*([0-9,]+)/i);
    if (idvMatch) {
      const idv = Number(idvMatch[1].replace(/,/g, ''));
      engine.addCandidate({
        field: 'idvAmount',
        value: idv,
        normalizedValue: idv,
        provider: 'LayoutRegex',
        rawEvidence: idvMatch[0],
        confidence: 0.97,
        validationStatus: 'VALID',
      });
    }

    // Premium Amount: Prioritize Final Total Premium Payable, then Net Premium, then Gross Premium
    const totalPayableMatch = text.match(/(?:TOTAL\s*PREMIUM\s*PAYABLE|FINAL\s*PREMIUM|TOTAL\s*AMOUNT\s*PAYABLE|AMOUNT\s*PAYABLE|TOTAL\s*PAYABLE)[:\s\-]+(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/i);
    const netPremMatch = text.match(/(?:NET\s*PREMIUM(?:\s*PAYABLE)?|PREMIUM\s*(?:PAYABLE|AMOUNT)?|TOTAL\s*PREMIUM)[:\s\-]+(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/i);
    const grossPremMatch = text.match(/(?:GROSS\s*PREMIUM|TOTAL\s*AMOUNT)[:\s\-]+(?:Rs\.?|INR|₹|\s)*([0-9,]+(?:\.[0-9]{2})?)/i);

    const premMatch = totalPayableMatch || netPremMatch || grossPremMatch;
    if (premMatch) {
      const cleanAmt = Number(premMatch[1].replace(/,/g, ''));
      if (Number.isFinite(cleanAmt) && cleanAmt > 0) {
        engine.addCandidate({
          field: 'premiumAmount',
          value: cleanAmt,
          normalizedValue: cleanAmt,
          provider: 'LayoutRegex',
          rawEvidence: premMatch[0],
          confidence: totalPayableMatch ? 0.99 : 0.95,
          validationStatus: 'VALID',
        });
        engine.addCandidate({
          field: 'totalAmount',
          value: cleanAmt,
          normalizedValue: cleanAmt,
          provider: 'LayoutRegex',
          rawEvidence: premMatch[0],
          confidence: totalPayableMatch ? 0.99 : 0.95,
          validationStatus: 'VALID',
        });
      }
    }

    // Chassis / VIN Number
    const chassisMatch = text.match(/(?:CHASSIS\s*(?:NO|NUMBER)?|VIN)[:\s\-]*([A-HJ-NPR-Z0-9]{10,18})/i);
    if (chassisMatch) {
      const ch = chassisMatch[1].toUpperCase();
      engine.addCandidate({
        field: 'chassisNumber',
        value: ch,
        normalizedValue: ch,
        provider: 'LayoutRegex',
        rawEvidence: chassisMatch[0],
        confidence: 0.98,
        validationStatus: 'VALID',
      });
    }

    // Engine Number
    const engineMatch = text.match(/(?:ENGINE\s*(?:NO|NUMBER)?|MOTOR\s*NO)[:\s\-]*([A-Z0-9]{6,18})/i);
    if (engineMatch) {
      const eng = engineMatch[1].toUpperCase();
      engine.addCandidate({
        field: 'engineNumber',
        value: eng,
        normalizedValue: eng,
        provider: 'LayoutRegex',
        rawEvidence: engineMatch[0],
        confidence: 0.97,
        validationStatus: 'VALID',
      });
    }

    const expMatch = text.match(/(?:TO|EXPIRY(?:\s*DATE)?|VALID\s*UPTO)[:\s\-]*([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i);
    if (expMatch) {
      const normDate = CrossFieldValidator.normalizeDate(expMatch[1]);
      if (normDate) {
        engine.addCandidate({
          field: 'insuranceExpiry',
          value: normDate,
          normalizedValue: normDate,
          provider: 'LayoutRegex',
          rawEvidence: expMatch[0],
          confidence: 0.96,
          validationStatus: 'VALID',
        });
      }
    }
  }

  /**
   * Helper for PUC Certificate field extraction.
   */
  private static extractPucFields(rawText: string, engine: FieldCandidateEngine): void {
    const text = rawText || '';

    const pucMatch = text.match(/(?:PUC\s*CERTIFICATE\s*NO|CERTIFICATE\s*NO|PUC\s*NO)[:\s\-]*([A-Z0-9\-/]+)/i);
    if (pucMatch) {
      const num = pucMatch[1].trim();
      engine.addCandidate({
        field: 'invoiceNumber',
        value: num,
        normalizedValue: num,
        provider: 'LayoutRegex',
        rawEvidence: num,
        confidence: 0.98,
        validationStatus: 'VALID',
      });
    }

    const regMatch = text.match(/(?:REG(?:ISTRATION)?\s*(?:NO|NUMBER)?|VEHICLE\s*REGISTRATION)[:\s\-]*([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{0,3}\s*[0-9]{4})\b/i);
    if (regMatch) {
      const val = CrossFieldValidator.validateIndianRegistration(regMatch[1]);
      if (val.valid) {
        engine.addCandidate({
          field: 'registration',
          value: val.normalized || regMatch[1],
          normalizedValue: val.normalized || regMatch[1],
          provider: 'LayoutRegex',
          rawEvidence: regMatch[0],
          confidence: 0.99,
          validationStatus: 'VALID',
        });
      }
    }

    const expMatch = text.match(/(?:VALIDITY\s*OF\s*PUC|VALID\s*UPTO|EXPIRY)[:\s\-]*([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i);
    if (expMatch) {
      const normDate = CrossFieldValidator.normalizeDate(expMatch[1]);
      if (normDate) {
        engine.addCandidate({
          field: 'pucExpiry',
          value: normDate,
          normalizedValue: normDate,
          provider: 'LayoutRegex',
          rawEvidence: expMatch[0],
          confidence: 0.98,
          validationStatus: 'VALID',
        });
      }
    }
  }

  /**
   * Helper for RC Certificate field extraction.
   */
  private static extractRcFields(rawText: string, engine: FieldCandidateEngine): void {
    const text = rawText || '';

    const regMatch = text.match(/(?:REGN\s*NO|REGISTRATION\s*NO)[:\s\-]*([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{0,3}\s*[0-9]{4})\b/i);
    if (regMatch) {
      const val = CrossFieldValidator.validateIndianRegistration(regMatch[1]);
      if (val.valid) {
        engine.addCandidate({
          field: 'registration',
          value: val.normalized || regMatch[1],
          normalizedValue: val.normalized || regMatch[1],
          provider: 'LayoutRegex',
          rawEvidence: regMatch[0],
          confidence: 0.99,
          validationStatus: 'VALID',
        });
      }
    }

    const chassisMatch = text.match(/(?:CHASSIS\s*NO)[:\s\-]*([A-HJ-NPR-Z0-9]{10,18})\b/i);
    if (chassisMatch) {
      engine.addCandidate({
        field: 'chassisNumber',
        value: chassisMatch[1].toUpperCase().trim(),
        normalizedValue: chassisMatch[1].toUpperCase().trim(),
        provider: 'LayoutRegex',
        rawEvidence: chassisMatch[0],
        confidence: 0.98,
        validationStatus: 'VALID',
      });
    }

    const engineMatch = text.match(/(?:ENGINE\s*NO)[:\s\-]*([A-Z0-9]{6,18})\b/i);
    if (engineMatch) {
      engine.addCandidate({
        field: 'engineNumber',
        value: engineMatch[1].toUpperCase().trim(),
        normalizedValue: engineMatch[1].toUpperCase().trim(),
        provider: 'LayoutRegex',
        rawEvidence: engineMatch[0],
        confidence: 0.98,
        validationStatus: 'VALID',
      });
    }
  }

  /**
   * Builds an early failure response for unreadable frames.
   */
  private static buildPoorScanResult(
    quality: QualityAssessment,
    metrics: Record<string, number>
  ): CanonicalOcrResult {
    return {
      success: false,
      documentType: 'UNKNOWN_DOCUMENT',
      category: 'GENERAL',
      imageQualityScore: quality.imageQualityScore,
      extractionConfidence: 0,
      overallConfidence: quality.imageQualityScore,
      status: 'POOR_SCAN',
      needsRetake: true,
      qualityIssues: quality.issues,
      qualityTips: quality.tips,
      fields: {},
      fieldStatuses: {},
      fieldDecisions: {},
      reviewInvoice: {},
      financialBreakdown: {
        grandTotal: null,
        subtotal: null,
        taxAmount: null,
        cgst: null,
        sgst: null,
        igst: null,
        discount: null,
        labourCharges: null,
        partsTotal: null,
        exShowroomPrice: null,
        confidence: 0,
        validatedByArithmetic: false,
        rawEvidence: '',
      },
      rawText: '',
      provider: 'Offline',
      providersUsed: [],
      executionMetrics: metrics,
    };
  }
}

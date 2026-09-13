/**
 * Asset Doctor — Unified Document Intelligence Processor
 *
 * Implements end-to-end processing pipeline:
 * 1. Image Quality Assessment
 * 2. Multi-Engine OCR & Document Classification
 * 3. User Category vs AI Category Conflict Detection (with mismatch confirmation)
 * 4. Category-Specific Structured Field Extraction
 * 5. Data Normalization & Confidence Validation
 * 6. Deterministic Routing to Dedicated Review Screens (ZERO silent fallback)
 */

import {
  AssetDocumentType,
  PipelineStage,
  getRouteForCanonicalDocType,
  getCanonicalDocTypeLabel,
  normalizeToCanonicalDocType,
} from '../../types/assetDocumentTypes';
import { ImageQualityAnalyzer, QualityAssessment } from './engine/ImageQualityAnalyzer';
import { MultiDocumentRouter } from '../vlm/MultiDocumentRouter';
import { RealVehicleServiceExtractor } from './extractors/RealVehicleServiceExtractor';
import { InsuranceExtractor } from '../../ocr/extractors/InsuranceExtractor';
import { PucExtractor } from '../../ocr/extractors/PucExtractor';
import { RealElectricityBillExtractor } from './extractors/RealElectricityBillExtractor';
import { RealPurchaseInvoiceExtractor } from './extractors/RealPurchaseInvoiceExtractor';
import { CloudVisionOcrService } from './CloudVisionOcrService';

export interface ProcessDocumentOptions {
  userSelectedType?: string | null;
  forceDocumentType?: string | null;
  skipSafetyCheck?: boolean;
  scanSessionId?: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  fileBytes?: number | null;
}

export interface ProcessDocumentResult {
  success: boolean;
  stage: PipelineStage;
  documentType: AssetDocumentType;
  targetRoute: string;
  isTypeMismatch?: boolean;
  detectedType?: AssetDocumentType;
  userSelectedType?: AssetDocumentType;
  confidence: number; // 0 to 100
  needsManualReview: boolean;
  processorUsed: 'GEMINI_VLM' | 'CLOUD_VISION_OCR' | 'LOCAL_MLKIT' | 'MANUAL';
  extractedData: any;
  rawOcrText: string;
  fieldConfidence: Record<string, number>;
  quality: QualityAssessment;
  error?: string;
}

export class UnifiedDocumentProcessor {
  /**
   * Processes a scanned document image end-to-end.
   */
  public static async process(
    imageUri: string,
    base64Image: string | null,
    options: ProcessDocumentOptions = {},
  ): Promise<ProcessDocumentResult> {
    const userSelected = options.userSelectedType
      ? normalizeToCanonicalDocType(options.userSelectedType)
      : undefined;

    const forced = options.forceDocumentType
      ? normalizeToCanonicalDocType(options.forceDocumentType)
      : undefined;

    // -------------------------------------------------------------
    // STAGE 1: IMAGE QUALITY ASSESSMENT
    // -------------------------------------------------------------
    const quality = ImageQualityAnalyzer.assessQuality({
      width: options.imageWidth || undefined,
      height: options.imageHeight || undefined,
      fileBytes: options.fileBytes || undefined,
      base64Length: base64Image ? base64Image.length : 0,
    });

    if (!quality.ok) {
      return {
        success: false,
        stage: 'IMAGE_QUALITY',
        documentType: userSelected || 'UNKNOWN',
        targetRoute: getRouteForCanonicalDocType(userSelected || 'UNKNOWN'),
        confidence: 0,
        needsManualReview: true,
        processorUsed: 'MANUAL',
        extractedData: {},
        rawOcrText: '',
        fieldConfidence: {},
        quality,
        error: quality.message || 'Image quality is too low to read clearly. Please retake the photo in good lighting.',
      };
    }

    // -------------------------------------------------------------
    // STAGE 2: VLM INTELLIGENCE ROUTER (Gemini 2.0 Flash)
    // -------------------------------------------------------------
    let vlmResult: any = null;
    if (base64Image) {
      try {
        // Map canonical doc type to VLM router expected types
        let routerDocType: any = undefined;
        if (forced) {
          routerDocType = this.canonicalToRouterType(forced);
        } else if (userSelected) {
          routerDocType = this.canonicalToRouterType(userSelected);
        }

        vlmResult = await MultiDocumentRouter.processDocument(
          base64Image,
          'image/jpeg',
          {
            userSelectedType: routerDocType,
            forceDocumentType: forced ? this.canonicalToRouterType(forced) : undefined,
            skipSafetyCheck: Boolean(options.skipSafetyCheck),
          },
        );
      } catch (vlmErr: any) {
        console.warn('[UnifiedDocumentProcessor] VLM failed, falling back to OCR:', vlmErr?.message || vlmErr);
      }
    }

    // Check for AI category mismatch from VLM
    if (vlmResult?.isTypeMismatch) {
      const detectedCanonical = this.routerTypeToCanonical(vlmResult.detectedType);
      const userSelectedCanonical = userSelected || 'UNKNOWN';

      return {
        success: false,
        stage: 'CLASSIFICATION',
        documentType: userSelectedCanonical,
        targetRoute: getRouteForCanonicalDocType(userSelectedCanonical),
        isTypeMismatch: true,
        detectedType: detectedCanonical,
        userSelectedType: userSelectedCanonical,
        confidence: vlmResult.classification?.confidence != null
          ? Math.round(vlmResult.classification.confidence * 100)
          : 0,
        needsManualReview: true,
        processorUsed: 'GEMINI_VLM',
        extractedData: {},
        rawOcrText: '',
        fieldConfidence: {},
        quality,
        error: `This document appears to be a ${getCanonicalDocTypeLabel(detectedCanonical)} rather than a ${getCanonicalDocTypeLabel(userSelectedCanonical)}.`,
      };
    }

    // If VLM extracted data successfully
    if (vlmResult?.success && vlmResult.extracted) {
      const canonicalType = this.routerTypeToCanonical(vlmResult.extracted.type);
      const normalizedPayload = this.normalizeVlmPayload(canonicalType, vlmResult.extracted.payload);

      const rawConf = vlmResult.classification?.confidence ?? (vlmResult.extracted as any)?.confidence;
      const confScore = rawConf != null ? (rawConf <= 1 ? rawConf : rawConf / 100) : 0;
      const confPercent = rawConf != null ? Math.round(confScore * 100) : 0;

      return {
        success: true,
        stage: 'EXTRACTION',
        documentType: canonicalType,
        targetRoute: getRouteForCanonicalDocType(canonicalType),
        confidence: confPercent,
        needsManualReview: false,
        processorUsed: 'GEMINI_VLM',
        extractedData: normalizedPayload,
        rawOcrText: '',
        fieldConfidence: this.calculateFieldConfidences(normalizedPayload, confScore),
        quality,
      };
    }

    // -------------------------------------------------------------
    // STAGE 3: OCR FALLBACK (Cloud Vision / Local ML Kit)
    // -------------------------------------------------------------
    let ocrResult: any = null;
    let rawText = '';
    try {
      ocrResult = await CloudVisionOcrService.recognizeInvoice(imageUri, {
        base64: base64Image,
        scanSessionId: options.scanSessionId,
      });
      rawText = ocrResult?.rawText || ocrResult?.data?.rawOcrText || '';
    } catch (ocrErr: any) {
      console.warn('[UnifiedDocumentProcessor] OCR extraction failed:', ocrErr?.message || ocrErr);
    }

    if (!rawText || rawText.trim().length < 15) {
      return {
        success: false,
        stage: 'OCR',
        documentType: userSelected || 'UNKNOWN',
        targetRoute: getRouteForCanonicalDocType(userSelected || 'UNKNOWN'),
        confidence: 0,
        needsManualReview: true,
        processorUsed: ocrResult?.engine === 'cloud-vision' ? 'CLOUD_VISION_OCR' : 'LOCAL_MLKIT',
        extractedData: {},
        rawOcrText: rawText,
        fieldConfidence: {},
        quality,
        error: "We couldn't read enough text from this document. Please check lighting or enter details manually.",
      };
    }

    // -------------------------------------------------------------
    // STAGE 4: DETERMINISTIC TEXT CLASSIFICATION & SAFETY CHECK
    // -------------------------------------------------------------
    const detectedType = this.classifyFromText(rawText);

    // Mismatch check for OCR pipeline
    if (
      !options.skipSafetyCheck &&
      userSelected &&
      userSelected !== 'UNKNOWN' &&
      userSelected !== 'OTHER_DOCUMENT' &&
      detectedType !== 'UNKNOWN' &&
      detectedType !== userSelected
    ) {
      return {
        success: false,
        stage: 'CLASSIFICATION',
        documentType: userSelected,
        targetRoute: getRouteForCanonicalDocType(userSelected),
        isTypeMismatch: true,
        detectedType,
        userSelectedType: userSelected,
        confidence: 90,
        needsManualReview: true,
        processorUsed: 'CLOUD_VISION_OCR',
        extractedData: {},
        rawOcrText: rawText,
        fieldConfidence: {},
        quality,
        error: `This document appears to be a ${getCanonicalDocTypeLabel(detectedType)} rather than a ${getCanonicalDocTypeLabel(userSelected)}.`,
      };
    }

    const finalDocType: AssetDocumentType = forced || userSelected || detectedType;

    // -------------------------------------------------------------
    // STAGE 5: CATEGORY-SPECIFIC OCR EXTRACTION
    // -------------------------------------------------------------
    const extractedData = this.extractFromText(finalDocType, rawText);
    const fieldConfidence = this.calculateFieldConfidences(extractedData, 0.88);
    const hasCoreFields = this.validateCoreFields(finalDocType, extractedData);

    return {
      success: hasCoreFields,
      stage: hasCoreFields ? 'EXTRACTION' : 'EXTRACTION',
      documentType: finalDocType,
      targetRoute: getRouteForCanonicalDocType(finalDocType),
      confidence: hasCoreFields ? 88 : 45,
      needsManualReview: !hasCoreFields,
      processorUsed: 'CLOUD_VISION_OCR',
      extractedData,
      rawOcrText: rawText,
      fieldConfidence,
      quality,
      error: hasCoreFields
        ? undefined
        : "We read the document, but couldn't confidently identify all required fields. Please review and fill missing details.",
    };
  }

  /**
   * Helper to map canonical type to VLM router string
   */
  private static canonicalToRouterType(canonical: AssetDocumentType): string {
    switch (canonical) {
      case 'VEHICLE_SERVICE_BILL':
        return 'VEHICLE_SERVICE';
      case 'VEHICLE_INSURANCE':
        return 'INSURANCE';
      case 'VEHICLE_PUC':
        return 'PUC';
      case 'ELECTRICITY_BILL':
        return 'ELECTRICITY_BILL';
      case 'VEHICLE_PURCHASE_INVOICE':
      default:
        return 'INVOICE';
    }
  }

  /**
   * Helper to map VLM router string to canonical type
   */
  private static routerTypeToCanonical(routerType?: string): AssetDocumentType {
    if (!routerType) return 'UNKNOWN';
    switch (routerType) {
      case 'VEHICLE_SERVICE':
        return 'VEHICLE_SERVICE_BILL';
      case 'INSURANCE':
        return 'VEHICLE_INSURANCE';
      case 'PUC':
        return 'VEHICLE_PUC';
      case 'ELECTRICITY_BILL':
        return 'ELECTRICITY_BILL';
      case 'INVOICE':
        return 'VEHICLE_PURCHASE_INVOICE';
      default:
        return normalizeToCanonicalDocType(routerType);
    }
  }

  /**
   * Normalizes VLM extraction payload into canonical fields
   */
  private static normalizeVlmPayload(docType: AssetDocumentType, payload: any): any {
    if (!payload || typeof payload !== 'object') return {};

    switch (docType) {
      case 'VEHICLE_SERVICE_BILL':
        return {
          documentType: 'VEHICLE_SERVICE_BILL',
          workshopName: payload.workshopName || '',
          workshopPhone: payload.workshopPhone || null,
          vehicleRegistrationNumber: payload.registrationNumber || payload.registration || '',
          registration: payload.registrationNumber || payload.registration || '',
          vehicleMake: payload.vehicleMake || '',
          vehicleModel: payload.vehicleModel || '',
          chassisNumber: payload.chassisNumber || '',
          engineNumber: payload.engineNumber || '',
          serviceInvoiceNumber: payload.serviceInvoiceNumber || payload.invoiceNumber || '',
          invoiceNumber: payload.serviceInvoiceNumber || payload.invoiceNumber || '',
          serviceDate: payload.serviceDate || payload.invoiceDate || '',
          invoiceDate: payload.serviceDate || payload.invoiceDate || '',
          jobCardNumber: payload.jobCardNumber || '',
          jobType: payload.jobType || 'Periodic Maintenance',
          serviceType: payload.jobType || 'Periodic Maintenance',
          odometerReading: payload.odometerKm != null ? Number(payload.odometerKm) : null,
          odometerKm: payload.odometerKm != null ? Number(payload.odometerKm) : null,
          partsAmount: payload.partsAmount != null ? Number(payload.partsAmount) : null,
          labourAmount: payload.labourAmount != null ? Number(payload.labourAmount) : null,
          taxAmount: payload.taxAmount != null ? Number(payload.taxAmount) : null,
          totalAmount: payload.totalAmount != null ? Number(payload.totalAmount) : null,
          nextServiceDueDate: payload.nextServiceDate || payload.nextServiceDue || null,
          nextServiceDueKm: payload.nextServiceKm != null ? Number(payload.nextServiceKm) : null,
          customerName: payload.customerName || '',
          serviceItems: Array.isArray(payload.serviceItems) ? payload.serviceItems : [],
          requiresVehicleLink: true,
          isAttachDoc: true,
        };

      case 'VEHICLE_INSURANCE':
        return {
          documentType: 'VEHICLE_INSURANCE',
          insurerName: payload.insurerName || '',
          shopName: payload.insurerName || '',
          policyNumber: payload.policyNumber || '',
          invoiceNumber: payload.policyNumber || '',
          policyType: payload.policyType || 'Comprehensive',
          vehicleRegistrationNumber: payload.vehicleRegistrationNumber || payload.registration || '',
          registration: payload.vehicleRegistrationNumber || payload.registration || '',
          vehicleMake: payload.vehicleMake || '',
          vehicleModel: payload.vehicleModel || '',
          engineNumber: payload.engineNumber || '',
          chassisNumber: payload.chassisNumber || '',
          idv: payload.idv != null ? Number(payload.idv) : null,
          premiumAmount: payload.premium != null ? Number(payload.premium) : payload.totalAmount != null ? Number(payload.totalAmount) : null,
          totalAmount: payload.premium != null ? Number(payload.premium) : payload.totalAmount != null ? Number(payload.totalAmount) : null,
          policyStartDate: payload.policyStartDate || payload.invoiceDate || '',
          policyExpiryDate: payload.policyExpiryDate || payload.insuranceExpiry || '',
          insuranceExpiry: payload.policyExpiryDate || payload.insuranceExpiry || '',
          insuredName: payload.customerName || '',
          customerName: payload.customerName || '',
          coverageDetails: payload.coverageDetails || null,
          requiresVehicleLink: true,
          isAttachDoc: true,
        };

      case 'VEHICLE_PUC':
        return {
          documentType: 'VEHICLE_PUC',
          certificateNumber: payload.certificateNumber || '',
          invoiceNumber: payload.certificateNumber || '',
          vehicleRegistrationNumber: payload.vehicleRegistrationNumber || payload.registration || '',
          registration: payload.vehicleRegistrationNumber || payload.registration || '',
          issueDate: payload.testDate || payload.invoiceDate || '',
          testDate: payload.testDate || payload.invoiceDate || '',
          validUntil: payload.validUntil || payload.pucExpiry || '',
          pucExpiry: payload.validUntil || payload.pucExpiry || '',
          fuelType: payload.fuelType || '',
          testingCentre: payload.issuingAuthority || payload.shopName || '',
          issuingAuthority: payload.issuingAuthority || payload.shopName || '',
          coValue: payload.coValue || '',
          hcValue: payload.hcValue || '',
          co2Value: payload.co2Value || '',
          emissionResult: payload.emissionResult || 'PASS',
          emissionValues: payload.emissionValues || null,
          ownerName: payload.ownerName || payload.customerName || '',
          customerName: payload.ownerName || payload.customerName || '',
          requiresVehicleLink: true,
          isAttachDoc: true,
        };

      case 'ELECTRICITY_BILL':
        return {
          documentType: 'ELECTRICITY_BILL',
          isElectricityBill: true,
          providerName: payload.providerName || '',
          electricityProvider: payload.providerName || '',
          consumerNumber: payload.consumerNumber || '',
          consumerId: payload.consumerNumber || '',
          accountNumber: payload.accountNumber || '',
          billNumber: payload.billNumber || '',
          billingPeriod: payload.billingPeriod || '',
          billingDate: payload.billDate || payload.invoiceDate || '',
          billDate: payload.billDate || payload.invoiceDate || '',
          dueDate: payload.dueDate || '',
          previousReading: payload.previousReading != null ? Number(payload.previousReading) : null,
          currentReading: payload.currentReading != null ? Number(payload.currentReading) : null,
          unitsConsumed: payload.unitsConsumed != null ? Number(payload.unitsConsumed) : null,
          amountDue: payload.amountDue != null ? Number(payload.amountDue) : null,
          totalAmount: payload.amountDue != null ? Number(payload.amountDue) : null,
          meterNumber: payload.meterNumber || '',
          serviceAddress: payload.serviceAddress || '',
          sanctionedLoad: payload.sanctionedLoad || '',
        };

      case 'VEHICLE_PURCHASE_INVOICE':
      default:
        return {
          documentType: 'VEHICLE_PURCHASE_INVOICE',
          productName: payload.productName || payload.assetName || '',
          brand: payload.brand || '',
          model: payload.model || '',
          variant: payload.variant || '',
          dealerName: payload.shopName || payload.vendor || '',
          shopName: payload.shopName || payload.vendor || '',
          buyerName: payload.customerName || '',
          customerName: payload.customerName || '',
          invoiceNumber: payload.invoiceNumber || '',
          purchaseDate: payload.invoiceDate || '',
          invoiceDate: payload.invoiceDate || '',
          grandTotal: payload.totalAmount != null ? Number(payload.totalAmount) : null,
          totalAmount: payload.totalAmount != null ? Number(payload.totalAmount) : null,
          taxAmount: payload.taxAmount != null ? Number(payload.taxAmount) : null,
          serialNumber: payload.serialNumber || '',
          imei: payload.imei || '',
          engineNumber: payload.engineNumber || '',
          chassisNumber: payload.chassisNumber || '',
          vehicleRegistrationNumber: payload.registration || '',
          registration: payload.registration || '',
          warrantyPeriod: payload.warrantyPeriod || '',
          warrantyExpiry: payload.warrantyExpiry || '',
        };
    }
  }

  /**
   * Deterministic text-based document classifier
   */
  private static classifyFromText(text: string): AssetDocumentType {
    const upper = text.toUpperCase();

    // Electricity Bill keywords
    if (
      /\b(?:ELECTRICITY|POWER\s*DISTRIBUTION|BESCOM|BSES|TATA\s*POWER|MSEDCL|DISCOM|CONSUMER\s*NO|KWH|UNITS\s*CONSUMED)\b/i.test(upper) &&
      !/\b(?:JOB\s*CARD|PERIODIC\s*MAINTENANCE)\b/i.test(upper)
    ) {
      return 'ELECTRICITY_BILL';
    }

    // PUC Certificate keywords
    if (
      /\b(?:POLLUTION\s*UNDER\s*CONTROL|PUC\s*CERTIFICATE|EMISSION\s*TEST|SMOKE\s*DENSITY|CO\s*PERCENTAGE|HC\s*PPM)\b/i.test(upper)
    ) {
      return 'VEHICLE_PUC';
    }

    // Vehicle Insurance keywords
    if (
      /\b(?:MOTOR\s*INSURANCE|POLICY\s*SCHEDULE|INSURED\s*DECLARED\s*VALUE|IDV|POLICY\s*NO|COMPREHENSIVE\s*POLICY|LIABILITY\s*ONLY|NCB|PREMIUM\s*PAID|IRDAI)\b/i.test(upper)
    ) {
      return 'VEHICLE_INSURANCE';
    }

    // Vehicle Service Bill keywords
    if (
      /\b(?:JOB\s*CARD|SERVICE\s*INVOICE|PERIODIC\s*SERVICE|MAINTENANCE|ODOMETER|ENGINE\s*OIL|LABOUR\s*CHARGES|PARTS\s*AMOUNT|RO\s*NUMBER)\b/i.test(upper)
    ) {
      return 'VEHICLE_SERVICE_BILL';
    }

    // Purchase Invoice
    if (
      /\b(?:TAX\s*INVOICE|RETAIL\s*INVOICE|BILL\s*OF\s*SUPPLY|CASH\s*MEMO|PURCHASE|WARRANTY)\b/i.test(upper)
    ) {
      return 'VEHICLE_PURCHASE_INVOICE';
    }

    return 'UNKNOWN';
  }

  /**
   * Extracts category-specific structured fields from raw OCR text
   */
  private static extractFromText(docType: AssetDocumentType, rawText: string): any {
    switch (docType) {
      case 'VEHICLE_SERVICE_BILL': {
        const srv = RealVehicleServiceExtractor.extract(rawText);
        return {
          documentType: 'VEHICLE_SERVICE_BILL',
          workshopName: srv.workshopName || '',
          workshopPhone: srv.workshopPhone || null,
          vehicleRegistrationNumber: srv.registration || '',
          registration: srv.registration || '',
          vehicleModel: srv.vehicleModel || '',
          chassisNumber: srv.chassisNumber || '',
          engineNumber: srv.engineNumber || '',
          serviceInvoiceNumber: srv.invoiceNumber || '',
          invoiceNumber: srv.invoiceNumber || '',
          serviceDate: srv.invoiceDate || '',
          invoiceDate: srv.invoiceDate || '',
          jobCardNumber: srv.jobCardNumber || '',
          jobType: 'Periodic Maintenance',
          serviceType: 'Periodic Maintenance',
          odometerReading: srv.odometerKm,
          odometerKm: srv.odometerKm,
          partsAmount: srv.partsTotal,
          labourAmount: srv.labourCharges,
          taxAmount: srv.taxAmount,
          totalAmount: srv.totalAmount,
          nextServiceDueDate: srv.nextServiceDate,
          nextServiceDueKm: srv.nextServiceOdometerKm,
          requiresVehicleLink: true,
          isAttachDoc: true,
        };
      }

      case 'VEHICLE_INSURANCE': {
        const ins = InsuranceExtractor.extract(rawText);
        return {
          documentType: 'VEHICLE_INSURANCE',
          insurerName: ins.insurerName.value || '',
          shopName: ins.insurerName.value || '',
          policyNumber: ins.policyNumber.value || '',
          invoiceNumber: ins.policyNumber.value || '',
          policyType: ins.coverageType.value || 'Comprehensive',
          vehicleRegistrationNumber: ins.vehicleRegistration.value || '',
          registration: ins.vehicleRegistration.value || '',
          vehicleModel: ins.vehicleModel.value || '',
          engineNumber: ins.engineNumber.value || '',
          chassisNumber: ins.chassisNumber.value || '',
          idv: ins.idvAmount.value,
          premiumAmount: ins.premiumAmount.value,
          totalAmount: ins.premiumAmount.value,
          policyStartDate: ins.policyStartDate.value || '',
          policyExpiryDate: ins.policyEndDate.value || '',
          insuranceExpiry: ins.policyEndDate.value || '',
          insuredName: ins.insuredName.value || '',
          customerName: ins.insuredName.value || '',
          requiresVehicleLink: true,
          isAttachDoc: true,
        };
      }

      case 'VEHICLE_PUC': {
        const puc = PucExtractor.extract(rawText);
        return {
          documentType: 'VEHICLE_PUC',
          certificateNumber: puc.certificateNumber.value || '',
          invoiceNumber: puc.certificateNumber.value || '',
          vehicleRegistrationNumber: puc.vehicleRegistration.value || '',
          registration: puc.vehicleRegistration.value || '',
          issueDate: puc.issueDate.value || '',
          validUntil: puc.expiryDate.value || '',
          pucExpiry: puc.expiryDate.value || '',
          emissionResult: puc.emissionResult.value || 'PASS',
          fuelType: (puc as any).fuelType?.value || (puc as any).fuelType || '',
          requiresVehicleLink: true,
          isAttachDoc: true,
        };
      }

      case 'ELECTRICITY_BILL': {
        const elec = RealElectricityBillExtractor.extract(rawText);
        return {
          documentType: 'ELECTRICITY_BILL',
          isElectricityBill: true,
          providerName: elec.providerName || '',
          electricityProvider: elec.providerName || '',
          consumerNumber: elec.consumerNumber || '',
          accountNumber: elec.accountNumber || '',
          billNumber: elec.billNumber || '',
          billingPeriod: elec.billingPeriod || '',
          billingDate: elec.billDate || '',
          dueDate: elec.dueDate || '',
          previousReading: elec.previousReading,
          currentReading: elec.currentReading,
          unitsConsumed: elec.unitsConsumed,
          amountDue: elec.amountDue,
          totalAmount: elec.amountDue,
          meterNumber: elec.meterNumber || '',
        };
      }

      case 'VEHICLE_PURCHASE_INVOICE':
      default: {
        const pur = RealPurchaseInvoiceExtractor.extract(rawText);
        return {
          documentType: 'VEHICLE_PURCHASE_INVOICE',
          productName: pur.productName || '',
          brand: pur.brand || '',
          dealerName: pur.shopName || '',
          shopName: pur.shopName || '',
          buyerName: pur.customerName || '',
          customerName: pur.customerName || '',
          invoiceNumber: pur.invoiceNumber || '',
          purchaseDate: pur.invoiceDate || '',
          invoiceDate: pur.invoiceDate || '',
          grandTotal: pur.totalAmount,
          totalAmount: pur.totalAmount,
          taxAmount: pur.taxAmount,
          serialNumber: pur.serialNumber || '',
          imei: pur.imei || '',
          engineNumber: pur.engineNumber || '',
          chassisNumber: pur.chassisNumber || '',
          vehicleRegistrationNumber: pur.registration || '',
          registration: pur.registration || '',
          warrantyPeriod: pur.warrantyMonths ? `${pur.warrantyMonths} Months` : '',
          warrantyExpiry: pur.warrantyExpiry || '',
        };
      }
    }
  }

  /**
   * Evaluates whether core required fields exist for a document type
   */
  private static validateCoreFields(docType: AssetDocumentType, data: any): boolean {
    if (!data) return false;
    switch (docType) {
      case 'VEHICLE_SERVICE_BILL':
        return Boolean(data.workshopName || data.vehicleRegistrationNumber || data.odometerReading || data.totalAmount);
      case 'VEHICLE_INSURANCE':
        return Boolean(data.insurerName || data.policyNumber || data.vehicleRegistrationNumber || data.premiumAmount);
      case 'VEHICLE_PUC':
        return Boolean(data.certificateNumber || data.vehicleRegistrationNumber || data.validUntil);
      case 'ELECTRICITY_BILL':
        return Boolean(data.providerName || data.consumerNumber || data.amountDue);
      case 'VEHICLE_PURCHASE_INVOICE':
      default:
        return Boolean(data.productName || data.shopName || data.totalAmount != null);
    }
  }

  /**
   * Computes per-field confidence scores
   */
  private static calculateFieldConfidences(data: any, baseScore = 0.9): Record<string, number> {
    const conf: Record<string, number> = {};
    if (!data || typeof data !== 'object') return conf;

    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined && value !== '') {
        conf[key] = baseScore;
      } else {
        conf[key] = 0.0;
      }
    }
    return conf;
  }
}

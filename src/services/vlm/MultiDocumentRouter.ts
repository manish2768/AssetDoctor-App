/**
 * Multi-Document Router — Document Intelligence Routing & Extraction Orchestrator.
 *
 * Coordinates:
 * 1. MultiDocumentClassifier (First-stage classification)
 * 2. Type-Specific VLM Extraction (Invoice, Vehicle Service, Insurance, PUC, Electricity Bill)
 * 3. Pre-scan User Selection & AI Safety verification
 * 4. Safe fallback & manual document type selection handling
 */

import {
  ClassificationResult,
  DocumentType,
  MultiDocumentClassifier,
} from './MultiDocumentClassifier';
import {
  ConsumerAssetVlmService,
  NormalizedConsumerAsset,
} from './ConsumerAssetVlmService';
import {
  VehicleServiceVlmService,
  NormalizedVehicleServiceData,
} from './VehicleServiceVlmService';
import {
  InsuranceVlmService,
  NormalizedInsuranceData,
} from './InsuranceVlmService';
import {
  PucVlmService,
  NormalizedPucData,
} from './PucVlmService';
import {
  ElectricityBillVlmService,
  NormalizedElectricityBillData,
} from './ElectricityBillVlmService';

export type ExtractedDocumentData =
  | { type: 'INVOICE'; payload: NormalizedConsumerAsset }
  | { type: 'VEHICLE_SERVICE'; payload: NormalizedVehicleServiceData }
  | { type: 'INSURANCE'; payload: NormalizedInsuranceData }
  | { type: 'PUC'; payload: NormalizedPucData }
  | { type: 'ELECTRICITY_BILL'; payload: NormalizedElectricityBillData };

export interface MultiDocumentRouterResult {
  success: boolean;
  documentType: DocumentType;
  isConfident: boolean;
  classification: ClassificationResult;
  extracted?: ExtractedDocumentData;
  isTypeMismatch?: boolean;
  detectedType?: DocumentType;
  userSelectedType?: DocumentType;
  error?: string;
}

export class MultiDocumentRouter {
  public static async processDocument(
    base64Image: string,
    mimeType: string = 'image/jpeg',
    options: {
      userSelectedType?: DocumentType;
      forceDocumentType?: DocumentType;
      confidenceThreshold?: number;
      skipSafetyCheck?: boolean;
    } = {},
  ): Promise<MultiDocumentRouterResult> {
    const threshold = options.confidenceThreshold ?? 0.70;

    let targetType: DocumentType;
    let classification: ClassificationResult;

    // Case 1: Explicit force / continue anyway
    if (options.forceDocumentType && options.forceDocumentType !== 'UNKNOWN') {
      targetType = options.forceDocumentType;
      classification = {
        documentType: options.forceDocumentType,
        confidence: 1.0,
        reasoning: 'User forced document type',
      };
    } else if (options.userSelectedType && options.userSelectedType !== 'UNKNOWN') {
      // Case 2: User selected type -> Direct single-pass extraction.
      // Specialized extractor handles in-pass document validation, eliminating redundant network roundtrips.
      targetType = options.userSelectedType;
      classification = {
        documentType: options.userSelectedType,
        confidence: 0.95,
        reasoning: 'User selected document type',
      };
    } else {
      // Case 3: Generic scan ("Other Document" / UNKNOWN) -> First-stage classification
      classification = await MultiDocumentClassifier.classifyDocument(base64Image, mimeType);
      targetType = classification.documentType;
    }

    if (targetType === 'UNKNOWN' || classification.confidence < threshold) {
      return {
        success: true,
        documentType: 'UNKNOWN',
        isConfident: false,
        classification,
        error: "Document type couldn't be confidently identified.",
      };
    }

    // Step 2: Specialized VLM Extraction
    try {
      switch (targetType) {
        case 'INVOICE': {
          const invRes = await ConsumerAssetVlmService.extractConsumerAsset(base64Image, mimeType);
          if (!invRes.success || !invRes.data) {
            return {
              success: false,
              documentType: 'INVOICE',
              isConfident: true,
              classification,
              error: invRes.error || 'Failed to extract invoice data',
            };
          }
          return {
            success: true,
            documentType: 'INVOICE',
            isConfident: true,
            classification,
            extracted: { type: 'INVOICE', payload: invRes.data },
          };
        }

        case 'VEHICLE_SERVICE': {
          try {
            const servRes = await VehicleServiceVlmService.extractVehicleService(base64Image, mimeType);
            return {
              success: true,
              documentType: 'VEHICLE_SERVICE',
              isConfident: true,
              classification,
              extracted: { type: 'VEHICLE_SERVICE', payload: servRes },
            };
          } catch (err: any) {
            return {
              success: false,
              documentType: 'VEHICLE_SERVICE',
              isConfident: true,
              classification,
              error: err?.message || 'Failed to extract vehicle service data',
            };
          }
        }

        case 'INSURANCE': {
          const insRes = await InsuranceVlmService.extractInsurance(base64Image, mimeType);
          if (insRes.isTypeMismatch) {
            return {
              success: false,
              documentType: 'INSURANCE',
              isConfident: true,
              classification,
              isTypeMismatch: true,
              userSelectedType: options.userSelectedType,
              error: insRes.error || 'This document does not appear to be an insurance policy.',
            };
          }
          if (!insRes.success || !insRes.data) {
            return {
              success: false,
              documentType: 'INSURANCE',
              isConfident: true,
              classification,
              error: insRes.error || 'Failed to extract insurance data',
            };
          }
          return {
            success: true,
            documentType: 'INSURANCE',
            isConfident: true,
            classification,
            extracted: { type: 'INSURANCE', payload: insRes.data },
          };
        }

        case 'PUC': {
          const pucRes = await PucVlmService.extractPuc(base64Image, mimeType);
          if (!pucRes.success || !pucRes.data) {
            return {
              success: false,
              documentType: 'PUC',
              isConfident: true,
              classification,
              error: pucRes.error || 'Failed to extract PUC certificate data',
            };
          }
          return {
            success: true,
            documentType: 'PUC',
            isConfident: true,
            classification,
            extracted: { type: 'PUC', payload: pucRes.data },
          };
        }

        case 'ELECTRICITY_BILL': {
          const elecRes = await ElectricityBillVlmService.extractElectricityBill(base64Image, mimeType);
          if (elecRes.isTypeMismatch) {
            return {
              success: false,
              documentType: 'ELECTRICITY_BILL',
              isConfident: true,
              classification,
              isTypeMismatch: true,
              userSelectedType: options.userSelectedType,
              error: elecRes.error || 'This document does not appear to be an electricity bill.',
            };
          }
          if (!elecRes.success || !elecRes.data) {
            return {
              success: false,
              documentType: 'ELECTRICITY_BILL',
              isConfident: true,
              classification,
              error: elecRes.error || 'Failed to extract electricity bill data',
            };
          }
          return {
            success: true,
            documentType: 'ELECTRICITY_BILL',
            isConfident: true,
            classification,
            extracted: { type: 'ELECTRICITY_BILL', payload: elecRes.data },
          };
        }

        default:
          return {
            success: true,
            documentType: 'UNKNOWN',
            isConfident: false,
            classification,
            error: "Document type couldn't be confidently identified.",
          };
      }
    } catch (error: any) {
      console.error('[MultiDocumentRouter] Extraction failed:', error);
      return {
        success: false,
        documentType: targetType,
        isConfident: true,
        classification,
        error: error?.message || 'Extraction pipeline failure',
      };
    }
  }
}

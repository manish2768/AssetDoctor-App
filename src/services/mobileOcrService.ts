/**
 * Asset Doctor — Mobile OCR Service & Universal Document Intelligence Integration
 * Handles 13 document categories, field confidence inspection, duplicate protection, and auto-linking.
 */

import { UniversalOcrPipeline } from '../../services/ocr/universalPipeline.ts';
import { MobileServiceHistoryService } from './mobileServiceHistoryService.ts';
import { MobileAssetService } from './mobileAssetService.ts';
import type { Asset, ReceiptScanResult, ServiceRecord } from '../types.ts';

export type OcrProcessingState = 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'NEEDS_REVIEW' | 'FAILED';

export interface OcrFieldConfidence {
  field: string;
  label: string;
  value: string | number;
  confidence: number; // 0 to 1
  isVerified: boolean;
  needsVerification: boolean;
}

export interface OcrScanResponse {
  state: OcrProcessingState;
  documentType: string;
  extractedData: ReceiptScanResult;
  fields: OcrFieldConfidence[];
  serviceRecord?: ServiceRecord;
  requiresReview?: boolean;
  reviewReasons?: string[];
  entityLinkNotes?: string;
  matchedAssetId?: string | null;
  error?: string;
}

export class MobileOcrService {
  /**
   * Process any of the 13 supported Indian Document Types
   */
  public static async processDocument(
    rawTextOrBase64: string,
    targetAsset?: Asset,
    onStateChange?: (state: OcrProcessingState, message: string) => void
  ): Promise<OcrScanResponse> {
    try {
      if (onStateChange) onStateChange('UPLOADING', 'Uploading document to vault...');
      await new Promise(r => setTimeout(r, 300));

      if (onStateChange) onStateChange('PROCESSING', 'Analyzing document structure & classifying...');

      let textContent = rawTextOrBase64;

      // If base64, attempt server OCR API or local fallback
      if (rawTextOrBase64.startsWith('data:image') || (rawTextOrBase64.length > 500 && !rawTextOrBase64.includes('\n'))) {
        try {
          const res = await fetch('/api/scan-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Image: rawTextOrBase64 })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.rawText) textContent = data.rawText;
          }
        } catch (e) {
          console.warn('[MobileOcrService] Server API unavailable, analyzing text locally');
        }
      }

      // Execute Universal Document Intelligence Pipeline
      const cachedAssets = MobileAssetService.getCachedAssets();
      const pipelineResult = await UniversalOcrPipeline.process(textContent, {
        existingAssets: targetAsset ? [targetAsset, ...cachedAssets] : cachedAssets,
        previousVerifiedOdometer: targetAsset?.odometerKm
      });

      const { classification, extractedData: ext, validation, entityLink } = pipelineResult;
      const fields: OcrFieldConfidence[] = [];

      // Extract specific fields based on classified document type
      if (ext.serviceData) {
        const s = ext.serviceData;
        if (s.vehicleRegistration?.value) {
          fields.push({
            field: 'registration',
            label: 'Vehicle Registration',
            value: s.vehicleRegistration.value,
            confidence: s.vehicleRegistration.confidence,
            isVerified: s.vehicleRegistration.tier === 'VERIFIED',
            needsVerification: s.vehicleRegistration.tier === 'NEEDS_VERIFICATION'
          });
        }
        if (s.odometerKm?.value !== undefined && s.odometerKm.value !== null) {
          fields.push({
            field: 'odometerKm',
            label: 'Odometer / KM Reading',
            value: `${s.odometerKm.value.toLocaleString('en-IN')} KM`,
            confidence: s.odometerKm.confidence,
            isVerified: s.odometerKm.tier === 'VERIFIED',
            needsVerification: s.odometerKm.tier === 'NEEDS_VERIFICATION'
          });
        }
        if (s.serviceDate?.value) {
          fields.push({
            field: 'serviceDate',
            label: 'Service Date',
            value: s.serviceDate.value,
            confidence: s.serviceDate.confidence,
            isVerified: s.serviceDate.tier === 'VERIFIED',
            needsVerification: s.serviceDate.tier === 'NEEDS_VERIFICATION'
          });
        }
        if (s.invoiceNumber?.value) {
          fields.push({
            field: 'invoiceNumber',
            label: 'Invoice / JC No',
            value: s.invoiceNumber.value,
            confidence: s.invoiceNumber.confidence,
            isVerified: s.invoiceNumber.tier === 'VERIFIED',
            needsVerification: s.invoiceNumber.tier === 'NEEDS_VERIFICATION'
          });
        }
        if (s.workshopName?.value) {
          fields.push({
            field: 'workshopName',
            label: 'Workshop / Center',
            value: s.workshopName.value,
            confidence: s.workshopName.confidence,
            isVerified: s.workshopName.tier === 'VERIFIED',
            needsVerification: s.workshopName.tier === 'NEEDS_VERIFICATION'
          });
        }
        if (s.totalAmount?.value) {
          fields.push({
            field: 'totalAmount',
            label: 'Total Amount',
            value: `₹${s.totalAmount.value.toLocaleString('en-IN')}`,
            confidence: s.totalAmount.confidence,
            isVerified: s.totalAmount.tier === 'VERIFIED',
            needsVerification: s.totalAmount.tier === 'NEEDS_VERIFICATION'
          });
        }
      }

      if (ext.insuranceData) {
        const ins = ext.insuranceData;
        if (ins.insurerName?.value) {
          fields.push({
            field: 'insurerName',
            label: 'Insurer',
            value: ins.insurerName.value,
            confidence: ins.insurerName.confidence,
            isVerified: ins.insurerName.tier === 'VERIFIED',
            needsVerification: ins.insurerName.tier === 'NEEDS_VERIFICATION'
          });
        }
        if (ins.policyNumber?.value) {
          fields.push({
            field: 'policyNumber',
            label: 'Policy Number',
            value: ins.policyNumber.value,
            confidence: ins.policyNumber.confidence,
            isVerified: ins.policyNumber.tier === 'VERIFIED',
            needsVerification: ins.policyNumber.tier === 'NEEDS_VERIFICATION'
          });
        }
        if (ins.policyExpiryDate?.value) {
          fields.push({
            field: 'policyExpiryDate',
            label: 'Policy Expiry Date',
            value: ins.policyExpiryDate.value,
            confidence: ins.policyExpiryDate.confidence,
            isVerified: ins.policyExpiryDate.tier === 'VERIFIED',
            needsVerification: ins.policyExpiryDate.tier === 'NEEDS_VERIFICATION'
          });
        }
      }

      if (ext.pucData) {
        const puc = ext.pucData;
        if (puc.certificateNumber?.value) {
          fields.push({
            field: 'pucCertificate',
            label: 'PUC Number',
            value: puc.certificateNumber.value,
            confidence: puc.certificateNumber.confidence,
            isVerified: puc.certificateNumber.tier === 'VERIFIED',
            needsVerification: puc.certificateNumber.tier === 'NEEDS_VERIFICATION'
          });
        }
        if (puc.expiryDate?.value) {
          fields.push({
            field: 'pucExpiryDate',
            label: 'PUC Expiry Date',
            value: puc.expiryDate.value,
            confidence: puc.expiryDate.confidence,
            isVerified: puc.expiryDate.tier === 'VERIFIED',
            needsVerification: puc.expiryDate.tier === 'NEEDS_VERIFICATION'
          });
        }
      }

      if (ext.rcData) {
        const rc = ext.rcData;
        if (rc.registrationNumber?.value) {
          fields.push({
            field: 'rcReg',
            label: 'RC Reg Number',
            value: rc.registrationNumber.value,
            confidence: rc.registrationNumber.confidence,
            isVerified: rc.registrationNumber.tier === 'VERIFIED',
            needsVerification: rc.registrationNumber.tier === 'NEEDS_VERIFICATION'
          });
        }
        if (rc.ownerName?.value) {
          fields.push({
            field: 'rcOwner',
            label: 'Registered Owner',
            value: rc.ownerName.value,
            confidence: rc.ownerName.confidence,
            isVerified: rc.ownerName.tier === 'VERIFIED',
            needsVerification: rc.ownerName.tier === 'NEEDS_VERIFICATION'
          });
        }
      }

      const hasLowConfidence = fields.some(f => f.needsVerification) || pipelineResult.requiresReview;
      const finalState: OcrProcessingState = hasLowConfidence ? 'NEEDS_REVIEW' : 'COMPLETED';

      let createdServiceRecord: ServiceRecord | undefined;

      // Auto-attach service record if odometer is verified and target asset exists
      const targetAssetId = targetAsset?.id || entityLink.matchedAssetId;
      if (targetAssetId && ext.serviceData?.odometerKm?.value !== undefined && ext.serviceData.odometerKm.value !== null) {
        const odoValue = ext.serviceData.odometerKm.value;
        const odoConf = ext.serviceData.odometerKm.confidence;

        if (odoConf >= 0.70) {
          const recordData: Omit<ServiceRecord, 'id'> = {
            assetId: targetAssetId,
            serviceDate: ext.serviceData.serviceDate?.value || new Date().toISOString().split('T')[0],
            odometerKm: odoValue,
            serviceType: ext.serviceData.serviceType?.value || 'periodic_maintenance',
            invoiceNumber: ext.serviceData.invoiceNumber?.value || undefined,
            serviceCenter: ext.serviceData.workshopName?.value || undefined,
            cost: ext.serviceData.totalAmount?.value ?? undefined,
            ocrConfidence: odoConf,
            verificationStatus: odoConf >= 0.85 ? 'VERIFIED' : 'NEEDS_REVIEW'
          };

          const recordId = await MobileServiceHistoryService.addServiceRecord(targetAssetId, recordData);
          createdServiceRecord = { id: recordId, ...recordData };

          await MobileAssetService.saveAsset({
            id: targetAssetId,
            odometerKm: odoValue,
            serviceDate: ext.serviceData.serviceDate?.value || new Date().toISOString().split('T')[0]
          });
        }
      }

      const extractedResult: ReceiptScanResult = {
        vendor: ext.serviceData?.workshopName?.value || ext.insuranceData?.insurerName?.value || ext.purchaseData?.sellerName?.value || undefined,
        purchaseDate: ext.serviceData?.serviceDate?.value || ext.insuranceData?.policyStartDate?.value || ext.purchaseData?.invoiceDate?.value || new Date().toISOString().split('T')[0],
        totalAmount: ext.serviceData?.totalAmount?.value || ext.insuranceData?.premiumAmount?.value || ext.purchaseData?.finalAmount?.value || 0,
        documentType: classification.documentType,
        odometerKm: ext.serviceData?.odometerKm?.value ?? undefined,
        odometerConfidence: ext.serviceData?.odometerKm?.confidence,
        vehicleRegistration: ext.serviceData?.vehicleRegistration?.value || ext.rcData?.registrationNumber?.value || undefined,
        serviceDate: ext.serviceData?.serviceDate?.value || undefined,
        invoiceNumber: ext.serviceData?.invoiceNumber?.value || ext.purchaseData?.invoiceNumber?.value || undefined,
        workshopName: ext.serviceData?.workshopName?.value || undefined,
        verificationStatus: hasLowConfidence ? 'NEEDS_REVIEW' : 'VERIFIED',
        items: []
      };

      if (onStateChange) {
        onStateChange(finalState, hasLowConfidence ? 'OCR review recommended' : 'OCR verification complete');
      }

      return {
        state: finalState,
        documentType: classification.documentType,
        extractedData: extractedResult,
        fields,
        serviceRecord: createdServiceRecord,
        requiresReview: pipelineResult.requiresReview,
        reviewReasons: pipelineResult.reviewReasons,
        entityLinkNotes: entityLink.notes,
        matchedAssetId: entityLink.matchedAssetId
      };
    } catch (error: any) {
      if (onStateChange) onStateChange('FAILED', error?.message || 'OCR parsing failed');
      return {
        state: 'FAILED',
        documentType: 'GENERIC_DOCUMENT',
        extractedData: { purchaseDate: new Date().toISOString().split('T')[0], totalAmount: 0, items: [] },
        fields: [],
        error: error?.message || 'Extraction failed'
      };
    }
  }
}

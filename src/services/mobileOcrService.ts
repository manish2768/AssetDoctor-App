/**
 * Asset Doctor — Mobile OCR Service & Universal Document Intelligence Integration
 * Handles 13 document categories, field confidence inspection, duplicate protection, and auto-linking.
 */

import { UniversalOcrPipeline } from '../../services/ocr/universalPipeline.ts';
import { MobileServiceHistoryService } from './mobileServiceHistoryService.ts';
import { MobileAssetService } from './mobileAssetService.ts';
import type { Asset, ReceiptScanResult, ServiceRecord } from '../types.ts';

function fieldStatus(field: any): string {
  return String(field?.status || field?.tier || '').toUpperCase();
}

function fieldIsVerified(field: any): boolean {
  const status = fieldStatus(field);
  return status === 'VERIFIED' || status === 'AUTO_ACCEPTED';
}

function fieldNeedsVerification(field: any): boolean {
  const status = fieldStatus(field);
  return status === 'NEEDS_REVIEW' || status === 'NEEDS_VERIFICATION' || status === 'CONFLICT';
}

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
            isVerified: fieldIsVerified(s.vehicleRegistration),
            needsVerification: fieldNeedsVerification(s.vehicleRegistration)
          });
        }
        if (s.odometerKm?.value !== undefined && s.odometerKm.value !== null) {
          fields.push({
            field: 'odometerKm',
            label: 'Odometer / KM Reading',
            value: `${s.odometerKm.value.toLocaleString('en-IN')} KM`,
            confidence: s.odometerKm.confidence,
            isVerified: fieldIsVerified(s.odometerKm),
            needsVerification: fieldNeedsVerification(s.odometerKm)
          });
        }
        if (s.serviceDate?.value) {
          fields.push({
            field: 'serviceDate',
            label: 'Service Date',
            value: s.serviceDate.value,
            confidence: s.serviceDate.confidence,
            isVerified: fieldIsVerified(s.serviceDate),
            needsVerification: fieldNeedsVerification(s.serviceDate)
          });
        }
        if (s.invoiceNumber?.value) {
          fields.push({
            field: 'invoiceNumber',
            label: 'Invoice / JC No',
            value: s.invoiceNumber.value,
            confidence: s.invoiceNumber.confidence,
            isVerified: fieldIsVerified(s.invoiceNumber),
            needsVerification: fieldNeedsVerification(s.invoiceNumber)
          });
        }
        if (s.workshopName?.value) {
          fields.push({
            field: 'workshopName',
            label: 'Workshop / Center',
            value: s.workshopName.value,
            confidence: s.workshopName.confidence,
            isVerified: fieldIsVerified(s.workshopName),
            needsVerification: fieldNeedsVerification(s.workshopName)
          });
        }
        if (s.totalAmount?.value) {
          fields.push({
            field: 'totalAmount',
            label: 'Total Amount',
            value: `₹${s.totalAmount.value.toLocaleString('en-IN')}`,
            confidence: s.totalAmount.confidence,
            isVerified: fieldIsVerified(s.totalAmount),
            needsVerification: fieldNeedsVerification(s.totalAmount)
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
            isVerified: fieldIsVerified(ins.insurerName),
            needsVerification: fieldNeedsVerification(ins.insurerName)
          });
        }
        if (ins.policyNumber?.value) {
          fields.push({
            field: 'policyNumber',
            label: 'Policy Number',
            value: ins.policyNumber.value,
            confidence: ins.policyNumber.confidence,
            isVerified: fieldIsVerified(ins.policyNumber),
            needsVerification: fieldNeedsVerification(ins.policyNumber)
          });
        }
        if (ins.policyExpiryDate?.value) {
          fields.push({
            field: 'policyExpiryDate',
            label: 'Policy Expiry Date',
            value: ins.policyExpiryDate.value,
            confidence: ins.policyExpiryDate.confidence,
            isVerified: fieldIsVerified(ins.policyExpiryDate),
            needsVerification: fieldNeedsVerification(ins.policyExpiryDate)
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
            isVerified: fieldIsVerified(puc.certificateNumber),
            needsVerification: fieldNeedsVerification(puc.certificateNumber)
          });
        }
        if (puc.expiryDate?.value) {
          fields.push({
            field: 'pucExpiryDate',
            label: 'PUC Expiry Date',
            value: puc.expiryDate.value,
            confidence: puc.expiryDate.confidence,
            isVerified: fieldIsVerified(puc.expiryDate),
            needsVerification: fieldNeedsVerification(puc.expiryDate)
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
            isVerified: fieldIsVerified(rc.registrationNumber),
            needsVerification: fieldNeedsVerification(rc.registrationNumber)
          });
        }
        if (rc.ownerName?.value) {
          fields.push({
            field: 'rcOwner',
            label: 'Registered Owner',
            value: rc.ownerName.value,
            confidence: rc.ownerName.confidence,
            isVerified: fieldIsVerified(rc.ownerName),
            needsVerification: fieldNeedsVerification(rc.ownerName)
          });
        }
      }

      const hasLowConfidence = fields.some(f => f.needsVerification) || pipelineResult.requiresReview;
      const finalState: OcrProcessingState = hasLowConfidence ? 'NEEDS_REVIEW' : 'COMPLETED';

      let createdServiceRecord: ServiceRecord | undefined;

      // Matching must not auto-write asset odometer / service history from OCR.
      // Service records are created only after explicit user confirm on Review.

      const extractedResult: ReceiptScanResult = {
        vendor: ext.serviceData?.workshopName?.value || ext.insuranceData?.insurerName?.value || ext.purchaseData?.sellerName?.value || ext.electronicsData?.sellerName?.value || undefined,
        purchaseDate: ext.serviceData?.serviceDate?.value || ext.insuranceData?.policyStartDate?.value || ext.purchaseData?.invoiceDate?.value || ext.electronicsData?.invoiceDate?.value || null,
        totalAmount: ext.serviceData?.totalAmount?.value ?? ext.insuranceData?.premiumAmount?.value ?? ext.purchaseData?.finalAmount?.value ?? ext.electronicsData?.totalAmount?.value ?? null,
        documentType: classification.documentType,
        odometerKm: ext.serviceData?.odometerKm?.value ?? undefined,
        odometerConfidence: ext.serviceData?.odometerKm?.confidence,
        vehicleRegistration: ext.serviceData?.vehicleRegistration?.value || ext.rcData?.registrationNumber?.value || undefined,
        serviceDate: ext.serviceData?.serviceDate?.value || undefined,
        invoiceNumber: ext.serviceData?.invoiceNumber?.value || ext.purchaseData?.invoiceNumber?.value || ext.electronicsData?.invoiceNumber?.value || undefined,
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
        extractedData: { purchaseDate: null, totalAmount: null, items: [] },
        fields: [],
        error: error?.message || 'Extraction failed'
      };
    }
  }
}

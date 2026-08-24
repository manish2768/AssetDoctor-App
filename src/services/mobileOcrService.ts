/**
 * Asset Doctor — Mobile OCR Service & Invoice Integration
 * Handles document upload tracking, OCR confidence inspection, and automatic service record updates.
 */

import { OcrServiceInvoiceParser } from '../../services/servicePrediction/ocrServiceInvoiceParser.ts';
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
  documentType: 'service_invoice' | 'purchase_bill' | 'insurance_policy' | 'generic';
  extractedData: ReceiptScanResult;
  fields: OcrFieldConfidence[];
  serviceRecord?: ServiceRecord;
  error?: string;
}

export class MobileOcrService {
  /**
   * Process an Invoice Document (Image Base64 or Raw Text)
   */
  public static async processDocument(
    rawTextOrBase64: string,
    targetAsset?: Asset,
    onStateChange?: (state: OcrProcessingState, message: string) => void
  ): Promise<OcrScanResponse> {
    try {
      if (onStateChange) onStateChange('UPLOADING', 'Uploading document to vault...');
      await new Promise(r => setTimeout(r, 400));

      if (onStateChange) onStateChange('PROCESSING', 'Analyzing document text & validating fields...');

      let textContent = rawTextOrBase64;

      // If base64, attempt server OCR API or local fallback
      if (rawTextOrBase64.startsWith('data:image') || rawTextOrBase64.length > 500 && !rawTextOrBase64.includes('\n')) {
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

      // Parse with hardened OCR Invoice Parser
      const parsedInvoice = OcrServiceInvoiceParser.parseServiceInvoiceText(textContent);

      const fields: OcrFieldConfidence[] = [];

      if (parsedInvoice.vehicleRegistration) {
        fields.push({
          field: 'registration',
          label: 'Vehicle Registration',
          value: parsedInvoice.vehicleRegistration.value,
          confidence: parsedInvoice.vehicleRegistration.confidence,
          isVerified: parsedInvoice.vehicleRegistration.confidence >= 0.85,
          needsVerification: parsedInvoice.vehicleRegistration.confidence < 0.70
        });
      }

      if (parsedInvoice.odometerKm) {
        fields.push({
          field: 'odometerKm',
          label: 'Odometer / KM Reading',
          value: `${parsedInvoice.odometerKm.value.toLocaleString('en-IN')} KM`,
          confidence: parsedInvoice.odometerKm.confidence,
          isVerified: parsedInvoice.odometerKm.confidence >= 0.85,
          needsVerification: parsedInvoice.odometerKm.confidence < 0.70
        });
      }

      if (parsedInvoice.serviceDate) {
        fields.push({
          field: 'serviceDate',
          label: 'Service Date',
          value: parsedInvoice.serviceDate.value,
          confidence: parsedInvoice.serviceDate.confidence,
          isVerified: parsedInvoice.serviceDate.confidence >= 0.85,
          needsVerification: parsedInvoice.serviceDate.confidence < 0.70
        });
      }

      if (parsedInvoice.invoiceNumber) {
        fields.push({
          field: 'invoiceNumber',
          label: 'Invoice / JC No',
          value: parsedInvoice.invoiceNumber.value,
          confidence: parsedInvoice.invoiceNumber.confidence,
          isVerified: parsedInvoice.invoiceNumber.confidence >= 0.85,
          needsVerification: parsedInvoice.invoiceNumber.confidence < 0.70
        });
      }

      if (parsedInvoice.workshopName) {
        fields.push({
          field: 'workshopName',
          label: 'Workshop / Center',
          value: parsedInvoice.workshopName.value,
          confidence: parsedInvoice.workshopName.confidence,
          isVerified: parsedInvoice.workshopName.confidence >= 0.85,
          needsVerification: parsedInvoice.workshopName.confidence < 0.70
        });
      }

      if (parsedInvoice.totalAmount) {
        fields.push({
          field: 'totalAmount',
          label: 'Total Amount',
          value: `₹${parsedInvoice.totalAmount.value.toLocaleString('en-IN')}`,
          confidence: parsedInvoice.totalAmount.confidence,
          isVerified: parsedInvoice.totalAmount.confidence >= 0.85,
          needsVerification: parsedInvoice.totalAmount.confidence < 0.70
        });
      }

      const hasLowConfidence = fields.some(f => f.needsVerification);
      const finalState: OcrProcessingState = hasLowConfidence ? 'NEEDS_REVIEW' : 'COMPLETED';

      let createdServiceRecord: ServiceRecord | undefined;

      // If target asset is provided and odometer is verified, auto-link service record & update odometer
      if (targetAsset && parsedInvoice.odometerKm && parsedInvoice.odometerKm.confidence >= 0.70) {
        const odoValue = parsedInvoice.odometerKm.value;

        // 1. Create Service Record
        const recordData: Omit<ServiceRecord, 'id'> = {
          assetId: targetAsset.id,
          serviceDate: parsedInvoice.serviceDate?.value || new Date().toISOString().split('T')[0],
          odometerKm: odoValue,
          serviceType: parsedInvoice.serviceType || 'periodic_maintenance',
          invoiceNumber: parsedInvoice.invoiceNumber?.value,
          serviceCenter: parsedInvoice.workshopName?.value,
          cost: parsedInvoice.totalAmount?.value,
          ocrConfidence: parsedInvoice.odometerKm.confidence,
          verificationStatus: parsedInvoice.verificationStatus
        };

        const recordId = await MobileServiceHistoryService.addServiceRecord(targetAsset.id, recordData);
        createdServiceRecord = { id: recordId, ...recordData };

        // 2. Update Asset Current Odometer & Last Service Date
        await MobileAssetService.saveAsset({
          id: targetAsset.id,
          odometerKm: odoValue,
          serviceDate: parsedInvoice.serviceDate?.value || targetAsset.serviceDate
        });
      }

      const extractedData: ReceiptScanResult = {
        vendor: parsedInvoice.workshopName?.value || parsedInvoice.customerName?.value,
        purchaseDate: parsedInvoice.serviceDate?.value || new Date().toISOString().split('T')[0],
        totalAmount: parsedInvoice.totalAmount?.value || 0,
        documentType: 'service_invoice',
        odometerKm: parsedInvoice.odometerKm?.value,
        odometerConfidence: parsedInvoice.odometerKm?.confidence,
        vehicleRegistration: parsedInvoice.vehicleRegistration?.value,
        serviceDate: parsedInvoice.serviceDate?.value,
        invoiceNumber: parsedInvoice.invoiceNumber?.value,
        workshopName: parsedInvoice.workshopName?.value,
        verificationStatus: parsedInvoice.verificationStatus,
        items: []
      };

      if (onStateChange) {
        onStateChange(finalState, hasLowConfidence ? 'OCR review recommended' : 'OCR verification complete');
      }

      return {
        state: finalState,
        documentType: 'service_invoice',
        extractedData,
        fields,
        serviceRecord: createdServiceRecord
      };
    } catch (error: any) {
      if (onStateChange) onStateChange('FAILED', error?.message || 'OCR parsing failed');
      return {
        state: 'FAILED',
        documentType: 'generic',
        extractedData: { purchaseDate: new Date().toISOString().split('T')[0], totalAmount: 0, items: [] },
        fields: [],
        error: error?.message || 'Extraction failed'
      };
    }
  }
}

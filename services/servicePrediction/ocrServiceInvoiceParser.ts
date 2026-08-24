/**
 * Asset Doctor — Intelligent Service Invoice OCR Extraction & Verification Parser
 * Automatically parses vehicle number, service date, odometer reading, and invoice data.
 */

import type { ComponentType, ServiceRecord, ServiceType } from './types.ts';

export interface ServiceInvoiceScanResult {
  vehicleRegistration?: string;
  serviceDate?: string;
  odometerKm?: number;
  odometerConfidence: number;
  serviceType: ServiceType;
  serviceLabel: string;
  invoiceNumber?: string;
  workshopName?: string;
  totalCost?: number;
  replacedComponents: ComponentType[];
  verificationStatus: 'VERIFIED' | 'NEEDS_VERIFICATION' | 'REJECTED';
  rawOcrSnippets: string[];
}

export class OcrServiceInvoiceParser {
  /**
   * Parse raw OCR text from a service invoice / job card
   */
  static parseServiceInvoiceText(ocrText: string, options?: { assetRegistration?: string }): ServiceInvoiceScanResult {
    const text = ocrText || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let vehicleRegistration: string | undefined;
    let serviceDate: string | undefined;
    let odometerKm: number | undefined;
    let odometerConfidence = 0.0;
    let invoiceNumber: string | undefined;
    let workshopName: string | undefined;
    let totalCost: number | undefined;
    let serviceType: ServiceType = 'periodic_maintenance';
    let serviceLabel = 'Periodic Maintenance Service';
    const replacedComponents: ComponentType[] = [];
    const rawOcrSnippets: string[] = [];

    // 1. Extract Vehicle Registration (Indian vehicle registration pattern e.g. UP32QU2187, MH02EV9999)
    const regRegex = /\b([A-Z]{2}\s*[-]?\s*[0-9]{1,2}\s*[-]?\s*[A-Z]{1,3}\s*[-]?\s*[0-9]{4})\b/i;
    const regMatch = text.match(regRegex);
    if (regMatch) {
      vehicleRegistration = regMatch[1].replace(/[\s-]/g, '').toUpperCase();
    } else if (options?.assetRegistration) {
      vehicleRegistration = options.assetRegistration;
    }

    // 2. Extract Odometer Reading (KM)
    // Matches: "Odometer: 20000 KM", "Kms: 27,800", "Current Odo: 15500", "Mileage 5400"
    const odoPatterns = [
      /(?:odometer|odo|kms?|mileage|current\s*km|running\s*km)[^\d\n]*?(\d{1,3}(?:,\d{3})+|\d{2,6})\s*(?:km|kms)?/i,
      /\b(\d{2,6})\s*(?:km|kms)\b/i
    ];

    for (const pat of odoPatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const rawKmStr = match[1].replace(/,/g, '');
        const parsedKm = parseInt(rawKmStr, 10);
        if (parsedKm >= 50 && parsedKm <= 999999) {
          odometerKm = parsedKm;
          odometerConfidence = 0.95;
          rawOcrSnippets.push(`Odometer extracted: ${odometerKm} KM`);
          break;
        }
      }
    }

    // If ambiguous or blurry odometer detected
    if (!odometerKm) {
      const blurryMatch = text.match(/odo[^\d\n]*?(\d{1,2})[oOlI](\d{2})/i);
      if (blurryMatch) {
        odometerConfidence = 0.45; // Low confidence
        rawOcrSnippets.push('Ambiguous/blurry odometer reading detected');
      }
    }

    // 3. Extract Service Date
    const datePatterns = [
      /\b(\d{4}[-/]\d{2}[-/]\d{2})\b/, // YYYY-MM-DD
      /\b(\d{2}[-/]\d{2}[-/]\d{4})\b/, // DD-MM-YYYY
      /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i
    ];

    for (const pat of datePatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        try {
          const d = new Date(match[1]);
          if (!isNaN(d.getTime())) {
            serviceDate = d.toISOString().split('T')[0];
            rawOcrSnippets.push(`Service Date: ${serviceDate}`);
            break;
          }
        } catch (_) {}
      }
    }

    // 4. Extract Service Type
    const lower = text.toLowerCase();
    if (lower.includes('1st free') || lower.includes('first service') || lower.includes('1st service') || lower.includes('500 km service')) {
      serviceType = 'first_service';
      serviceLabel = '1st Free Break-in Service';
    } else if (lower.includes('2nd service') || lower.includes('second service')) {
      serviceType = 'second_service';
      serviceLabel = '2nd Free Service';
    } else if (lower.includes('oil change') || lower.includes('lube service')) {
      serviceType = 'oil_service';
      serviceLabel = 'Engine Oil & Filter Service';
    } else if (lower.includes('major overhaul') || lower.includes('engine repair')) {
      serviceType = 'major_overhaul';
      serviceLabel = 'Major Overhaul Service';
    }

    // 5. Extract Replaced Components / Line Items
    if (lower.includes('engine oil') || lower.includes('synthetic oil') || lower.includes('4t oil')) {
      replacedComponents.push('engine_oil');
    }
    if (lower.includes('oil filter') || lower.includes('filter element')) {
      replacedComponents.push('oil_filter');
    }
    if (lower.includes('air filter') || lower.includes('air cleaner')) {
      replacedComponents.push('air_filter');
    }
    if (lower.includes('brake pad') || lower.includes('brake shoe')) {
      replacedComponents.push('brake_pads');
    }
    if (lower.includes('spark plug')) {
      replacedComponents.push('spark_plug');
    }
    if (lower.includes('coolant')) {
      replacedComponents.push('coolant');
    }
    if (lower.includes('brake fluid')) {
      replacedComponents.push('brake_fluid');
    }

    // 6. Extract Invoice / Job Card Number
    const invMatch = text.match(/(?:inv(?:oice)?|bill|job\s*card|jc)\s*(?:no\.?|#)?\s*[:\-]?\s*([a-z0-9\-_/]+)/i);
    if (invMatch && invMatch[1]) {
      invoiceNumber = invMatch[1].trim();
    }

    // 7. Extract Total Amount
    const totalMatch = text.match(/(?:total|grand\s*total|net\s*amount|amount\s*paid)\s*[:\-₹\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (totalMatch && totalMatch[1]) {
      totalCost = parseFloat(totalMatch[1].replace(/,/g, ''));
    }

    // 8. Determine Verification Status
    let verificationStatus: 'VERIFIED' | 'NEEDS_VERIFICATION' | 'REJECTED' = 'NEEDS_VERIFICATION';
    if (odometerKm && odometerConfidence >= 0.85 && serviceDate) {
      verificationStatus = 'VERIFIED';
    } else if (!odometerKm || odometerConfidence < 0.70) {
      verificationStatus = 'NEEDS_VERIFICATION';
    }

    return {
      vehicleRegistration,
      serviceDate: serviceDate || new Date().toISOString().split('T')[0],
      odometerKm,
      odometerConfidence,
      serviceType,
      serviceLabel,
      invoiceNumber,
      workshopName,
      totalCost,
      replacedComponents,
      verificationStatus,
      rawOcrSnippets
    };
  }

  /**
   * Convert scan result to a validated ServiceRecord
   */
  static createServiceRecordFromScan(assetId: string, scan: ServiceInvoiceScanResult, documentId?: string): ServiceRecord {
    return {
      assetId,
      serviceDate: scan.serviceDate || new Date().toISOString().split('T')[0],
      odometerKm: scan.odometerKm || 0,
      serviceType: scan.serviceType,
      documentId,
      invoiceNumber: scan.invoiceNumber,
      serviceCenter: scan.workshopName,
      cost: scan.totalCost,
      replacedComponents: scan.replacedComponents,
      ocrConfidence: scan.odometerConfidence,
      verificationStatus: scan.verificationStatus,
      createdAt: new Date().toISOString()
    };
  }
}

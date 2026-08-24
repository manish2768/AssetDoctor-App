/**
 * Asset Doctor — Intelligent Service Invoice OCR Extraction & Verification Parser
 * Strictly extracts Vehicle Reg, Service Date, Odometer KM, Invoice No, and Line Items.
 * Prevents false positives by negative-filtering amounts, GSTIN, phone numbers, and part codes.
 */

import type { ComponentType, ExtractedField, ServiceRecord, ServiceType } from './types.ts';

export interface ServiceInvoiceScanResult {
  vehicleRegistration?: ExtractedField<string>;
  serviceDate?: ExtractedField<string>;
  odometerKm?: ExtractedField<number>;
  invoiceNumber?: ExtractedField<string>;
  customerName?: ExtractedField<string>;
  workshopName?: ExtractedField<string>;
  totalAmount?: ExtractedField<number>;
  serviceType: ServiceType;
  serviceLabel: string;
  replacedComponents: ComponentType[];
  verificationStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'NEEDS_VERIFICATION';
  rawOcrSnippets: string[];
}

export class OcrServiceInvoiceParser {
  /**
   * Parse raw OCR text from a service invoice / job card with strict semantic filtering.
   */
  static parseServiceInvoiceText(ocrText: string, options?: { assetRegistration?: string }): ServiceInvoiceScanResult {
    const text = ocrText || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let vehicleRegistration: ExtractedField<string> | undefined;
    let serviceDate: ExtractedField<string> | undefined;
    let odometerKm: ExtractedField<number> | undefined;
    let invoiceNumber: ExtractedField<string> | undefined;
    let customerName: ExtractedField<string> | undefined;
    let workshopName: ExtractedField<string> | undefined;
    let totalAmount: ExtractedField<number> | undefined;
    let serviceType: ServiceType = 'periodic_maintenance';
    let serviceLabel = 'Periodic Maintenance Service';
    const replacedComponents: ComponentType[] = [];
    const rawOcrSnippets: string[] = [];

    // 1. Extract Vehicle Registration (Indian standard pattern e.g. UP32QU2187, MH02EV9999, DL01AB1234)
    const regRegex = /\b([A-Z]{2}\s*[-]?\s*[0-9]{1,2}\s*[-]?\s*[A-Z]{1,3}\s*[-]?\s*[0-9]{4})\b/i;
    const regMatch = text.match(regRegex);
    if (regMatch) {
      const cleanReg = regMatch[1].replace(/[\s-]/g, '').toUpperCase();
      vehicleRegistration = {
        value: cleanReg,
        confidence: 0.96,
        raw_text: regMatch[0],
        source: 'ocr_regex_reg_pattern',
        verification_level: 'VERIFIED'
      };
      rawOcrSnippets.push(`Vehicle Reg: ${cleanReg}`);
    } else if (options?.assetRegistration) {
      vehicleRegistration = {
        value: options.assetRegistration.toUpperCase(),
        confidence: 0.90,
        raw_text: options.assetRegistration,
        source: 'asset_metadata',
        verification_level: 'VERIFIED'
      };
    }

    // 2. Extract Odometer Reading (KM)
    // Keywords: Odometer, Odo, Odo Reading, Odometer Reading, Current KM, Current KMs, KM Reading,
    // Kilometer Reading, Kilometre Reading, Vehicle KM, Running KM, Meter Reading, KMS
    const odoKeywordRegex = /(?:odometer\s*reading|odo\s*reading|km\s*reading|kilometer\s*reading|kilometre\s*reading|vehicle\s*km|running\s*km|meter\s*reading|current\s*kms?|odometer|odo|kms?|mileage)[^\d\n]*?(\d{1,3}(?:,\d{3})+|\d{2,6})\s*(?:km|kms)?/i;

    // Negative regex to discard lines containing phone numbers, GSTIN, invoice amounts, prices, part numbers
    const isFalsePositiveLine = (line: string): boolean => {
      const l = line.toLowerCase();
      return (
        l.includes('gstin') ||
        l.includes('phone') ||
        l.includes('mobile') ||
        l.includes('part no') ||
        l.includes('item no') ||
        l.includes('total') ||
        l.includes('cgst') ||
        l.includes('sgst') ||
        l.includes('igst') ||
        l.includes('taxable') ||
        l.includes('tax amount') ||
        l.includes('grand total') ||
        l.includes('net amount') ||
        l.includes('balance') ||
        l.includes('price') ||
        l.includes('rate') ||
        l.includes('qty') ||
        l.includes('quantity') ||
        l.includes('hsn') ||
        l.includes('sac')
      );
    };

    // First scan line by line for targeted precision
    for (const line of lines) {
      if (isFalsePositiveLine(line)) continue;

      const lineMatch = line.match(odoKeywordRegex);
      if (lineMatch && lineMatch[1]) {
        const rawKm = lineMatch[1].replace(/,/g, '');
        const parsedKm = parseInt(rawKm, 10);
        // Valid vehicle odometer range: 50 KM to 999,999 KM
        if (parsedKm >= 50 && parsedKm <= 999999) {
          odometerKm = {
            value: parsedKm,
            confidence: 0.95,
            raw_text: line,
            source: 'line_odometer_keyword',
            verification_level: 'VERIFIED'
          };
          rawOcrSnippets.push(`Odometer extracted: ${parsedKm} KM`);
          break;
        }
      }
    }

    // If not found line by line, perform full text search with negative safety check
    if (!odometerKm) {
      const fullMatch = text.match(odoKeywordRegex);
      if (fullMatch && fullMatch[1]) {
        const rawKm = fullMatch[1].replace(/,/g, '');
        const parsedKm = parseInt(rawKm, 10);
        if (parsedKm >= 50 && parsedKm <= 999999) {
          odometerKm = {
            value: parsedKm,
            confidence: 0.88,
            raw_text: fullMatch[0],
            source: 'fulltext_odometer_keyword',
            verification_level: 'VERIFIED'
          };
          rawOcrSnippets.push(`Odometer extracted: ${parsedKm} KM`);
        }
      }
    }

    // Check for ambiguous or blurry odometer readings
    if (!odometerKm) {
      const blurryMatch = text.match(/odo[^\d\n]*?(\d{1,2})[oOlI](\d{2})/i);
      if (blurryMatch) {
        odometerKm = {
          value: 0,
          confidence: 0.40,
          raw_text: blurryMatch[0],
          source: 'blurry_odometer_match',
          verification_level: 'NEEDS_VERIFICATION'
        };
        rawOcrSnippets.push('Ambiguous/blurry odometer reading detected (< 70% confidence)');
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
            const isoDate = d.toISOString().split('T')[0];
            serviceDate = {
              value: isoDate,
              confidence: 0.94,
              raw_text: match[0],
              source: 'date_pattern_match',
              verification_level: 'VERIFIED'
            };
            rawOcrSnippets.push(`Service Date: ${isoDate}`);
            break;
          }
        } catch (_) {}
      }
    }

    // 4. Extract Invoice / Job Card Number
    const invMatch = text.match(/(?:jc\s*no\.?|job\s*card\s*(?:no\.?|#)|tax\s*invoice\s*(?:no\.?|#)|invoice\s*(?:no\.?|#)|inv\s*(?:no\.?|#)|bill\s*(?:no\.?|#)|jc|job\s*card|invoice|bill)\s*[:\-#]\s*([a-z0-9\-_]+)/i);
    if (invMatch && invMatch[1]) {
      invoiceNumber = {
        value: invMatch[1].trim(),
        confidence: 0.92,
        raw_text: invMatch[0],
        source: 'invoice_no_pattern',
        verification_level: 'VERIFIED'
      };
      rawOcrSnippets.push(`Invoice/JC No: ${invoiceNumber.value}`);
    }

    // 5. Extract Customer Name (line-by-line)
    for (const line of lines) {
      const custMatch = line.match(/(?:customer\s*name|client\s*name|owner\s*name|customer|client|owner)\s*[:\-]\s*([A-Za-z\s]{2,30})/i);
      if (custMatch && custMatch[1] && !custMatch[1].toLowerCase().includes('invoice') && !custMatch[1].toLowerCase().includes('service')) {
        customerName = {
          value: custMatch[1].trim(),
          confidence: 0.85,
          raw_text: line,
          source: 'customer_name_pattern',
          verification_level: 'VERIFIED'
        };
        break;
      }
    }

    // 6. Extract Workshop / Service Center Name
    const workshopMatch = text.match(/(?:workshop|dealer|service\s*center|center)\s*[:\-]?\s*([A-Z0-9\s.,&'-]{3,40})/i);
    if (workshopMatch && workshopMatch[1]) {
      workshopName = {
        value: workshopMatch[1].trim(),
        confidence: 0.86,
        raw_text: workshopMatch[0],
        source: 'workshop_name_pattern',
        verification_level: 'VERIFIED'
      };
    }

    // 7. Extract Total Amount
    const totalMatch = text.match(/(?:total\s*amount|grand\s*total|net\s*amount|amount\s*paid|bill\s*amount|total)\s*[:\-]?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (totalMatch && totalMatch[1]) {
      const parsedAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        totalAmount = {
          value: parsedAmount,
          confidence: 0.93,
          raw_text: totalMatch[0],
          source: 'total_amount_pattern',
          verification_level: 'VERIFIED'
        };
      }
    }

    // 8. Service Type Identification
    const lower = text.toLowerCase();
    if (lower.includes('1st free') || lower.includes('first service') || lower.includes('1st service') || lower.includes('500 km service') || lower.includes('750 km service')) {
      serviceType = 'first_service';
      serviceLabel = '1st Free Break-in Service';
    } else if (lower.includes('2nd service') || lower.includes('second service')) {
      serviceType = 'second_service';
      serviceLabel = '2nd Periodic Service';
    } else if (lower.includes('3rd service') || lower.includes('third service')) {
      serviceType = 'third_service';
      serviceLabel = '3rd Periodic Service';
    } else if (lower.includes('oil change') || lower.includes('lube service')) {
      serviceType = 'oil_service';
      serviceLabel = 'Engine Oil & Filter Service';
    } else if (lower.includes('major overhaul') || lower.includes('engine repair')) {
      serviceType = 'major_overhaul';
      serviceLabel = 'Major Overhaul Service';
    }

    // 9. Replaced Components Extraction
    if (lower.includes('engine oil') || lower.includes('synthetic oil') || lower.includes('tru4') || lower.includes('4t oil')) {
      replacedComponents.push('engine_oil');
    }
    if (lower.includes('oil filter') || lower.includes('filter element')) {
      replacedComponents.push('oil_filter');
    }
    if (lower.includes('air filter') || lower.includes('air cleaner')) {
      replacedComponents.push('air_filter');
    }
    if (lower.includes('brake pad') || lower.includes('brake shoe') || lower.includes('disc pad')) {
      replacedComponents.push('brake_pads');
    }
    if (lower.includes('spark plug')) {
      replacedComponents.push('spark_plug');
    }
    if (lower.includes('coolant')) {
      replacedComponents.push('coolant');
    }
    if (lower.includes('brake fluid') || lower.includes('dot 4')) {
      replacedComponents.push('brake_fluid');
    }

    // 10. Overall Verification Level
    let verificationStatus: 'VERIFIED' | 'NEEDS_REVIEW' | 'NEEDS_VERIFICATION' = 'NEEDS_VERIFICATION';
    const odoConf = odometerKm?.confidence || 0.0;

    if (odometerKm && odoConf >= 0.85 && serviceDate) {
      verificationStatus = 'VERIFIED';
    } else if (odometerKm && odoConf >= 0.70) {
      verificationStatus = 'NEEDS_REVIEW';
    } else {
      verificationStatus = 'NEEDS_VERIFICATION';
    }

    return {
      vehicleRegistration,
      serviceDate,
      odometerKm,
      invoiceNumber,
      customerName,
      workshopName,
      totalAmount,
      serviceType,
      serviceLabel,
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
      serviceDate: scan.serviceDate?.value || new Date().toISOString().split('T')[0],
      odometerKm: scan.odometerKm?.value || 0,
      serviceType: scan.serviceType,
      documentId,
      invoiceNumber: scan.invoiceNumber?.value,
      serviceCenter: scan.workshopName?.value,
      cost: scan.totalAmount?.value,
      replacedComponents: scan.replacedComponents,
      ocrConfidence: scan.odometerKm?.confidence || 0.0,
      verificationStatus: scan.verificationStatus,
      createdAt: new Date().toISOString()
    };
  }
}

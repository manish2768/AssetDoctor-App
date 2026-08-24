/**
 * Service Invoice & Repair Bill Extractor
 * Extracts workshop, customer, vehicle, odometer, and financial breakdown with confidence scoring.
 */

import type { ServiceInvoiceData, ExtractedField, VerificationConfidenceTier } from '../types.ts';

function createField<T>(
  value: T | null,
  confidence: number,
  rawText: string,
  sourceLabel?: string,
  flag?: string
): ExtractedField<T> {
  const rounded = Math.round(confidence * 100) / 100;
  let tier: VerificationConfidenceTier = 'NEEDS_VERIFICATION';
  if (rounded >= 0.85) tier = 'VERIFIED';
  else if (rounded >= 0.70) tier = 'NEEDS_REVIEW';

  return {
    value,
    confidence: rounded,
    rawText,
    sourceLabel,
    tier,
    flag
  };
}

export class ServiceExtractor {
  /**
   * Normalizes Indian date string to YYYY-MM-DD
   */
  public static normalizeDate(dateStr: string): string | null {
    if (!dateStr) return null;
    const clean = dateStr.trim();

    // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmy = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dmy) {
      let day = dmy[1].padStart(2, '0');
      let month = dmy[2].padStart(2, '0');
      let year = dmy[3];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }

    // Match YYYY-MM-DD
    const ymd = clean.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymd) {
      return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }

    // Match textual date: 20 Aug 2024 / 20 August 2024
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const textMatch = clean.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/i);
    if (textMatch) {
      const day = textMatch[1].padStart(2, '0');
      const mStr = textMatch[2].substring(0, 3).toLowerCase();
      const month = months[mStr];
      const year = textMatch[3];
      if (month) return `${year}-${month}-${day}`;
    }

    return null;
  }

  /**
   * Normalizes Indian Vehicle Registration Number (e.g. UP 32 QU 2187 -> UP32QU2187)
   */
  public static normalizeRegistration(reg: string): string | null {
    if (!reg) return null;
    const clean = reg.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const regPattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;
    if (regPattern.test(clean) && clean.length >= 8 && clean.length <= 11) {
      return clean;
    }
    return clean.length >= 6 ? clean : null;
  }

  /**
   * Main parsing method for Service Invoices and Repair Bills
   */
  public static extract(rawText: string): ServiceInvoiceData {
    const data: ServiceInvoiceData = {};
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. WORKSHOP NAME & GSTIN
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const line = lines[i];
      if (/(pv|pvt|ltd|motors|automobiles|services|garage|auto|service\s*station|center)/i.test(line) &&
          !/invoice|bill|receipt|tax|date/i.test(line)) {
        data.workshopName = createField(line, 0.94, line, 'Header Inspection');
        break;
      }
    }

    const gstinMatch = rawText.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
    if (gstinMatch) {
      data.gstin = createField(gstinMatch[1].toUpperCase(), 0.98, gstinMatch[0], 'GSTIN');
    }

    // 2. VEHICLE REGISTRATION
    const regMatch = rawText.match(/(?:Reg(?:istration)?\.?\s*(?:No|Num)?[:\s\-\.]*|Vehicle\s*No[:\s\-\.]*)\s*([A-Z]{2}[0-9\s\-]{1,3}[A-Z\s\-]{0,3}[0-9]{3,4})/i) ||
                     rawText.match(/\b([A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4})\b/i);
    if (regMatch) {
      const norm = this.normalizeRegistration(regMatch[1]);
      if (norm) {
        data.vehicleRegistration = createField(norm, 0.96, regMatch[0], 'Registration Regex');
      }
    }

    // 3. INVOICE NUMBER & DATES
    const invMatch = rawText.match(/(?:Invoice\s*No|Bill\s*No|Cash\s*Memo\s*No|Invoice\s*#)[:\s\.\-]*([A-Za-z0-9\/\-_]+)/i);
    if (invMatch) {
      data.invoiceNumber = createField(invMatch[1].trim(), 0.93, invMatch[0], 'Invoice Number');
    }

    const dateMatch = rawText.match(/(?:Invoice\s*Date|Bill\s*Date|Service\s*Date|Date)[:\s\.\-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i);
    if (dateMatch) {
      const normDate = this.normalizeDate(dateMatch[1]);
      if (normDate) {
        data.invoiceDate = createField(normDate, 0.94, dateMatch[0], 'Invoice Date');
        data.serviceDate = createField(normDate, 0.92, dateMatch[0], 'Service Date');
      }
    }

    // 4. ODOMETER EXTRACTION (With strict negative rejection)
    const odoPatterns = [
      /(?:KMs|KM\s*Reading|Odometer|Odo|Current\s*KM|Current\s*KMs|Vehicle\s*KM|Running\s*KM|Meter\s*Reading)[:\s\-\.]*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{3,7})\b/i,
      /\b([0-9]{3,6})\s*(?:KMS|KM|KILOMETERS|KILOMETRES)\b/i,
      /(?:ODO|KM)[:\s]*([0-9]{3,6})/i
    ];

    let foundOdo: number | null = null;
    let odoConfidence = 0.0;
    let odoRaw = '';
    let odoLabel = '';

    for (const pat of odoPatterns) {
      const m = rawText.match(pat);
      if (m) {
        const valStr = m[1].replace(/,/g, '');
        const val = parseInt(valStr, 10);

        // Negative Validation: Reject GSTIN, Phone, Year, Unrealistically High/Low
        const isYear = val >= 1990 && val <= 2035;
        const isLikelyPhone = valStr.length === 10 && (valStr.startsWith('9') || valStr.startsWith('8') || valStr.startsWith('7') || valStr.startsWith('6'));
        const isReasonableKm = val >= 10 && val <= 999999;

        if (isReasonableKm && !isLikelyPhone) {
          foundOdo = val;
          odoRaw = m[0];
          odoLabel = pat.source;
          odoConfidence = isYear ? 0.75 : 0.95;
          break;
        }
      }
    }

    if (foundOdo !== null) {
      data.odometerKm = createField(foundOdo, odoConfidence, odoRaw, 'Odometer Parser');
    }

    // 5. CUSTOMER NAME & PHONE
    const custMatch = rawText.match(/(?:Customer|Customer\s*Name|Cust\s*Name|Owner|Client|Bill\s*To)[:\s\.\-]*([A-Z\s\.\-]{3,35})/i);
    if (custMatch) {
      const name = custMatch[1].replace(/[\n\r]+/g, ' ').trim();
      if (name.length > 2 && !/invoice|cash|memo|tax|date|reg/i.test(name)) {
        data.customerName = createField(name, 0.91, custMatch[0], 'Customer Name');
      }
    }

    const phoneMatch = rawText.match(/(?:Mobile|Phone|Contact|Cell|Tel)[:\s\.\-]*([6-9][0-9]{9})/i) ||
                       rawText.match(/\b([6-9][0-9]{4}\s*[0-9]{5})\b/);
    if (phoneMatch) {
      data.customerPhone = createField(phoneMatch[1].replace(/\s+/g, ''), 0.95, phoneMatch[0], 'Customer Phone');
    }

    // 6. CHASSIS / VIN & ENGINE NUMBER
    const vinMatch = rawText.match(/(?:Chassis(?:\s*No)?|VIN)[:\s\.\-]*([A-HJ-NPR-Z0-9]{17}|[A-Z0-9]{12,20})/i);
    if (vinMatch) {
      data.vinOrChassis = createField(vinMatch[1].toUpperCase(), 0.96, vinMatch[0], 'Chassis Number');
    }

    const engineMatch = rawText.match(/(?:Engine(?:\s*No)?|Motor\s*No)[:\s\.\-]*([A-Z0-9]{6,16})/i);
    if (engineMatch) {
      data.engineNumber = createField(engineMatch[1].toUpperCase(), 0.93, engineMatch[0], 'Engine Number');
    }

    // 7. FINANCIAL BREAKDOWN (Parts, Labour, Tax, Total)
    const totalMatch = rawText.match(/(?:Net\s*Total\s*(?:Amount)?|Grand\s*Total|Invoice\s*Total|Total\s*Amount|Net\s*Amount|Bill\s*Amount|Total\s*Payable|(?<!Labour\s|Parts\s|Tax\s)\bTotal\b)[^\d\n]*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
    if (totalMatch) {
      const amt = parseFloat(totalMatch[1].replace(/,/g, ''));
      if (!isNaN(amt) && amt > 0) {
        data.totalAmount = createField(amt, 0.96, totalMatch[0], 'Total Amount');
      }
    }

    const labourMatch = rawText.match(/(?:Labour\s*Total|Labor\s*Charges|Labour\s*Amount)[:\s\.\-₹Rs]*([0-9]+(?:\.[0-9]{2})?)/i);
    if (labourMatch) {
      const amt = parseFloat(labourMatch[1]);
      if (!isNaN(amt)) data.labourCharges = createField(amt, 0.90, labourMatch[0], 'Labour Charges');
    }

    const partsMatch = rawText.match(/(?:Parts\s*Total|Material\s*Total|Spares\s*Amount)[:\s\.\-₹Rs]*([0-9]+(?:\.[0-9]{2})?)/i);
    if (partsMatch) {
      const amt = parseFloat(partsMatch[1]);
      if (!isNaN(amt)) data.partsTotal = createField(amt, 0.90, partsMatch[0], 'Parts Total');
    }

    const taxMatch = rawText.match(/(?:Total\s*Tax|GST\s*Amount|Tax\s*Amount|IGST|CGST\+SGST)[:\s\.\-₹Rs]*([0-9]+(?:\.[0-9]{2})?)/i);
    if (taxMatch) {
      const amt = parseFloat(taxMatch[1]);
      if (!isNaN(amt)) data.taxAmount = createField(amt, 0.88, taxMatch[0], 'Tax Amount');
    }

    return data;
  }
}

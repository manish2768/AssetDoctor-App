import { type ExtractedField, createNotFoundField, createVerifiedField } from '../core/OcrEvidence.ts';
import { OcrFieldNormalizer } from '../core/OcrFieldNormalizer.ts';

export interface ServiceInvoiceFields {
  workshopName: ExtractedField<string | null>;
  vehicleRegistration: ExtractedField<string | null>;
  vehicleModel: ExtractedField<string | null>;
  chassisNumber: ExtractedField<string | null>;
  engineNumber: ExtractedField<string | null>;
  currentOdometerKm: ExtractedField<number | null>;
  nextServiceOdometerKm: ExtractedField<number | null>;
  nextServiceDate: ExtractedField<string | null>;
  invoiceNumber: ExtractedField<string | null>;
  invoiceDate: ExtractedField<string | null>;
  labourCharges: ExtractedField<number | null>;
  partsTotal: ExtractedField<number | null>;
  totalAmount: ExtractedField<number | null>;
}

export class ServiceInvoiceExtractor {
  public static extract(rawText: string): ServiceInvoiceFields {
    const text = rawText || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let workshopName: ExtractedField<string | null> = createNotFoundField();
    const workshopMatch = text.match(/(?:TAAR\s*MOTO\s*LEGENDS|POPULAR\s*VEHICLES|HARSHA\s*TOYOTA|SHIVAM\s*AUTOTRADE|FORTUNE\s*HYUNDAI|EXCEL\s*TVS|AUTOPRIME|SERVICE\s*CENTRE|WORKSHOP\s*NAME|DEALER\s*NAME)[:\s\-]*([A-Za-z0-9\s\.\,]+)/i);
    if (workshopMatch) {
      workshopName = createVerifiedField(workshopMatch[0].replace(/^(?:WORKSHOP\s*NAME|DEALER\s*NAME)[:\s\-]*/i, '').trim(), 0.95, workshopMatch[0]);
    } else if (lines.length > 0) {
      const top = lines.slice(0, 3).find(l => !/^(?:TAX\s*INVOICE|INVOICE|GSTIN)/i.test(l));
      if (top) workshopName = createVerifiedField(top, 0.85, top);
    }

    let vehicleRegistration: ExtractedField<string | null> = createNotFoundField();
    const regMatch = text.match(/(?:REG(?:ISTRATION)?\s*(?:NO|NUMBER)?|VEHICLE\s*NO)[:\s\-]*([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{0,3}\s*[0-9]{4})/i)
      || text.match(/\b([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{1,3}\s*[0-9]{4})\b/i);
    if (regMatch) {
      const normalized = OcrFieldNormalizer.normalizeRegistration(regMatch[1]);
      if (normalized) {
        vehicleRegistration = createVerifiedField(normalized, 0.98, regMatch[0]);
      }
    }

    let vehicleModel: ExtractedField<string | null> = createNotFoundField();
    const modelMatch = text.match(/(?:MODEL|VEHICLE|VARIANT)[:\s\-]*([A-Za-z0-9\s\-]+)/i)
      || text.match(/\b(TVS\s*RONIN[A-Za-z0-9\s\-]*|ACTIVA[A-Za-z0-9\s\-]*|PULSAR[A-Za-z0-9\s\-]*|CRETA[A-Za-z0-9\s\-]*|SWIFT[A-Za-z0-9\s\-]*|SELTOS[A-Za-z0-9\s\-]*|NEXON[A-Za-z0-9\s\-]*|JUPITER[A-Za-z0-9\s\-]*)\b/i);
    if (modelMatch) {
      vehicleModel = createVerifiedField(modelMatch[1].trim(), 0.95, modelMatch[0]);
    }

    let chassisNumber: ExtractedField<string | null> = createNotFoundField();
    let engineNumber: ExtractedField<string | null> = createNotFoundField();

    const chassisMatch = text.match(/(?:CHASSIS|FRAME|VIN)\s*(?:NO|NUMBER)?[:\s\-]*([A-HJ-NPR-Z0-9]{10,18})/i);
    if (chassisMatch) {
      chassisNumber = createVerifiedField(chassisMatch[1].toUpperCase(), 0.97, chassisMatch[0]);
    }

    const engineMatch = text.match(/(?:ENGINE)\s*(?:NO|NUMBER)?[:\s\-]*([A-Z0-9]{6,18})/i);
    if (engineMatch) {
      engineNumber = createVerifiedField(engineMatch[1].toUpperCase(), 0.96, engineMatch[0]);
    }

    let currentOdometerKm: ExtractedField<number | null> = createNotFoundField();
    const odoMatch = text.match(/(?:CURRENT\s*KM|ODOMETER|VEHICLE\s*IN\s*KM|KM\s*READING|METER\s*READING|MILEAGE)[:\s\-]*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{1,6})\b/i);
    if (odoMatch) {
      const rawNum = odoMatch[1].replace(/,/g, '');
      const km = parseInt(rawNum, 10);
      if (km >= 1 && km <= 999999 && rawNum.length <= 6) {
        currentOdometerKm = createVerifiedField(km, 0.98, odoMatch[0]);
      }
    }

    let nextServiceOdometerKm: ExtractedField<number | null> = createNotFoundField();
    let nextServiceDate: ExtractedField<string | null> = createNotFoundField();

    const nextKmMatch = text.match(/(?:NEXT\s*SERVICE\s*(?:DUE)?\s*(?:KM)?|SERVICE\s*DUE\s*AT)[:\s\-]*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]{1,6})\b/i);
    if (nextKmMatch) {
      const km = parseInt(nextKmMatch[1].replace(/,/g, ''), 10);
      if (km >= 1 && km <= 999999) {
        nextServiceOdometerKm = createVerifiedField(km, 0.95, nextKmMatch[0]);
      }
    }

    const nextDateMatch = text.match(/(?:NEXT\s*SERVICE\s*(?:DUE)?\s*DATE|SERVICE\s*DUE\s*ON)[:\s\-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-3][0-9])/i);
    if (nextDateMatch) {
      const normDate = OcrFieldNormalizer.normalizeDate(nextDateMatch[1]);
      if (normDate) {
        nextServiceDate = createVerifiedField(normDate, 0.95, nextDateMatch[0]);
      }
    }

    let invoiceNumber: ExtractedField<string | null> = createNotFoundField();
    let invoiceDate: ExtractedField<string | null> = createNotFoundField();

    const invNumMatch = text.match(/(?:INVOICE|BILL|MEMO|RO)\s*(?:NO|NUMBER)?[:\s\-]*([A-Z0-9\-\/]+)/i);
    if (invNumMatch) {
      invoiceNumber = createVerifiedField(invNumMatch[1].trim(), 0.95, invNumMatch[0]);
    }

    const dateMatch = text.match(/(?:DATE|INVOICE\s*DATE|BILL\s*DATE)[:\s\-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-3][0-9])/i)
      || text.match(/\b([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-3][0-9])\b/);
    if (dateMatch) {
      const normDate = OcrFieldNormalizer.normalizeDate(dateMatch[1]);
      if (normDate) {
        invoiceDate = createVerifiedField(normDate, 0.95, dateMatch[0]);
      }
    }

    let labourCharges: ExtractedField<number | null> = createNotFoundField();
    let partsTotal: ExtractedField<number | null> = createNotFoundField();
    let totalAmount: ExtractedField<number | null> = createNotFoundField();

    const labourMatch = text.match(/(?:LABOUR|LABOR|SERVICE\s*CHARGE)[:\s\-]*[₹Rs\s]*([0-9]+(?:\.[0-9]{2})?)/i);
    if (labourMatch) {
      labourCharges = createVerifiedField(parseFloat(labourMatch[1]), 0.90, labourMatch[0]);
    }

    const totalMatch = text.match(/(?:GRAND\s*TOTAL|TOTAL\s*AMOUNT|NET\s*AMOUNT|AMOUNT\s*PAYABLE|TOTAL)[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (totalMatch) {
      const amt = OcrFieldNormalizer.normalizeAmount(totalMatch[1]);
      if (amt) totalAmount = createVerifiedField(amt, 0.98, totalMatch[0]);
    }

    return {
      workshopName,
      vehicleRegistration,
      vehicleModel,
      chassisNumber,
      engineNumber,
      currentOdometerKm,
      nextServiceOdometerKm,
      nextServiceDate,
      invoiceNumber,
      invoiceDate,
      labourCharges,
      partsTotal,
      totalAmount
    };
  }
}

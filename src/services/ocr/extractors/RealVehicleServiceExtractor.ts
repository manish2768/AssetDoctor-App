/**
 * Asset Doctor — Dedicated Vehicle Service & Job Card Extractor
 *
 * Extracts structured service & repair bills:
 * - Workshop / Service Centre Name & GSTIN
 * - Job Card / RO Number
 * - Invoice Number & Service Date
 * - Vehicle Registration (Indian format)
 * - Vehicle Model
 * - Odometer Reading (strictly validated; never equal to invoice amount)
 * - Next Service Due KM & Next Service Date
 * - Financial Breakdown (Labour, Parts, Taxes, Grand Total via GrandTotalEngine)
 */

import { CrossFieldValidator } from '../engine/CrossFieldValidator';
import { GrandTotalEngine } from '../engine/GrandTotalEngine';
import { FieldCandidateEngine } from '../engine/FieldCandidateEngine';

export interface ExtractedVehicleServiceData {
  workshopName: string | null;
  workshopPhone: string | null;
  registration: string | null;
  vehicleModel: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  odometerKm: number | null;
  nextServiceOdometerKm: number | null;
  nextServiceDate: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  jobCardNumber: string | null;
  labourCharges: number | null;
  partsTotal: number | null;
  totalAmount: number | null;
  subtotal: number | null;
  taxAmount: number | null;
}

export class RealVehicleServiceExtractor {
  public static extract(rawText: string, engine?: FieldCandidateEngine): ExtractedVehicleServiceData {
    const text = rawText || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Financial Breakdown first (needed for odometer cross-validation)
    const fin = GrandTotalEngine.extractFinancials(text);

    // 2. Workshop Name & Optional Mobile
    let workshopName: string | null = null;
    let workshopPhone: string | null = null;
    let workshopGstin: string | null = null;

    const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/);
    if (gstinMatch) {
      const val = CrossFieldValidator.validateGstin(gstinMatch[1]);
      if (val.valid) workshopGstin = val.normalized || gstinMatch[1];
    }

    const explicitWorkshop = text.match(/(?:WORKSHOP\s*NAME|DEALER\s*NAME|SERVICE\s*STATION)[:\s\-]+([A-Za-z0-9 ,.&'–—]+?)(?:\r?\n|$)/i);
    if (explicitWorkshop && explicitWorkshop[1].trim().length >= 3) {
      workshopName = explicitWorkshop[1].trim();
    } else {
      const top = lines.slice(0, 4).find((l) =>
        /(?:MOTORS|AUTOMOBILES|AUTOMOTIVE|SERVICE|AUTOTRADE|REPAIRS?|GARAGE|\bAUTO\b|HERO|HONDA|TVS|BAJAJ|HYUNDAI|MARUTI|TOYOTA|TATA)/i.test(l) &&
        !/^(?:JOB\s*CARD|TAX\s*INVOICE|SERVICE\s*INVOICE|GSTIN|BILL|INVOICE\b)/i.test(l)
      );
      if (top) {
        workshopName = top.split(/—|–|-|,\s*Plot|,\s*Shop/i)[0].trim();
      } else if (lines.length > 0 && !/^(?:JOB\s*CARD|TAX\s*INVOICE|SERVICE\s*INVOICE|GSTIN|BILL|INVOICE\b)/i.test(lines[0])) {
        workshopName = lines[0].split(/—|–|-/)[0].trim();
      }
    }

    // Optional Workshop Mobile (never confuse with customer phone, PIN, IMEI, or amount)
    const topLines = lines.slice(0, 6);
    const workshopHeaderLines = topLines.filter(
      (l) =>
        /\b(?:CUSTOMER\s*(?:CARE|SUPPORT)|HELP(?:LINE|DESK))\b/i.test(l) ||
        !/\b(?:CUSTOMER(?:\s*NAME|\s*:)|OWNER|BUYER|CONSIGNEE)\b/i.test(l)
    );
    const headerText = workshopHeaderLines.join('\n');
    const phoneLabeledMatch = headerText.match(
      /(?:PH(?:ONE)?|MOB(?:ILE)?|TEL|CONTACT|HELPLINE)[:\s\-]+(?:\+?91[\s\-]*)?([6-9][0-9]{9})\b/i
    );
    if (phoneLabeledMatch) {
      const v = CrossFieldValidator.validateIndianPhone(phoneLabeledMatch[1]);
      if (v.valid) workshopPhone = v.normalized || phoneLabeledMatch[1];
    } else {
      const phoneStandalone = headerText.match(/\b(?:\+?91[\s\-]*)?([6-9][0-9]{9})\b/);
      if (phoneStandalone) {
        const candidatePhone = phoneStandalone[1];
        if (candidatePhone.length === 10) {
          const v = CrossFieldValidator.validateIndianPhone(candidatePhone);
          if (v.valid) workshopPhone = v.normalized || candidatePhone;
        }
      }
    }

    // 3. Job Card / RO Number & Invoice Number
    let jobCardNumber: string | null = null;
    let invoiceNumber: string | null = null;
    let invoiceDate: string | null = null;

    const jcMatch =
      text.match(/(?:JOB\s*CARD|RO|REPAIR\s*ORDER)[^\S\r\n]*(?:NO\.?|NUM(?:BER)?|#)?[^\S\r\n]*[:\-#][^\S\r\n]*([A-Z0-9\-_/]+)/i) ||
      text.match(/(?:JOB\s*CARD(?:\s*NO)?|\bRO\s*(?:NO|NUMBER)?|REPAIR\s*ORDER)[:\s\-]*([A-Z0-9\-/]+)/i);
    if (jcMatch) {
      const cand = jcMatch[1].trim();
      if (cand.length >= 3 && !/^[/\-_.:]+$/.test(cand)) {
        jobCardNumber = cand;
      }
    }

    const invMatch =
      text.match(/(?:INVOICE|SERVICE\s*INVOICE|BILL)(?:[^\S\r\n]*\/[^\S\r\n]*[A-Za-z\s]+)?[^\S\r\n]*(?:NO\.?|NUM(?:BER)?|#)[^\S\r\n]*[:\-#][^\S\r\n]*([A-Z0-9\-_/]+)/i) ||
      text.match(/(?:INVOICE\s*(?:NO|NUMBER|#)|BILL\s*NO)[:\s\-]*([A-Z0-9\-/]+)/i);
    if (invMatch) {
      const cand = invMatch[1].trim();
      if (!CrossFieldValidator.normalizeDate(cand) && cand.length >= 3 && !/^[/\-_.:]+$/.test(cand)) {
        invoiceNumber = cand;
      }
    }

    if (!invoiceNumber && jobCardNumber) {
      invoiceNumber = jobCardNumber;
    }

    const dateMatch = text.match(/(?:SERVICE\s*DATE|INVOICE\s*DATE|BILL\s*DATE|DATE)[:\s\-]*((?:20[2-3][0-9][/\-.][0-1]?[0-9][/\-.][0-3]?[0-9])|[0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i)
      || text.match(/\b(20[2-3][0-9][/\-.][0-1]?[0-9][/\-.][0-3]?[0-9]|[0-3]?[0-9][/\-.][0-1]?[0-9][/\-.]20[2-3][0-9])\b/);
    if (dateMatch) {
      invoiceDate = CrossFieldValidator.normalizeDate(dateMatch[1]);
    }

    // 4. Vehicle Registration
    let registration: string | null = null;
    const regMatch = text.match(/(?:REG(?:ISTRATION)?\s*(?:NO|NUMBER)?|VEHICLE\s*NO)[:\s\-]*([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{0,3}\s*[0-9]{4})\b/i)
      || text.match(/\b([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{1,3}\s*[0-9]{4})\b/i);
    if (regMatch) {
      const val = CrossFieldValidator.validateIndianRegistration(regMatch[1]);
      if (val.valid) registration = val.normalized || regMatch[1];
    }

    // 5. Vehicle Model
    let vehicleModel: string | null = null;

    const isDisallowedServiceModel = (c: string): boolean => {
      if (!c || c.length < 3) return true;
      if (/^(?:DETAILS|INFORMATION|PARTICULARS|SPECIFICATIONS|SERVICE|NAME|MODEL|VEHICLE|SERVICE\s*DETAILS)$/i.test(c)) return true;
      if (/\b(?:details|info|address|model\s*town)\b/i.test(c)) return true;
      return false;
    };

    const modelMatch = text.match(/(?:(?:^|\n)[^\n]*(?:MODEL(?:\s*NAME)?|VEHICLE\s*MODEL|VARIANT)[^\S\r\n]*[:\-][^\S\r\n]*([A-Za-z0-9\s\-]+))/i);
    if (modelMatch) {
      const cand = modelMatch[1].split(/\n|REGISTRATION|ODOMETER|CHASSIS|FUEL|HSN/i)[0].trim();
      if (!isDisallowedServiceModel(cand)) {
        vehicleModel = cand;
      }
    }

    if (!vehicleModel) {
      const knownVehicles = lines.find((l) =>
        /\b(TVS\s*RONIN|RONIN\s*225|ACTIVA|PULSAR|JUPITER|CRETA|SWIFT|SELTOS|BALENO|NEXON|I10|GRAND\s*I10|VERNA|CITY|BREZZA|ERTIGA|SCORPIO|THAR|APACHE|HERO|HONDA|BAJAJ)\b/i.test(l) &&
        !/^(?:SUNRISE|WORKSHOP|DEALER)/i.test(l) &&
        !isDisallowedServiceModel(l)
      );
      if (knownVehicles) {
        vehicleModel = knownVehicles.replace(/^[0-9]+\s+/, '').split(/\n|Half|Odometer/i)[0].trim();
      }
    }

    // 6. Chassis & Engine Number
    let chassisNumber: string | null = null;
    let engineNumber: string | null = null;

    const chassisMatch = text.match(/(?:CHASSIS(?:\s*\/[^\n:]+)?|FRAME\s*NO|VIN\s*NO|CHASSIS\s*NO)[:\s\-]*([A-HJ-NPR-Z0-9]{10,18})\b/i);
    if (chassisMatch) chassisNumber = chassisMatch[1].toUpperCase().trim();

    const engineMatch = text.match(/(?:ENGINE\s*(?:NO|NUMBER)?|MOTOR\s*(?:NO|NUMBER)?)[:\s\-]*([A-Z0-9]{6,18})\b/i);
    if (engineMatch) {
      const cand = engineMatch[1].toUpperCase().trim();
      if (!CrossFieldValidator.normalizeDate(cand)) engineNumber = cand;
    }

    // 7. Odometer Reading (CRITICAL SANITY VALIDATION)
    let odometerKm: number | null = null;
    const odoMatches = [
      text.match(/(?:ODOMETER|CURRENT\s*KM|VEHICLE\s*IN\s*KM|KM\s*READING|METER\s*READING|ODO(?:\s*KM)?|\bKM\b)[:\s\-]*([0-9,]+(?:\.[0-9]+)?)\s*(?:KM)?/i),
      text.match(/\b([0-9]{4,6})\s*KM\b/i),
    ];

    for (const m of odoMatches) {
      if (m && m[1]) {
        const val = CrossFieldValidator.validateOdometer(m[1], {
          totalAmount: fin.grandTotal,
          subtotal: fin.subtotal,
        });
        if (val.valid && val.normalized != null) {
          odometerKm = val.normalized;
          break;
        }
      }
    }

    // 8. Next Service Due KM & Date
    let nextServiceOdometerKm: number | null = null;
    let nextServiceDate: string | null = null;

    const nextKmMatch = text.match(/(?:NEXT\s*SERVICE\s*(?:DUE)?\s*(?:AT|KM)?|DUE\s*AT)[:\s\-]*([0-9,]+)\s*(?:KM)?/i);
    if (nextKmMatch) {
      const val = CrossFieldValidator.validateOdometer(nextKmMatch[1], { totalAmount: fin.grandTotal });
      if (val.valid && val.normalized != null) {
        nextServiceOdometerKm = val.normalized;
      }
    }

    const nextDateMatch = text.match(/(?:NEXT\s*SERVICE\s*(?:DUE)?\s*DATE|SERVICE\s*DUE\s*ON)[:\s\-]*([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i);
    if (nextDateMatch) {
      nextServiceDate = CrossFieldValidator.normalizeDate(nextDateMatch[1]);
    }

    // 9. Register candidates in engine if provided
    if (engine) {
      if (workshopName) {
        engine.addCandidate({
          field: 'shopName',
          value: workshopName,
          normalizedValue: workshopName,
          provider: 'LayoutRegex',
          rawEvidence: workshopName,
          confidence: 0.95,
          validationStatus: 'VALID',
        });
      }
      if (registration) {
        engine.addCandidate({
          field: 'registration',
          value: registration,
          normalizedValue: registration,
          provider: 'LayoutRegex',
          rawEvidence: registration,
          confidence: 0.98,
          validationStatus: 'VALID',
        });
      }
      if (vehicleModel) {
        engine.addCandidate({
          field: 'productName',
          value: vehicleModel,
          normalizedValue: vehicleModel,
          provider: 'LayoutRegex',
          rawEvidence: vehicleModel,
          confidence: 0.95,
          validationStatus: 'VALID',
        });
      }
      if (odometerKm != null) {
        engine.addCandidate({
          field: 'odometerKm',
          value: odometerKm,
          normalizedValue: odometerKm,
          provider: 'LayoutRegex',
          rawEvidence: `${odometerKm} KM`,
          confidence: 0.98,
          validationStatus: 'VALID',
        });
      }
      if (invoiceNumber) {
        engine.addCandidate({
          field: 'invoiceNumber',
          value: invoiceNumber,
          normalizedValue: invoiceNumber,
          provider: 'LayoutRegex',
          rawEvidence: invoiceNumber,
          confidence: 0.96,
          validationStatus: 'VALID',
        });
      }
      if (invoiceDate) {
        engine.addCandidate({
          field: 'invoiceDate',
          value: invoiceDate,
          normalizedValue: invoiceDate,
          provider: 'LayoutRegex',
          rawEvidence: invoiceDate,
          confidence: 0.96,
          validationStatus: 'VALID',
        });
      }
      if (fin.grandTotal != null) {
        engine.addCandidate({
          field: 'totalAmount',
          value: fin.grandTotal,
          normalizedValue: fin.grandTotal,
          provider: 'LayoutRegex',
          rawEvidence: fin.rawEvidence,
          confidence: fin.confidence,
          validationStatus: 'VALID',
        });
      }
      if (workshopPhone) {
        engine.addCandidate({
          field: 'sellerPhone',
          value: workshopPhone,
          normalizedValue: workshopPhone,
          provider: 'LayoutRegex',
          rawEvidence: workshopPhone,
          confidence: 0.90,
          validationStatus: 'VALID',
        });
        engine.addCandidate({
          field: 'shopPhone',
          value: workshopPhone,
          normalizedValue: workshopPhone,
          provider: 'LayoutRegex',
          rawEvidence: workshopPhone,
          confidence: 0.90,
          validationStatus: 'VALID',
        });
      }
      if (fin.labourCharges != null) {
        engine.addCandidate({
          field: 'labourCharges',
          value: fin.labourCharges,
          normalizedValue: fin.labourCharges,
          provider: 'LayoutRegex',
          rawEvidence: `${fin.labourCharges}`,
          confidence: 0.94,
          validationStatus: 'VALID',
        });
      }
      if (fin.partsTotal != null) {
        engine.addCandidate({
          field: 'partsTotal',
          value: fin.partsTotal,
          normalizedValue: fin.partsTotal,
          provider: 'LayoutRegex',
          rawEvidence: `${fin.partsTotal}`,
          confidence: 0.94,
          validationStatus: 'VALID',
        });
      }
      // Note: workshopGstin is NOT added as candidate per data minimization
    }

    return {
      workshopName,
      workshopPhone,
      registration,
      vehicleModel,
      chassisNumber,
      engineNumber,
      odometerKm,
      nextServiceOdometerKm,
      nextServiceDate,
      invoiceNumber,
      invoiceDate,
      jobCardNumber,
      labourCharges: fin.labourCharges,
      partsTotal: fin.partsTotal,
      totalAmount: fin.grandTotal,
      subtotal: fin.subtotal,
      taxAmount: fin.taxAmount,
    };
  }
}

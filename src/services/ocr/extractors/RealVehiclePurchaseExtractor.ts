/**
 * Asset Doctor — Dedicated Vehicle Purchase Extractor
 *
 * Extracts structured new/used vehicle purchase invoice details:
 * - Vehicle Make & Model
 * - Registration Number (Indian format)
 * - Chassis / VIN Number (17 chars)
 * - Engine Number
 * - Dealer Name & GSTIN
 * - Invoice Number & Date
 * - Pricing Breakdown (Ex-showroom, RTO, Insurance, Total)
 */

import { CrossFieldValidator } from '../engine/CrossFieldValidator';
import { GrandTotalEngine } from '../engine/GrandTotalEngine';
import { FieldCandidateEngine } from '../engine/FieldCandidateEngine';

export interface ExtractedVehiclePurchaseData {
  productName: string | null;
  make: string | null;
  model: string | null;
  registration: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dealerName: string | null;
  dealerPhone: string | null;
  dealerGstin: string | null;
  buyerName: string | null;
  exShowroomPrice: number | null;
  totalAmount: number | null;
  subtotal: number | null;
  taxAmount: number | null;
  warrantyExpiry: string | null;
}

export class RealVehiclePurchaseExtractor {
  public static extract(rawText: string, engine?: FieldCandidateEngine): ExtractedVehiclePurchaseData {
    const text = rawText || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Dealer & Optional Mobile
    let dealerName: string | null = null;
    let dealerPhone: string | null = null;
    let dealerGstin: string | null = null;

    const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/);
    if (gstinMatch) {
      const val = CrossFieldValidator.validateGstin(gstinMatch[1]);
      if (val.valid) dealerGstin = val.normalized || gstinMatch[1];
    }

    const dealerMatch = text.match(/(?:DEALER(?:\s*NAME)?|SOLD\s*BY|AUTHORISED\s*DEALER)[:\s\-]*([A-Za-z0-9\s.,&'–—]+)/i);
    if (dealerMatch) {
      dealerName = dealerMatch[1].split(/\n|GSTIN|PLOT|CIN|PAN/i)[0].trim();
    } else if (lines.length > 0) {
      const top = lines.slice(0, 4).find((l) =>
        /(?:MOTORS|AUTOMOBILES|AUTOMOTIVE|AUTOTRADE|HERO|HONDA|TVS|BAJAJ|HYUNDAI|MARUTI|TOYOTA|TATA)/i.test(l) &&
        !/^(?:TAX\s*INVOICE|GSTIN)/i.test(l)
      );
      if (top) dealerName = top.split(/—|–|-|Plot|Kanpur/i)[0].trim();
    }

    // Optional Dealer Mobile
    const topLines = lines.slice(0, 6);
    const dealerHeaderLines = topLines.filter(
      (l) => !/\b(?:CUSTOMER|OWNER|BUYER|CONSIGNEE)\b/i.test(l)
    );
    const headerText = dealerHeaderLines.join('\n');
    const phoneLabeledMatch = headerText.match(
      /(?:PH(?:ONE)?|MOB(?:ILE)?|TEL|CONTACT|HELPLINE)[:\s\-]+(?:\+?91[\s\-]*)?([6-9][0-9]{9})\b/i
    );
    if (phoneLabeledMatch) {
      const v = CrossFieldValidator.validateIndianPhone(phoneLabeledMatch[1]);
      if (v.valid) dealerPhone = v.normalized || phoneLabeledMatch[1];
    } else {
      const phoneStandalone = headerText.match(/\b(?:\+?91[\s\-]*)?([6-9][0-9]{9})\b/);
      if (phoneStandalone) {
        const candidatePhone = phoneStandalone[1];
        if (candidatePhone.length === 10) {
          const v = CrossFieldValidator.validateIndianPhone(candidatePhone);
          if (v.valid) dealerPhone = v.normalized || candidatePhone;
        }
      }
    }

    // 2. Buyer Name
    let buyerName: string | null = null;
    const buyerMatch = text.match(/(?:CUSTOMER\s*NAME|BUYER|SOLD\s*TO|BILL\s*TO)[:\s\-]*([A-Za-z\s.]+)/i);
    if (buyerMatch) {
      buyerName = buyerMatch[1].split(/\n|PHONE|MOBILE|ADDRESS|GSTIN/i)[0].trim();
    }

    // 3. Invoice Number & Date
    let invoiceNumber: string | null = null;
    let invoiceDate: string | null = null;

    const invMatch =
      text.match(/(?:INVOICE|BILL|TAX\s*INVOICE|RECEIPT|ORDER)[^\S\r\n]*(?:NO\.?|NUM(?:BER)?|#)[^\S\r\n]*[:\-#][^\S\r\n]*([A-Z0-9\-_/]+)/i) ||
      text.match(/(?:INVOICE\s*(?:NO|NUMBER|#)?|BILL\s*NO)[:\s\-]+([A-Z0-9\-_/]+)/i);
    if (invMatch) {
      const rawInv = invMatch[1].trim();
      if (!CrossFieldValidator.normalizeDate(rawInv)) {
        invoiceNumber = rawInv;
      }
    }

    const dateMatch = text.match(/(?:INVOICE\s*DATE|BILL\s*DATE|DATE\s*OF\s*ISSUE|DATE)[:\s\-]*([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i)
      || text.match(/\b([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.]20[2-3][0-9])\b/);
    if (dateMatch) {
      invoiceDate = CrossFieldValidator.normalizeDate(dateMatch[1]);
    }

    // 4. Vehicle Model & Make
    let model: string | null = null;
    let make: string | null = null;

    const isDisallowedModel = (c: string): boolean => {
      if (!c || c.length < 3) return true;
      if (/^(?:OF\s*GOODS|MODEL|VEHICLE|DETAILS|CODE|NAME|SPECIFICATIONS)$/i.test(c)) return true;
      if (/\b(?:model\s*town|nagar|colony|sector|vihar|road|street|marg|floor|building|address|pin\s*code|\b\d{6}\b)\b/i.test(c)) return true;
      if (/\b(?:lucknow|delhi|mumbai|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|jaipur|chandigarh|noida|gurgaon|gurugram)\b/i.test(c)) return true;
      return false;
    };

    const modelMatch = text.match(/(?:(?:^|\n)[^\n]*(?:VEHICLE(?:\s*MODEL)?|MODEL(?:\s*NAME)?|PRODUCT)[^\S\r\n]*[:\-][^\S\r\n]*([A-Za-z0-9\s\-]+))/i);
    if (modelMatch) {
      const candidate = modelMatch[1].split(/\n|COLOUR|COLOR|REGISTRATION|CHASSIS|ENGINE|HSN/i)[0].trim();
      if (!isDisallowedModel(candidate)) {
        model = candidate;
      }
    }

    if (!model) {
      const knownVehicles = lines.find((l) =>
        /\b(TVS\s*RONIN|RONIN|ACTIVA|PULSAR|JUPITER|CRETA|SWIFT|SELTOS|BALENO|NEXON|I10|GRAND\s*I10|VERNA|CITY|BREZZA|ERTIGA|SCORPIO|THAR|APACHE|HERO|HONDA|BAJAJ|ROYAL\s*ENFIELD|YAMAHA|SUZUKI)\b/i.test(l) &&
        !/^(?:SOLD\s*BY|DEALER|AUTHORISED)/i.test(l) &&
        !isDisallowedModel(l)
      );
      if (knownVehicles) {
        model = knownVehicles.replace(/^[0-9]+\s+/, '').split(/\n|Colour|Matte|HSN/i)[0].trim();
      }
    }

    if (model) {
      const firstWord = model.split(/\s+/)[0];
      make = firstWord;
    }

    // 5. Registration Number
    let registration: string | null = null;
    const regMatch = text.match(/(?:REG(?:ISTRATION)?\s*(?:NO|NUMBER)?|VEHICLE\s*NO)[:\s\-]*([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{0,3}\s*[0-9]{4})\b/i)
      || text.match(/\b([A-Z]{2}\s*[0-9]{1,2}\s*[A-Z]{1,3}\s*[0-9]{4})\b/i);
    if (regMatch) {
      const val = CrossFieldValidator.validateIndianRegistration(regMatch[1]);
      if (val.valid) registration = val.normalized || regMatch[1];
    }

    // 6. Chassis / VIN & Engine Number
    let chassisNumber: string | null = null;
    let engineNumber: string | null = null;

    const chassisMatch = text.match(/(?:CHASSIS\s*(?:\/|\s*)FRAME|CHASSIS\s*NO|VIN\s*NO|FRAME\s*NO)[:\s\-]*([A-HJ-NPR-Z0-9]{10,18})\b/i);
    if (chassisMatch) {
      chassisNumber = chassisMatch[1].toUpperCase().trim();
    }

    const engineMatch = text.match(/(?:ENGINE\s*NO|ENGINE\s*NUMBER)[:\s\-]*([A-Z0-9]{6,18})\b/i);
    if (engineMatch) {
      const cand = engineMatch[1].toUpperCase().trim();
      if (!CrossFieldValidator.normalizeDate(cand)) {
        engineNumber = cand;
      }
    }

    // 7. Financial Breakdown
    const fin = GrandTotalEngine.extractFinancials(text);

    // Register candidates in engine if provided
    if (engine) {
      if (model) {
        engine.addCandidate({
          field: 'productName',
          value: model,
          normalizedValue: model,
          provider: 'LayoutRegex',
          rawEvidence: model,
          confidence: 0.95,
          validationStatus: 'VALID',
        });
      }
      if (dealerName) {
        engine.addCandidate({
          field: 'shopName',
          value: dealerName,
          normalizedValue: dealerName,
          provider: 'LayoutRegex',
          rawEvidence: dealerName,
          confidence: 0.94,
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
      if (chassisNumber) {
        engine.addCandidate({
          field: 'chassisNumber',
          value: chassisNumber,
          normalizedValue: chassisNumber,
          provider: 'LayoutRegex',
          rawEvidence: chassisNumber,
          confidence: 0.98,
          validationStatus: 'VALID',
        });
      }
      if (engineNumber) {
        engine.addCandidate({
          field: 'engineNumber',
          value: engineNumber,
          normalizedValue: engineNumber,
          provider: 'LayoutRegex',
          rawEvidence: engineNumber,
          confidence: 0.97,
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
      if (dealerPhone) {
        engine.addCandidate({
          field: 'sellerPhone',
          value: dealerPhone,
          normalizedValue: dealerPhone,
          provider: 'LayoutRegex',
          rawEvidence: dealerPhone,
          confidence: 0.90,
          validationStatus: 'VALID',
        });
        engine.addCandidate({
          field: 'shopPhone',
          value: dealerPhone,
          normalizedValue: dealerPhone,
          provider: 'LayoutRegex',
          rawEvidence: dealerPhone,
          confidence: 0.90,
          validationStatus: 'VALID',
        });
      }
      // Warranty Expiry derivation
      let warrantyExpiry: string | null = null;
      const warMatch = text.match(/(?:WARRANTY|GUARANTEE)[:\s\-]*([0-9]{1,2})\s*(?:MONTHS|YEARS|YEAR|YR|MTHS?)/i);
      if (warMatch) {
        const num = parseInt(warMatch[1], 10);
        const isYears = /year/i.test(warMatch[0]);
        const months = isYears ? num * 12 : num;
        if (invoiceDate) {
          warrantyExpiry = CrossFieldValidator.addMonthsToDate(invoiceDate, months);
          if (warrantyExpiry) {
            engine.addCandidate({
              field: 'warrantyExpiry',
              value: warrantyExpiry,
              normalizedValue: warrantyExpiry,
              provider: 'LayoutRegex',
              rawEvidence: `${months} months from ${invoiceDate}`,
              confidence: 0.95,
              validationStatus: 'VALID',
            });
          }
        }
      }
      // Note: dealerGstin is NOT added as candidate per data minimization
    }

    return {
      productName: model,
      make,
      model,
      registration,
      chassisNumber,
      engineNumber,
      invoiceNumber,
      invoiceDate,
      dealerName,
      dealerPhone,
      dealerGstin,
      buyerName,
      exShowroomPrice: fin.exShowroomPrice,
      totalAmount: fin.grandTotal,
      subtotal: fin.subtotal,
      taxAmount: fin.taxAmount,
      warrantyExpiry: null,
    };
  }
}

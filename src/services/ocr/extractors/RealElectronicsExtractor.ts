/**
 * Asset Doctor — Dedicated Electronics Purchase Extractor
 *
 * Extracts structured electronics fields with proximity validation:
 * - Product Name & Model (generic, not hardcoded)
 * - Brand
 * - Serial Number & IMEI 1 / IMEI 2 (Luhn validated)
 * - Invoice Number & Date
 * - Seller Name & GSTIN
 * - Financials (Subtotal, Taxes, Grand Total via GrandTotalEngine)
 * - Warranty Period & Expiration
 */

import { CrossFieldValidator } from '../engine/CrossFieldValidator';
import { GrandTotalEngine } from '../engine/GrandTotalEngine';
import { FieldCandidateEngine } from '../engine/FieldCandidateEngine';

export interface ExtractedElectronicsData {
  productName: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  imei: string | null;
  imei2: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerGstin: string | null;
  buyerName: string | null;
  totalAmount: number | null;
  subtotal: number | null;
  taxAmount: number | null;
  warrantyMonths: number | null;
  warrantyExpiry: string | null;
}

export class RealElectronicsExtractor {
  public static extract(rawText: string, engine?: FieldCandidateEngine): ExtractedElectronicsData {
    const text = rawText || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Seller & Optional Mobile
    let sellerName: string | null = null;
    let sellerPhone: string | null = null;
    let sellerGstin: string | null = null;

    const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/);
    if (gstinMatch) {
      const val = CrossFieldValidator.validateGstin(gstinMatch[1]);
      if (val.valid) sellerGstin = val.normalized || gstinMatch[1];
    }

    const top = lines.slice(0, 4).find((l) => !/^(?:TAX\s*INVOICE|RETAIL\s*INVOICE|GSTIN|ORIGINAL|CASH\s*MEMO|BILL|INVOICE\b)/i.test(l));
    if (top) {
      sellerName = top.split(/—|–|-/)[0].trim();
    }
    const sellerMatch = text.match(/(?:SOLD\s*BY|SELLER|STORE\s*NAME|RETAILER|MERCHANT|DEALER)[:\s\-]+([A-Za-z0-9 ,.&'–—]+)/i);
    if (sellerMatch && (!sellerName || sellerName.length < 3)) {
      sellerName = sellerMatch[1].trim();
    }

    // Optional Seller Mobile (never confuse with customer phone, PIN, IMEI, or amount)
    const topLines = lines.slice(0, 6);
    const sellerHeaderLines = topLines.filter(
      (l) =>
        /\b(?:CUSTOMER\s*(?:CARE|SUPPORT)|HELP(?:LINE|DESK))\b/i.test(l) ||
        !/\b(?:BILL\s*TO|BUYER|CONSIGNEE|CUSTOMER(?:\s*NAME|\s*:))\b/i.test(l)
    );
    const sellerHeaderText = sellerHeaderLines.join('\n');
    const phoneLabeledMatch = sellerHeaderText.match(
      /(?:PH(?:ONE)?|MOB(?:ILE)?|TEL|CONTACT|CALL)[:\s\-]+(?:\+?91[\s\-]*)?([6-9][0-9]{9})\b/i
    );
    if (phoneLabeledMatch) {
      const v = CrossFieldValidator.validateIndianPhone(phoneLabeledMatch[1]);
      if (v.valid) sellerPhone = v.normalized || phoneLabeledMatch[1];
    } else {
      const phoneStandaloneMatch = sellerHeaderText.match(/\b(?:\+?91[\s\-]*)?([6-9][0-9]{9})\b/);
      if (phoneStandaloneMatch) {
        const candidatePhone = phoneStandaloneMatch[1];
        if (candidatePhone.length === 10) {
          const v = CrossFieldValidator.validateIndianPhone(candidatePhone);
          if (v.valid) sellerPhone = v.normalized || candidatePhone;
        }
      }
    }

    // 2. Buyer Name
    let buyerName: string | null = null;
    const buyerMatch = text.match(/(?:BILL\s*TO|BUYER|CUSTOMER(?:\s*NAME)?|CONSIGNEE|SOLD\s*TO)[:\s\-]*([A-Za-z\s.]+)/i);
    if (buyerMatch) {
      buyerName = buyerMatch[1].split(/\n|PHONE|MOBILE|ADDRESS|GSTIN/i)[0].trim();
    }

    // 3. Invoice Number & Date
    let invoiceNumber: string | null = null;
    let invoiceDate: string | null = null;

    const invMatch =
      text.match(/(?:INVOICE|BILL|TAX\s*INVOICE|RECEIPT|CASH\s*MEMO|ORDER|INV)[^\S\r\n]*(?:NO\.?|NUM(?:BER)?|#)[^\S\r\n]*[:\-#][^\S\r\n]*([A-Z0-9\-_/]+)/i) ||
      text.match(/(?:INVOICE\s*(?:NO\.?|NUMBER|#)|BILL\s*(?:NO\.?|NUMBER|#)|TAX\s*INVOICE\s*(?:NO\.?|NUMBER|#)|INV\s*(?:NO\.?|#))[:\s\-]+([A-Z0-9\-_/]+)/i);
    if (invMatch) {
      const rawInv = invMatch[1].trim();
      // Guard: Invoice number cannot be a pure date
      if (!CrossFieldValidator.normalizeDate(rawInv)) {
        invoiceNumber = rawInv;
      }
    }

    const dateMatch =
      text.match(/(?:INVOICE\s*DATE|BILL\s*DATE|DATE\s*OF\s*ISSUE|PURCHASE\s*DATE|DATE)[:\s\-]*([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b20[1-3][0-9][/\-.][0-1]?[0-9][/\-.][0-3]?[0-9]\b|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i) ||
      text.match(/\b([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.]20[2-3][0-9]|20[1-3][0-9][/\-.][0-1]?[0-9][/\-.][0-3]?[0-9])\b/);
    if (dateMatch) {
      invoiceDate = CrossFieldValidator.normalizeDate(dateMatch[1]);
    }

    // 4. Product Name, Brand & Model
    let productName: string | null = null;
    let brand: string | null = null;
    let model: string | null = null;

    const isDisallowedCandidate = (cand: string): boolean => {
      if (!cand || cand.length < 3) return true;
      if (/^(?:OF\s*GOODS|ITEM|NAME|MODEL|DESCRIPTION|PARTICULARS|DETAILS|SERVICE\s*DETAILS)$/i.test(cand)) return true;
      if (/\b(?:model\s*town|nagar|colony|sector|vihar|road|street|marg|floor|building|address|pin\s*code|\b\d{6}\b)\b/i.test(cand)) return true;
      if (/\b(?:lucknow|delhi|mumbai|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|jaipur|chandigarh|noida|gurgaon|gurugram)\b/i.test(cand) && !/\b(?:edition|special)\b/i.test(cand)) return true;
      return false;
    };

    // Pattern A1: Explicit Item / Product anchor (exclude address/model town lines)
    const explicitItemMatch = text.match(/(?:(?:^|\n)[^\n]*(?:PRODUCT(?:\s*NAME)?|ITEM(?:\s*NAME)?|MODEL\s*(?:NO\.?|NUM(?:BER)?|#|NAME)|PARTICULARS|DESCRIPTION\s*(?:OF\s*GOODS)?)[^\S\r\n]*[:\-][^\S\r\n]*([A-Za-z0-9\s()/\-+.,&]+))/i);
    if (explicitItemMatch) {
      const cand = explicitItemMatch[1].split(/\n|HSN|QTY|RATE|PRICE|AMOUNT|TAX|SERIAL/i)[0].trim();
      if (!isDisallowedCandidate(cand)) {
        productName = cand;
      }
    }

    // Pattern A2: Table description header & next content line
    const descHeaderIdx = lines.findIndex((l) => /\b(?:DESCRIPTION\s*(?:OF\s*GOODS)?|ITEM\s*DESCRIPTION)\b/i.test(l));
    if (!productName && descHeaderIdx >= 0) {
      const remainingLines = lines.slice(descHeaderIdx + 1);
      const nextContentLine = remainingLines.find((l) => {
        const cleaned = l.replace(/[\s—\-_=─━┄┅┈┉.]/g, '');
        return cleaned.length >= 3 && !isDisallowedCandidate(l);
      });
      if (nextContentLine) {
        const candidate = nextContentLine
          .replace(/^[0-9]+[\s.\-]+/, '')
          .split(/\b8517\b|\b8518\b|\b[0-9]{4}\b|\b[0-9]+(?:\.[0-9]{2})?\s+[0-9]+/)[0]
          .trim();
        if (!isDisallowedCandidate(candidate)) {
          productName = candidate;
        }
      }
    }

    // Pattern B: Look for known tech brand + product phrase in line items
    if (!productName) {
      const techBrandRegex = /\b(NOTHING|APPLE|SAMSUNG|SONY|ONEPLUS|XIAOMI|REDMI|REALME|OPPO|VIVO|GOOGLE|DELL|HP|LENOVO|ASUS|ACER|BOAT|NOISE|JBL|BOSE|MARSHALL)\b/i;
      const productLine = lines.find((l) =>
        techBrandRegex.test(l) &&
        !/\b(?:LIMITED|PVT|LTD|RETAILER|DISTRIBUTOR|STORE|SHOP|MALL|AUTHORISED|DEALER|CUSTOMER|GSTIN)\b/i.test(l)
      );
      if (productLine) {
        // Strip line item index (e.g. "1 Nothing Phone (2a) 8517 1 23,999")
        const stripped = productLine
          .replace(/^[0-9]+[\s.\-]+/, '')
          .split(/\b8517\b|\b8518\b|\b[0-9]{4}\b|\b[0-9]+(?:\.[0-9]{2})?\s+[0-9]+/)[0]
          .trim();
        if (stripped.length >= 3) {
          productName = stripped;
        }
      }
    }

    if (productName) {
      productName = productName.replace(/\s+[0-9]{4,8}\s*$/, '').trim();
      const brandToken = productName.split(/\s+/)[0];
      if (brandToken && brandToken.length > 1) {
        brand = brandToken;
      }
      model = productName;
    }

    // 5. Serial Number & IMEI 1 / IMEI 2
    let serialNumber: string | null = null;
    let imei: string | null = null;
    let imei2: string | null = null;

    // Explicit IMEI anchors
    const imei1Match = text.match(/(?:IMEI\s*1|IMEI\s*NO|PRIMARY\s*IMEI|IMEI)[:\s\-]*([0-9]{15})\b/i);
    if (imei1Match) {
      const val = CrossFieldValidator.validateImei(imei1Match[1]);
      if (val.valid) imei = val.normalized || imei1Match[1];
    }

    const imei2Match = text.match(/(?:IMEI\s*2|SECONDARY\s*IMEI)[:\s\-]*([0-9]{15})\b/i);
    if (imei2Match) {
      const val = CrossFieldValidator.validateImei(imei2Match[1]);
      if (val.valid) imei2 = val.normalized || imei2Match[1];
    }

    // Fallback: standalone 15-digit number that passes Luhn and is not currency
    if (!imei) {
      const standalone15 = text.match(/\b([0-9]{15})\b/g);
      if (standalone15) {
        for (const num of standalone15) {
          const val = CrossFieldValidator.validateImei(num);
          if (val.valid && val.metadata?.luhnValid) {
            imei = val.normalized || num;
            break;
          }
        }
      }
    }

    const serialMatch = text.match(/(?:SERIAL\s*(?:NO|NUMBER|#)?|S\/N|SR\s*NO)[:\s\-]*([A-Z0-9\-_]{6,24})\b/i);
    if (serialMatch) {
      const candidateSerial = serialMatch[1].trim();
      // Guard: Serial cannot be pure date or currency
      if (!CrossFieldValidator.normalizeDate(candidateSerial) && candidateSerial !== imei) {
        serialNumber = candidateSerial;
      }
    }

    // 6. Warranty & Derived Expiry Date
    let warrantyMonths: number | null = null;
    let warrantyExpiry: string | null = null;
    const warMatch = text.match(/(?:WARRANTY|GUARANTEE)(?:\s*(?:PERIOD|DURATION|VALIDITY|COVERAGE))?[:\s\-]*([0-9]{1,2})\s*(?:MONTHS|YEARS|YEAR|YR|MTHS?)/i);
    if (warMatch) {
      const num = parseInt(warMatch[1], 10);
      const isYears = /year/i.test(warMatch[0]);
      warrantyMonths = isYears ? num * 12 : num;
    }
    if (warrantyMonths && invoiceDate) {
      warrantyExpiry = CrossFieldValidator.addMonthsToDate(invoiceDate, warrantyMonths);
    }

    // 7. Financial Breakdown via GrandTotalEngine
    const fin = GrandTotalEngine.extractFinancials(text);

    // Feed candidates into candidate engine if provided
    if (engine) {
      if (productName) {
        engine.addCandidate({
          field: 'productName',
          value: productName,
          normalizedValue: productName,
          provider: 'LayoutRegex',
          rawEvidence: productName,
          confidence: 0.92,
          validationStatus: 'VALID',
        });
      }
      if (sellerName) {
        engine.addCandidate({
          field: 'shopName',
          value: sellerName,
          normalizedValue: sellerName,
          provider: 'LayoutRegex',
          rawEvidence: sellerName,
          confidence: 0.94,
          validationStatus: 'VALID',
        });
      }
      if (sellerPhone) {
        engine.addCandidate({
          field: 'sellerPhone',
          value: sellerPhone,
          normalizedValue: sellerPhone,
          provider: 'LayoutRegex',
          rawEvidence: sellerPhone,
          confidence: 0.90,
          validationStatus: 'VALID',
        });
        engine.addCandidate({
          field: 'shopPhone',
          value: sellerPhone,
          normalizedValue: sellerPhone,
          provider: 'LayoutRegex',
          rawEvidence: sellerPhone,
          confidence: 0.90,
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
          confidence: 0.95,
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
          confidence: 0.95,
          validationStatus: 'VALID',
        });
      }
      if (warrantyExpiry) {
        engine.addCandidate({
          field: 'warrantyExpiry',
          value: warrantyExpiry,
          normalizedValue: warrantyExpiry,
          provider: 'LayoutRegex',
          rawEvidence: `${warrantyMonths} months from ${invoiceDate}`,
          confidence: 0.95,
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
      if (imei) {
        engine.addCandidate({
          field: 'imei',
          value: imei,
          normalizedValue: imei,
          provider: 'LayoutRegex',
          rawEvidence: imei,
          confidence: 0.98,
          validationStatus: 'VALID',
        });
      }
      if (serialNumber) {
        engine.addCandidate({
          field: 'serialNumber',
          value: serialNumber,
          normalizedValue: serialNumber,
          provider: 'LayoutRegex',
          rawEvidence: serialNumber,
          confidence: 0.95,
          validationStatus: 'VALID',
        });
      }
      // Note: sellerGstin is NOT added as candidate per data minimization
    }

    return {
      productName,
      brand,
      model,
      serialNumber,
      imei,
      imei2,
      invoiceNumber,
      invoiceDate,
      sellerName,
      sellerPhone,
      sellerGstin,
      buyerName,
      totalAmount: fin.grandTotal,
      subtotal: fin.subtotal,
      taxAmount: fin.taxAmount,
      warrantyMonths,
      warrantyExpiry,
    };
  }
}

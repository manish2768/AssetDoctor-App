/**
 * Asset Doctor — Dedicated Home Appliance Purchase Extractor
 *
 * Extracts structured appliance fields:
 * - Product Name, Brand, Model
 * - Capacity (Ton, Litres, Kg) & BEE Star Rating
 * - Serial Number (Machine / Compressor)
 * - Invoice Number & Date
 * - Seller & GSTIN
 * - Financial Breakdown via GrandTotalEngine
 * - Warranty Terms
 */

import { CrossFieldValidator } from '../engine/CrossFieldValidator';
import { GrandTotalEngine } from '../engine/GrandTotalEngine';
import { FieldCandidateEngine } from '../engine/FieldCandidateEngine';

export interface ExtractedApplianceData {
  productName: string | null;
  brand: string | null;
  model: string | null;
  capacity: string | null;
  starRating: string | null;
  serialNumber: string | null;
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

export class RealApplianceExtractor {
  public static extract(rawText: string, engine?: FieldCandidateEngine): ExtractedApplianceData {
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

    const top = lines.slice(0, 4).find((l) => !/^(?:TAX\s*INVOICE|RETAIL\s*INVOICE|GSTIN)/i.test(l));
    if (top) {
      sellerName = top.split(/—|–|-/)[0].trim();
    }
    const sellerMatch = text.match(/(?:SOLD\s*BY|SELLER|STORE\s*NAME|MERCHANT|DEALER|RETAILER)[:\s\-]+([A-Za-z0-9 ,.&'–—]+)/i);
    if (sellerMatch && (!sellerName || sellerName.length < 3)) {
      sellerName = sellerMatch[1].trim();
    }

    // Optional Seller Mobile
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
      const phoneStandalone = sellerHeaderText.match(/\b(?:\+?91[\s\-]*)?([6-9][0-9]{9})\b/);
      if (phoneStandalone) {
        const candidatePhone = phoneStandalone[1];
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
      text.match(/(?:INVOICE\s*(?:NO|NUMBER|#)?|BILL\s*NO|TAX\s*INVOICE\s*NO)[:\s\-]*([A-Z0-9\-/]+)/i);
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

    // 4. Product, Brand, Model & Specs
    let productName: string | null = null;
    let brand: string | null = null;
    let model: string | null = null;
    let capacity: string | null = null;
    let starRating: string | null = null;

    const isDisallowedCandidate = (cand: string): boolean => {
      if (!cand || cand.length < 3) return true;
      if (/^(?:OF\s*GOODS|ITEM|NAME|MODEL|DESCRIPTION|PARTICULARS|DETAILS|SERVICE\s*DETAILS)$/i.test(cand)) return true;
      if (/\b(?:model\s*town|nagar|colony|sector|vihar|road|street|marg|floor|building|address|pin\s*code|\b\d{6}\b)\b/i.test(cand)) return true;
      if (/\b(?:lucknow|delhi|mumbai|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|jaipur|chandigarh|noida|gurgaon|gurugram)\b/i.test(cand) && !/\b(?:edition|special)\b/i.test(cand)) return true;
      return false;
    };

    // Capacity detection e.g. "1.5 Ton", "260L", "7 Kg"
    const capMatch = text.match(/\b([0-9.]+\s*(?:TON|TONS|LITRE|LITRES|LTR|L|KG|KGS))\b/i);
    if (capMatch) capacity = capMatch[1].trim();

    // Star rating detection e.g. "5 Star", "3 Star"
    const starMatch = text.match(/\b([1-5]\s*STAR)\b/i);
    if (starMatch) starRating = starMatch[1].trim();

    // Appliance brand regex
    const applianceBrandRegex = /\b(VOLTAS|DAIKIN|HITACHI|BLUE\s*STAR|CARRIER|LLOYD|LG|SAMSUNG|WHIRLPOOL|GODREJ|HAFELE|BOSCH|IFB|HAVELLS|CROMPTON|KENT|EUREKA\s*FORBES|PANASONIC)\b/i;
    const bMatch = text.match(applianceBrandRegex);
    if (bMatch) brand = bMatch[1].trim();

    // Description match
    const descMatch = text.match(/(?:DESCRIPTION\s*(?:OF\s*GOODS)?|ITEM\s*DESCRIPTION|PRODUCT(?:\s*NAME)?|MODEL\s*(?:NO\.?|NUM(?:BER)?|#|NAME))[^\S\r\n]*[:\-][^\S\r\n]*([A-Za-z0-9\s()/\-+.]+)/i);
    if (descMatch) {
      const candidate = descMatch[1].split(/\n|HSN|QTY|RATE|SERIAL/i)[0].trim();
      if (!isDisallowedCandidate(candidate)) {
        productName = candidate;
      }
    }

    if (!productName) {
      const applianceLine = lines.find((l) => applianceBrandRegex.test(l) && !/^(?:SOLD\s*BY|SELLER|AUTHORISED|DEALER|RETAILER)/i.test(l));
      if (applianceLine) {
        const stripped = applianceLine.replace(/^[0-9]+\s+/, '').split(/\b8415\b|\b8418\b|\b[0-9]{4}\b|\b[0-9]+(?:\.[0-9]{2})?\s+[0-9]+/)[0].trim();
        if (stripped.length >= 3) {
          productName = stripped;
        }
      }
    }

    if (productName) {
      productName = productName.replace(/\s+[0-9]{4,8}\s*$/, '').trim();
      model = productName;
      if (!brand) {
        brand = productName.split(/\s+/)[0];
      }
    }

    // 5. Serial Number
    let serialNumber: string | null = null;
    const serialMatch = text.match(/(?:SERIAL\s*(?:NO|NUMBER|#)?|S\/N|SR\s*NO|INDOOR\s*S\/N|OUTDOOR\s*S\/N|COMPRESSOR\s*S\/N)[:\s\-]*([A-Z0-9\-_]{6,24})\b/i);
    if (serialMatch) {
      const cand = serialMatch[1].trim();
      if (!CrossFieldValidator.normalizeDate(cand)) {
        serialNumber = cand;
      }
    }

    // 6. Warranty
    let warrantyMonths: number | null = null;
    const warMatch = text.match(/(?:WARRANTY|GUARANTEE|COMPRESSOR\s*WARRANTY)[:\s\-]*([0-9]{1,2})\s*(?:MONTHS|YEARS|YEAR|YR|MTHS?)/i);
    if (warMatch) {
      const num = parseInt(warMatch[1], 10);
      const isYears = /year/i.test(warMatch[0]);
      warrantyMonths = isYears ? num * 12 : num;
    }

    // 7. Financial Breakdown
    const fin = GrandTotalEngine.extractFinancials(text);

    // Register candidates in engine if provided
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
      // Derived Warranty Expiry
      let warrantyExpiry: string | null = null;
      if (warrantyMonths && invoiceDate) {
        warrantyExpiry = CrossFieldValidator.addMonthsToDate(invoiceDate, warrantyMonths);
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

    const derivedWarrantyExpiry = warrantyMonths && invoiceDate
      ? CrossFieldValidator.addMonthsToDate(invoiceDate, warrantyMonths)
      : null;

    return {
      productName,
      brand,
      model,
      capacity,
      starRating,
      serialNumber,
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
      warrantyExpiry: derivedWarrantyExpiry,
    };
  }
}

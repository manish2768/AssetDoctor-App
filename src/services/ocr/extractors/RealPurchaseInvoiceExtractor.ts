/**
 * Asset Doctor — Dedicated Real Purchase Invoice Extractor
 *
 * Extracts structured fields from:
 * - Retail store receipts
 * - POS cash memos
 * - GST tax invoices & bills of supply
 * - Multi-line supermarket / departmental invoices
 * - General consumer merchandise & hardware invoices
 *
 * Implements the robust hierarchy:
 * 1. Explicit product/item/particulars name
 * 2. Primary line item description
 * 3. Largest/highest-value non-tax/non-shipping line item
 * 4. Description near item/product/model headings
 * 5. Model + brand combination
 *
 * Filters out tax lines (CGST, SGST, IGST), discounts, shipping, delivery,
 * payment modes (Cash, Card, UPI), and invoice footers.
 */

import { CrossFieldValidator } from '../engine/CrossFieldValidator';
import { GrandTotalEngine } from '../engine/GrandTotalEngine';
import { FieldCandidateEngine } from '../engine/FieldCandidateEngine';

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  code?: string | null;
  confidence: number;
}

export interface ExtractedPurchaseData {
  productName: string | null;
  brand: string | null;
  model: string | null;
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
  lineItems: ExtractedLineItem[];
}

const DISALLOWED_PRODUCT_PATTERNS = [
  /^(?:cgst|sgst|igst|vat|cess|gst|tax|taxes|service\s*tax)\b/i,
  /^(?:sub\s*total|taxable\s*value|taxable\s*amount|total\s*tax|net\s*taxable)\b/i,
  /^(?:grand\s*total|total\s*amount|invoice\s*total|net\s*total|net\s*amount|total\s*payable|amount\s*payable|balance\s*due|amount\s*paid|round\s*off)\b/i,
  /^(?:discount|rebate|scheme\s*discount|cashback|coupon|promo)\b/i,
  /^(?:shipping|delivery|freight|courier|transport|handling|packaging|convenience\s*fee)\b/i,
  /^(?:payment\s*mode|cash|credit\s*card|debit\s*card|upi|paytm|google\s*pay|phonepe|net\s*banking|cod)\b/i,
  /^(?:thank\s*you|visit\s*again|customer\s*care|terms\s*and\s*conditions|e\s*&\s*o\s*e|signature|authorized\s*signatory|original\s*for\s*recipient)\b/i,
  /^(?:tax\s*invoice|retail\s*invoice|bill\s*of\s*supply|cash\s*memo|delivery\s*challan)\b/i,
  /^(?:bill\s*to|ship\s*to|buyer|consignee|customer\s*name)\b/i,
  /\b(?:model\s*town|nagar|colony|sector|vihar|road|street|marg|floor|building|address|pin\s*code|\b\d{6}\b)\b/i,
  /\b(?:lucknow|delhi|mumbai|bengaluru|bangalore|hyderabad|chennai|kolkata|pune|ahmedabad|jaipur|chandigarh|noida|gurgaon|gurugram)\b/i,
  /\b(?:service\s*details|invoice\s*details|bill\s*details|customer\s*details|vehicle\s*details)\b/i,
];

function isDisallowedProductLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return true;
  for (const pattern of DISALLOWED_PRODUCT_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  // Check if pure numbers or date
  if (/^[\d,.\s/\\-]+$/.test(trimmed)) return true;
  return false;
}

export class RealPurchaseInvoiceExtractor {
  public static extract(rawText: string, engine?: FieldCandidateEngine): ExtractedPurchaseData {
    const text = rawText || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Seller / Vendor Name & Phone
    let sellerName: string | null = null;
    let sellerPhone: string | null = null;
    let sellerGstin: string | null = null;

    const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/);
    if (gstinMatch) {
      const val = CrossFieldValidator.validateGstin(gstinMatch[1]);
      if (val.valid) sellerGstin = val.normalized || gstinMatch[1];
    }

    // Top lines inspection (usually first 1-4 lines hold store name)
    const storeHeaderLine = lines.slice(0, 5).find((l) => {
      const upper = l.toUpperCase();
      return (
        !/^(?:TAX\s*INVOICE|RETAIL\s*INVOICE|BILL\s*OF\s*SUPPLY|CASH\s*MEMO|ORIGINAL|DUPLICATE|INVOICE\b|GSTIN|CIN|PAN)/i.test(upper) &&
        !/\b(?:BILL\s*TO|BUYER|CONSIGNEE|CUSTOMER|DATE|INVOICE\s*NO)\b/i.test(upper) &&
        l.replace(/[^A-Za-z]/g, '').length >= 3
      );
    });

    if (storeHeaderLine) {
      sellerName = storeHeaderLine.split(/—|–|-|\|/)[0].trim();
    }

    const explicitSellerMatch = text.match(/(?:SOLD\s*BY|SELLER|STORE(?:\s*NAME)?|MERCHANT|RETAILER|DEALER|VENDOR)[:\s\-]+([A-Za-z0-9 ,.&'–—]+)/i);
    if (explicitSellerMatch && (!sellerName || sellerName.length < 3)) {
      sellerName = explicitSellerMatch[1].split(/\n|GSTIN|CIN|PAN|PHONE|MOBILE|ADDRESS/i)[0].trim();
    }

    // Seller Phone
    const topLines = lines.slice(0, 8);
    const sellerHeaderLines = topLines.filter(
      (l) => !/\b(?:BILL\s*TO|BUYER|CONSIGNEE|CUSTOMER(?:\s*NAME|\s*:))\b/i.test(l)
    );
    const sellerHeaderText = sellerHeaderLines.join('\n');
    const phoneLabeledMatch = sellerHeaderText.match(
      /(?:PH(?:ONE)?|MOB(?:ILE)?|TEL|CONTACT|CALL)[:\s\-]+(?:\+?91[\s\-]*)?([6-9][0-9]{9})\b/i
    );
    if (phoneLabeledMatch) {
      const v = CrossFieldValidator.validateIndianPhone(phoneLabeledMatch[1]);
      if (v.valid) sellerPhone = v.normalized || phoneLabeledMatch[1];
    }

    // 2. Buyer Name
    let buyerName: string | null = null;
    const buyerMatch = text.match(/(?:BILL\s*TO|BUYER|CUSTOMER(?:\s*NAME)?|CONSIGNEE|SOLD\s*TO|NAME\s*OF\s*RECIPIENT)[:\s\-]*([A-Za-z\s.]+)/i);
    if (buyerMatch) {
      buyerName = buyerMatch[1].split(/\n|PHONE|MOBILE|ADDRESS|GSTIN/i)[0].trim();
    }

    // 3. Invoice / Bill Number & Date
    let invoiceNumber: string | null = null;
    let invoiceDate: string | null = null;

    const invMatch =
      text.match(/(?:INVOICE|BILL|TAX\s*INVOICE|RECEIPT|ORDER|CASH\s*MEMO|INV)[^\S\r\n]*(?:NO\.?|NUM(?:BER)?|#)[^\S\r\n]*[:\-#][^\S\r\n]*([A-Z0-9\-_/]+)/i) ||
      text.match(/(?:INVOICE\s*(?:NO\.?|NUMBER|#)|BILL\s*(?:NO\.?|NUMBER|#)|RECEIPT\s*(?:NO\.?|NUMBER|#)|ORDER\s*(?:NO\.?|NUMBER|#)|CASH\s*MEMO\s*(?:NO\.?|NUMBER|#)|TAX\s*INVOICE\s*(?:NO\.?|NUMBER|#)|INV\s*(?:NO\.?|#)|BILL\s*#)[:\s\-]+([A-Z0-9\-_/]+)/i);
    if (invMatch) {
      const rawInv = invMatch[1].trim();
      if (!CrossFieldValidator.normalizeDate(rawInv) && rawInv.length >= 2) {
        invoiceNumber = rawInv;
      }
    }

    const dateMatch =
      text.match(/(?:INVOICE\s*DATE|BILL\s*DATE|DATE\s*OF\s*ISSUE|PURCHASE\s*DATE|DATE)[:\s\-]*([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b20[1-3][0-9][/\-.][0-1]?[0-9][/\-.][0-3]?[0-9]\b|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i) ||
      text.match(/\b([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.]20[2-3][0-9]|20[1-3][0-9][/\-.][0-1]?[0-9][/\-.][0-3]?[0-9])\b/);
    if (dateMatch) {
      invoiceDate = CrossFieldValidator.normalizeDate(dateMatch[1]);
    }

    // 4. Line Items Parsing
    const lineItems: ExtractedLineItem[] = this.parseLineItems(lines);

    // 5. Product Name Selection via Robust Hierarchy
    let productName: string | null = null;
    let brand: string | null = null;
    let model: string | null = null;

    // HIERARCHY LEVEL 1: Explicit labeled product/item/particulars
    const explicitProductMatch = text.match(
      /(?:PRODUCT\s*NAME|ITEM\s*NAME|PRODUCT\s*DESCRIPTION|ITEM\s*DESCRIPTION|PARTICULARS|DESCRIPTION\s*OF\s*GOODS|COMMODITY|PRODUCT|ITEM|MODEL)[:\s\-]+([A-Za-z0-9\s()/\-+.,&]+)/i
    );
    if (explicitProductMatch) {
      const candidate = explicitProductMatch[1].split(/\n|HSN|SAC|QTY|RATE|AMOUNT|TAX|PRICE|SERIAL/i)[0].trim();
      if (!isDisallowedProductLine(candidate) && candidate.length >= 3) {
        productName = candidate;
      }
    }

    // HIERARCHY LEVEL 2 & 3: Primary line item (highest value non-tax/non-shipping)
    if (!productName && lineItems.length > 0) {
      const sortedItems = [...lineItems].sort((a, b) => (b.amount || 0) - (a.amount || 0));
      const bestItem = sortedItems.find((item) => !isDisallowedProductLine(item.description));
      if (bestItem) {
        productName = bestItem.description;
      }
    }

    // HIERARCHY LEVEL 4: Table header proximity ("Particulars" / "Item" / "Description" table column)
    if (!productName) {
      const tableHeaderIdx = lines.findIndex((l) =>
        /\b(?:PARTICULARS|DESCRIPTION|ITEMS?|ITEM\s*NAME|PRODUCT)\b/i.test(l) &&
        /\b(?:QTY|QUANTITY|RATE|PRICE|AMOUNT)\b/i.test(l)
      );
      if (tableHeaderIdx >= 0) {
        const afterHeader = lines.slice(tableHeaderIdx + 1, tableHeaderIdx + 8);
        for (const line of afterHeader) {
          if (!isDisallowedProductLine(line) && line.length >= 3) {
            const cleaned = line.replace(/^[0-9]+[\s.\-]+/, '').split(/\b[0-9]+(?:\.[0-9]{2})?\s+[0-9]+/)[0].trim();
            if (!isDisallowedProductLine(cleaned) && cleaned.length >= 3) {
              productName = cleaned;
              break;
            }
          }
        }
      }
    }

    // HIERARCHY LEVEL 5: Brand detection in text
    const genericBrandMatch = text.match(
      /\b(APPLE|SAMSUNG|SONY|LG|DELL|HP|LENOVO|ASUS|ACER|BOAT|NOISE|JBL|BOSE|NOTHING|ONEPLUS|XIAOMI|REALME|OPPO|VIVO|HAVELLS|CROMPTON|BAJAJ|PHILIPS|PRESTIGE|BUTTERFLY|MILTON|TITAN|PUMA|NIKE|ADIDAS|BATA|WOODLAND|WIPRO|HONEYWELL)\b/i
    );
    if (genericBrandMatch) {
      brand = genericBrandMatch[1].toUpperCase();
    }

    if (!productName && brand) {
      const brandLine = lines.find((l) => new RegExp(`\\b${brand}\\b`, 'i').test(l) && !isDisallowedProductLine(l));
      if (brandLine) {
        const candidate = brandLine.replace(/^[0-9]+[\s.\-]+/, '').trim();
        if (candidate.length >= 3) {
          productName = candidate;
        }
      }
    }

    if (productName) {
      model = productName;
      if (!brand) {
        const firstWord = productName.split(/\s+/)[0];
        if (firstWord && firstWord.length > 2 && /^[A-Z][a-zA-Z0-9]+$/.test(firstWord)) {
          brand = firstWord.toUpperCase();
        }
      }
    }

    // 6. Serial Number / IMEI
    let serialNumber: string | null = null;
    const serialMatch = text.match(/(?:SERIAL\s*(?:NO\.?|NUMBER|#)?|S\/N|SR\s*NO\.?|BARCODE)[:\s\-]*([A-Z0-9\-_]{6,24})\b/i);
    if (serialMatch) {
      const candidate = serialMatch[1].trim();
      if (!CrossFieldValidator.normalizeDate(candidate) && candidate !== invoiceNumber) {
        serialNumber = candidate;
      }
    }

    // 7. Warranty Months & Derived Expiry
    let warrantyMonths: number | null = null;
    let warrantyExpiry: string | null = null;
    const warMatch = text.match(/(?:WARRANTY|GUARANTEE)(?:\s*(?:PERIOD|DURATION|VALIDITY|COVERAGE))?[:\s\-]*([0-9]{1,2})\s*(?:MONTHS|YEARS|YEAR|YR|MTHS?)/i);
    if (warMatch) {
      const num = parseInt(warMatch[1], 10);
      const isYears = /year/i.test(warMatch[0]);
      warrantyMonths = isYears ? num * 12 : num;
      if (warrantyMonths && invoiceDate) {
        warrantyExpiry = CrossFieldValidator.addMonthsToDate(invoiceDate, warrantyMonths);
      }
    }

    // 8. Financials via GrandTotalEngine
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
          confidence: 0.94,
          validationStatus: 'VALID',
        });
        engine.addCandidate({
          field: 'assetName',
          value: productName,
          normalizedValue: productName,
          provider: 'LayoutRegex',
          rawEvidence: productName,
          confidence: 0.94,
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
          confidence: 0.90,
          validationStatus: 'VALID',
        });
        engine.addCandidate({
          field: 'vendor',
          value: sellerName,
          normalizedValue: sellerName,
          provider: 'LayoutRegex',
          rawEvidence: sellerName,
          confidence: 0.90,
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
          confidence: 0.92,
          validationStatus: 'VALID',
        });
      }

      if (buyerName) {
        engine.addCandidate({
          field: 'customerName',
          value: buyerName,
          normalizedValue: buyerName,
          provider: 'LayoutRegex',
          rawEvidence: buyerName,
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
        engine.addCandidate({
          field: 'purchaseDate',
          value: invoiceDate,
          normalizedValue: invoiceDate,
          provider: 'LayoutRegex',
          rawEvidence: invoiceDate,
          confidence: 0.95,
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
          confidence: 0.93,
          validationStatus: 'VALID',
        });
      }

      if (brand) {
        engine.addCandidate({
          field: 'brand',
          value: brand,
          normalizedValue: brand,
          provider: 'LayoutRegex',
          rawEvidence: brand,
          confidence: 0.92,
          validationStatus: 'VALID',
        });
      }

      if (warrantyExpiry) {
        engine.addCandidate({
          field: 'warrantyExpiry',
          value: warrantyExpiry,
          normalizedValue: warrantyExpiry,
          provider: 'LayoutRegex',
          rawEvidence: warrantyExpiry,
          confidence: 0.90,
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
    }

    return {
      productName,
      brand,
      model,
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
      warrantyExpiry,
      lineItems,
    };
  }

  /**
   * Helper to parse multi-line table rows into line items.
   */
  private static parseLineItems(lines: string[]): ExtractedLineItem[] {
    const items: ExtractedLineItem[] = [];

    const headerIdx = lines.findIndex((l) =>
      /\b(?:DESCRIPTION|PARTICULARS|ITEMS?|ITEM\s*NAME|PRODUCT)\b/i.test(l) &&
      /\b(?:QTY|QUANTITY|RATE|PRICE|AMOUNT|TOTAL)\b/i.test(l)
    );

    const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;
    const endIdx = lines.findIndex((l, idx) => idx > startIdx && /\b(?:SUB\s*TOTAL|TOTAL\s*TAX|GRAND\s*TOTAL|NET\s*TOTAL|TOTAL|AMOUNT\s*PAYABLE)\b/i.test(l));
    const sliceEnd = endIdx > startIdx ? endIdx : Math.min(lines.length, startIdx + 15);

    for (let i = startIdx; i < sliceEnd; i++) {
      const line = lines[i];
      if (isDisallowedProductLine(line)) continue;

      const match = line.match(/^([A-Za-z0-9\s()/\-+.,&]+?)\s+(?:([0-9]+)\s+)?(?:([0-9,]+(?:\.[0-9]{2})?)\s+)?([0-9,]+(?:\.[0-9]{2})?)$/);
      if (match) {
        const desc = match[1].replace(/^[0-9]+[\s.\-]+/, '').trim();
        if (!isDisallowedProductLine(desc) && desc.length >= 3) {
          const qty = match[2] ? parseInt(match[2], 10) : 1;
          const rate = match[3] ? GrandTotalEngine.parseAmount(match[3]) : null;
          const amt = match[4] ? GrandTotalEngine.parseAmount(match[4]) : rate;
          items.push({
            description: desc,
            quantity: qty,
            unitPrice: rate,
            amount: amt,
            confidence: 0.90,
          });
        }
      } else {
        if (headerIdx >= 0 && line.length >= 4 && !isDisallowedProductLine(line)) {
          const stripped = line.replace(/^[0-9]+[\s.\-]+/, '').trim();
          if (stripped.length >= 3 && !isDisallowedProductLine(stripped)) {
            items.push({
              description: stripped,
              quantity: 1,
              unitPrice: null,
              amount: null,
              confidence: 0.75,
            });
          }
        }
      }
    }

    return items;
  }
}

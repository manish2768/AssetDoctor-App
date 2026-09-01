import { type ExtractedField, createNotFoundField, createVerifiedField } from '../core/OcrEvidence.ts';
import { OcrFieldNormalizer } from '../core/OcrFieldNormalizer.ts';

export interface SalesInvoiceFields {
  sellerName: ExtractedField<string | null>;
  sellerGstin: ExtractedField<string | null>;
  buyerName: ExtractedField<string | null>;
  invoiceNumber: ExtractedField<string | null>;
  invoiceDate: ExtractedField<string | null>;
  productName: ExtractedField<string | null>;
  brand: ExtractedField<string | null>;
  model: ExtractedField<string | null>;
  serialNumber: ExtractedField<string | null>;
  imei: ExtractedField<string | null>;
  quantity: ExtractedField<number | null>;
  unitPrice: ExtractedField<number | null>;
  taxAmount: ExtractedField<number | null>;
  totalAmount: ExtractedField<number | null>;
  warrantyMonths: ExtractedField<number | null>;
  warrantyExpiryDate: ExtractedField<string | null>;
}

export class SalesInvoiceExtractor {
  public static extract(rawText: string): SalesInvoiceFields {
    const text = rawText || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let sellerName: ExtractedField<string | null> = createNotFoundField();
    let sellerGstin: ExtractedField<string | null> = createNotFoundField();

    const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/);
    if (gstinMatch) {
      sellerGstin = createVerifiedField(gstinMatch[1], 0.99, gstinMatch[0]);
    }

    const sellerMatch = text.match(/(?:SOLD\s*BY|SELLER|STORE\s*NAME|MERCHANT|DEALER)[:\s\-]*([A-Za-z0-9\s\.\,\&]+)/i);
    if (sellerMatch) {
      sellerName = createVerifiedField(sellerMatch[1].trim(), 0.95, sellerMatch[0]);
    } else if (lines.length > 0) {
      const top = lines.slice(0, 3).find(l => !/^(?:TAX\s*INVOICE|RETAIL\s*INVOICE|GSTIN)/i.test(l));
      if (top) sellerName = createVerifiedField(top, 0.85, top);
    }

    let buyerName: ExtractedField<string | null> = createNotFoundField();
    const buyerMatch = text.match(/(?:BILL\s*TO|BUYER|CUSTOMER\s*NAME|CONSIGNEE|SOLD\s*TO)[:\s\-]*([A-Za-z\s\.]+)/i);
    if (buyerMatch) {
      buyerName = createVerifiedField(buyerMatch[1].trim(), 0.95, buyerMatch[0]);
    }

    let invoiceNumber: ExtractedField<string | null> = createNotFoundField();
    let invoiceDate: ExtractedField<string | null> = createNotFoundField();

    const invMatch = text.match(/(?:INVOICE\s*(?:NO|NUMBER)?|BILL\s*NO)[:\s\-]*([A-Z0-9\-\/]+)/i);
    if (invMatch) {
      invoiceNumber = createVerifiedField(invMatch[1].trim(), 0.98, invMatch[0]);
    }

    const dateMatch = text.match(/(?:DATE|INVOICE\s*DATE|BILL\s*DATE)[:\s\-]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-3][0-9])/i)
      || text.match(/\b([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.]20[2-3][0-9])\b/);
    if (dateMatch) {
      const normDate = OcrFieldNormalizer.normalizeDate(dateMatch[1]);
      if (normDate) invoiceDate = createVerifiedField(normDate, 0.98, dateMatch[0]);
    }

    let productName: ExtractedField<string | null> = createNotFoundField();
    let brand: ExtractedField<string | null> = createNotFoundField();
    let model: ExtractedField<string | null> = createNotFoundField();

    const descMatch = text.match(/(?:DESCRIPTION\s*OF\s*GOODS|ITEM\s*DESCRIPTION|PRODUCT|DESCRIPTION)[:\s\-]*([A-Za-z0-9\s\(\)\-\/\+]+)/i)
      || text.match(/\b(NOTHING\s*PHONE\s*\(?2A?\)?|IPHONE\s*[0-9]+(?:\s*PRO)?|VOLTAS\s*1\.5\s*TON\s*SPLIT\s*AC|LG\s*260L\s*REFRIGERATOR|SAMSUNG\s*55\s*INCH\s*4K\s*TV|HP\s*PAVILION\s*LAPTOP)\b/i);
    if (descMatch) {
      const p = descMatch[1].trim();
      productName = createVerifiedField(p, 0.95, descMatch[0]);
      const brandToken = p.split(/\s+/)[0];
      if (brandToken) brand = createVerifiedField(brandToken, 0.90, brandToken);
      model = createVerifiedField(p, 0.90, p);
    }

    let serialNumber: ExtractedField<string | null> = createNotFoundField();
    let imei: ExtractedField<string | null> = createNotFoundField();

    const imeiMatch = text.match(/\b(?:IMEI\s*[12]?|IMEI\s*NO)[:\s\-]*([0-9]{15})\b/i)
      || text.match(/\b([0-9]{15})\b/);
    if (imeiMatch) {
      const normImei = OcrFieldNormalizer.normalizeImei(imeiMatch[1]);
      if (normImei) imei = createVerifiedField(normImei, 0.99, imeiMatch[0]);
    }

    const serialMatch = text.match(/(?:SERIAL\s*(?:NO|NUMBER)?|S\/N|SR\s*NO)[:\s\-]*([A-Z0-9]{6,20})/i);
    if (serialMatch) {
      serialNumber = createVerifiedField(serialMatch[1].trim(), 0.97, serialMatch[0]);
    }

    let quantity: ExtractedField<number | null> = createNotFoundField();
    let unitPrice: ExtractedField<number | null> = createNotFoundField();
    let taxAmount: ExtractedField<number | null> = createNotFoundField();
    let totalAmount: ExtractedField<number | null> = createNotFoundField();

    const qtyMatch = text.match(/(?:QTY|QUANTITY)[:\s\-]*([0-9]+)\b/i);
    if (qtyMatch) quantity = createVerifiedField(parseInt(qtyMatch[1], 10), 0.95, qtyMatch[0]);

    const totalMatch = text.match(/(?:GRAND\s*TOTAL|TOTAL\s*AMOUNT|NET\s*AMOUNT|AMOUNT\s*PAYABLE|INVOICE\s*TOTAL)[:\s\-]*[₹Rs\s]*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (totalMatch) {
      const amt = OcrFieldNormalizer.normalizeAmount(totalMatch[1]);
      if (amt) totalAmount = createVerifiedField(amt, 0.98, totalMatch[0]);
    }

    let warrantyMonths: ExtractedField<number | null> = createNotFoundField();
    let warrantyExpiryDate: ExtractedField<string | null> = createNotFoundField();

    const warMatch = text.match(/(?:WARRANTY|GUARANTEE)[:\s\-]*([0-9]{1,2})\s*(?:MONTHS|YEARS|YEAR|YR|MTHS?)/i);
    if (warMatch) {
      const num = parseInt(warMatch[1], 10);
      const isYears = /year/i.test(warMatch[0]);
      const months = isYears ? num * 12 : num;
      warrantyMonths = createVerifiedField(months, 0.95, warMatch[0]);
    }

    return {
      sellerName,
      sellerGstin,
      buyerName,
      invoiceNumber,
      invoiceDate,
      productName,
      brand,
      model,
      serialNumber,
      imei,
      quantity,
      unitPrice,
      taxAmount,
      totalAmount,
      warrantyMonths,
      warrantyExpiryDate
    };
  }
}

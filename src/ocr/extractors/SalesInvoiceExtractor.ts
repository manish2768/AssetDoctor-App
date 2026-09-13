import { type ExtractedField, createNotFoundField, createVerifiedField } from '../core/OcrEvidence';
import { RealElectronicsExtractor } from '../../services/ocr/extractors/RealElectronicsExtractor';
import { GrandTotalEngine } from '../../services/ocr/engine/GrandTotalEngine';
import { CrossFieldValidator } from '../../services/ocr/engine/CrossFieldValidator';

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
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // If IMEI or electronics product terms exist, use RealElectronicsExtractor
    if (/\b(?:IMEI|SMARTPHONE|PHONE|LAPTOP|TABLET|HEADPHONE|TELEVISION)\b/i.test(text)) {
      const el = RealElectronicsExtractor.extract(text);
      return {
        sellerName: el.sellerName ? createVerifiedField(el.sellerName, 0.95, el.sellerName) : createNotFoundField(),
        sellerGstin: el.sellerGstin ? createVerifiedField(el.sellerGstin, 0.99, el.sellerGstin) : createNotFoundField(),
        buyerName: el.buyerName ? createVerifiedField(el.buyerName, 0.95, el.buyerName) : createNotFoundField(),
        invoiceNumber: el.invoiceNumber ? createVerifiedField(el.invoiceNumber, 0.98, el.invoiceNumber) : createNotFoundField(),
        invoiceDate: el.invoiceDate ? createVerifiedField(el.invoiceDate, 0.98, el.invoiceDate) : createNotFoundField(),
        productName: el.productName ? createVerifiedField(el.productName, 0.95, el.productName) : createNotFoundField(),
        brand: el.brand ? createVerifiedField(el.brand, 0.90, el.brand) : createNotFoundField(),
        model: el.model ? createVerifiedField(el.model, 0.95, el.model) : createNotFoundField(),
        serialNumber: el.serialNumber ? createVerifiedField(el.serialNumber, 0.97, el.serialNumber) : createNotFoundField(),
        imei: el.imei ? createVerifiedField(el.imei, 0.99, el.imei) : createNotFoundField(),
        quantity: createVerifiedField(1, 0.95, '1'),
        unitPrice: el.subtotal != null ? createVerifiedField(el.subtotal, 0.95, String(el.subtotal)) : createNotFoundField(),
        taxAmount: el.taxAmount != null ? createVerifiedField(el.taxAmount, 0.95, String(el.taxAmount)) : createNotFoundField(),
        totalAmount: el.totalAmount != null ? createVerifiedField(el.totalAmount, 0.99, String(el.totalAmount)) : createNotFoundField(),
        warrantyMonths: el.warrantyMonths != null ? createVerifiedField(el.warrantyMonths, 0.95, `${el.warrantyMonths} months`) : createNotFoundField(),
        warrantyExpiryDate: createNotFoundField(),
      };
    }

    // General Sales/Retail Invoice Extraction
    let sellerName: ExtractedField<string | null> = createNotFoundField();
    let sellerGstin: ExtractedField<string | null> = createNotFoundField();

    const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/);
    if (gstinMatch) {
      const val = CrossFieldValidator.validateGstin(gstinMatch[1]);
      if (val.valid) sellerGstin = createVerifiedField(val.normalized || gstinMatch[1], 0.99, gstinMatch[0]);
    }

    const sellerMatch = text.match(/(?:SOLD\s*BY|SELLER|STORE\s*NAME|MERCHANT|DEALER)[:\s\-]*([A-Za-z0-9\s.,&]+)/i);
    if (sellerMatch) {
      sellerName = createVerifiedField(sellerMatch[1].trim(), 0.95, sellerMatch[0]);
    } else if (lines.length > 0) {
      const top = lines.slice(0, 3).find((l) => !/^(?:TAX\s*INVOICE|RETAIL\s*INVOICE|GSTIN)/i.test(l));
      if (top) sellerName = createVerifiedField(top, 0.85, top);
    }

    let buyerName: ExtractedField<string | null> = createNotFoundField();
    const buyerMatch = text.match(/(?:BILL\s*TO|BUYER|CUSTOMER\s*NAME|CONSIGNEE|SOLD\s*TO)[:\s\-]*([A-Za-z\s.]+)/i);
    if (buyerMatch) {
      buyerName = createVerifiedField(buyerMatch[1].trim(), 0.95, buyerMatch[0]);
    }

    let invoiceNumber: ExtractedField<string | null> = createNotFoundField();
    let invoiceDate: ExtractedField<string | null> = createNotFoundField();

    const invMatch = text.match(/(?:INVOICE\s*(?:NO|NUMBER)?|BILL\s*NO)[:\s\-]*([A-Z0-9\-/]+)/i);
    if (invMatch) {
      const cand = invMatch[1].trim();
      if (!CrossFieldValidator.normalizeDate(cand)) {
        invoiceNumber = createVerifiedField(cand, 0.98, invMatch[0]);
      }
    }

    const dateMatch = text.match(/(?:DATE|INVOICE\s*DATE|BILL\s*DATE)[:\s\-]*([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.](?:20)?[1-3][0-9]|\b[0-3]?[0-9]\s+[A-Za-z]{3,9}\s+(?:20)?[1-3][0-9]\b)/i)
      || text.match(/\b([0-3]?[0-9][/\-.][0-1]?[0-9][/\-.]20[2-3][0-9])\b/);
    if (dateMatch) {
      const normDate = CrossFieldValidator.normalizeDate(dateMatch[1]);
      if (normDate) invoiceDate = createVerifiedField(normDate, 0.98, dateMatch[0]);
    }

    let productName: ExtractedField<string | null> = createNotFoundField();
    let brand: ExtractedField<string | null> = createNotFoundField();
    let model: ExtractedField<string | null> = createNotFoundField();

    const descMatch = text.match(/(?:DESCRIPTION\s*OF\s*GOODS|ITEM\s*DESCRIPTION|PRODUCT|DESCRIPTION)[:\s\-]*([A-Za-z0-9\s()/\-+]+)/i);
    if (descMatch) {
      const p = descMatch[1].trim();
      productName = createVerifiedField(p, 0.95, descMatch[0]);
      const brandToken = p.split(/\s+/)[0];
      if (brandToken) brand = createVerifiedField(brandToken, 0.90, brandToken);
      model = createVerifiedField(p, 0.90, p);
    }

    let serialNumber: ExtractedField<string | null> = createNotFoundField();
    const serialMatch = text.match(/(?:SERIAL\s*(?:NO|NUMBER)?|S\/N|SR\s*NO)[:\s\-]*([A-Z0-9\-_]{6,24})/i);
    if (serialMatch) {
      serialNumber = createVerifiedField(serialMatch[1].trim(), 0.97, serialMatch[0]);
    }

    let quantity: ExtractedField<number | null> = createNotFoundField();
    const qtyMatch = text.match(/(?:QTY|QUANTITY)[:\s\-]*([0-9]+)\b/i);
    if (qtyMatch) quantity = createVerifiedField(parseInt(qtyMatch[1], 10), 0.95, qtyMatch[0]);

    // Financials via GrandTotalEngine
    const fin = GrandTotalEngine.extractFinancials(text);
    let totalAmount: ExtractedField<number | null> = createNotFoundField();
    let unitPrice: ExtractedField<number | null> = createNotFoundField();
    let taxAmount: ExtractedField<number | null> = createNotFoundField();

    if (fin.grandTotal != null) {
      totalAmount = createVerifiedField(fin.grandTotal, fin.confidence, fin.rawEvidence);
    }
    if (fin.subtotal != null) {
      unitPrice = createVerifiedField(fin.subtotal, 0.95, String(fin.subtotal));
    }
    if (fin.taxAmount != null) {
      taxAmount = createVerifiedField(fin.taxAmount, 0.95, String(fin.taxAmount));
    }

    let warrantyMonths: ExtractedField<number | null> = createNotFoundField();
    const warMatch = text.match(/(?:WARRANTY|GUARANTEE)(?:\s*(?:PERIOD|DURATION|VALIDITY|COVERAGE))?[:\s\-]*([0-9]{1,2})\s*(?:MONTHS|YEARS|YEAR|YR|MTHS?)/i);
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
      imei: createNotFoundField(),
      quantity,
      unitPrice,
      taxAmount,
      totalAmount,
      warrantyMonths,
      warrantyExpiryDate: createNotFoundField(),
    };
  }
}

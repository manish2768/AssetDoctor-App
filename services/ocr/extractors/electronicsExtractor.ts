/**
 * Electronics purchase invoice extractor (phones, tablets, laptops, gadgets).
 * NEVER extracts vehicle registration / chassis / engine / odometer / PUC.
 */

import type { ExtractedField } from '../types.ts';
import { ServiceExtractor, createField } from './serviceExtractor.ts';
import {
  applyImeiValidation,
  extractLabeledGrandTotal,
  extractLabeledImei,
  extractLabeledTaxAmountWithEvidence,
  extractLabeledTaxAmount,
  isForbiddenFinancialToken,
  isIdentifierMoneyDigits,
} from '../fieldSafety.ts';

export interface ElectronicsPurchaseData {
  productName?: ExtractedField<string>;
  brand?: ExtractedField<string>;
  model?: ExtractedField<string>;
  serialNumber?: ExtractedField<string>;
  imei?: ExtractedField<string>;
  invoiceNumber?: ExtractedField<string>;
  invoiceDate?: ExtractedField<string>;
  sellerName?: ExtractedField<string>;
  buyerName?: ExtractedField<string>;
  purchasePrice?: ExtractedField<number>;
  taxAmount?: ExtractedField<number>;
  totalAmount?: ExtractedField<number>;
  gstin?: ExtractedField<string>;
  warrantyMonths?: ExtractedField<number>;
  warrantyExpiry?: ExtractedField<string>;
}

const PHONE_BRANDS =
  /\b(Nothing|Apple|Samsung|OnePlus|Xiaomi|Redmi|Realme|Oppo|Vivo|Google|Motorola|Nokia|iQOO|Poco|Honor|Asus|Sony)\b/i;

export class ElectronicsExtractor {
  public static extract(rawText: string): ElectronicsPurchaseData {
    const data: ElectronicsPurchaseData = {};
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

    const gstinMatch = rawText.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
    if (gstinMatch) {
      data.gstin = createField(gstinMatch[1].toUpperCase(), 0.98, gstinMatch[0], 'GSTIN', 'gstin_regex');
    }

    const sellerMatch =
      rawText.match(/(?:Seller|Sold\s*By|Merchant|Dealer|Store|Bill\s*From)[:\s.\-]*([A-Za-z0-9\s.&]{3,40})/i);
    if (sellerMatch) {
      const seller = sellerMatch[1].replace(/[\n\r]+/g, ' ').trim();
      if (seller.length >= 3 && !/invoice|tax|gst|total|date/i.test(seller)) {
        data.sellerName = createField(seller, 0.9, sellerMatch[0], 'Seller', 'seller_regex');
      }
    }
    if (!data.sellerName) {
      for (let i = 0; i < Math.min(lines.length, 8); i++) {
        const line = lines[i];
        if (/(pvt|ltd|retail|store|mobile|communications|infotech|traders)/i.test(line) && !/invoice|gstin|tax/i.test(line)) {
          data.sellerName = createField(line, 0.86, line, 'Header Seller', 'header_search');
          break;
        }
      }
    }

    const buyerMatch = rawText.match(/(?:Buyer|Bill\s*To|Customer\s*Name|Ship\s*To)[:\s.\-]*([A-Za-z\s.]{3,35})/i);
    if (buyerMatch) {
      const name = buyerMatch[1].replace(/[\n\r]+/g, ' ').trim();
      if (name.length > 2 && !/invoice|tax|date|gst/i.test(name)) {
        data.buyerName = createField(name, 0.9, buyerMatch[0], 'Buyer', 'buyer_regex');
      }
    }

    const invMatch = rawText.match(/(?:Invoice\s*(?:Number|No|#)|Bill\s*No|Inv\s*No)[:\s.\-]*([A-Za-z0-9\/\-_]+)/i);
    if (invMatch && !/^(?:no|date|total|tax)$/i.test(invMatch[1])) {
      data.invoiceNumber = createField(invMatch[1].trim(), 0.93, invMatch[0], 'Invoice Number', 'invoice_no_regex');
    }

    const dateMatch = rawText.match(
      /(?:Invoice\s*Date|Order\s*Date|Purchase\s*Date|Date)[:\s.\-]*(\d{1,2}[\/\-.](?:\d{1,2}|[A-Za-z]{3,9})[\/\-.]\d{2,4})/i,
    );
    if (dateMatch) {
      const norm = ServiceExtractor.normalizeDate(dateMatch[1]);
      if (norm) data.invoiceDate = createField(norm, 0.94, dateMatch[0], 'Invoice Date', 'date_regex');
    }

    const labelledImei = extractLabeledImei(rawText);
    if (labelledImei.value) {
      data.imei = createField(
        labelledImei.value,
        labelledImei.luhnValid ? 0.97 : 0.54,
        labelledImei.evidence,
        'IMEI',
        'imei_regex',
        labelledImei.luhnValid ? undefined : 'LUHN_CHECKSUM_FAILED',
      );
      applyImeiValidation(data.imei);
    }

    const serialMatch = rawText.match(/(?:Serial\s*(?:No|Number)|S\/N|SN)[:\s.\-]*([A-Za-z0-9\-\/]{6,25})/i);
    if (serialMatch) {
      const serial = serialMatch[1].trim();
      if (!/imei/i.test(serial)) {
        data.serialNumber = createField(serial, 0.93, serialMatch[0], 'Serial Number', 'serial_regex');
      }
    }

    const brandMatch = rawText.match(PHONE_BRANDS);
    if (brandMatch) {
      data.brand = createField(brandMatch[1] || brandMatch[0], 0.92, brandMatch[0], 'Brand', 'brand_regex');
    }

    const productMatch =
      rawText.match(
        /(?:Item|Description|Product|Model)[:\s.\-]*([^\n\r]{4,60}?(?:Phone|iPhone|Galaxy|Pixel|OnePlus|Nothing|MacBook|iPad|Tab)[^\n\r]{0,30})/i,
      ) ||
      rawText.match(
        /\b((?:Nothing\s+Phone[^\n\r]{0,24}|iPhone[^\n\r]{0,20}|Samsung\s+Galaxy[^\n\r]{0,24}|OnePlus[^\n\r]{0,20}|Google\s+Pixel[^\n\r]{0,16}|Redmi[^\n\r]{0,20}|Realme[^\n\r]{0,20}))\b/i,
      );
    if (productMatch) {
      const name = (productMatch[1] || productMatch[0]).replace(/[\n\r]+/g, ' ').trim();
      if (name.length >= 3 && !/invoice|total|tax|gstin|amount/i.test(name)) {
        data.productName = createField(name, 0.93, productMatch[0], 'Product', 'product_regex');
        data.model = createField(name, 0.9, productMatch[0], 'Model', 'product_regex');
      }
    }

    const labeledTotal = extractLabeledGrandTotal(rawText);
    if (labeledTotal.amount != null && labeledTotal.amount > 0 && !isForbiddenFinancialToken(labeledTotal.amount)) {
      const imeiDigits = String(data.imei?.value || '').replace(/\D/g, '');
      if (!imeiDigits || String(labeledTotal.amount).replace(/\D/g, '') !== imeiDigits) {
        data.totalAmount = createField(labeledTotal.amount, 0.96, labeledTotal.evidence, 'Grand Total', 'labeled_grand_total');
        data.purchasePrice = createField(labeledTotal.amount, 0.94, labeledTotal.evidence, 'Purchase Price', 'labeled_grand_total');
        data.totalAmount.validationResult = 'PASS';
      }
    }

    const tax = extractLabeledTaxAmountWithEvidence(rawText);
    if (tax.amount != null && !isForbiddenFinancialToken(tax.amount) && !isIdentifierMoneyDigits(String(tax.amount))) {
      const imeiDigits = String(data.imei?.value || '').replace(/\D/g, '');
      if (!imeiDigits || String(tax.amount).replace(/\D/g, '') !== imeiDigits) {
        data.taxAmount = createField(tax.amount, 0.88, tax.evidence, 'Tax Amount', 'tax_regex');
      }
    }

    const warMatch = rawText.match(/([0-9]{1,2})\s*(?:Months?|Years?)\s*(?:Warranty|Guarantee)/i);
    if (warMatch) {
      const count = parseInt(warMatch[1], 10);
      const months = /year/i.test(warMatch[0]) ? count * 12 : count;
      data.warrantyMonths = createField(months, 0.9, warMatch[0], 'Warranty Period', 'warranty_regex');
    }

    return data;
  }
}

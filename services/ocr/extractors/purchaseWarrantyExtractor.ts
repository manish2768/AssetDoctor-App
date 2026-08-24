/**
 * Purchase Invoice, Appliance & Warranty Document Extractor
 * Supports Consumer Electronics (TV, AC, Fridge, Laptop) and Warranty/AMC contracts.
 */

import type {
  PurchaseInvoiceData,
  WarrantyDocumentData,
  ApplianceDocumentData,
  ExtractedField,
  VerificationConfidenceTier
} from '../types.ts';
import { ServiceExtractor } from './serviceExtractor.ts';

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

export class PurchaseWarrantyExtractor {
  /**
   * Extracts Purchase Invoices
   */
  public static extractPurchaseInvoice(rawText: string): PurchaseInvoiceData {
    const data: PurchaseInvoiceData = {};

    // 1. SELLER / MERCHANT
    const sellerMatch = rawText.match(/(?:Seller|Sold\s*By|Merchant|Dealer|Store)[:\s\.\-]*([A-Za-z0-9\s\.\-]{3,35})/i) ||
                        rawText.match(/(?:Flipkart\s*India|Reliance\s*Retail|Croma|Vijay\s*Sales|Amazon\s*Seller)/i);
    if (sellerMatch) {
      data.sellerName = createField(sellerMatch[1]?.trim() || sellerMatch[0], 0.94, sellerMatch[0], 'Seller Name');
    }

    // 2. BUYER NAME
    const buyerMatch = rawText.match(/(?:Buyer|Bill\s*To|Customer\s*Name)[:\s\.\-]*([A-Za-z\s\.\-]{3,35})/i);
    if (buyerMatch) {
      data.buyerName = createField(buyerMatch[1].trim(), 0.91, buyerMatch[0], 'Buyer Name');
    }

    // 3. INVOICE NUMBER & DATE
    const invMatch = rawText.match(/(?:Invoice\s*Number|Invoice\s*No|Bill\s*No)[:\s\.\-]*([A-Za-z0-9\/\-_]+)/i);
    if (invMatch) {
      data.invoiceNumber = createField(invMatch[1].trim(), 0.95, invMatch[0], 'Invoice Number');
    }

    const dateMatch = rawText.match(/(?:Invoice\s*Date|Order\s*Date|Purchase\s*Date|Date)[:\s\.\-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (dateMatch) {
      const norm = ServiceExtractor.normalizeDate(dateMatch[1]);
      if (norm) data.invoiceDate = createField(norm, 0.95, dateMatch[0], 'Invoice Date');
    }

    // 4. ASSET NAME & BRAND & MODEL
    const brandMatch = rawText.match(/(?:Brand)[:\s\.\-]*([A-Za-z0-9\s\-]+)/i) ||
                       rawText.match(/\b(Samsung|LG|Sony|Apple|Daikin|Voltas|Whirlpool|Bosch|Dell|HP|Lenovo|TVS|Hyundai|Honda|Maruti|Tata)\b/i);
    if (brandMatch) {
      data.brand = createField(brandMatch[1]?.trim() || brandMatch[0], 0.93, brandMatch[0], 'Brand Extractor');
    }

    const serialMatch = rawText.match(/(?:Serial\s*No|Serial\s*Number|S\/N|IMEI)[:\s\.\-]*([A-Za-z0-9\/\-_]{6,25})/i);
    if (serialMatch) {
      data.serialNumber = createField(serialMatch[1].trim(), 0.96, serialMatch[0], 'Serial Number');
    }

    // 5. FINANCIAL AMOUNTS
    const totalMatch = rawText.match(/(?:Grand\s*Total|Total\s*Amount|Net\s*Amount|Final\s*Price|Total)[:\s\.\-₹Rs]*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
    if (totalMatch) {
      const amt = parseFloat(totalMatch[1].replace(/,/g, ''));
      if (!isNaN(amt) && amt > 0) {
        data.finalAmount = createField(amt, 0.96, totalMatch[0], 'Final Amount');
        data.purchasePrice = createField(amt, 0.95, totalMatch[0], 'Purchase Price');
      }
    }

    return data;
  }

  /**
   * Extracts Home Appliances & Consumer Electronics
   */
  public static extractAppliance(rawText: string): ApplianceDocumentData {
    const data: ApplianceDocumentData = {};

    let appType = 'Home Appliance';
    if (/refrigerator|fridge/i.test(rawText)) appType = 'Refrigerator';
    else if (/air\s*conditioner|split\s*ac|inverter\s*ac/i.test(rawText)) appType = 'Air Conditioner';
    else if (/smart\s*tv|oled\s*tv|qled\s*tv|television/i.test(rawText)) appType = 'Television';
    else if (/washing\s*machine/i.test(rawText)) appType = 'Washing Machine';
    else if (/microwave/i.test(rawText)) appType = 'Microwave';
    else if (/laptop|macbook/i.test(rawText)) appType = 'Laptop';
    else if (/inverter|battery/i.test(rawText)) appType = 'Inverter & Battery';

    data.applianceType = createField(appType, 0.96, appType, 'Appliance Category');

    const brandMatch = rawText.match(/\b(Samsung|LG|Sony|Apple|Daikin|Voltas|Whirlpool|Bosch|Dell|HP|Lenovo|Panasonic|Haier|Godrej|Lloyd|Blue\s*Star)\b/i);
    if (brandMatch) {
      data.brand = createField(brandMatch[0], 0.95, brandMatch[0], 'Appliance Brand');
    }

    const serialMatch = rawText.match(/(?:Serial\s*No|Serial\s*Number|S\/N)[:\s\.\-]*([A-Za-z0-9\/\-_]{6,25})/i);
    if (serialMatch) {
      data.serialNumber = createField(serialMatch[1].trim(), 0.96, serialMatch[0], 'Serial Number');
    }

    const dateMatch = rawText.match(/(?:Date|Invoice\s*Date|Purchase\s*Date)[:\s\.\-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (dateMatch) {
      const norm = ServiceExtractor.normalizeDate(dateMatch[1]);
      if (norm) data.purchaseDate = createField(norm, 0.94, dateMatch[0], 'Purchase Date');
    }

    const priceMatch = rawText.match(/(?:Grand\s*Total|Total\s*Amount|Amount|Price)[:\s\.\-₹Rs]*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
    if (priceMatch) {
      const amt = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (!isNaN(amt)) data.purchasePrice = createField(amt, 0.94, priceMatch[0], 'Purchase Price');
    }

    // Warranty Period
    const warMatch = rawText.match(/([0-9]{1,2})\s*(?:Months|Years|Year)\s*(?:Warranty|Guarantee)/i);
    if (warMatch) {
      const count = parseInt(warMatch[1], 10);
      const months = /year/i.test(warMatch[0]) ? count * 12 : count;
      data.warrantyMonths = createField(months, 0.93, warMatch[0], 'Warranty Period');
    }

    return data;
  }

  /**
   * Extracts Warranty & AMC Contracts
   */
  public static extractWarranty(rawText: string): WarrantyDocumentData {
    const data: WarrantyDocumentData = {};

    const brandMatch = rawText.match(/\b(Samsung|LG|Sony|Apple|Daikin|Voltas|Whirlpool|Bosch|Dell|HP|Lenovo|TVS|Hyundai|Honda|Maruti|Tata)\b/i);
    if (brandMatch) {
      data.brand = createField(brandMatch[0], 0.93, brandMatch[0], 'Warranty Brand');
    }

    const serialMatch = rawText.match(/(?:Serial\s*No|S\/N|Warranty\s*No|Certificate\s*No)[:\s\.\-]*([A-Za-z0-9\/\-_]{6,25})/i);
    if (serialMatch) {
      data.serialNumber = createField(serialMatch[1].trim(), 0.95, serialMatch[0], 'Serial Number');
      data.warrantyNumber = createField(serialMatch[1].trim(), 0.92, serialMatch[0], 'Warranty Number');
    }

    const startMatch = rawText.match(/(?:Start\s*Date|From|Effective\s*Date)[:\s\.\-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (startMatch) {
      const norm = ServiceExtractor.normalizeDate(startMatch[1]);
      if (norm) data.warrantyStartDate = createField(norm, 0.94, startMatch[0], 'Warranty Start Date');
    }

    const endMatch = rawText.match(/(?:End\s*Date|Expiry\s*Date|Valid\s*Till|Valid\s*Upto)[:\s\.\-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (endMatch) {
      const norm = ServiceExtractor.normalizeDate(endMatch[1]);
      if (norm) data.warrantyEndDate = createField(norm, 0.96, endMatch[0], 'Warranty End Date');
    }

    return data;
  }
}

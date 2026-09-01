/**
 * Purchase Invoice, Appliance & Warranty Document Extractor
 * Supports Consumer Electronics (TV, AC, Fridge, Laptop) and Warranty/AMC contracts.
 */

import type {
  PurchaseInvoiceData,
  WarrantyDocumentData,
  ApplianceDocumentData,
} from '../types.ts';
import { ServiceExtractor, createField } from './serviceExtractor.ts';
import {
  extractLabeledChassis,
  extractLabeledEngine,
  extractLabeledGrandTotal,
  extractLabeledRegistration,
  extractLabeledImei,
  applyImeiValidation,
  extractLabeledTaxableAmount,
  extractLabeledTaxAmount,
  isForbiddenFinancialToken,
  isIdentifierMoneyDigits,
  looksLikeImei,
} from '../fieldSafety.ts';

export class PurchaseWarrantyExtractor {
  /**
   * Extracts Purchase Invoices
   */
  public static extractPurchaseInvoice(rawText: string): PurchaseInvoiceData {
    const data: PurchaseInvoiceData = {};

    const sellerMatch = rawText.match(/(?:Seller|Sold\s*By|Merchant|Dealer|Store)[:\s.\-]*([A-Za-z0-9\s.\-]{3,35})/i) ||
                        rawText.match(/(?:Flipkart\s*India|Reliance\s*Retail|Croma|Vijay\s*Sales|Amazon\s*Seller)/i);
    if (sellerMatch) {
      data.sellerName = createField(sellerMatch[1]?.trim() || sellerMatch[0], 0.94, sellerMatch[0], 'Seller Name');
    }

    const buyerMatch = rawText.match(/(?:Buyer|Bill\s*To|Customer\s*Name)[:\s.\-]*([A-Za-z\s.\-]{3,35})/i);
    if (buyerMatch) {
      data.buyerName = createField(buyerMatch[1].trim(), 0.91, buyerMatch[0], 'Buyer Name');
    }

    const invMatch = rawText.match(/(?:Invoice\s*Number|Invoice\s*No|Bill\s*No)[:\s.\-]*([A-Za-z0-9\/\-_]+)/i);
    if (invMatch) {
      data.invoiceNumber = createField(invMatch[1].trim(), 0.95, invMatch[0], 'Invoice Number');
    }

    const dateMatch = rawText.match(/(?:Invoice\s*Date|Order\s*Date|Purchase\s*Date|Date)[:\s.\-]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
    if (dateMatch) {
      const norm = ServiceExtractor.normalizeDate(dateMatch[1]);
      if (norm) data.invoiceDate = createField(norm, 0.95, dateMatch[0], 'Invoice Date');
    }

    const brandMatch = rawText.match(/(?:Brand)[:\s.\-]*([A-Za-z0-9\s\-]+)/i) ||
                       rawText.match(/\b(Samsung|LG|Sony|Apple|Daikin|Voltas|Whirlpool|Bosch|Dell|HP|Lenovo|TVS|Hyundai|Honda|Maruti|Tata)\b/i);
    if (brandMatch) {
      data.brand = createField(brandMatch[1]?.trim() || brandMatch[0], 0.93, brandMatch[0], 'Brand Extractor');
    }

    const gstinMatch = rawText.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
    if (gstinMatch) {
      data.gstin = createField(gstinMatch[1].toUpperCase(), 0.98, gstinMatch[0], 'GSTIN');
    }

    const modelMatch = rawText.match(/(?:Model|Vehicle\s*Model|Vehicle\s*Name|Item|Description)[:\s.\-]*([^\n\r]+)/i);
    if (modelMatch) {
      const candidate = modelMatch[1].replace(/[\n\r]+/g, ' ').trim();
      if (candidate.length >= 3 && !/invoice|total|tax|date|customer|amount|gstin/i.test(candidate)) {
        data.assetName = createField(candidate, 0.92, modelMatch[0], 'Vehicle / Product');
        data.model = createField(candidate, 0.9, modelMatch[0], 'Model');
      }
    }

    const labelledReg = extractLabeledRegistration(rawText);
    if (labelledReg.value) {
      data.vehicleRegistration = createField(
        labelledReg.value,
        labelledReg.valid ? 0.96 : 0.62,
        labelledReg.evidence,
        'Registration',
      );
      data.vehicleRegistration.validationResult = labelledReg.valid ? 'PASS' : 'FAIL';
      if (!labelledReg.valid) {
        data.vehicleRegistration.status = 'NEEDS_REVIEW';
        data.vehicleRegistration.tier = 'NEEDS_REVIEW';
      }
    }

    const chassis = extractLabeledChassis(rawText);
    if (chassis) {
      data.vinOrChassis = createField(chassis, 0.96, chassis, 'Chassis Number');
    }

    const engine = extractLabeledEngine(rawText);
    if (engine) {
      data.engineNumber = createField(engine, 0.93, engine, 'Engine Number');
    }

    const serialMatch = rawText.match(/(?:Serial\s*No|Serial\s*Number|S\/N)[:\s.\-]*([A-Za-z0-9\/\-_]{6,25})/i);
    if (serialMatch && !/imei/i.test(serialMatch[0])) {
      data.serialNumber = createField(serialMatch[1].trim(), 0.96, serialMatch[0], 'Serial Number');
    }

    const imeiMatch = rawText.match(/(?:IMEI(?:\s*(?:No|Number|1|2))?|IMEI1)[:\s.\-]*([0-9]{15})\b/i);
    if (imeiMatch) {
      const parsed = extractLabeledImei(rawText);
      if (parsed.value) {
        data.imei = createField(parsed.value, parsed.luhnValid ? 0.97 : 0.54, parsed.evidence, 'IMEI', 'imei_regex');
        applyImeiValidation(data.imei);
      }
    }

    const labeledTotal = extractLabeledGrandTotal(rawText);
    if (labeledTotal.amount != null && labeledTotal.amount > 0 && !isForbiddenFinancialToken(labeledTotal.amount)) {
      data.finalAmount = createField(labeledTotal.amount, 0.96, labeledTotal.evidence, 'Final Amount');
      data.purchasePrice = createField(labeledTotal.amount, 0.95, labeledTotal.evidence, 'Purchase Price');
      data.finalAmount.validationResult = 'PASS';
    }

    const taxAmt = extractLabeledTaxAmount(rawText);
    if (taxAmt != null && !isForbiddenFinancialToken(taxAmt)) {
      data.taxAmount = createField(taxAmt, 0.9, String(taxAmt), 'GST / Tax');
    }

    const taxable = extractLabeledTaxableAmount(rawText);
    if (taxable != null && !isForbiddenFinancialToken(taxable)) {
      data.taxableAmount = createField(taxable, 0.88, String(taxable), 'Taxable Amount');
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

    const productMatch = rawText.match(/(?:Product|Item|Description)[:\t .\-]*([^\r\n]{3,60})/i);
    if (productMatch) {
      data.productName = createField(productMatch[1].trim(), 0.95, productMatch[0], 'Product Name');
    }

    const brandMatch = rawText.match(/\b(Samsung|LG|Sony|Apple|Daikin|Voltas|Whirlpool|Bosch|Dell|HP|Lenovo|Panasonic|Haier|Godrej|Lloyd|Blue\s*Star)\b/i);
    if (brandMatch) {
      data.brand = createField(brandMatch[0], 0.95, brandMatch[0], 'Appliance Brand');
    }

    const serialMatch = rawText.match(/(?:Serial\s*No|Serial\s*Number|S\/N)[:\s.\-]*([A-Za-z0-9\/\-_]{6,25})/i);
    if (serialMatch && !looksLikeImei(serialMatch[1])) {
      data.serialNumber = createField(serialMatch[1].trim(), 0.96, serialMatch[0], 'Serial Number');
    }

    const labeledTotal = extractLabeledGrandTotal(rawText);
    if (labeledTotal.amount != null && labeledTotal.amount > 0 && !isForbiddenFinancialToken(labeledTotal.amount)) {
      data.purchasePrice = createField(labeledTotal.amount, 0.96, labeledTotal.evidence, 'Appliance Price');
    }

    const dateMatch = rawText.match(/(?:Invoice\s*Date|Purchase\s*Date|Date)[:\s.\-]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
    if (dateMatch) {
      const norm = ServiceExtractor.normalizeDate(dateMatch[1]);
      if (norm) data.purchaseDate = createField(norm, 0.94, dateMatch[0], 'Purchase Date');
    }

    const warMatch = rawText.match(/([0-9]{1,2})\s*(?:Months?|Years?)\s*(?:Warranty|Guarantee)/i);
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

    const certMatch = rawText.match(/(?:Certificate\s*No|Warranty\s*No|Plan\s*No|Policy\s*No)[:\s.\-]*([A-Za-z0-9\/\-_]{6,30})/i);
    if (certMatch) {
      data.warrantyNumber = createField(certMatch[1].trim(), 0.95, certMatch[0], 'Warranty Certificate Number');
    }

    const serialMatch = rawText.match(/(?:Serial\s*No|Serial\s*Number|S\/N|Product\s*S\/N)[:\s.\-]*([A-Za-z0-9\/\-_]{6,25})/i);
    if (serialMatch && !looksLikeImei(serialMatch[1])) {
      data.serialNumber = createField(serialMatch[1].trim(), 0.95, serialMatch[0], 'Serial Number');
    } else if (certMatch && !data.serialNumber) {
      data.serialNumber = createField(certMatch[1].trim(), 0.88, certMatch[0], 'Certificate/Serial');
    }

    const totalMatch = rawText.match(/(?:Grand\s*Total|Total\s*Amount|Net\s*Amount|Final\s*Price|Total\s*Price|Plan\s*Price)[:\s.\-₹Rs]*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i);
    if (totalMatch && !isIdentifierMoneyDigits(totalMatch[1]) && !isForbiddenFinancialToken(totalMatch[1])) {
      const amt = parseFloat(totalMatch[1].replace(/,/g, ''));
      if (!isNaN(amt) && amt > 0) {
        (data as any).totalAmount = createField(amt, 0.96, totalMatch[0], 'Total Amount');
      }
    } else {
      // Fallback: shared labeled-grand-total logic also handles bare "Total:",
      // "Final Amount:", "Total Price:", etc., so a warranty card that pairs a
      // serial with a single total still yields an amount.
      const labeledTotal = extractLabeledGrandTotal(rawText);
      if (labeledTotal.amount != null && labeledTotal.amount > 0 && !isForbiddenFinancialToken(labeledTotal.amount)) {
        (data as any).totalAmount = createField(labeledTotal.amount, 0.96, labeledTotal.evidence, 'Total Amount');
      }
    }

    const startMatch = rawText.match(/(?:Start\s*Date|From|Effective\s*Date|Date)[:\s.\-]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
    if (startMatch) {
      const norm = ServiceExtractor.normalizeDate(startMatch[1]);
      if (norm) data.warrantyStartDate = createField(norm, 0.94, startMatch[0], 'Warranty Start Date');
    }

    const endMatch = rawText.match(/(?:End\s*Date|Expiry\s*Date|Valid\s*Till|Valid\s*Upto)[:\s.\-]*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i);
    if (endMatch) {
      const norm = ServiceExtractor.normalizeDate(endMatch[1]);
      if (norm) data.warrantyEndDate = createField(norm, 0.96, endMatch[0], 'Warranty End Date');
    }

    return data;
  }
}

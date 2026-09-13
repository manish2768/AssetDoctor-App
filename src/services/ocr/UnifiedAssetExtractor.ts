/**
 * Asset Doctor — Unified Asset Extractor
 *
 * Deterministic text → structured asset extractor.
 * Strictly focused on Personal Asset & Warranty Management.
 * Zero accounting, tax, or ledger clutter.
 */

import {
  DocumentCategory,
  UnifiedAssetPayload,
  OcrExtractionResponse,
  WarrantySource,
  ALLOWED_UNIFIED_ASSET_KEYS,
} from '../../types/assetDocument';

// Curated list of known consumer & vehicle brands
const CURATED_BRANDS: string[] = [
  // Tech & Electronics
  'Apple', 'Samsung', 'Sony', 'OnePlus', 'Google', 'Xiaomi', 'Redmi', 'Realme',
  'Oppo', 'Vivo', 'Nothing', 'Motorola', 'Asus', 'Lenovo', 'HP', 'Dell', 'Acer',
  'Boat', 'Noise', 'JBL', 'Bose', 'Sennheiser', 'Logitech', 'Canon', 'Nikon',
  // Appliances
  'LG', 'Whirlpool', 'Daikin', 'Voltas', 'Bosch', 'Siemens', 'IFB', 'Panasonic',
  'Hitachi', 'Carrier', 'Haier', 'Godrej', 'Philips', 'Havells', 'Bajaj', 'Orient',
  'Crompton', 'Usha', 'Kent', 'Eureka Forbes', 'Blue Star', 'Prestige', 'Morphy Richards',
  // Vehicles
  'TVS', 'Royal Enfield', 'Honda', 'Hero', 'Bajaj', 'Yamaha', 'Suzuki', 'KTM',
  'Tata', 'Maruti Suzuki', 'Maruti', 'Hyundai', 'Mahindra', 'Toyota', 'Kia',
  'Volkswagen', 'Skoda', 'MG', 'Nissan', 'Renault', 'BMW', 'Mercedes', 'Audi',
  'Ather', 'Ola Electric', 'Ola', 'Tork', 'Revolt',
];

// Insurance Providers
const INSURANCE_PROVIDERS: string[] = [
  'ICICI Lombard', 'HDFC ERGO', 'Bajaj Allianz', 'Tata AIG', 'New India Assurance',
  'United India Insurance', 'National Insurance', 'Oriental Insurance', 'Star Health',
  'Care Health', 'Niva Bupa', 'SBI General', 'Reliance General', 'Digit Insurance',
  'Acko General Insurance', 'Acko',
];

export class UnifiedAssetExtractor {
  /**
   * Main entry point: transforms raw OCR text into a type-safe, canonical OcrExtractionResponse.
   */
  public static extract(rawText: string): OcrExtractionResponse {
    const t0 = Date.now();
    const text = (rawText || '').trim();
    const isReadable = text.length >= 10;

    if (!isReadable) {
      const emptyAsset: UnifiedAssetPayload = {
        documentCategory: 'GENERAL_BILL',
        confidenceScore: 0,
        rawTextLength: text.length,
      };
      return {
        success: false,
        category: 'GENERAL_BILL',
        asset: this.sanitizeToAllowlist(emptyAsset),
        rawText: text,
        isReadable: false,
        isComplete: false,
        needsReview: true,
        warnings: ['Scanned document has insufficient readable text.'],
        executionTimeMs: Date.now() - t0,
      };
    }

    // 1. Classification
    const category = this.classifyCategory(text);

    // 2. Base fields
    const purchaseDate = this.extractPurchaseDate(text);
    const totalAmount = this.extractTotalAmount(text);
    const invoiceNumber = this.extractInvoiceNumber(text);
    const merchantName = this.extractMerchantName(text);

    // 3. Category-specific extraction
    let brand = this.extractBrand(text);
    let model = this.extractModel(text, brand);
    const serialNumber = this.extractSerialNumber(text);
    const imei = category === 'ELECTRONICS' ? this.extractIMEI(text) : undefined;
    const vin = category === 'VEHICLE' ? this.extractVIN(text) : undefined;
    const warranty = this.extractWarranty(text, purchaseDate);

    // Vehicle fields
    let registrationNumber: string | undefined;
    let engineNumber: string | undefined;
    let currentOdometerKm: number | undefined;
    if (category === 'VEHICLE') {
      registrationNumber = this.extractRegistrationNumber(text);
      engineNumber = this.extractEngineNumber(text);
      currentOdometerKm = this.extractOdometer(text);
      if (!brand) {
        brand = this.extractVehicleBrand(text);
      }
    }

    // Insurance fields
    let providerName: string | undefined;
    let policyNumber: string | undefined;
    let policyType: 'HEALTH' | 'MOTOR' | 'HOME' | 'TERM' | undefined;
    let startDate: string | undefined;
    let expiryDate: string | undefined;
    if (category === 'INSURANCE') {
      const ins = this.extractInsuranceDetails(text);
      providerName = ins.providerName;
      policyNumber = ins.policyNumber || invoiceNumber;
      policyType = ins.policyType;
      startDate = ins.startDate || purchaseDate;
      expiryDate = ins.expiryDate;
    }

    // Form concise asset name
    const assetName = this.extractProductName(text, category, brand, model);

    // Confidence Calculation
    const confidenceScore = this.computeConfidence({
      assetName,
      purchaseDate,
      totalAmount,
      invoiceNumber,
      serialNumber,
      imei,
      registrationNumber,
      category,
    });

    // Check completeness
    const isComplete = Boolean(
      (assetName || brand) &&
      (totalAmount != null || category === 'INSURANCE') &&
      (purchaseDate || startDate)
    );

    const rawPayload: UnifiedAssetPayload = {
      assetName,
      documentCategory: category,
      rawTextLength: text.length,
      confidenceScore,
      invoiceNumber,
      merchantName,
      purchaseDate,
      totalAmount,
      currency: 'INR',
      brand,
      model,
      serialNumber,
      imei,
      warrantyPeriodMonths: warranty.warrantyPeriodMonths,
      warrantyExpiryDate: warranty.warrantyExpiryDate,
      warrantySource: warranty.warrantySource,
      make: category === 'VEHICLE' ? brand : undefined,
      vin,
      engineNumber,
      registrationNumber,
      currentOdometerKm,
      providerName,
      policyNumber,
      policyType,
      startDate,
      expiryDate,
      insuranceExpiryDate: category === 'VEHICLE' ? expiryDate : undefined,
      applianceType: category === 'HOME_APPLIANCE' ? this.extractApplianceType(text) : undefined,
    };

    const sanitizedAsset = this.sanitizeToAllowlist(rawPayload);

    return {
      success: true,
      category,
      asset: sanitizedAsset,
      rawText: text,
      isReadable: true,
      isComplete,
      needsReview: !isComplete || confidenceScore < 0.7,
      warnings: !isComplete ? ['Some asset fields were not detected and can be reviewed manually.'] : [],
      executionTimeMs: Date.now() - t0,
    };
  }

  /**
   * 1. Category Classification
   */
  public static classifyCategory(rawText: string): DocumentCategory {
    const text = rawText.toUpperCase();

    // Insurance signals
    if (
      /\b(?:INSURANCE\s+POLICY|CERTIFICATE\s+OF\s+INSURANCE|POLICY\s+SCHEDULE|MOTOR\s+INSURANCE|HEALTH\s+INSURANCE|SUM\s+INSURED|IDV|POLICY\s+NO|PERIOD\s+OF\s+INSURANCE)\b/.test(text) ||
      INSURANCE_PROVIDERS.some((p) => text.includes(p.toUpperCase()))
    ) {
      // If it's a vehicle insurance policy, treat as INSURANCE
      return 'INSURANCE';
    }

    // Vehicle signals
    if (
      /\b(?:REGISTRATION\s+NO|REGN\s+NO|CHASSIS\s+NO|ENGINE\s+NO|ODOMETER|KM\s+READING|KMS|VEHICLE\s+SERVICE|JOB\s+CARD|PUC\s+CERTIFICATE|REGISTRATION\s+CERTIFICATE|TVS|ROYAL\s+ENFIELD|MARUTI|HYUNDAI|HONDA\s+MOTORCYCLE)\b/.test(text) ||
      /\b[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{0,3}[-\s]?[0-9]{4}\b/.test(text)
    ) {
      // Distinguish vehicle purchase / service
      if (!text.includes('AIR CONDITIONER') && !text.includes('REFRIGERATOR') && !text.includes('SMARTPHONE')) {
        return 'VEHICLE';
      }
    }

    // Home Appliances
    if (
      /\b(?:AIR\s+CONDITIONER|SPLIT\s+AC|INVERTER\s+AC|REFRIGERATOR|FRIDGE|WASHING\s+MACHINE|MICROWAVE|WATER\s+PURIFIER|DISHWASHER|DAIKIN|VOLTAS|WHIRLPOOL|IFB|BLUE\s+STAR|HITACHI|GODREJ)\b/.test(text)
    ) {
      return 'HOME_APPLIANCE';
    }

    // Electronics & Gadgets
    if (
      /\b(?:SMARTPHONE|MOBILE\s+PHONE|IPHONE|NOTHING\s+PHONE|ONEPLUS|SAMSUNG\s+GALAXY|LAPTOP|TABLET|MACBOOK|EARBUDS|HEADPHONE|BLUETOOTH|IMEI|CHARGER|STORAGE\s+GB|RAM\s+GB)\b/.test(text) ||
      /\b\d{15}\b/.test(text) // 15-digit IMEI
    ) {
      return 'ELECTRONICS';
    }

    return 'GENERAL_BILL';
  }

  /**
   * 2. Purchase / Issue Date Extraction
   * Formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY, DD-MM-YY, YYYY-MM-DD
   * Output: Normalized strictly to YYYY-MM-DD
   */
  public static extractPurchaseDate(rawText: string): string | undefined {
    // Contextual date patterns prioritized
    const contextPatterns = [
      /(?:DATE|DATE\s+OF\s+INVOICE|INVOICE\s+DATE|BILL\s+DATE|PURCHASE\s+DATE|ISSUE\s+DATE|INVOICE\s+DT)\s*[:.\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i,
      /(?:DATE|DATE\s+OF\s+INVOICE|INVOICE\s+DATE|BILL\s+DATE|PURCHASE\s+DATE|ISSUE\s+DATE)\s*[:.\-]?\s*([0-9]{4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,2})/i,
      /(?:DATE|INVOICE\s+DATE|PURCHASE\s+DATE)\s*[:.\-]?\s*([0-9]{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*\s+[0-9]{2,4})/i,
    ];

    for (const pattern of contextPatterns) {
      const match = rawText.match(pattern);
      if (match && match[1]) {
        const normalized = this.normalizeDate(match[1]);
        if (normalized) return normalized;
      }
    }

    // Fallback: search for standalone valid dates near the top 30 lines
    const lines = rawText.split('\n').slice(0, 30);
    const dateRegex = /\b([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})\b|\b([0-9]{4}-[0-9]{2}-[0-9]{2})\b/g;
    for (const line of lines) {
      // Ignore validity / expiry lines
      if (/VALID\s+TILL|EXPIR|DUE\s+DATE/i.test(line)) continue;
      let m: RegExpExecArray | null;
      while ((m = dateRegex.exec(line)) !== null) {
        const candidate = m[1] || m[2];
        const normalized = this.normalizeDate(candidate);
        if (normalized) return normalized;
      }
    }

    return undefined;
  }

  /**
   * 3. Total Amount Extraction
   * Contextual labels: Grand Total, Net Total, Total Amount, Amount Payable, Balance Due, etc.
   * Strictly avoids CGST, SGST, IGST, subtotal, tax, discounts.
   */
  public static extractTotalAmount(rawText: string): number | undefined {
    const lines = rawText.split('\n');

    // Contextual patterns for lines containing primary total amount
    const totalLinePatterns = [
      /(?:GRAND\s*TOTAL|NET\s*TOTAL|NET\s*AMOUNT|TOTAL\s*(?:PREMIUM\s*)?PAYABLE|AMOUNT\s*PAYABLE|TOTAL\s*AMOUNT|TOTAL\s*PREMIUM|INVOICE\s*TOTAL|BALANCE\s*DUE)\s*[:.\-]?\s*(?:INR|RS\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /\b(?:TOTAL)\s*[:.\-]?\s*(?:INR|RS\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    ];

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];

      // Reject lines with tax or subtotal tokens
      if (/\b(?:CGST|SGST|IGST|TAX\s*AMOUNT|TAXABLE|SUB\s*TOTAL|DISCOUNT|ROUND\s*OFF|CESS)\b/i.test(line)) {
        continue;
      }

      for (const pattern of totalLinePatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const num = this.parseNumericAmount(match[1]);
          if (num != null && num > 0 && num < 100000000) {
            return num;
          }
        }
      }
    }

    // Two-line patterns: label on line i, amount on line i+1
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      const nextLine = lines[i + 1].trim();
      if (/^(?:GRAND\s*TOTAL|NET\s*TOTAL|TOTAL\s*PAYABLE|AMOUNT\s*PAYABLE|TOTAL\s*AMOUNT|INVOICE\s*TOTAL)$/i.test(line)) {
        const match = nextLine.match(/^(?:INR|RS\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
        if (match && match[1]) {
          const num = this.parseNumericAmount(match[1]);
          if (num != null && num > 0) return num;
        }
      }
    }

    return undefined;
  }

  /**
   * 4. Invoice Number Extraction
   */
  public static extractInvoiceNumber(rawText: string): string | undefined {
    const patterns = [
      /(?:(?:TAX\s+)?INVOICE|BILL|CASH\s*MEMO|MEMO)\s*(?:NO\.?|NUMBER|#)?\s*[:\-]\s*([A-Z0-9\-\/]+)/i,
      /(?:INVOICE\s*NO\.?|INVOICE\s*NUMBER|BILL\s*NO\.?|BILL\s*NUMBER|CASH\s*MEMO\s*NO\.?|MEMO\s*NO\.?|TAX\s*INVOICE\s*NO\.?)\s*[:.\-]?\s*([A-Z0-9\-\/]+)/i,
      /\bINV\s*[-#:]\s*([A-Z0-9\-\/]+)/i,
      /(?:INVOICE|BILL)\s*#\s*([A-Z0-9\-\/]+)/i,
    ];

    for (const p of patterns) {
      const match = rawText.match(p);
      if (match && match[1]) {
        const val = match[1].trim();
        if (/^(?:thing|invoice|tax|date|cash|bill|none|null)$/i.test(val)) continue;
        // Disallow collision with GSTIN (15 alphanumeric starting with 2 digits)
        if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(val)) continue;
        // Disallow collision with standard 10-digit phone number
        if (/^[6-9][0-9]{9}$/.test(val)) continue;
        // Disallow collision with date tokens
        if (/^[0-9]{2}[\/\-][0-9]{2}[\/\-][0-9]{2,4}$/.test(val)) continue;
        if (val.length >= 2 && val.length <= 40) {
          return val;
        }
      }
    }

    return undefined;
  }

  /**
   * 5. Serial Number Extraction (Hardware S/N)
   */
  public static extractSerialNumber(rawText: string): string | undefined {
    const patterns = [
      /(?:SERIAL\s*NO\.?|SERIAL\s*NUMBER|SERIAL|S\/N|SL\s*NO\.?|SR\s*NO\.?)[^\S\r\n]*[:.\-]?[^\S\r\n]*([A-Z0-9\-_]+)/i,
    ];

    for (const p of patterns) {
      const match = rawText.match(p);
      if (match && match[1]) {
        const val = match[1].trim();
        if (/^(?:NO|NA|N\/A|NONE|NIL|SERIAL|NUMBER)$/i.test(val)) continue;
        if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(val)) continue; // GSTIN
        if (val.length >= 4 && val.length <= 35) {
          return val;
        }
      }
    }

    return undefined;
  }

  /**
   * 6. IMEI Extraction (15 Digits)
   */
  public static extractIMEI(rawText: string): string | undefined {
    const labeledMatch = rawText.match(/(?:IMEI(?:\s*1)?|TAC)\s*[:.\-]?\s*([0-9]{15})\b/i);
    if (labeledMatch && labeledMatch[1]) {
      return labeledMatch[1].trim();
    }

    // Direct 15 digit standalone pattern
    const match = rawText.match(/\b([0-9]{15})\b/);
    if (match && match[1]) {
      // Ensure not a GSTIN or timestamp
      const s = match[1];
      if (!s.startsWith('0000')) {
        return s;
      }
    }

    return undefined;
  }

  /**
   * 7. VIN / Chassis Number Extraction (17 Characters)
   */
  public static extractVIN(rawText: string): string | undefined {
    const labeledMatch = rawText.match(/(?:CHASSIS\s*(?:NO\.?|NUMBER)?|VIN|FRAME\s*NO\.?)\s*[:.\-]?\s*([A-HJ-NPR-Z0-9]{17})\b/i);
    if (labeledMatch && labeledMatch[1]) {
      return labeledMatch[1].toUpperCase();
    }

    // General 17-char VIN pattern
    const match = rawText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }

    return undefined;
  }

  /**
   * 8. Brand Extraction
   * Uses curated brands list + contextual fallback ("Brand: XYZ")
   */
  public static extractBrand(rawText: string): string | undefined {
    // 1. Contextual label
    const labelMatch = rawText.match(/(?:BRAND|MAKE|MANUFACTURER)\s*[:.\-]?\s*([A-Za-z0-9\s]+)(?:\n|$|,)/i);
    if (labelMatch && labelMatch[1]) {
      const cand = labelMatch[1].trim();
      if (cand.length >= 2 && cand.length <= 30 && !/^(?:NAME|OF|THE|AND)$/i.test(cand)) {
        return cand;
      }
    }

    // 2. Curated brand search
    for (const brand of CURATED_BRANDS) {
      const regex = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(rawText)) {
        return brand;
      }
    }

    return undefined;
  }

  /**
   * 9. Model Extraction
   */
  public static extractModel(rawText: string, brand?: string): string | undefined {
    const patterns = [
      /(?:MODEL\s*NO\.?|MODEL\s*NAME|MODEL\s*NUMBER)[^\S\r\n]*[:.\-]?[^\S\r\n]*([A-Za-z0-9\-_\s\/]+)(?:\n|$|,)/i,
      /\bMODEL[^\S\r\n]*[:\-][^\S\r\n]*([A-Za-z0-9\-_\s\/]+)(?:\n|$|,)/i,
    ];

    for (const p of patterns) {
      const match = rawText.match(p);
      if (match && match[1]) {
        let m = match[1].trim();
        if (/^(?:town|colony|road|nagar|street|lane|city|estate)$/i.test(m)) continue;
        // Remove trailing price or tax tokens if any
        m = m.replace(/(?:HSN|GST|RS|₹|INR|\bQTY\b).*$/i, '').trim();
        if (m.length >= 2 && m.length <= 50) {
          return m;
        }
      }
    }

    return undefined;
  }

  /**
   * 10. Warranty Extraction
   * ZERO hallucination: If printed, warrantySource = 'EXTRACTED'.
   * If NOT printed, warrantySource = 'NOT_FOUND'. Never return fake 12 months.
   */
  public static extractWarranty(
    rawText: string,
    purchaseDate?: string
  ): {
    warrantyPeriodMonths?: number;
    warrantyExpiryDate?: string;
    warrantySource: WarrantySource;
  } {
    // 1. Look for explicit expiry date printed on document
    const expiryMatch = rawText.match(
      /(?:WARRANTY\s*(?:EXPIRY|VALID\s*TILL|VALID\s*UPTO|TILL)|EXPIRY\s*DATE)\s*[:.\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i
    );
    if (expiryMatch && expiryMatch[1]) {
      const normDate = this.normalizeDate(expiryMatch[1]);
      if (normDate) {
        return {
          warrantyExpiryDate: normDate,
          warrantySource: 'EXTRACTED',
        };
      }
    }

    // 2. Look for printed duration e.g. "1 Year Warranty", "2 Years Warranty", "24 Months Warranty"
    const durationMatch = rawText.match(
      /\b([0-9]{1,2})\s*(?:YEAR|YR|YEARS|YRS)\s*(?:WARRANTY|GUARANTEE)\b/i
    );
    if (durationMatch && durationMatch[1]) {
      const years = parseInt(durationMatch[1], 10);
      if (years > 0 && years <= 10) {
        const months = years * 12;
        let warrantyExpiryDate: string | undefined;
        if (purchaseDate) {
          warrantyExpiryDate = this.addMonthsToDate(purchaseDate, months);
        }
        return {
          warrantyPeriodMonths: months,
          warrantyExpiryDate,
          warrantySource: 'EXTRACTED',
        };
      }
    }

    const monthsMatch = rawText.match(
      /\b([0-9]{1,2})\s*(?:MONTH|MONTHS|MTHS)\s*(?:WARRANTY|GUARANTEE)\b/i
    );
    if (monthsMatch && monthsMatch[1]) {
      const months = parseInt(monthsMatch[1], 10);
      if (months > 0 && months <= 120) {
        let warrantyExpiryDate: string | undefined;
        if (purchaseDate) {
          warrantyExpiryDate = this.addMonthsToDate(purchaseDate, months);
        }
        return {
          warrantyPeriodMonths: months,
          warrantyExpiryDate,
          warrantySource: 'EXTRACTED',
        };
      }
    }

    // Strict: No warranty found on document
    return {
      warrantySource: 'NOT_FOUND',
    };
  }

  /**
   * 11. Product / Asset Name Formation
   * Support: Product, Product Name, Item, Description, Particulars, Model.
   * Strip accounting boilerplate, GST, taxes, shipping, payment.
   */
  public static extractProductName(
    rawText: string,
    category: DocumentCategory,
    brand?: string,
    model?: string
  ): string {
    // 1. Table item description row matching (e.g. "1   Nothing Phone (2a)   8517" or "1   Dell Inspiron 15 Laptop   8471")
    const tableItemMatch = rawText.match(/^\s*(?:1|01)\s+([A-Za-z0-9\-_.,\s\/()]+?)\s{2,}[0-9]+/m);
    if (tableItemMatch && tableItemMatch[1]) {
      let tName = tableItemMatch[1].trim();
      if (tName.length >= 3 && tName.length <= 60 && !/^(?:INVOICE|TAX|BILL|CASH|MEMO|TOTAL)$/i.test(tName)) {
        return tName;
      }
    }

    // 2. If brand and model already give a crisp name, use them
    if (brand && model && !model.toLowerCase().includes(brand.toLowerCase())) {
      return `${brand} ${model}`.trim();
    }
    if (brand && model) {
      return model.trim();
    }

    // Look for product / item descriptions in text
    const productPatterns = [
      /(?:PRODUCT\s*NAME|PRODUCT|ITEM\s*NAME|ITEM\s*DESCRIPTION|DESCRIPTION\s*OF\s*GOODS)\s*[:.\-]?\s*([A-Za-z0-9\-_.,\s\/]+)(?:\n|$)/i,
      /(?:PARTICULARS)\s*[:.\-]?\s*([A-Za-z0-9\-_.,\s\/]+)(?:\n|$)/i,
    ];

    for (const p of productPatterns) {
      const match = rawText.match(p);
      if (match && match[1]) {
        let name = match[1].trim();
        // Clean out trailing noise
        name = name.replace(/(?:HSN|GST|RS|₹|INR|\bQTY\b|\bRATE\b|\bAMOUNT\b).*$/i, '').trim();
        name = name.replace(/^[-:.,\s]+|[-:.,\s]+$/g, '');
        if (name.length >= 3 && name.length <= 60 && !/^(?:INVOICE|TAX|BILL|CASH|MEMO|TOTAL)$/i.test(name)) {
          return name;
        }
      }
    }

    if (model) return model;
    if (brand) return brand;

    // Fallback based on category
    switch (category) {
      case 'ELECTRONICS':
        return 'Electronic Device';
      case 'VEHICLE':
        return 'Vehicle Document';
      case 'HOME_APPLIANCE':
        return 'Home Appliance';
      case 'INSURANCE':
        return 'Insurance Policy';
      default:
        return 'Scanned Asset Bill';
    }
  }

  /**
   * 12. Merchant / Vendor Name Extraction
   */
  public static extractMerchantName(rawText: string): string | undefined {
    const patterns = [
      /(?:SOLD\s*BY|DEALER|MERCHANT|VENDOR|STORE\s*NAME|SELLER)\s*[:.\-]?\s*([A-Za-z0-9\s.,&'\-]+)(?:\n|$)/i,
      /(?:ISSUED\s*BY|WORKSHOP|SERVICE\s*CENTRE)\s*[:.\-]?\s*([A-Za-z0-9\s.,&'\-]+)(?:\n|$)/i,
    ];

    for (const p of patterns) {
      const match = rawText.match(p);
      if (match && match[1]) {
        const name = match[1].trim().replace(/^[-:.,\s]+|[-:.,\s]+$/g, '');
        if (name.length >= 3 && name.length <= 60 && !/^(?:GSTIN|TAX|INVOICE|DATE)$/i.test(name)) {
          return name;
        }
      }
    }

    // Top lines often contain shop name
    const lines = rawText.split('\n').slice(0, 8);
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.length >= 3 &&
        trimmed.length <= 50 &&
        !/^[=\-─_]{3,}$/.test(trimmed) &&
        !/^(?:TAX\s+INVOICE|INVOICE|RETAIL\s+INVOICE|BILL\s+OF\s+SUPPLY|CASH\s+MEMO|RECEIPT|GSTIN|PAGE\s+\d+|JOB\s+CARD)/i.test(trimmed) &&
        !/[0-9]{10}/.test(trimmed)
      ) {
        return trimmed;
      }
    }

    return undefined;
  }

  /**
   * Vehicle Details: Registration Number
   */
  public static extractRegistrationNumber(rawText: string): string | undefined {
    const labeledMatch = rawText.match(
      /(?:REGISTRATION\s*NO\.?|REGN\s*NO\.?|VEHICLE\s*NO\.?|REG\s*NO\.?)\s*[:.\-]?\s*([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{0,3}[-\s]?[0-9]{4})\b/i
    );
    if (labeledMatch && labeledMatch[1]) {
      return labeledMatch[1].replace(/[-\s]/g, '').toUpperCase();
    }

    // Standalone Indian vehicle registration plate pattern: 2 letters, 1-2 digits, 0-3 letters, 4 digits
    const match = rawText.match(/\b([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4})\b/i);
    if (match && match[1]) {
      return match[1].replace(/[-\s]/g, '').toUpperCase();
    }

    return undefined;
  }

  /**
   * Vehicle Details: Engine Number
   */
  public static extractEngineNumber(rawText: string): string | undefined {
    const match = rawText.match(/(?:ENGINE\s*NO\.?|MOTOR\s*NO\.?)\s*[:.\-]?\s*([A-Z0-9\-_]{6,25})\b/i);
    if (match && match[1]) {
      const val = match[1].trim().toUpperCase();
      if (!/^(?:NO|NA|N\/A|NONE|NIL)$/i.test(val)) {
        return val;
      }
    }
    return undefined;
  }

  /**
   * Vehicle Details: Current Odometer KM
   */
  public static extractOdometer(rawText: string): number | undefined {
    const match = rawText.match(/(?:ODOMETER|ODO(?:\s*KM)?|KM\s*READING|CURRENT\s*KM)\s*[:.\-]?\s*([0-9,]+)\s*(?:KM|KMS)?/i);
    if (match && match[1]) {
      const val = parseInt(match[1].replace(/,/g, ''), 10);
      if (val > 0 && val < 1000000) {
        return val;
      }
    }
    return undefined;
  }

  /**
   * Vehicle Brand Detection
   */
  public static extractVehicleBrand(rawText: string): string | undefined {
    const vehicleBrands = ['TVS', 'Royal Enfield', 'Honda', 'Hero', 'Bajaj', 'Yamaha', 'Suzuki', 'Tata', 'Maruti', 'Hyundai', 'Mahindra'];
    for (const b of vehicleBrands) {
      if (new RegExp(`\\b${b}\\b`, 'i').test(rawText)) {
        return b;
      }
    }
    return undefined;
  }

  /**
   * Appliance Type
   */
  public static extractApplianceType(rawText: string): string | undefined {
    if (/AIR\s+CONDITIONER|SPLIT\s+AC|INVERTER\s+AC|\bAC\b/i.test(rawText)) return 'Air Conditioner';
    if (/REFRIGERATOR|FRIDGE/i.test(rawText)) return 'Refrigerator';
    if (/WASHING\s+MACHINE/i.test(rawText)) return 'Washing Machine';
    if (/MICROWAVE/i.test(rawText)) return 'Microwave';
    if (/WATER\s+PURIFIER|RO/i.test(rawText)) return 'Water Purifier';
    if (/TELEVISION|SMART\s+TV|\bTV\b/i.test(rawText)) return 'Television';
    return undefined;
  }

  /**
   * Insurance Details
   */
  public static extractInsuranceDetails(rawText: string): {
    providerName?: string;
    policyNumber?: string;
    policyType?: 'HEALTH' | 'MOTOR' | 'HOME' | 'TERM';
    startDate?: string;
    expiryDate?: string;
  } {
    let providerName: string | undefined;
    for (const p of INSURANCE_PROVIDERS) {
      if (new RegExp(`\\b${p}\\b`, 'i').test(rawText)) {
        providerName = p;
        break;
      }
    }

    let policyNumber: string | undefined;
    const pNumMatch = rawText.match(/(?:POLICY\s*NO\.?|POLICY\s*NUMBER|CERTIFICATE\s*NO\.?)\s*[:.\-]?\s*([A-Z0-9\-\/]+)/i);
    if (pNumMatch && pNumMatch[1]) {
      policyNumber = pNumMatch[1].trim();
    }

    let policyType: 'HEALTH' | 'MOTOR' | 'HOME' | 'TERM' = 'MOTOR';
    if (/HEALTH\s+INSURANCE|MEDICLAIM/i.test(rawText)) policyType = 'HEALTH';
    else if (/HOME\s+INSURANCE/i.test(rawText)) policyType = 'HOME';
    else if (/TERM\s+INSURANCE|LIFE\s+INSURANCE/i.test(rawText)) policyType = 'TERM';

    let expiryDate: string | undefined;
    const expMatch = rawText.match(/(?:EXPIRY\s*DATE|VALID\s*TILL|VALID\s*UPTO|PERIOD\s*OF\s*INSURANCE\s*TO)\s*[:.\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    if (expMatch && expMatch[1]) {
      expiryDate = this.normalizeDate(expMatch[1]);
    }

    return { providerName, policyNumber, policyType, expiryDate };
  }

  /**
   * Strict Sanitization to Allowlist
   * Strips all non-whitelisted keys and guarantees zero accounting fields.
   */
  public static sanitizeToAllowlist(payload: any): UnifiedAssetPayload {
    const clean: any = {};
    for (const key of ALLOWED_UNIFIED_ASSET_KEYS) {
      if (payload[key] !== undefined) {
        clean[key] = payload[key];
      }
    }

    // Populate symmetrical UI aliases if base fields are present
    if (clean.assetName) clean.productName = clean.assetName;
    if (clean.merchantName) {
      clean.storeName = clean.merchantName;
      clean.vendorName = clean.merchantName;
      clean.shopName = clean.merchantName;
    }
    if (clean.totalAmount != null) clean.price = clean.totalAmount;
    if (clean.warrantyPeriodMonths != null) clean.warrantyMonths = clean.warrantyPeriodMonths;
    if (clean.warrantyExpiryDate) clean.warrantyExpiry = clean.warrantyExpiryDate;
    if (clean.insuranceExpiryDate) clean.insuranceExpiry = clean.insuranceExpiryDate;
    if (clean.registrationNumber) clean.registration = clean.registrationNumber;
    if (clean.vin) clean.chassisNumber = clean.vin;

    return clean as UnifiedAssetPayload;
  }

  // Helper: Date normalizer to ISO YYYY-MM-DD
  private static normalizeDate(raw: string): string | undefined {
    if (!raw) return undefined;
    const str = raw.trim().replace(/[.]/g, '-').replace(/[\/]/g, '-');

    // YYYY-MM-DD
    const isoMatch = str.match(/^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})$/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (y >= 2000 && y <= 2040 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // DD-MM-YYYY or DD-MM-YY
    const dmyMatch = str.match(/^([0-9]{1,2})-([0-9]{1,2})-([0-9]{2,4})$/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10);
      let y = parseInt(dmyMatch[3], 10);
      if (y < 100) y += 2000;
      if (y >= 2000 && y <= 2040 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    // Textual dates e.g. "12 May 2024"
    const textMatch = raw.match(/([0-9]{1,2})\s+([A-Za-z]+)\s+([0-9]{2,4})/);
    if (textMatch) {
      const d = parseInt(textMatch[1], 10);
      let y = parseInt(textMatch[3], 10);
      if (y < 100) y += 2000;
      const monthMap: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
      };
      const mStr = textMatch[2].slice(0, 3).toLowerCase();
      const m = monthMap[mStr];
      if (m && y >= 2000 && y <= 2040 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    return undefined;
  }

  private static parseNumericAmount(str: string): number | null {
    const clean = str.replace(/,/g, '').trim();
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : null;
  }

  private static addMonthsToDate(dateStr: string, months: number): string | undefined {
    try {
      const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCMonth(dt.getUTCMonth() + months);
      return dt.toISOString().split('T')[0];
    } catch {
      return undefined;
    }
  }

  private static computeConfidence(fields: {
    assetName?: string;
    purchaseDate?: string;
    totalAmount?: number;
    invoiceNumber?: string;
    serialNumber?: string;
    imei?: string;
    registrationNumber?: string;
    category: DocumentCategory;
  }): number {
    let score = 0.2;
    if (fields.assetName) score += 0.2;
    if (fields.purchaseDate) score += 0.2;
    if (fields.totalAmount != null) score += 0.2;
    if (fields.invoiceNumber) score += 0.1;
    if (fields.serialNumber || fields.imei || fields.registrationNumber) score += 0.1;
    return Math.min(1.0, Math.round(score * 100) / 100);
  }
}

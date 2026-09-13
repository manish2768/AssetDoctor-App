/**
 * Asset Doctor — Multi-Signal Hybrid Document Classifier
 *
 * Combines layout structures, contextual anchors, negative-disclaimer filtering,
 * and domain-specific terminology to accurately distinguish:
 * - VEHICLE_PURCHASE_INVOICE
 * - VEHICLE_SERVICE_INVOICE
 * - VEHICLE_INSURANCE
 * - VEHICLE_RC
 * - VEHICLE_PUC
 * - VEHICLE_WARRANTY
 * - ELECTRONICS_PURCHASE_INVOICE
 * - HOME_APPLIANCE_INVOICE
 * - APPLIANCE_WARRANTY
 * - AMC
 * - GENERIC_INVOICE
 * - UNKNOWN_DOCUMENT
 */

export type CanonicalDocumentType =
  | 'VEHICLE_PURCHASE_INVOICE'
  | 'VEHICLE_SERVICE_INVOICE'
  | 'VEHICLE_INSURANCE'
  | 'VEHICLE_RC'
  | 'VEHICLE_PUC'
  | 'VEHICLE_WARRANTY'
  | 'ELECTRONICS_PURCHASE_INVOICE'
  | 'HOME_APPLIANCE_INVOICE'
  | 'APPLIANCE_WARRANTY'
  | 'AMC'
  | 'ELECTRICITY_BILL'
  | 'GENERIC_INVOICE'
  | 'UNKNOWN_DOCUMENT';

export interface ClassificationReport {
  documentType: CanonicalDocumentType;
  confidence: number;
  signals: string[];
  suggestedCategory: 'VEHICLE' | 'ELECTRONICS' | 'APPLIANCE' | 'GENERAL' | 'ENERGY';
}

export class HybridDocumentClassifier {
  /**
   * Authoritative classification evaluating structural anchors and layout evidence.
   */
  public static classify(
    rawText: string,
    hints: {
      productName?: string | null;
      shopName?: string | null;
      providerDocType?: string | null;
    } = {}
  ): ClassificationReport {
    const text = (rawText || '').toUpperCase();
    const signals: string[] = [];

    // Guard: Truly empty or negligible text
    if (text.trim().length < 25) {
      return {
        documentType: 'UNKNOWN_DOCUMENT',
        confidence: 0.2,
        signals: ['empty_or_minimal_text'],
        suggestedCategory: 'GENERAL',
      };
    }

    // Helper: test regex while ignoring negative disclaimer lines (e.g. "IMEI does not apply")
    const hasContext = (pattern: RegExp, negativeCheck?: RegExp): boolean => {
      if (!pattern.test(text)) return false;
      if (negativeCheck) {
        // If the match only occurs inside a disclaimer line, reject it
        const lines = text.split('\n');
        const validLine = lines.find((l) => pattern.test(l) && !negativeCheck.test(l));
        return Boolean(validLine);
      }
      return true;
    };

    // 1. VEHICLE INSURANCE POLICY
    let insuranceScore = 0;
    if (/\b(?:POLICY\s*(?:SCHEDULE|DOCUMENT|CERTIFICATE|NO|NUMBER)|CERTIFICATE\s*OF\s*INSURANCE)\b/.test(text)) {
      insuranceScore += 45;
      signals.push('insurance_policy_header');
    }
    if (/\b(?:INSURED\s*DECLARED\s*VALUE|\bIDV\b|OWN\s*DAMAGE\s*PREMIUM|NO\s*CLAIM\s*BONUS|\bNCB\b|THIRD\s*PARTY\s*PREMIUM)\b/.test(text)) {
      insuranceScore += 45;
      signals.push('insurance_terms');
    }
    if (/\b(?:ICICI\s*LOMBARD|HDFC\s*ERGO|BAJAJ\s*ALLIANZ|NEW\s*INDIA\s*ASSURANCE|TATA\s*AIG|IFFCO\s*TOKIO|GO\s*DIGIT|UNITED\s*INDIA|NATIONAL\s*INSURANCE|SBI\s*GENERAL|RELIANCE\s*GENERAL|CHOLAMANDALAM)\b/.test(text)) {
      insuranceScore += 30;
      signals.push('known_insurer_entity');
    }
    if (insuranceScore >= 50) {
      return {
        documentType: 'VEHICLE_INSURANCE',
        confidence: Math.min(0.99, insuranceScore / 100),
        signals,
        suggestedCategory: 'VEHICLE',
      };
    }

    // 2. VEHICLE PUC CERTIFICATE
    let pucScore = 0;
    if (/\b(?:POLLUTION\s*UNDER\s*CONTROL|PUC\s*(?:CERTIFICATE|NO|RECEIPT)|EMISSION\s*TEST(?:\s*REPORT)?)\b/.test(text)) {
      pucScore += 50;
      signals.push('puc_header');
    }
    if (/\b(?:CARBON\s*MONOXIDE|HYDROCARBON|SMOKE\s*DENSITY|\bK\s*VALUE\b|CO\s*%\s*VOL|IDLE\s*EMISSION)\b/.test(text)) {
      pucScore += 40;
      signals.push('puc_emission_parameters');
    }
    if (pucScore >= 50) {
      return {
        documentType: 'VEHICLE_PUC',
        confidence: Math.min(0.99, pucScore / 100),
        signals,
        suggestedCategory: 'VEHICLE',
      };
    }

    // 3. VEHICLE RC CERTIFICATE
    let rcScore = 0;
    if (/\b(?:FORM\s*23|CERTIFICATE\s*OF\s*REGISTRATION|REGISTRATION\s*CERTIFICATE|RC\s*BOOK|REGISTRATION\s*PARTICULARS)\b/.test(text)) {
      rcScore += 50;
      signals.push('rc_header');
    }
    if (/\b(?:REGISTERING\s*AUTHORITY|MOTOR\s*VEHICLES\s*ACT|UNLADEN\s*WEIGHT|CUBIC\s*CAPACITY|CHASSIS\s*NUMBER|SEATING\s*CAPACITY)\b/.test(text)) {
      rcScore += 40;
      signals.push('rc_technical_parameters');
    }
    if (rcScore >= 50) {
      return {
        documentType: 'VEHICLE_RC',
        confidence: Math.min(0.99, rcScore / 100),
        signals,
        suggestedCategory: 'VEHICLE',
      };
    }

    // 4. VEHICLE SERVICE INVOICE / JOB CARD
    let serviceScore = 0;
    if (/\b(?:JOB\s*CARD|WORK\s*ORDER|\bRO\s*NO\b|RO\s*NUMBER|REPAIR\s*ORDER|SERVICE\s*INVOICE|ESTIMATE\s*MEMO)\b/.test(text)) {
      serviceScore += 45;
      signals.push('service_job_card_header');
    }
    if (/\b(?:PERIODIC\s*(?:MAINTENANCE|SERVICE)|LABOUR\s*(?:CHARGES|AMOUNT)|LABOR|OIL\s*CHANGE|WHEEL\s*ALIGNMENT|BRAKE\s*PAD|ENGINE\s*OIL|SPARK\s*PLUG|OIL\s*FILTER|AIR\s*FILTER)\b/.test(text)) {
      serviceScore += 35;
      signals.push('service_maintenance_items');
    }
    if (/\b(?:CURRENT\s*KM|ODOMETER|KM\s*READING|METER\s*READING|VEHICLE\s*IN\s*KM|NEXT\s*SERVICE\s*DUE)\b/.test(text)) {
      serviceScore += 30;
      signals.push('odometer_evidence');
    }
    if (/\b(?:AUTHORIZED\s*SERVICE|WORKSHOP|SERVICE\s*CENTRE|SUNRISE\s*MOTORS|TAAR\s*MOTO)\b/.test(text)) {
      serviceScore += 20;
      signals.push('workshop_terms');
    }
    if (serviceScore >= 55) {
      return {
        documentType: 'VEHICLE_SERVICE_INVOICE',
        confidence: Math.min(0.99, serviceScore / 100),
        signals,
        suggestedCategory: 'VEHICLE',
      };
    }

    // 5. VEHICLE PURCHASE INVOICE
    let vehiclePurchaseScore = 0;
    if (/\b(?:EX[\s\-]SHOWROOM|RTO\s*(?:CHARGES|REGISTRATION)|CHASSIS\s*(?:\/|\s*)FRAME|ENGINE\s*NO|HSN\s*8711|HSN\s*8703|BATTERY\s*NO)\b/.test(text)) {
      vehiclePurchaseScore += 50;
      signals.push('vehicle_purchase_breakdown');
    }
    if (/\b(?:TVS\s*RONIN|RONIN\s*225|ACTIVA|PULSAR|JUPITER|CRETA|SELTOS|SWIFT|BALENO|NEXON|HYUNDAI|MARUTI|TOYOTA|HERO\s*MOTO|HONDA\s*MOTORCYCLE|BAJAJ\s*AUTO|ROYAL\s*ENFIELD)\b/.test(text)) {
      vehiclePurchaseScore += 30;
      signals.push('vehicle_model_or_oem');
    }
    if (/\b(?:DEALER|AUTHORISED\s*DEALER|SALES\s*CERTIFICATE|ROAD\s*TAX)\b/.test(text)) {
      vehiclePurchaseScore += 20;
      signals.push('dealer_sales_terms');
    }
    if (vehiclePurchaseScore >= 50) {
      return {
        documentType: 'VEHICLE_PURCHASE_INVOICE',
        confidence: Math.min(0.99, vehiclePurchaseScore / 100),
        signals,
        suggestedCategory: 'VEHICLE',
      };
    }

    // 6. HOME APPLIANCE INVOICE
    let applianceScore = 0;
    if (/\b(?:AIR\s*CONDITIONER|INVERTER\s*(?:SPLIT\s*)?AC|SPLIT\s*AC|WINDOW\s*AC|REFRIGERATOR|\bFRIDGE\b|WASHING\s*MACHINE|DISHWASHER|MICROWAVE|GEYSER|WATER\s*HEATER|WATER\s*PURIFIER|RO\s*PURIFIER|CHIMNEY)\b/.test(text)) {
      applianceScore += 50;
      signals.push('appliance_keyword');
    }
    if (/\b(?:DAIKIN|VOLTAS|BLUE\s*STAR|CARRIER|HITACHI|LLOYD|GODREJ|WHIRLPOOL|HAFELE|BOSCH|IFB|HAVELLS|CROMPTON|KENT|EUREKA\s*FORBES)\b/.test(text)) {
      applianceScore += 30;
      signals.push('appliance_brand');
    }
    if (/\b(?:STAR\s*RATING|BEE\s*STAR|COMPRESSOR\s*WARRANTY|INVERTER\s*COMPRESSOR|\bTON\b|\bLITRE\b|\bLTR\b|\bKG\b)\b/.test(text)) {
      applianceScore += 20;
      signals.push('appliance_specs');
    }
    if (applianceScore >= 45) {
      return {
        documentType: 'HOME_APPLIANCE_INVOICE',
        confidence: Math.min(0.99, applianceScore / 100),
        signals,
        suggestedCategory: 'APPLIANCE',
      };
    }

    // 7. ELECTRONICS / GADGET PURCHASE INVOICE
    let electronicsScore = 0;
    // Strict negative check: ignore "IMEI does not apply" or "No IMEI"
    const hasRealImei = hasContext(/\bIMEI\b/i, /(?:NOT\s*APPLY|DOES\s*NOT\s*APPLY|NO\s*IMEI|WITHOUT\s*IMEI)/i);
    if (hasRealImei) {
      electronicsScore += 45;
      signals.push('valid_imei_context');
    }

    if (/\b(?:SMARTPHONE|MOBILE\s*PHONE|TABLET|\bIPAD\b|LAPTOP|\bMACBOOK\b|SMARTWATCH|HEADPHONES?|EARBUDS?|TELEVISION|SMART\s*TV|\bOLED\b|\bQLED\b)\b/.test(text)) {
      electronicsScore += 40;
      signals.push('electronics_product_category');
    }

    if (/\b(?:NOTHING\s*PHONE|IPHONE|ONEPLUS|GOOGLE\s*PIXEL|PIXEL\s*[0-9]|SAMSUNG\s*GALAXY|REDMI|REALME|XIAOMI|OPPO|VIVO|APPLE|DELL|HP|LENOVO|ASUS|ACER|SONY\s*BRAVIA|MACBOOK|IPAD)\b/.test(text)) {
      electronicsScore += 30;
      signals.push('electronics_brand');
    }

    if (/\b(?:ELECTRONICS|DIGITAL\s*WORLD|CROMA|VIJAY\s*SALES|RELIANCE\s*DIGITAL)\b/.test(text)) {
      electronicsScore += 25;
      signals.push('electronics_store_entity');
    }

    if (electronicsScore >= 45) {
      return {
        documentType: 'ELECTRONICS_PURCHASE_INVOICE',
        confidence: Math.min(0.99, electronicsScore / 100),
        signals,
        suggestedCategory: 'ELECTRONICS',
      };
    }

    // 8. ELECTRICITY BILL / DISCOM UTILITY INVOICE
    let electricityScore = 0;
    if (/\b(?:ELECTRICITY\s*(?:BILL|DUTY|DEPARTMENT|DISTRIBUTION)|POWER\s*(?:DISTRIBUTION|BILL)|ENERGY\s*BILL|LIGHT\s*BILL|\bDISCOM\b)\b/.test(text)) {
      electricityScore += 45;
      signals.push('electricity_bill_header');
    }
    if (/\b(?:TATA\s*POWER|BSES(?:\s*(?:RAJDHANI|YAMUNA))?|\bBRPL\b|\bBYPL\b|\bTPDDL\b|\bUPPCL\b|\bPVVNL\b|\bMVVNL\b|\bDVVNL\b|\bPUVVNL\b|\bKESCO\b|\bMSEDCL\b|\bMAHAVITARAN\b|ADANI\s*ELECTRICITY|TORRENT\s*POWER|\bBESCOM\b|\bMESCOM\b|\bHESCOM\b|\bGESCOM\b|\bCHESCOM\b|\bTSSPDCL\b|\bTSNPDCL\b|\bTANGEDCO\b|\bWBSEDCL\b|\bCESC\b|\bPSPCL\b|\bDHBVN\b|\bUHBVN\b|\bJVVNL\b|\bAVVNL\b|\bJDVVNL\b|BEST\s*UNDERTAKING)\b/.test(text)) {
      electricityScore += 40;
      signals.push('electricity_provider_entity');
    }
    if (/\b(?:CONSUMER\s*(?:NO|NUMBER|ID)|CA\s*(?:NO|NUMBER)|K\s*NO|ACCOUNT\s*(?:NO|NUMBER)|SERVICE\s*CONNECTION\s*NO|\bBP\s*NO\b)\b/.test(text)) {
      electricityScore += 25;
      signals.push('consumer_account_anchor');
    }
    if (/\b(?:METER\s*READING|PREVIOUS\s*READING|PRESENT\s*READING|CURRENT\s*READING|PREV\s*READING|UNITS\s*CONSUMED|BILLED\s*UNITS|\bKWH\b|\bKVAH\b|CONNECTED\s*LOAD|SANCTIONED\s*LOAD)\b/.test(text)) {
      electricityScore += 30;
      signals.push('meter_reading_consumption');
    }
    if (/\b(?:ENERGY\s*CHARGES?|FIXED\s*CHARGES?|WHEELING\s*CHARGES?|PROMPT\s*PAYMENT\s*DATE|BILLING\s*(?:MONTH|CYCLE|PERIOD))\b/.test(text)) {
      electricityScore += 25;
      signals.push('tariff_billing_terms');
    }
    if (electricityScore >= 50 && !/\b(?:ODOMETER|CHASSIS|VEHICLE\s*REG|JOB\s*CARD|ENGINE\s*NO)\b/.test(text)) {
      return {
        documentType: 'ELECTRICITY_BILL',
        confidence: Math.min(0.99, electricityScore / 100),
        signals,
        suggestedCategory: 'ENERGY',
      };
    }

    // 9. VEHICLE OR GENERAL WARRANTY
    if (/\b(?:WARRANTY\s*(?:CARD|CERTIFICATE)|EXTENDED\s*WARRANTY|GUARANTEE\s*CERTIFICATE)\b/.test(text) && !/\bTAX\s*INVOICE\b/.test(text)) {
      return {
        documentType: 'VEHICLE_WARRANTY',
        confidence: 0.88,
        signals: ['warranty_card_structure'],
        suggestedCategory: 'VEHICLE',
      };
    }

    // 10. GENERIC INVOICE / RETAIL RECEIPT / COMMERCIAL PURCHASE
    if (/\b(?:TAX\s*INVOICE|RETAIL\s*INVOICE|BILL\s*OF\s*SUPPLY|CASH\s*MEMO|INVOICE\s*(?:NO\.?|NUMBER|#)?|BILL\s*(?:NO\.?|NUMBER|#)?|RECEIPT\s*(?:NO\.?|NUMBER|#)?|ORDER\s*(?:NO\.?|NUMBER|#)?|GSTIN)\b/.test(text)) {
      return {
        documentType: 'GENERIC_INVOICE',
        confidence: 0.85,
        signals: ['generic_invoice_tax_structure'],
        suggestedCategory: 'GENERAL',
      };
    }

    // 11. Transactional receipt signals (Total + Date or Items)
    const hasTotalAnchor = /\b(?:TOTAL|GRAND\s*TOTAL|NET\s*AMOUNT|AMOUNT\s*PAYABLE|BALANCE|PAID|SUBTOTAL)\b/.test(text);
    const hasDateAnchor = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2})\b/i.test(text);
    const hasCurrency = /(?:₹|RS\.?|INR)/i.test(text);
    if ((hasTotalAnchor && (hasDateAnchor || hasCurrency)) || (hasTotalAnchor && text.length > 50)) {
      return {
        documentType: 'GENERIC_INVOICE',
        confidence: 0.75,
        signals: ['transactional_receipt_signals'],
        suggestedCategory: 'GENERAL',
      };
    }

    return {
      documentType: 'UNKNOWN_DOCUMENT',
      confidence: 0.35,
      signals: ['no_definitive_document_match'],
      suggestedCategory: 'GENERAL',
    };
  }
}

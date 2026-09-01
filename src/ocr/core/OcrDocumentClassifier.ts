import type { SupportedDocumentClass } from './OcrResult.ts';

export interface ClassificationResult {
  documentType: SupportedDocumentClass;
  confidence: number;
  signals: string[];
  suggestedAssetCategory: 'Vehicle' | 'Electronics' | 'Appliance' | 'General';
}

export class OcrDocumentClassifier {
  public static classify(rawText: string): ClassificationResult {
    const text = (rawText || '').toUpperCase();
    const signals: string[] = [];

    // 1. INSURANCE POLICY
    let insuranceScore = 0;
    if (/\b(?:POLICY\s*(?:SCHEDULE|DOCUMENT|CERTIFICATE|NO|NUMBER)|CERTIFICATE\s*OF\s*INSURANCE)\b/.test(text)) {
      insuranceScore += 45;
      signals.push('policy_schedule_header');
    }
    if (/\b(?:INSURED\s*DECLARED\s*VALUE|IDV|OWN\s*DAMAGE\s*PREMIUM|NO\s*CLAIM\s*BONUS|NCB)\b/.test(text)) {
      insuranceScore += 40;
      signals.push('idv_ncb_terms');
    }
    if (/\b(?:ICICI\s*LOMBARD|HDFC\s*ERGO|BAJAJ\s*ALLIANZ|NEW\s*INDIA\s*ASSURANCE|TATA\s*AIG|IFFCO\s*TOKIO|GO\s*DIGIT|UNITED\s*INDIA|NATIONAL\s*INSURANCE|SBI\s*GENERAL|RELIANCE\s*GENERAL|CHOLAMANDALAM)\b/.test(text)) {
      insuranceScore += 35;
      signals.push('known_insurer_name');
    }
    if (/\b(?:PERIOD\s*OF\s*INSURANCE|INSURED\s*NAME|POLICY\s*START\s*DATE|POLICY\s*EXPIRY)\b/.test(text)) {
      insuranceScore += 25;
      signals.push('policy_period_terms');
    }
    if (insuranceScore >= 45) {
      return {
        documentType: 'INSURANCE_POLICY',
        confidence: Math.min(1.0, insuranceScore / 100),
        signals,
        suggestedAssetCategory: 'Vehicle'
      };
    }

    // 2. PUC CERTIFICATE
    let pucScore = 0;
    if (/\b(?:POLLUTION\s*UNDER\s*CONTROL|PUC\s*(?:CERTIFICATE|NO|RECEIPT)|EMISSION\s*TEST)\b/.test(text)) {
      pucScore += 50;
      signals.push('puc_header');
    }
    if (/\b(?:CARBON\s*MONOXIDE|HYDROCARBON|SMOKE\s*DENSITY|K\s*VALUE|CO\s*%\s*VOL)\b/.test(text)) {
      pucScore += 40;
      signals.push('emission_parameters');
    }
    if (pucScore >= 45) {
      return {
        documentType: 'PUC_CERTIFICATE',
        confidence: Math.min(1.0, pucScore / 100),
        signals,
        suggestedAssetCategory: 'Vehicle'
      };
    }

    // 3. RC CERTIFICATE
    let rcScore = 0;
    if (/\b(?:FORM\s*23|CERTIFICATE\s*OF\s*REGISTRATION|REGISTRATION\s*CERTIFICATE|RC\s*BOOK)\b/.test(text)) {
      rcScore += 50;
      signals.push('rc_header');
    }
    if (/\b(?:REGISTERING\s*AUTHORITY|MOTOR\s*VEHICLES\s*ACT|UNLADEN\s*WEIGHT|CUBIC\s*CAPACITY)\b/.test(text)) {
      rcScore += 40;
      signals.push('rc_technical_terms');
    }
    if (rcScore >= 45) {
      return {
        documentType: 'RC_CERTIFICATE',
        confidence: Math.min(1.0, rcScore / 100),
        signals,
        suggestedAssetCategory: 'Vehicle'
      };
    }

    // 4. SERVICE INVOICE
    let serviceScore = 0;
    if (/\b(?:TAX\s*INVOICE\s*\(?SERVICE\)?|JOB\s*CARD|WORK\s*ORDER|RO\s*NO|ESTIMATE\s*MEMO)\b/.test(text)) {
      serviceScore += 40;
      signals.push('service_header');
    }
    if (/\b(?:PERIODIC\s*MAINTENANCE|LABOUR\s*(?:CHARGES|AMOUNT)|LABOR|SERVICE\s*LABOUR|OIL\s*CHANGE|WHEEL\s*ALIGNMENT|BRAKE\s*PAD|ENGINE\s*OIL)\b/.test(text)) {
      serviceScore += 35;
      signals.push('labour_maintenance_terms');
    }
    if (/\b(?:CURRENT\s*KM|ODOMETER|KILOMETER\s*READING|KM\s*READING|VEHICLE\s*IN\s*KM)\b/.test(text)) {
      serviceScore += 30;
      signals.push('odometer_evidence');
    }
    if (/\b(?:WORKSHOP|SERVICE\s*CENTRE|AUTHORIZED\s*SERVICE|DEALER\s*SERVICE)\b/.test(text)) {
      serviceScore += 20;
      signals.push('workshop_terms');
    }
    if (serviceScore >= 45) {
      return {
        documentType: 'SERVICE_INVOICE',
        confidence: Math.min(1.0, serviceScore / 100),
        signals,
        suggestedAssetCategory: 'Vehicle'
      };
    }

    // 5. APPLIANCE INVOICE
    let applianceScore = 0;
    if (/\b(?:AIR\s*CONDITIONER|SPLIT\s*AC|INVERTER\s*AC|REFRIGERATOR|FRIDGE|WASHING\s*MACHINE|MICROWAVE|DISHWASHER|GEYSER|WATER\s*HEATER|WATER\s*PURIFIER|RO\s*PURIFIER)\b/.test(text)) {
      applianceScore += 45;
      signals.push('appliance_keyword');
    }
    if (/\b(?:VOLTAS|DAIKIN|HITACHI|BLUE\s*STAR|CARRIER|LLOYD|LG|SAMSUNG|WHIRLPOOL|GODREJ|HAFELE|BOSCH|IFB|HAVELLS|BAJAJ|CROMPTON|KENT|EUREKA\s*FORBES)\b/.test(text)) {
      applianceScore += 25;
      signals.push('appliance_brand');
    }
    if (/\b(?:STAR\s*RATING|BEE\s*STAR|COMPRESSOR\s*WARRANTY|INVERTER\s*COMPRESSOR|TON\b|LITRE\b|LTR\b)\b/.test(text)) {
      applianceScore += 20;
      signals.push('appliance_specs');
    }
    if (applianceScore >= 45) {
      return {
        documentType: 'APPLIANCE_INVOICE',
        confidence: Math.min(1.0, applianceScore / 100),
        signals,
        suggestedAssetCategory: 'Appliance'
      };
    }

    // 6. ELECTRONICS / GADGET INVOICE
    let electronicsScore = 0;
    if (/\b(?:IMEI|SERIAL\s*NO|SMARTPHONE|MOBILE\s*PHONE|TABLET|IPAD|LAPTOP|MACBOOK|SMARTWATCH|HEADPHONES|EARBUDS|TELEVISION|SMART\s*TV|OLED|QLED)\b/.test(text)) {
      electronicsScore += 45;
      signals.push('electronics_keyword');
    }
    if (/\b(?:NOTHING\s*PHONE|IPHONE|ONEPLUS|XIAOMI|REDMI|REALME|OPPO|VIVO|SAMSUNG\s*GALAXY|ASUS|DELL|HP|LENOVO|ACER|SONY\s*BRAVIA|APPLE)\b/.test(text)) {
      electronicsScore += 30;
      signals.push('electronics_brand');
    }
    if (electronicsScore >= 40) {
      return {
        documentType: 'ELECTRONICS_INVOICE',
        confidence: Math.min(1.0, electronicsScore / 100),
        signals,
        suggestedAssetCategory: 'Electronics'
      };
    }

    // 7. WARRANTY DOCUMENT
    if (/\b(?:WARRANTY\s*CARD|EXTENDED\s*WARRANTY|WARRANTY\s*CERTIFICATE|GUARANTEE\s*CARD)\b/.test(text)) {
      return {
        documentType: 'WARRANTY_DOCUMENT',
        confidence: 0.90,
        signals: ['warranty_card_header'],
        suggestedAssetCategory: 'General'
      };
    }

    // 8. SALES / PURCHASE INVOICE
    let salesScore = 0;
    if (/\b(?:TAX\s*INVOICE|RETAIL\s*INVOICE|BILL\s*OF\s*SUPPLY|CASH\s*MEMO|SALES\s*INVOICE)\b/.test(text)) {
      salesScore += 40;
      signals.push('sales_invoice_header');
    }
    if (/\b(?:GSTIN|HSN|SAC|DESCRIPTION\s*OF\s*GOODS|QTY|UNIT\s*PRICE|SUBTOTAL|GRAND\s*TOTAL)\b/.test(text)) {
      salesScore += 30;
      signals.push('gst_invoice_structure');
    }
    if (salesScore >= 40) {
      return {
        documentType: 'SALES_INVOICE',
        confidence: Math.min(1.0, salesScore / 100),
        signals,
        suggestedAssetCategory: 'General'
      };
    }

    return {
      documentType: 'GENERIC_DOCUMENT',
      confidence: 0.50,
      signals: ['generic_fallback'],
      suggestedAssetCategory: 'General'
    };
  }
}

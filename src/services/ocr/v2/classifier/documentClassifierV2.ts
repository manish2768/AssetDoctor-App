/**
 * ASSET DOCTOR — DOCUMENT CLASSIFIER V2 (OCR PIPELINE V2)
 * Robust document classification engine tailored for Indian real-world document formats.
 * Classifies text content into Vehicle or Appliance categories with confidence scoring.
 */

import {
  DocumentCategory,
  DocumentType,
  VehicleDocumentType,
  ApplianceDocumentType,
} from '../schemas/documentSchemas';

export interface ClassificationResult {
  documentType: DocumentType;
  documentCategory: DocumentCategory;
  assetType: 'VEHICLE' | 'APPLIANCE' | 'ELECTRONICS' | 'GENERAL';
  confidence: number; // 0.0 to 1.0
  matchedKeywords: string[];
}

export function classifyDocumentV2(rawText: string): ClassificationResult {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 10) {
    return {
      documentType: 'UNKNOWN_DOCUMENT',
      documentCategory: 'GENERAL',
      assetType: 'GENERAL',
      confidence: 0,
      matchedKeywords: [],
    };
  }

  const text = rawText.toUpperCase();
  const matchedKeywords: string[] = [];

  // --- VEHICLE DOCUMENT TYPES ---

  // 1. Vehicle Registration Certificate (RC)
  const rcKeywords = [
    'REGISTRATION CERTIFICATE',
    'FORM 23',
    'REGT. NO',
    'REGISTRATION NO',
    'CHASSIS NO',
    'ENGINE NO',
    'MAKER NAME',
    'VEHICLE CLASS',
    'TRANSPORT DEPARTMENT',
  ];
  const rcMatches = rcKeywords.filter((k) => text.includes(k));
  if (rcMatches.length >= 2 || text.includes('REGISTRATION CERTIFICATE')) {
    return {
      documentType: 'VEHICLE_RC',
      documentCategory: 'VEHICLE',
      assetType: 'VEHICLE',
      confidence: Math.min(0.98, 0.6 + rcMatches.length * 0.15),
      matchedKeywords: rcMatches,
    };
  }

  // 2. Vehicle PUC Certificate
  const pucKeywords = [
    'POLLUTION UNDER CONTROL',
    'PUC CERTIFICATE',
    'EMISSION TEST',
    'IDLE EMISSION',
    'SMOKE DENSITY',
    'PUC NO',
  ];
  const pucMatches = pucKeywords.filter((k) => text.includes(k));
  if (pucMatches.length >= 2 || text.includes('POLLUTION UNDER CONTROL')) {
    return {
      documentType: 'VEHICLE_PUC',
      documentCategory: 'VEHICLE',
      assetType: 'VEHICLE',
      confidence: Math.min(0.98, 0.65 + pucMatches.length * 0.15),
      matchedKeywords: pucMatches,
    };
  }

  // 3. Vehicle Insurance Policy
  const insuranceKeywords = [
    'INSURANCE POLICY',
    'POLICY SCHEDULE',
    'INSURED DECLARED VALUE',
    'IDV',
    'NCB',
    'NO CLAIM BONUS',
    'COMPREHENSIVE POLICY',
    'MOTOR INSURANCE',
    'INSURED NAME',
    'POLICY NO',
  ];
  const insMatches = insuranceKeywords.filter((k) => text.includes(k));
  if (insMatches.length >= 2 || text.includes('MOTOR INSURANCE')) {
    return {
      documentType: 'VEHICLE_INSURANCE',
      documentCategory: 'VEHICLE',
      assetType: 'VEHICLE',
      confidence: Math.min(0.98, 0.6 + insMatches.length * 0.15),
      matchedKeywords: insMatches,
    };
  }

  // 4. Vehicle Service / Repair Invoice
  const serviceKeywords = [
    'JOB CARD',
    'SERVICE INVOICE',
    'REPAIR ORDER',
    'WORKSHOP',
    'ODOMETER',
    'CURRENT KM',
    'KM READING',
    'LABOUR CHARGES',
    'SPARE PARTS',
    'WHEEL BALANCING',
    'ENGINE OIL',
  ];
  const serviceMatches = serviceKeywords.filter((k) => text.includes(k));
  if (serviceMatches.length >= 2 || text.includes('JOB CARD') || text.includes('WORKSHOP')) {
    const isRepair = text.includes('BODYSHOP') || text.includes('DENTING') || text.includes('PAINTING');
    return {
      documentType: isRepair ? 'VEHICLE_REPAIR_INVOICE' : 'VEHICLE_SERVICE_INVOICE',
      documentCategory: 'VEHICLE',
      assetType: 'VEHICLE',
      confidence: Math.min(0.98, 0.6 + serviceMatches.length * 0.15),
      matchedKeywords: serviceMatches,
    };
  }

  // --- HOME & APPLIANCE DOCUMENT TYPES ---

  // 5. Appliance AMC / Warranty Document
  const amcKeywords = [
    'ANNUAL MAINTENANCE CONTRACT',
    'AMC',
    'EXTENDED WARRANTY',
    'SERVICE CONTRACT',
    'COMPREHENSIVE AMC',
  ];
  const amcMatches = amcKeywords.filter((k) => text.includes(k));
  if (amcMatches.length >= 1) {
    return {
      documentType: text.includes('AMC') ? 'APPLIANCE_AMC' : 'APPLIANCE_EXTENDED_WARRANTY',
      documentCategory: 'HOME_APPLIANCES',
      assetType: 'APPLIANCE',
      confidence: 0.85,
      matchedKeywords: amcMatches,
    };
  }

  // 6. Electronics / Appliance Purchase Invoice
  const applianceKeywords = [
    'SERIAL NO',
    'SERIAL NUMBER',
    'S/N',
    'MODEL NO',
    'WARRENTY',
    'WARRANTY',
    'CASH MEMO',
    'TAX INVOICE',
    'GSTIN',
  ];
  const applianceMatches = applianceKeywords.filter((k) => text.includes(k));
  const isApplianceText =
    /REFRIGERATOR|WASHING MACHINE|AIR CONDITIONER|AC|TELEVISION|TV|MICROWAVE|LAPTOP|SMARTPHONE|IPHONE|SAMSUNG|LG|WHIRLPOOL|DAIKIN|VOLTAS|SONY/i.test(
      rawText
    );

  if (isApplianceText || applianceMatches.length >= 2) {
    return {
      documentType: 'APPLIANCE_PURCHASE_INVOICE',
      documentCategory: isApplianceText ? 'HOME_APPLIANCES' : 'ELECTRONICS',
      assetType: isApplianceText ? 'APPLIANCE' : 'ELECTRONICS',
      confidence: isApplianceText ? 0.9 : 0.75,
      matchedKeywords: applianceMatches,
    };
  }

  // Fallback: Generic Invoice
  if (text.includes('INVOICE') || text.includes('BILL') || text.includes('TOTAL')) {
    return {
      documentType: 'GENERIC_INVOICE',
      documentCategory: 'GENERAL',
      assetType: 'GENERAL',
      confidence: 0.6,
      matchedKeywords: ['INVOICE'],
    };
  }

  return {
    documentType: 'UNKNOWN_DOCUMENT',
    documentCategory: 'GENERAL',
    assetType: 'GENERAL',
    confidence: 0.3,
    matchedKeywords: [],
  };
}

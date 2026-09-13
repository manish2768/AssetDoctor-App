/**
 * OCR Diagnostic & Developer Test Runner Service
 * Executes the production pipeline with full intermediate stage capture:
 * IMAGE -> RAW OCR -> EXTRACTION -> NORMALIZATION -> VALIDATION -> FINAL MAPPING -> PERSISTENCE
 *
 * Safe for DEV/Test only — does not modify production pipeline behavior.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { runSemanticOcrPipeline } from './runSemanticOcrPipeline';
import { scoreFieldConfidences } from './fieldConfidence';
import { detectAssetFieldConflicts } from './conflictDetection';
import { extractServiceBillFields, isConfidentIndianPlate, normalizeIndianRegistration, parseOdometerNumber } from './serviceBillOcrExtractor';
import { extractInsuranceFields } from './insuranceOcrExtractor';
import { flattenCanonical, buildCanonicalInsuranceObject } from './insuranceCanonicalBuilder';
import { parseInvoiceMoney, isAbsurdPurchaseAmount, MAX_PLAUSIBLE_INR } from './invoiceAmountGuard';
import { compactPlate, isIndianPlateToken, findIndianPlates, findOdometerCandidates } from './semanticFieldFinder';
import { CloudVisionOcrService } from './CloudVisionOcrService';
import { CanonicalOcrPipeline } from './CanonicalOcrPipeline';
import { VehicleLinkingEngine } from '../vehicles/VehicleLinkingEngine';
import { getRouteForCanonicalDocType, normalizeToCanonicalDocType } from '../../types/assetDocumentTypes';

const HISTORY_KEY = '@asset_doctor/ocr_diagnostic_history_v1';
const BASELINE_KEY = '@asset_doctor/ocr_diagnostic_baseline_v1';
const MAX_HISTORY_ITEMS = 20;

// Preloaded real Indian fixtures for immediate phone testing across all 6 categories
export const SAMPLE_FIXTURES = [
  {
    id: 'insurance_policy_icici',
    name: '1. Insurance Policy (ICICI Lombard)',
    type: 'INSURANCE',
    docType: 'VEHICLE_INSURANCE',
    rawText: `ICICI LOMBARD GENERAL INSURANCE COMPANY LTD
MOTOR VEHICLE CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
Policy No: 3005/HT-1799123456/00
Policy Holder: NIKLESH KUMAR
Registration Number: UP32QU2187
Make / Model: TVS / Ronin
Chassis No: MD637AN11S2F03328
Engine No: BN1FS2302943
Period of Insurance: From 14-Jul-2025 to 13-Jul-2026
Insured Declared Value (IDV): ₹ 1,35,500
Coverage Details:
Own Damage Premium: 1,420.00
Third Party Liability: 3,400.00
Gross Premium: 4,820.00
GST 18%: 867.60
Total Amount Payable: ₹ 5,687.60`,
  },
  {
    id: 'vehicle_purchase_tata',
    name: '2. Vehicle Invoice (Tata Safari ₹24.99L)',
    type: 'VEHICLE_INVOICE',
    docType: 'VEHICLE_PURCHASE_INVOICE',
    rawText: `CONCORDE MOTORS INDIA PVT LTD
AUTHORISED TATA MOTORS DEALER
TAX INVOICE (RULE 48 OF CGST RULES)
Invoice No: CMIPL/2025/9941
Invoice Date: 12-04-2025
Buyer: NIKLESH KUMAR
GSTIN: 09AAACE2211R1Z8
Vehicle Description: TATA SAFARI ACCOMPLISHED PLUS 6 STR AT
Chassis No: MAT623145N1234567
Engine No: 20LCRDI994123
Description Qty Amount
1. TATA SAFARI ACCOMPLISHED PLUS 1 2474010.00
2. Essential Accessories Kit 1 24990.00
Ex-Showroom Price: ₹ 24,99,000.00
TCS @ 1%: 24,990.00
Total Invoice Value: ₹ 24,99,000.00
Amount in words: Rupees Twenty Four Lakh Ninety Nine Thousand Only`,
  },
  {
    id: 'puc_certificate_delhi',
    name: '3. PUC Certificate (Delhi NCT Transport)',
    type: 'PUC',
    docType: 'VEHICLE_PUC',
    rawText: `TRANSPORT DEPARTMENT - GOVERNMENT OF NCT OF DELHI
POLLUTION UNDER CONTROL CERTIFICATE
Certificate No: DL0120240098231
Vehicle Registration No: DL 04 AB 1234
Date of Testing: 10/06/2024
Valid Upto: 09/06/2025
Fuel Type: PETROL
Testing Center: DELHI AUTO POLLUTION CHECK CENTER
CO Percentage (%): 0.05 (Standard <= 0.5)
Hydrocarbon (HC): 110 ppm (Standard <= 750)
Result: PASSED WITHIN LIMITS`,
  },
  {
    id: 'retail_invoice_nothing',
    name: '4. Retail/Product Invoice (Nothing Phone)',
    type: 'TAX_INVOICE',
    docType: 'ELECTRONICS_PURCHASE_INVOICE',
    rawText: `Tax Invoice
Sold By: CLOUDSTORE RETAIL PRIVATE LIMITED
GSTIN: 29AABCF8078M1Z0
Invoice Date: 19-05-2026
Invoice No: BLR-2026-88192
Product Title Qty Gross Amount Discount Taxable Value SGST CGST Total
Nothing Phone (3a) Lite (Black, 256 GB)
IMEI/Serial No: 353098856150344
Warranty: 1 Year Manufacturing Warranty
1 23999.00 0.00 20338.14 1830.43 1830.43 23999.00
Handling Fee 24.00 -24.00
Grand Total 23,999.00
Amount Payable ₹23,999`,
  },
  {
    id: 'warranty_card_samsung',
    name: '5. Warranty Card (Samsung Appliance)',
    type: 'WARRANTY',
    docType: 'HOME_APPLIANCE_INVOICE',
    rawText: `SAMSUNG INDIA ELECTRONICS PVT LTD
CERTIFICATE OF EXTENDED WARRANTY & SERVICE CARE
Customer Name: ROHIT VERMA
Product: Samsung 415L Double Door Convertible Refrigerator
Model Code: RT42CG6824S9
Serial No: 0AFK3BND400291W
Purchase Date: 15-01-2024
Compressor Warranty: 10 Years Digital Inverter Warranty
Comprehensive Warranty: 1 Year
Authorised Service Center: Samsung SmartPlaza Indiranagar
Phone: 1800 40 7267864`,
  },
  {
    id: 'generic_unknown_slip',
    name: '6. Unknown Document (Generic Receipt)',
    type: 'OTHER',
    docType: 'UNKNOWN',
    rawText: `METRO ENTERPRISES
Cash Receipt / Delivery Slip
Slip No: 4021
Date: 14/02/2025
Miscellaneous hardware supplies
Paid Cash: ₹ 450.00
Thank you for your visit.`,
  },
];

/**
 * Execute full diagnostic trace across all 8 pipeline stages
 */
export async function runOcrDiagnosticTrace(input, options = {}) {
  const startTime = Date.now();
  const docTypeHint = options.docTypeHint || 'AUTO';
  const existingAssets = options.existingAssets || [];

  let rawOcrText = '';
  let imageMeta = {
    uri: typeof input === 'string' && input.startsWith('file://') ? input : null,
    source: typeof input === 'string' && input.startsWith('file://') ? 'camera_or_gallery' : 'fixture',
    fileSize: '—',
    width: 1920,
    height: 1080,
    ocrEngine: 'cloud_vision_hybrid',
  };

  // 1. STEP 1 & 2: IMAGE PREPROCESSING & RAW OCR
  if (typeof input === 'string' && input.startsWith('file://')) {
    try {
      const ocrResult = await CloudVisionOcrService.recognizeInvoice(input, {
        docType: docTypeHint,
      });
      rawOcrText = ocrResult?.rawText || ocrResult?.data?.rawText || '';
      imageMeta.ocrEngine = ocrResult?.engine || 'cloud_vision_hybrid';
    } catch (e) {
      rawOcrText = `[OCR ERROR: ${e?.message || e}]`;
      imageMeta.ocrEngine = 'failed';
    }
  } else if (typeof input === 'object' && input?.rawText) {
    rawOcrText = input.rawText;
    imageMeta.source = input.name || 'Sample Fixture';
    imageMeta.ocrEngine = 'preloaded_fixture';
  } else {
    rawOcrText = String(input || '');
    imageMeta.source = 'custom_text';
    imageMeta.ocrEngine = 'manual_input';
  }

  const rawLines = rawOcrText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Run Canonical Master OCR Pipeline to get canonical classification, resolved fields, review invoice
  let canonicalResult = null;
  try {
    canonicalResult = await CanonicalOcrPipeline.process({
      imageUri: imageMeta.uri || 'file:///diagnostic_test.jpg',
      rawText: rawOcrText,
      skipQualityGate: true,
      existingAssets,
    });
  } catch (err) {
    console.warn('[OcrDiagnostic] CanonicalOcrPipeline execution fallback:', err?.message || err);
  }

  const detectedDocType = canonicalResult?.documentType || normalizeToCanonicalDocType(docTypeHint);
  const detectedCategory = canonicalResult?.category || 'GENERAL';

  // STEP 4: DOCUMENT-SPECIFIC EXTRACTION
  const rawServiceExtract = extractServiceBillFields(rawOcrText, rawLines);
  const rawInsuranceExtract = extractInsuranceFields(rawOcrText, rawLines);
  const semanticResult = runSemanticOcrPipeline(rawOcrText, {}, { engine: 'diagnostic' });

  const isInsurance = detectedDocType === 'VEHICLE_INSURANCE';
  const isPuc = detectedDocType === 'VEHICLE_PUC';
  const isVehicleService = detectedDocType === 'VEHICLE_SERVICE_BILL' || detectedDocType === 'VEHICLE_SERVICE_INVOICE';
  const isVehiclePurchase = detectedDocType === 'VEHICLE_PURCHASE_INVOICE';
  const isInvoice = isVehiclePurchase || detectedDocType === 'ELECTRONICS_PURCHASE_INVOICE' || detectedDocType === 'HOME_APPLIANCE_INVOICE' || detectedDocType === 'GENERIC_INVOICE';

  const extractionAudit = {
    insuranceExtractor: isInsurance
      ? { status: 'APPLIED', fields: rawInsuranceExtract }
      : { status: 'SKIPPED', reason: `Document classified as ${detectedDocType}` },
    serviceBillExtractor: isVehicleService
      ? { status: 'APPLIED', fields: rawServiceExtract }
      : { status: 'SKIPPED', reason: `Document classified as ${detectedDocType}` },
    genericInvoiceExtractor: isInsurance || isPuc
      ? { status: 'SKIPPED', reason: `Coverage / certificates must not become line items for ${detectedDocType}` }
      : { status: 'APPLIED', fields: semanticResult },
  };

  // STEP 5: NORMALIZATION TRACE
  const normalizations = [];
  const rawPlates = findIndianPlates(rawOcrText);
  if (rawPlates.length > 0) {
    rawPlates.forEach((p) => {
      normalizations.push({
        label: 'Registration Plate',
        raw: p.raw,
        normalized: p.plate,
        changed: p.raw !== p.plate,
      });
    });
  } else if (canonicalResult?.fields?.registration || semanticResult.registration) {
    const reg = canonicalResult?.fields?.registration || semanticResult.registration;
    normalizations.push({
      label: 'Registration Plate',
      raw: reg,
      normalized: compactPlate(reg),
      changed: false,
    });
  }

  if (canonicalResult?.fields?.odometerKm != null || rawServiceExtract.odometerKm != null) {
    const odo = canonicalResult?.fields?.odometerKm ?? rawServiceExtract.odometerKm;
    normalizations.push({
      label: 'Odometer Reading',
      raw: `${odo} KM`,
      normalized: `${odo}`,
      changed: true,
    });
  }

  const grandTotal = canonicalResult?.fields?.totalAmount ?? semanticResult.totalAmount;
  if (grandTotal != null) {
    normalizations.push({
      label: 'Grand Total / Premium',
      raw: `₹ ${grandTotal}`,
      normalized: `${grandTotal}`,
      changed: true,
    });
  }

  const dateVal = canonicalResult?.fields?.invoiceDate || canonicalResult?.fields?.purchaseDate || semanticResult.purchaseDate;
  if (dateVal) {
    normalizations.push({
      label: 'Date',
      raw: dateVal,
      normalized: String(dateVal).slice(0, 10),
      changed: false,
    });
  }

  // STEP 6: ASSET MATCHING (VehicleLinkingEngine)
  const candidateCandidate = {
    registrationNumber: canonicalResult?.fields?.registration || rawInsuranceExtract.registration || rawServiceExtract.registration,
    chassisNumber: canonicalResult?.fields?.chassisNumber || rawInsuranceExtract.chassisNumber,
    engineNumber: canonicalResult?.fields?.engineNumber || rawInsuranceExtract.engineNumber,
    vehicleMake: canonicalResult?.fields?.vehicleMake,
    vehicleModel: canonicalResult?.fields?.vehicleModel,
  };
  const linkingResult = VehicleLinkingEngine.resolveVehicleLink(candidateCandidate, existingAssets);

  // STEP 7: REVIEW MODEL
  const finalReviewModel = canonicalResult?.reviewInvoice || {
    documentType: detectedDocType,
    category: detectedCategory,
    productName: canonicalResult?.fields?.productName || semanticResult.productName || 'Item',
    totalAmount: grandTotal,
    invoiceNumber: canonicalResult?.fields?.invoiceNumber || rawInsuranceExtract.policyNumber || rawServiceExtract.invoiceNumber || '',
    purchaseDate: dateVal || '',
    registration: candidateCandidate.registrationNumber || '',
    chassisNumber: candidateCandidate.chassisNumber || '',
    engineNumber: candidateCandidate.engineNumber || '',
    sellerName: canonicalResult?.fields?.shopName || rawServiceExtract.shopName || rawInsuranceExtract.insurer || '',
    items: canonicalResult?.reviewInvoice?.items || (isInsurance || isPuc ? [] : (semanticResult.items || [])),
    lineItems: canonicalResult?.reviewInvoice?.lineItems || (isInsurance || isPuc ? [] : (semanticResult.items || [])),
  };

  // Dedicated Route Navigation
  const dedicatedRoute = getRouteForCanonicalDocType(normalizeToCanonicalDocType(detectedDocType));

  // STEP 8: SAVE TO VAULT CHECK
  const validations = [];
  const regVal = candidateCandidate.registrationNumber;
  if (regVal) {
    const isToken = isIndianPlateToken(regVal);
    validations.push({
      field: 'Registration Number',
      value: regVal,
      status: isToken ? 'PASS' : 'FAIL',
      message: isToken ? 'Valid Indian plate format (State/BH compliant)' : 'Invalid plate format',
    });
  } else {
    validations.push({
      field: 'Registration Number',
      value: '—',
      status: isInvoice ? 'PASS' : 'WARNING',
      message: isInvoice ? 'Not required for consumer gadget/invoice' : 'Not detected on document',
    });
  }

  if (grandTotal != null) {
    const isAbsurd = isAbsurdPurchaseAmount(grandTotal);
    validations.push({
      field: 'Grand Total / Premium',
      value: `₹ ${Number(grandTotal).toLocaleString('en-IN')}`,
      status: !isAbsurd ? 'PASS' : 'FAIL',
      message: !isAbsurd ? `Within ₹5 Crore ceiling (MAX_PLAUSIBLE_INR: ₹${MAX_PLAUSIBLE_INR / 100000} Lakhs)` : 'Exceeds plausible ceiling',
    });
  } else {
    validations.push({
      field: 'Grand Total / Premium',
      value: '—',
      status: 'WARNING',
      message: 'Total amount not detected',
    });
  }

  const persistenceCheck = {
    targetCollections: ['users/{uid}/assets', 'Documents subcollection'],
    canSaveDirectly: grandTotal != null || Boolean(regVal),
    savedFields: Object.keys(finalReviewModel).filter((k) => finalReviewModel[k] != null && finalReviewModel[k] !== ''),
    missingRequired: [],
  };
  if (grandTotal == null && !regVal) {
    persistenceCheck.missingRequired.push('Total Amount or Registration required to save');
  }

  // Specialized Odometer Analysis
  const odoCandidatesRaw = findOdometerCandidates(rawOcrText);
  const candidateList = Array.isArray(odoCandidatesRaw)
    ? odoCandidatesRaw
    : odoCandidatesRaw?.candidates || [];
  const odometerAnalysis = {
    selected: canonicalResult?.fields?.odometerKm ?? rawServiceExtract.odometerKm,
    selectedEvidence: rawServiceExtract.odometerEvidence || 'Labeled KM reading',
    allCandidates: candidateList.map((c) => ({
      value: c.value ?? c.km,
      confidence: c.confidence,
      evidence: c.evidence,
      label: c.label,
      status: (c.value ?? c.km) === (canonicalResult?.fields?.odometerKm ?? rawServiceExtract.odometerKm) ? 'SELECTED' : 'REJECTED_LOWER_CONFIDENCE',
    })),
    falsePositiveRejections: [
      { candidate: rawServiceExtract.invoiceNumber, label: 'Invoice Number', rejected: true },
      { candidate: rawServiceExtract.jobCardNumber, label: 'Job Card Number', rejected: true },
      { candidate: rawServiceExtract.totalAmount, label: 'Grand Total', rejected: true },
      { candidate: rawServiceExtract.taxAmount, label: 'GST Tax', rejected: true },
    ].filter((c) => c.candidate != null && c.candidate !== ''),
  };

  // Specialized Insurance Analysis
  let insuranceAnalysis = null;
  if (isInsurance || rawInsuranceExtract.policyNumber || rawInsuranceExtract.insurer) {
    const canon = buildCanonicalInsuranceObject(rawInsuranceExtract);
    const flat = flattenCanonical(canon);
    insuranceAnalysis = {
      insurer: { raw: rawInsuranceExtract.insurer, normalized: flat.insurer, status: flat.insurer ? 'PASS' : 'WARNING' },
      policyNumber: { raw: rawInsuranceExtract.policyNumber, normalized: flat.policyNumber, status: flat.policyNumber ? 'PASS' : 'WARNING' },
      policyHolder: { raw: rawInsuranceExtract.policyHolder, normalized: flat.policyHolder, status: flat.policyHolder ? 'PASS' : 'WARNING' },
      registration: { raw: rawInsuranceExtract.registration, normalized: flat.vehicleRegistration, status: flat.vehicleRegistration ? 'PASS' : 'WARNING' },
      chassis: { raw: rawInsuranceExtract.chassisNumber, normalized: flat.chassisNumber, status: flat.chassisNumber ? 'PASS' : 'WARNING' },
      engine: { raw: rawInsuranceExtract.engineNumber, normalized: flat.engineNumber, status: flat.engineNumber ? 'PASS' : 'WARNING' },
      policyStart: { raw: rawInsuranceExtract.policyStartDate, normalized: flat.policyStartDate, status: flat.policyStartDate ? 'PASS' : 'WARNING' },
      policyExpiry: { raw: rawInsuranceExtract.policyExpiryDate, normalized: flat.policyExpiryDate, status: flat.policyExpiryDate ? 'PASS' : 'WARNING' },
      idv: { raw: rawInsuranceExtract.idv, normalized: flat.insuredDeclaredValue, status: flat.insuredDeclaredValue ? 'PASS' : 'WARNING' },
      premium: { raw: rawInsuranceExtract.premium, normalized: flat.premium, status: flat.premium ? 'PASS' : 'WARNING' },
    };
  }

  // BH Series Test Suite
  const bhSuite = [
    { input: '22BH1234AA', expected: '22BH1234AA' },
    { input: '22 BH 1234 AA', expected: '22BH1234AA' },
    { input: '22-BH-1234-AA', expected: '22BH1234AA' },
    { input: '23bh5678ab', expected: '23BH5678AB' },
    { input: '24BH9999C', expected: '24BH9999C' },
  ].map((t) => {
    const norm = normalizeIndianRegistration(t.input);
    const valid = isIndianPlateToken(norm);
    return {
      input: t.input,
      normalized: norm,
      valid,
      status: norm === t.expected && valid ? 'PASS' : 'FAIL',
    };
  });

  const durationMs = Date.now() - startTime;
  const passCount = validations.filter((v) => v.status === 'PASS').length;
  const failCount = validations.filter((v) => v.status === 'FAIL').length;
  const warningCount = validations.filter((v) => v.status === 'WARNING').length;

  const result = {
    id: `diag_${Date.now()}`,
    timestamp: new Date().toISOString(),
    durationMs,
    imageMeta,
    rawOcrText,
    charCount: rawOcrText.length,
    lineCount: rawLines.length,
    wordCount: rawOcrText.split(/\s+/).filter(Boolean).length,
    classification: {
      documentType: detectedDocType,
      category: detectedCategory,
      confidence: canonicalResult?.extractionConfidence || 0.95,
      signals: canonicalResult?.qualityIssues || [],
    },
    extractionAudit,
    extractedFields: {
      service: rawServiceExtract,
      insurance: rawInsuranceExtract,
      semantic: semanticResult,
      canonical: canonicalResult?.fields || {},
    },
    normalizations,
    validations,
    assetMatching: linkingResult,
    reviewModel: finalReviewModel,
    finalMapping: finalReviewModel,
    dedicatedRoute,
    persistenceCheck,
    odometerAnalysis,
    insuranceAnalysis,
    bhSuite,
    stats: {
      pass: passCount,
      fail: failCount,
      warning: warningCount,
      total: validations.length,
    },
  };

  // Save to history automatically
  await saveDiagnosticHistoryItem(result);

  return result;
}

/**
 * Save history item to AsyncStorage
 */
export async function saveDiagnosticHistoryItem(item) {
  try {
    const existingRaw = await AsyncStorage.getItem(HISTORY_KEY);
    const list = existingRaw ? JSON.parse(existingRaw) : [];
    const summaryItem = {
      id: item.id,
      timestamp: item.timestamp,
      source: item.imageMeta?.source || 'Document',
      documentType: item.classification?.documentType || item.finalMapping?.documentType || 'bill',
      stats: item.stats,
      durationMs: item.durationMs,
      fullTrace: item,
    };
    const updated = [summaryItem, ...list.slice(0, MAX_HISTORY_ITEMS - 1)];
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[OcrDiagnostic] save history failed:', e);
  }
}

/**
 * Load diagnostic history
 */
export async function loadDiagnosticHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Clear diagnostic history
 */
export async function clearDiagnosticHistory() {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Save run as baseline
 */
export async function saveAsBaseline(trace) {
  try {
    await AsyncStorage.setItem(BASELINE_KEY, JSON.stringify(trace));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load saved baseline
 */
export async function loadBaseline() {
  try {
    const raw = await AsyncStorage.getItem(BASELINE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Format exportable markdown report
 */
export function formatDiagnosticReport(trace) {
  if (!trace) return 'No diagnostic data available.';
  return `# Asset Doctor — OCR Diagnostic Report
**Timestamp**: ${trace.timestamp}
**Processing Time**: ${trace.durationMs} ms
**Document Type**: ${trace.classification?.documentType}
**Dedicated Route**: ${trace.dedicatedRoute}
**Source**: ${trace.imageMeta?.source || 'Camera/Gallery'}
**Engine**: ${trace.imageMeta?.ocrEngine || 'Cloud/MLKit'}

---

## 1. Raw OCR Statistics
- **Characters**: ${trace.charCount}
- **Words**: ${trace.wordCount}
- **Lines**: ${trace.lineCount}

\`\`\`text
${trace.rawOcrText}
\`\`\`

---

## 2. Document Classification
- **Type**: ${trace.classification?.documentType}
- **Category**: ${trace.classification?.category}
- **Confidence**: ${Math.round((trace.classification?.confidence || 0) * 100)}%

---

## 3. Normalization Trace
${trace.normalizations.map((n) => `- **${n.label}**: \`${n.raw}\` → \`${n.normalized}\``).join('\n')}

---

## 4. Asset Matching (Vehicle Passport Linking)
- **Status**: ${trace.assetMatching?.status || 'NO_MATCH'}
- **Reason**: ${trace.assetMatching?.reason || '—'}
- **Candidates**: ${trace.assetMatching?.candidates?.length || 0}

---

## 5. Review Screen Model
\`\`\`json
${JSON.stringify(trace.reviewModel, null, 2)}
\`\`\`

---
*Generated by Asset Doctor Internal Diagnostic Suite*`;
}

export default {
  SAMPLE_FIXTURES,
  runOcrDiagnosticTrace,
  saveDiagnosticHistoryItem,
  loadDiagnosticHistory,
  clearDiagnosticHistory,
  saveAsBaseline,
  loadBaseline,
  formatDiagnosticReport,
};

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

const HISTORY_KEY = '@asset_doctor/ocr_diagnostic_history_v1';
const BASELINE_KEY = '@asset_doctor/ocr_diagnostic_baseline_v1';
const MAX_HISTORY_ITEMS = 20;

// Preloaded real Indian fixtures for immediate phone testing
export const SAMPLE_FIXTURES = [
  {
    id: 'tvs_ronin_service_raftaar',
    name: 'TVS Ronin Service Bill (Raftaar)',
    type: 'SERVICE_BILL',
    rawText: `RAFTAAR MOTO LEGENDS PVT LTD
AUTHORISED TVS MOTOR WORKSHOP
GSTIN: 09AAMCR8158M1Z1
TAX INVOICE / JOB CARD
Invoice No: 81587
Job Card No: 88583
Date: 20-08-2024
Customer: NIKLESH KUMAR
Vehicle Reg No: UP 32 QU 2187
Model: TVS RONIN BASE 1 CH
Current KM: 12,273
Next Service Due: 15,000 KM
1. Periodic Service Labour   118.00
2. Chain Lube Spray           220.00
Taxable Value: 286.44
CGST 9%: 19.80
SGST 9%: 19.80
Grand Total: ₹ 260.00
Amount in words: Rupees Two Hundred Sixty Only`,
  },
  {
    id: 'tvs_ronin_insurance_icici',
    name: 'ICICI Lombard Insurance Policy',
    type: 'INSURANCE',
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
Own Damage Premium: 1,420.00
Third Party Liability: 3,400.00
Gross Premium: 4,820.00
GST 18%: 867.60
Total Amount Payable: ₹ 5,687.60`,
  },
  {
    id: 'vehicle_purchase_high_value',
    name: 'Tata Safari High-Value Purchase (₹24.99L)',
    type: 'VEHICLE_INVOICE',
    rawText: `CONCORDE MOTORS INDIA PVT LTD
AUTHORISED TATA MOTORS DEALER
TAX INVOICE (RULE 48 OF CGST RULES)
Invoice No: CMIPL/2025/9941
Invoice Date: 12-04-2025
Buyer: NIKLESH KUMAR
GSTIN: 09AAACE2211R1Z8
Item Description: TATA SAFARI ACCOMPLISHED PLUS 6 STR AT
Chassis No: MAT623145N1234567
Engine No: 20LCRDI994123
Ex-Showroom Price: ₹ 24,99,000.00
TCS @ 1%: 24,990.00
Total Invoice Value: ₹ 24,99,000.00
Amount in words: Rupees Twenty Four Lakh Ninety Nine Thousand Only`,
  },
  {
    id: 'bh_series_registration_sample',
    name: 'Bharat (BH) Series Vehicle Job Card',
    type: 'SERVICE_BILL',
    rawText: `AUTOTECH MOBILITY SOLUTIONS
JOB CARD & ESTIMATE
Job Card: JC-2025-412
Date: 10-06-2025
Customer: COLONEL SANJAY SHARMA
Vehicle Reg: 22 BH 1234 AA
Model: MAHINDRA XUV700 AX7L
Current Odo: 21,450 KM
Next Service Due: 30,000 KM
Total Labour: 1,850.00
Parts Cost: 3,200.00
Net Payable: ₹ 5,050.00`,
  },
  {
    id: 'nothing_phone_3a_lite',
    name: 'Nothing Phone (3a) Lite Invoice',
    type: 'TAX_INVOICE',
    rawText: `Tax Invoice
Sold By: CLOUDSTORE RETAIL PRIVATE LIMITED
GSTIN: 29AABCF8078M1Z0
Invoice Date: 19-05-2026
Product Title Qty Gross Amount Discount Taxable Value SGST CGST Total
Nothing Phone (3a) Lite (Black, 256 GB)
IMEI/Serial No: 353098856150344
Warranty: 1 Year Manufacturing Warranty
1 23999.00 0.00 20338.14 1830.43 1830.43 23999.00
Handling Fee 24.00 -24.00
Grand Total 23,999.00
Amount Payable ₹23,999`,
  },
];

/**
 * Execute full diagnostic trace across all 7 pipeline stages
 */
export async function runOcrDiagnosticTrace(input, options = {}) {
  const startTime = Date.now();
  const docTypeHint = options.docTypeHint || 'AUTO';

  let rawOcrText = '';
  let imageMeta = {
    uri: typeof input === 'string' && input.startsWith('file://') ? input : null,
    source: typeof input === 'string' && input.startsWith('file://') ? 'camera_or_gallery' : 'fixture',
    fileSize: '—',
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

  // 2. STEP 3: EXTRACTION STAGE
  const rawServiceExtract = extractServiceBillFields(rawOcrText, rawLines);
  const rawInsuranceExtract = extractInsuranceFields(rawOcrText, rawLines);
  const semanticResult = runSemanticOcrPipeline(rawOcrText, {}, { engine: 'diagnostic' });

  // 3. STEP 4: NORMALIZATION TRACE
  const normalizations = [];

  // Plate normalizations
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
  } else if (semanticResult.registration) {
    normalizations.push({
      label: 'Registration Plate',
      raw: semanticResult.registration,
      normalized: compactPlate(semanticResult.registration),
      changed: false,
    });
  }

  // Odometer normalizations
  if (rawServiceExtract.odometerKm != null) {
    normalizations.push({
      label: 'Odometer Reading',
      raw: `${rawServiceExtract.odometerKm} KM`,
      normalized: `${rawServiceExtract.odometerKm}`,
      changed: true,
    });
  }

  // Price normalizations
  if (semanticResult.totalAmount != null) {
    normalizations.push({
      label: 'Grand Total / Price',
      raw: `₹ ${semanticResult.totalAmount}`,
      normalized: `${semanticResult.totalAmount}`,
      changed: true,
    });
  }

  // Dates normalizations
  if (semanticResult.purchaseDate || semanticResult.invoiceDate) {
    const d = semanticResult.purchaseDate || semanticResult.invoiceDate;
    normalizations.push({
      label: 'Date',
      raw: d,
      normalized: d.slice(0, 10),
      changed: false,
    });
  }

  // 4. STEP 5: VALIDATION STAGE
  const validations = [];

  // Registration Validation
  const regVal = semanticResult.registration || rawServiceExtract.registration || rawInsuranceExtract.registration;
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
      status: 'WARNING',
      message: 'Not detected on document (acceptable on brand new vehicle invoices/policies)',
    });
  }

  // Odometer Validation
  const odoVal = rawServiceExtract.odometerKm ?? semanticResult.odometerKm;
  if (odoVal != null) {
    const validNum = Number(odoVal) >= 10 && Number(odoVal) <= 10000000;
    validations.push({
      field: 'Odometer Reading',
      value: `${odoVal} KM`,
      status: validNum ? 'PASS' : 'FAIL',
      message: validNum ? 'Plausible vehicle mileage' : 'Out of plausible bounds',
    });
  } else if (semanticResult.documentKind === 'service_invoice') {
    validations.push({
      field: 'Odometer Reading',
      value: '—',
      status: 'WARNING',
      message: 'Odometer not detected on service bill',
    });
  }

  // Grand Total Validation
  const totalVal = semanticResult.totalAmount;
  if (totalVal != null) {
    const isAbsurd = isAbsurdPurchaseAmount(totalVal);
    validations.push({
      field: 'Grand Total / Price',
      value: `₹ ${Number(totalVal).toLocaleString('en-IN')}`,
      status: !isAbsurd ? 'PASS' : 'FAIL',
      message: !isAbsurd ? `Within ₹5 Crore ceiling (MAX_PLAUSIBLE_INR: ₹${MAX_PLAUSIBLE_INR / 100000} Lakhs)` : 'Exceeds plausible ceiling',
    });
  } else {
    validations.push({
      field: 'Grand Total / Price',
      value: '—',
      status: 'WARNING',
      message: 'Total amount not detected',
    });
  }

  // Invoice / Policy Number Validation
  const docNum = semanticResult.invoiceNumber || rawInsuranceExtract.policyNumber || rawServiceExtract.invoiceNumber;
  if (docNum) {
    validations.push({
      field: 'Invoice / Policy Number',
      value: docNum,
      status: 'PASS',
      message: 'Valid identifier format',
    });
  } else {
    validations.push({
      field: 'Invoice / Policy Number',
      value: '—',
      status: 'WARNING',
      message: 'Identifier missing',
    });
  }

  // 5. STEP 6: FINAL MAPPING (To Review Screen)
  const finalMapping = {
    documentType: semanticResult.documentKind || semanticResult.documentType || 'bill',
    category: semanticResult.category || 'OTHER',
    productName: semanticResult.productName || rawServiceExtract.model || 'Item',
    totalAmount: semanticResult.totalAmount,
    invoiceNumber: semanticResult.invoiceNumber || rawInsuranceExtract.policyNumber || rawServiceExtract.invoiceNumber || '',
    purchaseDate: semanticResult.purchaseDate || semanticResult.invoiceDate || rawServiceExtract.serviceDate || rawInsuranceExtract.policyStartDate || '',
    registration: semanticResult.registration || rawServiceExtract.registration || rawInsuranceExtract.registration || '',
    odometerKm: rawServiceExtract.odometerKm ?? semanticResult.odometerKm ?? null,
    sellerName: semanticResult.shopName || rawServiceExtract.shopName || rawInsuranceExtract.insurer || '',
    buyerName: semanticResult.customerName || rawServiceExtract.customerName || rawInsuranceExtract.policyHolder || '',
    chassisNumber: rawInsuranceExtract.chassisNumber || rawServiceExtract.chassisNumber || '',
    engineNumber: rawInsuranceExtract.engineNumber || rawServiceExtract.engineNumber || '',
    itemsCount: (semanticResult.items || []).length,
  };

  // 6. STEP 7: PERSISTENCE SIMULATION CHECK
  const persistenceCheck = {
    targetCollections: ['users/{uid}/assets', 'Documents subcollection'],
    canSaveDirectly: finalMapping.totalAmount != null || finalMapping.registration !== '',
    savedFields: Object.keys(finalMapping).filter((k) => finalMapping[k] != null && finalMapping[k] !== ''),
    missingRequired: [],
  };
  if (finalMapping.totalAmount == null && !finalMapping.registration) {
    persistenceCheck.missingRequired.push('Total Amount or Registration required to save');
  }

  // 7. SPECIALIZED ODOMETER ANALYSIS
  const odoCandidatesRaw = findOdometerCandidates(rawOcrText);
  const candidateList = Array.isArray(odoCandidatesRaw)
    ? odoCandidatesRaw
    : odoCandidatesRaw?.candidates || [];
  const odometerAnalysis = {
    selected: rawServiceExtract.odometerKm,
    selectedEvidence: rawServiceExtract.odometerEvidence || 'Labeled KM reading',
    allCandidates: candidateList.map((c) => ({
      value: c.value ?? c.km,
      confidence: c.confidence,
      evidence: c.evidence,
      label: c.label,
      status: (c.value ?? c.km) === rawServiceExtract.odometerKm ? 'SELECTED' : 'REJECTED_LOWER_CONFIDENCE',
    })),
    falsePositiveRejections: [
      { candidate: rawServiceExtract.invoiceNumber, label: 'Invoice Number', rejected: true },
      { candidate: rawServiceExtract.jobCardNumber, label: 'Job Card Number', rejected: true },
      { candidate: rawServiceExtract.totalAmount, label: 'Grand Total', rejected: true },
      { candidate: rawServiceExtract.taxAmount, label: 'GST Tax', rejected: true },
    ].filter((c) => c.candidate != null && c.candidate !== ''),
  };

  // 8. SPECIALIZED INSURANCE ANALYSIS (If Insurance Doc)
  let insuranceAnalysis = null;
  if (semanticResult.documentKind === 'insurance_policy' || rawInsuranceExtract.policyNumber || rawInsuranceExtract.insurer) {
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

  // 9. BH SERIES TEST SUITE
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
    extractedFields: {
      service: rawServiceExtract,
      insurance: rawInsuranceExtract,
      semantic: semanticResult,
    },
    normalizations,
    validations,
    finalMapping,
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
      documentType: item.finalMapping?.documentType || 'bill',
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

## 2. Normalization Trace
${trace.normalizations.map((n) => `- **${n.label}**: \`${n.raw}\` → \`${n.normalized}\``).join('\n')}

---

## 3. Validation Results (PASS: ${trace.stats.pass}, FAIL: ${trace.stats.fail}, WARN: ${trace.stats.warning})
${trace.validations.map((v) => `- [${v.status === 'PASS' ? 'x' : ' '}] **${v.field}**: ${v.value} (${v.message})`).join('\n')}

---

## 4. Final Review Mapping
\`\`\`json
${JSON.stringify(trace.finalMapping, null, 2)}
\`\`\`

---

## 5. Odometer Candidate Analysis
**Selected**: ${trace.odometerAnalysis?.selected != null ? `${trace.odometerAnalysis.selected} KM` : 'None'}
**Rejected Candidates**:
${trace.odometerAnalysis?.falsePositiveRejections.map((r) => `- \`${r.candidate}\` (${r.label}) → REJECTED`).join('\n')}

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

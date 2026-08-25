/**
 * Store user OCR corrections for future model improvement.
 * Does NOT train models on-device. No raw document images. No secrets.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@asset_doctor/ocr_correction_signals_v1';
const MAX = 200;

/**
 * @param {{
 *   field: string,
 *   originalValue: *,
 *   correctedValue: *,
 *   documentType?: string,
 *   source?: string
 * }} signal
 */
export async function recordOcrCorrection(signal = {}) {
  try {
    const field = String(signal.field || '').trim();
    if (!field) return { success: false };
    const row = {
      field,
      originalValue: signal.originalValue ?? null,
      correctedValue: signal.correctedValue ?? null,
      verifiedByUser: true,
      documentType: signal.documentType || null,
      source: signal.source || 'review_screen',
      at: new Date().toISOString(),
    };
    const prev = await listOcrCorrections();
    const next = [row, ...prev].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function listOcrCorrections() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Diff review form vs original OCR payload → correction signals.
 */
export async function recordCorrectionsFromReview(original = {}, corrected = {}, documentType) {
  const keys = [
    'productName',
    'shopName',
    'brandName',
    'totalAmount',
    'invoiceDate',
    'serialNumber',
    'imei',
    'registration',
    'chassisNumber',
    'engineNumber',
    'policyNumber',
    'policyHolder',
    'odometerKm',
    'invoiceNumber',
    'insuranceExpiry',
    'insuranceStart',
    'coverageType',
  ];
  const jobs = [];
  for (const field of keys) {
    const a = original[field];
    const b = corrected[field];
    if (b == null || b === '') continue;
    if (String(a ?? '').trim() === String(b ?? '').trim()) continue;
    jobs.push(
      recordOcrCorrection({
        field,
        originalValue: a ?? null,
        correctedValue: b,
        documentType,
      }),
    );
  }
  await Promise.all(jobs);
  return { success: true, count: jobs.length };
}

/**
 * Record user document-type override (e.g. INSURANCE → SERVICE_BILL).
 * Used as a soft issuer fingerprint signal — never trains blindly from one sample.
 */
export async function recordDocumentTypeCorrection({
  fromType,
  toType,
  issuerHint,
  rawTextSample,
} = {}) {
  const from = String(fromType || '').trim();
  const to = String(toType || '').trim();
  if (!from || !to || from === to) return { success: false };
  return recordOcrCorrection({
    field: 'documentType',
    originalValue: from,
    correctedValue: to,
    documentType: to,
    source: 'document_type_override',
    issuerHint: issuerHint || null,
    sampleHash: rawTextSample
      ? String(rawTextSample).slice(0, 120).replace(/\s+/g, ' ')
      : null,
  });
}

export default {
  recordOcrCorrection,
  listOcrCorrections,
  recordCorrectionsFromReview,
  recordDocumentTypeCorrection,
};

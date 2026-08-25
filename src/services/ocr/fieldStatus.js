/**
 * Field-level OCR status — never invent a value to look complete.
 * A document can be readable while one field is needs_review / not_detected.
 */

export const FIELD_STATUS = Object.freeze({
  VALID: 'valid',
  NEEDS_REVIEW: 'needs_review',
  NOT_DETECTED: 'not_detected',
  INVALID: 'invalid',
  CONFLICT: 'conflict',
  USER_VERIFIED: 'user_verified',
});

export const FIELD_SOURCE = Object.freeze({
  OCR: 'OCR',
  OCR_LABEL: 'OCR_LABEL_CONTEXT',
  OCR_INLINE: 'OCR_INLINE',
  OCR_NEIGHBOR: 'OCR_NEIGHBOR',
  GEMINI: 'GEMINI',
  USER_VERIFIED: 'user_verified',
  EXISTING_ASSET: 'existing_asset',
});

export function emptyField(reason = 'Not detected on document') {
  return {
    value: null,
    confidence: 0,
    source: null,
    reason,
    validationStatus: FIELD_STATUS.NOT_DETECTED,
  };
}

/**
 * @param {*} value
 * @param {{ confidence?: number, source?: string, reason?: string, validationStatus?: string }} [meta]
 */
export function makeField(value, meta = {}) {
  const empty = value == null || value === '';
  if (empty) return emptyField(meta.reason || 'Not detected on document');
  const conf = Number(meta.confidence);
  const confidence = Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5;
  let status = meta.validationStatus || FIELD_STATUS.VALID;
  if (status === FIELD_STATUS.VALID && confidence < 0.7) status = FIELD_STATUS.NEEDS_REVIEW;
  if (meta.source === FIELD_SOURCE.USER_VERIFIED) status = FIELD_STATUS.USER_VERIFIED;
  return {
    value,
    confidence,
    source: meta.source || FIELD_SOURCE.OCR,
    reason: meta.reason || '',
    validationStatus: status,
  };
}

export function isUserVerified(fieldOrMap, key) {
  if (!fieldOrMap) return false;
  if (key) {
    const hit = fieldOrMap[key];
    if (!hit) return false;
    if (typeof hit === 'string') return hit === FIELD_SOURCE.USER_VERIFIED;
    return (
      hit.source === FIELD_SOURCE.USER_VERIFIED ||
      hit.validationStatus === FIELD_STATUS.USER_VERIFIED
    );
  }
  return (
    fieldOrMap.source === FIELD_SOURCE.USER_VERIFIED ||
    fieldOrMap.validationStatus === FIELD_STATUS.USER_VERIFIED
  );
}

export function reviewStateFromField(field) {
  if (!field || field.value == null || field.value === '') {
    return {
      state: FIELD_STATUS.NOT_DETECTED,
      label: 'Not detected',
      hint: field?.reason || 'Could not confidently detect this field — please verify.',
    };
  }
  const status = field.validationStatus || FIELD_STATUS.NEEDS_REVIEW;
  const src = String(field.source || '');
  const conf = Number(field.confidence);
  const pct = Number.isFinite(conf) ? Math.round(conf > 1 ? conf : conf * 100) : null;
  const sourceWhy =
    src === FIELD_SOURCE.USER_VERIFIED
      ? 'You confirmed this value'
      : src === FIELD_SOURCE.OCR_LABEL || src === 'OCR_LABEL_CONTEXT'
        ? `Accepted from labeled text on the document${pct != null ? ` (${pct}%)` : ''}`
        : src === FIELD_SOURCE.OCR_NEIGHBOR
          ? `Accepted from nearby labeled text${pct != null ? ` (${pct}%)` : ''}`
          : src === FIELD_SOURCE.OCR_INLINE
            ? `Accepted from inline OCR text${pct != null ? ` (${pct}%)` : ''}`
            : src === FIELD_SOURCE.GEMINI
              ? `Accepted after model check against OCR text${pct != null ? ` (${pct}%)` : ''}`
              : src === FIELD_SOURCE.OCR
                ? `Accepted from OCR${pct != null ? ` (${pct}%)` : ''}`
                : '';
  if (status === FIELD_STATUS.USER_VERIFIED) {
    return { state: status, label: 'Verified by you', hint: field.reason || sourceWhy };
  }
  if (status === FIELD_STATUS.CONFLICT) {
    return {
      state: status,
      label: 'Possible mismatch',
      hint: field.reason || 'Conflicts with existing asset data. Please verify.',
    };
  }
  if (status === FIELD_STATUS.INVALID) {
    return {
      state: status,
      label: 'Invalid',
      hint: field.reason || 'Value failed validation. Please correct.',
    };
  }
  if (status === FIELD_STATUS.VALID && (field.confidence || 0) >= 0.85) {
    return {
      state: FIELD_STATUS.VALID,
      label: 'Detected',
      hint: field.reason || sourceWhy,
    };
  }
  return {
    state: FIELD_STATUS.NEEDS_REVIEW,
    label: 'Needs verification',
    hint: field.reason || sourceWhy || 'Possible value detected — please verify.',
  };
}

function hasVal(v) {
  return v != null && String(v).trim() !== '';
}

/**
 * Build a Review-ready fieldStatus map from pipeline data.
 * Does not invent values — only describes what was already extracted.
 */
export function buildFieldStatusMap(data = {}) {
  const existing = data.fieldStatus && typeof data.fieldStatus === 'object' ? data.fieldStatus : {};
  const sources = data.fieldSources && typeof data.fieldSources === 'object' ? data.fieldSources : {};
  const conf = data.fieldConfidence && typeof data.fieldConfidence === 'object' ? data.fieldConfidence : {};
  const svc = data.serviceBillConfidence && typeof data.serviceBillConfidence === 'object'
    ? data.serviceBillConfidence
    : {};
  const evidence = data.serviceBillEvidence || {};
  const needs = data.needsVerification || {};

  const put = (key, value, fallbackConf, reason, source) => {
    if (existing[key] && existing[key].validationStatus === FIELD_STATUS.USER_VERIFIED) {
      return existing[key];
    }
    if (sources[key] === FIELD_SOURCE.USER_VERIFIED && hasVal(value)) {
      return makeField(value, {
        confidence: 1,
        source: FIELD_SOURCE.USER_VERIFIED,
        reason: 'Confirmed on Review',
        validationStatus: FIELD_STATUS.USER_VERIFIED,
      });
    }
    const prior = existing[key];
    if (prior && hasVal(prior.value) && !hasVal(value)) return prior;
    const c = Number(svc[key] ?? conf[key] ?? fallbackConf);
    const ev = evidence[key];
    let status = FIELD_STATUS.VALID;
    if (!hasVal(value)) status = FIELD_STATUS.NOT_DETECTED;
    else if (needs[key] || (Number.isFinite(c) && c < 0.7)) status = FIELD_STATUS.NEEDS_REVIEW;
    return makeField(hasVal(value) ? value : null, {
      confidence: Number.isFinite(c) ? (c > 1 ? c / 100 : c) : hasVal(value) ? 0.75 : 0,
      source: source || prior?.source || FIELD_SOURCE.OCR,
      reason: reason || (typeof ev === 'string' ? ev : '') || prior?.reason || '',
      validationStatus: status,
    });
  };

  return {
    ...existing,
    insurer: put('insurer', data.insurer || data.shopName, 0.8, '', FIELD_SOURCE.OCR),
    policyNumber: put(
      'policyNumber',
      data.policyNumber || (String(data.documentKind || '').includes('insurance') ? data.invoiceNumber : ''),
      0.8,
    ),
    policyHolder: put('policyHolder', data.policyHolder || data.customerName, 0.75),
    registration: put('registration', data.registration, svc.registration || 0.8, evidence.registration),
    policyStartDate: put('policyStartDate', data.policyStartDate || data.insuranceStart, 0.8),
    policyExpiryDate: put('policyExpiryDate', data.policyExpiryDate || data.insuranceExpiry, 0.8),
    vehicleMake: put('vehicleMake', data.brandName || data.vehicleMake, 0.7),
    vehicleModel: put('vehicleModel', data.model || data.vehicleModel, 0.7),
    engineNumber: put('engineNumber', data.engineNumber, 0.7),
    chassisNumber: put('chassisNumber', data.chassisNumber, 0.7),
    coverageType: put('coverageType', data.coverageType, 0.7),
    workshopName: put('workshopName', data.shopName || data.serviceProvider, svc.workshop || 0.8),
    invoiceNumber: put('invoiceNumber', data.invoiceNumber, svc.invoiceNumber || conf.invoiceNumber),
    invoiceDate: put('invoiceDate', data.serviceDate || data.invoiceDate, svc.serviceDate),
    odometerReading: put(
      'odometerReading',
      data.odometerKm ?? data.odometerReading,
      svc.odometerReading,
      evidence.odometerReading,
    ),
    odometerUnit: put('odometerUnit', data.odometerUnit || (data.odometerKm != null ? 'km' : null), 0.9),
    totalAmount: put('totalAmount', data.totalAmount, svc.totalAmount || conf.price),
    customerName: put('customerName', data.customerName, svc.customerName, evidence.customerName),
    labourCost: put('labourCost', data.labourCost ?? data.labour, 0.75),
    partsCost: put('partsCost', data.partsCost, 0.75),
    taxAmount: put('taxAmount', data.taxAmount ?? data.tax, 0.75),
    discount: put('discount', data.discount, 0.7),
    paymentMode: put('paymentMode', data.paymentMode, 0.75),
    serviceType: put(
      'serviceType',
      data.workPerformed || (Array.isArray(data.serviceItems) ? data.serviceItems.join(', ') : ''),
      0.7,
    ),
  };
}

export default {
  FIELD_STATUS,
  FIELD_SOURCE,
  emptyField,
  makeField,
  isUserVerified,
  reviewStateFromField,
  buildFieldStatusMap,
};

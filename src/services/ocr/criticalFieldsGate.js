/**
 * Decide whether Gemini should run as a *field filler* after classification.
 * High classification confidence must NOT skip extraction of blank critical fields.
 */

function filled(v) {
  return v != null && String(v).trim() !== '';
}

export function insuranceCriticalMissing(data = {}) {
  return [
    !filled(data.policyNumber) && !filled(data.invoiceNumber),
    !filled(data.policyHolder) && !filled(data.customerName),
    !filled(data.registration),
    !filled(data.policyStartDate) && !filled(data.insuranceStart),
    !filled(data.policyExpiryDate) && !filled(data.insuranceExpiry),
  ].some(Boolean);
}

export function serviceCriticalMissing(data = {}) {
  return [
    !filled(data.registration),
    data.odometerKm == null && data.odometerReading == null,
    !filled(data.invoiceNumber),
    !filled(data.serviceDate) && !filled(data.invoiceDate),
    !filled(data.shopName) && !filled(data.serviceProvider),
  ].some(Boolean);
}

export function missingCriticalFields(data = {}) {
  const kind = String(data.documentKind || data.documentType || data.scanDocumentType || '').toLowerCase();
  if (kind.includes('insurance')) return insuranceCriticalMissing(data);
  if (kind.includes('service') || kind.includes('repair') || data.isServiceInvoice) {
    return serviceCriticalMissing(data);
  }
  return false;
}

/**
 * Run Gemini when:
 *  - caller forces it, or
 *  - critical type-specific fields are still blank, or
 *  - classification/field confidence is not high (legacy behaviour)
 *
 * Skip Gemini only when classification is strong AND critical fields are already filled.
 */
export function shouldRunGeminiFill(data = {}, opts = {}) {
  if (opts.forceGemini === false) return false;
  if (opts.forceGemini === true) return true;
  if (missingCriticalFields(data)) return true;

  const classConf = Number(opts.classConf ?? data.classificationConfidence) || 0;
  const fieldConf = Number(opts.fieldConf ?? data.confidence) || 0;
  const highConfidence =
    classConf >= 0.85 ||
    (classConf >= 0.7 && fieldConf >= 70) ||
    (data.documentKind === 'service_invoice' && classConf >= 0.72);
  return !highConfidence;
}

export default {
  insuranceCriticalMissing,
  serviceCriticalMissing,
  missingCriticalFields,
  shouldRunGeminiFill,
};

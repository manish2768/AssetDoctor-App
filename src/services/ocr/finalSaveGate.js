/**
 * Final extraction save gate.
 * OCR candidates with unresolved evidence are never silently persisted.
 * User corrections are allowed only after the review UI marks them verified.
 */

const VALUE_KEYS = [
  'productName',
  'shopName',
  'shopGstin',
  'invoiceNumber',
  'invoiceDate',
  'registration',
  'chassisNumber',
  'engineNumber',
  'odometerKm',
  'nextServiceOdometerKm',
  'nextServiceDue',
  'imei',
  'serialNumber',
  'taxAmount',
  'totalAmount',
  'insuranceExpiry',
  'pucExpiry',
  'warrantyExpiry',
  'policyStartDate',
  'customerName',
  'customerPhone',
];

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function statusFor(invoice, key) {
  if (invoice?.userConfirmedFields?.[key]) return 'USER_VERIFIED';
  const status = invoice?.fieldStatuses?.[key] || invoice?.fieldStatus?.[key];
  if (status) return String(status).toUpperCase();
  if (invoice?.fieldDecisions?.[key]?.decision === 'REJECT_CANDIDATE') return 'CONFLICT';
  if (invoice?.fieldIntelligence?.[key]?.needsReview) return 'NEEDS_REVIEW';
  return hasValue(invoice?.[key]) ? 'NEEDS_REVIEW' : 'NOT_FOUND';
}

function hasEvidence(invoice, key) {
  const evidence = invoice?.fieldEvidence?.[key];
  if (!evidence || evidence.evidenceType === 'none') return false;
  return Boolean(evidence.sourceText || evidence.evidenceType === 'user_verified');
}

export function canSaveExtractedInvoice(invoice = {}) {
  const blockingFields = [];
  for (const key of VALUE_KEYS) {
    if (!hasValue(invoice?.[key])) continue;
    const status = statusFor(invoice, key);
    if (status === 'USER_VERIFIED') continue;
    if (status === 'CONFLICT' || status === 'NEEDS_REVIEW' || status === 'REJECTED') {
      blockingFields.push({ key, status, reason: 'Resolve or manually verify this field.' });
      continue;
    }
    if (!hasEvidence(invoice, key)) {
      blockingFields.push({ key, status: 'NEEDS_REVIEW', reason: 'Source evidence is missing.' });
    }
  }
  return {
    allowed: blockingFields.length === 0,
    blockingFields,
    message: blockingFields.length
      ? `Verify ${blockingFields.slice(0, 4).map((item) => item.key).join(', ')} before saving.`
      : null,
  };
}

export default { canSaveExtractedInvoice };

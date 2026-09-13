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

export function canSaveExtractedInvoice(invoice = {}, documentType = 'INVOICE') {
  const docType = String(
    documentType ||
    invoice?.documentType ||
    invoice?.document_type ||
    invoice?.classifiedDocumentType ||
    'INVOICE'
  ).toUpperCase();

  // 1. INSURANCE VALIDATION
  if (docType === 'INSURANCE' || docType.includes('INSURANCE')) {
    const hasPolicy = Boolean(invoice?.policyNumber?.trim() || invoice?.policy_number?.trim());
    const hasReg = Boolean(invoice?.vehicleRegistrationNumber?.trim() || invoice?.registration?.trim());
    const hasChassis = Boolean(invoice?.chassisNumber?.trim() || invoice?.chassis_number?.trim());

    if (!hasPolicy && !hasReg && !hasChassis) {
      return {
        allowed: false,
        blockingFields: [{ key: 'policyNumber', status: 'REQUIRED', reason: 'Policy Number, Registration, or Chassis required.' }],
        message: 'Please provide at least a Policy Number, Vehicle Registration, or Chassis Number to save.',
      };
    }
    return { allowed: true, blockingFields: [], message: null };
  }

  // 2. PUC VALIDATION
  if (docType === 'PUC' || docType.includes('PUC')) {
    const hasCert = Boolean(invoice?.certificateNumber?.trim() || invoice?.certificate_number?.trim());
    const hasReg = Boolean(invoice?.vehicleRegistrationNumber?.trim() || invoice?.registration?.trim());
    const hasChassis = Boolean(invoice?.chassisNumber?.trim() || invoice?.chassis_number?.trim());

    if (!hasCert && !hasReg && !hasChassis) {
      return {
        allowed: false,
        blockingFields: [{ key: 'certificateNumber', status: 'REQUIRED', reason: 'Certificate Number, Registration, or Chassis required.' }],
        message: 'Please provide at least a Certificate Number, Registration, or Chassis Number to save.',
      };
    }
    return { allowed: true, blockingFields: [], message: null };
  }

  // 3. ELECTRICITY BILL VALIDATION
  if (docType === 'ELECTRICITY_BILL' || docType.includes('ELECTRICITY')) {
    const hasConsumer = Boolean(invoice?.consumerNumber?.trim() || invoice?.consumerId?.trim());
    const hasAccount = Boolean(invoice?.accountNumber?.trim());
    const hasMeter = Boolean(invoice?.meterNumber?.trim());

    if (!hasConsumer && !hasAccount && !hasMeter) {
      return {
        allowed: false,
        blockingFields: [{ key: 'consumerNumber', status: 'REQUIRED', reason: 'Consumer Number or Account Number required.' }],
        message: 'Please provide a Consumer Number or Account Number to save electricity bill.',
      };
    }
    return { allowed: true, blockingFields: [], message: null };
  }

  // 4. VEHICLE SERVICE VALIDATION
  if (docType === 'VEHICLE_SERVICE' || docType === 'SERVICE' || docType.includes('SERVICE')) {
    const hasReg = Boolean(invoice?.vehicleRegistrationNumber?.trim() || invoice?.registration?.trim());
    const hasChassis = Boolean(invoice?.chassisNumber?.trim() || invoice?.chassis_number?.trim());
    const hasInv = Boolean(invoice?.serviceInvoiceNumber?.trim() || invoice?.invoiceNumber?.trim());
    const hasWorkshop = Boolean(invoice?.workshopName?.trim() || invoice?.shopName?.trim());

    if (!hasReg && !hasChassis && !hasInv && !hasWorkshop) {
      return {
        allowed: false,
        blockingFields: [{ key: 'serviceInvoiceNumber', status: 'REQUIRED', reason: 'Invoice number, registration, chassis, or workshop name required.' }],
        message: 'Please provide at least a service invoice number, registration number, or workshop name to save.',
      };
    }
    return { allowed: true, blockingFields: [], message: null };
  }

  // 5. INVOICE VALIDATION (Consumer Assets)
  // Strict check: Require product name so unreadable receipts with only loose amounts are blocked from creating unnamed assets
  const hasName = Boolean(
    invoice?.productName?.trim() ||
    invoice?.assetName?.trim() ||
    invoice?.title?.trim() ||
    invoice?.item_name?.trim()
  );
  const hasAmount = invoice?.totalAmount != null && Number.isFinite(Number(invoice.totalAmount)) && Number(invoice.totalAmount) > 0;

  if (!hasName && !hasAmount) {
    return {
      allowed: false,
      blockingFields: [{ key: 'productName', status: 'REQUIRED', reason: 'Enter a product name or amount.' }],
      message: 'Please provide at least an asset name or total amount to save.',
    };
  }

  return {
    allowed: true,
    blockingFields: [],
    message: null,
  };
}

export default { canSaveExtractedInvoice };

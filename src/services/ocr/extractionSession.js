/**
 * Fresh extraction session — never pre-populate from a previously selected asset.
 * Asset matching happens AFTER extraction only.
 */

import { emptyInvoiceData } from './invoiceSchema';

/**
 * @returns {object} clean extraction object
 */
export function createFreshExtraction(seed = {}) {
  const base = emptyInvoiceData();
  // Only allow explicit OCR seed keys — never copy vault asset fields
  const allow = [
    'shopName',
    'shopPhone',
    'shopAddress',
    'shopGstin',
    'customerName',
    'customerPhone',
    'customerAddress',
    'invoiceNumber',
    'invoiceDate',
    'totalAmount',
    'taxAmount',
    'cgst',
    'sgst',
    'igst',
    'subtotal',
    'paymentMode',
    'productName',
    'serialNumber',
    'imei',
    'barcode',
    'brand',
    'model',
    'chassisNumber',
    'engineNumber',
    'warrantyPeriodMonths',
    'warrantyExpiry',
    'warrantyStart',
    'warrantyText',
    'warrantySourceText',
    'warrantyFieldMeta',
    'warrantyNeedsReview',
    'registration',
    'registrationConfidence',
    'registrationSource',
    'purchaseCategory',
    'documentType',
    'documentKind',
    'documentLabel',
    'documentTypeV2',
    'scanDocumentType',
    'isVehicleInvoice',
    'isServiceInvoice',
    'requiresVehicleLink',
    'items',
    'itemCount',
    'itemsSubtotal',
    'smartCategory',
    'fieldConfidence',
    'fieldConfidenceReasons',
    'lowConfidenceFields',
    'warnings',
    'needsManualReview',
    'ocrExtract',
    'rawText',
    'geminiDocumentType',
    'classifiedDocumentType',
    'geminiCategory',
    'insurer',
    'policyNumber',
    'insuranceExpiry',
    'insuranceStart',
    'policyStartDate',
    'policyExpiryDate',
    'policyHolder',
    'overallStartDate',
    'overallExpiryDate',
    'odStartDate',
    'odExpiryDate',
    'tpStartDate',
    'tpExpiryDate',
    'idv',
    'premium',
    'coverageType',
    'coverages',
    'insuranceFields',
    'odStart',
    'odExpiry',
    'tpStart',
    'tpExpiry',
    'normalizedInsurance',
    'odometerKm',
    'nextServiceOdometerKm',
    'nextServiceDue',
    'serviceDate',
    'labourCost',
    'partsCost',
    'tax',
    'parts',
    'serviceItems',
    'workPerformed',
    'serviceProvider',
    'sellerName',
    'brandName',
    'model',
    'canonicalServiceBill',
    'serviceBillConfidence',
    'serviceBillEvidence',
    'lowConfidenceFields',
    'needsVerification',
    'customerNameNeedsVerify',
    'odometerNeedsVerify',
    'odometerReading',
    'isServiceInvoice',
    'documentKind',
    'scanDocumentType',
    'showVehicleFields',
    'requiresVehicleLink',
  ];

  const out = {
    ...base,
    _extractionSessionId: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  for (const key of allow) {
    if (seed[key] !== undefined) out[key] = seed[key];
  }
  if (!Array.isArray(out.items)) out.items = [];
  out.itemCount = out.items.length || out.itemCount || 0;

  const imeiDigits = String(out.imei || '').replace(/\D/g, '');
  if (imeiDigits.length >= 14 && imeiDigits.length <= 17) {
    out.chassisNumber = '';
    out.engineNumber = '';
    out.registration = '';
    out.odometerKm = null;
    out.nextServiceOdometerKm = null;
    out.isVehicleInvoice = false;
  }

  // Explicitly reject vault / previous-asset leakage keys.
  // Do NOT wipe OCR-extracted odometer/service fields from seed.
  out.linkAssetId = null;
  out.selectedAssetId = null;
  out.previousAssetId = null;

  return out;
}

/**
 * True when a value looks like it came from a prior vault asset rather than OCR.
 * Used defensively — prefer blank over cross-asset contamination.
 */
export function isLikelyLeakedAssetValue(value, previousAsset = null) {
  if (!previousAsset || value == null || value === '') return false;
  const v = String(value).trim().toUpperCase().replace(/[\s-]/g, '');
  if (!v) return false;
  const keys = [
    previousAsset.assetName,
    previousAsset.productName,
    previousAsset.registration,
    previousAsset.chassisNumber,
    previousAsset.engineNumber,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim().toUpperCase().replace(/[\s-]/g, ''));
  return keys.some(
    (k) => k && (k === v || (k.length >= 6 && v.includes(k)) || (v.length >= 6 && k.includes(v))),
  );
}

export default { createFreshExtraction, isLikelyLeakedAssetValue };

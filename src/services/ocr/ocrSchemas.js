/**
 * Strict Gemini JSON schemas + confidence threshold for Manual Review gate.
 */

import { SchemaType } from '@google/generative-ai';

/** Below this → Manual Review UI (do not auto-trust OCR). */
export const OCR_CONFIDENCE_THRESHOLD = 85;

/** Shared nullable string helper */
const S = { type: SchemaType.STRING, nullable: true };
const N = { type: SchemaType.NUMBER, nullable: true };

/** Base fields — missing → null (never invent). */
export const GEMINI_BASE_PROPERTIES = Object.freeze({
  document_type: {
    type: SchemaType.STRING,
    enum: [
      'TAX_INVOICE',
      'SALES_INVOICE',
      'SERVICE_INVOICE',
      'INSURANCE_POLICY',
      'REGISTRATION_CERTIFICATE',
      'PUC',
      'PUC_CERTIFICATE',
      'OTHER_RECEIPT',
    ],
  },
  product_name: S,
  item_name: S,
  asset_name: S,
  total_amount: N,
  seller_name: S,
  vendor_name: S,
  vendor_dealer_name: S,
  buyer_name: S,
  owner_buyer_name: S,
  invoice_number: S,
  invoice_or_policy_no: S,
  purchase_date: S,
  purchase_or_issue_date: S,
  category: S,
  serial_number: S,
  chassis_or_frame_no: S,
  vehicle_registration_number: S,
  registration_number: S,
  engine_number: S,
  expiry_date: S,
  policy_number: S,
  policy_holder_name: S,
  policy_start_date: S,
  policy_end_date: S,
  insurer_name: S,
  vehicle_make: S,
  vehicle_model: S,
  coverage_type: S,
  idv: N,
  premium: N,
  odometer_reading: N,
  odometer_unit: S,
  workshop_name: S,
  invoice_date: S,
  payment_mode: S,
  confidence: N,
});

export const GEMINI_EXTRACTION_SCHEMA = Object.freeze({
  type: SchemaType.OBJECT,
  properties: GEMINI_BASE_PROPERTIES,
  required: ['document_type'],
});

/** Type-specific required emphasis (still same schema; prompt steers nulls). */
export const DOC_TYPE_FIELD_FOCUS = Object.freeze({
  TAX_INVOICE: ['product_name', 'total_amount', 'seller_name', 'invoice_number', 'purchase_date'],
  SALES_INVOICE: ['product_name', 'total_amount', 'seller_name', 'invoice_number', 'purchase_date'],
  SERVICE_INVOICE: [
    'product_name',
    'seller_name',
    'invoice_number',
    'purchase_date',
    'vehicle_registration_number',
    'odometer_reading',
  ],
  INSURANCE_POLICY: [
    'vehicle_registration_number',
    'invoice_or_policy_no',
    'policy_number',
    'policy_holder_name',
    'policy_start_date',
    'policy_end_date',
    'expiry_date',
    'owner_buyer_name',
    'insurer_name',
  ],
  REGISTRATION_CERTIFICATE: [
    'vehicle_registration_number',
    'chassis_or_frame_no',
    'engine_number',
    'owner_buyer_name',
    'asset_name',
  ],
  PUC: ['vehicle_registration_number', 'expiry_date'],
  PUC_CERTIFICATE: ['vehicle_registration_number', 'expiry_date'],
  OTHER_RECEIPT: ['product_name', 'seller_name', 'total_amount'],
});

/**
 * Heuristic confidence 0–100 from filled critical fields for a document class.
 * @param {object} data
 * @param {string} [documentType]
 */
export function scoreExtractionConfidence(data = {}, documentType = '') {
  const type = String(documentType || data.document_type || data.documentType || 'OTHER_RECEIPT')
    .trim()
    .toUpperCase();
  const focus = DOC_TYPE_FIELD_FOCUS[type] || DOC_TYPE_FIELD_FOCUS.OTHER_RECEIPT;

  const valueOf = (key) => {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const aliases = {
      seller_name: ['shopName', 'vendor', 'vendor_dealer_name', 'vendorDealerName'],
      vendor_name: ['shopName', 'vendor_dealer_name'],
      vendor_dealer_name: ['shopName', 'vendor', 'seller_name'],
      product_name: ['asset_name', 'assetName', 'item_name', 'itemName', 'productName'],
      item_name: ['product_name', 'asset_name', 'productName'],
      asset_name: ['product_name', 'productName', 'item_name'],
      purchase_date: ['invoiceDate', 'purchase_or_issue_date', 'purchaseDate'],
      purchase_or_issue_date: ['invoiceDate', 'purchase_date'],
      invoice_number: ['invoiceNumber', 'invoice_or_policy_no'],
      invoice_or_policy_no: ['invoiceNumber', 'invoice_number', 'policyNumber'],
      policy_number: ['policyNumber', 'invoiceNumber'],
      policy_holder_name: ['policyHolder', 'customerName'],
      policy_start_date: ['policyStartDate', 'insuranceStart'],
      policy_end_date: ['policyExpiryDate', 'insuranceExpiry'],
      insurer_name: ['insurer', 'shopName'],
      odometer_reading: ['odometerKm', 'odometerReading'],
      total_amount: ['totalAmount', 'purchaseAmount', 'price'],
      serial_number: ['serialNumber', 'imei'],
      vehicle_registration_number: ['registration', 'registration_number'],
      expiry_date: ['warrantyExpiry', 'insuranceExpiry', 'pucExpiry', 'expiryDate'],
      owner_buyer_name: ['customerName', 'buyer_name', 'buyerName'],
    };
    const candidates = [key, camel, ...(aliases[key] || [])];
    for (const k of candidates) {
      const v = data[k];
      if (v != null && v !== '') return v;
    }
    return null;
  };

  let hit = 0;
  for (const key of focus) {
    if (valueOf(key) != null) hit += 1;
  }

  // Model-reported confidence if present and sane
  const modelConf = Number(data.confidence);
  const fillRate = Math.round((hit / Math.max(focus.length, 1)) * 100);
  if (Number.isFinite(modelConf) && modelConf >= 0 && modelConf <= 100) {
    return Math.round(fillRate * 0.65 + modelConf * 0.35);
  }
  return fillRate;
}

export function needsManualReview(confidence, threshold = OCR_CONFIDENCE_THRESHOLD) {
  const n = Number(confidence);
  if (!Number.isFinite(n)) return true;
  return n < threshold;
}

export default {
  OCR_CONFIDENCE_THRESHOLD,
  GEMINI_EXTRACTION_SCHEMA,
  scoreExtractionConfidence,
  needsManualReview,
  DOC_TYPE_FIELD_FOCUS,
};

/**
 * Phase 11.2 — explicit per-document field schemas.
 * Extractors must populate these keys from labelled evidence, not a generic mapper.
 */

export type DocumentSchemaId =
  | 'SERVICE_INVOICE'
  | 'VEHICLE_PURCHASE_INVOICE'
  | 'ELECTRONICS_PURCHASE_INVOICE'
  | 'INSURANCE_POLICY'
  | 'WARRANTY'
  | 'PUC'
  | 'RC'
  | 'GENERIC_INVOICE';

export const DOCUMENT_FIELD_SCHEMAS: Record<DocumentSchemaId, readonly string[]> = {
  SERVICE_INVOICE: [
    'workshopName',
    'vehicleRegistration',
    'vinOrChassis',
    'engineNumber',
    'odometerKm',
    'serviceDate',
    'totalAmount',
  ],
  VEHICLE_PURCHASE_INVOICE: [
    'assetName',
    'vehicleRegistration',
    'vinOrChassis',
    'engineNumber',
    'invoiceNumber',
    'invoiceDate',
    'taxableAmount',
    'taxAmount',
    'finalAmount',
  ],
  ELECTRONICS_PURCHASE_INVOICE: [
    'productName',
    'serialNumber',
    'imei',
    'invoiceNumber',
    'invoiceDate',
    'taxAmount',
    'totalAmount',
  ],
  INSURANCE_POLICY: [
    'insurerName',
    'policyNumber',
    'vehicleRegistration',
    'vinOrChassis',
    'engineNumber',
    'policyStartDate',
    'policyExpiryDate',
    'premiumAmount',
    'idvAmount',
  ],
  WARRANTY: [
    'brand',
    'productName',
    'serialNumber',
    'warrantyNumber',
    'warrantyStartDate',
    'warrantyEndDate',
  ],
  PUC: [
    'certificateNumber',
    'registrationNumber',
    'issueDate',
    'expiryDate',
  ],
  RC: [
    'registrationNumber',
    'chassisNumber',
    'engineNumber',
    'maker',
    'model',
    'ownerName',
  ],
  GENERIC_INVOICE: [
    'sellerName',
    'invoiceNumber',
    'invoiceDate',
    'productName',
    'totalAmount',
  ],
};

export function schemaForDocumentType(documentType: string): DocumentSchemaId {
  const t = String(documentType || '').toUpperCase();
  if (t.includes('SERVICE') || t.includes('REPAIR')) return 'SERVICE_INVOICE';
  if (t.includes('VEHICLE_PURCHASE') || t === 'PURCHASE_INVOICE') return 'VEHICLE_PURCHASE_INVOICE';
  if (t.includes('ELECTRONICS')) return 'ELECTRONICS_PURCHASE_INVOICE';
  if (t.includes('INSURANCE')) return 'INSURANCE_POLICY';
  if (t.includes('WARRANTY') || t.includes('AMC')) return 'WARRANTY';
  if (t.includes('PUC')) return 'PUC';
  if (t.includes('RC_') || t === 'RC_CERTIFICATE') return 'RC';
  return 'GENERIC_INVOICE';
}

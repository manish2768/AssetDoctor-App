/**
 * Document Intelligence 2.0 — canonical document types.
 * Maps to legacy DOC_TYPES for vault compatibility (no rewrite of vault).
 */

export const DOC_TYPE_V2 = Object.freeze({
  SALES_INVOICE: 'SALES_INVOICE',
  PURCHASE_BILL: 'PURCHASE_BILL',
  SERVICE_BILL: 'SERVICE_BILL',
  REPAIR_BILL: 'REPAIR_BILL',
  WARRANTY: 'WARRANTY',
  EXTENDED_WARRANTY: 'EXTENDED_WARRANTY',
  AMC: 'AMC',
  INSURANCE: 'INSURANCE',
  PUC: 'PUC',
  RC: 'RC',
  REGISTRATION_DOCUMENT: 'REGISTRATION_DOCUMENT',
  EV_CHARGING_BILL: 'EV_CHARGING_BILL',
  FUEL_BILL: 'FUEL_BILL',
  ELECTRICITY_BILL: 'ELECTRICITY_BILL',
  TAX_DOCUMENT: 'TAX_DOCUMENT',
  OTHER: 'OTHER',
});

export const DOC_TYPE_LABELS = Object.freeze({
  [DOC_TYPE_V2.SALES_INVOICE]: 'Sales Invoice',
  [DOC_TYPE_V2.PURCHASE_BILL]: 'Purchase Bill',
  [DOC_TYPE_V2.SERVICE_BILL]: 'Service Bill',
  [DOC_TYPE_V2.REPAIR_BILL]: 'Repair Bill',
  [DOC_TYPE_V2.WARRANTY]: 'Warranty',
  [DOC_TYPE_V2.EXTENDED_WARRANTY]: 'Extended Warranty',
  [DOC_TYPE_V2.AMC]: 'AMC',
  [DOC_TYPE_V2.INSURANCE]: 'Insurance',
  [DOC_TYPE_V2.PUC]: 'PUC',
  [DOC_TYPE_V2.RC]: 'RC',
  [DOC_TYPE_V2.REGISTRATION_DOCUMENT]: 'Registration Document',
  [DOC_TYPE_V2.EV_CHARGING_BILL]: 'EV Charging Bill',
  [DOC_TYPE_V2.FUEL_BILL]: 'Fuel Bill',
  [DOC_TYPE_V2.ELECTRICITY_BILL]: 'Electricity Bill',
  [DOC_TYPE_V2.TAX_DOCUMENT]: 'Tax Document',
  [DOC_TYPE_V2.OTHER]: 'Other Document',
});

/**
 * Map legacy classifier / Gemini strings → DOC_TYPE_V2.
 */
export function toDocTypeV2(raw = '', hints = {}) {
  const t = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  const blob = String(hints.blob || hints.text || '').toLowerCase();

  if (t === 'SALES_INVOICE' || t === 'TAX_INVOICE' || t === 'PURCHASE_INVOICE') {
    return DOC_TYPE_V2.SALES_INVOICE;
  }
  if (t === 'PURCHASE_BILL' || t === 'BILL') return DOC_TYPE_V2.PURCHASE_BILL;
  if (t === 'SERVICE_INVOICE' || t === 'SERVICE_BILL' || t === 'JOB_CARD') {
    return DOC_TYPE_V2.SERVICE_BILL;
  }
  if (t === 'REPAIR_BILL' || t === 'REPAIR_INVOICE') return DOC_TYPE_V2.REPAIR_BILL;
  if (t === 'EXTENDED_WARRANTY' || /extended\s*warranty/.test(blob)) {
    return DOC_TYPE_V2.EXTENDED_WARRANTY;
  }
  if (t === 'AMC' || /\bamc\b|annual\s*maintenance/.test(blob)) return DOC_TYPE_V2.AMC;
  if (t === 'WARRANTY') return DOC_TYPE_V2.WARRANTY;
  if (t === 'INSURANCE' || t === 'INSURANCE_POLICY' || t === 'VEHICLE_INSURANCE') {
    return DOC_TYPE_V2.INSURANCE;
  }
  if (t === 'PUC' || t === 'PUC_CERTIFICATE' || t === 'VEHICLE_PUC') return DOC_TYPE_V2.PUC;
  if (t === 'RC' || t === 'VEHICLE_RC' || t === 'REGISTRATION_CERTIFICATE') return DOC_TYPE_V2.RC;
  if (t === 'REGISTRATION_DOCUMENT') return DOC_TYPE_V2.REGISTRATION_DOCUMENT;
  if (t === 'EV_CHARGING_BILL' || /ev\s*charg|charging\s*station/.test(blob)) {
    return DOC_TYPE_V2.EV_CHARGING_BILL;
  }
  if (t === 'FUEL_BILL' || /petrol\s*pump|diesel\s*fill|fuel\s*receipt/.test(blob)) {
    return DOC_TYPE_V2.FUEL_BILL;
  }
  if (
    t === 'ELECTRICITY_BILL' ||
    t === 'UTILITY_BILL' ||
    /electricity\s*bill|consumer\s*(?:no|number).*meter|discom|units\s*consumed/.test(blob)
  ) {
    return DOC_TYPE_V2.ELECTRICITY_BILL;
  }
  if (t === 'TAX_DOCUMENT' || /\bgst\s*return\b|\bform\s*26as\b/.test(blob)) {
    return DOC_TYPE_V2.TAX_DOCUMENT;
  }
  if (t === 'OTHER' || t === 'OTHER_RECEIPT') return DOC_TYPE_V2.OTHER;

  // Heuristic fallback from blob when type empty
  if (/job\s*card|service\s*invoice|labour\s*charges/.test(blob)) return DOC_TYPE_V2.SERVICE_BILL;
  if (/extended\s*warranty/.test(blob)) return DOC_TYPE_V2.EXTENDED_WARRANTY;
  if (/\bamc\b/.test(blob)) return DOC_TYPE_V2.AMC;
  if (/insurance\s*polic|idv\b/.test(blob)) return DOC_TYPE_V2.INSURANCE;
  if (/\bpuc\b|pollution/.test(blob)) return DOC_TYPE_V2.PUC;
  if (/registration\s*certificate|certificate\s*of\s*registration/.test(blob)) {
    return DOC_TYPE_V2.RC;
  }
  if (/tax\s*invoice|sales\s*invoice|bill\s*of\s*supply/.test(blob)) {
    return DOC_TYPE_V2.SALES_INVOICE;
  }

  return DOC_TYPE_V2.OTHER;
}

/**
 * Map V2 → legacy vault / scanDocumentType strings used by Review + AssetService.
 */
export function toLegacyScanDocumentType(docTypeV2) {
  switch (docTypeV2) {
    case DOC_TYPE_V2.INSURANCE:
      return 'insurance';
    case DOC_TYPE_V2.PUC:
      return 'puc';
    case DOC_TYPE_V2.RC:
    case DOC_TYPE_V2.REGISTRATION_DOCUMENT:
      return 'rc';
    case DOC_TYPE_V2.WARRANTY:
    case DOC_TYPE_V2.EXTENDED_WARRANTY:
    case DOC_TYPE_V2.AMC:
      return 'warranty';
    case DOC_TYPE_V2.SERVICE_BILL:
    case DOC_TYPE_V2.REPAIR_BILL:
      return 'service_invoice';
    case DOC_TYPE_V2.SALES_INVOICE:
    case DOC_TYPE_V2.PURCHASE_BILL:
      return 'bill';
    case DOC_TYPE_V2.ELECTRICITY_BILL:
      return 'electricity_bill';
    case DOC_TYPE_V2.EV_CHARGING_BILL:
      return 'ev_charging';
    case DOC_TYPE_V2.FUEL_BILL:
      return 'fuel';
    default:
      return 'bill';
  }
}

export function isAttachDocumentType(docTypeV2) {
  return [
    DOC_TYPE_V2.INSURANCE,
    DOC_TYPE_V2.PUC,
    DOC_TYPE_V2.RC,
    DOC_TYPE_V2.REGISTRATION_DOCUMENT,
    DOC_TYPE_V2.WARRANTY,
    DOC_TYPE_V2.EXTENDED_WARRANTY,
    DOC_TYPE_V2.AMC,
  ].includes(docTypeV2);
}

export function isServiceLikeDocument(docTypeV2) {
  return [DOC_TYPE_V2.SERVICE_BILL, DOC_TYPE_V2.REPAIR_BILL].includes(docTypeV2);
}

export function isPurchaseLikeDocument(docTypeV2) {
  return [
    DOC_TYPE_V2.SALES_INVOICE,
    DOC_TYPE_V2.PURCHASE_BILL,
    DOC_TYPE_V2.EV_CHARGING_BILL,
    DOC_TYPE_V2.FUEL_BILL,
    DOC_TYPE_V2.ELECTRICITY_BILL,
  ].includes(docTypeV2);
}

export default {
  DOC_TYPE_V2,
  DOC_TYPE_LABELS,
  toDocTypeV2,
  toLegacyScanDocumentType,
  isAttachDocumentType,
  isServiceLikeDocument,
  isPurchaseLikeDocument,
};

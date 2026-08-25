/**
 * Internal OCR document — every provider maps into this shape.
 * Missing values stay null. Never invent.
 */

export const OCR_DOC_TYPE = Object.freeze({
  PURCHASE_INVOICE: 'PURCHASE_INVOICE',
  SERVICE_INVOICE: 'SERVICE_INVOICE',
  INSURANCE: 'INSURANCE',
  WARRANTY: 'WARRANTY',
  RC: 'RC',
  PUC: 'PUC',
  OTHER: 'OTHER',
});

export const OCR_ASSET_CATEGORY = Object.freeze({
  GADGET: 'GADGET',
  VEHICLE: 'VEHICLE',
  HOME_APPLIANCE: 'HOME_APPLIANCE',
  OTHER: 'OTHER',
});

export function emptyField(source = '') {
  return {
    value: null,
    confidence: 0,
    source: source || 'none',
    needsReview: true,
  };
}

export function field(value, confidence, source, needsReview) {
  const empty = value == null || value === '';
  return {
    value: empty ? null : value,
    confidence: Number(confidence) || 0,
    source: source || 'unknown',
    needsReview: empty ? true : Boolean(needsReview),
  };
}

export function emptyNormalizedDocument() {
  return {
    documentType: OCR_DOC_TYPE.PURCHASE_INVOICE,
    assetCategory: OCR_ASSET_CATEGORY.OTHER,
    categoryConfidence: 0,
    productName: emptyField(),
    brand: emptyField(),
    model: emptyField(),
    variant: emptyField(),
    quantity: emptyField(),
    unitPrice: emptyField(),
    lineTotal: emptyField(),
    grandTotal: emptyField(),
    taxAmount: emptyField(),
    imei: emptyField(),
    serialNumber: emptyField(),
    chassisNumber: emptyField(),
    engineNumber: emptyField(),
    registrationNumber: emptyField(),
    seller: emptyField(),
    sellerGstin: emptyField(),
    buyerName: emptyField(),
    invoiceNumber: emptyField(),
    purchaseDate: emptyField(),
    paymentMode: emptyField(),
    items: [],
    engine: '',
    rawText: '',
    needsReview: true,
    validationErrors: [],
  };
}

export default {
  OCR_DOC_TYPE,
  OCR_ASSET_CATEGORY,
  emptyField,
  field,
  emptyNormalizedDocument,
};

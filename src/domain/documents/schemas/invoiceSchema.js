/** Invoice document schema — line items vs document-level totals. */
export const INVOICE_SCHEMA = Object.freeze({
  documentType: 'INVOICE',
  documentFields: [
    'grandTotal',
    'subTotal',
    'taxTotal',
    'discountTotal',
    'invoiceNumber',
    'purchaseDate',
    'seller',
    'buyerName',
  ],
  lineItemFields: [
    'productName',
    'quantity',
    'unitPrice',
    'discount',
    'taxableAmount',
    'taxAmount',
    'lineTotal',
    'imei',
    'serialNumber',
    'warrantyMonths',
    'warrantyText',
  ],
  reminderCandidates: ['warrantyExpiry', 'purchaseDate'],
});

export default INVOICE_SCHEMA;

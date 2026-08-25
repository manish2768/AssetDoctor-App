/** Vehicle / asset service bill schema. */
export const SERVICE_BILL_SCHEMA = Object.freeze({
  documentType: 'SERVICE_BILL',
  fields: [
    'serviceDate',
    'assetIdentifier',
    'vehicleNumber',
    'odometer',
    'customerName',
    'workshop',
    'invoiceNumber',
    'serviceType',
    'parts',
    'labour',
    'tax',
    'cgst',
    'sgst',
    'igst',
    'totalAmount',
    'serviceDescription',
    'nextServiceDate',
  ],
  reminderCandidates: ['nextServiceDate'],
});

export default SERVICE_BILL_SCHEMA;

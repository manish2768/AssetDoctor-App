/** Insurance policy schema — expiry becomes asset reminder candidate. */
export const INSURANCE_SCHEMA = Object.freeze({
  documentType: 'INSURANCE_POLICY',
  fields: [
    'policyNumber',
    'insurer',
    'insuredName',
    'vehicleNumber',
    'policyStartDate',
    'policyExpiryDate',
    'idv',
    'premium',
    'coverageType',
    'assetType',
  ],
  reminderCandidates: ['policyExpiryDate'],
});

export default INSURANCE_SCHEMA;

/** PUC certificate schema. */
export const PUC_SCHEMA = Object.freeze({
  documentType: 'PUC',
  fields: [
    'registrationNumber',
    'certificateNumber',
    'issueDate',
    'validUntil',
    'pollutionValues',
    'vehicleDetails',
  ],
  reminderCandidates: ['validUntil'],
});

export default PUC_SCHEMA;

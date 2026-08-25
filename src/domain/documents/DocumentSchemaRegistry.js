import { DOCUMENT_TYPE } from './DocumentTypes';
import { INVOICE_SCHEMA } from './schemas/invoiceSchema';
import { INSURANCE_SCHEMA } from './schemas/insuranceSchema';
import { PUC_SCHEMA } from './schemas/pucSchema';
import { SERVICE_BILL_SCHEMA } from './schemas/serviceBillSchema';

const REGISTRY = Object.freeze({
  [DOCUMENT_TYPE.INVOICE]: INVOICE_SCHEMA,
  [DOCUMENT_TYPE.INSURANCE_POLICY]: INSURANCE_SCHEMA,
  [DOCUMENT_TYPE.PUC]: PUC_SCHEMA,
  [DOCUMENT_TYPE.SERVICE_BILL]: SERVICE_BILL_SCHEMA,
});

export function getDocumentSchema(documentType) {
  return REGISTRY[documentType] || null;
}

export function listDocumentTypes() {
  return Object.keys(REGISTRY);
}

export function reminderFieldsForType(documentType) {
  const schema = getDocumentSchema(documentType);
  return schema?.reminderCandidates || [];
}

export default {
  getDocumentSchema,
  listDocumentTypes,
  reminderFieldsForType,
};

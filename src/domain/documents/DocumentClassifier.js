/**
 * Pluggable document classifier — delegates to OCR layer, maps to domain types.
 * UI must not hardcode document-specific extraction logic.
 */
import { classifyDocumentType } from '../../services/ocr/documentTypeClassifier';
import { DOCUMENT_TYPE } from './DocumentTypes';

const VAULT_TO_DOMAIN = Object.freeze({
  PURCHASE_BILL: DOCUMENT_TYPE.INVOICE,
  PURCHASE_INVOICE: DOCUMENT_TYPE.INVOICE,
  SERVICE_BILL: DOCUMENT_TYPE.SERVICE_BILL,
  INSURANCE: DOCUMENT_TYPE.INSURANCE_POLICY,
  PUC: DOCUMENT_TYPE.PUC,
  WARRANTY: DOCUMENT_TYPE.WARRANTY_CARD,
  RC: DOCUMENT_TYPE.REGISTRATION_DOCUMENT,
  OTHER: DOCUMENT_TYPE.OTHER,
});

export function classifyDocument(rawText = '', hints = {}) {
  const result = classifyDocumentType(rawText, hints);
  const domainType = VAULT_TO_DOMAIN[result.vaultType] || DOCUMENT_TYPE.OTHER;
  return {
    ...result,
    domainType,
  };
}

export default { classifyDocument };

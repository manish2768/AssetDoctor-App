/**
 * Document classification V2 — wraps Classification Engine + legacy vault types.
 */

import { classifyDocumentType, resolveDocumentClassification } from './documentTypeClassifier';
import {
  DOC_TYPE_V2,
  DOC_TYPE_LABELS,
  toDocTypeV2,
  toLegacyScanDocumentType,
} from './documentIntelligenceTypes';
import {
  classifyDocumentEngine,
  PRIMARY_DOC_TYPES,
} from './documentClassificationEngine';
import {
  preferServiceBillOverInsurance,
  scoreServiceBillSignals,
  hasExclusiveInsuranceSignals,
} from './documentTypeArbitration';

/**
 * Full classification with confidence + evidence reason.
 */
export function classifyDocumentIntelligence(blob = '', hints = {}) {
  const text = `${blob} ${hints.productName || ''} ${hints.shopName || ''}`;
  const engine = classifyDocumentEngine(text, hints);
  const legacy = resolveDocumentClassification(blob, hints);
  const serviceSignals = scoreServiceBillSignals(text);

  let documentType = engine.v2Type || toDocTypeV2(legacy.documentKind || legacy.type, { blob: text });
  const evidence = [];

  if (engine.documentType === PRIMARY_DOC_TYPES.SERVICE_BILL || preferServiceBillOverInsurance(text)) {
    documentType = DOC_TYPE_V2.SERVICE_BILL;
    evidence.push('engine_service', ...((engine.signals?.structural?.SERVICE_BILL) || []));
  } else if (engine.documentType === PRIMARY_DOC_TYPES.INSURANCE) {
    documentType = DOC_TYPE_V2.INSURANCE;
    evidence.push('engine_insurance');
  } else if (engine.documentType === PRIMARY_DOC_TYPES.SALES_INVOICE) {
    documentType = DOC_TYPE_V2.SALES_INVOICE;
    evidence.push('engine_sales');
  } else if (engine.documentType === PRIMARY_DOC_TYPES.RC) {
    documentType = DOC_TYPE_V2.RC;
    evidence.push('engine_rc');
  } else if (engine.documentType === PRIMARY_DOC_TYPES.PUC) {
    documentType = DOC_TYPE_V2.PUC;
    evidence.push('engine_puc');
  } else if (engine.documentType === PRIMARY_DOC_TYPES.WARRANTY) {
    documentType = DOC_TYPE_V2.WARRANTY;
    evidence.push('engine_warranty');
  } else if (/extended\s*warranty/.test(text)) {
    documentType = DOC_TYPE_V2.EXTENDED_WARRANTY;
    evidence.push('extended_warranty_keyword');
  } else if (legacy.documentKind) {
    evidence.push(`legacy:${legacy.documentKind}`);
  }

  const confidence = Math.min(
    0.98,
    Math.max(engine.confidence || 0.55, serviceSignals.score >= 4 ? 0.85 : 0.55),
  );

  const alternatives = (engine.ranked || [])
    .slice(1, 4)
    .map((r) => ({ type: r.documentType, score: r.score }));

  const legacyOut =
    documentType === DOC_TYPE_V2.SERVICE_BILL
      ? {
          ...legacy,
          type: 'service_invoice',
          vaultType: 'service_invoice',
          documentKind: 'service_invoice',
          isServiceInvoice: true,
          label: 'Service Bill',
        }
      : documentType === DOC_TYPE_V2.INSURANCE
        ? {
            ...legacy,
            type: 'insurance',
            vaultType: 'insurance',
            documentKind: 'insurance',
            label: 'Insurance',
          }
        : legacy;

  return {
    ...legacyOut,
    documentType,
    documentTypeLabel: DOC_TYPE_LABELS[documentType] || legacyOut.label,
    confidence: Math.round(confidence * 100) / 100,
    reason: evidence.join(', ') || 'heuristic',
    evidence,
    alternativeTypes: alternatives,
    conflictingSignals: engine.conflictingSignals || [],
    legacyScanDocumentType: toLegacyScanDocumentType(documentType),
    primaryDocumentType: engine.documentType,
    exclusiveInsurance: hasExclusiveInsuranceSignals(text),
    base: classifyDocumentType(blob, hints),
    engine,
  };
}

export default classifyDocumentIntelligence;

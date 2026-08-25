/**
 * Apply confirmed Document Intelligence outcomes → ServiceRecord + expense link.
 * Always call AFTER user confirmation — never from silent OCR.
 */

import { ServiceRecordService } from '../assets/ServiceRecordService';
import { buildServiceHistoryEntry } from './SmartAssetMapper';
import { isServiceLikeDocument, toDocTypeV2 } from './documentIntelligenceTypes';

/**
 * @param {string} userId
 * @param {string} assetId
 * @param {object} invoice — reviewed/confirmed fields
 * @param {{ documentId?: string, documentType?: string }} [opts]
 */
export async function applyConfirmedServiceDocument(userId, assetId, invoice = {}, opts = {}) {
  if (!userId || !assetId) {
    return { success: false, error: 'userId and assetId required' };
  }

  const docType = toDocTypeV2(
    opts.documentType || invoice.document_type || invoice.documentType || invoice.scanDocumentType,
    { blob: '' },
  );
  if (!isServiceLikeDocument(docType) && !opts.forceService) {
    return { success: false, skipped: true, reason: 'not_service_document' };
  }

  const legacy = buildServiceHistoryEntry({ assetId }, invoice);
  const result = await ServiceRecordService.add(userId, assetId, {
    serviceDate: legacy.date,
    serviceType:
      docType === 'REPAIR_BILL'
        ? 'repair'
        : legacy.serviceType || invoice.serviceType || 'service',
    serviceProvider: legacy.storeName,
    workPerformed: legacy.note,
    partsReplaced: legacy.partsChanged || [],
    labourCost: legacy.labourCost,
    partsCost: legacy.partsCost,
    tax: legacy.tax,
    cgst: legacy.cgst,
    sgst: legacy.sgst,
    igst: legacy.igst,
    totalAmount: legacy.amount,
    odometer: legacy.odometerKm,
    customerName: legacy.customerName,
    invoiceNumber: legacy.invoiceNumber,
    registration: legacy.registration,
    documentId: opts.documentId || null,
    nextServiceDate: legacy.nextServiceDue,
    notes: legacy.note,
  });

  return {
    success: Boolean(result?.success),
    serviceRecord: result?.serviceRecord || null,
    expenseLinked: Boolean(result?.success && legacy.amount > 0),
    id: result?.id,
    documentId: opts.documentId || null,
    error: result?.error,
  };
}

export default { applyConfirmedServiceDocument };

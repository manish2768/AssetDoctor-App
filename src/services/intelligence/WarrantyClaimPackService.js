/**
 * WarrantyClaimPackService — Phase 2 foundation.
 * Collects references by assetId only; never fabricates documents.
 */

import { createClaimPackId } from './types';

const WARRANTY_DOC_HINTS = /warranty|guarantee|extended/i;
const INVOICE_DOC_HINTS = /bill|invoice|purchase|receipt/i;
const SERVICE_DOC_HINTS = /service|repair|job\s*card|amc/i;

function docTypeBlob(doc = {}) {
  return [
    doc.type,
    doc.documentType,
    doc.classifiedDocumentType,
    doc.scanDocumentType,
    doc.title,
    doc.name,
  ]
    .map((x) => String(x || ''))
    .join(' ');
}

/**
 * @param {string} assetId
 * @param {object} bundle — asset + documents + services + expenses (already scoped preferred)
 */
export function buildWarrantyClaimPack(assetId, bundle = {}) {
  const id = String(assetId || '').trim();
  if (!id) {
    return {
      success: false,
      error: 'assetId required',
      claimPack: null,
    };
  }

  const asset = bundle.asset || {};
  const resolvedAssetId = String(asset.assetId || asset.id || id);
  if (resolvedAssetId !== id) {
    return {
      success: false,
      error: 'Asset ID mismatch — refuse cross-link',
      claimPack: null,
    };
  }

  const documents = (bundle.documents || []).filter(
    (d) => !d?.assetId || String(d.assetId) === id,
  );
  const services = (bundle.services || bundle.repairLogs || []).filter(
    (s) => !s?.assetId || String(s.assetId) === id,
  );
  const expenses = (bundle.expenses || []).filter(
    (e) => !e?.assetId || String(e.assetId) === id,
  );

  const documentReferences = documents.map((d) => ({
    docId: d.docId || d.id,
    assetId: id,
    type: d.type || d.documentType || null,
    title: d.title || d.name || null,
    fileUrl: d.fileUrl || d.url || null,
    storagePath: d.storagePath || null,
  }));

  const serviceReferences = services.map((s) => ({
    id: s.id || s.repairId,
    assetId: id,
    serviceDate: s.serviceDate || s.repairDate || s.date || null,
    totalAmount: s.totalAmount ?? s.costInr ?? null,
    serviceType: s.serviceType || s.category || s.title || null,
  }));

  const expenseReferences = expenses.map((e) => ({
    id: e.id || e.repairId,
    assetId: id,
    amount: e.amount ?? e.costInr ?? e.totalAmount ?? null,
    date: e.date || e.repairDate || null,
    bucket: e.bucket || e.category || null,
  }));

  const purchaseInvoice = documentReferences.filter((d) =>
    INVOICE_DOC_HINTS.test(docTypeBlob(d) || d.type || ''),
  );
  const warrantyCards = documentReferences.filter((d) =>
    WARRANTY_DOC_HINTS.test(docTypeBlob(d) || d.type || ''),
  );
  const serviceInvoices = documentReferences.filter((d) =>
    SERVICE_DOC_HINTS.test(docTypeBlob(d) || d.type || ''),
  );

  const missingInformation = [];
  if (!purchaseInvoice.length) missingInformation.push('Purchase Invoice');
  if (!warrantyCards.length) missingInformation.push('Warranty Card');
  if (!String(asset.serialNumber || '').trim() && !String(asset.imei || '').trim()) {
    missingInformation.push('Serial Number or IMEI');
  }
  if (!String(asset.purchaseDate || '').trim()) missingInformation.push('Purchase Date');
  if (!String(asset.warrantyExpiry || '').trim()) missingInformation.push('Warranty Expiry');
  if (!String(bundle.issueDescription || '').trim()) missingInformation.push('Issue Description');

  const claimPack = {
    claimPackId: createClaimPackId(id),
    assetId: id,
    publicAssetId: asset.publicAssetId || asset.assetCode || null,
    displayName: asset.nickname || asset.assetName || 'Asset',
    documentReferences,
    serviceReferences,
    expenseReferences,
    metadata: {
      purchaseDate: asset.purchaseDate || null,
      warrantyExpiry: asset.warrantyExpiry || null,
      serialNumber: asset.serialNumber || null,
      imei: asset.imei || null,
      registration: asset.registration || null,
      issueDescription: bundle.issueDescription || null,
      purchaseInvoiceCount: purchaseInvoice.length,
      warrantyCardCount: warrantyCards.length,
      serviceInvoiceCount: serviceInvoices.length,
      photoRefs: (bundle.photos || []).filter((p) => !p?.assetId || String(p.assetId) === id),
    },
    missingInformation,
    readyToExport: missingInformation.length === 0,
    createdAt: new Date().toISOString(),
    ownerUid: asset.ownerUid || asset.uid || null,
    syncStatus: 'LOCAL',
  };

  return { success: true, claimPack };
}

export const WarrantyClaimPackService = {
  build: buildWarrantyClaimPack,
};

export default WarrantyClaimPackService;

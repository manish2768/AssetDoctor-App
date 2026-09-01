/**
 * Collect vault document identity records from in-memory assets for duplicate checks.
 * Does not fetch Firestore. Uses fields already on the asset / nested documents.
 */

export function collectVaultedDocsFromAssets(assets = []) {
  const docs = [];
  for (const asset of assets || []) {
    const assetId = asset.id || asset.assetId || '';
    const invoiceNumber =
      asset.invoiceNumber ||
      asset.invoiceMeta?.invoiceNumber ||
      asset.ocrExtract?.invoice_or_policy_no ||
      '';
    const policyNumber =
      asset.policyNumber ||
      asset.invoiceMeta?.policyNumber ||
      asset.insurancePolicyNumber ||
      '';
    const fingerprint =
      asset.invoiceFingerprint ||
      asset.ocrExtract?.fingerprint ||
      asset.documentFingerprint ||
      '';

    if (
      fingerprint ||
      invoiceNumber ||
      policyNumber ||
      asset.imei ||
      asset.serialNumber ||
      asset.registration
    ) {
      docs.push({
        id: asset.lastDocumentId || `asset_${assetId}`,
        assetId,
        documentType: String(asset.classifiedDocumentType || asset.documentType || 'UNKNOWN'),
        fingerprint: String(fingerprint),
        invoiceNumber: String(invoiceNumber),
        policyNumber: String(policyNumber),
        certificateNumber: String(asset.pucCertificateNumber || asset.certificateNumber || ''),
        documentDate: String(asset.purchaseDate || asset.invoiceMeta?.invoiceDate || '').slice(0, 10),
        imei: String(asset.imei || '').replace(/\D/g, ''),
        serialNumber: String(asset.serialNumber || '').toUpperCase().replace(/\s+/g, ''),
        totalAmount: Number(asset.purchasePrice ?? asset.value ?? 0) || 0,
        registration: String(asset.registration || '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, ''),
      });
    }

    for (const d of asset.documents || asset.vaultDocuments || []) {
      docs.push({
        id: d.id || d.documentId || `doc_${docs.length}`,
        assetId: d.assetId || assetId,
        documentType: String(d.documentType || d.type || 'UNKNOWN'),
        fingerprint: String(d.fingerprint || ''),
        invoiceNumber: String(d.invoiceNumber || ''),
        policyNumber: String(d.policyNumber || ''),
        certificateNumber: String(d.certificateNumber || ''),
        documentDate: String(d.documentDate || d.invoiceDate || d.issueDate || '').slice(0, 10),
        imei: String(d.imei || '').replace(/\D/g, ''),
        serialNumber: String(d.serialNumber || '').toUpperCase().replace(/\s+/g, ''),
        totalAmount: Number(d.totalAmount ?? d.premium ?? 0) || 0,
        registration: String(d.registration || '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, ''),
      });
    }
  }
  return docs;
}

export default collectVaultedDocsFromAssets;

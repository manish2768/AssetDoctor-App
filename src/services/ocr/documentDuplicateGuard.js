/**
 * Document duplicate detection foundation.
 * Wraps existing Sweet Bill fingerprints; adds DI-level fingerprint hash.
 */

import { rememberInvoiceFingerprint, forgetInvoiceFingerprint } from '../SweetBillChecker';

/**
 * Build a stable fingerprint from document identifiers (no PII beyond doc ids).
 */
export function buildDocumentFingerprint(data = {}) {
  const type = String(data.documentType || data.document_type || data.scanDocumentType || '')
    .toUpperCase()
    .trim();
  const inv = String(data.invoiceNumber || data.documentNumber || data.policyNumber || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  const cert = String(data.certificateNumber || data.policyNumber || '')
    .toUpperCase()
    .replace(/\s+/g, '');
  const date = String(data.invoiceDate || data.purchaseDate || data.serviceDate || '')
    .slice(0, 10);
  const amount = Number(data.totalAmount ?? data.grandTotal ?? data.premium ?? 0) || 0;
  const asset = String(data.assetId || data.linkAssetId || '').trim();
  const key = [type, inv || cert || 'NODOC', date || 'NODATE', amount.toFixed(2), asset || 'NOASSET']
    .join('|');
  return `di_${simpleHash(key)}`;
}

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * @returns {{ isDuplicate: boolean, fingerprint: string, message?: string }}
 */
export async function checkDocumentDuplicate(data = {}, existingFingerprints = []) {
  const fingerprint = buildDocumentFingerprint(data);
  const hit = (existingFingerprints || []).includes(fingerprint);
  return {
    isDuplicate: hit,
    fingerprint,
    message: hit
      ? 'This document may already exist. View existing or save anyway?'
      : null,
  };
}

export { rememberInvoiceFingerprint, forgetInvoiceFingerprint };

export default {
  buildDocumentFingerprint,
  checkDocumentDuplicate,
  rememberInvoiceFingerprint,
  forgetInvoiceFingerprint,
};

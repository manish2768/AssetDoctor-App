/**
 * Only keep GSTIN / invoice number / buyer when visibly labeled on the source document.
 * Missing fields stay blank — not an OCR failure.
 */

import { isValidGstinFormat } from './InvoiceOcrParser';
import { buyerNameOrNull } from './entityRoleClassifier';
import { isAddressLikeName } from './fieldValidators';

const GSTIN_LABELED_RE =
  /(?:GSTIN|GST\s*(?:IN|NO|NUMBER|REG(?:ISTRATION)?(?:\s*NO)?)|GST\s*REG(?:ISTRATION)?|DLR\.?\s*GST|DEALER\s*GST)\s*[:\-#.\s]*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/i;

const INVOICE_LABELED_RE =
  /(?:In[vo][il1]ce|Bill|Tax\s*Invoice)\s*(?:No|Number|#)\.?\s*[:\-#]?\s*([A-Z0-9][A-Z0-9\-\/]{3,})/i;

const BUYER_HEADER_RE = /^(?:bill\s*to|buyer(?:\s*name)?|ship\s*to|consignee|customer\s*name)\b/i;
const SWD_RE = /^(?:s\s*[\/\-]?\s*w\s*[\/\-]?\s*d|swid|s\/o|w\/o|d\/o|c\/o)\s*[:\-]/i;
const DEALER_BUYER_RE =
  /\b(?:pvt|ltd|limited|llp|inc|corp|company|motors|automobile|automotive|workshop|garage|service\s*center|dealer|gstin|invoice|tax)\b/i;

function isDealerLikeBuyerName(name) {
  const t = String(name || '').trim();
  if (!t || t.length < 3) return true;
  if (DEALER_BUYER_RE.test(t)) return true;
  if (isAddressLikeName(t)) return true;
  return false;
}

function preferServiceBillCustomer(next, labeledBuyer) {
  const canonical = next.canonicalServiceBill?.customer?.name;
  const extracted = next.customerName;
  const labeled = labeledBuyer?.name;
  if (canonical && labeled && canonical.trim().toLowerCase() !== labeled.trim().toLowerCase()) {
    return canonical;
  }
  if (extracted && labeled && isDealerLikeBuyerName(labeled) && !isDealerLikeBuyerName(extracted)) {
    return extracted;
  }
  if (labeled && isDealerLikeBuyerName(labeled)) return extracted || canonical || '';
  return labeled || extracted || canonical || '';
}

export function extractLabeledGstin(blob = '') {
  const m = String(blob || '').match(GSTIN_LABELED_RE);
  if (!m?.[1]) return null;
  const compact = m[1].replace(/\s+/g, '').toUpperCase();
  return isValidGstinFormat(compact) ? compact : null;
}

export function extractLabeledInvoiceNumber(lines = []) {
  const list = Array.isArray(lines) ? lines : [];
  for (let i = 0; i < list.length; i += 1) {
    const line = String(list[i] || '').trim();
    const m = line.match(INVOICE_LABELED_RE);
    if (m?.[1]) {
      const val = m[1].trim();
      if (/^(?:date|total|gstin|na|n\/a)$/i.test(val)) continue;
      if (/^\d{1,2}[\/\-.]\d{1,2}/.test(val)) continue;
      if (val.length >= 4 && val.length <= 40) return val;
    }
    // Label-only line: "Invoice No :" with value on the next line
    if (/^(?:in[vo][il1]ce|bill|tax\s*invoice)\s*(?:no|number|#)\.?\s*[:\-#]?\s*$/i.test(line)) {
      const next = String(list[i + 1] || '').trim();
      if (
        next &&
        next.length >= 3 &&
        next.length <= 40 &&
        !/^(?:date|total|gstin|na|n\/a)$/i.test(next) &&
        !/^\d{1,2}[\/\-.]\d{1,2}/.test(next)
      ) {
        return next;
      }
    }
  }
  return null;
}

export function extractLabeledBuyerName(lines = []) {
  const list = Array.isArray(lines) ? lines : [];
  for (let i = 0; i < list.length; i += 1) {
    const line = String(list[i] || '').trim();
    if (SWD_RE.test(line) && i > 0) {
      const prev = String(list[i - 1] || '').trim();
      if (prev.length >= 3 && prev.length <= 60 && !isAddressLikeName(prev)) {
        const person = buyerNameOrNull(prev);
        if (person) return { name: person, confidence: 90, source: 'swd_previous_line' };
      }
    }
    if (!BUYER_HEADER_RE.test(line)) continue;

    const inline = line
      .replace(/^(?:bill\s*to|buyer(?:\s*name)?|ship\s*to|consignee|customer\s*name)\s*[:\-]?\s*/i, '')
      .trim();
    if (inline.length >= 3 && !isAddressLikeName(inline)) {
      const person = buyerNameOrNull(inline);
      if (person) return { name: person, confidence: 92, source: 'buyer_label_inline' };
    }

    const next = String(list[i + 1] || '').trim();
    if (
      next.length >= 3 &&
      next.length <= 60 &&
      !isAddressLikeName(next) &&
      !/^(?:product|qty|description|particulars|handsets?|hsn)/i.test(next)
    ) {
      const person = buyerNameOrNull(next);
      if (person) return { name: person, confidence: 85, source: 'buyer_label_next_line' };
    }
  }
  return null;
}

/**
 * @param {object} data pipeline data
 * @param {string[]} lines OCR lines
 * @param {string} blob full OCR text
 */
export function applyDocumentFieldPresence(data = {}, lines = [], blob = '') {
  const next = { ...data };
  const corrections = [];
  const insuranceDoc =
    /insurance/i.test(String(data.documentKind || data.documentType || data.scanDocumentType || '')) ||
    Boolean(data.policyNumber && (data.policyHolder || data.policyStartDate || data.policyExpiryDate || data.insurer));

  const gstin = extractLabeledGstin(blob);
  if (gstin) {
    if (next.shopGstin !== gstin) corrections.push({ action: 'gstin_from_label', value: gstin });
    next.shopGstin = gstin;
    next.sellerGSTIN = gstin;
    next.gstinPresent = true;
  } else {
    if (next.shopGstin) corrections.push({ action: 'cleared_unlabeled_gstin', was: next.shopGstin });
    next.shopGstin = '';
    next.sellerGSTIN = '';
    next.gstinPresent = false;
    next.gstinStatus = 'not_present';
  }

  if (insuranceDoc) {
    next.invoiceNumberPresent = Boolean(next.policyNumber || next.invoiceNumber);
    next.buyerNeedsReview = !next.policyHolder && !next.customerName;
  } else {
    const inv = extractLabeledInvoiceNumber(lines);
    const serviceLike =
      /service|repair|job\s*card/i.test(
        String(data.documentKind || data.documentType || data.scanDocumentType || ''),
      ) || /\b(?:service\s*invoice|job\s*card|workshop)\b/i.test(String(blob || ''));
    const blobHasInvoiceLabel = /(?:invoice|bill)\s*(?:no|number|#)/i.test(String(blob || ''));
    if (inv) {
      next.invoiceNumber = inv;
      next.invoiceNumberPresent = true;
    } else if (serviceLike && next.invoiceNumber && blobHasInvoiceLabel) {
      // Keep service-bill extractor value when OCR split the label/value across lines.
      next.invoiceNumberPresent = true;
    } else {
      if (next.invoiceNumber) corrections.push({ action: 'cleared_unlabeled_invoice_number', was: next.invoiceNumber });
      next.invoiceNumber = '';
      next.invoiceNumberPresent = false;
      next.invoiceNumberStatus = 'not_present';
    }

    const extractedCustomer = String(next.customerName || '').trim();
    const buyer = extractLabeledBuyerName(lines);
    if (buyer?.name) {
      const resolved = serviceLike ? preferServiceBillCustomer(next, buyer) : buyer.name;
      if (resolved) {
        next.customerName = resolved;
        next.buyerName = resolved;
        next.buyerConfidence =
          resolved === buyer.name ? buyer.confidence : Math.min(buyer.confidence, 82);
        next.buyerSource =
          resolved === buyer.name ? buyer.source : 'service_bill_extractor_preferred';
        next.buyerNeedsReview = next.buyerConfidence < 88;
        if (serviceLike && resolved !== buyer.name) {
          corrections.push({
            action: 'rejected_dealer_like_labeled_buyer',
            labeled: buyer.name,
            kept: resolved,
          });
        }
      }
    }
    if (!next.customerName) {
      if (
        serviceLike &&
        extractedCustomer &&
        /^[A-Za-z][A-Za-z.\s'-]{2,50}$/.test(extractedCustomer) &&
        !/\b(?:pvt|ltd|gstin|invoice|workshop|dealer|motors)\b/i.test(extractedCustomer)
      ) {
        // Service bills often print customer name without a "Customer:" label.
        next.customerName = extractedCustomer;
        next.buyerName = extractedCustomer;
        next.buyerNeedsReview = true;
        next.buyerSource = next.buyerSource || 'service_bill_unlabeled';
        corrections.push({
          action: 'kept_service_bill_unlabeled_customer',
          value: extractedCustomer,
        });
      } else if (!serviceLike) {
        if (extractedCustomer) {
          corrections.push({ action: 'cleared_unlabeled_buyer', was: extractedCustomer });
        }
        next.customerName = '';
        next.buyerName = '';
        next.buyerConfidence = 0;
        next.buyerNeedsReview = true;
        next.buyerStatus = 'not_present';
      } else {
        next.customerName = '';
        next.buyerName = '';
        next.buyerConfidence = 0;
        next.buyerNeedsReview = true;
        next.buyerStatus = 'not_present';
      }
    }
  }

  return { data: next, corrections };
}

export default {
  extractLabeledGstin,
  extractLabeledInvoiceNumber,
  extractLabeledBuyerName,
  applyDocumentFieldPresence,
};

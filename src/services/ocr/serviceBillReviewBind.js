/**
 * Bind canonical service-bill OCR fields onto the Review invoice object.
 * Never invents values — only copies OCR/canonical fields or clears placeholders.
 */

import { isPlaceholderValue, stripPlaceholder } from './fieldValidators';
import { isServiceLikeDocument, toDocTypeV2 } from './documentIntelligenceTypes';

function pickStr(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || isPlaceholderValue(s)) continue;
    return s;
  }
  return '';
}

function pickNum(...vals) {
  for (const v of vals) {
    if (v == null || v === '') continue;
    const n = Number(String(v).replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function isServiceBillReviewDoc(invoice = {}, blob = '') {
  if (invoice?.isServiceInvoice === true) return true;
  const kind = String(
    invoice?.documentKind ||
      invoice?.documentType ||
      invoice?.scanDocumentType ||
      invoice?.documentTypeV2 ||
      '',
  );
  if (/service|repair|job\s*card/i.test(kind)) return true;
  const v2 = toDocTypeV2(invoice?.documentTypeV2 || kind, { blob });
  if (isServiceLikeDocument(v2)) return true;
  const text = String(blob || invoice?.rawText || '');
  return /\b(?:service\s*invoice|job\s*card|workshop|labour\s*charges|vehicle\s*wash)\b/i.test(text);
}

/**
 * Mutates `next` so Review shows service-bill OCR values (not stale/placeholder).
 */
export function bindServiceBillReviewFields(next = {}, { scanned = {}, extract = {} } = {}) {
  const canon = next.canonicalServiceBill || scanned.canonicalServiceBill || null;
  const blob = String(next.rawText || scanned.rawText || '');
  const serviceDoc = isServiceBillReviewDoc(next, blob);
  if (!serviceDoc) return next;

  next.isServiceInvoice = true;
  next.documentKind = 'service_invoice';
  next.documentType = 'service_invoice';
  next.scanDocumentType = 'service_invoice';
  next.showVehicleFields = true;
  next.requiresVehicleLink = true;
  next.isVehicleInvoice = false;

  const customer = pickStr(
    next.customerName,
    next.buyerName,
    canon?.customer?.name,
    scanned.customerName,
    scanned.buyerName,
    extract.owner_buyer_name,
    extract.buyer_name,
  );
  next.customerName = customer;
  next.buyerName = customer;

  const invoiceNumber = pickStr(
    next.invoiceNumber,
    canon?.service?.invoiceNumber,
    scanned.invoiceNumber,
    extract.invoice_or_policy_no,
    extract.invoice_number,
  );
  next.invoiceNumber = invoiceNumber;

  const nextDue = pickStr(
    next.nextServiceDue,
    canon?.service?.nextServiceDue,
    scanned.nextServiceDue,
  );
  let serviceDate = pickStr(
    canon?.service?.serviceDate,
    canon?.service?.invoiceDate,
    next.serviceDate,
    scanned.serviceDate,
  );
  if (!serviceDate) {
    const fallback = pickStr(next.invoiceDate, scanned.invoiceDate, next.purchaseDate);
    // Never treat Next Due Date (or a polluted copy of it) as the service/invoice date.
    if (fallback && fallback !== nextDue) serviceDate = fallback;
  }
  if (serviceDate) {
    next.serviceDate = serviceDate;
    next.invoiceDate = serviceDate;
    next.purchaseDate = serviceDate;
    next.purchase_date = serviceDate;
  }
  if (nextDue) next.nextServiceDue = nextDue;

  const registration = pickStr(
    next.registration,
    canon?.vehicle?.registrationNumber,
    scanned.registration,
    scanned.vehicle_registration_number,
    extract.vehicle_registration_number,
  );
  next.registration = registration ? String(registration).toUpperCase().replace(/\s+/g, '') : '';

  const odo = pickNum(
    next.odometerKm,
    next.odometerReading,
    canon?.service?.odometerReading,
    scanned.odometerKm,
    scanned.odometerReading,
    extract.odometer_km,
    extract.odometerKm,
  );
  if (odo != null) {
    next.odometerKm = odo;
    next.odometerReading = odo;
  }

  const brand = pickStr(next.brandName, canon?.vehicle?.make, scanned.brandName);
  const model = pickStr(next.model, canon?.vehicle?.model, scanned.model);
  if (brand) next.brandName = brand;
  if (model) next.model = model;
  const makeModel = [brand, model].filter(Boolean).join(' ').trim();
  if (makeModel) {
    // Prefer clean make/model over noisy OCR product lines on service bills.
    next.productName = makeModel;
    next.itemName = next.productName;
  }

  const isJunkShop = (v) => {
    const s = String(v || '').trim();
    if (!s) return true;
    if (/^(?:invoice|inv|bill|tax|gstin|nvoice)\b/i.test(s)) return true;
    if (/invoice\s*no|bill\s*no|nvoice\s*no/i.test(s) && s.length < 28) return true;
    return false;
  };
  const shopCandidates = [
    canon?.seller?.name,
    scanned.serviceProvider,
    scanned.sellerName,
    scanned.shopName,
    next.serviceProvider,
    next.sellerName,
    next.shopName,
  ];
  next.shopName = '';
  for (const c of shopCandidates) {
    const s = pickStr(c);
    if (s && !isJunkShop(s)) {
      next.shopName = s;
      break;
    }
  }
  next.sellerName = next.shopName;
  next.serviceProvider = next.shopName;
  next.vendor = next.shopName;
  next.vendor_name = next.shopName;

  for (const key of ['customerName', 'buyerName', 'invoiceNumber', 'registration', 'productName', 'shopName']) {
    const cleaned = stripPlaceholder(next[key], { asNull: false });
    next[key] = cleaned || '';
  }
  next.buyerName = next.customerName;
  next.buyer_name = next.customerName;
  next.owner_buyer_name = next.customerName;

  return next;
}

export default {
  isServiceBillReviewDoc,
  bindServiceBillReviewFields,
};

/**
 * Map invoice pipeline output → NormalizedDocument (provider-agnostic).
 */

import {
  OCR_ASSET_CATEGORY,
  OCR_DOC_TYPE,
  emptyNormalizedDocument,
  field,
} from './NormalizedDocument';

function docType(data) {
  const raw = String(data?.documentKind || data?.documentType || data?.classifiedDocumentType || '')
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (/INSURANCE/.test(raw)) return OCR_DOC_TYPE.INSURANCE;
  if (/PUC/.test(raw)) return OCR_DOC_TYPE.PUC;
  if (/RC|REGISTRATION/.test(raw)) return OCR_DOC_TYPE.RC;
  if (/WARRANTY/.test(raw)) return OCR_DOC_TYPE.WARRANTY;
  if (/SERVICE/.test(raw)) return OCR_DOC_TYPE.SERVICE_INVOICE;
  if (/INVOICE|BILL|PURCHASE/.test(raw)) return OCR_DOC_TYPE.PURCHASE_INVOICE;
  return OCR_DOC_TYPE.PURCHASE_INVOICE;
}

function assetCategory(data) {
  const c = String(data?.assetDocCategory || data?.documentAssetCategory || '').toUpperCase();
  if (c === 'GADGET') return OCR_ASSET_CATEGORY.GADGET;
  if (c === 'VEHICLE') return OCR_ASSET_CATEGORY.VEHICLE;
  if (c === 'HOME_APPLIANCE' || c === 'HOME') return OCR_ASSET_CATEGORY.HOME_APPLIANCE;
  if (/gadget/i.test(String(data?.smartCategory || data?.category || ''))) {
    return OCR_ASSET_CATEGORY.GADGET;
  }
  if (/vehicle/i.test(String(data?.smartCategory || data?.purchaseCategory || ''))) {
    return OCR_ASSET_CATEGORY.VEHICLE;
  }
  return OCR_ASSET_CATEGORY.OTHER;
}

function conf(data, key, fallback = 0) {
  const fc = data?.fieldConfidence || {};
  const n = Number(fc[key]);
  if (Number.isFinite(n)) return n > 1 ? n / 100 : n;
  return fallback;
}

function needsReview(data, key, value) {
  if (value == null || value === '') return true;
  const lows = data?.lowConfidenceFields || [];
  if (lows.includes(key)) return true;
  return conf(data, key) > 0 && conf(data, key) < 0.85;
}

function src(engine, extra) {
  return [engine, extra].filter(Boolean).join('+') || 'ocr';
}

/**
 * @param {object} data pipeline invoice
 * @param {{ engine?: string, rawText?: string }} [opts]
 */
export function invoiceToNormalizedDocument(data = {}, opts = {}) {
  const engine = opts.engine || data.engine || '';
  const category = assetCategory(data);
  const semantic = data.geminiValidation?.applied ? 'semantic' : 'pipeline';
  const source = src(engine, semantic);
  const out = emptyNormalizedDocument();

  out.documentType = docType(data);
  out.assetCategory = category;
  out.categoryConfidence = Number(data.assetCategoryConfidence) || conf(data, 'productName', 0);
  out.engine = engine;
  out.rawText = String(opts.rawText || data.rawText || '').slice(0, 8000);
  out.validationErrors = Array.isArray(data.pipelineMeta?.corrections)
    ? data.pipelineMeta.corrections
    : [];

  const product = data.productName || null;
  const total = data.totalAmount != null ? Number(data.totalAmount) : null;
  const imei = String(data.imei || '').replace(/\D/g, '') || null;
  const gadget = category === OCR_ASSET_CATEGORY.GADGET;
  const vehicle = category === OCR_ASSET_CATEGORY.VEHICLE;

  out.productName = field(product, conf(data, 'productName', product ? 0.7 : 0), source, needsReview(data, 'productName', product));
  out.brand = field(data.brand || null, 0.5, source, true);
  out.model = field(data.model || null, 0.5, source, true);
  out.variant = field(data.variant || null, 0.6, source, !data.variant);
  const qty = data.items?.[0]?.qty != null ? Number(data.items[0].qty) : 1;
  out.quantity = field(qty, qty === 1 ? 0.8 : 0.6, source, false);
  out.unitPrice = field(
    data.items?.[0]?.rate ?? data.items?.[0]?.unitPrice ?? total,
    conf(data, 'price', 0),
    source,
    needsReview(data, 'price', total),
  );
  out.lineTotal = field(
    data.items?.[0]?.amount ?? data.items?.[0]?.lineTotal ?? total,
    conf(data, 'price', 0),
    source,
    needsReview(data, 'price', total),
  );
  out.grandTotal = field(total, conf(data, 'price', 0), source, needsReview(data, 'price', total));
  out.taxAmount = field(data.taxAmount != null ? Number(data.taxAmount) : null, 0.5, source, true);
  out.imei = field(gadget || imei ? imei : null, conf(data, 'imei', imei ? 0.8 : 0), source, !imei);
  out.serialNumber = field(data.serialNumber || null, conf(data, 'serialNumber', 0), source, !data.serialNumber);
  out.chassisNumber = field(
    vehicle ? data.chassisNumber || null : null,
    vehicle ? 0.7 : 0,
    source,
    !vehicle || !data.chassisNumber,
  );
  out.engineNumber = field(
    vehicle ? data.engineNumber || null : null,
    vehicle ? 0.7 : 0,
    source,
    !vehicle || !data.engineNumber,
  );
  out.registrationNumber = field(
    vehicle ? data.registration || null : null,
    vehicle ? 0.7 : 0,
    source,
    !vehicle || !data.registration,
  );
  out.seller = field(data.shopName || null, conf(data, 'seller', 0), source, needsReview(data, 'seller', data.shopName));
  out.sellerGstin = field(data.shopGstin || null, 0.7, source, !data.shopGstin);
  out.buyerName = field(
    data.customerName || data.buyerName || null,
    data.customerName ? 0.7 : 0,
    source,
    !data.customerName,
  );
  out.invoiceNumber = field(
    data.invoiceNumber || null,
    conf(data, 'invoiceNumber', 0),
    source,
    !data.invoiceNumber,
  );
  out.purchaseDate = field(
    data.invoiceDate || data.purchaseDate || null,
    conf(data, 'purchaseDate', 0),
    source,
    needsReview(data, 'purchaseDate', data.invoiceDate),
  );
  out.paymentMode = field(data.paymentMode || null, 0.4, source, true);
  out.items = Array.isArray(data.items)
    ? data.items.map((it) => ({
        productName: it?.name || it?.productName || null,
        quantity: it?.qty ?? 1,
        lineTotal: it?.amount ?? it?.lineTotal ?? null,
        imei: it?.imei || null,
        confidence: 0.7,
        source,
      }))
    : [];
  out.needsReview = Boolean(data.needsManualReview) || out.productName.needsReview || out.grandTotal.needsReview;
  return out;
}

export default invoiceToNormalizedDocument;

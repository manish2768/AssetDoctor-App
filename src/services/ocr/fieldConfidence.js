/**
 * Per-field OCR confidence (0–1) for Review Invoice highlighting.
 */

import { isTaxIdentifierText, MAX_PLAUSIBLE_INR } from './invoiceAmountGuard';
import { isJunkVendorOrName } from './ocrFieldHeuristics';

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function hasText(v) {
  return String(v || '').trim().length >= 2;
}

function validImei(value) {
  const d = String(value || '').replace(/\D/g, '');
  if (d.length !== 15) return false;
  // Luhn
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    let n = Number(d[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * @param {object} data — merged invoice / OCR payload
 * @returns {{ fields: Record<string, number>, overall: number, lowFields: string[], reasons: Record<string, string> }}
 */
export function scoreFieldConfidences(data = {}) {
  const fields = {};
  const reasons = {};

  const product = String(data.productName || data.product_name || data.asset_name || '').trim();
  if (!hasText(product) || isTaxIdentifierText(product) || isJunkVendorOrName(product)) {
    fields.productName = 0.2;
    reasons.productName = 'Product name looks like a tax code or label, not an item.';
  } else if (/nothing\s+phone|iphone|galaxy|buds|ronin|apache/i.test(product)) {
    fields.productName = 0.95;
  } else {
    fields.productName = 0.78;
  }

  const price = Number(data.totalAmount ?? data.total_amount ?? data.price);
  if (!(price > 0) || price > MAX_PLAUSIBLE_INR) {
    fields.price = 0.15;
    reasons.price = 'Purchase price missing or not plausible.';
  } else if (price === Math.round(price) || Math.abs(price - Math.round(price)) < 0.02) {
    fields.price = 0.92;
  } else {
    fields.price = 0.8;
  }

  const date = String(data.invoiceDate || data.purchaseDate || data.purchase_date || '').trim();
  if (!date) {
    fields.purchaseDate = 0.25;
    reasons.purchaseDate = 'Purchase date not found on the bill.';
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(date) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(date)) {
    fields.purchaseDate = 0.9;
  } else {
    fields.purchaseDate = 0.45;
    reasons.purchaseDate = 'Date format could not be verified.';
  }

  const seller = String(data.shopName || data.seller_name || data.vendor || '').trim();
  if (!hasText(seller) || isTaxIdentifierText(seller) || isJunkVendorOrName(seller)) {
    fields.seller = 0.2;
    reasons.seller = 'Seller looks like CIN/GSTIN/SAC noise, not a company name.';
  } else {
    fields.seller = 0.75;
  }

  const inv = String(data.invoiceNumber || data.invoice_number || '').trim();
  if (!inv) {
    fields.invoiceNumber = 0.35;
  } else if (isTaxIdentifierText(inv) || /gstin|sac|hsn/i.test(inv)) {
    fields.invoiceNumber = 0.2;
    reasons.invoiceNumber = 'Invoice number may be confused with a tax identifier.';
  } else {
    fields.invoiceNumber = 0.85;
  }

  const imei = String(data.imei || '').replace(/\D/g, '') || '';
  const serial = String(data.serialNumber || data.serial_number || '').trim();
  if (imei) {
    if (imei.length === 15 && validImei(imei)) {
      fields.imei = 0.98;
    } else if (imei.length === 15) {
      fields.imei = 0.22;
      reasons.imei = 'IMEI failed Luhn checksum — must not be treated as verified.';
    } else {
      fields.imei = 0.2;
      reasons.imei = 'IMEI should be 15 digits with a valid Luhn check.';
    }
  } else {
    fields.imei = serial ? 0.7 : 0.5;
  }

  const gstin = String(data.shopGstin || data.gstin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (gstin) {
    const gstOk = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
    fields.gstin = gstOk ? 0.9 : 0.25;
    if (!gstOk) reasons.gstin = 'GSTIN format failed checksum/pattern validation.';
  }

  const vin = String(data.chassisNumber || data.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (vin) {
    if (vin.length === 17 && !/[IOQ]/.test(vin)) {
      fields.chassisNumber = 0.92;
    } else {
      fields.chassisNumber = 0.28;
      reasons.chassisNumber = 'Chassis/VIN failed 17-char / I-O-Q validation.';
    }
  }

  const reg = String(data.registration || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (reg) {
    const rtoOk = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/.test(reg) || /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/.test(reg);
    fields.registration = rtoOk ? 0.92 : 0.3;
    if (!rtoOk) reasons.registration = 'Registration number failed Indian RTO format check.';
  }

  const purchaseDate = String(data.invoiceDate || data.purchaseDate || data.purchase_date || '').trim();
  if (purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
    const yr = Number(purchaseDate.slice(0, 4));
    if (yr < 1990 || yr > 2100) {
      fields.purchaseDate = 0.15;
      reasons.purchaseDate = 'Date year is outside a plausible range.';
    }
  }

  if (serial && !isTaxIdentifierText(serial) && serial.length >= 5) {
    fields.serialNumber = 0.85;
  } else if (serial) {
    fields.serialNumber = 0.3;
    reasons.serialNumber = 'Serial looks like a tax code.';
  } else {
    fields.serialNumber = 0.5;
  }

  const kind = String(data.documentKind || data.documentType || '').toLowerCase();
  if (kind.includes('insurance')) {
    fields.policyNumber = hasText(data.policyNumber || data.invoiceNumber) ? 0.88 : 0.2;
    fields.policyHolder = hasText(data.policyHolder || data.customerName) ? 0.8 : 0.2;
    if (!hasText(data.registration)) fields.registration = 0.2;
    else if (fields.registration == null || fields.registration >= 0.55) {
      fields.registration = Math.max(fields.registration || 0, 0.9);
    }
    fields.policyStartDate = hasText(data.policyStartDate || data.insuranceStart) ? 0.85 : 0.2;
    fields.policyExpiryDate = hasText(data.policyExpiryDate || data.insuranceExpiry) ? 0.85 : 0.2;
  }
  if (kind.includes('service') || data.isServiceInvoice) {
    const odo = data.odometerKm ?? data.odometerReading;
    fields.odometerReading = odo != null && Number(odo) > 0 ? 0.9 : 0.15;
    if (!hasText(data.registration)) fields.registration = 0.2;
    else if (fields.registration == null || fields.registration >= 0.55) {
      fields.registration = Math.max(fields.registration || 0, 0.9);
    }
  }

  const critical = ['productName', 'price'];
  const extraLow = [
    'seller',
    'imei',
    'purchaseDate',
    'policyNumber',
    'odometerReading',
    'registration',
  ];
  const lowFields = Object.entries(fields)
    .filter(([k, v]) => v < 0.55 && (critical.includes(k) || extraLow.includes(k)))
    .map(([k]) => k);

  const overall = clamp01(
    (fields.productName * 0.3 +
      fields.price * 0.35 +
      fields.purchaseDate * 0.15 +
      fields.seller * 0.1 +
      Math.max(fields.imei, fields.serialNumber) * 0.1),
  );

  return { fields, overall, lowFields, reasons };
}

export function fieldNeedsReview(score) {
  return !(Number(score) >= 0.55);
}

export default scoreFieldConfidences;

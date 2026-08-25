/**
 * Gemini is a semantic validator — not the source of truth.
 * May fill blanks that already appear in OCR text. Must not invent.
 */

import { isTaxIdentifierText, preferPurchaseTotal } from './invoiceAmountGuard';
import { isJunkVendorOrName } from './ocrFieldHeuristics';
import { isAddressLikeName, isPlaceholderValue } from './fieldValidators';
import { isValidProductName, isSellerCompanyName } from './productNameValidation';
import { isBoilerplateFooter } from './invoiceBoilerplate';
import { buyerNameOrNull } from './entityRoleClassifier';
import { ASSET_DOC_CATEGORY } from './assetCategoryClassifier';

function inOcr(rawText, value) {
  const v = String(value || '').trim();
  if (!v || v.length < 3) return false;
  const blob = String(rawText || '').toLowerCase();
  const needle = v.toLowerCase().slice(0, 24);
  if (blob.includes(needle)) return true;
  const compactNeedle = v.replace(/[\s\-\/,]/g, '').toLowerCase().slice(0, 16);
  const compactHay = String(rawText || '').replace(/[\s\-\/,]/g, '').toLowerCase();
  if (compactNeedle.length >= 4 && compactHay.includes(compactNeedle)) return true;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, mo, d] = iso;
    const variants = [
      `${d}/${mo}/${y}`,
      `${d}-${mo}-${y}`,
      `${Number(d)}/${Number(mo)}/${y}`,
      `${Number(d)}-${Number(mo)}-${y}`,
      `${d}${mo}${y}`,
    ];
    return variants.some((alt) => blob.includes(alt.toLowerCase()) || compactHay.includes(alt.replace(/[\s\-\/,]/g, '').toLowerCase()));
  }
  return false;
}

function fillBlank(next, key, geminiValue, rawText, corrections, action) {
  if (String(next[key] || '').trim()) return false;
  const v = geminiValue == null ? '' : String(geminiValue).trim();
  if (!v || v === 'null') return false;
  if (!inOcr(rawText, v) && !inOcr(rawText, v.replace(/[\s-]/g, ''))) return false;
  next[key] = v;
  corrections.push({ action, value: v });
  return true;
}

function geminiProduct(g) {
  return String(g?.asset_name || g?.item_name || g?.product_name || g?.assetName || g?.itemName || '').trim();
}

function geminiBuyer(g) {
  return String(g?.owner_buyer_name || g?.buyer_name || g?.buyerName || g?.customerName || '').trim();
}

function geminiSeller(g) {
  return String(
    g?.vendor_dealer_name || g?.vendor_name || g?.seller_name || g?.shopName || g?.vendor || '',
  ).trim();
}

/**
 * @param {object} data pipeline result
 * @param {object|null} gemini Gemini JSON
 * @param {string} rawText
 */
export function applyGeminiValidation(data = {}, gemini = null, rawText = '') {
  const next = { ...data };
  const corrections = Array.isArray(next.pipelineMeta?.corrections)
    ? [...next.pipelineMeta.corrections]
    : [];

  if (!gemini || typeof gemini !== 'object') {
    next.geminiValidation = { applied: false, reason: 'no_gemini' };
    return next;
  }

  const category = next.assetDocCategory || next.documentAssetCategory;

  const gProduct = geminiProduct(gemini);
  const parserProduct = String(next.productName || '').trim();
  if (
    (!parserProduct || !isValidProductName(parserProduct) || isSellerCompanyName(parserProduct)) &&
    gProduct &&
    isValidProductName(gProduct) &&
    !isSellerCompanyName(gProduct) &&
    !isTaxIdentifierText(gProduct) &&
    !isJunkVendorOrName(gProduct) &&
    !isBoilerplateFooter(gProduct) &&
    inOcr(rawText, gProduct)
  ) {
    next.productName = gProduct;
    corrections.push({ action: 'gemini_filled_blank_product', value: gProduct });
  } else if (gProduct && parserProduct && gProduct !== parserProduct && !inOcr(rawText, gProduct)) {
    corrections.push({ action: 'gemini_product_rejected_not_in_ocr', value: gProduct });
  }

  const gBuyer = geminiBuyer(gemini);
  if (!String(next.customerName || '').trim()) {
    const safe = buyerNameOrNull(gBuyer);
    if (safe && inOcr(rawText, safe) && !isAddressLikeName(safe) && !isPlaceholderValue(safe)) {
      next.customerName = safe;
      corrections.push({ action: 'gemini_filled_blank_buyer' });
    }
  } else if (isAddressLikeName(next.customerName) || !buyerNameOrNull(next.customerName)) {
    next.customerName = '';
    next.buyerName = '';
    corrections.push({ action: 'buyer_blanked_not_a_person' });
  }

  const gSeller = geminiSeller(gemini);
  if (
    (!String(next.shopName || '').trim() || isJunkVendorOrName(next.shopName)) &&
    gSeller &&
    !isTaxIdentifierText(gSeller) &&
    !isJunkVendorOrName(gSeller) &&
    inOcr(rawText, gSeller)
  ) {
    next.shopName = gSeller;
  }

  const gTotal = gemini.total_amount != null ? Number(gemini.total_amount) : null;
  if (
    (next.totalAmount == null || !(Number(next.totalAmount) > 0)) &&
    gTotal != null &&
    Number.isFinite(gTotal) &&
    gTotal > 0 &&
    inOcr(rawText, String(Math.round(gTotal)))
  ) {
    const resolved = preferPurchaseTotal(next.totalAmount, gTotal);
    if (resolved != null) next.totalAmount = resolved;
  } else if (gTotal != null && Number(next.totalAmount) > 0 && gTotal !== Number(next.totalAmount)) {
    corrections.push({
      action: 'gemini_total_not_applied_pipeline_wins',
      pipeline: next.totalAmount,
      gemini: gTotal,
    });
  }

  const gImei = String(gemini.imei || '').replace(/\D/g, '');
  if (!String(next.imei || '').replace(/\D/g, '') && gImei.length >= 14 && gImei.length <= 17 && rawText.includes(gImei.slice(0, 14))) {
    next.imei = gImei;
  }

  if (category === ASSET_DOC_CATEGORY.GADGET || String(next.imei || '').replace(/\D/g, '').length >= 14) {
    next.chassisNumber = '';
    next.engineNumber = '';
    next.registration = '';
    next.showVehicleFields = false;
    next.isVehicleInvoice = false;
  } else if (category === ASSET_DOC_CATEGORY.VEHICLE) {
    if (!String(next.imei || '').replace(/\D/g, '')) next.imei = '';
  }

  if (Array.isArray(next.items)) {
    next.items = next.items.filter((it) => !isBoilerplateFooter(it?.name || it?.productName || ''));
    next.itemCount = next.items.length;
  }

  next.buyerName = next.customerName || '';

  const kind = String(next.documentKind || next.documentType || gemini.document_type || '').toLowerCase();
  const insurance = kind.includes('insurance');
  const service = kind.includes('service') || next.isServiceInvoice;

  if (insurance) {
    fillBlank(
      next,
      'policyNumber',
      gemini.policy_number || gemini.invoice_or_policy_no || gemini.invoice_number,
      rawText,
      corrections,
      'gemini_filled_policy_number',
    );
    if (next.policyNumber) next.invoiceNumber = next.policyNumber;
    fillBlank(
      next,
      'policyHolder',
      gemini.policy_holder_name || gemini.owner_buyer_name || gemini.buyer_name,
      rawText,
      corrections,
      'gemini_filled_policy_holder',
    );
    if (next.policyHolder && !next.customerName) {
      next.customerName = next.policyHolder;
      next.buyerName = next.policyHolder;
    }
    fillBlank(next, 'insurer', gemini.insurer_name || gemini.seller_name, rawText, corrections, 'gemini_filled_insurer');
    if (next.insurer && !next.shopName) next.shopName = next.insurer;
    fillBlank(
      next,
      'registration',
      gemini.vehicle_registration_number || gemini.registration_number,
      rawText,
      corrections,
      'gemini_filled_registration',
    );
    fillBlank(
      next,
      'policyStartDate',
      gemini.policy_start_date,
      rawText,
      corrections,
      'gemini_filled_policy_start',
    );
    if (next.policyStartDate && !next.insuranceStart) next.insuranceStart = next.policyStartDate;
    fillBlank(
      next,
      'policyExpiryDate',
      gemini.policy_end_date || gemini.expiry_date,
      rawText,
      corrections,
      'gemini_filled_policy_end',
    );
    if (next.policyExpiryDate && !next.insuranceExpiry) next.insuranceExpiry = next.policyExpiryDate;
    fillBlank(next, 'chassisNumber', gemini.chassis_or_frame_no, rawText, corrections, 'gemini_filled_chassis');
    fillBlank(next, 'engineNumber', gemini.engine_number, rawText, corrections, 'gemini_filled_engine');
    fillBlank(next, 'coverageType', gemini.coverage_type, rawText, corrections, 'gemini_filled_coverage');
    fillBlank(next, 'brandName', gemini.vehicle_make, rawText, corrections, 'gemini_filled_make');
    fillBlank(next, 'model', gemini.vehicle_model, rawText, corrections, 'gemini_filled_model');
    const gIdv = gemini.idv != null ? Number(gemini.idv) : null;
    if ((next.idv == null || next.idv === '') && gIdv != null && Number.isFinite(gIdv) && gIdv > 0 && inOcr(rawText, String(Math.round(gIdv)))) {
      next.idv = gIdv;
    }
    const gPrem = gemini.premium != null ? Number(gemini.premium) : null;
    if ((next.premium == null || next.premium === '') && gPrem != null && Number.isFinite(gPrem) && gPrem > 0 && inOcr(rawText, String(Math.round(gPrem)))) {
      next.premium = gPrem;
    }
  }

  if (service) {
    fillBlank(next, 'shopName', gemini.workshop_name || gemini.seller_name, rawText, corrections, 'gemini_filled_workshop');
    fillBlank(next, 'invoiceNumber', gemini.invoice_number || gemini.invoice_or_policy_no, rawText, corrections, 'gemini_filled_invoice_no');
    fillBlank(
      next,
      'registration',
      gemini.vehicle_registration_number || gemini.registration_number,
      rawText,
      corrections,
      'gemini_filled_registration',
    );
    fillBlank(next, 'serviceDate', gemini.invoice_date || gemini.purchase_date, rawText, corrections, 'gemini_filled_service_date');
    if (next.serviceDate && !next.invoiceDate) next.invoiceDate = next.serviceDate;
    fillBlank(next, 'brandName', gemini.vehicle_make, rawText, corrections, 'gemini_filled_make');
    fillBlank(next, 'model', gemini.vehicle_model, rawText, corrections, 'gemini_filled_model');
    fillBlank(next, 'paymentMode', gemini.payment_mode, rawText, corrections, 'gemini_filled_payment_mode');
    const gOdo = gemini.odometer_reading != null ? Number(gemini.odometer_reading) : null;
    if (
      next.odometerKm == null &&
      gOdo != null &&
      Number.isFinite(gOdo) &&
      gOdo > 0 &&
      inOcr(rawText, String(gOdo))
    ) {
      next.odometerKm = gOdo;
      next.odometerReading = gOdo;
      next.odometerUnit = String(gemini.odometer_unit || 'km').toLowerCase().startsWith('mi') ? 'mi' : 'km';
      corrections.push({ action: 'gemini_filled_odometer', value: gOdo });
    }
  }

  next.geminiValidation = { applied: true, corrections };
  if (next.pipelineMeta) {
    next.pipelineMeta = { ...next.pipelineMeta, corrections: [...(next.pipelineMeta.corrections || []), ...corrections] };
  }
  return next;
}

export default applyGeminiValidation;

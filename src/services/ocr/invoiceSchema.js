/**
 * Comprehensive invoice OCR schema (Cloud Vision / ML Kit text → structured fields).
 * Separate from the vault allowlist used by legacy Add Asset ML Kit path.
 */

import { toVaultValue } from '../../utils/parseMoneyValue';

export const PURCHASE_CATEGORIES = Object.freeze({
  VEHICLES: 'Vehicles',
  ELECTRONICS: 'Electronics',
  PROPERTY: 'Property',
  PERSONAL: 'Personal',
});

/** Empty invoice payload — never invent values; leave blanks for user confirm */
export function emptyInvoiceData() {
  return {
    shopName: '',
    shopPhone: '',
    shopAddress: '',
    shopGstin: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    invoiceNumber: '',
    invoiceDate: null,
    totalAmount: null,
    taxAmount: null,
    cgst: null,
    sgst: null,
    igst: null,
    subtotal: null,
    paymentMode: '',
    productName: '',
    serialNumber: '',
    imei: '',
    chassisNumber: '',
    engineNumber: '',
    warrantyPeriodMonths: null,
    warrantyExpiry: null,
    pucExpiry: null,
    insuranceExpiry: null,
    nextServiceDue: null,
    odometerKm: null,
    nextServiceOdometerKm: null,
    registration: '',
    purchaseCategory: PURCHASE_CATEGORIES.PERSONAL,
    documentType: 'bill',
    documentKind: 'bill',
    documentLabel: 'Purchase Bill / Invoice',
    isVehicleInvoice: false,
    requiresVehicleLink: false,
    classifiedDocumentType: '',
    geminiDocumentType: '',
    geminiCategory: '',
    ocrExtract: null,
    billThumbDataUrl: null,
    /** Line items from multi-product invoices */
    items: [],
    itemCount: 0,
    itemsSubtotal: null,
  };
}

/**
 * Map invoice schema → Asset Doctor vault / form fields.
 */
export function invoiceToAssetForm(invoice = {}, extras = {}) {
  const selectedItem = extras.item || null;
  const productName = selectedItem?.name || invoice.productName || '';
  const imeiRaw = String(invoice.imei || selectedItem?.imei || '').replace(/\D/g, '');
  const imei = imeiRaw.length === 15 ? imeiRaw : '';
  const serialRaw = String(invoice.serialNumber || selectedItem?.serialNumber || '').trim();
  const serialNumber = serialRaw;
  const purchaseDate = invoice.invoiceDate || null;
  let warrantyExpiry = invoice.warrantyExpiry || null;

  // Prefer line amount only when positive; else Grand Total / Amount Payable
  const itemAmt = selectedItem?.amount != null ? Number(selectedItem.amount) : null;
  const grand = invoice.totalAmount != null ? Number(invoice.totalAmount) : null;
  const lineValue = toVaultValue(
    itemAmt != null && itemAmt > 0 ? itemAmt : grand != null && grand > 0 ? grand : null,
    0,
  );

  const brandName = String(invoice.brand || '').trim();
  const smartCategory =
    selectedItem?.smartCategory || invoice.smartCategory || extras.smartCategory || '';
  const categoryId =
    selectedItem?.categoryId ||
    categoryIdFromPurchase(invoice.purchaseCategory, productName, smartCategory);

  const docType = String(
    extras.scanDocumentType || invoice.documentType || invoice.documentKind || 'bill',
  ).toLowerCase();
  const isInsuranceDoc = docType === 'insurance';
  const isPucDoc = docType === 'puc';
  const isWarrantyDoc = docType === 'warranty';
  const isRcDoc = docType === 'rc';
  const isAttachDoc = isInsuranceDoc || isPucDoc || isWarrantyDoc || isRcDoc;
  const isVehicle =
    invoice.purchaseCategory === PURCHASE_CATEGORIES.VEHICLES ||
    Boolean(invoice.isVehicleInvoice) ||
    isAttachDoc ||
    Boolean(invoice.chassisNumber || invoice.engineNumber || invoice.registration);

  const rawName = String(productName || '').trim();
  const safeName =
    /policy\s*no|1800|toll\s*free|helpline|includes?\s+hsrp|welcome\s*kit/i.test(rawName)
      ? ''
      : rawName;

  return {
    assetName:
      safeName ||
      (isAttachDoc && invoice.registration
        ? `${isInsuranceDoc ? 'Insurance' : isPucDoc ? 'PUC' : isRcDoc ? 'RC' : 'Warranty'} · ${invoice.registration}`
        : ''),
    storeName: invoice.shopName || '',
    purchaseDate,
    // IMEI and serial number are distinct fields. Never show an IMEI as a serial.
    serialNumber,
    imei,
    chassisNumber: invoice.chassisNumber || '',
    engineNumber: invoice.engineNumber || '',
    warrantyExpiry: isInsuranceDoc || isPucDoc ? null : warrantyExpiry,
    warrantyStart: isInsuranceDoc || isPucDoc ? null : invoice.warrantyStart || null,
    warrantyNeedsReview: Boolean(invoice.warrantyNeedsReview),
    value: isAttachDoc ? 0 : lineValue,
    supportPhone: invoice.shopPhone || '',
    brandName,
    registration: isVehicle || isAttachDoc ? String(invoice.registration || '').trim() : '',
    // Buyer / owner — never leave blank when OCR found a name
    customerName: String(invoice.customerName || '').trim(),
    buyerName: String(invoice.customerName || '').trim(),
    ownerName: String(invoice.customerName || '').trim(),
    nickname: String(invoice.nickname || invoice.locationLabel || '').trim(),
    locationLabel: String(invoice.locationLabel || invoice.nickname || '').trim(),
    // OCR already nulls wrong types; Review may confirm dates manually
    pucExpiry: invoice.pucExpiry || null,
    insuranceExpiry: invoice.insuranceExpiry || null,
    nextServiceDue: isVehicle ? invoice.nextServiceDue || null : null,
    odometerKm: invoice.odometerKm != null ? Number(invoice.odometerKm) : null,
    nextServiceOdometerKm:
      invoice.nextServiceOdometerKm != null ? Number(invoice.nextServiceOdometerKm) : null,
    categoryId:
      isVehicle && (!categoryId || categoryId === 'other')
        ? categoryIdFromPurchase(
            PURCHASE_CATEGORIES.VEHICLES,
            safeName || productName,
            'vehicles',
          )
        : categoryId,
    category: groupFromPurchase(
      isVehicle ? PURCHASE_CATEGORIES.VEHICLES : invoice.purchaseCategory,
    ),
    smartCategory: isVehicle ? 'vehicles' : smartCategory,
    trackImei: Boolean(selectedItem?.trackImei),
    trackPucService: Boolean(selectedItem?.trackPucService) || isVehicle,
    seasonalServiceAlerts: Boolean(selectedItem?.seasonalServiceAlerts),
    scanDocumentType: isWarrantyDoc
      ? 'warranty'
      : isInsuranceDoc
        ? 'insurance'
        : isPucDoc
          ? 'puc'
          : isRcDoc
            ? 'rc'
            : 'bill',
    documentLabel: invoice.documentLabel || '',
    isVehicleInvoice: Boolean(invoice.isVehicleInvoice),
    requiresVehicleLink: Boolean(invoice.requiresVehicleLink) || isAttachDoc,
    invoiceMeta: {
      shopName: invoice.shopName || '',
      shopPhone: invoice.shopPhone || '',
      shopAddress: invoice.shopAddress || '',
      shopGstin: invoice.shopGstin || '',
      customerName: invoice.customerName || '',
      customerPhone: invoice.customerPhone || '',
      customerAddress: invoice.customerAddress || '',
      invoiceNumber: invoice.invoiceNumber || '',
      invoiceDate: invoice.invoiceDate || null,
      totalAmount: invoice.totalAmount,
      taxAmount: invoice.taxAmount,
      cgst: invoice.cgst,
      sgst: invoice.sgst,
      igst: invoice.igst,
      subtotal: invoice.subtotal,
      paymentMode: invoice.paymentMode || '',
      warrantyPeriodMonths: invoice.warrantyPeriodMonths,
      warrantyExpiry: invoice.warrantyExpiry || null,
      warrantyStart: invoice.warrantyStart || null,
      warrantyNeedsReview: Boolean(invoice.warrantyNeedsReview),
      warrantyText: invoice.warrantyText || '',
      purchaseCategory: invoice.purchaseCategory,
      smartCategory,
      documentType: invoice.documentType || docType,
      documentKind: invoice.documentKind || docType,
      documentLabel: invoice.documentLabel || '',
      isVehicleInvoice: Boolean(invoice.isVehicleInvoice),
      chassisNumber: invoice.chassisNumber || '',
      engineNumber: invoice.engineNumber || '',
      itemCount: invoice.itemCount || (invoice.items || []).length,
      itemsSubtotal: invoice.itemsSubtotal,
      items: invoice.items || [],
      lineItem: selectedItem || null,
      imei,
      serialNumber,
      sweetBillAudit: extras.audit || null,
    },
  };
}

function guessBrand(productName) {
  const first = String(productName || '')
    .trim()
    .split(/\s+/)[0];
  return first && first.length > 1 ? first : '';
}

function groupFromPurchase(purchaseCategory) {
  switch (purchaseCategory) {
    case PURCHASE_CATEGORIES.VEHICLES:
      return 'Vehicles';
    case PURCHASE_CATEGORIES.ELECTRONICS:
      return 'Electronics & Appliances';
    case PURCHASE_CATEGORIES.PROPERTY:
      return 'Digital Bills & Utility Subscriptions';
    default:
      return 'Personal & Legal';
  }
}

function categoryIdFromPurchase(purchaseCategory, productName = '', smartCategory = '') {
  const text = `${purchaseCategory} ${productName} ${smartCategory}`.toLowerCase();
  if (/accessory|charger|cable|cover|case|adapter/.test(text)) return 'accessory';
  if (/bike|motorcycle|ronin|pulsar/.test(text)) return 'bike';
  if (/car|suv|sedan/.test(text)) return 'car';
  if (/scooter|activa|jupiter/.test(text)) return 'scooter';
  if (/helmet|tyre|tire|engine\s*oil|vehicle_parts/.test(text)) return 'vehicle_parts';
  if (/ac|air.?cond/.test(text)) return 'ac';
  if (/fridge|refrigerator/.test(text)) return 'fridge';
  if (/washer|washing/.test(text)) return 'washing_machine';
  if (/tv|television|led/.test(text)) return 'tv';
  if (/microwave|oven/.test(text)) return 'microwave';
  if (/geyser|water\s*heater/.test(text)) return 'geyser';
  if (/laptop|notebook/.test(text)) return 'laptop';
  if (/tablet|ipad/.test(text)) return 'tablet';
  if (/phone|mobile|iphone|android/.test(text)) return 'mobile';
  if (smartCategory === 'home_appliances') return 'appliance';
  if (smartCategory === 'gadgets') return 'mobile';
  if (smartCategory === 'vehicles') return 'bike';
  if (smartCategory === 'accessories') return 'accessory';
  if (purchaseCategory === PURCHASE_CATEGORIES.VEHICLES) return 'bike';
  if (purchaseCategory === PURCHASE_CATEGORIES.ELECTRONICS) return 'appliance';
  if (purchaseCategory === PURCHASE_CATEGORIES.PROPERTY) return 'property';
  return 'other';
}

export function addMonthsIso(isoDate, months) {
  if (!isoDate || !months) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

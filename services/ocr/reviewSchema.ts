/**
 * Document-type review schemas.
 * Review UI must render ONLY these fields for the classified type.
 */

export type ReviewFamily =
  | 'service'
  | 'vehicle_purchase'
  | 'electronics'
  | 'appliance'
  | 'insurance'
  | 'puc'
  | 'rc'
  | 'warranty'
  | 'generic';

export interface ReviewFieldDef {
  key: string;
  label: string;
  kind: 'string' | 'number' | 'date' | 'imei';
}

export interface ReviewSectionDef {
  id: string;
  title: string;
  fields: ReviewFieldDef[];
}

const S = (key: string, label: string, kind: ReviewFieldDef['kind'] = 'string'): ReviewFieldDef => ({
  key,
  label,
  kind,
});

export const REVIEW_SCHEMAS: Record<ReviewFamily, ReviewSectionDef[]> = {
  service: [
    { id: 'document', title: 'Document', fields: [S('shopName', 'Workshop / Service Center'), S('shopGstin', 'GSTIN'), S('invoiceNumber', 'Invoice Number'), S('invoiceDate', 'Service Date', 'date')] },
    { id: 'vehicle', title: 'Vehicle', fields: [S('productName', 'Vehicle Model'), S('registration', 'Registration Number'), S('chassisNumber', 'Chassis / VIN'), S('engineNumber', 'Engine Number')] },
    { id: 'service', title: 'Service', fields: [S('odometerKm', 'Current Odometer (KM)', 'number'), S('nextServiceOdometerKm', 'Next Service KM', 'number'), S('nextServiceDue', 'Next Service Date', 'date'), S('jobCardNumber', 'Job Card Number')] },
    { id: 'financial', title: 'Financial', fields: [S('labourCharges', 'Labour Amount', 'number'), S('partsTotal', 'Parts Amount', 'number'), S('taxAmount', 'Tax Amount', 'number'), S('totalAmount', 'Total Amount', 'number'), S('paymentMode', 'Payment Mode')] },
    { id: 'identity', title: 'Customer', fields: [S('customerName', 'Customer Name'), S('customerPhone', 'Customer Phone')] },
  ],
  vehicle_purchase: [
    { id: 'document', title: 'Document', fields: [S('shopName', 'Seller / Dealer'), S('invoiceNumber', 'Invoice Number'), S('invoiceDate', 'Invoice Date', 'date')] },
    { id: 'vehicle', title: 'Vehicle', fields: [S('productName', 'Vehicle Model'), S('registration', 'Registration Number'), S('chassisNumber', 'Chassis / VIN'), S('engineNumber', 'Engine Number')] },
    { id: 'financial', title: 'Financial', fields: [S('taxAmount', 'Tax Amount', 'number'), S('totalAmount', 'Purchase Price', 'number')] },
    { id: 'identity', title: 'Parties', fields: [S('customerName', 'Buyer'), S('shopGstin', 'Seller GSTIN')] },
    { id: 'warranty', title: 'Warranty', fields: [S('warrantyPeriodMonths', 'Warranty (Months)', 'number'), S('warrantyExpiry', 'Warranty Expiry', 'date')] },
  ],
  electronics: [
    { id: 'document', title: 'Document', fields: [S('shopName', 'Seller'), S('invoiceNumber', 'Invoice Number'), S('invoiceDate', 'Invoice Date', 'date'), S('shopGstin', 'GSTIN')] },
    { id: 'product', title: 'Product', fields: [S('productName', 'Product / Model'), S('brand', 'Brand')] },
    { id: 'identity_hw', title: 'Serial / IMEI', fields: [S('serialNumber', 'Serial Number'), S('imei', 'IMEI', 'imei')] },
    { id: 'parties', title: 'Seller / Buyer', fields: [S('customerName', 'Buyer')] },
    { id: 'financial', title: 'Financial', fields: [S('taxAmount', 'Tax Amount', 'number'), S('totalAmount', 'Total Amount', 'number')] },
    { id: 'warranty', title: 'Warranty', fields: [S('warrantyPeriodMonths', 'Warranty (Months)', 'number'), S('warrantyExpiry', 'Warranty Expiry', 'date')] },
  ],
  appliance: [
    { id: 'document', title: 'Document', fields: [S('shopName', 'Seller'), S('invoiceNumber', 'Invoice Number'), S('invoiceDate', 'Invoice Date', 'date')] },
    { id: 'product', title: 'Product', fields: [S('productName', 'Product Name'), S('brand', 'Brand'), S('serialNumber', 'Serial Number')] },
    { id: 'parties', title: 'Seller / Buyer', fields: [S('customerName', 'Buyer'), S('shopGstin', 'GSTIN')] },
    { id: 'financial', title: 'Financial', fields: [S('taxAmount', 'Tax Amount', 'number'), S('totalAmount', 'Total Amount', 'number')] },
    { id: 'warranty', title: 'Warranty', fields: [S('warrantyPeriodMonths', 'Warranty (Months)', 'number'), S('warrantyExpiry', 'Warranty Expiry', 'date')] },
  ],
  insurance: [
    { id: 'document', title: 'Policy', fields: [S('shopName', 'Insurer'), S('invoiceNumber', 'Policy Number'), S('policyStartDate', 'Policy Start Date', 'date'), S('insuranceExpiry', 'Policy Expiry Date', 'date')] },
    { id: 'vehicle', title: 'Insured Vehicle', fields: [S('productName', 'Vehicle Model'), S('registration', 'Registration Number'), S('chassisNumber', 'Chassis / VIN'), S('engineNumber', 'Engine Number')] },
    { id: 'financial', title: 'Premium', fields: [S('idv', 'IDV', 'number'), S('totalAmount', 'Premium', 'number')] },
    { id: 'identity', title: 'Insured', fields: [S('customerName', 'Insured Name')] },
  ],
  puc: [
    { id: 'document', title: 'PUC Certificate', fields: [S('invoiceNumber', 'Certificate Number'), S('invoiceDate', 'Issue Date', 'date'), S('pucExpiry', 'Expiry Date', 'date')] },
    { id: 'vehicle', title: 'Vehicle', fields: [S('registration', 'Registration Number'), S('productName', 'Vehicle Details')] },
  ],
  rc: [
    { id: 'document', title: 'RC Certificate', fields: [S('invoiceNumber', 'Certificate Number'), S('invoiceDate', 'Registration Date', 'date')] },
    { id: 'vehicle', title: 'Vehicle', fields: [S('productName', 'Maker / Model'), S('registration', 'Registration Number'), S('chassisNumber', 'Chassis / VIN'), S('engineNumber', 'Engine Number'), S('customerName', 'Owner Name')] },
  ],
  warranty: [
    { id: 'document', title: 'Warranty', fields: [S('shopName', 'Issuer / Brand'), S('invoiceNumber', 'Warranty Number'), S('productName', 'Product'), S('serialNumber', 'Serial Number')] },
    { id: 'dates', title: 'Coverage', fields: [S('invoiceDate', 'Start Date', 'date'), S('warrantyExpiry', 'End Date', 'date'), S('warrantyPeriodMonths', 'Warranty (Months)', 'number')] },
    { id: 'financial', title: 'Financial', fields: [S('taxAmount', 'Tax Amount', 'number'), S('totalAmount', 'Total Amount', 'number')] },
    { id: 'identity', title: 'Customer', fields: [S('customerName', 'Customer Name')] },
  ],
  generic: [
    { id: 'document', title: 'Document', fields: [S('shopName', 'Seller / Vendor'), S('invoiceNumber', 'Invoice Number'), S('invoiceDate', 'Date', 'date'), S('shopGstin', 'GSTIN')] },
    { id: 'product', title: 'Product', fields: [S('productName', 'Product / Description'), S('serialNumber', 'Serial Number'), S('imei', 'IMEI', 'imei')] },
    { id: 'parties', title: 'Buyer', fields: [S('customerName', 'Buyer')] },
    { id: 'financial', title: 'Financial', fields: [S('taxAmount', 'Tax Amount', 'number'), S('totalAmount', 'Total Amount', 'number')] },
  ],
};

export function familyFromDocumentType(documentType: string, hints: { imei?: string; productName?: string } = {}): ReviewFamily {
  const t = String(documentType || '').toUpperCase();
  if (t.includes('ELECTRONICS')) return 'electronics';
  if (t.includes('APPLIANCE')) return 'appliance';
  if (t.includes('INSURANCE')) return 'insurance';
  if (t.includes('PUC')) return 'puc';
  if (t.includes('RC_') || t === 'RC_CERTIFICATE' || t.includes('REGISTRATION_CERT')) return 'rc';
  if (t.includes('SERVICE') || t.includes('REPAIR')) return 'service';
  if (t.includes('WARRANTY') || t.includes('AMC')) return 'warranty';

  // Vehicle purchase ONLY when the documentType explicitly signals a vehicle sale.
  // A plain PURCHASE_INVOICE / TAX_INVOICE / SALES_INVOICE is NOT necessarily a
  // vehicle, so it must NOT map to vehicle_purchase without independent evidence.
  if (
    t.includes('VEHICLE_PURCHASE') ||
    t.includes('VEHICLE_INVOICE') ||
    t.includes('VEHICLE_SALE') ||
    t.includes('VEHICLE_BILL')
  ) {
    return 'vehicle_purchase';
  }

  // Product / identifier evidence strongly overrides an ambiguous purchase doc.
  const imei = String(hints.imei || '').replace(/\D/g, '');
  if (imei.length === 15) return 'electronics';

  const product = String(hints.productName || '');
  if (isGadgetProductName(product)) return 'electronics';
  if (isApplianceProductName(product)) return 'appliance';

  if (t.includes('GENERIC_INVOICE')) return 'generic';
  if (t === 'PURCHASE_INVOICE' || t === 'TAX_INVOICE' || t === 'SALES_INVOICE') {
    return 'generic';
  }
  return 'generic';
}

const GADGET_PRODUCT_RE =
  /nothing\s*phone|iphone|oneplus|pixel|macbook|smartphone|mobile\s*phone|laptop|notebook|ipad|tablet|galaxy|realme|redmi|earbud|airpods|smartwatch|camera|smart\s*tv|television/i;
const APPLIANCE_PRODUCT_RE =
  /air\s*conditioner|\bac\b|refrigerator|fridge|washing\s*machine|microwave|\boven\b|geyser|dishwasher|water\s*heater|induction/i;

function isGadgetProductName(name: string): boolean {
  // "TVS" / "TV Actor" as a bare token is vehicle/noise; require a clear electronics model.
  return (
    GADGET_PRODUCT_RE.test(String(name || '')) &&
    !/\btvs\s*(?:motor|actor)\b/i.test(String(name || ''))
  );
}

function isApplianceProductName(name: string): boolean {
  return APPLIANCE_PRODUCT_RE.test(String(name || ''));
}

export function allowedFieldKeys(family: ReviewFamily): Set<string> {
  const keys = new Set<string>();
  for (const section of REVIEW_SCHEMAS[family] || []) {
    for (const f of section.fields) keys.add(f.key);
  }
  return keys;
}

export const VEHICLE_SERVICE_KEYS = [
  'odometerKm',
  'odometerReading',
  'nextServiceOdometerKm',
  'nextServiceDue',
  'pucExpiry',
  'chassisNumber',
  'engineNumber',
  'registration',
  'labourCharges',
  'partsTotal',
  'jobCardNumber',
] as const;

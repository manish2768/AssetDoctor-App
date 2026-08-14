/**
 * Smart multi-category auto-classifier for OCR line items & invoices.
 * Buckets: Gadgets · Home Appliances · Vehicles & Parts · Accessories
 */

export const SMART_CATEGORIES = Object.freeze({
  GADGETS: 'gadgets',
  HOME_APPLIANCES: 'home_appliances',
  VEHICLES: 'vehicles',
  ACCESSORIES: 'accessories',
  OTHER: 'other',
});

/** UI options for Review screen picker */
export const SMART_CATEGORY_OPTIONS = Object.freeze([
  { id: SMART_CATEGORIES.GADGETS, label: 'Gadgets', icon: 'mobile' },
  { id: SMART_CATEGORIES.HOME_APPLIANCES, label: 'Home Appliances', icon: 'ac' },
  { id: SMART_CATEGORIES.VEHICLES, label: 'Vehicles & Parts', icon: 'vehicle' },
  { id: SMART_CATEGORIES.ACCESSORIES, label: 'Accessories', icon: 'accessory' },
  { id: SMART_CATEGORIES.OTHER, label: 'Other', icon: 'other' },
]);

const RULES = [
  {
    id: SMART_CATEGORIES.ACCESSORIES,
    // Accessories first so "phone case" / "charger" win over Gadgets
    re: /\b(?:charger|cable|cover|case|adapter|earphone|earbuds?|power\s*bank|screen\s*guard|tempered\s*glass|usb|type[\s\-]?c)\b/i,
  },
  {
    id: SMART_CATEGORIES.VEHICLES,
    // Vehicles before gadgets so "TVS RONIN" / dealer invoices never fall to Other
    re: /\b(?:bike|motorcycle|scooter|activa|helmet|tyre|tire|engine\s*oil|chassis|frame\s*no|engine\s*no|vin|service|puc|rc\b|two[\s\-]?wheeler|four[\s\-]?wheeler|\bcar\b|suv|sedan|pulsar|ronin|splendor|apache|jupiter|ntorq|unicorn|shine|passion|avenger|\btvs\b|hero\s*moto|bajaj|yamaha|honda|suzuki|royal\s*enfield|ktm|ather|ola\s*s1|ex[\s\-]?showroom|hsrp|motor\s*vehicle|vehicle\s*invoice|dealer\s*invoice|insurance\s*polic|motor\s*insurance|certificate\s*of\s*insurance|raftaar|moto\s*legends)\b/i,
  },
  {
    id: SMART_CATEGORIES.GADGETS,
    re: /\b(?:phone|mobile|handset|smartphone|tablet|ipad|laptop|notebook|imei|iphone|nothing\s*phone|galaxy|oneplus|realme|xiaomi|redmi|pixel)\b/i,
  },
  {
    id: SMART_CATEGORIES.HOME_APPLIANCES,
    re: /\b(?:\bac\b|air[\s\-]?conditioner|inverter\s*ac|fridge|refrigerator|television|\btv\b|smart\s*tv|washing\s*machine|washer|microwave|oven|geyser|water\s*heater|dishwasher|cooler|chimney|induction)\b/i,
  },
];

/**
 * Classify free text into a smart category bucket.
 * @param {string} text
 * @param {{ documentKind?: string, isVehicleInvoice?: boolean, chassisNumber?: string, engineNumber?: string, registration?: string }} [hints]
 * @returns {string} SMART_CATEGORIES value
 */
export function classifySmartCategory(text = '', hints = {}) {
  if (
    hints.isVehicleInvoice ||
    hints.chassisNumber ||
    hints.engineNumber ||
    hints.registration ||
    ['insurance', 'puc', 'rc', 'vehicle_invoice', 'warranty'].includes(
      String(hints.documentKind || '').toLowerCase(),
    )
  ) {
    return SMART_CATEGORIES.VEHICLES;
  }
  const hay = String(text || '');
  if (!hay.trim()) return SMART_CATEGORIES.OTHER;
  for (const rule of RULES) {
    if (rule.re.test(hay)) return rule.id;
  }
  return SMART_CATEGORIES.OTHER;
}

/**
 * Map smart bucket + product name → vault categoryId used by AssetService.
 */
export function smartCategoryToCategoryId(smartCategory, productName = '') {
  const text = String(productName || '').toLowerCase();
  switch (smartCategory) {
    case SMART_CATEGORIES.GADGETS:
      if (/laptop|notebook|macbook/.test(text)) return 'laptop';
      if (/tablet|ipad/.test(text)) return 'tablet';
      return 'mobile';
    case SMART_CATEGORIES.HOME_APPLIANCES:
      if (/\bac\b|air[\s\-]?cond/.test(text)) return 'ac';
      if (/fridge|refrigerator/.test(text)) return 'fridge';
      if (/\btv\b|television|led/.test(text)) return 'tv';
      if (/wash|washer/.test(text)) return 'washing_machine';
      if (/microwave|oven/.test(text)) return 'microwave';
      if (/geyser|water\s*heater/.test(text)) return 'geyser';
      return 'appliance';
    case SMART_CATEGORIES.VEHICLES:
      if (/car|suv|sedan|nexon|creta|swift/.test(text)) return 'car';
      if (/scooter|activa|jupiter|ntorq|access/.test(text)) return 'scooter';
      if (/helmet|tyre|tire|engine\s*oil|spare|part/.test(text)) return 'vehicle_parts';
      return 'bike';
    case SMART_CATEGORIES.ACCESSORIES:
      return 'accessory';
    default:
      return 'other';
  }
}

/**
 * Category-specific metadata flags attached to each OCR item.
 */
export function buildCategoryMetadata(smartCategory, productName = '') {
  const categoryId = smartCategoryToCategoryId(smartCategory, productName);
  const isGadgets = smartCategory === SMART_CATEGORIES.GADGETS;
  const isVehicles = smartCategory === SMART_CATEGORIES.VEHICLES;
  const isHome = smartCategory === SMART_CATEGORIES.HOME_APPLIANCES;
  const isAccessory = smartCategory === SMART_CATEGORIES.ACCESSORIES;

  return {
    smartCategory,
    categoryId,
    categoryLabel:
      SMART_CATEGORY_OPTIONS.find((o) => o.id === smartCategory)?.label || 'Other',
    /** Gadgets: IMEI / Serial tracking */
    trackImei: isGadgets || isAccessory,
    trackSerial: isGadgets || isAccessory || isHome,
    /** Vehicles: PUC & Service Due */
    trackPucService: isVehicles,
    /** Home Appliances: seasonal service alerts */
    seasonalServiceAlerts: isHome,
    isElectricAppliance: isHome || categoryId === 'laptop' || categoryId === 'mobile',
  };
}

/**
 * Enrich a bill line item with smart category + metadata.
 */
export function enrichItemWithCategory(item = {}, invoiceHintText = '', hints = {}) {
  const name = item.name || '';
  const blob = `${name} ${item.raw || ''} ${invoiceHintText || ''} ${item.imei ? 'IMEI' : ''}`;
  const smartCategory =
    item.smartCategory && Object.values(SMART_CATEGORIES).includes(item.smartCategory)
      ? item.smartCategory
      : classifySmartCategory(blob, hints);
  const meta = buildCategoryMetadata(smartCategory, name);
  return {
    ...item,
    ...meta,
  };
}

/**
 * Classify entire invoice text → smart category (invoice-level fallback).
 */
export function classifyInvoiceSmartCategory({
  productName = '',
  items = [],
  blob = '',
  documentKind = '',
  isVehicleInvoice = false,
  chassisNumber = '',
  engineNumber = '',
  registration = '',
} = {}) {
  const itemNames = (items || []).map((i) => i.name).join(' ');
  return classifySmartCategory(`${productName} ${itemNames} ${blob}`, {
    documentKind,
    isVehicleInvoice,
    chassisNumber,
    engineNumber,
    registration,
  });
}

export default {
  SMART_CATEGORIES,
  SMART_CATEGORY_OPTIONS,
  classifySmartCategory,
  smartCategoryToCategoryId,
  buildCategoryMetadata,
  enrichItemWithCategory,
  classifyInvoiceSmartCategory,
};

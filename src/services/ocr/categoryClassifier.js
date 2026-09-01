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

// Accessories first so "phone case" / "charger" win over Gadgets.
const ACCESSORY_RULE = {
  id: SMART_CATEGORIES.ACCESSORIES,
  re: /\b(?:charger|cable|cover|case|adapter|earphone|earbuds?|power\s*bank|screen\s*guard|tempered\s*glass|usb|type[\s\-]?c)\b/i,
};

// Product-grained evidence. High-value, specific tokens only — a gadget purchase
// invoice must land here before any broad vehicle keyword is even considered.
const GADGET_RULE = {
  id: SMART_CATEGORIES.GADGETS,
  re: /\b(?:phone|mobile|handset|smartphone|tablet|ipad|laptop|notebook|macbook|imei|iphone|nothing\s*phone|galaxy|oneplus|realme|xiaomi|redmi|pixel|vivo|oppo|motorola|airpods|earbud|smartwatch|camera)\b/i,
};

const HOME_RULE = {
  id: SMART_CATEGORIES.HOME_APPLIANCES,
  re: /\b(?:\bac\b|air[\s\-]?conditioner|inverter\s*ac|fridge|refrigerator|television|\btv\b|smart\s*tv|washing\s*machine|washer|microwave|oven|geyser|water\s*heater|dishwasher|cooler|chimney|induction)\b/i,
};

// Vehicle rule: only *combination* evidence (vehicle token + id/model hint) is
// trusted. Removed noisy single keywords (bare "service", "car", bare brand
// names) that previously hijacked gadget / appliance & even generic invoices.
const VEHICLE_RULE = {
  id: SMART_CATEGORIES.VEHICLES,
  re: /\b(?:bike|motorcycle|scooter|activa|chassis|frame\s*(?:no|number)|engine\s*(?:no|number)|\bvin\b|ex[\s\-]?showroom|\bhsrp\b|two[\s\-]?wheeler|four[\s\-]?wheeler|motor\s*vehicle|vehicle\s*invoice|dealer\s*invoice|vehicle\s*registration|registration\s*(?:no|number)|odo(?:meter)?\s*(?:reading|km)\b|pulsar|ronin|splendor|apache|jupiter|ntorq|unicorn|shine|passion|avenger|royal\s*enfield|ktm)\b/i,
};

// Recognised Indian automobile brands/models used as vehicle evidence.
// IMPORTANT: used ONLY in combination with an id hint / vehicle doc flag —
// a bare brand token must never force Vehicle by itself.
const VEHICLE_BRAND_RE =
  /\b(?:maruti|suzuki|hyundai|tata\s*motors|mahindra|toyota|honda|cars|royal\s*enfield|bajaj|yamaha|hero\s*moto\s?corp|tvs\s*motor|ktm|ather|ola\s*s1|revolt|benelli|duke|ktm|access\s*125|baleno|swift|dzire|i20|creta|nios|nexon)\b/i;

const RULES = [ACCESSORY_RULE, GADGET_RULE, HOME_RULE, VEHICLE_RULE];

/**
 * Classify free text into a smart category bucket.
 *
 * NOTE: Category must NEVER default to Vehicle. Hints (chassis / engine /
 * registration / isVehicleInvoice / documentKind) are only *evidence boosts*,
 * not an unconditional override. A gadget invoice whose text merely shares a
 * generic keyword must not be classified Vehicle.
 *
 * @param {string} text
 * @param {{ documentKind?: string, isVehicleInvoice?: boolean, chassisNumber?: string, engineNumber?: string, registration?: string, productName?: string }} [hints]
 * @returns {string} SMART_CATEGORIES value
 */
export function classifySmartCategory(text = '', hints = {}) {
  const hay = String(text || '').trim();
  const product = String(hints.productName || '').trim();
  const blob = `${product} ${hay}`.trim();
  if (!blob) return SMART_CATEGORIES.OTHER;

  // Accessory first so "phone case" / "charger" win over generic Gadgets.
  if (ACCESSORY_RULE.re.test(blob)) return SMART_CATEGORIES.ACCESSORIES;

  // Strong, product-specific positive evidence wins next.
  if (GADGET_RULE.re.test(blob)) return SMART_CATEGORIES.GADGETS;
  if (HOME_RULE.re.test(blob)) return SMART_CATEGORIES.HOME_APPLIANCES;

  // Combined vehicle evidence: require BOTH a vehicle token in the text AND
  // at least one corroborating hint (model/id) OR a clearly vehicle label.
  const vehicleHintCount =
    (String(hints.chassisNumber || '').replace(/\s/g, '').length >= 8 ? 1 : 0) +
    (String(hints.engineNumber || '').replace(/\s/g, '').length >= 8 ? 1 : 0) +
    (/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/i.test(
      String(hints.registration || '').replace(/[\s-]/g, ''),
    )
      ? 1
      : 0);
  const docIsVehicleOnly =
    ['insurance', 'puc', 'rc', 'vehicle_invoice'].includes(
      String(hints.documentKind || '').toLowerCase(),
    ) && /\b(?:motor\s*vehicle|chassis|engine\s*(?:no|number|n[o°])|vehicle\s*invoice|registration\s*(?:no|number))\b/i.test(blob);

  // Vehicle classification is allowed ONLY when we have combined evidence:
  // a vehicle token AND a corroborating id (chassis/engine/registration) OR an
  // explicit vehicle document/label. A bare model/brand alone never forces it.
  const hasVehicleToken =
    VEHICLE_RULE.re.test(blob) || VEHICLE_BRAND_RE.test(blob);
  if (hasVehicleToken && (vehicleHintCount >= 1 || docIsVehicleOnly || hints.isVehicleInvoice)) {
    return SMART_CATEGORIES.VEHICLES;
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

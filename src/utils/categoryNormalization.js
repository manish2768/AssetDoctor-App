/**
 * Single category isolation layer.
 * Maps historical aliases / categoryIds onto stable keys used by Home and AssetList.
 * Read/filter only — never mutates stored Firestore documents.
 */

export const STABLE_CATEGORIES = Object.freeze([
  'vehicle',
  'gadget',
  'home',
  'equipment',
  'business',
  'other',
]);

export const CATEGORY_META = Object.freeze({
  all: Object.freeze({
    key: 'all',
    title: 'Assets',
    searchPlaceholder: 'Search assets, registration, serial number...',
    emptyTitle: 'No assets yet',
    emptyBody:
      'Add your first asset to protect its bills, warranty, service records and important documents.',
    addLabel: '+ Add Asset',
  }),
  vehicle: Object.freeze({
    key: 'vehicle',
    title: 'Vehicles',
    searchPlaceholder: 'Search within Vehicles...',
    emptyTitle: 'No vehicles yet',
    emptyBody:
      'Add your first vehicle to protect its bills, warranty, service records and important documents.',
    addLabel: '+ Add Vehicle',
  }),
  gadget: Object.freeze({
    key: 'gadget',
    title: 'Gadgets & Electronics',
    searchPlaceholder: 'Search within Gadgets & Electronics...',
    emptyTitle: 'No gadgets yet',
    emptyBody:
      'Add your first gadget to protect its bills, warranty, service records and important documents.',
    addLabel: '+ Add Gadget',
  }),
  home: Object.freeze({
    key: 'home',
    title: 'Home & Appliances',
    searchPlaceholder: 'Search within Home & Appliances...',
    emptyTitle: 'No home appliances yet',
    emptyBody:
      'Add your first appliance to protect its bills, warranty, service records and important documents.',
    addLabel: '+ Add Appliance',
  }),
  equipment: Object.freeze({
    key: 'equipment',
    title: 'Equipment & Tools',
    searchPlaceholder: 'Search within Equipment & Tools...',
    emptyTitle: 'No equipment yet',
    emptyBody:
      'Add your first tool to protect its bills, warranty, service records and important documents.',
    addLabel: '+ Add Equipment',
  }),
  business: Object.freeze({
    key: 'business',
    title: 'Business Assets',
    searchPlaceholder: 'Search within Business Assets...',
    emptyTitle: 'No business assets yet',
    emptyBody:
      'Add your first business asset to protect its bills, warranty, service records and important documents.',
    addLabel: '+ Add Business Asset',
  }),
  other: Object.freeze({
    key: 'other',
    title: 'Other Assets',
    searchPlaceholder: 'Search within Other Assets...',
    emptyTitle: 'No other assets yet',
    emptyBody:
      'Add your first asset to protect its bills, warranty, service records and important documents.',
    addLabel: '+ Add Asset',
  }),
});

/** Exact aliases only — never substring match ("car" must not match "card"). */
const EXACT_ALIASES = {
  vehicle: [
    'vehicle',
    'vehicles',
    'bike',
    'bikes',
    'car',
    'cars',
    'scooter',
    'scooters',
    'motorbike',
    'motorcycle',
    'motorcycles',
    'ev',
    'electric vehicle',
    'electricvehicle',
    'vehicle parts',
    'vehicle_parts',
    'two wheeler',
    'four wheeler',
    'commercial',
  ],
  gadget: [
    'gadget',
    'gadgets',
    'gadgets electronics',
    'gadgets and electronics',
    'electronic',
    'electronics',
    'phone',
    'mobile',
    'smartphone',
    'tablet',
    'laptop',
    'camera',
    'console',
    'accessory',
    'earbuds',
    'headphones',
  ],
  home: [
    'home',
    'appliance',
    'appliances',
    'home appliance',
    'home appliances',
    'home and appliances',
    'washing machine',
    'washing_machine',
    'washer',
    'fridge',
    'refrigerator',
    'tv',
    'television',
    'microwave',
    'geyser',
    'ac',
    'air conditioner',
    'airconditioner',
  ],
  equipment: [
    'equipment',
    'tool',
    'tools',
    'machinery',
    'generator',
    'inverter',
    'solar',
    'solar panel',
    'power tool',
    'powertool',
  ],
  business: [
    'business',
    'business asset',
    'business assets',
    'business_asset',
    'business_assets',
    'office',
    'pos',
    'commercial tech',
  ],
  other: [
    'other',
    'others',
    'personal',
    'legal',
    'policy',
    'guarantee',
    'property',
    'insurance policy',
    'legal document',
    'utility bill',
    'electricity bill',
    'broadband',
    'digital subscription',
  ],
};

const ALIAS_LOOKUP = (() => {
  const map = Object.create(null);
  for (const [key, list] of Object.entries(EXACT_ALIASES)) {
    for (const alias of list) {
      map[canonicalize(alias)] = key;
    }
    map[key] = key;
  }
  return map;
})();

/** Ambiguous historical group labels — never guess gadget vs home. */
const AMBIGUOUS_GROUPS = new Set([
  'electronics',
  'electronics and appliances',
  'electronics appliances',
]);

/**
 * Legacy 4-bucket folder ids. electronics/property collide across two Home cards
 * so they are invalid filters (empty list), never "all".
 */
const LEGACY_FOLDER_MAP = Object.freeze({
  vehicle: 'vehicle',
  vehicles: 'vehicle',
  appliance: 'home',
  appliances: 'home',
  gadget: 'gadget',
  gadgets: 'gadget',
  equipment: 'equipment',
  business: 'business',
  other: 'other',
  others: 'other',
  personal: 'other',
});

export function canonicalize(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[_/,-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * @param {unknown} input
 * @returns {string|null} stable key or null
 */
export function normalizeCategory(input) {
  if (input == null || input === '') return null;
  const key = canonicalize(input);
  if (!key) return null;
  if (key === 'all') return 'all';
  return ALIAS_LOOKUP[key] || null;
}

function isAmbiguousGroup(input) {
  return AMBIGUOUS_GROUPS.has(canonicalize(input));
}

/**
 * Resolve the stable category for an asset at read time.
 * categoryId wins; never uses 4-bucket folder types (those merge gadget+home).
 * @param {object|null|undefined} asset
 * @returns {string|null}
 */
export function resolveAssetCategory(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const fromId = normalizeCategory(asset.categoryId);
  if (fromId && fromId !== 'all') return fromId;

  const fromLabel = normalizeCategory(asset.categoryLabel);
  if (fromLabel && fromLabel !== 'all') return fromLabel;

  if (isAmbiguousGroup(asset.category)) return null;
  const fromCat = normalizeCategory(asset.category);
  if (fromCat && fromCat !== 'all') return fromCat;

  return null;
}

/**
 * @param {object} asset
 * @param {string} categoryKey
 */
export function assetMatchesCategory(asset, categoryKey) {
  if (!asset || !categoryKey) return false;
  if (categoryKey === 'all') return true;
  if (!STABLE_CATEGORIES.includes(categoryKey)) return false;
  const resolved = resolveAssetCategory(asset);
  if (categoryKey === 'other') {
    return resolved === 'other' || resolved == null;
  }
  return resolved === categoryKey;
}

export function filterAssetsByCategory(assets = [], categoryKey) {
  if (categoryKey === 'all') return Array.isArray(assets) ? assets.slice() : [];
  if (!STABLE_CATEGORIES.includes(categoryKey)) return [];
  return (assets || []).filter((a) => assetMatchesCategory(a, categoryKey));
}

export function searchAssetsInCategory(assets = [], categoryKey, query = '') {
  const scoped = filterAssetsByCategory(assets, categoryKey);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return scoped;
  return scoped.filter((a) => {
    const blob = `${a.assetName || ''} ${a.nickname || ''} ${a.categoryLabel || a.category || ''} ${
      a.registration || ''
    } ${a.serialNumber || ''} ${a.imei || ''} ${a.model || ''}`.toLowerCase();
    return blob.includes(q);
  });
}

/**
 * Read AssetList route params. Nested tab params and legacy `folder` are accepted.
 * Unknown / colliding folders are invalid — never coerced to "all".
 * @param {object} [params]
 * @returns {{ key: string|null, valid: boolean, raw: string }}
 */
export function resolveRouteCategory(params = {}) {
  const nested = params && typeof params.params === 'object' ? params.params : {};
  const raw = params.category ?? nested.category ?? params.folder ?? nested.folder ?? 'all';
  const token = canonicalize(raw);
  if (!token || token === 'all') {
    return { key: 'all', valid: true, raw: String(raw ?? 'all') };
  }
  // Old 4-bucket folders collided (gadget+home, equipment+business). Never treat as all.
  if (token === 'electronics' || token === 'property') {
    return { key: null, valid: false, raw: String(raw) };
  }
  if (Object.prototype.hasOwnProperty.call(LEGACY_FOLDER_MAP, token)) {
    return { key: LEGACY_FOLDER_MAP[token], valid: true, raw: String(raw) };
  }
  const normalized = normalizeCategory(raw);
  if (normalized && STABLE_CATEGORIES.includes(normalized)) {
    return { key: normalized, valid: true, raw: String(raw) };
  }
  return { key: null, valid: false, raw: String(raw) };
}

export function getCategoryMeta(categoryKey) {
  if (categoryKey && CATEGORY_META[categoryKey]) return CATEGORY_META[categoryKey];
  return CATEGORY_META.all;
}

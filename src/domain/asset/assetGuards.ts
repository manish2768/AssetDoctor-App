/**
 * Asset Doctor — Canonical Domain Guards & Category Normalization
 * Authoritative source of truth for asset categorization and capability resolution.
 *
 * CRITICAL ARCHITECTURAL RULES:
 * 1. ONLY AssetCategory === 'VEHICLE' may have:
 *    - odometer
 *    - mileage
 *    - fuel logs
 *    - fuel cost/km
 *    - distance calculations
 *    - mileage service thresholds
 *    - km-based service prediction
 * 2. HOME_APPLIANCES, ELECTRONICS, BUSINESS, and PERSONAL_DOCUMENT:
 *    - must NEVER participate in odometer calculations
 *    - must NEVER participate in fuel calculations
 *    - must NEVER produce mileage alerts
 * 3. Never infer vehicle status from asset.name alone or from registration existence.
 *    Category is authoritative.
 */

import type { AssetCategory, CanonicalAsset } from './types';

export const CANONICAL_CATEGORIES = Object.freeze<AssetCategory[]>([
  'VEHICLE',
  'ELECTRONICS',
  'HOME_APPLIANCES',
  'BUSINESS',
  'PERSONAL_DOCUMENT',
]);

const CANONICAL_LOOKUP: Record<string, AssetCategory> = {
  // Vehicle aliases
  vehicle: 'VEHICLE',
  vehicles: 'VEHICLE',
  automotive: 'VEHICLE',
  car: 'VEHICLE',
  cars: 'VEHICLE',
  bike: 'VEHICLE',
  bikes: 'VEHICLE',
  scooter: 'VEHICLE',
  scooters: 'VEHICLE',
  motorcycle: 'VEHICLE',
  motorcycles: 'VEHICLE',
  ev: 'VEHICLE',
  'electric vehicle': 'VEHICLE',
  'two wheeler': 'VEHICLE',
  'four wheeler': 'VEHICLE',
  commercial: 'VEHICLE',
  'vehicle parts': 'VEHICLE',
  vehicle_parts: 'VEHICLE',

  // Electronics aliases
  electronics: 'ELECTRONICS',
  electronic: 'ELECTRONICS',
  gadget: 'ELECTRONICS',
  gadgets: 'ELECTRONICS',
  'gadgets electronics': 'ELECTRONICS',
  'gadgets and electronics': 'ELECTRONICS',
  phone: 'ELECTRONICS',
  mobile: 'ELECTRONICS',
  smartphone: 'ELECTRONICS',
  tablet: 'ELECTRONICS',
  laptop: 'ELECTRONICS',
  camera: 'ELECTRONICS',
  console: 'ELECTRONICS',
  accessory: 'ELECTRONICS',
  earbuds: 'ELECTRONICS',
  headphones: 'ELECTRONICS',
  smartwatch: 'ELECTRONICS',

  // Home Appliance aliases
  home_appliances: 'HOME_APPLIANCES',
  home_appliance: 'HOME_APPLIANCES',
  home: 'HOME_APPLIANCES',
  appliance: 'HOME_APPLIANCES',
  appliances: 'HOME_APPLIANCES',
  'home appliance': 'HOME_APPLIANCES',
  'home appliances': 'HOME_APPLIANCES',
  'home and appliances': 'HOME_APPLIANCES',
  'washing machine': 'HOME_APPLIANCES',
  washing_machine: 'HOME_APPLIANCES',
  washer: 'HOME_APPLIANCES',
  fridge: 'HOME_APPLIANCES',
  refrigerator: 'HOME_APPLIANCES',
  tv: 'HOME_APPLIANCES',
  television: 'HOME_APPLIANCES',
  microwave: 'HOME_APPLIANCES',
  geyser: 'HOME_APPLIANCES',
  'water heater': 'HOME_APPLIANCES',
  ac: 'HOME_APPLIANCES',
  'air conditioner': 'HOME_APPLIANCES',
  airconditioner: 'HOME_APPLIANCES',
  ro: 'HOME_APPLIANCES',
  purifier: 'HOME_APPLIANCES',
  'water purifier': 'HOME_APPLIANCES',
  'air purifier': 'HOME_APPLIANCES',
  cooler: 'HOME_APPLIANCES',
  'air cooler': 'HOME_APPLIANCES',
  fan: 'HOME_APPLIANCES',
  dishwasher: 'HOME_APPLIANCES',
  vacuum: 'HOME_APPLIANCES',
  inverter: 'HOME_APPLIANCES',
  generator: 'HOME_APPLIANCES',
  equipment: 'HOME_APPLIANCES',
  tool: 'HOME_APPLIANCES',
  tools: 'HOME_APPLIANCES',
  machinery: 'HOME_APPLIANCES',
  solar: 'HOME_APPLIANCES',

  // Business aliases
  business: 'BUSINESS',
  business_asset: 'BUSINESS',
  'business asset': 'BUSINESS',
  'business assets': 'BUSINESS',
  office: 'BUSINESS',
  pos: 'BUSINESS',
  'commercial tech': 'BUSINESS',
  industrial: 'BUSINESS',
  utility_bill: 'BUSINESS',
  electricity_bill: 'BUSINESS',
  broadband: 'BUSINESS',
  digital_subscription: 'BUSINESS',

  // Personal / Document aliases
  personal_document: 'PERSONAL_DOCUMENT',
  personal: 'PERSONAL_DOCUMENT',
  legal: 'PERSONAL_DOCUMENT',
  'legal document': 'PERSONAL_DOCUMENT',
  policy: 'PERSONAL_DOCUMENT',
  'insurance policy': 'PERSONAL_DOCUMENT',
  guarantee: 'PERSONAL_DOCUMENT',
  property: 'PERSONAL_DOCUMENT',
  document: 'PERSONAL_DOCUMENT',
  documents: 'PERSONAL_DOCUMENT',
  other: 'PERSONAL_DOCUMENT',
  others: 'PERSONAL_DOCUMENT',
};

/** Canonical string cleaner */
function cleanCategoryKey(input: unknown): string {
  return String(input || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[_/,-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes any category string, alias, or legacy ID to the canonical AssetCategory.
 * Defaults to 'PERSONAL_DOCUMENT' for unmapped/general items.
 */
export function normalizeToCanonicalCategory(raw: unknown): AssetCategory {
  if (raw == null || raw === '') return 'PERSONAL_DOCUMENT';
  const clean = cleanCategoryKey(raw);
  if (!clean) return 'PERSONAL_DOCUMENT';

  // Direct uppercase match
  const upper = clean.toUpperCase().replace(/\s+/g, '_');
  if (upper === 'VEHICLE') return 'VEHICLE';
  if (upper === 'ELECTRONICS' || upper === 'GADGET' || upper === 'GADGETS') return 'ELECTRONICS';
  if (upper === 'HOME_APPLIANCES' || upper === 'HOME_APPLIANCE' || upper === 'APPLIANCE' || upper === 'APPLIANCES') return 'HOME_APPLIANCES';
  if (upper === 'BUSINESS' || upper === 'BUSINESS_ASSET') return 'BUSINESS';
  if (upper === 'PERSONAL_DOCUMENT' || upper === 'DOCUMENT' || upper === 'OTHER') return 'PERSONAL_DOCUMENT';

  return CANONICAL_LOOKUP[clean] || 'PERSONAL_DOCUMENT';
}

/**
 * Resolves the canonical category from an asset object.
 * Priority: asset.category -> asset.categoryId -> asset.categoryLabel
 * Authoritative: NEVER uses asset.name to infer category.
 */
export function resolveCanonicalAssetCategory(asset: unknown): AssetCategory {
  if (!asset || typeof asset !== 'object') return 'PERSONAL_DOCUMENT';
  const a = asset as Record<string, unknown>;

  // 1. Check category
  if (a.category != null && a.category !== '') {
    const fromCat = normalizeToCanonicalCategory(a.category);
    if (fromCat !== 'PERSONAL_DOCUMENT' || cleanCategoryKey(a.category) === 'other' || cleanCategoryKey(a.category) === 'personal') {
      return fromCat;
    }
  }

  // 2. Check categoryId
  if (a.categoryId != null && a.categoryId !== '') {
    const fromId = normalizeToCanonicalCategory(a.categoryId);
    if (fromId !== 'PERSONAL_DOCUMENT' || cleanCategoryKey(a.categoryId) === 'other') {
      return fromId;
    }
  }

  // 3. Check categoryLabel
  if (a.categoryLabel != null && a.categoryLabel !== '') {
    const fromLabel = normalizeToCanonicalCategory(a.categoryLabel);
    if (fromLabel !== 'PERSONAL_DOCUMENT') {
      return fromLabel;
    }
  }

  // 4. Fallback check for explicit category fields
  if (a.category) return normalizeToCanonicalCategory(a.category);
  if (a.categoryId) return normalizeToCanonicalCategory(a.categoryId);
  return 'PERSONAL_DOCUMENT';
}

// ---------------------------------------------------------------------------
// Category Predicates
// ---------------------------------------------------------------------------

export function isVehicleAsset(asset: unknown): boolean {
  return resolveCanonicalAssetCategory(asset) === 'VEHICLE';
}

export function isElectronicsAsset(asset: unknown): boolean {
  return resolveCanonicalAssetCategory(asset) === 'ELECTRONICS';
}

export function isHomeApplianceAsset(asset: unknown): boolean {
  return resolveCanonicalAssetCategory(asset) === 'HOME_APPLIANCES';
}

export function isBusinessAsset(asset: unknown): boolean {
  return resolveCanonicalAssetCategory(asset) === 'BUSINESS';
}

export function isPersonalDocumentAsset(asset: unknown): boolean {
  return resolveCanonicalAssetCategory(asset) === 'PERSONAL_DOCUMENT';
}

// ---------------------------------------------------------------------------
// Capability Guards (Strictly isolated by canonical category)
// ---------------------------------------------------------------------------

/**
 * ONLY Vehicle assets support odometer tracking.
 */
export function supportsOdometer(asset: unknown): boolean {
  return isVehicleAsset(asset);
}

/**
 * ONLY Vehicle assets support mileage / fuel efficiency tracking.
 */
export function supportsMileage(asset: unknown): boolean {
  return isVehicleAsset(asset);
}

/**
 * ONLY Vehicle assets with combustible/liquid fuel support liquid fuel tracking.
 * Electric vehicles (EV) support charging/energy rather than petrol/diesel logs.
 */
export function supportsFuelTracking(asset: unknown): boolean {
  if (!isVehicleAsset(asset)) return false;
  const a = asset as Record<string, unknown>;
  const fuelType = String(a.fuelType || '').toLowerCase();
  const powertrain = String(a.powertrain || '').toLowerCase();
  const categoryId = String(a.categoryId || '').toLowerCase();
  if (fuelType === 'ev' || fuelType === 'electric' || powertrain === 'electric' || categoryId === 'ev') {
    return false;
  }
  return true;
}

/**
 * ONLY Vehicle assets support vehicle-specific documents (RC, PUC, Vehicle Insurance).
 */
export function supportsVehicleDocuments(asset: unknown): boolean {
  return isVehicleAsset(asset);
}

/**
 * Determines if an asset supports calendar-based periodic service / inspection schedules.
 * True for vehicles and home appliances.
 */
export function supportsCalendarService(asset: unknown): boolean {
  const cat = resolveCanonicalAssetCategory(asset);
  return cat === 'VEHICLE' || cat === 'HOME_APPLIANCES';
}

export default {
  CANONICAL_CATEGORIES,
  normalizeToCanonicalCategory,
  resolveCanonicalAssetCategory,
  isVehicleAsset,
  isElectronicsAsset,
  isHomeApplianceAsset,
  isBusinessAsset,
  isPersonalDocumentAsset,
  supportsOdometer,
  supportsMileage,
  supportsFuelTracking,
  supportsVehicleDocuments,
  supportsCalendarService,
};

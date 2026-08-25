/**
 * Category-aware Asset Intelligence field schema.
 * UI must render ONLY fields whose `when(caps)` is true.
 * Never show vehicle metrics (odometer/PUC) for phones/ACs/etc.
 */

import { resolveAssetCapabilities } from '../services/assets/assetCapabilities';
import { ASSET_CATEGORY } from '../services/assets/assetTaxonomy';

/** @typedef {'identity'|'health'|'maintenance'|'documents'|'warranty'|'history'|'purchase'|'value'|'notifications'} IntelligenceSection */

/**
 * Field definitions. `when` receives capability flags (+ optional taxonomy).
 */
export const INTELLIGENCE_FIELDS = Object.freeze([
  // Identity (always)
  { id: 'assetName', section: 'identity', label: 'Asset name', when: () => true },
  { id: 'category', section: 'identity', label: 'Category', when: () => true },
  { id: 'identifier', section: 'identity', label: 'Identifier', when: () => true },
  { id: 'brand', section: 'identity', label: 'Brand', when: () => true },
  { id: 'model', section: 'identity', label: 'Model', when: () => true },

  // Vehicle-specific
  { id: 'odometer', section: 'maintenance', label: 'Odometer', when: (c) => c.supportsOdometer },
  { id: 'nextService', section: 'maintenance', label: 'Next service', when: (c) => c.supportsServiceHistory },
  { id: 'insurance', section: 'documents', label: 'Insurance', when: (c) => c.supportsInsurance },
  { id: 'puc', section: 'documents', label: 'PUC', when: (c) => c.supportsPUC },
  { id: 'tyres', section: 'maintenance', label: 'Tyres', when: (c) => c.supportsOdometer },
  { id: 'engineOil', section: 'maintenance', label: 'Engine oil', when: (c) => c.supportsFuelTracking },
  { id: 'fuel', section: 'maintenance', label: 'Fuel', when: (c) => c.supportsFuelTracking },
  { id: 'charging', section: 'maintenance', label: 'Charging', when: (c) => c.supportsCharging },

  // Electronics / battery
  { id: 'batteryHealth', section: 'health', label: 'Battery health', when: (c) => c.supportsBatteryHealth },
  { id: 'softwareLifecycle', section: 'insights', label: 'Software lifecycle', when: (c) => c.supportsBatteryHealth && !c.supportsOdometer },
  { id: 'screenHealth', section: 'health', label: 'Screen / panel', when: (c) => {
    const id = String(c.taxonomy?.gadgetType || c.categoryId || '').toLowerCase();
    return id.includes('phone') || id.includes('tablet') || id.includes('tv') || id === 'mobile' || id === 'tv';
  }},

  // Appliances
  { id: 'filterCleaning', section: 'maintenance', label: 'Filter cleaning', when: (c) => {
    const id = String(c.categoryId || '').toLowerCase();
    return id === 'ac' || id === 'air_purifier' || id === 'purifier';
  }},
  { id: 'energyHealth', section: 'health', label: 'Energy / performance', when: (c) => c.supportsEnergyTracking },

  // Universal
  { id: 'warranty', section: 'warranty', label: 'Warranty', when: (c) => c.supportsWarranty },
  { id: 'serviceHistory', section: 'history', label: 'Service / repair history', when: (c) => c.supportsServiceHistory },
  { id: 'purchaseInfo', section: 'purchase', label: 'Purchase information', when: () => true },
  { id: 'documents', section: 'documents', label: 'Documents', when: () => true },
  { id: 'healthScore', section: 'health', label: 'Health score', when: () => true },
  { id: 'resaleValue', section: 'value', label: 'Estimated value', when: () => true },
]);

export const SECTION_ORDER = Object.freeze([
  'identity',
  'health',
  'maintenance',
  'documents',
  'warranty',
  'history',
  'purchase',
  'value',
  'notifications',
  'insights',
]);

export const SECTION_LABELS = Object.freeze({
  identity: 'Identity',
  health: 'Health',
  maintenance: 'Maintenance',
  documents: 'Documents',
  warranty: 'Warranty',
  history: 'History',
  purchase: 'Purchase',
  value: 'Value',
  notifications: 'Alerts',
  insights: 'Insights',
});

/**
 * Document type suggestions by capability — never default to vehicle-only list.
 */
export function documentSuggestionsForAsset(asset = {}) {
  const caps = resolveAssetCapabilities(asset);
  const docs = ['Purchase Invoice', 'Warranty Card', 'Service / Repair Bill', 'Other'];
  if (caps.supportsInsurance) docs.unshift('Insurance Policy');
  if (caps.supportsPUC) docs.unshift('PUC Certificate');
  if (caps.supportsOdometer) docs.unshift('RC Book');
  if (caps.supportsEnergyTracking && !caps.supportsOdometer) docs.push('AMC Document');
  return [...new Set(docs)];
}

export function vaultCopyForAsset(asset = {}) {
  const suggestions = documentSuggestionsForAsset(asset);
  const short = suggestions.slice(0, 4).join(', ');
  return {
    subtitle: `${asset?.assetName || asset?.name || 'Asset'} — ${short}`,
    empty: `No documents yet — upload ${short}, or any relevant file.`,
    scanHint: `Scan a purchase bill, warranty card${capsInsuranceClause(asset)}, or service document.`,
  };
}

function capsInsuranceClause(asset) {
  const caps = resolveAssetCapabilities(asset);
  if (caps.supportsInsurance && caps.supportsPUC) return ', insurance, PUC';
  if (caps.supportsInsurance) return ', insurance';
  return '';
}

/**
 * @returns {{ caps: object, fieldsBySection: Record<string, object[]>, sections: string[] }}
 */
export function resolveIntelligenceLayout(asset = {}) {
  const caps = resolveAssetCapabilities(asset);
  const enriched = {
    ...caps,
    categoryId: String(asset.categoryId || '').toLowerCase(),
  };

  const fieldsBySection = {};
  for (const field of INTELLIGENCE_FIELDS) {
    let ok = false;
    try {
      ok = !!field.when(enriched);
    } catch {
      ok = false;
    }
    if (!ok) continue;
    if (!fieldsBySection[field.section]) fieldsBySection[field.section] = [];
    fieldsBySection[field.section].push(field);
  }

  const sections = SECTION_ORDER.filter((s) => (fieldsBySection[s] || []).length > 0);
  return { caps: enriched, fieldsBySection, sections };
}

export function categoryFamilyLabel(asset = {}) {
  const caps = resolveAssetCapabilities(asset);
  const cat = caps.taxonomy?.assetCategory;
  if (cat === ASSET_CATEGORY.VEHICLE) return 'Vehicle';
  if (cat === ASSET_CATEGORY.HOME_APPLIANCE) return 'Home appliance';
  if (cat === ASSET_CATEGORY.GADGET) return 'Electronics';
  return 'Asset';
}

export default {
  INTELLIGENCE_FIELDS,
  SECTION_ORDER,
  SECTION_LABELS,
  documentSuggestionsForAsset,
  vaultCopyForAsset,
  resolveIntelligenceLayout,
  categoryFamilyLabel,
};

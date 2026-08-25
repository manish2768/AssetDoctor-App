/**
 * Scalable Asset Intelligence Tools architecture.
 * Add tools here without redesigning the website shell.
 * SEO pages + PublicPlatformView consume this registry.
 */

/** @typedef {'calculator'|'checker'|'analyzer'|'guide'|'estimator'} ToolKind */
/** @typedef {'UNIVERSAL'|'VEHICLE'|'APPLIANCE'|'ELECTRONICS'|'BUSINESS'} ToolCategory */

/**
 * @type {Array<{
 *   id: string,
 *   slug: string,
 *   path: string,
 *   title: string,
 *   shortDescription: string,
 *   kind: ToolKind,
 *   category: ToolCategory,
 *   platformTab?: string,
 *   seoPriority: 'P1'|'P2'|'P3',
 *   relatedIds?: string[],
 * }>}
 */
export const ASSET_INTELLIGENCE_TOOLS = Object.freeze([
  {
    id: 'warranty-checker',
    slug: 'warranty-checker',
    path: '/tools/warranty-checker',
    title: 'Warranty Expiry Calculator',
    shortDescription: 'Track manufacturer warranty and AMC windows for any asset.',
    kind: 'checker',
    category: 'UNIVERSAL',
    platformTab: 'warranty_checker',
    seoPriority: 'P1',
    relatedIds: ['repair-or-replace', 'document-analyzer'],
  },
  {
    id: 'repair-or-replace',
    slug: 'repair-or-replace',
    path: '/tools/repair-or-replace',
    title: 'Repair vs Replace Calculator',
    shortDescription: 'Compare repair quotes against remaining asset value.',
    kind: 'calculator',
    category: 'UNIVERSAL',
    platformTab: 'repair_vs_replace',
    seoPriority: 'P1',
    relatedIds: ['ownership-cost', 'asset-depreciation'],
  },
  {
    id: 'document-analyzer',
    slug: 'document-analyzer',
    path: '/tools/document-analyzer',
    title: 'Document & Invoice Analyzer',
    shortDescription: 'Extract warranty, taxes, and service clues from bills.',
    kind: 'analyzer',
    category: 'UNIVERSAL',
    platformTab: 'invoice_analyzer',
    seoPriority: 'P1',
    relatedIds: ['warranty-checker', 'asset-passport'],
  },
  {
    id: 'asset-health-check',
    slug: 'asset-health-check',
    path: '/tools/asset-health-check',
    title: 'Asset Health Score',
    shortDescription: 'Explainable 100-point health for any physical asset.',
    kind: 'checker',
    category: 'UNIVERSAL',
    platformTab: 'health_score',
    seoPriority: 'P1',
    relatedIds: ['maintenance-interval', 'warranty-checker'],
  },
  {
    id: 'ownership-cost',
    slug: 'ownership-cost',
    path: '/tools/ownership-cost',
    title: 'Ownership Cost (TCO) Calculator',
    shortDescription: 'Estimate total cost of owning an asset over time.',
    kind: 'calculator',
    category: 'UNIVERSAL',
    platformTab: 'tools_hub',
    seoPriority: 'P1',
    relatedIds: ['asset-depreciation', 'repair-or-replace'],
  },
  {
    id: 'asset-depreciation',
    slug: 'asset-depreciation',
    path: '/tools/asset-depreciation',
    title: 'Depreciation & Value Estimator',
    shortDescription: 'Model residual value for vehicles, electronics, and appliances.',
    kind: 'estimator',
    category: 'UNIVERSAL',
    platformTab: 'tools_hub',
    seoPriority: 'P2',
    relatedIds: ['ownership-cost', 'repair-or-replace'],
  },
  {
    id: 'maintenance-interval',
    slug: 'vehicle-service-calculator',
    path: '/tools/vehicle-service-calculator',
    title: 'Maintenance Interval Calculator',
    shortDescription: 'Service intervals for vehicles, ACs, and more.',
    kind: 'calculator',
    category: 'UNIVERSAL',
    platformTab: 'maintenance_checker',
    seoPriority: 'P1',
    relatedIds: ['ac-maintenance-guide', 'asset-health-check'],
  },
  {
    id: 'document-expiry',
    slug: 'document-expiry',
    path: '/tools/document-expiry',
    title: 'Document Expiry Calculator',
    shortDescription: 'Countdown for insurance, warranty, AMC, and certificates.',
    kind: 'calculator',
    category: 'UNIVERSAL',
    platformTab: 'tools_hub',
    seoPriority: 'P2',
    relatedIds: ['warranty-checker', 'document-analyzer'],
  },
  {
    id: 'service-reminder',
    slug: 'service-reminder',
    path: '/tools/service-reminder',
    title: 'Service Reminder Calculator',
    shortDescription: 'Plan the next maintenance window by category.',
    kind: 'calculator',
    category: 'UNIVERSAL',
    platformTab: 'maintenance_checker',
    seoPriority: 'P2',
    relatedIds: ['maintenance-interval'],
  },
  {
    id: 'document-checklist',
    slug: 'document-checklist',
    path: '/tools/document-checklist',
    title: 'Document Checklist Generator',
    shortDescription: 'Category-aware checklist for ownership paperwork.',
    kind: 'guide',
    category: 'UNIVERSAL',
    platformTab: 'tools_hub',
    seoPriority: 'P3',
    relatedIds: ['document-analyzer', 'asset-passport'],
  },
  {
    id: 'purchase-decision',
    slug: 'purchase-decision',
    path: '/tools/purchase-decision',
    title: 'Purchase Decision Calculator',
    shortDescription: 'Weigh upfront cost, warranty, and ownership risk.',
    kind: 'calculator',
    category: 'UNIVERSAL',
    platformTab: 'tools_hub',
    seoPriority: 'P3',
    relatedIds: ['ownership-cost', 'repair-or-replace'],
  },
  {
    id: 'ac-maintenance-guide',
    slug: 'ac-maintenance-guide',
    path: '/tools/ac-maintenance-guide',
    title: 'AC Maintenance Guide',
    shortDescription: 'Filter cleaning and seasonal care for split ACs.',
    kind: 'guide',
    category: 'APPLIANCE',
    platformTab: 'maintenance_checker',
    seoPriority: 'P1',
    relatedIds: ['maintenance-interval'],
  },
  {
    id: 'phone-battery-health',
    slug: 'phone-battery-health',
    path: '/tools/phone-battery-health',
    title: 'Phone Battery Health',
    shortDescription: 'Battery lifecycle guidance for smartphones.',
    kind: 'guide',
    category: 'ELECTRONICS',
    platformTab: 'health_score',
    seoPriority: 'P1',
    relatedIds: ['asset-health-check', 'warranty-checker'],
  },
  {
    id: 'asset-passport',
    slug: 'asset-passport',
    path: '/tools/asset-passport',
    title: 'Asset Passport Preview',
    shortDescription: 'Digital ownership and service record passport.',
    kind: 'guide',
    category: 'UNIVERSAL',
    platformTab: 'passport',
    seoPriority: 'P2',
    relatedIds: ['document-analyzer'],
  },
]);

export const TOOL_ROUTE_PREFIXES = Object.freeze([
  '/tools/',
  '/vehicles/',
  '/electronics/',
  '/home-appliances/',
  '/business-assets/',
  '/guides/',
  '/compare/',
  '/calculators/',
]);

export function getToolBySlug(slug) {
  const key = String(slug || '').replace(/^\/?tools\//, '');
  return ASSET_INTELLIGENCE_TOOLS.find((t) => t.slug === key || t.id === key) || null;
}

export function listToolsByCategory(category) {
  if (!category || category === 'ALL') return [...ASSET_INTELLIGENCE_TOOLS];
  return ASSET_INTELLIGENCE_TOOLS.filter((t) => t.category === category);
}

export function relatedTools(toolId, limit = 4) {
  const tool = ASSET_INTELLIGENCE_TOOLS.find((t) => t.id === toolId);
  if (!tool?.relatedIds?.length) {
    return ASSET_INTELLIGENCE_TOOLS.filter((t) => t.id !== toolId).slice(0, limit);
  }
  return tool.relatedIds
    .map((id) => ASSET_INTELLIGENCE_TOOLS.find((t) => t.id === id))
    .filter(Boolean)
    .slice(0, limit);
}

export default {
  ASSET_INTELLIGENCE_TOOLS,
  TOOL_ROUTE_PREFIXES,
  getToolBySlug,
  listToolsByCategory,
  relatedTools,
};

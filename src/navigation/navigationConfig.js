/**
 * Asset Doctor — Centralized Navigation & Universal Drawer Configuration
 * 
 * Future-ready (2026-2031+) schema-driven navigation definitions.
 * All drawer groups, universal categories, intelligence modules, and tools
 * are defined declaratively here without hardcoded scattered routes.
 */

import { isFeatureEnabled } from './featureFlags';
import { appVersion, appVersionCode } from '../utils/appInfo';

export const DRAWER_GROUPS = Object.freeze({
  MAIN: 'main',
  CATEGORIES: 'categories',
  INTELLIGENCE: 'intelligence',
  TOOLS: 'tools',
  ACCOUNT: 'account',
});

/**
 * 1. Primary Navigation Destinations (Core)
 * Home · Assets · Docs · Alerts · Profile — plus a single Scan & Identify OCR action.
 */
export const MAIN_NAV_ITEMS = [
  {
    id: 'scan_identify',
    label: 'Scan & Identify',
    subtitle: 'OCR any bill, RC, insurance or warranty',
    icon: 'scan',
    isHeroScanner: true,
    badge: 'OCR',
    enabled: true,
    order: 0,
  },
  {
    id: 'home',
    label: 'Home',
    subtitle: 'Vault overview & daily health',
    icon: 'home',
    route: 'Home',
    params: { screen: 'Dashboard' },
    enabled: true,
    order: 1,
  },
  {
    id: 'my_assets',
    label: 'Assets',
    subtitle: 'Everything you own in one place',
    icon: 'package',
    route: 'Assets',
    params: { screen: 'AssetList', params: { category: 'all' } },
    enabled: true,
    order: 2,
  },
  {
    id: 'document_vault',
    label: 'Docs',
    subtitle: 'Invoices, RC, insurance & warranties',
    icon: 'file-text',
    route: 'Documents',
    params: { screen: 'VaultHome' },
    enabled: true,
    order: 3,
  },
  {
    id: 'alerts_reminders',
    label: 'Alerts',
    subtitle: 'Expiry, service & renewal reminders',
    icon: 'bell',
    route: 'Alerts',
    params: { screen: 'NotificationCenter' },
    enabled: true,
    order: 4,
  },
  {
    id: 'profile',
    label: 'Profile',
    subtitle: 'Account, preferences & security',
    icon: 'user',
    route: 'Profile',
    params: { screen: 'ProfileHome' },
    enabled: true,
    order: 5,
  },
];

/**
 * 2. Universal Asset Categories (Data-Driven, Extensible)
 * Vehicles are just one category alongside appliances, gadgets, equipment, and business assets.
 */
export const ASSET_CATEGORIES_CONFIG = [
  {
    id: 'vehicles',
    label: 'Vehicles',
    subtitle: 'Cars, Bikes, Scooters, EVs & Commercial',
    icon: 'car',
    folder: 'vehicle',
    category: 'vehicle',
    route: 'Assets',
    params: { screen: 'AssetList', params: { category: 'vehicle' } },
    color: '#0D9488',
    enabled: true,
    order: 1,
  },
  {
    id: 'home_appliances',
    label: 'Home & Appliances',
    subtitle: 'AC, Fridge, Washing Machine, Geyser, TV',
    icon: 'house',
    folder: 'home',
    category: 'home',
    route: 'Assets',
    params: { screen: 'AssetList', params: { category: 'home' } },
    color: '#0891B2',
    enabled: true,
    order: 2,
  },
  {
    id: 'gadgets_electronics',
    label: 'Gadgets & Electronics',
    subtitle: 'Smartphones, Laptops, Tablets, Cameras, Consoles',
    icon: 'smartphone',
    folder: 'gadget',
    category: 'gadget',
    route: 'Assets',
    params: { screen: 'AssetList', params: { category: 'gadget' } },
    color: '#6366F1',
    enabled: true,
    order: 3,
  },
  {
    id: 'equipment_machinery',
    label: 'Equipment & Tools',
    subtitle: 'Generators, Inverters, Solar Panels, Power Tools',
    icon: 'wrench',
    folder: 'equipment',
    category: 'equipment',
    route: 'Assets',
    params: { screen: 'AssetList', params: { category: 'equipment' } },
    color: '#D97706',
    enabled: true,
    order: 4,
  },
  {
    id: 'business_assets',
    label: 'Business Assets',
    subtitle: 'Office Systems, POS, Machinery, Commercial Tech',
    icon: 'briefcase',
    folder: 'business',
    category: 'business',
    route: 'Assets',
    params: { screen: 'AssetList', params: { category: 'business' } },
    color: '#8B5CF6',
    enabled: true,
    order: 5,
  },
  {
    id: 'other_assets',
    label: 'Other Assets & Personal',
    subtitle: 'Property, Legal, Guarantees, Valuables',
    icon: 'package',
    folder: 'other',
    category: 'other',
    route: 'Assets',
    params: { screen: 'AssetList', params: { category: 'other' } },
    color: '#64748B',
    enabled: true,
    order: 6,
  },
];

/**
 * 3. Asset Intelligence Modules (Works across all asset categories)
 */
export const INTELLIGENCE_NAV_ITEMS = [
  {
    id: 'asset_health',
    label: 'Asset Health & Vitals',
    subtitle: 'Live health scores, warnings & recommendations',
    icon: 'spark',
    route: 'Home',
    params: { screen: 'AssetAnalytics' },
    enabled: true,
    order: 1,
  },
  {
    id: 'cost_ownership',
    label: 'Cost & Ownership (TCO)',
    subtitle: 'Total cost of ownership, energy & fuel breakdown',
    icon: 'chart',
    route: 'Home',
    params: { screen: 'AssetAnalytics' },
    enabled: true,
    order: 2,
  },
  {
    id: 'documents_warranty',
    label: 'Documents & Warranty',
    subtitle: 'Expiring warranties, policies & claim receipts',
    icon: 'file-text',
    route: 'Documents',
    params: { screen: 'VaultHome' },
    enabled: true,
    order: 3,
  },
  {
    id: 'maintenance_history',
    label: 'Maintenance History',
    subtitle: 'Service logs, part replacements & workshop records',
    icon: 'wrench',
    route: 'Home',
    params: { screen: 'Maintenance' },
    enabled: true,
    order: 4,
  },
  {
    id: 'asset_timeline',
    label: 'Asset Timeline',
    subtitle: 'Unified lifecycle: purchase → service → warranty → resale',
    icon: 'clock',
    route: 'Assets',
    params: { screen: 'AssetList' },
    enabled: true,
    order: 5,
  },
];

/**
 * 4. Smart Tools
 */
export const SMART_TOOLS_ITEMS = [
  {
    id: 'universal_search',
    label: 'Universal Search',
    subtitle: 'Search serial, IMEI, plate, policy or workshop',
    icon: 'search',
    route: 'Home',
    params: { screen: 'GlobalSearch' },
    enabled: true,
    order: 1,
  },
  {
    id: 'cost_calculator',
    label: 'Cost & Energy Calculator',
    subtitle: 'Electricity tariff, fuel usage & running cost estimator',
    icon: 'zap',
    route: 'Home',
    params: { screen: 'EnergyOverview' },
    enabled: true,
    order: 2,
  },
  {
    id: 'vault_reports',
    label: 'Vault Reports & Analytics',
    subtitle: 'Generate portfolio summaries & valuation reports',
    icon: 'chart',
    route: 'Home',
    params: { screen: 'AssetAnalytics' },
    enabled: true,
    order: 3,
  },
  {
    id: 'export_share',
    label: 'Export & Share Vault',
    subtitle: 'Secure PDF insurance dossiers & service exports',
    icon: 'file-text',
    route: 'Documents',
    params: { screen: 'VaultHome' },
    enabled: true,
    order: 4,
  },
];

/**
 * 5. Account & Security
 */
export const ACCOUNT_NAV_ITEMS = [
  {
    id: 'cloud_sync',
    label: 'Cloud Sync & Storage',
    subtitle: 'Offline-first database with Firestore vault sync',
    icon: 'shield',
    isSyncAction: true,
    enabled: true,
    order: 1,
  },
  {
    id: 'privacy_security',
    label: 'Privacy & Security',
    subtitle: 'Biometric App Lock & encrypted storage',
    icon: 'lock',
    route: 'Profile',
    params: { screen: 'PrivacySecurity' },
    enabled: true,
    order: 2,
  },
  {
    id: 'settings',
    label: 'Settings & Preferences',
    subtitle: 'Notifications, currency, theme & sound',
    icon: 'settings',
    route: 'Profile',
    params: { screen: 'SettingsHome' },
    enabled: true,
    order: 3,
  },
  {
    id: 'help_feedback',
    label: 'Help & Customer Support',
    subtitle: 'Contact support, report issue & feature requests',
    icon: 'message',
    enabled: true,
    order: 4,
  },
  {
    id: 'about',
    label: 'About Asset Doctor',
    subtitle: `Version ${appVersion()} (${appVersionCode()})`,
    icon: 'shield-check',
    route: 'Profile',
    params: { screen: 'About' },
    enabled: true,
    order: 5,
  },
];

/**
 * Helper to retrieve all active navigation items for a specific section,
 * automatically applying feature flags and enabled states.
 */
export function getActiveNavSection(items = []) {
  return items
    .filter((item) => {
      if (item.enabled === false) return false;
      if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
      return true;
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/**
 * Asset Doctor — Design System
 * Light Slate / Off-White canvas · deep navy ink · teal / cyan accents
 * Tagline: Protect, Track & Save: The Smart Asset Vault
 */

export const BRAND = {
  name: 'Asset Doctor',
  tagline: 'Protect, Track & Save: The Smart Asset Vault',
  shortTagline: 'Protect, Track & Save',
  creator: 'Ashutosh Rai',
  creatorCredit: 'Built by Ashutosh Rai',
  footer: 'Built by Ashutosh Rai',
  builtBy: 'Built by Ashutosh Rai',
  /** Customer support email */
  supportEmail: 'hansgeetglobal@gmail.com',
  /** Optional share deep-link digits (country code, no +). Leave '' to use system Share sheet */
  supportWhatsApp: '',
};

/** Crisp light slate + deep navy text + teal/cyan primary */
export const COLORS = {
  bg: '#F8FAFC',
  bgDeep: '#F1F5F9',
  bgElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardStrong: '#F8FAFC',
  border: 'rgba(15, 23, 42, 0.10)',
  borderGlow: 'rgba(13, 148, 136, 0.32)',
  /** Primary teal (legacy key `emerald` kept for call-sites) */
  emerald: '#0D9488',
  neonBlue: '#0891B2',
  indigo: '#0E7490',
  violet: '#6366F1',
  rose: '#DC2626',
  amber: '#D97706',
  success: '#10B981',
  gold: '#D4A017',
  goldSoft: 'rgba(212, 160, 23, 0.16)',
  text: '#0A1628',
  muted: '#64748B',
  successSoft: 'rgba(13, 148, 136, 0.12)',
  warnSoft: 'rgba(217, 119, 6, 0.12)',
  dangerSoft: 'rgba(220, 38, 38, 0.08)',
  glassGlow: ['rgba(13, 148, 136, 0.10)', 'rgba(8, 145, 178, 0.08)'],
  onPrimary: '#FFFFFF',
  /** Soft neutral urgent surfaces (no heavy red borders) */
  urgentBg: '#F8FAFC',
  urgentBorder: 'rgba(15, 23, 42, 0.08)',
};

export const SPACING = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };
export const RADIUS = { sm: 12, md: 16, lg: 22, xl: 28, full: 999 };

/** Chart palette for energy donut slices */
export const CHART_PALETTE = [
  '#0D9488',
  '#0891B2',
  '#6366F1',
  '#D97706',
  '#10B981',
  '#8B5CF6',
  '#F43F5E',
  '#0EA5E9',
];

/** React Navigation 7+ requires theme.fonts.{regular,medium,bold,heavy} */
const NAV_FONTS = {
  regular: {
    fontFamily: 'System',
    fontWeight: '400',
  },
  medium: {
    fontFamily: 'System',
    fontWeight: '500',
  },
  bold: {
    fontFamily: 'System',
    fontWeight: '700',
  },
  heavy: {
    fontFamily: 'System',
    fontWeight: '800',
  },
};

export const NAV_THEME = {
  dark: false,
  colors: {
    primary: COLORS.emerald,
    background: COLORS.bg,
    card: COLORS.bgElevated,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.emerald,
  },
  fonts: NAV_FONTS,
};

export const ASSET_CATEGORY_OPTIONS = [
  { id: 'bike', label: 'Bike', icon: 'bike', group: 'Vehicles', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'car', label: 'Car', icon: 'car', group: 'Vehicles', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'scooter', label: 'Scooter', icon: 'scooter', group: 'Vehicles', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'mobile', label: 'Phone', icon: 'mobile', group: 'Electronics & Appliances', powerWatts: 15, powerFactor: 0.7, dailyHours: 2 },
  { id: 'ac', label: 'AC', icon: 'ac', group: 'Electronics & Appliances', powerWatts: 1500, powerFactor: 0.85, dailyHours: 8 },
  { id: 'tv', label: 'TV', icon: 'tv', group: 'Electronics & Appliances', powerWatts: 120, powerFactor: 0.95, dailyHours: 5 },
  { id: 'fridge', label: 'Fridge', icon: 'fridge', group: 'Electronics & Appliances', powerWatts: 150, powerFactor: 0.9, dailyHours: 24 },
  { id: 'washing_machine', label: 'Washing Machine', icon: 'washing_machine', group: 'Electronics & Appliances', powerWatts: 500, powerFactor: 0.8, dailyHours: 1 },
  { id: 'laptop', label: 'Laptop', icon: 'laptop', group: 'Electronics & Appliances', powerWatts: 65, powerFactor: 0.7, dailyHours: 4 },
  { id: 'tablet', label: 'Tablet', icon: 'tablet', group: 'Electronics & Appliances', powerWatts: 15, powerFactor: 0.7, dailyHours: 3 },
  { id: 'microwave', label: 'Microwave', icon: 'microwave', group: 'Electronics & Appliances', powerWatts: 1200, powerFactor: 1, dailyHours: 0.5 },
  { id: 'geyser', label: 'Geyser', icon: 'geyser', group: 'Electronics & Appliances', powerWatts: 2000, powerFactor: 1, dailyHours: 1 },
  { id: 'appliance', label: 'Home Appliance', icon: 'appliance', group: 'Electronics & Appliances', powerWatts: 200, powerFactor: 0.85, dailyHours: 3 },
  { id: 'accessory', label: 'Accessory', icon: 'accessory', group: 'Electronics & Appliances', powerWatts: 5, powerFactor: 0.7, dailyHours: 1 },
  { id: 'vehicle_parts', label: 'Vehicle Parts', icon: 'vehicle_parts', group: 'Vehicles', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'utility_bill', label: 'Utility Bill', icon: 'utility_bill', group: 'Digital Bills & Utility Subscriptions', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'electricity_bill', label: 'Electricity Bill', icon: 'electricity_bill', group: 'Digital Bills & Utility Subscriptions', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'broadband', label: 'Broadband / Wi-Fi', icon: 'broadband', group: 'Digital Bills & Utility Subscriptions', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'digital_subscription', label: 'Digital Subscription', icon: 'digital_subscription', group: 'Digital Bills & Utility Subscriptions', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'insurance_policy', label: 'Insurance Policy', icon: 'insurance_policy', group: 'Personal & Legal', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'legal_document', label: 'Legal Document', icon: 'legal_document', group: 'Personal & Legal', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'guarantee', label: 'Guarantee', icon: 'guarantee', group: 'Personal & Legal', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'other', label: 'Other Document', icon: 'other', group: 'Personal & Legal', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
];

export const DOCUMENT_TYPES = [
  { id: 'rc', label: 'RC Book', icon: '📄' },
  { id: 'puc', label: 'PUC Certificate', icon: '🌿' },
  { id: 'bill', label: 'Purchase Bill / Invoice', icon: '🧾' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️' },
  { id: 'warranty', label: 'Warranty Card', icon: '✅' },
  { id: 'service_coupon', label: 'Service Coupon', icon: '🔧' },
  { id: 'amc', label: 'AMC Document', icon: '🧰' },
  { id: 'property_papers', label: 'Property Papers', icon: '🏠' },
  { id: 'rent_agreement', label: 'Rent Agreement', icon: '🔑' },
  { id: 'policy', label: 'Insurance Policy', icon: '📋' },
  { id: 'guarantee', label: 'Guarantee', icon: '📜' },
  { id: 'other', label: 'Other Doc', icon: '📁' },
];

export const CONDITION_OPTIONS = [
  { id: 'excellent', label: 'Excellent', factor: 0.95 },
  { id: 'good', label: 'Good', factor: 0.8 },
  { id: 'fair', label: 'Fair', factor: 0.65 },
  { id: 'poor', label: 'Poor', factor: 0.45 },
];

export {
  ASSET_STATUS,
  ASSET_STATUS_OPTIONS,
  isAlertableStatus,
} from '../constants/assetStatus';

/** ₹/kWh default for power meter / Energy tab */
export const DEFAULT_TARIFF_PER_KWH = 7.5;

/** Per-document fine and warranty protection windows. */
export const EXPIRY_ALERT_PROFILES = Object.freeze({
  pucExpiry: Object.freeze({
    days: Object.freeze([15, 7, 1]),
    label: 'PUC',
    message: 'PUC expiring soon — renew to avoid fines.',
  }),
  insuranceExpiry: Object.freeze({
    days: Object.freeze([15, 3]),
    label: 'Motor insurance',
    message: 'Your motor insurance expires soon. Renew before your cover ends.',
  }),
  warrantyExpiry: Object.freeze({
    days: Object.freeze([30]),
    label: 'Warranty',
    message: 'Claim free service or extend warranty now.',
  }),
  nextServiceDue: Object.freeze({
    days: Object.freeze([15, 7, 1]),
    label: 'Service',
    message: 'Vehicle / appliance service is due soon.',
  }),
});

/**
 * Asset Doctor — Design System
 * Modern light slate · off-white canvas · emerald / blue accents
 * Typography: Inter / system sans
 */

import { Platform } from 'react-native';

export const BRAND = {
  name: 'Asset Doctor',
  tagline: 'Protect, Track & Save: The Smart Asset Vault',
  shortTagline: 'Protect, Track & Save',
  creator: 'Ashutosh Rai',
  creatorCredit: 'Built by Ashutosh Rai',
  footer: 'Built by Ashutosh Rai',
  builtBy: 'Built by Ashutosh Rai',
  supportEmail: 'support@assetdoctor.in',
  supportWhatsApp: '',
};

/** Light slate / off-white fintech palette */
export const COLORS = {
  bg: '#F8FAFC',
  bgDeep: '#F1F5F9',
  bgElevated: '#FFFFFF',
  card: '#FFFFFF',
  cardStrong: '#F8FAFC',
  border: '#E2E8F0',
  borderGlow: 'rgba(16, 185, 129, 0.35)',
  emerald: '#10B981',
  neonBlue: '#2563EB',
  indigo: '#4F46E5',
  violet: '#7C3AED',
  rose: '#E11D48',
  amber: '#D97706',
  success: '#059669',
  gold: '#CA8A04',
  goldSoft: 'rgba(202, 138, 4, 0.12)',
  text: '#1E293B',
  muted: '#64748B',
  successSoft: 'rgba(16, 185, 129, 0.12)',
  warnSoft: 'rgba(217, 119, 6, 0.12)',
  dangerSoft: 'rgba(225, 29, 72, 0.10)',
  glassGlow: ['rgba(16, 185, 129, 0.08)', 'rgba(37, 99, 235, 0.06)'],
  onPrimary: '#FFFFFF',
  urgentBg: 'rgba(217, 119, 6, 0.10)',
  urgentBorder: 'rgba(217, 119, 6, 0.28)',
};

export const FONTS = {
  regular: Platform.select({ ios: 'Inter_400Regular', android: 'Inter_400Regular', default: 'System' }),
  medium: Platform.select({ ios: 'Inter_500Medium', android: 'Inter_500Medium', default: 'System' }),
  semibold: Platform.select({ ios: 'Inter_600SemiBold', android: 'Inter_600SemiBold', default: 'System' }),
  bold: Platform.select({ ios: 'Inter_700Bold', android: 'Inter_700Bold', default: 'System' }),
  system: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
};

export const SPACING = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };
export const RADIUS = { sm: 12, md: 16, lg: 22, xl: 28, full: 999 };

export const CHART_PALETTE = [
  '#10B981',
  '#2563EB',
  '#7C3AED',
  '#D97706',
  '#059669',
  '#0EA5E9',
  '#E11D48',
  '#4F46E5',
];

const NAV_FONTS = {
  regular: { fontFamily: FONTS.regular, fontWeight: '400' },
  medium: { fontFamily: FONTS.medium, fontWeight: '500' },
  bold: { fontFamily: FONTS.bold, fontWeight: '700' },
  heavy: { fontFamily: FONTS.bold, fontWeight: '800' },
};

export const NAV_THEME = {
  dark: false,
  colors: {
    primary: COLORS.emerald,
    background: COLORS.bg,
    card: COLORS.card,
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

export const DEFAULT_TARIFF_PER_KWH = 7.5;

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

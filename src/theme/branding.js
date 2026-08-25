/**
 * Asset Doctor — Design System entry
 * Modern light slate · semantic colors · Inter typography
 * Prefer useTheme() for dark-mode-aware colors; COLORS remains light default for StyleSheets.
 */

import { LIGHT } from './palettes';
import {
  FONTS,
  TYPE,
  SPACING,
  RADIUS,
  elevation,
  ELEVATION,
  MOTION,
  HIT,
  ICON_SIZE,
} from './tokens';

export { LIGHT, DARK } from './palettes';
export {
  FONTS,
  TYPE,
  SPACING,
  RADIUS,
  elevation,
  ELEVATION,
  MOTION,
  HIT,
  ICON_SIZE,
};

export const BRAND = {
  name: 'Asset Doctor',
  tagline: 'One place to understand, protect and manage everything you own',
  shortTagline: 'Universal Asset Intelligence',
  productLine: 'Universal Asset Intelligence Platform',
  creator: 'Ashutosh Rai',
  creatorCredit: 'Built by Ashutosh Rai',
  footer: 'Built by Ashutosh Rai',
  builtBy: 'Built by Ashutosh Rai',
  supportEmail: 'support@assetdoctor.in',
  supportWhatsApp: '',
};

/** Light default — keep stable for existing StyleSheet.create modules */
export const COLORS = { ...LIGHT };

export const CHART_PALETTE = [
  LIGHT.emerald,
  LIGHT.neonBlue,
  LIGHT.violet,
  LIGHT.amber,
  LIGHT.success,
  '#0EA5E9',
  LIGHT.rose,
  LIGHT.indigo,
];

const NAV_FONTS = {
  regular: { fontFamily: FONTS.regular, fontWeight: '400' },
  medium: { fontFamily: FONTS.medium, fontWeight: '500' },
  bold: { fontFamily: FONTS.bold, fontWeight: '700' },
  heavy: { fontFamily: FONTS.bold, fontWeight: '800' },
};

export function buildNavTheme(colors = COLORS, dark = false) {
  return {
    dark,
    colors: {
      primary: colors.primary || colors.emerald,
      background: colors.background || colors.bg,
      card: colors.surface || colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.primary || colors.emerald,
    },
    fonts: NAV_FONTS,
  };
}

export const NAV_THEME = buildNavTheme(COLORS, false);

export const ASSET_CATEGORY_OPTIONS = [
  { id: 'car', label: 'Car', icon: 'car', group: 'Vehicles', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'bike', label: 'Bike', icon: 'bike', group: 'Vehicles', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'scooter', label: 'Scooter', icon: 'scooter', group: 'Vehicles', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'ev', label: 'EV', icon: 'ev', group: 'Vehicles', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
  { id: 'commercial', label: 'Commercial', icon: 'commercial', group: 'Vehicles', powerWatts: 0, powerFactor: 1, dailyHours: 0 },
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
    days: Object.freeze([30, 15, 7, 3, 1, 0]),
    label: 'PUC',
    message: 'PUC expiring soon — renew to avoid fines.',
  }),
  insuranceExpiry: Object.freeze({
    days: Object.freeze([30, 15, 7, 3, 1, 0]),
    label: 'Motor insurance',
    message: 'Your motor insurance expires soon. Renew before your cover ends.',
  }),
  warrantyExpiry: Object.freeze({
    days: Object.freeze([30, 15, 7, 3, 1, 0]),
    label: 'Warranty',
    message: 'Claim free service or extend warranty now.',
  }),
  extendedWarrantyExpiry: Object.freeze({
    days: Object.freeze([30, 15, 7, 3, 1, 0]),
    label: 'Extended warranty',
    message: 'Your extended warranty expires soon.',
  }),
  nextServiceDue: Object.freeze({
    days: Object.freeze([30, 15, 7, 3, 1, 0]),
    label: 'Service',
    message: 'Vehicle / appliance service is due soon.',
  }),
});

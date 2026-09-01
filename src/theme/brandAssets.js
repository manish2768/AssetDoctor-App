/**
 * Asset Doctor — centralized brand asset map.
 * Customer-facing logo/icon should come from here (or from AppLogo /
 * AssetDoctorLogo / AssetDoctorMark / AssetDoctorAppIcon) rather than
 * ad-hoc copies of older marks.
 */

export const BRAND_NAVY = '#050A0F';
export const BRAND_MIDNIGHT = '#07111F';
export const BRAND_TEAL = '#14B8A6';
export const BRAND_MINT = '#6EE7B7';

/** Public / web URLs (copied into public/ by the icon pipeline). */
export const BRAND_PUBLIC = {
  appIcon: '/icon.png',
  logo: '/logo.png',
  markSvg: '/icon.svg',
};

/** Expo / native relative paths used by app.json and Metro requires. */
export const BRAND_NATIVE_PATHS = {
  appIcon: '../../assets/icon.png',
  splashIcon: '../../assets/splash-icon.png',
  logoBrand: '../../assets/logo-brand.png',
};

export const BRAND_WORDMARK = {
  primary: 'ASSET',
  accent: 'DOCTOR',
  full: 'ASSET DOCTOR',
};

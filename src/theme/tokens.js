/**
 * Asset Doctor — Master Design Tokens
 * 8pt Spacing grid, Radius hierarchy, Typography, Subtle elevation.
 */

let Platform = { select: (obj) => obj?.android || obj?.default || 'System', OS: 'android' };
try {
  const rnName = 'react-native';
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const rn = require(rnName);
  if (rn?.Platform) Platform = rn.Platform;
} catch {}

export const FONTS = {
  regular: Platform.select({ ios: 'Inter_400Regular', android: 'Inter_400Regular', default: 'System' }),
  medium: Platform.select({ ios: 'Inter_500Medium', android: 'Inter_500Medium', default: 'System' }),
  semibold: Platform.select({ ios: 'Inter_600SemiBold', android: 'Inter_600SemiBold', default: 'System' }),
  bold: Platform.select({ ios: 'Inter_700Bold', android: 'Inter_700Bold', default: 'System' }),
  system: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
};

/** Clear Typography Scale */
export const TYPE = Object.freeze({
  display: { fontSize: 34, lineHeight: 40, fontFamily: FONTS.bold, fontWeight: '700', letterSpacing: -0.8 },
  h1: { fontSize: 26, lineHeight: 32, fontFamily: FONTS.bold, fontWeight: '700', letterSpacing: -0.4 },
  h2: { fontSize: 19, lineHeight: 24, fontFamily: FONTS.semibold, fontWeight: '600', letterSpacing: -0.2 },
  h3: { fontSize: 16, lineHeight: 22, fontFamily: FONTS.semibold, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.semibold, fontWeight: '600' },
  bodySmall: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.regular, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.medium, fontWeight: '500' },
  label: { fontSize: 11, lineHeight: 14, fontFamily: FONTS.semibold, fontWeight: '600', letterSpacing: 0.8 },
  button: { fontSize: 15, lineHeight: 20, fontFamily: FONTS.semibold, fontWeight: '600' },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: FONTS.medium, fontWeight: '500', letterSpacing: 0.2 },
  metric: {
    fontSize: 32,
    lineHeight: 36,
    fontFamily: FONTS.bold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
});

/** 8pt Spacing Grid */
export const SPACING = Object.freeze({
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
});

/** Radius Hierarchy */
export const RADIUS = Object.freeze({
  xs: 8,
  sm: 10,
  small: 10,
  md: 12,
  medium: 12,
  lg: 14,
  large: 14,
  xl: 20,
  hero: 22,
  full: 999,
});

/** Subtle, Calm Mobile Elevation */
export function elevation(level = 1, shadowColor = '#64748B') {
  const map = {
    0: { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
    1: {
      shadowColor,
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    2: {
      shadowColor,
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    3: {
      shadowColor,
      shadowOpacity: 0.11,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  };
  return map[level] || map[1];
}

export const ELEVATION = Object.freeze({
  none: 0,
  card: 1,
  raised: 2,
  modal: 3,
});

export const MOTION = Object.freeze({
  fast: 150,
  normal: 220,
  slow: 320,
});

/** Minimum Touch Target (a11y) */
export const HIT = Object.freeze({
  min: 44,
  slop8: { top: 8, bottom: 8, left: 8, right: 8 },
  slop12: { top: 12, bottom: 12, left: 12, right: 12 },
});

export const ICON_SIZE = Object.freeze({
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
});

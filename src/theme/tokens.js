/**
 * Non-color design tokens — spacing, type, radius, elevation, motion, a11y.
 */

import { Platform } from 'react-native';

export const FONTS = {
  regular: Platform.select({ ios: 'Inter_400Regular', android: 'Inter_400Regular', default: 'System' }),
  medium: Platform.select({ ios: 'Inter_500Medium', android: 'Inter_500Medium', default: 'System' }),
  semibold: Platform.select({ ios: 'Inter_600SemiBold', android: 'Inter_600SemiBold', default: 'System' }),
  bold: Platform.select({ ios: 'Inter_700Bold', android: 'Inter_700Bold', default: 'System' }),
  system: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
};

/** Type scale — use these instead of ad-hoc fontSize */
export const TYPE = Object.freeze({
  display: { fontSize: 32, lineHeight: 38, fontFamily: FONTS.bold, fontWeight: '800' },
  h1: { fontSize: 24, lineHeight: 30, fontFamily: FONTS.bold, fontWeight: '800' },
  h2: { fontSize: 20, lineHeight: 26, fontFamily: FONTS.bold, fontWeight: '700' },
  h3: { fontSize: 17, lineHeight: 22, fontFamily: FONTS.semibold, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.semibold, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FONTS.medium, fontWeight: '500' },
  label: { fontSize: 11, lineHeight: 14, fontFamily: FONTS.bold, fontWeight: '700', letterSpacing: 0.6 },
  /** Large numeric metrics (health score, counts, currency) — tabular nums preferred */
  metric: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: FONTS.bold,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  button: { fontSize: 15, lineHeight: 20, fontFamily: FONTS.semibold, fontWeight: '600' },
  micro: { fontSize: 10, lineHeight: 13, fontFamily: FONTS.semibold, fontWeight: '600' },
});

export const SPACING = Object.freeze({
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
});

export const RADIUS = Object.freeze({
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  full: 999,
});

/** Elevation / shadow presets (pass color from theme.shadow) */
export function elevation(level = 1, shadowColor = '#64748B') {
  const map = {
    0: { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
    1: {
      shadowColor,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    2: {
      shadowColor,
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    3: {
      shadowColor,
      shadowOpacity: 0.14,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
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

/** Minimum touch target (a11y) */
export const HIT = Object.freeze({
  min: 44,
  icon: 40,
});

export const ICON_SIZE = Object.freeze({
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
});

export default {
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

/**
 * Subtle contextual page backgrounds — soft tints only.
 * Never strong gradients behind text; stays readable in light/dark.
 */

export const CONTEXTUAL_SURFACE = Object.freeze({
  HOME: 'home',
  ASSETS: 'assets',
  SCAN: 'scan',
  INSIGHTS: 'insights',
  PROFILE: 'profile',
  VEHICLE: 'vehicle',
  APPLIANCE: 'appliance',
  ENERGY: 'energy',
  DOCUMENTS: 'documents',
  SERVICE: 'service',
  INSURANCE: 'insurance',
  PASSPORT: 'passport',
  DEFAULT: 'default',
});

/** Soft overlay tints (RGBA). Applied as a light wash over theme background. */
const LIGHT_TINTS = Object.freeze({
  [CONTEXTUAL_SURFACE.HOME]: 'rgba(148, 163, 184, 0.08)',
  [CONTEXTUAL_SURFACE.ASSETS]: 'rgba(14, 165, 233, 0.05)',
  [CONTEXTUAL_SURFACE.SCAN]: 'rgba(99, 102, 241, 0.05)',
  [CONTEXTUAL_SURFACE.INSIGHTS]: 'rgba(16, 185, 129, 0.05)',
  [CONTEXTUAL_SURFACE.PROFILE]: 'rgba(100, 116, 139, 0.06)',
  [CONTEXTUAL_SURFACE.VEHICLE]: 'rgba(14, 165, 233, 0.07)',
  [CONTEXTUAL_SURFACE.APPLIANCE]: 'rgba(245, 158, 11, 0.06)',
  [CONTEXTUAL_SURFACE.ENERGY]: 'rgba(16, 185, 129, 0.08)',
  [CONTEXTUAL_SURFACE.DOCUMENTS]: 'rgba(167, 139, 250, 0.07)',
  [CONTEXTUAL_SURFACE.SERVICE]: 'rgba(20, 184, 166, 0.07)',
  [CONTEXTUAL_SURFACE.INSURANCE]: 'rgba(139, 92, 246, 0.07)',
  [CONTEXTUAL_SURFACE.PASSPORT]: 'rgba(100, 116, 139, 0.05)',
  [CONTEXTUAL_SURFACE.DEFAULT]: 'transparent',
});

const DARK_TINTS = Object.freeze({
  [CONTEXTUAL_SURFACE.HOME]: 'rgba(148, 163, 184, 0.05)',
  [CONTEXTUAL_SURFACE.ASSETS]: 'rgba(56, 189, 248, 0.05)',
  [CONTEXTUAL_SURFACE.SCAN]: 'rgba(129, 140, 248, 0.05)',
  [CONTEXTUAL_SURFACE.INSIGHTS]: 'rgba(52, 211, 153, 0.05)',
  [CONTEXTUAL_SURFACE.PROFILE]: 'rgba(148, 163, 184, 0.05)',
  [CONTEXTUAL_SURFACE.VEHICLE]: 'rgba(56, 189, 248, 0.06)',
  [CONTEXTUAL_SURFACE.APPLIANCE]: 'rgba(251, 191, 36, 0.05)',
  [CONTEXTUAL_SURFACE.ENERGY]: 'rgba(52, 211, 153, 0.07)',
  [CONTEXTUAL_SURFACE.DOCUMENTS]: 'rgba(196, 181, 253, 0.06)',
  [CONTEXTUAL_SURFACE.SERVICE]: 'rgba(45, 212, 191, 0.06)',
  [CONTEXTUAL_SURFACE.INSURANCE]: 'rgba(167, 139, 250, 0.06)',
  [CONTEXTUAL_SURFACE.PASSPORT]: 'rgba(148, 163, 184, 0.04)',
  [CONTEXTUAL_SURFACE.DEFAULT]: 'transparent',
});

/**
 * @param {string} surface — CONTEXTUAL_SURFACE key
 * @param {boolean} [isDark]
 * @returns {string} rgba tint or transparent
 */
export function getContextualTint(surface = CONTEXTUAL_SURFACE.DEFAULT, isDark = false) {
  const aliases = {
    home: CONTEXTUAL_SURFACE.HOME,
    assets: CONTEXTUAL_SURFACE.ASSETS,
    scan: CONTEXTUAL_SURFACE.SCAN,
    insights: CONTEXTUAL_SURFACE.INSIGHTS,
    profile: CONTEXTUAL_SURFACE.PROFILE,
    energy: CONTEXTUAL_SURFACE.ENERGY,
    documents: CONTEXTUAL_SURFACE.DOCUMENTS,
  };
  const raw = String(surface || '').toLowerCase();
  const mapped = aliases[raw] || CONTEXTUAL_SURFACE[String(surface || '').toUpperCase()] || surface;
  const key = mapped;
  const map = isDark ? DARK_TINTS : LIGHT_TINTS;
  return map[key] || map[CONTEXTUAL_SURFACE.DEFAULT] || 'transparent';
}

/**
 * Resolve screen style background: solid theme color + optional soft tint overlay style.
 * Prefer stacking: base backgroundColor + absolute tint View — see Screen contextual prop.
 */
export function resolveContextualBackground(colors = {}, surface, isDark = false) {
  return {
    backgroundColor: colors.background || (isDark ? '#0B1220' : '#F4F6F9'),
    tint: getContextualTint(surface, isDark),
  };
}

export default {
  CONTEXTUAL_SURFACE,
  getContextualTint,
  resolveContextualBackground,
};

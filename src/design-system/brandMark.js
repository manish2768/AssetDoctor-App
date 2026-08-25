/**
 * Asset Doctor brand mark — shield + signal (intelligence / protection).
 * Not a medical caduceus. Use for app icon source, favicon, and marketing.
 *
 * Variants via CSS / fill:
 *  - primary: #0F766E on light
 *  - inverse: #FFFFFF / #2DD4BF on dark
 *  - mono: currentColor
 */

export const BRAND_MARK_PATHS = {
  /** Hex shield outline */
  shield:
    'M12 2.5 L20 5.5 V11.5 C20 16.2 16.8 20.2 12 21.5 C7.2 20.2 4 16.2 4 11.5 V5.5 Z',
  /** Inner pulse / intelligence node */
  node: 'M12 8.2 A2.2 2.2 0 1 1 12 12.6 A2.2 2.2 0 1 1 12 8.2 Z',
  /** Orbit ring */
  orbit: 'M8.2 12 A3.8 3.8 0 1 0 15.8 12',
};

/** Minimal SVG string for favicon / web */
export function brandMarkSvg({
  fill = '#0F766E',
  accent = '#14B8A6',
  size = 64,
  background = 'transparent',
} = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" role="img" aria-label="Asset Doctor">
  ${background !== 'transparent' ? `<rect width="24" height="24" rx="6" fill="${background}"/>` : ''}
  <path d="${BRAND_MARK_PATHS.shield}" stroke="${fill}" stroke-width="1.6" stroke-linejoin="round" fill="${fill}" fill-opacity="0.08"/>
  <circle cx="12" cy="10.4" r="2" fill="${accent}"/>
  <path d="M9.2 14.2 C10 15.4 11 16 12 16 C13 16 14 15.4 14.8 14.2" stroke="${fill}" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;
}

export const BRAND_WORDMARK = 'Asset Doctor';
export const BRAND_PRODUCT_LINE = 'Universal Asset Intelligence Platform';

export default {
  BRAND_MARK_PATHS,
  brandMarkSvg,
  BRAND_WORDMARK,
  BRAND_PRODUCT_LINE,
};

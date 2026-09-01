/**
 * Asset Doctor brand mark — shield + A + heartbeat (approved identity).
 * Use for favicon strings and any caller that still imports brandMarkSvg.
 */

export const BRAND_MARK_PATHS = {
  shield:
    'M12 2.2 C15.6 3.9 18.7 3.9 19.3 4.4 C19.3 11.2 16.8 16.6 12 19.6 C7.2 16.6 4.7 11.2 4.7 4.4 C5.3 3.9 8.4 3.9 12 2.2 Z',
  letterA:
    'M12 5.4 L15.4 14.8 H13.9 L13.0 12.4 H11.0 L10.1 14.8 H8.6 Z M11.4 10.8 H12.6 L12 9.1 Z',
  heartbeat:
    'M5.6 11.2 H8.6 L9.4 11.2 L10.1 8.8 L10.8 13.6 L11.5 11.2 L12.3 11.2 H18.2',
};

/** Minimal SVG string for favicon / web */
export function brandMarkSvg({
  fill = '#14B8A6',
  accent = '#6EE7B7',
  size = 64,
  background = '#050A0F',
} = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" role="img" aria-label="Asset Doctor">
  ${background !== 'transparent' ? `<rect width="24" height="24" rx="5.4" fill="${background}"/>` : ''}
  <path d="${BRAND_MARK_PATHS.shield}" stroke="${fill}" stroke-width="1.4" stroke-linejoin="round" fill="#07111F"/>
  <path d="${BRAND_MARK_PATHS.letterA}" fill="#FFFFFF"/>
  <path d="${BRAND_MARK_PATHS.heartbeat}" stroke="${accent}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="17.4" cy="18.2" r="1.7" fill="${fill}"/>
  <path d="M16.6 18.2 L17.15 18.7 L18.3 17.5" stroke="#050A0F" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round"/>
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

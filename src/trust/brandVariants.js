/**
 * Brand mark variants from the approved shield + A + heartbeat.
 * Does not redesign the core identity — wraps brandMarkSvg only.
 */

import { brandMarkSvg, BRAND_MARK_PATHS, BRAND_WORDMARK } from '../design-system/brandMark.js';

export const BRAND_VARIANT_KEYS = Object.freeze([
  'primary',
  'appIcon',
  'small',
  'monochrome',
  'darkBackground',
  'lightBackground',
  'protectedBadgeMark',
]);

export function brandVariantSvg(variant = 'primary', size) {
  switch (variant) {
    case 'appIcon':
      return brandMarkSvg({ size: size || 512, fill: '#14B8A6', accent: '#6EE7B7', background: '#050A0F' });
    case 'small':
      return brandMarkSvg({ size: size || 24, fill: '#14B8A6', accent: '#6EE7B7', background: 'transparent' });
    case 'monochrome':
      return brandMarkSvg({ size: size || 48, fill: '#07111F', accent: '#07111F', background: 'transparent' });
    case 'darkBackground':
      return brandMarkSvg({ size: size || 64, fill: '#14B8A6', accent: '#6EE7B7', background: '#07111F' });
    case 'lightBackground':
      return brandMarkSvg({ size: size || 64, fill: '#0F766E', accent: '#0D9488', background: 'transparent' });
    case 'protectedBadgeMark':
      return brandMarkSvg({ size: size || 18, fill: '#10B981', accent: '#6EE7B7', background: 'transparent' });
    case 'primary':
    default:
      return brandMarkSvg({ size: size || 64, fill: '#14B8A6', accent: '#6EE7B7', background: '#050A0F' });
  }
}

export { BRAND_MARK_PATHS, BRAND_WORDMARK };

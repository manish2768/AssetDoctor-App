/**
 * Warranty / expiry badge tones — 30-day threshold for warranty.
 */

import { daysUntil } from './dates';
import { COLORS } from '../theme/branding';

export const WARRANTY_TONES = Object.freeze({
  ok: {
    id: 'ok',
    color: '#10B981',
    glow: 'rgba(16,185,129,0.35)',
    label: 'Warranty Active',
  },
  warn: {
    id: 'warn',
    color: '#FF9900',
    glow: 'rgba(255,153,0,0.4)',
    label: 'Expiring Soon',
  },
  expired: {
    id: 'expired',
    color: '#FF3B30',
    glow: 'rgba(255,59,48,0.4)',
    label: 'Warranty Expired',
  },
  none: {
    id: 'none',
    color: COLORS.muted,
    glow: 'rgba(139,150,165,0.2)',
    label: 'No Warranty Date',
  },
});

/**
 * @param {string|null|undefined} warrantyExpiry ISO date
 * @param {{ urgentDays?: number }} [opts]
 */
export function getWarrantyStatus(warrantyExpiry, opts = {}) {
  const urgentDays = opts.urgentDays ?? 30;
  const days = daysUntil(warrantyExpiry);
  if (days == null) return { ...WARRANTY_TONES.none, days: null };
  if (days < 0) return { ...WARRANTY_TONES.expired, days };
  if (days <= urgentDays) return { ...WARRANTY_TONES.warn, days };
  return { ...WARRANTY_TONES.ok, days };
}

/**
 * Generic expiry tone (PUC / insurance / service) — warn within 15 days.
 */
export function getExpiryTone(dateStr, opts = {}) {
  const urgentDays = opts.urgentDays ?? 15;
  const days = daysUntil(dateStr);
  if (days == null) return { id: 'none', color: COLORS.muted, label: 'Not set', days: null };
  if (days < 0) return { id: 'expired', color: '#FF3B30', label: 'Expired', days };
  if (days <= urgentDays) return { id: 'warn', color: '#FF9900', label: `${days}d left`, days };
  return { id: 'ok', color: '#10B981', label: 'Valid', days };
}

export default getWarrantyStatus;

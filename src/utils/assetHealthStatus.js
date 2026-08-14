/**
 * Home-screen asset health — Warranty + Insurance only.
 * Healthy (green) · At Risk (orange, ≤30d) · Critical (red, expired)
 */

import { daysUntil } from './dates';

export const ASSET_HEALTH = Object.freeze({
  HEALTHY: 'healthy',
  AT_RISK: 'at_risk',
  CRITICAL: 'critical',
});

const TONES = Object.freeze({
  [ASSET_HEALTH.HEALTHY]: {
    id: ASSET_HEALTH.HEALTHY,
    label: 'Healthy',
    color: '#059669',
    bg: 'rgba(5,150,105,0.14)',
    border: 'rgba(5,150,105,0.45)',
    bar: '#10B981',
  },
  [ASSET_HEALTH.AT_RISK]: {
    id: ASSET_HEALTH.AT_RISK,
    label: 'At Risk',
    color: '#C2410C',
    bg: 'rgba(234,88,12,0.14)',
    border: 'rgba(234,88,12,0.5)',
    bar: '#F97316',
  },
  [ASSET_HEALTH.CRITICAL]: {
    id: ASSET_HEALTH.CRITICAL,
    label: 'Critical',
    color: '#B91C1C',
    bg: 'rgba(220,38,38,0.14)',
    border: 'rgba(220,38,38,0.55)',
    bar: '#EF4444',
  },
});

/**
 * @param {object} asset
 * @returns {{
 *   id: string,
 *   label: string,
 *   color: string,
 *   bg: string,
 *   border: string,
 *   bar: string,
 *   warrantyDays: number|null,
 *   insuranceDays: number|null,
 *   detail: string,
 * }}
 */
export function getAssetHealthStatus(asset = {}) {
  const warrantyDays = daysUntil(asset.warrantyExpiry);
  const insuranceDays = daysUntil(asset.insuranceExpiry);

  const expired = [];
  if (warrantyDays != null && warrantyDays < 0) expired.push('Warranty');
  if (insuranceDays != null && insuranceDays < 0) expired.push('Insurance');
  if (expired.length) {
    return {
      ...TONES[ASSET_HEALTH.CRITICAL],
      warrantyDays,
      insuranceDays,
      detail: `${expired.join(' & ')} expired`,
    };
  }

  const soon = [];
  if (warrantyDays != null && warrantyDays <= 30) soon.push(`Warranty ${warrantyDays}d`);
  if (insuranceDays != null && insuranceDays <= 30) soon.push(`Insurance ${insuranceDays}d`);
  if (soon.length) {
    return {
      ...TONES[ASSET_HEALTH.AT_RISK],
      warrantyDays,
      insuranceDays,
      detail: soon.join(' · '),
    };
  }

  const bothSet = warrantyDays != null && insuranceDays != null;
  return {
    ...TONES[ASSET_HEALTH.HEALTHY],
    warrantyDays,
    insuranceDays,
    detail: bothSet ? 'Warranty & Insurance valid' : 'No critical expiry flags',
  };
}

export default getAssetHealthStatus;

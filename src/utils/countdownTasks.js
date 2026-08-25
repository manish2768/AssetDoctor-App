/**
 * Smart Renewal Countdown — build daily action tasks for Home widget
 */

import { daysUntil } from './dates';
import { isAlertableStatus } from '../constants/assetStatus';

const FIELD_META = {
  insuranceExpiry: { label: 'Insurance Expiry', emoji: '🛡️', action: 'Renew insurance' },
  pucExpiry: { label: 'PUC Expiry', emoji: '🌿', action: 'Renew PUC' },
  warrantyExpiry: { label: 'Warranty Expiry', emoji: '✅', action: 'Check warranty' },
  nextServiceDue: { label: 'Service Due', emoji: '🔧', action: 'Book service' },
};

/**
 * @typedef {'critical'|'warn'|'ok'} CountdownTone
 * @typedef {{
 *  id: string,
 *  tone: CountdownTone,
 *  emoji: string,
 *  title: string,
 *  subtitle: string,
 *  detail: string,
 *  days: number|null,
 *  kmRemaining: number|null,
 *  sortKey: number,
 *  assetId: string|null,
 *  kind: 'expiry'|'service_km'|'service_date',
 * }} CountdownTask
 */

export function toneForDays(days) {
  if (days == null) return 'ok';
  if (days < 0 || days <= 3) return 'critical';
  if (days <= 15) return 'warn';
  return 'ok';
}

export function toneForKm(km) {
  if (km == null) return 'ok';
  if (km <= 0 || km <= 50) return 'critical';
  if (km <= 200) return 'warn';
  return 'ok';
}

function toneRank(tone) {
  if (tone === 'critical') return 0;
  if (tone === 'warn') return 1;
  return 2;
}

function formatDaysLeft(days) {
  if (days == null) return '';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  return `${days} Day${days === 1 ? '' : 's'} Left`;
}

/**
 * Build countdown tasks from household and vehicle assets.
 * @param {object[]} assets
 * @param {{ withinDays?: number, maxItems?: number }} [opts]
 * @returns {CountdownTask[]}
 */
export function buildCountdownTasks(assets = [], opts = {}) {
  const withinDays = opts.withinDays ?? 45;
  const maxItems = opts.maxItems ?? 8;
  /** @type {CountdownTask[]} */
  const tasks = [];

  for (const asset of assets) {
    if (!isAlertableStatus(asset.status) || asset.deletedAt) continue;
    const name = asset.assetName || 'Asset';
    const assetId = asset.assetId || asset.id || null;

    for (const key of Object.keys(FIELD_META)) {
      const dateStr = asset[key];
      if (!dateStr) continue;
      const days = daysUntil(dateStr);
      if (days === null) continue;
      if (days > withinDays) continue;
      const meta = FIELD_META[key];
      const tone = toneForDays(days);
      tasks.push({
        id: `${assetId}-${key}`,
        tone,
        emoji: meta.emoji,
        title: `${name} ${meta.label}`,
        subtitle: formatDaysLeft(days),
        detail: meta.action,
        days,
        kmRemaining: null,
        sortKey: days < 0 ? days : days,
        assetId,
        kind: key === 'nextServiceDue' ? 'service_date' : 'expiry',
      });
    }

    // KM-based service countdown (vehicles)
    const odo = Number(asset.odometerKm);
    const nextKm =
      Number(asset.nextServiceOdometerKm) ||
      (Number(asset.lastServiceOdometerKm) && Number(asset.serviceIntervalKm)
        ? Number(asset.lastServiceOdometerKm) + Number(asset.serviceIntervalKm)
        : null);
    if (Number.isFinite(odo) && Number.isFinite(nextKm)) {
      const kmRemaining = Math.round(nextKm - odo);
      // Only show when within 500 km or overdue
      if (kmRemaining <= 500) {
        const tone = toneForKm(kmRemaining);
        tasks.push({
          id: `${assetId}-service-km`,
          tone,
          emoji: '🚗',
          title: `${name} Service Due`,
          subtitle:
            kmRemaining <= 0
              ? `${Math.abs(kmRemaining)} KM overdue`
              : `${kmRemaining} KM remaining`,
          detail: 'Book service before overdue',
          days: null,
          kmRemaining,
          sortKey: kmRemaining <= 0 ? -1000 + kmRemaining : kmRemaining / 10,
          assetId,
          kind: 'service_km',
        });
      }
    }
  }

  // Dedupe by id, sort critical first then soonest
  const seen = new Set();
  return tasks
    .filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    })
    .sort((a, b) => {
      const tr = toneRank(a.tone) - toneRank(b.tone);
      if (tr !== 0) return tr;
      return a.sortKey - b.sortKey;
    })
    .slice(0, maxItems);
}

export default buildCountdownTasks;

/**
 * STEP 10 lifecycle stages — deterministic from real asset + expense data.
 * Extends earlier LIFECYCLE_STATUS with analytics-oriented stages.
 */

import { calculateAssetAge } from './valuationEngine';
import { buildAssetTimeline } from '../assets/assetTimeline';
import { summarizeRepairFrequency } from './ownershipCostEngine';

export const LIFECYCLE_STATUS = Object.freeze({
  NEW: 'NEW',
  ACTIVE: 'ACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  AGING: 'AGING',
  HIGH_MAINTENANCE: 'HIGH_MAINTENANCE',
  END_OF_LIFE: 'END_OF_LIFE',
  SOLD: 'SOLD',
  DISPOSED: 'DISPOSED',
  ARCHIVED: 'ARCHIVED',
  // legacy aliases kept for older callers
  PURCHASED: 'NEW',
  INSTALLED: 'ACTIVE',
  UNDER_SERVICE: 'MAINTENANCE',
  UNDER_REPAIR: 'MAINTENANCE',
  TRANSFERRED: 'ACTIVE',
});

export const REPLACEMENT_FLAG = Object.freeze({
  NORMAL: 'NORMAL',
  WATCH: 'WATCH',
  REVIEW_REPLACEMENT: 'REVIEW_REPLACEMENT',
});

/**
 * Documented thresholds (configurable via opts):
 * - NEW: age < 90 days
 * - AGING: age years >= agingYears (default 5)
 * - HIGH_MAINTENANCE: repairs in 12 months >= highRepairCount (default 4)
 *   OR repair+service last 12m >= highCostShare * purchase (default 0.35)
 * - END_OF_LIFE: sold/retired/deleted OR age >= endYears (default 10) with low health
 */
export function resolveLifecycleStatus(asset = {}, opts = {}) {
  const status = String(asset.status || '').toLowerCase();
  if (status === 'sold') return LIFECYCLE_STATUS.SOLD;
  if (status === 'retired' || asset.deletedAt) return LIFECYCLE_STATUS.ARCHIVED;
  if (status === 'disposed') return LIFECYCLE_STATUS.DISPOSED;

  const age = calculateAssetAge(asset);
  const agingYears = Number(opts.agingYears) || 5;
  const endYears = Number(opts.endYears) || 10;
  const highRepairCount = Number(opts.highRepairCount) || 4;
  const expenseRows = opts.expenseRows || [];
  const freq = summarizeRepairFrequency(expenseRows);
  const health = Number(asset.assetHealthScore ?? asset.healthScore);

  if (status === 'in_repair') return LIFECYCLE_STATUS.MAINTENANCE;

  // Overdue service → MAINTENANCE (deterministic from nextServiceDue)
  if (asset.nextServiceDue) {
    const due = new Date(`${String(asset.nextServiceDue).slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) {
      return LIFECYCLE_STATUS.MAINTENANCE;
    }
  }

  const repairish = expenseRows.filter((r) =>
    /repair|spare|labour|labor/i.test(String(r.category || r.title || '')),
  );
  const last12 = repairish.filter((r) => {
    const d = String(r.repairDate || r.date || '').slice(0, 10);
    if (!d) return false;
    const days = (Date.now() - new Date(`${d}T12:00:00`).getTime()) / 86400000;
    return days <= 365;
  });

  if (last12.length >= highRepairCount || (freq.numberOfRepairs || 0) >= highRepairCount) {
    return LIFECYCLE_STATUS.HIGH_MAINTENANCE;
  }

  if (age.available && age.years >= endYears && (Number.isFinite(health) ? health < 50 : true)) {
    return LIFECYCLE_STATUS.END_OF_LIFE;
  }

  if (age.available && age.years >= agingYears) return LIFECYCLE_STATUS.AGING;

  if (age.available && age.days != null && age.days < 90) return LIFECYCLE_STATUS.NEW;

  if (status === 'in_repair' || asset.nextServiceDue) {
    /* fall through */
  }

  return LIFECYCLE_STATUS.ACTIVE;
}

export function resolveReplacementFlag(asset = {}, analytics = {}, opts = {}) {
  let score = 0;
  const health = Number(asset.assetHealthScore ?? asset.healthScore);
  const ageYears = analytics?.age?.years;
  const repairs12 = analytics?.repairFrequency?.last12Months ?? 0;
  const monthly = analytics?.period?.costPerMonth;
  const advice = analytics?.repairVsReplace?.advice;

  if (Number.isFinite(health) && health < 40) score += 2;
  else if (Number.isFinite(health) && health < 60) score += 1;

  if (Number.isFinite(ageYears) && ageYears >= 8) score += 2;
  else if (Number.isFinite(ageYears) && ageYears >= 5) score += 1;

  if (repairs12 >= 4) score += 2;
  else if (repairs12 >= 2) score += 1;

  if (Number.isFinite(monthly) && monthly > 5000) score += 1;

  if (advice === 'COMPARE_REPLACEMENT') score += 2;

  if (score >= 5) return REPLACEMENT_FLAG.REVIEW_REPLACEMENT;
  if (score >= 3) return REPLACEMENT_FLAG.WATCH;
  return REPLACEMENT_FLAG.NORMAL;
}

export function buildLifecycleReport(asset = {}, opts = {}) {
  const age = calculateAssetAge(asset);
  const status = resolveLifecycleStatus(asset, opts);
  const events = buildAssetTimeline(asset, {
    services: opts.services || [],
    locationHistory: opts.locationHistory || [],
    documents: opts.documents || [],
  });

  if (asset.purchaseDate && !events.some((e) => e.type === 'purchase')) {
    events.push({
      id: `purchase_${asset.assetId}`,
      type: 'purchase',
      date: asset.purchaseDate,
      title: 'Purchased',
      amount: Number(asset.purchasePrice ?? asset.value) || 0,
    });
  }

  return {
    status,
    age,
    replacementFlag: resolveReplacementFlag(asset, opts.analytics || {}, opts),
    stages: [
      { key: 'NEW', done: status !== LIFECYCLE_STATUS.NEW || Boolean(asset.purchaseDate) },
      { key: 'ACTIVE', done: true },
      { key: 'MAINTENANCE', done: (opts.expenseRows || []).length > 0 },
      { key: 'AGING', done: ['AGING', 'HIGH_MAINTENANCE', 'END_OF_LIFE'].includes(status) },
      { key: 'END_OF_LIFE', done: status === LIFECYCLE_STATUS.END_OF_LIFE },
      {
        key: 'SOLD_OR_ARCHIVED',
        done: [LIFECYCLE_STATUS.SOLD, LIFECYCLE_STATUS.ARCHIVED, LIFECYCLE_STATUS.DISPOSED].includes(
          status,
        ),
      },
    ],
    events: events.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
  };
}

export default {
  LIFECYCLE_STATUS,
  REPLACEMENT_FLAG,
  resolveLifecycleStatus,
  resolveReplacementFlag,
  buildLifecycleReport,
};

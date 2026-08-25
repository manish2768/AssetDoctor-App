/**
 * Service due engine — time and/or odometer. Intervals labeled Recommended.
 */

import { daysUntil } from '../../utils/dates';
import { RECOMMENDED_SERVICE_INTERVAL_DAYS } from './healthScoreConfig';

export const SERVICE_STATUS = Object.freeze({
  SERVICE_OVERDUE: 'SERVICE_OVERDUE',
  SERVICE_DUE: 'SERVICE_DUE',
  SERVICE_UPCOMING: 'SERVICE_UPCOMING',
  SERVICE_OK: 'SERVICE_OK',
  UNKNOWN: 'unknown',
});

function recommendedIntervalDays(asset = {}) {
  const id = String(asset.categoryId || '').toLowerCase();
  if (asset.recommendedServiceIntervalDays) {
    return Number(asset.recommendedServiceIntervalDays) || RECOMMENDED_SERVICE_INTERVAL_DAYS.default;
  }
  return RECOMMENDED_SERVICE_INTERVAL_DAYS[id] || RECOMMENDED_SERVICE_INTERVAL_DAYS.default;
}

function addDaysIso(iso, days) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * @returns {{
 *   status: string,
 *   nextServiceDate: string|null,
 *   recommended: boolean,
 *   daysRemaining: number|null,
 *   kmRemaining: number|null,
 *   message: string,
 *   source: string
 * }}
 */
export function evaluateServiceDue(asset = {}, opts = {}) {
  const now = opts.now || new Date();
  const odometer = asset.odometerKm != null ? Number(asset.odometerKm) : null;
  const nextKm =
    asset.nextServiceOdometerKm != null ? Number(asset.nextServiceOdometerKm) : null;

  let nextDate = asset.nextServiceDate || asset.nextServiceDue || null;
  let recommended = false;
  let source = 'user_schedule';

  if (!nextDate && asset.lastServiceDate) {
    const interval = recommendedIntervalDays(asset);
    nextDate = addDaysIso(asset.lastServiceDate, interval);
    recommended = true;
    source = 'recommended_interval';
  }

  const days =
    nextDate != null
      ? (() => {
          // daysUntil uses today; for tests allow override via opts.now by comparing manually
          if (opts.now) {
            const target = new Date(`${String(nextDate).slice(0, 10)}T12:00:00`);
            const base = new Date(now);
            base.setHours(12, 0, 0, 0);
            return Math.round((target - base) / 86400000);
          }
          return daysUntil(nextDate);
        })()
      : null;

  const kmRemaining =
    odometer != null && nextKm != null && Number.isFinite(odometer) && Number.isFinite(nextKm)
      ? Math.round(nextKm - odometer)
      : null;

  // Whichever condition occurs first
  let status = SERVICE_STATUS.UNKNOWN;
  let message = 'Service schedule not set';

  const dateOverdue = days != null && days < 0;
  const kmOverdue = kmRemaining != null && kmRemaining <= 0;
  const dateDueSoon = days != null && days >= 0 && days <= 7;
  const kmDueSoon = kmRemaining != null && kmRemaining > 0 && kmRemaining <= 200;
  const dateUpcoming = days != null && days > 7 && days <= 30;
  const kmUpcoming = kmRemaining != null && kmRemaining > 200 && kmRemaining <= 700;

  if (dateOverdue || kmOverdue) {
    status = SERVICE_STATUS.SERVICE_OVERDUE;
    if (dateOverdue && kmOverdue) {
      message = 'Service is overdue (date and odometer).';
    } else if (kmOverdue) {
      message = 'Service is overdue based on odometer.';
    } else {
      message = 'Service is overdue.';
    }
  } else if (dateDueSoon || kmDueSoon) {
    status = SERVICE_STATUS.SERVICE_DUE;
    if (kmDueSoon && (days == null || days > 7)) {
      message = `Service due in approximately ${kmRemaining} km.`;
    } else if (days === 0) {
      message = 'Service is due today.';
    } else {
      message = `Service is due in ${days} day(s).`;
    }
  } else if (dateUpcoming || kmUpcoming) {
    status = SERVICE_STATUS.SERVICE_UPCOMING;
    if (recommended) {
      message =
        days != null
          ? `Recommended service in ${days} day(s).`
          : `Recommended service in approximately ${kmRemaining} km.`;
    } else if (kmUpcoming && (days == null || days > 30)) {
      message = `Service upcoming in approximately ${kmRemaining} km.`;
    } else {
      message = `Service upcoming in ${days} day(s).`;
    }
  } else if (days != null || kmRemaining != null) {
    status = SERVICE_STATUS.SERVICE_OK;
    message = recommended
      ? 'Within recommended service window.'
      : 'Service schedule looks healthy.';
  }

  return {
    status,
    nextServiceDate: nextDate,
    recommended,
    daysRemaining: days,
    kmRemaining,
    message,
    source,
    intervalDays: recommendedIntervalDays(asset),
  };
}

export default { SERVICE_STATUS, evaluateServiceDue };

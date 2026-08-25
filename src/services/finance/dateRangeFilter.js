/**
 * Deterministic date-range filter for analytics expense/service rows.
 * Ranges: this_month | last_3_months | last_6_months | this_year | last_year | all | custom
 */

export const ANALYTICS_DATE_RANGES = Object.freeze({
  THIS_MONTH: 'this_month',
  LAST_3_MONTHS: 'last_3_months',
  LAST_6_MONTHS: 'last_6_months',
  THIS_YEAR: 'this_year',
  LAST_YEAR: 'last_year',
  ALL: 'all',
  CUSTOM: 'custom',
});

export function resolveDateRangeBounds(rangeKey, now = new Date(), custom = {}) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (rangeKey) {
    case ANALYTICS_DATE_RANGES.THIS_MONTH:
      start.setDate(1);
      break;
    case ANALYTICS_DATE_RANGES.LAST_3_MONTHS:
      start.setMonth(start.getMonth() - 3);
      break;
    case ANALYTICS_DATE_RANGES.LAST_6_MONTHS:
      start.setMonth(start.getMonth() - 6);
      break;
    case ANALYTICS_DATE_RANGES.THIS_YEAR:
      start.setMonth(0, 1);
      break;
    case ANALYTICS_DATE_RANGES.LAST_YEAR:
      start.setFullYear(start.getFullYear() - 1, 0, 1);
      end.setFullYear(end.getFullYear() - 1, 11, 31);
      break;
    case ANALYTICS_DATE_RANGES.CUSTOM: {
      const cs = custom.startDate
        ? new Date(`${String(custom.startDate).slice(0, 10)}T00:00:00`)
        : null;
      const ce = custom.endDate
        ? new Date(`${String(custom.endDate).slice(0, 10)}T23:59:59`)
        : null;
      return {
        start: cs && !Number.isNaN(cs.getTime()) ? cs : null,
        end: ce && !Number.isNaN(ce.getTime()) ? ce : end,
        label: 'Custom Range',
      };
    }
    case ANALYTICS_DATE_RANGES.ALL:
    default:
      return { start: null, end: null, label: 'All Time' };
  }

  const labels = {
    [ANALYTICS_DATE_RANGES.THIS_MONTH]: 'This Month',
    [ANALYTICS_DATE_RANGES.LAST_3_MONTHS]: 'Last 3 Months',
    [ANALYTICS_DATE_RANGES.LAST_6_MONTHS]: 'Last 6 Months',
    [ANALYTICS_DATE_RANGES.THIS_YEAR]: 'This Year',
    [ANALYTICS_DATE_RANGES.LAST_YEAR]: 'Last Year',
  };
  return { start, end, label: labels[rangeKey] || 'All Time' };
}

export function filterRowsByDateRange(rows = [], rangeKey = 'all', now = new Date(), custom = {}) {
  const bounds = resolveDateRangeBounds(rangeKey, now, custom);
  if (!bounds.start && !bounds.end) {
    return { rows: rows || [], bounds, filtered: false };
  }
  const filtered = (rows || []).filter((row) => {
    const raw = String(row.repairDate || row.serviceDate || row.date || '').slice(0, 10);
    if (!raw) return false;
    const t = new Date(`${raw}T12:00:00`).getTime();
    if (Number.isNaN(t)) return false;
    if (bounds.start && t < bounds.start.getTime()) return false;
    if (bounds.end && t > bounds.end.getTime()) return false;
    return true;
  });
  return { rows: filtered, bounds, filtered: true };
}

/**
 * Monthly cost series for charts. monthsBack: 3 | 6 | 12 | null(all from data).
 */
export function buildMonthlyCostSeries(expenseRows = [], monthsBack = 12, now = new Date()) {
  const buckets = {};
  for (const row of expenseRows || []) {
    const key = String(row.repairDate || row.serviceDate || row.date || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    const amount = Number(row.costInr ?? row.totalAmount ?? row.cost) || 0;
    if (!(amount > 0)) continue;
    if (!buckets[key]) buckets[key] = { month: key, service: 0, repair: 0, other: 0 };
    const cat = String(row.category || row.serviceType || '').toLowerCase();
    if (/repair|spare|labour|labor/.test(cat)) buckets[key].repair += amount;
    else if (/service|amc|periodic|maintenance/.test(cat)) buckets[key].service += amount;
    else buckets[key].other += amount;
  }

  let keys = Object.keys(buckets).sort();
  if (monthsBack != null && monthsBack > 0) {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - (monthsBack - 1));
    cutoff.setDate(1);
    const cutKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
    keys = keys.filter((k) => k >= cutKey);
  }

  return keys.map((k) => {
    const r = buckets[k];
    const service = Math.round(r.service);
    const repair = Math.round(r.repair);
    const other = Math.round(r.other);
    return {
      month: k,
      service,
      repair,
      other,
      total: service + repair + other,
      source: 'Actual Recorded',
    };
  });
}

export default {
  ANALYTICS_DATE_RANGES,
  resolveDateRangeBounds,
  filterRowsByDateRange,
  buildMonthlyCostSeries,
};

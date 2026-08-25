/**
 * Health score history + trend detection (pure + optional persistence helper).
 */

export const HEALTH_TREND = Object.freeze({
  IMPROVING: 'HEALTH_IMPROVING',
  STABLE: 'HEALTH_STABLE',
  DECLINING: 'HEALTH_DECLINING',
  RAPID_DECLINE: 'RAPID_DECLINE',
});

/**
 * @param {Array<{ score: number, at?: string }>} history newest last or first — we sort by at
 */
export function detectHealthTrend(history = [], opts = {}) {
  const rapidDrop = opts.rapidDrop ?? 10;
  const window = opts.window ?? 3;
  const rows = [...(history || [])]
    .filter((h) => h && Number.isFinite(Number(h.score)))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));

  if (rows.length < 2) {
    return { trend: HEALTH_TREND.STABLE, label: 'Stable', delta: 0, message: null };
  }

  const recent = rows.slice(-window);
  const first = Number(recent[0].score);
  const last = Number(recent[recent.length - 1].score);
  const delta = Math.round(last - first);

  if (delta <= -rapidDrop) {
    return {
      trend: HEALTH_TREND.RAPID_DECLINE,
      label: 'Declining',
      delta,
      message: 'Health has dropped significantly in the recent period.',
    };
  }
  if (delta <= -3) {
    return {
      trend: HEALTH_TREND.DECLINING,
      label: 'Declining',
      delta,
      message: 'Health score is trending down.',
    };
  }
  if (delta >= 3) {
    return {
      trend: HEALTH_TREND.IMPROVING,
      label: 'Improving',
      delta,
      message: 'Health score is improving.',
    };
  }
  return { trend: HEALTH_TREND.STABLE, label: 'Stable', delta, message: null };
}

/**
 * Append a monthly snapshot (dedupe same YYYY-MM).
 */
export function appendHealthHistory(existing = [], score, at = new Date().toISOString()) {
  const month = String(at).slice(0, 7);
  const next = (existing || []).filter((h) => String(h.at || '').slice(0, 7) !== month);
  next.push({ score: Math.round(Number(score) || 0), at });
  return next.slice(-24);
}

export default {
  HEALTH_TREND,
  detectHealthTrend,
  appendHealthHistory,
};

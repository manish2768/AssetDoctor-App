/**
 * Home / daily summary — progressive disclosure helpers.
 */

import { computeAssetHealth, computePortfolioHealth } from './computeAssetHealth';
import { buildPortfolioInsights } from './insightsRulesEngine';
import { detectHealthTrend } from './healthHistory';

/**
 * "What should I do today?" prioritized actions.
 */

/** True only when vault has a measured battery % (not estimated, not 0/empty). */
function hasMeasuredBatteryHealth(asset = {}) {
  const bp = asset.batteryProfile || {};
  if (bp.isEstimated || bp.isEstimate) return false;
  const raw =
    bp.healthPercent != null
      ? bp.healthPercent
      : asset.batteryHealthPercent != null
        ? asset.batteryHealthPercent
        : null;
  if (raw == null || raw === '') return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 100;
}

function isUnverifiedBatteryInsight(row = {}, assetsById = null) {
  const blob = `${row.type || ''} ${row.category || ''} ${row.title || ''} ${row.message || ''} ${row.reason || ''}`.toLowerCase();
  if (!/battery/.test(blob)) return false;
  if (/estimated|unavailable|not yet|is 0%|\b0%|data unavailable/.test(blob)) return true;
  const id = row.assetId || row.assetID;
  if (assetsById && id && assetsById.has(id)) {
    return !hasMeasuredBatteryHealth(assetsById.get(id));
  }
  return false;
}

export function buildTodaysAssetActions(assets = [], opts = {}) {
  const list = assets || [];
  const byId = new Map(
    list
      .filter((a) => a && (a.assetId || a.id))
      .map((a) => [a.assetId || a.id, a]),
  );
  const insights = buildPortfolioInsights(list, opts);
  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return insights
    .filter((i) => i.priority === 'CRITICAL' || i.priority === 'HIGH' || i.priority === 'MEDIUM')
    .filter((i) => !isUnverifiedBatteryInsight(i, byId))
    .sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9))
    .slice(0, opts.maxItems ?? 4)
    .map((i, idx) => ({
      rank: idx + 1,
      title: i.title,
      message: i.message,
      priority: i.priority,
      assetId: i.assetId,
      category: i.category,
      alertId: i.alertId,
    }));
}

export function buildHouseholdHealthOverview(assets = []) {
  const portfolio = computePortfolioHealth(assets);
  return {
    totalAssets: portfolio.count,
    healthyAssets: portfolio.healthy,
    needsAttention: portfolio.needsAttention,
    criticalAssets: portfolio.critical,
    portfolioScore: portfolio.score,
    band: portfolio.band,
  };
}

export function buildAssetSmartSummary(asset = {}) {
  const health = computeAssetHealth(asset);
  const trend = detectHealthTrend(asset.healthHistory || []);
  return {
    name: asset.nickname || asset.assetName || 'Asset',
    healthScore: health.score,
    band: health.band,
    status: health.band,
    why: health.why,
    breakdown: health.breakdown,
    trend: trend.label,
    nextAction: health.service?.message || health.why[0] || 'No urgent action',
    energy:
      asset.energyProfile?.estimatedMonthlyConsumptionKwh != null
        ? `~${asset.energyProfile.estimatedMonthlyConsumptionKwh} kWh/month`
        : null,
    warranty: asset.warrantyExpiry || null,
    lastService: asset.lastServiceDate || null,
    totalCost: asset.tco ?? asset.totalOwnershipCost ?? null,
    locationPath: asset.locationPath || '',
  };
}

/**
 * Soft daily summary copy — only meaningful items.
 */
export function buildDailySummary(assets = [], opts = {}) {
  const overview = buildHouseholdHealthOverview(assets);
  const actions = buildTodaysAssetActions(assets, { maxItems: 3, ...opts });
  const attention = overview.needsAttention + overview.criticalAssets;
  const lines = [];
  if (attention > 0) {
    lines.push(`${attention} asset${attention === 1 ? '' : 's'} need attention.`);
  }
  for (const a of actions.slice(0, 3)) {
    lines.push(a.title);
  }
  return {
    greeting: opts.greeting || 'Good morning.',
    attentionCount: attention,
    lines,
    actions,
    overview,
  };
}

/**
 * Today's Asset Pulse — one real insight or calm "all caught up". Never invents.
 * Presentation helper only; reuses existing health/insights engines.
 */
export function buildTodaysAssetPulse(assets = [], opts = {}) {
  const overview = buildHouseholdHealthOverview(assets);
  const actions = buildTodaysAssetActions(assets, { maxItems: 1, ...opts });
  const top = actions[0] || null;
  if (!overview.totalAssets) {
    return {
      kind: 'empty',
      title: 'Your vault is ready',
      message: "Scan a bill or RC to unlock today's asset pulse.",
      action: null,
      calm: true,
    };
  }
  if (top) {
    return {
      kind: 'insight',
      title: top.title,
      message: top.message,
      action: top,
      calm: false,
    };
  }
  return {
    kind: 'calm',
    title: "You're all caught up",
    message: 'No urgent warranty, service, or document alerts for today.',
    action: null,
    calm: true,
  };
}

/**
 * Aggregate portfolio orbit factor ratios from real per-asset health breakdowns.
 */
export function buildOrbitFactors(assets = []) {
  const active = (assets || []).filter((a) => a && !a.deletedAt);
  const keys = [
    { key: 'maintenance', label: 'Maint.', aliases: ['maintenance'] },
    { key: 'warranty', label: 'Warranty', aliases: ['warranty', 'insurance'] },
    { key: 'documents', label: 'Docs', aliases: ['documents'] },
    { key: 'condition', label: 'Condition', aliases: ['age', 'battery', 'energy'] },
  ];
  if (!active.length) {
    return keys.map((k) => ({ key: k.key, label: k.label, ratio: 1 }));
  }
  const rows = active.map((a) => computeAssetHealth(a));
  return keys.map(({ key, label, aliases }) => {
    let earned = 0;
    let max = 0;
    for (const r of rows) {
      for (const alias of aliases) {
        const b = r.breakdown?.[alias];
        if (b && b.max > 0) {
          earned += Number(b.earned) || 0;
          max += Number(b.max) || 0;
        }
      }
    }
    const ratio = max > 0 ? earned / max : 1;
    return { key, label, ratio: Math.max(0, Math.min(1, ratio)) };
  });
}

/**
 * Home hero breakdown chips — Documents / Warranty / Insurance / Service / Maintenance.
 * Only includes factors that actually exist on assets (never invents).
 */
export function buildHomeHeroBreakdown(assets = []) {
  const active = (assets || []).filter((a) => a && !a.deletedAt);
  const defs = [
    { key: 'documents', label: 'Documents', aliases: ['documents'] },
    { key: 'warranty', label: 'Warranty', aliases: ['warranty'] },
    { key: 'insurance', label: 'Insurance', aliases: ['insurance'] },
    { key: 'service', label: 'Service', aliases: ['maintenance'] },
    { key: 'maintenance', label: 'Maintenance', aliases: ['maintenance', 'age'] },
  ];
  if (!active.length) return [];
  const rows = active.map((a) => computeAssetHealth(a));
  const chips = [];
  for (const def of defs) {
    let earned = 0;
    let max = 0;
    for (const r of rows) {
      for (const alias of def.aliases) {
        const b = r.breakdown?.[alias];
        if (b && b.max > 0) {
          earned += Number(b.earned) || 0;
          max += Number(b.max) || 0;
        }
      }
    }
    if (max <= 0) continue;
    const ratio = Math.max(0, Math.min(1, earned / max));
    chips.push({
      key: def.key,
      label: def.label,
      ratio,
      percent: Math.round(ratio * 100),
    });
  }
  // Avoid duplicate Service + Maintenance when both only use the same bucket
  const svc = chips.find((c) => c.key === 'service');
  const maint = chips.find((c) => c.key === 'maintenance');
  if (svc && maint && svc.percent === maint.percent && chips.length > 4) {
    return chips.filter((c) => c.key !== 'maintenance').slice(0, 5);
  }
  return chips.slice(0, 5);
}

/**
 * One useful insight from real vault data — never invents.
 */
export function buildSmartHomeInsight(assets = []) {
  const active = (assets || []).filter((a) => a && !a.deletedAt);
  if (!active.length) return null;

  // Prefer a real HIGH/CRITICAL insight
  const actions = buildTodaysAssetActions(active, { maxItems: 1 });
  if (actions[0]) {
    return {
      title: 'Smart insight',
      message: actions[0].message || actions[0].title,
      assetId: actions[0].assetId || null,
    };
  }

  // Recently updated asset with a service-like doc / next service blank
  const withServiceGap = active.find(
    (a) =>
      (a.nextServiceDue == null || a.nextServiceDue === '') &&
      (a.lastServiceDate ||
        (Array.isArray(a.documents) &&
          a.documents.some((d) => /service/i.test(String(d?.type || d?.documentType || ''))))),
  );
  if (withServiceGap) {
    const name =
      withServiceGap.nickname ||
      withServiceGap.assetName ||
      'This asset';
    return {
      title: 'Smart insight',
      message: `${name} has service history on file. Keep the next service date updated so reminders stay accurate.`,
      assetId: withServiceGap.assetId || withServiceGap.id || null,
    };
  }

  const missingWarranty = active.find((a) => !a.warrantyExpiry);
  if (missingWarranty) {
    const name = missingWarranty.nickname || missingWarranty.assetName || 'An asset';
    return {
      title: 'Smart insight',
      message: `${name} has no warranty expiry on file. Scan the warranty card or bill so Asset Doctor can track it.`,
      assetId: missingWarranty.assetId || missingWarranty.id || null,
    };
  }

  // Never invent generic copy — only surface insights grounded in real vault signals.
  return null;
}

/**
 * Collect real WHY lines across the portfolio (deduped).
 */
export function buildPortfolioWhyFactors(assets = [], max = 5) {
  const active = (assets || []).filter((a) => a && !a.deletedAt);
  const reasons = [];
  for (const a of active.slice(0, 40)) {
    const health = computeAssetHealth(a);
    for (const line of health.why || []) {
      if (line && !reasons.includes(line)) reasons.push(line);
      if (reasons.length >= max) return reasons;
    }
  }
  return reasons;
}

export default {
  buildTodaysAssetActions,
  buildHouseholdHealthOverview,
  buildAssetSmartSummary,
  buildDailySummary,
  buildTodaysAssetPulse,
  buildOrbitFactors,
  buildHomeHeroBreakdown,
  buildSmartHomeInsight,
  buildPortfolioWhyFactors,
};

/**
 * Smart alerts — prioritized WHAT / WHY / WHAT SHOULD I DO.
 * Dedupes by type; never invents expiry or battery signals.
 */

import { formatWhatWhyDo } from './types';
import { evaluateBrainSignals } from './brainRules';
import { buildAssetContext } from './AssetContext';

const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * Build smart alerts for one asset from brain signals + optional claim missing list.
 */
export function buildSmartAlertsForAsset(asset = {}, bundle = {}, opts = {}) {
  const ctx = buildAssetContext(asset, bundle);
  const brain = evaluateBrainSignals(ctx, asset, opts);
  const alerts = brain.map((row) => {
    const tri = row.supportingData || formatWhatWhyDo({
      what: row.title,
      why: row.reason,
      whatShouldIDo: row.action,
      priority: row.priority,
    });
    return {
      alertId: row.id || `alert_${ctx.assetId}_${row.key}`,
      assetId: ctx.assetId,
      type: row.type,
      priority: row.priority || 'MEDIUM',
      what: tri.what || row.title,
      why: tri.why || row.reason,
      whatShouldIDo: tri.whatShouldIDo || row.action,
      title: row.title,
      message: row.description,
    };
  });

  if (Array.isArray(opts.claimMissing) && opts.claimMissing.length) {
    alerts.push({
      alertId: `alert_${ctx.assetId}_claim_docs`,
      assetId: ctx.assetId,
      type: 'DOCUMENT',
      priority: 'MEDIUM',
      ...formatWhatWhyDo({
        what: 'Warranty claim pack is incomplete',
        why: `Missing: ${opts.claimMissing.slice(0, 4).join(', ')}`,
        whatShouldIDo: 'Add the missing documents before starting a claim.',
        priority: 'MEDIUM',
      }),
    });
  }

  alerts.sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
  );
  return alerts.slice(0, opts.maxAlerts ?? 8);
}

/**
 * Portfolio alerts — flatten + cap spam across assets.
 */
export function buildSmartAlertsForPortfolio(assets = [], bundlesById = {}, opts = {}) {
  const all = [];
  for (const asset of assets || []) {
    if (!asset || asset.deletedAt) continue;
    const id = asset.assetId || asset.id;
    all.push(...buildSmartAlertsForAsset(asset, bundlesById[id] || {}, opts));
  }
  all.sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9),
  );
  // Spam guard: max 2 HIGH per asset, max 20 total
  const perAssetHigh = new Map();
  const filtered = [];
  for (const a of all) {
    if (a.priority === 'HIGH') {
      const n = perAssetHigh.get(a.assetId) || 0;
      if (n >= 2) continue;
      perAssetHigh.set(a.assetId, n + 1);
    }
    filtered.push(a);
    if (filtered.length >= (opts.maxPortfolioAlerts ?? 20)) break;
  }
  return filtered;
}

export default {
  buildSmartAlertsForAsset,
  buildSmartAlertsForPortfolio,
};

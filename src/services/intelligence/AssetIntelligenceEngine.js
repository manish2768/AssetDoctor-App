/**
 * AssetIntelligenceEngine — Phase D Asset Brain composition.
 * Recommendations from real signals only; capability-aware health; twin/claim/energy/alerts.
 */

import { buildAssetContext, assertAssetScoped } from './AssetContext';
import { createInsight, createRecommendation, fromLegacyInsight } from './insightModel';
import {
  runRecommendationRules,
  registerRecommendationRule,
  listRecommendationRules,
  NullArchitectureRule,
  clearRecommendationRules,
} from './RecommendationRuleRegistry';
import {
  intelligenceCacheKey,
  getCachedIntelligence,
  setCachedIntelligence,
  invalidateIntelligenceCache,
  intelligenceFingerprint,
} from './intelligenceCache';
import { analyzeRepairVsReplace } from './RepairReplaceAnalyzer';
import { buildWarrantyClaimPack } from './WarrantyClaimPackService';
import { buildEnergyProfile, calculateEnergyEstimate } from './EnergyCalculationService';
import { estimateForAsset, aggregateHomeEnergy } from './HomeEnergyService';
import { SignalBrainRule } from './brainRules';
import { computeExplainableHealth } from './explainableHealth';
import { buildSmartAlertsForAsset } from './smartAlertBuilder';
import {
  buildDigitalTwinTree,
  attachAssetsToTwinTree,
  buildAssetTwinIdentity,
} from './digitalTwinModel';
import { resolveAssetCapabilities } from '../assets/assetCapabilities';

let bootstrapped = false;

function ensureBootstrap() {
  if (bootstrapped) return;
  clearRecommendationRules();
  registerRecommendationRule(NullArchitectureRule);
  registerRecommendationRule(SignalBrainRule);
  bootstrapped = true;
}

/**
 * Build full intelligence snapshot for one asset.
 */
export function evaluateAssetIntelligence(asset = {}, bundle = {}, opts = {}) {
  ensureBootstrap();
  const ctx = buildAssetContext(asset, bundle);
  if (!ctx.usable) {
    return {
      available: false,
      assetId: null,
      context: ctx,
      brain: {
        message: 'Not enough data to recommend actions yet.',
        recommendations: [],
      },
      insights: [],
      recommendations: [],
      health: null,
      repairReplace: null,
      energy: null,
      claimPackPreview: null,
      alerts: [],
      twinIdentity: null,
      errors: ['Asset ID required'],
    };
  }

  const scopeDocs = assertAssetScoped(ctx.assetId, ctx.documents, 'documents');
  const scopeSvc = assertAssetScoped(ctx.assetId, ctx.services, 'services');
  const scopeExp = assertAssetScoped(ctx.assetId, ctx.expenses, 'expenses');
  const errors = [];
  if (!scopeDocs.ok) errors.push(scopeDocs.error);
  if (!scopeSvc.ok) errors.push(scopeSvc.error);
  if (!scopeExp.ok) errors.push(scopeExp.error);

  const fp = intelligenceFingerprint(asset, bundle);
  const cacheKey = intelligenceCacheKey(ctx.assetId, fp);
  if (!opts.skipCache) {
    const hit = getCachedIntelligence(cacheKey);
    if (hit) return { ...hit, fromCache: true };
  }

  const caps = resolveAssetCapabilities(asset);
  const health = computeExplainableHealth(asset, { repairs: ctx.services });

  const legacy = Array.isArray(bundle.legacyInsights)
    ? bundle.legacyInsights.map(fromLegacyInsight)
    : [];

  const ruleRows = runRecommendationRules(ctx, { ...opts, asset });
  const seen = new Set();
  const deduped = [];
  for (const r of ruleRows) {
    if (!r || r.__ruleError) continue;
    const k = `${r.type}|${r.key || r.title}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(r);
  }

  const recommendations = deduped.map((r) =>
    createRecommendation({
      ...r,
      assetId: ctx.assetId,
      homeId: ctx.homeId,
      roomId: ctx.roomId,
      ownerUid: ctx.ownerUid,
    }),
  );

  const insights = [
    ...legacy.map((i) =>
      createInsight({
        ...i,
        assetId: ctx.assetId,
        homeId: ctx.homeId,
        roomId: ctx.roomId,
      }),
    ),
    ...recommendations.map((r) => createInsight(r)),
  ];

  const repairReplace = analyzeRepairVsReplace(ctx, opts.repairReplaceOpts || {});
  const energyProfile = buildEnergyProfile(asset);
  const energyEstimate = calculateEnergyEstimate(energyProfile);
  const energyRow = estimateForAsset(asset, opts.tariffPerKwh);

  const packResult = buildWarrantyClaimPack(ctx.assetId, {
    asset,
    documents: ctx.documents,
    services: ctx.services,
    expenses: ctx.expenses,
    issueDescription: opts.issueDescription,
  });
  const claimPackPreview = packResult.success ? packResult.claimPack : null;

  const alerts = buildSmartAlertsForAsset(asset, bundle, {
    claimMissing: claimPackPreview?.missingInformation || [],
    maxAlerts: opts.maxAlerts,
  });

  // Battery intelligence must never appear for unsupported assets
  const safeBattery =
    caps.supportsBatteryHealth && (ctx.battery || asset.batteryProfile)
      ? ctx.battery || asset.batteryProfile
      : null;

  const brainMessage =
    recommendations.length === 1 &&
    /not enough data/i.test(recommendations[0].title || '')
      ? recommendations[0].title
      : null;

  const snapshot = {
    available: errors.length === 0,
    assetId: ctx.assetId,
    publicAssetId: ctx.publicAssetId,
    displayName: ctx.displayName,
    context: ctx,
    capabilities: caps,
    brain: {
      message: brainMessage,
      recommendations,
      count: recommendations.length,
    },
    health,
    insights,
    recommendations,
    repairReplace,
    energy: {
      profile: energyProfile,
      estimate: energyEstimate,
      row: energyRow,
      supportsEnergyTracking: caps.supportsEnergyTracking,
      needsEnergyInputs: caps.needsEnergyInputs,
    },
    battery: safeBattery,
    claimPackPreview,
    alerts,
    twinIdentity: buildAssetTwinIdentity(asset),
    relationships: {
      homeId: ctx.homeId,
      floorId: ctx.floorId,
      roomId: ctx.roomId,
      roomName: asset.roomName || null,
      locationLabel: asset.locationLabel || ctx.locationPath,
      customAssetName: asset.customAssetName || asset.nickname || null,
      documentCount: ctx.documents.length,
      serviceCount: ctx.services.length,
      expenseCount: ctx.expenses.length,
    },
    errors,
    fromCache: false,
    evaluatedAt: new Date().toISOString(),
  };

  setCachedIntelligence(cacheKey, snapshot, opts.cacheTtlMs ?? 60_000);
  return snapshot;
}

export function evaluatePortfolioIntelligence(assets = [], bundlesByAssetId = {}, opts = {}) {
  const rows = [];
  for (const asset of assets || []) {
    if (!asset || asset.deletedAt) continue;
    const id = asset.assetId || asset.id;
    rows.push(evaluateAssetIntelligence(asset, bundlesByAssetId[id] || {}, opts));
  }
  const energyCommand = aggregateHomeEnergy(assets, opts);
  const locations = opts.locations || [];
  const twin = attachAssetsToTwinTree(buildDigitalTwinTree(locations), assets);
  return {
    count: rows.length,
    rows,
    energyCommand,
    twin,
    evaluatedAt: new Date().toISOString(),
  };
}

export const AssetIntelligenceEngine = {
  evaluateAsset: evaluateAssetIntelligence,
  evaluatePortfolio: evaluatePortfolioIntelligence,
  buildAssetContext,
  invalidateCache: invalidateIntelligenceCache,
  listRules: listRecommendationRules,
  registerRule: registerRecommendationRule,
  ensureBootstrap,
};

export default AssetIntelligenceEngine;

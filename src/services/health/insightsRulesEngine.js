/**
 * Extensible insights / alerts rules engine — deterministic, confirm-safe language.
 */

import { ALERT_PRIORITY, BATTERY_ALERT_THRESHOLDS, ENERGY_ANOMALY_PCT } from './healthScoreConfig';
import { evaluateServiceDue, SERVICE_STATUS } from './serviceDueEngine';
import { evaluateDocumentExpiries } from './documentExpiryEngine';
import { detectHealthTrend, HEALTH_TREND } from './healthHistory';
import { repairVsReplaceInsight } from './ownershipCost';
import { computeAssetHealth } from './computeAssetHealth';
import { buildPortfolioEnergyInsights } from '../intelligence/HomeEnergyService';

function alertId(assetId, type, key) {
  return `al_${assetId || 'x'}_${type}_${key}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Build smart insights for one asset.
 * @returns {Array<object>}
 */
export function buildAssetInsights(asset = {}, opts = {}) {
  const assetId = asset.assetId || asset.id || '';
  const name = asset.nickname || asset.assetName || 'Asset';
  const insights = [];
  const health = opts.health || computeAssetHealth(asset, opts);

  // Document expiries
  for (const row of evaluateDocumentExpiries(asset)) {
    insights.push({
      alertId: alertId(assetId, row.field, row.windowDay ?? 'exp'),
      assetId,
      type: row.field.replace('Expiry', '').toUpperCase() || 'DOCUMENT',
      category: row.category,
      priority: row.priority,
      title: row.message,
      message: `${name}: ${row.message}`,
      reason: row.reason,
      source: row.source,
      confidence: row.confidence,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      assetName: name,
    });
  }

  // Service
  const service = health.service || evaluateServiceDue(asset, opts);
  if (service.status === SERVICE_STATUS.SERVICE_OVERDUE) {
    insights.push({
      alertId: alertId(assetId, 'SERVICE', 'overdue'),
      assetId,
      type: 'SERVICE_OVERDUE',
      category: 'Service',
      priority: ALERT_PRIORITY.HIGH,
      title: service.message,
      message: `${name}: ${service.message}`,
      reason: 'service_overdue',
      source: service.source,
      confidence: service.recommended ? 0.7 : 0.9,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      recommended: Boolean(service.recommended),
      assetName: name,
    });
  } else if (service.status === SERVICE_STATUS.SERVICE_DUE) {
    insights.push({
      alertId: alertId(assetId, 'SERVICE', 'due'),
      assetId,
      type: 'SERVICE_DUE',
      category: 'Service',
      priority: ALERT_PRIORITY.MEDIUM,
      title: service.message,
      message: `${name}: ${service.message}`,
      reason: 'service_due',
      source: service.source,
      confidence: service.recommended ? 0.7 : 0.9,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      recommended: Boolean(service.recommended),
      assetName: name,
    });
  }

  // Battery — ONLY when measured health exists (never estimated / never 0 placeholder)
  const bp = asset.batteryProfile || {};
  const rawBat =
    bp.healthPercent != null
      ? bp.healthPercent
      : asset.batteryHealthPercent != null
        ? asset.batteryHealthPercent
        : null;
  const bat = rawBat == null || rawBat === '' ? NaN : Number(rawBat);
  const measuredBattery =
    Number.isFinite(bat) &&
    bat > 0 &&
    bat <= 100 &&
    !bp.isEstimated &&
    bp.isEstimate !== true;
  if (measuredBattery) {
    if (bat < BATTERY_ALERT_THRESHOLDS.critical) {
      insights.push({
        alertId: alertId(assetId, 'BATTERY', 'critical'),
        assetId,
        type: 'BATTERY',
        category: 'Battery',
        priority: ALERT_PRIORITY.HIGH,
        title: `Battery health is ${bat}%`,
        message: `${name}: Battery health has dropped below your preferred threshold.`,
        reason: 'battery_below_critical',
        source: 'battery_profile',
        confidence: 0.9,
        createdAt: new Date().toISOString(),
        status: 'SCHEDULED',
        assetName: name,
      });
    } else if (bat < BATTERY_ALERT_THRESHOLDS.attention) {
      insights.push({
        alertId: alertId(assetId, 'BATTERY', 'attention'),
        assetId,
        type: 'BATTERY',
        category: 'Battery',
        priority: ALERT_PRIORITY.MEDIUM,
        title: `Battery health is ${bat}%`,
        message: `${name}: Battery health needs attention.`,
        reason: 'battery_below_attention',
        source: 'battery_profile',
        confidence: 0.85,
        createdAt: new Date().toISOString(),
        status: 'SCHEDULED',
        assetName: name,
      });
    }
  }

  // Energy anomaly — soft language
  const anomaly = Number(asset.energyAnomalyPct);
  if (Number.isFinite(anomaly) && anomaly >= ENERGY_ANOMALY_PCT) {
    insights.push({
      alertId: alertId(assetId, 'ENERGY', Math.round(anomaly)),
      assetId,
      type: 'ENERGY',
      category: 'Energy',
      priority: ALERT_PRIORITY.MEDIUM,
      title: 'Energy consumption is significantly higher than usual.',
      message: `${name}: Consumption has increased. Consider checking usage or servicing the appliance.`,
      reason: 'energy_anomaly',
      source: 'energy_comparison',
      confidence: 0.65,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      possibleIssue: true,
      assetName: name,
    });
  }

  // Repeated repairs
  const repairs = Number(asset.repairCount ?? asset.repeatedRepairCount) || 0;
  if (repairs >= 3) {
    insights.push({
      alertId: alertId(assetId, 'MAINTENANCE', 'repeat'),
      assetId,
      type: 'MAINTENANCE',
      category: 'Health',
      priority: ALERT_PRIORITY.MEDIUM,
      title: 'Repeated service activity detected.',
      message: `${name}: Consider getting the appliance inspected for an underlying issue.`,
      reason: 'repeated_repairs',
      source: 'repair_history',
      confidence: 0.7,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      possibleIssue: true,
      assetName: name,
    });
  }

  // Health trend
  const trend = detectHealthTrend(asset.healthHistory || opts.healthHistory || []);
  if (trend.trend === HEALTH_TREND.RAPID_DECLINE) {
    insights.push({
      alertId: alertId(assetId, 'HEALTH', 'rapid'),
      assetId,
      type: 'HEALTH',
      category: 'Health',
      priority: ALERT_PRIORITY.HIGH,
      title: trend.message,
      message: `${name}: ${trend.message}`,
      reason: 'rapid_health_decline',
      source: 'health_history',
      confidence: 0.8,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      assetName: name,
    });
  }

  // Repair vs value
  const rv = repairVsReplaceInsight(asset, {
    repairCost: opts.pendingRepairCost || asset.lastRepairCost,
    currentEstimatedValue: asset.estimatedResale || asset.bookValue,
  });
  if (rv) {
    insights.push({
      alertId: alertId(assetId, 'COST', 'repair_vs_value'),
      assetId,
      type: 'EXPENSE',
      category: 'Expense',
      priority: rv.priority,
      title: rv.message,
      message: `${name}: ${rv.message}`,
      reason: rv.reason,
      source: rv.source,
      confidence: rv.confidence,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      assetName: name,
    });
  }

  // Health band summary tip
  if (health.score < 60 && health.why?.length) {
    insights.push({
      alertId: alertId(assetId, 'HEALTH', 'band'),
      assetId,
      type: 'HEALTH',
      category: 'Health',
      priority: health.score < 40 ? ALERT_PRIORITY.CRITICAL : ALERT_PRIORITY.HIGH,
      title: `Asset Health ${health.score}/100 — ${health.band}`,
      message: `${name}: ${health.why.slice(0, 3).join('; ')}`,
      reason: 'health_band',
      source: 'health_engine',
      confidence: 0.85,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      why: health.why,
      assetName: name,
    });
  }

  return dedupeInsights(insights);
}

function dedupeInsights(list) {
  const seen = new Set();
  const out = [];
  for (const row of list) {
    if (seen.has(row.alertId)) continue;
    seen.add(row.alertId);
    out.push(row);
  }
  return out;
}

export function buildPortfolioInsights(assets = [], opts = {}) {
  const all = [];
  for (const a of assets || []) {
    if (!a || a.deletedAt) continue;
    all.push(...buildAssetInsights(a, opts));
  }
  // Household energy / bill insights — real data only (no invented kWh)
  for (const row of buildPortfolioEnergyInsights(assets, opts.tariffPerKwh)) {
    all.push({
      alertId: alertId(row.assetId || 'home', row.reason || 'energy', 'port'),
      assetId: row.assetId || '',
      type: row.type || 'ENERGY',
      category: row.category || 'Energy',
      priority: ALERT_PRIORITY.MEDIUM,
      title: row.title,
      message: row.message,
      reason: row.reason,
      source: row.source,
      confidence: row.confidence ?? 0.55,
      createdAt: new Date().toISOString(),
      status: 'SCHEDULED',
      assetName: row.assetId ? undefined : 'Household',
    });
  }
  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return all.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
}

export default { buildAssetInsights, buildPortfolioInsights };

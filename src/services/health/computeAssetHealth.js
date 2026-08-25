/**
 * Asset Health Score engine — local deterministic math.
 * Returns score, band, breakdown, and plain-language reasons.
 */

import { daysUntil, yearsSince } from '../../utils/dates';
import { clamp } from '../../utils/format';
import {
  resolveHealthProfile,
  healthBandForScore,
  BATTERY_ALERT_THRESHOLDS,
} from './healthScoreConfig';
import { evaluateServiceDue } from './serviceDueEngine';

function hasDocEvidence(asset) {
  return Boolean(
    asset.billImageUrl ||
      asset.hasBill ||
      asset.billThumbDataUrl ||
      asset.ocrExtract ||
      asset.invoiceMeta,
  );
}

function scoreDocuments(asset, maxPts) {
  let earned = maxPts;
  const reasons = [];
  if (!hasDocEvidence(asset)) {
    earned -= Math.round(maxPts * 0.4);
    reasons.push('Purchase / document evidence missing');
  }
  const hasId =
    asset.serialNumber ||
    asset.chassisNumber ||
    asset.registration ||
    asset.imei ||
    asset.publicAssetId;
  if (!hasId) {
    earned -= Math.round(maxPts * 0.35);
    reasons.push('Unique identifier missing');
  }
  if (!asset.purchaseDate) {
    earned -= Math.round(maxPts * 0.25);
    reasons.push('Purchase date missing');
  }
  return { earned: clamp(earned, 0, maxPts), max: maxPts, reasons };
}

function scoreWarranty(asset, maxPts) {
  const days = daysUntil(asset.warrantyExpiry);
  const reasons = [];
  if (days == null) {
    // Unknown warranty — partial credit, not full penalty
    return { earned: Math.round(maxPts * 0.55), max: maxPts, reasons: ['Warranty date not set'] };
  }
  if (days < 0) {
    reasons.push('Warranty expired');
    return { earned: Math.round(maxPts * 0.25), max: maxPts, reasons };
  }
  if (days <= 30) {
    reasons.push(`Warranty expires in ${days} day(s)`);
    return { earned: Math.round(maxPts * 0.55), max: maxPts, reasons };
  }
  if (days <= 90) {
    return { earned: Math.round(maxPts * 0.8), max: maxPts, reasons: [] };
  }
  return { earned: maxPts, max: maxPts, reasons: [] };
}

function scoreInsurance(asset, maxPts) {
  const days = daysUntil(asset.insuranceExpiry);
  const reasons = [];
  if (days == null) {
    return { earned: Math.round(maxPts * 0.5), max: maxPts, reasons: ['Insurance date not set'] };
  }
  if (days < 0) {
    reasons.push('Insurance expired');
    return { earned: 0, max: maxPts, reasons };
  }
  if (days <= 7) {
    reasons.push(`Insurance expires in ${days} day(s)`);
    return { earned: Math.round(maxPts * 0.35), max: maxPts, reasons };
  }
  if (days <= 30) {
    reasons.push(`Insurance due within a month`);
    return { earned: Math.round(maxPts * 0.65), max: maxPts, reasons };
  }
  return { earned: maxPts, max: maxPts, reasons: [] };
}

function scoreMaintenance(asset, maxPts, serviceEval) {
  const reasons = [];
  const status = serviceEval?.status || 'unknown';
  if (status === 'SERVICE_OVERDUE') {
    reasons.push('Service overdue');
    return { earned: Math.round(maxPts * 0.2), max: maxPts, reasons };
  }
  if (status === 'SERVICE_DUE') {
    reasons.push(serviceEval.message || 'Service due soon');
    return { earned: Math.round(maxPts * 0.45), max: maxPts, reasons };
  }
  if (status === 'SERVICE_UPCOMING') {
    reasons.push(serviceEval.message || 'Service upcoming');
    return { earned: Math.round(maxPts * 0.75), max: maxPts, reasons };
  }
  // Repeated repairs signal (soft)
  const repairs = Number(asset.repairCount ?? asset.repeatedRepairCount) || 0;
  if (repairs >= 3) {
    reasons.push('Repeated service activity detected');
    return { earned: Math.round(maxPts * 0.55), max: maxPts, reasons };
  }
  if (asset.condition === 'poor') {
    reasons.push('Condition marked poor');
    return { earned: Math.round(maxPts * 0.4), max: maxPts, reasons };
  }
  if (asset.condition === 'fair') {
    return { earned: Math.round(maxPts * 0.7), max: maxPts, reasons: [] };
  }
  return { earned: maxPts, max: maxPts, reasons: [] };
}

function scoreBattery(asset, maxPts) {
  const reasons = [];
  const bp = asset.batteryProfile || {};
  let pct = bp.healthPercent != null ? Number(bp.healthPercent) : Number(asset.batteryHealthPercent);
  if (!Number.isFinite(pct)) {
    return { earned: Math.round(maxPts * 0.6), max: maxPts, reasons: ['Battery data unavailable'] };
  }
  pct = Math.max(0, Math.min(100, pct));
  if (pct < BATTERY_ALERT_THRESHOLDS.critical) {
    reasons.push(
      bp.isEstimated
        ? `Estimated battery health ${pct}%`
        : `Battery health ${pct}%`,
    );
    return { earned: Math.round(maxPts * 0.25), max: maxPts, reasons };
  }
  if (pct < BATTERY_ALERT_THRESHOLDS.attention) {
    reasons.push(
      bp.isEstimated
        ? `Estimated battery health ${pct}%`
        : `Battery health ${pct}%`,
    );
    return { earned: Math.round(maxPts * 0.55), max: maxPts, reasons };
  }
  if (pct < 90) {
    return { earned: Math.round(maxPts * 0.85), max: maxPts, reasons: [] };
  }
  return { earned: maxPts, max: maxPts, reasons: [] };
}

function scoreEnergy(asset, maxPts) {
  const reasons = [];
  const anomalyPct = Number(asset.energyAnomalyPct);
  if (Number.isFinite(anomalyPct) && anomalyPct >= 25) {
    reasons.push('Energy consumption higher than usual');
    return { earned: Math.round(maxPts * 0.45), max: maxPts, reasons };
  }
  // Mild credit when energy profile exists (known usage)
  if (asset.energyProfile?.estimatedMonthlyConsumptionKwh > 0 || asset.isElectricAppliance) {
    return { earned: Math.round(maxPts * 0.85), max: maxPts, reasons: [] };
  }
  return { earned: Math.round(maxPts * 0.7), max: maxPts, reasons: [] };
}

function scoreAge(asset, maxPts) {
  const ageYears = yearsSince(asset.purchaseDate);
  const reasons = [];
  if (!asset.purchaseDate) {
    return { earned: Math.round(maxPts * 0.6), max: maxPts, reasons: ['Age unknown'], ageYears: 0 };
  }
  let ratio = 1;
  if (ageYears > 8) {
    ratio = 0.25;
    reasons.push('Asset is older than 8 years');
  } else if (ageYears > 5) {
    ratio = 0.45;
    reasons.push('Asset age over 5 years');
  } else if (ageYears > 3) {
    ratio = 0.7;
  } else if (ageYears > 1) {
    ratio = 0.9;
  }
  return {
    earned: Math.round(maxPts * ratio),
    max: maxPts,
    reasons,
    ageYears: Number(ageYears.toFixed(1)),
  };
}

/**
 * @param {object} asset
 * @param {{ repairs?: object[], now?: Date }} [opts]
 */
export function computeAssetHealth(asset = {}, opts = {}) {
  const profile = resolveHealthProfile(asset);
  const weights = profile.weights;
  const serviceEval = evaluateServiceDue(asset, { now: opts.now });

  const breakdown = {};
  const why = [];

  const docs = scoreDocuments(asset, weights.documents || 0);
  breakdown.documents = { earned: docs.earned, max: docs.max, label: 'Documents' };
  why.push(...docs.reasons);

  if ((weights.warranty || 0) > 0) {
    const w = scoreWarranty(asset, weights.warranty);
    breakdown.warranty = { earned: w.earned, max: w.max, label: 'Warranty' };
    why.push(...w.reasons);
  }

  if ((weights.insurance || 0) > 0) {
    const ins = scoreInsurance(asset, weights.insurance);
    breakdown.insurance = { earned: ins.earned, max: ins.max, label: 'Insurance' };
    why.push(...ins.reasons);
  }

  // PUC soft for vehicles (fold into documents/insurance bucket if insurance weight exists)
  if (profile.key === 'vehicle' || profile.key === 'ev') {
    const pucDays = daysUntil(asset.pucExpiry);
    if (pucDays != null && pucDays < 0) {
      why.push('PUC expired');
      if (breakdown.documents) {
        breakdown.documents.earned = Math.max(0, breakdown.documents.earned - 4);
      }
    } else if (pucDays != null && pucDays <= 15) {
      why.push(`PUC expires in ${pucDays} day(s)`);
    }
  }

  if ((weights.maintenance || 0) > 0) {
    const m = scoreMaintenance(asset, weights.maintenance, serviceEval);
    breakdown.maintenance = { earned: m.earned, max: m.max, label: 'Maintenance' };
    why.push(...m.reasons);
  }

  if ((weights.battery || 0) > 0) {
    try {
      const { assetSupportsBatteryHealth } = require('../assets/assetCapabilities');
      if (!assetSupportsBatteryHealth(asset)) {
        // skip battery factor for appliances / unsupported types
      } else {
        const b = scoreBattery(asset, weights.battery);
        breakdown.battery = { earned: b.earned, max: b.max, label: 'Battery' };
        why.push(...b.reasons);
      }
    } catch {
      const b = scoreBattery(asset, weights.battery);
      breakdown.battery = { earned: b.earned, max: b.max, label: 'Battery' };
      why.push(...b.reasons);
    }
  }

  if ((weights.energy || 0) > 0) {
    const e = scoreEnergy(asset, weights.energy);
    breakdown.energy = { earned: e.earned, max: e.max, label: 'Energy' };
    why.push(...e.reasons);
  }

  const age = scoreAge(asset, weights.age || 0);
  if ((weights.age || 0) > 0) {
    breakdown.age = { earned: age.earned, max: age.max, label: 'Age' };
    why.push(...age.reasons);
  }

  // Normalize if weights don't sum to 100
  const maxTotal = Object.values(breakdown).reduce((s, row) => s + (row.max || 0), 0) || 100;
  const earnedTotal = Object.values(breakdown).reduce((s, row) => s + (row.earned || 0), 0);
  const score = Math.round(clamp((earnedTotal / maxTotal) * 100, 0, 100));
  const band = healthBandForScore(score);

  const uniqueWhy = [...new Set(why)].slice(0, 6);

  // Legacy grade for older UI that expects Excellent/Good/Fair/At Risk/Critical
  let legacyGrade = band.label;
  if (legacyGrade === 'Needs Attention') legacyGrade = 'Fair';

  return {
    score,
    grade: band.label,
    legacyGrade,
    band: band.label,
    profile: profile.key,
    breakdown,
    why: uniqueWhy,
    tips: uniqueWhy.slice(0, 4),
    factors: Object.fromEntries(
      Object.entries(breakdown).map(([k, v]) => [k, v.earned - v.max]),
    ),
    service: serviceEval,
    ageYears: age.ageYears ?? 0,
    version: 1,
  };
}

export function computePortfolioHealth(assets = []) {
  const active = (assets || []).filter((a) => a && !a.deletedAt);
  if (!active.length) {
    return {
      score: 100,
      band: 'Excellent',
      grade: 'Excellent',
      count: 0,
      healthy: 0,
      needsAttention: 0,
      critical: 0,
    };
  }
  const rows = active.map((a) => computeAssetHealth(a));
  const score = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
  const band = healthBandForScore(score).label;
  return {
    score,
    band,
    grade: band,
    count: active.length,
    healthy: rows.filter((r) => r.score >= 75).length,
    needsAttention: rows.filter((r) => r.score >= 40 && r.score < 75).length,
    critical: rows.filter((r) => r.score < 40).length,
  };
}

export default { computeAssetHealth, computePortfolioHealth };

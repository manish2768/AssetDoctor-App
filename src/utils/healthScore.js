/**
 * Asset Health Score (0–100)
 * Factors: document completeness, expiry urgency, age, condition.
 */

import { daysUntil, yearsSince } from './dates';
import { clamp } from './format';

/**
 * @param {object} asset
 * @returns {{ score: number, grade: string, factors: object, tips: string[] }}
 */
export function calculateHealthScore(asset = {}) {
  let score = 100;
  const tips = [];
  const factors = {
    documents: 0,
    expiries: 0,
    age: 0,
    condition: 0,
  };

  // --- Documents / identity completeness (max -25) ---
  let docPenalty = 0;
  if (!asset.billImageUrl && !asset.hasBill) {
    docPenalty += 8;
    tips.push('Upload purchase bill to improve health score');
  }
  if (!asset.serialNumber && !asset.chassisNumber && !asset.registration) {
    docPenalty += 7;
    tips.push('Add serial / chassis / registration number');
  }
  if (!asset.purchaseDate) {
    docPenalty += 5;
    tips.push('Set purchase date for accurate ageing');
  }
  if (!asset.storeName) docPenalty += 5;
  factors.documents = -docPenalty;
  score -= docPenalty;

  // --- Expiry urgency (max -40) ---
  let expiryPenalty = 0;
  const checks = [
    { key: 'insuranceExpiry', label: 'Insurance' },
    { key: 'pucExpiry', label: 'PUC' },
    { key: 'warrantyExpiry', label: 'Warranty' },
  ];
  for (const { key, label } of checks) {
    const days = daysUntil(asset[key]);
    if (days === null) continue;
    if (days < 0) {
      expiryPenalty += 15;
      tips.push(`${label} expired — renew ASAP`);
    } else if (days <= 7) {
      expiryPenalty += 10;
      tips.push(`${label} expires in ${days} day(s)`);
    } else if (days <= 30) {
      expiryPenalty += 5;
      tips.push(`${label} due within a month`);
    }
  }
  factors.expiries = -Math.min(40, expiryPenalty);
  score -= Math.min(40, expiryPenalty);

  // --- Age depreciation pressure (max -20) ---
  const ageYears = yearsSince(asset.purchaseDate);
  let agePenalty = 0;
  if (ageYears > 8) agePenalty = 20;
  else if (ageYears > 5) agePenalty = 14;
  else if (ageYears > 3) agePenalty = 8;
  else if (ageYears > 1) agePenalty = 3;
  factors.age = -agePenalty;
  score -= agePenalty;

  // --- Condition bonus / penalty (max ±10) ---
  const conditionMap = { excellent: 10, good: 5, fair: -5, poor: -10 };
  const condDelta = conditionMap[asset.condition] ?? 0;
  factors.condition = condDelta;
  score += condDelta;
  if (asset.condition === 'poor') tips.push('Consider servicing or upgrading this asset');

  score = Math.round(clamp(score, 0, 100));

  let grade = 'Critical';
  if (score >= 85) grade = 'Excellent';
  else if (score >= 70) grade = 'Good';
  else if (score >= 50) grade = 'Fair';
  else if (score >= 30) grade = 'At Risk';

  return { score, grade, factors, tips: tips.slice(0, 4), ageYears: Number(ageYears.toFixed(1)) };
}

/**
 * Portfolio health = average of asset scores (empty → 100)
 */
export function calculatePortfolioHealth(assets = []) {
  if (!assets.length) return { score: 100, grade: 'Excellent', count: 0 };
  const scores = assets.map((a) => calculateHealthScore(a).score);
  const score = Math.round(scores.reduce((s, n) => s + n, 0) / scores.length);
  const { grade } = calculateHealthScore({ condition: 'good' }); // placeholder
  let g = 'Critical';
  if (score >= 85) g = 'Excellent';
  else if (score >= 70) g = 'Good';
  else if (score >= 50) g = 'Fair';
  else if (score >= 30) g = 'At Risk';
  return { score, grade: g, count: assets.length };
}

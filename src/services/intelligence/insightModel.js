/**
 * Insight + Recommendation normalized models (Phase 2).
 * Maps legacy notification/insight shapes when present.
 */

import {
  CONFIDENCE_BAND,
  INSIGHT_TYPE,
  RECOMMENDATION_STATUS,
  createInsightId,
  createRecommendationId,
} from './types';

function bandFromScore(confidence) {
  if (confidence == null || Number.isNaN(Number(confidence))) return CONFIDENCE_BAND.UNKNOWN;
  const c = Number(confidence);
  if (c >= 0.8) return CONFIDENCE_BAND.HIGH;
  if (c >= 0.55) return CONFIDENCE_BAND.MEDIUM;
  if (c > 0) return CONFIDENCE_BAND.LOW;
  return CONFIDENCE_BAND.UNKNOWN;
}

/**
 * @returns {object} Insight
 */
export function createInsight(partial = {}) {
  const assetId = String(partial.assetId || '').trim();
  const type = String(partial.type || INSIGHT_TYPE.LIFECYCLE).toUpperCase();
  const id =
    partial.id ||
    partial.insightId ||
    partial.alertId ||
    createInsightId(assetId, type, partial.key || partial.reason || 'default');
  const now = partial.createdAt || new Date().toISOString();
  return {
    id,
    assetId: assetId || null,
    type: INSIGHT_TYPE[type] || type,
    title: partial.title || '',
    description: partial.description || partial.message || '',
    reason: partial.reason || null,
    priority: partial.priority || 'MEDIUM',
    confidence: bandFromScore(partial.confidenceScore ?? partial.confidence),
    confidenceScore:
      partial.confidenceScore != null
        ? Number(partial.confidenceScore)
        : partial.confidence != null
          ? Number(partial.confidence)
          : null,
    supportingData: partial.supportingData && typeof partial.supportingData === 'object'
      ? partial.supportingData
      : {},
    action: partial.action || null,
    status: partial.status || RECOMMENDATION_STATUS.ACTIVE,
    createdAt: now,
    updatedAt: partial.updatedAt || now,
    expiresAt: partial.expiresAt || null,
    householdId: partial.householdId || null,
    homeId: partial.homeId || null,
    roomId: partial.roomId || null,
    ownerUid: partial.ownerUid || null,
  };
}

/**
 * @returns {object} Recommendation
 */
export function createRecommendation(partial = {}) {
  const base = createInsight(partial);
  return {
    ...base,
    id:
      partial.id ||
      partial.recommendationId ||
      createRecommendationId(base.assetId, base.type, partial.key || partial.reason || 'default'),
    recommendationId: undefined,
  };
}

/** Map legacy insightsRulesEngine / notification center rows → Insight */
export function fromLegacyInsight(row = {}) {
  const typeRaw = String(row.type || row.category || 'LIFECYCLE').toUpperCase();
  let type = INSIGHT_TYPE.LIFECYCLE;
  if (typeRaw.includes('WARRANT')) type = INSIGHT_TYPE.WARRANTY;
  else if (typeRaw.includes('SERVICE') || typeRaw.includes('MAINT')) type = INSIGHT_TYPE.MAINTENANCE;
  else if (typeRaw.includes('REPAIR')) type = INSIGHT_TYPE.REPAIR;
  else if (typeRaw.includes('REPLAC')) type = INSIGHT_TYPE.REPLACEMENT;
  else if (typeRaw.includes('ENERGY')) type = INSIGHT_TYPE.ENERGY;
  else if (typeRaw.includes('BATTERY')) type = INSIGHT_TYPE.BATTERY;
  else if (typeRaw.includes('DOC') || typeRaw.includes('PUC') || typeRaw.includes('INSUR'))
    type = INSIGHT_TYPE.DOCUMENT;
  else if (typeRaw.includes('COST') || typeRaw.includes('EXPENSE')) type = INSIGHT_TYPE.COST;
  else if (INSIGHT_TYPE[typeRaw]) type = INSIGHT_TYPE[typeRaw];

  let status = RECOMMENDATION_STATUS.ACTIVE;
  const s = String(row.status || '').toUpperCase();
  if (s === 'DISMISSED') status = RECOMMENDATION_STATUS.DISMISSED;
  else if (s === 'RESOLVED' || s === 'ACTIONED') status = RECOMMENDATION_STATUS.RESOLVED;
  else if (s === 'EXPIRED') status = RECOMMENDATION_STATUS.EXPIRED;

  return createInsight({
    id: row.alertId || row.id,
    assetId: row.assetId,
    type,
    title: row.title,
    description: row.message || row.description,
    reason: row.reason,
    priority: row.priority,
    confidence: row.confidence,
    supportingData: {
      source: row.source || null,
      recommended: row.recommended ?? null,
      why: row.why || null,
    },
    action: row.action || null,
    status,
    createdAt: row.createdAt,
    homeId: row.homeId,
    roomId: row.roomId,
    ownerUid: row.ownerUid,
  });
}

export default { createInsight, createRecommendation, fromLegacyInsight };

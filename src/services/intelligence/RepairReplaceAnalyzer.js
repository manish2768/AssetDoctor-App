/**
 * RepairReplaceAnalyzer — REPAIR / REPLACE / MONITOR from real costs only.
 * Never invents market replacement values.
 */

import { REPAIR_REPLACE_DECISION, CONFIDENCE_BAND, formatWhatWhyDo } from './types';

function emptyAssessment(partial = {}) {
  const tri = formatWhatWhyDo({
    what: 'Not enough data for repair vs replace',
    why: partial.limitations?.[0] || 'Repair cost and purchase value are required.',
    whatShouldIDo: 'Log a repair quote and confirm purchase price — we will not invent market prices.',
    priority: 'LOW',
  });
  return {
    decision: REPAIR_REPLACE_DECISION.INSUFFICIENT_DATA,
    confidence: CONFIDENCE_BAND.UNKNOWN,
    repairCost: null,
    recentRepairCost: null,
    maintenanceCost: null,
    estimatedReplacementCost: null,
    assetAge: null,
    reasons: [],
    limitations: ['Insufficient data for repair vs replace assessment.'],
    available: false,
    assetId: null,
    explanation: tri,
    ...partial,
  };
}

function sumExpenseRepairs(ctx) {
  const rows = [...(ctx.expenses || []), ...(ctx.services || [])];
  let total = 0;
  let count = 0;
  for (const r of rows) {
    const amt = Number(r.totalAmount ?? r.costInr ?? r.amount);
    if (Number.isFinite(amt) && amt > 0) {
      total += amt;
      count += 1;
    }
  }
  return { total: count ? total : null, count };
}

/**
 * @param {object} assetContext — from buildAssetContext
 * @param {object} [opts]
 */
export function analyzeRepairVsReplace(assetContext = {}, opts = {}) {
  const assetId = assetContext.assetId || null;
  if (!assetContext.usable || !assetId) {
    return emptyAssessment({
      limitations: ['Asset ID required.'],
    });
  }

  const fromLogs = sumExpenseRepairs(assetContext);
  const repairCost =
    opts.repairCost != null
      ? Number(opts.repairCost)
      : assetContext.analytics?.repairVsReplace?.repairCost != null
        ? Number(assetContext.analytics.repairVsReplace.repairCost)
        : fromLogs.total;
  const recentRepairCost =
    opts.recentRepairCost != null ? Number(opts.recentRepairCost) : repairCost;
  const maintenanceCost =
    opts.maintenanceCost != null
      ? Number(opts.maintenanceCost)
      : Number.isFinite(Number(assetContext.analytics?.period?.service))
        ? Number(assetContext.analytics.period.service)
        : null;

  // NEVER invent market replacement — only user-provided
  const estimatedReplacementCost =
    opts.estimatedReplacementCost != null && Number(opts.estimatedReplacementCost) > 0
      ? Number(opts.estimatedReplacementCost)
      : null;

  const assetAge = assetContext.ageYears;
  const purchasePrice = assetContext.purchasePrice;
  const currentValue = assetContext.currentValue;
  const baseline =
    purchasePrice > 0 ? purchasePrice : currentValue > 0 ? currentValue : null;
  const effectiveRepair =
    recentRepairCost > 0 ? recentRepairCost : repairCost > 0 ? repairCost : null;

  const missing = [];
  if (!(baseline > 0)) missing.push('purchase or current value');
  if (!(effectiveRepair > 0)) missing.push('repair cost (from logs or quote)');

  if (typeof opts.provisionalEvaluator === 'function') {
    try {
      const provisional = opts.provisionalEvaluator(assetContext, {
        repairCost: effectiveRepair || 0,
        repairCount: assetContext.services?.length || 0,
        estimatedReplacementCost,
      });
      if (provisional && provisional.available) {
        const advice = String(provisional.advice || '').toUpperCase();
        let decision = REPAIR_REPLACE_DECISION.MONITOR;
        if (advice.includes('REPLACE')) decision = REPAIR_REPLACE_DECISION.REPLACE;
        else if (advice.includes('REPAIR')) decision = REPAIR_REPLACE_DECISION.REPAIR;
        else if (advice.includes('COMPARE')) decision = REPAIR_REPLACE_DECISION.COMPARE;
        const tri = formatWhatWhyDo({
          what: `Suggestion: ${decision}`,
          why: provisional.message || 'Based on your logged ownership costs.',
          whatShouldIDo: 'Confirm with a local quote — not financial advice.',
          priority: 'MEDIUM',
        });
        return {
          decision,
          confidence: CONFIDENCE_BAND.MEDIUM,
          repairCost: Number.isFinite(repairCost) ? Math.round(repairCost) : null,
          recentRepairCost: Number.isFinite(recentRepairCost) ? Math.round(recentRepairCost) : null,
          maintenanceCost: Number.isFinite(maintenanceCost) ? Math.round(maintenanceCost) : null,
          estimatedReplacementCost: Number.isFinite(estimatedReplacementCost)
            ? Math.round(estimatedReplacementCost)
            : null,
          assetAge,
          reasons: provisional.message ? [provisional.message] : [],
          limitations: [
            'Provisional assessment — not financial advice.',
            'No invented market prices.',
          ],
          available: true,
          assetId,
          provisionalAdvice: provisional.advice || null,
          explanation: tri,
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (!(baseline > 0) || !(effectiveRepair > 0)) {
    return emptyAssessment({
      assetId,
      repairCost: Number.isFinite(repairCost) ? Math.round(repairCost) : null,
      recentRepairCost: Number.isFinite(recentRepairCost) ? Math.round(recentRepairCost) : null,
      maintenanceCost: Number.isFinite(maintenanceCost) ? Math.round(maintenanceCost) : null,
      estimatedReplacementCost: Number.isFinite(estimatedReplacementCost)
        ? Math.round(estimatedReplacementCost)
        : null,
      assetAge,
      limitations: [
        `Add information to improve this assessment: ${missing.join(', ') || 'more cost history'}.`,
        'Never treat estimates as guaranteed financial advice.',
      ],
    });
  }

  const ratio = effectiveRepair / baseline;
  const repairCount = (assetContext.services || []).length || fromLogs.count || 0;
  let decision = REPAIR_REPLACE_DECISION.MONITOR;
  const reasons = [];

  if (estimatedReplacementCost > 0 && effectiveRepair >= estimatedReplacementCost * 0.85) {
    decision = REPAIR_REPLACE_DECISION.REPLACE;
    reasons.push(
      `Repair (₹${Math.round(effectiveRepair)}) is close to your provided replacement cost (₹${Math.round(estimatedReplacementCost)}).`,
    );
  } else if (ratio <= 0.3 && repairCount < 4) {
    decision = REPAIR_REPLACE_DECISION.REPAIR;
    reasons.push(
      `Repair is about ${Math.round(ratio * 100)}% of purchase/value — usually worth repairing when under ~30%.`,
    );
  } else if (ratio >= 0.6 || (assetAge != null && assetAge >= 8 && ratio >= 0.4)) {
    decision = REPAIR_REPLACE_DECISION.REPLACE;
    reasons.push(
      ratio >= 0.6
        ? `Repair is about ${Math.round(ratio * 100)}% of purchase/value.`
        : `Asset age (~${assetAge}y) plus significant repair cost suggests replacement.`,
    );
    if (!(estimatedReplacementCost > 0)) {
      reasons.push('Provide a real replacement quote to confirm — we do not invent market prices.');
    }
  } else {
    decision = REPAIR_REPLACE_DECISION.MONITOR;
    reasons.push(
      `Repair is about ${Math.round(ratio * 100)}% of purchase/value — watch recurring repairs before deciding.`,
    );
  }

  const tri = formatWhatWhyDo({
    what: `Suggestion: ${decision}`,
    why: reasons.join(' '),
    whatShouldIDo:
      decision === REPAIR_REPLACE_DECISION.REPAIR
        ? 'Get a written repair invoice and log it under Maintenance.'
        : decision === REPAIR_REPLACE_DECISION.REPLACE
          ? 'Compare a real replacement quote (enter it manually) before buying.'
          : 'Log the next repair cost; revisit if repairs stack up.',
    priority: decision === REPAIR_REPLACE_DECISION.REPLACE ? 'HIGH' : 'MEDIUM',
  });

  return {
    decision,
    confidence:
      estimatedReplacementCost > 0 ? CONFIDENCE_BAND.HIGH : CONFIDENCE_BAND.MEDIUM,
    repairCost: Math.round(effectiveRepair),
    recentRepairCost: Math.round(effectiveRepair),
    maintenanceCost: Number.isFinite(maintenanceCost) ? Math.round(maintenanceCost) : null,
    estimatedReplacementCost: Number.isFinite(estimatedReplacementCost)
      ? Math.round(estimatedReplacementCost)
      : null,
    assetAge,
    reasons,
    limitations: [
      'Based only on your logged costs and purchase value — not market scrapes.',
      'Not financial advice.',
    ],
    available: true,
    assetId,
    explanation: tri,
    ratio: Math.round(ratio * 1000) / 1000,
  };
}

export const RepairReplaceAnalyzer = {
  analyze: analyzeRepairVsReplace,
  decisions: REPAIR_REPLACE_DECISION,
};

export default RepairReplaceAnalyzer;

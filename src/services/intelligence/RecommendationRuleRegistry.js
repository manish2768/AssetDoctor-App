/**
 * RecommendationRule registry — Phase 2 architecture.
 * Rules register here; Phase 3 adds concrete algorithms.
 */

/**
 * @typedef {{ id: string, types?: string[], evaluate: (ctx: object, opts?: object) => object|object[]|null }} RecommendationRule
 */

const rules = new Map();

export function registerRecommendationRule(rule) {
  if (!rule?.id || typeof rule.evaluate !== 'function') {
    throw new Error('RecommendationRule requires id and evaluate()');
  }
  rules.set(rule.id, rule);
  return rule.id;
}

export function unregisterRecommendationRule(id) {
  return rules.delete(id);
}

export function listRecommendationRules() {
  return [...rules.values()].map((r) => ({ id: r.id, types: r.types || [] }));
}

export function clearRecommendationRules() {
  rules.clear();
}

/**
 * Run all registered rules against AssetContext.
 * @returns {object[]} raw recommendation-like objects (may be empty)
 */
export function runRecommendationRules(assetContext, opts = {}) {
  if (!assetContext?.usable || !assetContext.assetId) return [];
  const out = [];
  for (const rule of rules.values()) {
    try {
      const result = rule.evaluate(assetContext, opts);
      if (!result) continue;
      if (Array.isArray(result)) out.push(...result.filter(Boolean));
      else out.push(result);
    } catch (err) {
      if (opts.collectErrors) {
        out.push({
          __ruleError: true,
          ruleId: rule.id,
          message: err?.message || String(err),
        });
      }
    }
  }
  return out;
}

/**
 * Placeholder rule — documents that algorithms plug in later.
 * Does not emit recommendations (no fabricated insights).
 */
export const NullArchitectureRule = Object.freeze({
  id: 'architecture.null',
  types: [],
  evaluate() {
    return null;
  },
});

export default {
  registerRecommendationRule,
  unregisterRecommendationRule,
  listRecommendationRules,
  clearRecommendationRules,
  runRecommendationRules,
  NullArchitectureRule,
};

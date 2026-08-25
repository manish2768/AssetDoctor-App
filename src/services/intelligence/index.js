/**
 * Asset Doctor Intelligence Engine V2 — Phase 2 public API.
 */

export * from './types';
export {
  createInsight,
  createRecommendation,
  fromLegacyInsight,
} from './insightModel';
export { buildAssetContext, assertAssetScoped } from './AssetContext';
export {
  buildLocationPath,
  normalizeLocationNode,
  buildDigitalTwinTree,
  attachAssetsToTwinTree,
  buildAssetTwinIdentity,
  groupIdenticalAssetsByRoom,
  resolveAssetLocationRefs,
} from './digitalTwinModel';
export { DigitalTwinService } from './DigitalTwinService';
export {
  registerRecommendationRule,
  unregisterRecommendationRule,
  listRecommendationRules,
  clearRecommendationRules,
  runRecommendationRules,
  NullArchitectureRule,
} from './RecommendationRuleRegistry';
export { SignalBrainRule, evaluateBrainSignals } from './brainRules';
export { computeExplainableHealth } from './explainableHealth';
export {
  buildSmartAlertsForAsset,
  buildSmartAlertsForPortfolio,
} from './smartAlertBuilder';
export { formatWhatWhyDo } from './types';
export {
  intelligenceCacheKey,
  getCachedIntelligence,
  setCachedIntelligence,
  invalidateIntelligenceCache,
  intelligenceFingerprint,
} from './intelligenceCache';
export {
  AssetIntelligenceEngine,
  evaluateAssetIntelligence,
  evaluatePortfolioIntelligence,
} from './AssetIntelligenceEngine';
export { RepairReplaceAnalyzer, analyzeRepairVsReplace } from './RepairReplaceAnalyzer';
export { WarrantyClaimPackService, buildWarrantyClaimPack } from './WarrantyClaimPackService';
export {
  EnergyCalculationService,
  buildEnergyProfile,
  calculateEnergyEstimate,
} from './EnergyCalculationService';
export {
  HomeEnergyService,
  estimateForAsset,
  aggregateHomeEnergy,
  assetsForHome,
  buildPortfolioEnergyInsights,
} from './HomeEnergyService';
export { resolveOcrAssetLink, attachAssetIdToOcrPayload } from './ocrIntelligenceHooks';
export {
  INTELLIGENCE_SCHEMA_VERSION,
  migrateAssetLocationFields,
  migrateLocationNodeFields,
  migrateAssetListForIntelligence,
} from './migration';

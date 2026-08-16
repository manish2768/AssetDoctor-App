export {
  CURRENCY_INR,
  VALUE_SOURCE,
  DEPRECIATION_METHOD,
  EXPENSE_BUCKET,
  OWNERSHIP_ROLE,
  REPAIR_ADVICE,
  formatInr,
} from './financeConstants';

export {
  resolvePurchasePrice,
  calculateConfigurableDepreciation,
  resolveCurrentEstimatedValue,
  calculateAssetAge,
} from './valuationEngine';

export {
  categorizeExpenseRow,
  sumExpenseBuckets,
  computeAssetOwnershipCost,
  computeCostPerPeriod,
  computeCostPerUse,
  evaluateRepairVsReplace,
  summarizeRepairFrequency,
} from './ownershipCostEngine';

export { computeProfileCompleteness } from './completenessScore';

export {
  LIFECYCLE_STATUS,
  REPLACEMENT_FLAG,
  resolveLifecycleStatus,
  resolveReplacementFlag,
  buildLifecycleReport,
} from './lifecycleAnalytics';

export {
  buildEnergyCostDashboard,
  estimatedEnergyCostForAsset,
  portfolioEnergyByFolder,
} from './energyCostAnalytics';

export {
  buildAssetFinanceSnapshot,
  buildPortfolioFinance,
  summarizeMonthlyExpenses,
  detectExpenseAnomaly,
} from './portfolioFinance';

export {
  buildAssetAnalytics,
  compareAssets,
  computeOwnershipCostScore,
  analyzeMaintenanceTrend,
  analyzeRepairFrequency,
} from './assetAnalyticsEngine';

export {
  resolveUsefulLifeYears,
  resolveAnnualDepreciationRate,
  DEPRECIATION_USEFUL_LIFE_YEARS,
} from './depreciationRates';

export { queryPortfolioFinance, FINANCE_QUERY_INTENTS } from './financeQuery';

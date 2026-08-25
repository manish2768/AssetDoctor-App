/**
 * Asset Doctor — Universal Asset Valuation Engine
 * Supports Multi-Category Depreciation, Resale Market Valuations, and Repair vs. Replace Decision Index.
 */

import { UniversalAssetModel } from '../core/universalAssetSchema';
import { assetModuleRegistry } from '../modules/moduleRegistry';

export interface AssetValuationResult {
  purchasePrice: number;
  currentValue: number;
  depreciatedAmount: number;
  retainedEquityPercent: number;
  annualDepreciationRate: number;
  ageInYears: number;
  estimatedResaleValue: number;
  repairVsReplaceIndex: number; // 0 (Replace) to 100 (Repair)
  repairVsReplaceRecommendation: 'REPAIR' | 'REPLACE' | 'INSPECT_FIRST';
  repairVsReplaceExplanation: string;
  valuationModelVersion: string;
  calculatedAt: string;
}

export class AssetValuationEngine {
  public static readonly VALUATION_MODEL_VERSION = '1.0';

  public static calculateValuation(
    asset: UniversalAssetModel,
    estimatedRepairCost: number = 0
  ): AssetValuationResult {
    const purchasePrice = asset.purchasePrice || 0;
    const purchaseDate = asset.purchaseDate ? new Date(asset.purchaseDate) : new Date();
    const now = new Date();

    const diffTime = Math.max(0, now.getTime() - purchaseDate.getTime());
    const ageInYears = Math.max(0.1, Number((diffTime / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)));

    const module = assetModuleRegistry.getModule(asset.category);
    const valuationRule = module.valuationRule;

    const currentValue = valuationRule.calculateValue(purchasePrice, ageInYears);
    const depreciatedAmount = Math.max(0, purchasePrice - currentValue);
    const retainedEquityPercent = purchasePrice > 0 ? Math.round((currentValue / purchasePrice) * 100) : 100;
    const estimatedResaleValue = Math.round(currentValue * 0.90); // 10% liquidity margin

    // ----------------------------------------------------
    // Repair vs. Replace Decision Algorithm
    // Evaluates 50% Fair Market Value Rule + Asset Health Curve
    // ----------------------------------------------------
    const repairCostRatio = currentValue > 0 ? (estimatedRepairCost / currentValue) : 1;
    let repairVsReplaceIndex = Math.round((1 - Math.min(1, repairCostRatio)) * 100);
    
    // Age penalty (assets past 70% expected lifespan lean towards replacement)
    if (ageInYears > 5) repairVsReplaceIndex = Math.max(10, repairVsReplaceIndex - 15);

    let repairVsReplaceRecommendation: AssetValuationResult['repairVsReplaceRecommendation'] = 'REPAIR';
    let repairVsReplaceExplanation = 'Repair is financially optimal. Projected repair cost is well within asset equity threshold.';

    if (estimatedRepairCost > 0) {
      if (repairCostRatio >= 0.50 || repairVsReplaceIndex < 40) {
        repairVsReplaceRecommendation = 'REPLACE';
        repairVsReplaceExplanation = `Repair cost exceeds 50% of the asset's current fair market valuation (₹${currentValue.toLocaleString('en-IN')}). Upgrading to a newer model with fresh warranty is economically superior.`;
      } else if (repairCostRatio >= 0.30) {
        repairVsReplaceRecommendation = 'INSPECT_FIRST';
        repairVsReplaceExplanation = `Repair cost is moderate (~${Math.round(repairCostRatio * 100)}% of valuation). Perform professional diagnostic inspection before committing.`;
      }
    }

    return {
      purchasePrice,
      currentValue,
      depreciatedAmount,
      retainedEquityPercent,
      annualDepreciationRate: valuationRule.annualDepreciationRate,
      ageInYears,
      estimatedResaleValue,
      repairVsReplaceIndex,
      repairVsReplaceRecommendation,
      repairVsReplaceExplanation,
      valuationModelVersion: this.VALUATION_MODEL_VERSION,
      calculatedAt: new Date().toISOString()
    };
  }
}

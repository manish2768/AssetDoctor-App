/**
 * AI Smart Cost-to-Use — daily / monthly depreciation + ownership cost.
 */

import { calculateDepreciation } from './depreciation';
import { calculateResaleValue } from './resaleCalculator';
import { yearsSince } from './dates';

/**
 * @param {{
 *   purchaseValue?: number,
 *   purchaseDate?: string|Date,
 *   categoryId?: string,
 *   category?: string,
 *   condition?: string,
 *   name?: string,
 * }} asset
 */
export function calculateCostToUse(asset = {}) {
  try {
    const purchaseValue = Math.max(0, Number(asset.purchaseValue ?? asset.value) || 0);
    const purchaseDate = asset.purchaseDate || asset.invoiceDate || null;
    const categoryId = asset.categoryId || 'other';

    const dep = calculateDepreciation({
      purchaseValue,
      purchaseDate,
      categoryId,
    });
    const resale = calculateResaleValue({
      purchaseValue,
      purchaseDate,
      categoryId,
      category: asset.category,
      condition: asset.condition || 'good',
    });

    const ageYears = Math.max(dep.ageYears || yearsSince(purchaseDate) || 0.08, 0.08);
    const ageDays = Math.max(1, Math.round(ageYears * 365.25));
    const ownershipCost = Math.max(0, purchaseValue - (resale.estimatedResale || 0));
    const dailyCost = ownershipCost / ageDays;
    const monthlyCost = dailyCost * 30.4375;

    return {
      success: true,
      purchaseValue: Math.round(purchaseValue),
      estimatedResale: resale.estimatedResale || 0,
      ownershipCost: Math.round(ownershipCost),
      bookValue: dep.bookValue,
      ageYears: Number(ageYears.toFixed(2)),
      ageDays,
      dailyCost: Math.round(dailyCost),
      monthlyCost: Math.round(monthlyCost),
      retainedPercent: resale.breakdown?.retainedPercent ?? 0,
      assetName: String(asset.name || asset.assetName || 'Asset').trim(),
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Could not calculate cost-to-use',
      dailyCost: 0,
      monthlyCost: 0,
      estimatedResale: 0,
      ownershipCost: 0,
    };
  }
}

/**
 * Portfolio rollup for Home hero.
 * @param {Array<object>} assets
 */
export function summarizePortfolioCost(assets = []) {
  const list = (assets || []).filter((a) => !a?.deletedAt);
  let daily = 0;
  let monthly = 0;
  let resale = 0;
  let purchase = 0;
  for (const asset of list) {
    const row = calculateCostToUse(asset);
    if (!row.success) continue;
    daily += row.dailyCost;
    monthly += row.monthlyCost;
    resale += row.estimatedResale;
    purchase += row.purchaseValue;
  }
  return {
    dailyCost: Math.round(daily),
    monthlyCost: Math.round(monthly),
    totalResale: Math.round(resale),
    totalPurchase: Math.round(purchase),
    count: list.length,
  };
}

export default calculateCostToUse;

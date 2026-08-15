/**
 * Maintenance vs depreciation value — upgrade / review alert when repairs exceed market value.
 */

import { calculateResaleValue } from './resaleCalculator';
import { calculateDepreciation } from './depreciation';

/**
 * @param {object} asset
 * @param {{ maintenanceTotal?: number }} [opts]
 * @returns {null | {
 *   shouldAlert: boolean,
 *   maintenanceTotal: number,
 *   marketValue: number,
 *   bookValue: number,
 *   overspend: number,
 *   message: string,
 * }}
 */
export function evaluateMaintenanceVsValue(asset, opts = {}) {
  if (!asset) return null;
  const purchase = Number(asset.value || asset.purchasePrice || 0) || 0;
  if (purchase <= 0) return null;

  const maintenanceTotal =
    Number(opts.maintenanceTotal) ||
    Number(asset.totalMaintenanceCost) ||
    Number(asset.maintenanceSpend) ||
    (Array.isArray(asset.maintenanceHistory)
      ? asset.maintenanceHistory.reduce((s, r) => s + (Number(r.cost || r.amount) || 0), 0)
      : 0) ||
    0;

  if (maintenanceTotal <= 0) return null;

  const resale = calculateResaleValue({
    purchaseValue: purchase,
    purchaseDate: asset.purchaseDate,
    registrationYear: asset.registrationYear,
    categoryId: asset.categoryId,
    category: asset.category,
    condition: asset.condition || 'good',
  });
  const dep = calculateDepreciation({
    purchaseValue: purchase,
    purchaseDate: asset.purchaseDate,
    categoryId: asset.categoryId || 'other',
  });

  const marketValue = Number(resale.estimatedResale) || 0;
  const bookValue = Number(dep.bookValue) || 0;
  const floor = Math.max(marketValue, bookValue * 0.85);
  const shouldAlert = maintenanceTotal >= floor && floor > 0;
  const overspend = Math.round(maintenanceTotal - floor);

  return {
    shouldAlert,
    maintenanceTotal: Math.round(maintenanceTotal),
    marketValue: Math.round(marketValue),
    bookValue: Math.round(bookValue),
    overspend: Math.max(0, overspend),
    message: shouldAlert
      ? `Repairs (₹${Math.round(maintenanceTotal).toLocaleString('en-IN')}) are close to or above this asset’s estimated value (₹${Math.round(floor).toLocaleString('en-IN')}). Consider a service review or upgrade.`
      : `Maintenance spend is still below estimated value — looking healthy.`,
  };
}

/**
 * Portfolio-level list of assets that need upgrade review.
 */
export function findUpgradeReviewAlerts(assets = []) {
  return (assets || [])
    .filter((a) => a && !a.deletedAt)
    .map((a) => ({ asset: a, eval: evaluateMaintenanceVsValue(a) }))
    .filter((row) => row.eval?.shouldAlert)
    .slice(0, 5);
}

export default {
  evaluateMaintenanceVsValue,
  findUpgradeReviewAlerts,
};

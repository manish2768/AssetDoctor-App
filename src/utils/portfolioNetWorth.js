/**
 * Household net worth — sum of estimated current/resale values (not purchase price).
 */

import { getCurrentValuation } from '../components/ValuationBlock';
import { getAssetFolderType } from './assetFolders';

/**
 * @param {object[]} assets
 * @returns {{
 *   totalCurrent: number,
 *   totalPurchase: number,
 *   vehiclesCurrent: number,
 *   gadgetsCurrent: number,
 *   count: number,
 * }}
 */
export function summarizeHouseholdNetWorth(assets = []) {
  let totalCurrent = 0;
  let totalPurchase = 0;
  let vehiclesCurrent = 0;
  let gadgetsCurrent = 0;
  let count = 0;

  for (const asset of assets || []) {
    if (!asset || asset.deletedAt) continue;
    const v = getCurrentValuation(asset);
    const current = Number(v.current) || 0;
    const purchase = Number(v.purchase) || 0;
    if (current <= 0 && purchase <= 0) continue;
    count += 1;
    totalCurrent += current > 0 ? current : purchase;
    totalPurchase += purchase;
    const folder = getAssetFolderType(asset);
    if (folder === 'vehicle') {
      vehiclesCurrent += current > 0 ? current : purchase;
    } else if (folder === 'electronics' || folder === 'property') {
      gadgetsCurrent += current > 0 ? current : purchase;
    }
  }

  return {
    totalCurrent: Math.round(totalCurrent),
    totalPurchase: Math.round(totalPurchase),
    vehiclesCurrent: Math.round(vehiclesCurrent),
    gadgetsCurrent: Math.round(gadgetsCurrent),
    count,
  };
}

export default summarizeHouseholdNetWorth;

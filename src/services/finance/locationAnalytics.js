/**
 * Location-based ownership spend — uses recorded asset location fields only.
 * Never invents amounts.
 */

import { computeAssetOwnershipCost } from './ownershipCostEngine';
import { resolvePurchasePrice } from './valuationEngine';
import { formatInr } from './financeConstants';

function locationKey(asset = {}) {
  const path =
    asset.locationPath ||
    asset.locationLabel ||
    asset.room ||
    asset.location ||
    asset.placement ||
    '';
  const s = String(path).trim();
  return s || 'Unspecified';
}

/**
 * Aggregate ownership / purchase by location for authorized assets only.
 */
export function buildLocationAnalytics(assets = [], opts = {}) {
  const list = (assets || []).filter((a) => a && !a.deletedAt);
  const byLocation = {};

  for (const asset of list) {
    if (opts.actorUserId) {
      const owner = asset.ownerUid || asset.uid;
      if (owner && opts.actorUserId !== owner) {
        const ownership = String(asset.ownershipType || 'PERSONAL').toUpperCase();
        if (ownership === 'PERSONAL' || !asset.householdId) continue;
      }
    }
    const key = locationKey(asset);
    if (!byLocation[key]) {
      byLocation[key] = {
        location: key,
        count: 0,
        purchaseValue: 0,
        ownershipCost: 0,
        repair: 0,
        service: 0,
        assets: [],
      };
    }
    const id = asset.assetId || asset.id;
    const expenseRows = opts.expenseRowsByAsset?.[id] || opts.expenseRows || [];
    const purchase = resolvePurchasePrice(asset);
    const ownership = computeAssetOwnershipCost(asset, { ...opts, expenseRows });
    const bucket = byLocation[key];
    bucket.count += 1;
    if (purchase.available) bucket.purchaseValue += purchase.value;
    bucket.ownershipCost += ownership.totalOwnershipCost || 0;
    bucket.repair += ownership.repair || 0;
    bucket.service += ownership.service || 0;
    bucket.assets.push({
      assetId: id,
      name: asset.nickname || asset.assetName || 'Asset',
      categoryId: asset.categoryId,
      ownershipCost: ownership.totalOwnershipCost,
    });
  }

  const rows = Object.values(byLocation)
    .map((r) => ({
      ...r,
      purchaseValue: Math.round(r.purchaseValue),
      ownershipCost: Math.round(r.ownershipCost),
      repair: Math.round(r.repair),
      service: Math.round(r.service),
    }))
    .sort((a, b) => b.ownershipCost - a.ownershipCost);

  return {
    available: rows.length > 0,
    rows,
    totalLocations: rows.length,
    formatInr,
    source: 'Actual Recorded / User Entered locations',
    queryHint: 'Filter by categoryId (e.g. ac) then sum ownershipCost for "How much spent on ACs?"',
  };
}

export function spendForCategoryAtLocations(assets = [], categoryId, opts = {}) {
  const cat = String(categoryId || '').toLowerCase();
  const filtered = (assets || []).filter(
    (a) => !a.deletedAt && String(a.categoryId || '').toLowerCase() === cat,
  );
  return buildLocationAnalytics(filtered, opts);
}

export default { buildLocationAnalytics, spendForCategoryAtLocations };

/**
 * Ownership cost + repair-vs-replace insight (safe language).
 */

export function computeOwnershipCost(asset = {}, opts = {}) {
  const purchase =
    Number(asset.purchasePrice ?? asset.value ?? 0) || 0;
  const service = Number(opts.serviceCost ?? asset.serviceCostTotal ?? 0) || 0;
  const repair = Number(opts.repairCost ?? asset.repairCostTotal ?? 0) || 0;
  const insurance = Number(opts.insuranceCost ?? asset.insurancePremiumTotal ?? asset.annualInsurancePremium ?? 0) || 0;
  const accessories = Number(opts.accessoriesCost ?? asset.accessoriesCostTotal ?? 0) || 0;
  const other = Number(opts.otherCost ?? asset.otherCostTotal ?? 0) || 0;
  const energy = Number(opts.energyCost ?? asset.energyCostTotal ?? 0) || 0;

  const total = Math.round(purchase + service + repair + insurance + accessories + other + energy);

  return {
    purchase: Math.round(purchase),
    service: Math.round(service),
    repair: Math.round(repair),
    insurance: Math.round(insurance),
    accessories: Math.round(accessories),
    other: Math.round(other),
    energy: Math.round(energy),
    totalOwnershipCost: total,
    label: 'Total Ownership Cost',
  };
}

/**
 * Soft repair-vs-replace insight — never says "Replace it".
 */
export function repairVsReplaceInsight(asset = {}, opts = {}) {
  const purchase = Number(asset.purchasePrice ?? asset.value ?? 0) || 0;
  const estimatedValue =
    Number(opts.currentEstimatedValue ?? asset.currentEstimatedValue ?? asset.estimatedResale ?? asset.bookValue) ||
    0;
  const repairCost = Number(opts.repairCost ?? 0) || 0;
  if (!(purchase > 0) || !(repairCost > 0) || !(estimatedValue > 0)) return null;

  const ratio = repairCost / estimatedValue;
  if (ratio < 0.4) return null;

  return {
    type: 'REPAIR_VS_VALUE',
    priority: ratio >= 0.8 ? 'HIGH' : 'MEDIUM',
    confidence: 0.7,
    source: 'ownership_cost',
    reason: 'repair_cost_vs_estimated_value',
    message:
      'Repair cost is significant compared with the estimated current value. Consider comparing repair cost with replacement options.',
    purchase,
    currentEstimatedValue: Math.round(estimatedValue),
    estimatedValueLabel: 'Estimated Current Value',
    repairCost: Math.round(repairCost),
    ratio: Math.round(ratio * 100) / 100,
  };
}

export default { computeOwnershipCost, repairVsReplaceInsight };

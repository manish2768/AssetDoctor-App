/**
 * Energy cost analytics for portfolio / multi-AC dashboards.
 * Always labels estimates unless actual meter data.
 */

import { aggregateHouseholdEnergy, ENERGY_CALC_METHOD } from '../assets/energyIntelligence';
import { DEFAULT_TARIFF_PER_KWH } from '../../theme/branding';
import { getAssetFolderType } from '../../utils/assetFolders';

export function buildEnergyCostDashboard(assets = [], opts = {}) {
  const tariff = Number(opts.tariffPerKwh) || DEFAULT_TARIFF_PER_KWH;
  const household = aggregateHouseholdEnergy(assets, tariff);

  const acs = (assets || [])
    .filter((a) => a && !a.deletedAt)
    .filter((a) => String(a.categoryId || '').toLowerCase() === 'ac')
    .map((a) => {
      const kwh = a.energyProfile?.estimatedMonthlyConsumptionKwh;
      const cost = a.energyProfile?.estimatedMonthlyCost;
      return {
        assetId: a.assetId || a.id,
        name: a.nickname || a.assetName || 'AC',
        locationPath: a.locationPath || '',
        monthlyKwh: kwh != null ? Number(kwh) : null,
        monthlyCost: cost != null ? Number(cost) : null,
        starRating: a.specifications?.starRating?.value ?? a.starRating ?? null,
        isEstimate: a.energyProfile?.calculationMethod !== ENERGY_CALC_METHOD.ACTUAL_METER,
      };
    })
    .filter((r) => r.monthlyCost != null || r.monthlyKwh != null)
    .sort((a, b) => (b.monthlyCost || 0) - (a.monthlyCost || 0));

  const acTotalCost = acs.reduce((s, r) => s + (r.monthlyCost || 0), 0);
  const acTotalKwh = acs.reduce((s, r) => s + (r.monthlyKwh || 0), 0);

  return {
    isEstimate: household.isEstimate !== false,
    displayPrefix: '~',
    label: 'Estimated Energy Cost',
    electricityTariff: tariff,
    household,
    acDashboard: {
      label: 'Home AC Energy (Estimated)',
      rows: acs,
      totalMonthlyCost: Math.round(acTotalCost),
      totalMonthlyKwh: Math.round(acTotalKwh * 10) / 10,
      highest: acs[0] || null,
      lowest: acs.length ? acs[acs.length - 1] : null,
    },
    comparisonMessage: acs[0]
      ? `${acs[0].name} has the highest estimated consumption.`
      : null,
  };
}

export function estimatedEnergyCostForAsset(asset = {}, tariffPerKwh = DEFAULT_TARIFF_PER_KWH) {
  const ep = asset.energyProfile;
  if (ep?.estimatedMonthlyCost != null) {
    return {
      available: true,
      monthlyCost: Number(ep.estimatedMonthlyCost),
      monthlyKwh: ep.estimatedMonthlyConsumptionKwh ?? null,
      isEstimate: ep.calculationMethod !== ENERGY_CALC_METHOD.ACTUAL_METER,
      label:
        ep.calculationMethod === ENERGY_CALC_METHOD.ACTUAL_METER
          ? 'Energy Cost'
          : 'Estimated Energy Cost',
      calculationLabel: ep.calculationLabel || null,
    };
  }
  if (asset.powerWatts || asset.wattage) {
    const watts = Number(asset.wattage || asset.powerWatts) || 0;
    const hours = Number(asset.avgDailyHours || asset.dailyHours) || 0;
    const monthlyKwh = (watts / 1000) * hours * 30;
    const monthlyCost = Math.round(monthlyKwh * tariffPerKwh);
    if (!(monthlyKwh > 0)) return { available: false, label: 'Estimate unavailable' };
    return {
      available: true,
      monthlyCost,
      monthlyKwh: Math.round(monthlyKwh * 10) / 10,
      isEstimate: true,
      label: 'Estimated Energy Cost',
      calculationLabel: 'Estimated from rated power and usage',
    };
  }
  return { available: false, label: 'Estimate unavailable' };
}

export function portfolioEnergyByFolder(assets = [], tariffPerKwh = DEFAULT_TARIFF_PER_KWH) {
  const dash = buildEnergyCostDashboard(assets, { tariffPerKwh });
  const byFolder = {};
  for (const row of dash.household.byAsset || []) {
    const asset = (assets || []).find((a) => (a.assetId || a.id) === row.assetId);
    const folder = asset ? getAssetFolderType(asset) : 'other';
    if (!byFolder[folder]) byFolder[folder] = { monthlyCost: 0, monthlyKwh: 0, count: 0 };
    byFolder[folder].monthlyCost += row.monthlyCost || 0;
    byFolder[folder].monthlyKwh += row.monthlyKwh || 0;
    byFolder[folder].count += 1;
  }
  return { ...dash, byFolder };
}

export default {
  buildEnergyCostDashboard,
  estimatedEnergyCostForAsset,
  portfolioEnergyByFolder,
};

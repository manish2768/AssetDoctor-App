/**
 * Appliance Energy & Bill Estimator
 * kWh = (Watts × Hours × Power Factor) / 1000
 * Only powered Electronics & Appliances contribute to the bill estimate.
 */

import { DEFAULT_TARIFF_PER_KWH, ASSET_CATEGORY_OPTIONS } from '../theme/branding';
import { toISODate } from './dates';

export const APPLIANCE_GROUP = 'Electronics & Appliances';

/**
 * @param {object} params
 * @param {number} params.powerWatts - nameplate / rated watts
 * @param {number} params.hoursUsed - hours in the period
 * @param {number} [params.powerFactor] - 0–1 electrical/load factor (AC motors ~0.85)
 * @param {number} [params.tariffPerKwh]
 * @returns {{ kwh: number, costInr: number, powerFactor: number, formula: string }}
 */
export function estimatePowerCost({
  powerWatts = 0,
  hoursUsed = 0,
  powerFactor = 1,
  tariffPerKwh = DEFAULT_TARIFF_PER_KWH,
} = {}) {
  const watts = Math.max(0, Number(powerWatts) || 0);
  const hours = Math.max(0, Number(hoursUsed) || 0);
  const pf = clampPowerFactor(powerFactor);
  const tariff = Math.max(0, Number(tariffPerKwh) || DEFAULT_TARIFF_PER_KWH);
  const kwh = (watts * hours * pf) / 1000;
  const costInr = kwh * tariff;
  return {
    kwh: Number(kwh.toFixed(3)),
    costInr: Number(costInr.toFixed(2)),
    powerFactor: pf,
    formula: `${watts}W × ${hours}h × PF ${pf} ÷ 1000`,
  };
}

export function clampPowerFactor(value) {
  const pf = Number(value);
  if (!Number.isFinite(pf) || pf <= 0) return 1;
  return Math.min(1, Math.max(0.3, pf));
}

export function getCategoryPowerMeta(categoryId) {
  const found = ASSET_CATEGORY_OPTIONS.find((c) => c.id === categoryId);
  return {
    powerWatts: found?.powerWatts ?? 0,
    powerFactor: found?.powerFactor ?? 1,
    dailyHours: found?.dailyHours ?? 0,
    isAppliance: found?.group === APPLIANCE_GROUP && Number(found?.powerWatts) > 0,
  };
}

export function defaultWattsForCategory(categoryId) {
  return getCategoryPowerMeta(categoryId).powerWatts;
}

export function defaultPowerFactorForCategory(categoryId) {
  return getCategoryPowerMeta(categoryId).powerFactor;
}

export function defaultDailyHoursForCategory(categoryId) {
  return getCategoryPowerMeta(categoryId).dailyHours;
}

export function isApplianceAsset(asset) {
  if (!asset) return false;
  const meta = getCategoryPowerMeta(asset.categoryId);
  if (meta.isAppliance) return true;
  const group = String(asset.category || asset.categoryLabel || '').toLowerCase();
  const watts = Number(asset.powerWatts) || meta.powerWatts;
  return watts > 0 && (group.includes('electronic') || group.includes('appliance'));
}

export function resolveAppliancePower(asset = {}) {
  const meta = getCategoryPowerMeta(asset.categoryId);
  const powerWatts = Number(asset.powerWatts) || meta.powerWatts || 0;
  const powerFactor = clampPowerFactor(
    asset.powerFactor != null && asset.powerFactor !== ''
      ? asset.powerFactor
      : meta.powerFactor,
  );
  const dailyHours =
    Number(asset.dailyHours) > 0 ? Number(asset.dailyHours) : meta.dailyHours || 0;
  return { powerWatts, powerFactor, dailyHours };
}

/**
 * Build a daily log payload for Firestore PowerLogs
 */
export function buildDailyPowerLog({
  assetId,
  assetName,
  powerWatts,
  hoursUsed,
  powerFactor = 1,
  tariffPerKwh = DEFAULT_TARIFF_PER_KWH,
  date = toISODate(),
}) {
  const estimate = estimatePowerCost({
    powerWatts,
    hoursUsed,
    powerFactor,
    tariffPerKwh,
  });
  return {
    assetId,
    assetName: assetName || '',
    date,
    hoursUsed: Number(hoursUsed) || 0,
    powerWatts: Number(powerWatts) || 0,
    powerFactor: estimate.powerFactor,
    tariffPerKwh,
    kwh: estimate.kwh,
    costInr: estimate.costInr,
  };
}

/**
 * Live daily + monthly bill estimate across owned appliances only.
 */
export function estimatePortfolioDailyCost(assets = [], tariffPerKwh = DEFAULT_TARIFF_PER_KWH) {
  const breakdown = [];
  let kwh = 0;
  let costInr = 0;

  for (const asset of assets) {
    if (!isApplianceAsset(asset)) continue;
    if (asset.deletedAt) continue;
    const status = String(asset.status || 'active');
    if (status === 'sold' || status === 'retired') continue;

    const { powerWatts, powerFactor, dailyHours } = resolveAppliancePower(asset);
    if (!powerWatts || !dailyHours) continue;

    const day = estimatePowerCost({
      powerWatts,
      hoursUsed: dailyHours,
      powerFactor,
      tariffPerKwh,
    });
    kwh += day.kwh;
    costInr += day.costInr;
    breakdown.push({
      assetId: asset.assetId || asset.id,
      assetName: asset.assetName || 'Appliance',
      icon: asset.icon || '🔌',
      powerWatts,
      powerFactor,
      dailyHours,
      dailyKwh: day.kwh,
      dailyCostInr: day.costInr,
      monthlyKwh: Number((day.kwh * 30).toFixed(2)),
      monthlyCostInr: Number((day.costInr * 30).toFixed(2)),
      formula: day.formula,
    });
  }

  breakdown.sort((a, b) => b.monthlyCostInr - a.monthlyCostInr);

  return {
    kwh: Number(kwh.toFixed(3)),
    costInr: Number(costInr.toFixed(2)),
    monthlyKwh: Number((kwh * 30).toFixed(2)),
    monthlyCostInr: Number((costInr * 30).toFixed(2)),
    yearlyCostInr: Number((costInr * 365).toFixed(2)),
    tracked: breakdown.length,
    tariffPerKwh: Number(tariffPerKwh) || DEFAULT_TARIFF_PER_KWH,
    breakdown,
  };
}

/**
 * Parse labeled wattage / power-factor from appliance invoice text only.
 * Not part of the vault OCR allowlist — energy UI metadata only.
 */
export function extractApplianceEnergyFromText(rawText = '') {
  const text = String(rawText || '');
  if (!text.trim()) {
    return { success: false, powerWatts: null, powerFactor: null };
  }

  let powerWatts = null;
  const wattPatterns = [
    /(?:rated\s*)?(?:power|wattage|input|consumption)\s*[:\-]?\s*(\d{2,5})\s*(?:w|watt|watts)\b/i,
    /\b(\d{2,5})\s*(?:w|watt|watts)\b/i,
    /\b(\d(?:\.\d+)?)\s*kw\b/i,
  ];
  for (const re of wattPatterns) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    powerWatts = /kw/i.test(m[0]) ? Math.round(n * 1000) : Math.round(n);
    if (powerWatts >= 5 && powerWatts <= 20000) break;
    powerWatts = null;
  }

  let powerFactor = null;
  const pfMatch = text.match(
    /(?:power\s*factor|p\.?\s*f\.?|cos\s*[φf])\s*[:\-]?\s*(0?\.\d{1,3}|1(?:\.0+)?)/i,
  );
  if (pfMatch?.[1]) {
    const pf = Number(pfMatch[1]);
    if (Number.isFinite(pf) && pf >= 0.3 && pf <= 1) powerFactor = clampPowerFactor(pf);
  }

  return {
    success: powerWatts != null || powerFactor != null,
    powerWatts,
    powerFactor,
  };
}

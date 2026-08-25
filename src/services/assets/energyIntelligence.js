/**
 * Energy intelligence foundation — local math only; always label estimates.
 * Reuses EnergyService / powerCost; adds EV helpers + EnergyProfile shape.
 */

import { DEFAULT_TARIFF_PER_KWH } from '../../theme/branding';
import {
  assignEnergyFieldsOnCreate,
  resolveDefaultPowerRating,
} from '../energy/EnergyService';
import { classifyFromCategoryId, ASSET_CATEGORY, POWERTRAIN } from './assetTaxonomy';

export const ENERGY_CALC_METHOD = Object.freeze({
  ACTUAL_METER: 'actual_meter',
  MANUFACTURER_ANNUAL: 'manufacturer_annual',
  RATED_POWER_USAGE: 'rated_power_usage',
  MODEL_ESTIMATE: 'model_estimate',
  CATEGORY_DEFAULT: 'category_default',
});

export function energyMethodLabel(method) {
  switch (method) {
    case ENERGY_CALC_METHOD.ACTUAL_METER:
      return 'Actual consumption';
    case ENERGY_CALC_METHOD.MANUFACTURER_ANNUAL:
      return 'Based on manufacturer specification';
    case ENERGY_CALC_METHOD.RATED_POWER_USAGE:
      return 'Estimated from rated power and usage';
    case ENERGY_CALC_METHOD.MODEL_ESTIMATE:
      return 'Estimated from model specification';
    default:
      return 'Estimated from category defaults';
  }
}

/**
 * Canonical appliance energy formula (local math only — never invents watts/hours):
 *   Monthly kWh  = (Watts / 1000) × Hours/Day × Days/Month
 *   Monthly Cost = Monthly kWh × Electricity Tariff (₹/kWh)
 * Voltage is stored for display/specs; it does not alter kWh when wattage is known.
 */
export function estimateApplianceEnergy({
  ratedPowerWatts = 0,
  usageHoursPerDay = 0,
  usageDaysPerMonth = 30,
  tariffPerKwh = DEFAULT_TARIFF_PER_KWH,
  voltage = null,
  method = ENERGY_CALC_METHOD.RATED_POWER_USAGE,
} = {}) {
  const watts = Math.max(0, Number(ratedPowerWatts) || 0);
  const hours = Math.max(0, Number(usageHoursPerDay) || 0);
  const days = Math.max(0, Number(usageDaysPerMonth) || 0);
  const tariff = Math.max(0, Number(tariffPerKwh) || DEFAULT_TARIFF_PER_KWH);
  const volts =
    voltage != null && Number(voltage) > 0 ? Number(voltage) : null;
  // Monthly kWh = (W/1000) × h/day × days/month
  const dailyKwh = (watts / 1000) * hours;
  const monthlyKwh = dailyKwh * days;
  const yearlyKwh = dailyKwh * 365;
  return {
    isEstimate: method !== ENERGY_CALC_METHOD.ACTUAL_METER,
    displayPrefix: method === ENERGY_CALC_METHOD.ACTUAL_METER ? '' : '~',
    calculationMethod: method,
    calculationLabel: energyMethodLabel(method),
    formula: 'Monthly kWh = (W/1000) × Hours/Day × Days/Month; Cost = kWh × Tariff',
    ratedPowerWatts: watts,
    powerRatingWatts: watts,
    voltage: volts,
    usageHoursPerDay: hours,
    usageDaysPerMonth: days,
    electricityTariff: tariff,
    estimatedDailyConsumptionKwh: round1(dailyKwh),
    estimatedMonthlyConsumptionKwh: round1(monthlyKwh),
    estimatedYearlyConsumptionKwh: round1(yearlyKwh),
    estimatedDailyCost: Math.round(dailyKwh * tariff),
    estimatedMonthlyCost: Math.round(monthlyKwh * tariff),
    estimatedYearlyCost: Math.round(yearlyKwh * tariff),
    confidence: method === ENERGY_CALC_METHOD.ACTUAL_METER ? 0.95 : 0.55,
  };
}

/**
 * EV energy helpers — all estimates unless actual trip data provided.
 */
export function estimateEvEnergy({
  batteryCapacityKwh = 0,
  consumptionKwhPer100Km = 0,
  tariffPerKwh = DEFAULT_TARIFF_PER_KWH,
  rangeKm = null,
} = {}) {
  const battery = Math.max(0, Number(batteryCapacityKwh) || 0);
  const cons = Math.max(0, Number(consumptionKwhPer100Km) || 0);
  const tariff = Math.max(0, Number(tariffPerKwh) || DEFAULT_TARIFF_PER_KWH);
  const costPer100 = cons * tariff;
  const costPerKm = cons > 0 ? costPer100 / 100 : 0;
  const derivedRange = rangeKm != null ? Number(rangeKm) : cons > 0 && battery > 0 ? (battery / cons) * 100 : null;
  return {
    isEstimate: true,
    displayPrefix: '~',
    batteryCapacityKwh: battery,
    energyConsumptionPer100Km: cons,
    rangeKm: derivedRange != null ? Math.round(derivedRange) : null,
    electricityTariff: tariff,
    estimatedCostPer100Km: Math.round(costPer100),
    estimatedCostPerKm: Math.round(costPerKm * 100) / 100,
    calculationLabel: 'Estimated from battery and consumption',
  };
}

/**
 * Charging calculator — accounts for efficiency losses.
 */
export function estimateEvCharging({
  batteryCapacityKwh = 0,
  currentPercent = 0,
  targetPercent = 100,
  efficiency = 0.9,
  chargingPowerKw = 7.2,
  tariffPerKwh = DEFAULT_TARIFF_PER_KWH,
} = {}) {
  const cap = Math.max(0, Number(batteryCapacityKwh) || 0);
  const from = Math.max(0, Math.min(100, Number(currentPercent) || 0));
  const to = Math.max(from, Math.min(100, Number(targetPercent) || 100));
  const eff = Math.max(0.5, Math.min(1, Number(efficiency) || 0.9));
  const power = Math.max(0.1, Number(chargingPowerKw) || 7.2);
  const tariff = Math.max(0, Number(tariffPerKwh) || DEFAULT_TARIFF_PER_KWH);
  const netKwh = cap * ((to - from) / 100);
  const requiredKwh = netKwh / eff;
  const hours = requiredKwh / power;
  return {
    isEstimate: true,
    displayPrefix: '~',
    energyRequiredKwh: round1(requiredKwh),
    estimatedChargingCost: Math.round(requiredKwh * tariff),
    estimatedChargingHours: Math.round(hours * 10) / 10,
    calculationLabel: 'Estimated charging (includes efficiency losses)',
  };
}

/**
 * Build EnergyProfile for create/update — merge flat EnergyService fields + profile object.
 */
export function buildEnergyProfileOnCreate(form = {}, base = {}) {
  const flat = assignEnergyFieldsOnCreate({ ...form, ...base });
  const tax = classifyFromCategoryId(base.categoryId || form.categoryId, base.assetName || form.assetName);
  const tariff = Number(form.electricityTariff) || DEFAULT_TARIFF_PER_KWH;

  if (tax.powertrain === POWERTRAIN.ELECTRIC) {
    const batteryKwh =
      Number(form.batteryCapacityKwh) ||
      Number(form.specifications?.batteryCapacity?.value) ||
      0;
    const cons =
      Number(form.energyConsumptionPer100Km) ||
      Number(form.specifications?.energyPer100Km?.value) ||
      0;
    const ev = estimateEvEnergy({
      batteryCapacityKwh: batteryKwh,
      consumptionKwhPer100Km: cons,
      tariffPerKwh: tariff,
      rangeKm: form.rangeKm,
    });
    return {
      ...flat,
      energyProfile: {
        ...ev,
        assetCategory: tax.assetCategory,
        calculationMethod: ENERGY_CALC_METHOD.MODEL_ESTIMATE,
      },
    };
  }

  if (tax.assetCategory === ASSET_CATEGORY.HOME_APPLIANCE || flat.isElectricAppliance) {
    const watts = Number(flat.wattage || flat.powerWatts || base.powerWatts) || 0;
    const hours = Number(flat.avgDailyHours || base.dailyHours) || 0;
    const days =
      Number(form.usageDaysPerMonth) > 0
        ? Number(form.usageDaysPerMonth)
        : Number(flat.usageDaysPerMonth) > 0
          ? Number(flat.usageDaysPerMonth)
          : 30;
    const voltage =
      Number(form.voltage) > 0
        ? Number(form.voltage)
        : Number(flat.voltage) > 0
          ? Number(flat.voltage)
          : null;
    const est = estimateApplianceEnergy({
      ratedPowerWatts: watts,
      usageHoursPerDay: hours,
      usageDaysPerMonth: days,
      tariffPerKwh: tariff,
      voltage,
      method: watts > 0 ? ENERGY_CALC_METHOD.RATED_POWER_USAGE : ENERGY_CALC_METHOD.CATEGORY_DEFAULT,
    });
    return {
      ...flat,
      voltage: voltage ?? flat.voltage ?? null,
      usageDaysPerMonth: days,
      electricityTariff: tariff,
      energyProfile: {
        ...est,
        starRating: form.starRating != null ? Number(form.starRating) : null,
        assetCategory: tax.assetCategory,
      },
    };
  }

  return { ...flat, energyProfile: null };
}

export function aggregateHouseholdEnergy(assets = [], tariffPerKwh = DEFAULT_TARIFF_PER_KWH) {
  const rows = [];
  let monthlyKwh = 0;
  let monthlyCost = 0;
  for (const a of assets || []) {
    const profile = a.energyProfile;
    if (profile?.estimatedMonthlyConsumptionKwh > 0) {
      monthlyKwh += profile.estimatedMonthlyConsumptionKwh;
      monthlyCost += profile.estimatedMonthlyCost || 0;
      rows.push({
        assetId: a.assetId || a.id,
        name: a.nickname || a.assetName,
        monthlyKwh: profile.estimatedMonthlyConsumptionKwh,
        monthlyCost: profile.estimatedMonthlyCost,
        powerWatts: profile.ratedPowerWatts ?? a.powerWatts ?? a.wattage ?? null,
        usageHoursPerDay: profile.usageHoursPerDay ?? a.avgDailyHours ?? a.dailyHours ?? null,
      });
      continue;
    }
    if (a.isElectricAppliance || a.wattage || a.powerWatts) {
      const watts = Number(a.wattage || a.powerWatts) || 0;
      const hours = Number(a.avgDailyHours || a.dailyHours) || 0;
      const days =
        Number(a.usageDaysPerMonth || a.energyProfile?.usageDaysPerMonth) > 0
          ? Number(a.usageDaysPerMonth || a.energyProfile?.usageDaysPerMonth)
          : 30;
      const tariff =
        Number(a.electricityTariff || a.energyProfile?.electricityTariff) > 0
          ? Number(a.electricityTariff || a.energyProfile?.electricityTariff)
          : tariffPerKwh;
      const est = estimateApplianceEnergy({
        ratedPowerWatts: watts,
        usageHoursPerDay: hours,
        usageDaysPerMonth: days,
        tariffPerKwh: tariff,
        voltage: a.voltage ?? a.energyProfile?.voltage,
      });
      if (!(est.estimatedMonthlyConsumptionKwh > 0)) continue;
      monthlyKwh += est.estimatedMonthlyConsumptionKwh;
      monthlyCost += est.estimatedMonthlyCost;
      rows.push({
        assetId: a.assetId || a.id,
        name: a.nickname || a.assetName,
        monthlyKwh: est.estimatedMonthlyConsumptionKwh,
        monthlyCost: est.estimatedMonthlyCost,
        powerWatts: watts,
        usageHoursPerDay: hours,
      });
    }
  }
  rows.sort((x, y) => y.monthlyKwh - x.monthlyKwh);
  return {
    isEstimate: true,
    displayPrefix: '~',
    electricityTariff: tariffPerKwh,
    estimatedMonthlyConsumptionKwh: round1(monthlyKwh),
    estimatedMonthlyCost: Math.round(monthlyCost),
    estimatedYearlyConsumptionKwh: round1(monthlyKwh * 12),
    estimatedYearlyCost: Math.round(monthlyCost * 12),
    topConsumers: rows.slice(0, 8),
    highestConsumer: rows[0] || null,
    byAsset: rows,
    calculationLabel: 'Estimated household energy (usage assumptions apply)',
    formula: 'Monthly kWh = (W/1000) × Hours/Day × Days/Month',
  };
}

/**
 * Collect real electricity-bill month snapshots from assets (OCR / saved bills only).
 * Never fabricates prior-month totals.
 */
export function collectElectricityBillMonths(assets = []) {
  const months = [];
  for (const a of assets || []) {
    if (!a || a.deletedAt) continue;
    const bills = [];
    if (a.canonicalElectricityBill) bills.push(a.canonicalElectricityBill);
    if (a.electricityBill) bills.push(a.electricityBill);
    if (a.invoiceMeta?.electricityBill) bills.push(a.invoiceMeta.electricityBill);
    if (Array.isArray(a.electricityBillHistory)) bills.push(...a.electricityBillHistory);
    const isBillAsset =
      a.categoryId === 'electricity_bill' ||
      a.documentType === 'electricity_bill' ||
      a.scanDocumentType === 'electricity_bill';
    if (isBillAsset) {
      bills.push({
        unitsConsumed: a.unitsConsumed ?? a.unitsKwh ?? a.totalUnits,
        totalAmount: a.totalAmount ?? a.value,
        billingPeriod: a.billingPeriod || a.billPeriod,
        dueDate: a.dueDate,
        tariff: a.tariff ?? a.electricityTariff,
      });
    }
    for (const bill of bills) {
      if (!bill || typeof bill !== 'object') continue;
      const units = Number(
        bill.unitsConsumed ?? bill.unitsKwh ?? bill.totalUnits ?? bill.units,
      );
      const cost = Number(bill.totalAmount ?? bill.amountPayable ?? bill.energyCharges);
      if (!Number.isFinite(units) && !Number.isFinite(cost)) continue;
      if (!(units > 0) && !(cost > 0)) continue;
      const periodKey =
        normalizeBillPeriodKey(bill.billingPeriod || bill.billPeriod || bill.dueDate) ||
        null;
      months.push({
        periodKey,
        billingPeriod: bill.billingPeriod || bill.billPeriod || null,
        unitsKwh: Number.isFinite(units) && units > 0 ? round1(units) : null,
        costInr: Number.isFinite(cost) && cost > 0 ? Math.round(cost) : null,
        source: 'electricity_bill',
      });
    }
  }
  months.sort((a, b) => String(b.periodKey || '').localeCompare(String(a.periodKey || '')));
  return months;
}

function normalizeBillPeriodKey(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const iso = s.match(/(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const dmy = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}`;
  const monYear = s.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-./]*(\d{4})\b/i,
  );
  if (monYear) {
    const map = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    const m = map[monYear[1].slice(0, 3).toLowerCase()];
    return m ? `${monYear[2]}-${m}` : null;
  }
  return s.slice(0, 16);
}

/**
 * Previous vs current month from real bill snapshots only.
 * @returns {{ available: boolean, changePct: number|null, message: string, current, previous }}
 */
export function compareBillMonths(assets = []) {
  const months = collectElectricityBillMonths(assets);
  if (months.length < 2) {
    return {
      available: false,
      changePct: null,
      message: 'Not enough data yet.',
      current: months[0] || null,
      previous: null,
    };
  }
  const current = months[0];
  const previous = months[1];
  let changePct = null;
  if (
    current.unitsKwh != null &&
    previous.unitsKwh != null &&
    previous.unitsKwh > 0
  ) {
    changePct = Math.round(((current.unitsKwh - previous.unitsKwh) / previous.unitsKwh) * 1000) / 10;
  } else if (
    current.costInr != null &&
    previous.costInr != null &&
    previous.costInr > 0
  ) {
    changePct = Math.round(((current.costInr - previous.costInr) / previous.costInr) * 1000) / 10;
  }
  if (changePct == null) {
    return {
      available: false,
      changePct: null,
      message: 'Not enough data yet.',
      current,
      previous,
    };
  }
  return {
    available: true,
    changePct,
    message:
      changePct === 0
        ? 'Consumption unchanged vs prior bill.'
        : changePct > 0
          ? `Up ${changePct}% vs prior bill.`
          : `Down ${Math.abs(changePct)}% vs prior bill.`,
    current,
    previous,
  };
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

export default {
  ENERGY_CALC_METHOD,
  energyMethodLabel,
  estimateApplianceEnergy,
  estimateEvEnergy,
  estimateEvCharging,
  buildEnergyProfileOnCreate,
  aggregateHouseholdEnergy,
  collectElectricityBillMonths,
  compareBillMonths,
  resolveDefaultPowerRating,
};

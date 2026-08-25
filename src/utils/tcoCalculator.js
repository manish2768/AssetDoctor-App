/**
 * Total Cost of Ownership (TCO)
 * purchaseValue + repair costs + insurance premiums + power running costs - salvage/sale
 */

import { calculateDepreciation } from './depreciation';
import { yearsSince } from './dates';

/**
 * @param {object} params
 * @param {object} params.asset
 * @param {Array<{ costInr?: number }>} [params.repairs]
 * @param {Array<{ costInr?: number }>} [params.powerLogs]
 * @param {number} [params.annualInsurancePremium]
 * @param {number} [params.otherCosts]
 * @returns {{ tco: number, breakdown: object, bookValue: number, costPerYear: number }}
 */
export function calculateTCO({
  asset = {},
  repairs = [],
  powerLogs = [],
  annualInsurancePremium = 0,
  otherCosts = 0,
} = {}) {
  const purchase = Number(asset.value) || 0;
  const repairTotal = repairs.reduce((s, r) => s + (Number(r.costInr) || 0), 0);
  const powerTotal = powerLogs.reduce((s, l) => s + (Number(l.costInr) || 0), 0);

  const ageYears = Math.max(yearsSince(asset.purchaseDate), 1 / 12);
  const insuranceTotal =
    Number(asset.insurancePremiumTotal) ||
    annualInsurancePremium * ageYears ||
    (Number(asset.annualInsurancePremium) || 0) * ageYears;

  const saleCredit =
    asset.status === 'sold' ? Number(asset.salePrice) || 0 : 0;

  const tco = Math.round(
    purchase + repairTotal + powerTotal + insuranceTotal + (Number(otherCosts) || 0) - saleCredit,
  );

  const dep = calculateDepreciation({
    purchaseValue: purchase,
    purchaseDate: asset.purchaseDate,
    categoryId: asset.categoryId,
  });

  return {
    tco: Math.max(0, tco),
    bookValue: dep.bookValue,
    costPerYear: Math.round(Math.max(0, tco) / ageYears),
    breakdown: {
      purchase,
      repairs: Math.round(repairTotal),
      power: Math.round(powerTotal),
      insurance: Math.round(insuranceTotal),
      other: Math.round(Number(otherCosts) || 0),
      saleCredit: Math.round(saleCredit),
      accumulatedDepreciation: dep.accumulatedDepreciation,
    },
  };
}

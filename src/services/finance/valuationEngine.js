/**
 * Asset valuation — always label estimates. Never invent missing values.
 */

import { calculateResaleValue } from '../../utils/resaleCalculator';
import { calculateDepreciation } from '../../utils/depreciation';
import { yearsSince } from '../../utils/dates';
import { resolveUsefulLifeYears } from './depreciationRates';
import { CURRENCY_INR, VALUE_SOURCE, DEPRECIATION_METHOD } from './financeConstants';

/**
 * Resolve purchase price without inventing.
 */
export function resolvePurchasePrice(asset = {}) {
  const n = Number(asset.purchasePrice ?? asset.value);
  if (!Number.isFinite(n) || n <= 0) {
    return {
      available: false,
      value: null,
      label: 'Not available',
      currencyCode: asset.currencyCode || CURRENCY_INR,
    };
  }
  return {
    available: true,
    value: Math.round(n),
    label: 'Purchase Value',
    currencyCode: asset.currencyCode || CURRENCY_INR,
  };
}

/**
 * Configurable depreciation — default PERCENTAGE = existing category rates.
 */
export function calculateConfigurableDepreciation(asset = {}, opts = {}) {
  const purchase = resolvePurchasePrice(asset);
  if (!purchase.available) {
    return {
      available: false,
      method: opts.method || asset.depreciationMethod || DEPRECIATION_METHOD.PERCENTAGE,
      bookValue: null,
      accumulatedDepreciation: null,
      label: 'Estimate unavailable',
      isEstimate: true,
    };
  }

  const method =
    opts.method || asset.depreciationMethod || DEPRECIATION_METHOD.PERCENTAGE;

  if (method === DEPRECIATION_METHOD.NONE) {
    return {
      available: true,
      method,
      bookValue: purchase.value,
      accumulatedDepreciation: 0,
      label: 'Estimated (no depreciation)',
      isEstimate: true,
    };
  }

  if (method === DEPRECIATION_METHOD.USER_DEFINED && asset.currentEstimatedValue != null) {
    const cur = Number(asset.currentEstimatedValue);
    if (Number.isFinite(cur) && cur >= 0) {
      return {
        available: true,
        method,
        bookValue: Math.round(cur),
        accumulatedDepreciation: Math.max(0, purchase.value - Math.round(cur)),
        label: 'User-defined estimated value',
        isEstimate: true,
        valueSource: VALUE_SOURCE.USER_ENTERED,
      };
    }
  }

  if (method === DEPRECIATION_METHOD.STRAIGHT_LINE) {
    const lifeYears =
      Number(opts.usefulLifeYears || asset.usefulLifeYears) || resolveUsefulLifeYears(asset);
    const age = yearsSince(asset.purchaseDate);
    if (!asset.purchaseDate || !(lifeYears > 0)) {
      return {
        available: false,
        method,
        bookValue: null,
        accumulatedDepreciation: null,
        label: 'Estimate unavailable',
        isEstimate: true,
      };
    }
    const salvage = purchase.value * 0.1;
    const annual = (purchase.value - salvage) / lifeYears;
    const dep = Math.min(purchase.value - salvage, annual * age);
    const book = Math.max(salvage, purchase.value - dep);
    return {
      available: true,
      method,
      bookValue: Math.round(book),
      accumulatedDepreciation: Math.round(purchase.value - book),
      label: 'Estimated (straight-line)',
      isEstimate: true,
      valueSource: VALUE_SOURCE.ESTIMATED,
      usefulLifeYears: lifeYears,
    };
  }

  // PERCENTAGE — reuse existing engine
  const dep = calculateDepreciation({
    purchaseValue: purchase.value,
    purchaseDate: asset.purchaseDate,
    categoryId: asset.categoryId,
  });
  return {
    available: true,
    method: DEPRECIATION_METHOD.PERCENTAGE,
    bookValue: dep.bookValue,
    accumulatedDepreciation: dep.accumulatedDepreciation,
    label: 'Estimated (category rate)',
    isEstimate: true,
    valueSource: VALUE_SOURCE.ESTIMATED,
    ageYears: dep.ageYears,
  };
}

/**
 * Current estimated value with explicit source labeling.
 */
export function resolveCurrentEstimatedValue(asset = {}) {
  const currencyCode = asset.currencyCode || CURRENCY_INR;

  if (asset.currentEstimatedValue != null && Number(asset.currentEstimatedValue) >= 0) {
    const source = asset.valueSource || VALUE_SOURCE.USER_ENTERED;
    return {
      available: true,
      value: Math.round(Number(asset.currentEstimatedValue)),
      label:
        source === VALUE_SOURCE.EXTERNAL_SOURCE
          ? 'Current Value'
          : 'Estimated Current Value',
      isEstimate: source !== VALUE_SOURCE.EXTERNAL_SOURCE,
      valueSource: source,
      currencyCode,
      lastValueUpdatedAt: asset.lastValueUpdatedAt || null,
    };
  }

  if (asset.estimatedResale != null && Number(asset.estimatedResale) > 0) {
    return {
      available: true,
      value: Math.round(Number(asset.estimatedResale)),
      label: 'Estimated Current Value',
      isEstimate: true,
      valueSource: VALUE_SOURCE.ESTIMATED,
      currencyCode,
      lastValueUpdatedAt: asset.lastValueUpdatedAt || null,
    };
  }

  const purchase = resolvePurchasePrice(asset);
  if (!purchase.available || !asset.purchaseDate) {
    return {
      available: false,
      value: null,
      label: 'Estimate unavailable',
      isEstimate: true,
      valueSource: VALUE_SOURCE.UNKNOWN,
      currencyCode,
    };
  }

  const resale = calculateResaleValue({
    purchaseValue: purchase.value,
    purchaseDate: asset.purchaseDate,
    categoryId: asset.categoryId,
    category: asset.category,
    condition: asset.condition || 'good',
  });
  const dep = calculateConfigurableDepreciation(asset);
  const value = Math.round(
    Number(resale.estimatedResale) || dep.bookValue || purchase.value,
  );

  return {
    available: value > 0,
    value: value > 0 ? value : null,
    label: 'Estimated Current Value',
    isEstimate: true,
    valueSource: VALUE_SOURCE.ESTIMATED,
    currencyCode,
    lastValueUpdatedAt: null,
  };
}

export function calculateAssetAge(asset = {}, now = new Date()) {
  if (!asset.purchaseDate) {
    return { available: false, years: null, label: 'Not available', days: null };
  }
  const start = new Date(`${String(asset.purchaseDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime())) {
    return { available: false, years: null, label: 'Not available', days: null };
  }
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  if (start > end) {
    return { available: false, years: null, label: 'Invalid purchase date', days: null };
  }
  const days = Math.round((end - start) / 86400000);
  const yearsExact = days / 365.25;
  const totalMonths = Math.max(0, Math.floor(days / 30.4375));
  const wholeYears = Math.floor(totalMonths / 12);
  const remMonths = totalMonths % 12;
  let label = 'Not available';
  if (wholeYears >= 1 && remMonths > 0) {
    label = `${wholeYears} year${wholeYears === 1 ? '' : 's'} ${remMonths} month${remMonths === 1 ? '' : 's'}`;
  } else if (wholeYears >= 1) {
    label = `${wholeYears} year${wholeYears === 1 ? '' : 's'}`;
  } else if (totalMonths >= 1) {
    label = `${totalMonths} month${totalMonths === 1 ? '' : 's'}`;
  } else {
    label = `${days} day${days === 1 ? '' : 's'}`;
  }
  return {
    available: true,
    years: Math.round(yearsExact * 10) / 10,
    months: totalMonths,
    days,
    label,
    purchaseDate: String(asset.purchaseDate).slice(0, 10),
  };
}

export default {
  resolvePurchasePrice,
  calculateConfigurableDepreciation,
  resolveCurrentEstimatedValue,
  calculateAssetAge,
};

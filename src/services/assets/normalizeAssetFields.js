/**
 * Normalize persisted asset fields for Passport consistency (post-OCR save layer).
 */

import { parseFlexibleDate } from '../../utils/dates';
import {
  addMonthsToIsoDate,
  resolveCanonicalWarrantyExpiry,
  resolveWarrantyMonths,
  resolveWarrantyStartDate,
  resolveWarrantyText,
} from '../../utils/warrantyDates';
import { resolveAssetCapabilities } from './assetCapabilities';
import { ASSET_CATEGORY, classifyFromCategoryId } from './assetTaxonomy';

function isGadgetAsset(asset = {}) {
  const caps = resolveAssetCapabilities(asset);
  if (caps.supportsBatteryHealth && !caps.supportsPUC && !caps.supportsInsurance) {
    return true;
  }
  const tax = classifyFromCategoryId(asset.categoryId, asset.assetName);
  return tax.assetCategory === ASSET_CATEGORY.GADGET;
}

/**
 * Align warranty + service fields before Firestore write / optimistic UI.
 * Does not alter invoice OCR output.
 * @param {object} partial
 * @returns {object}
 */
export function normalizeAssetFields(partial = {}) {
  const next = { ...partial };

  const purchaseDate = resolveWarrantyStartDate(next);
  if (purchaseDate) next.purchaseDate = purchaseDate;

  const months = resolveWarrantyMonths(next);
  if (months) next.warrantyMonths = months;

  const canonicalWarranty = resolveCanonicalWarrantyExpiry(next);
  if (canonicalWarranty) next.warrantyExpiry = canonicalWarranty;

  const warrantyText = resolveWarrantyText(next);
  if (warrantyText) {
    next.warrantyText = warrantyText;
    next.invoiceMeta = {
      ...(next.invoiceMeta || {}),
      warrantyText,
      ...(months ? { warrantyPeriodMonths: months } : {}),
      ...(purchaseDate ? { invoiceDate: parseFlexibleDate(next.invoiceMeta?.invoiceDate) || purchaseDate } : {}),
    };
  } else if (months && next.invoiceMeta) {
    next.invoiceMeta = { ...next.invoiceMeta, warrantyPeriodMonths: months };
  }

  // Gadgets: drop orphan next-service dates that are not real user schedules.
  if (isGadgetAsset(next)) {
    const hasServiceHistory =
      Boolean(parseFlexibleDate(next.lastServiceDate)) ||
      Boolean(next.lastServiceOdometerKm != null && next.lastServiceOdometerKm !== '');
    if (!hasServiceHistory) {
      next.nextServiceDue = null;
      next.nextServiceDate = null;
    }
  }

  return next;
}

export default { normalizeAssetFields };

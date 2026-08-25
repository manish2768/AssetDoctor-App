/**
 * Category-specific field schemas for review / vault.
 * GADGET must never render vehicle-only fields.
 */

import { ASSET_DOC_CATEGORY } from './assetCategoryClassifier';

export const VEHICLE_ONLY_FIELDS = Object.freeze([
  'engineNumber',
  'chassisNumber',
  'registration',
  'odometerKm',
  'nextServiceOdometerKm',
  'pucExpiry',
  'insuranceExpiry',
  'vehicleInsurance',
  'vehicleServiceKM',
]);

export const CATEGORY_SCHEMAS = Object.freeze({
  [ASSET_DOC_CATEGORY.GADGET]: Object.freeze([
    'assetName',
    'productName',
    'brand',
    'model',
    'variant',
    'storage',
    'color',
    'serialNumber',
    'imei',
    'purchasePrice',
    'totalAmount',
    'taxAmount',
    'invoiceNumber',
    'purchaseDate',
    'invoiceDate',
    'sellerName',
    'shopName',
    'sellerGSTIN',
    'shopGstin',
    'warrantyStartDate',
    'warrantyMonths',
    'warrantyExpiry',
    'warrantyPeriodMonths',
    'category',
    'items',
  ]),
  [ASSET_DOC_CATEGORY.VEHICLE]: Object.freeze([
    'assetName',
    'productName',
    'registrationNumber',
    'registration',
    'chassisNumber',
    'engineNumber',
    'odometerKm',
    'purchasePrice',
    'totalAmount',
    'insuranceExpiry',
    'pucExpiry',
    'nextServiceDue',
    'nextServiceOdometerKm',
    'invoiceNumber',
    'sellerName',
    'shopName',
    'purchaseDate',
    'invoiceDate',
    'category',
    'items',
  ]),
  [ASSET_DOC_CATEGORY.HOME_APPLIANCE]: Object.freeze([
    'assetName',
    'productName',
    'brand',
    'model',
    'serialNumber',
    'purchasePrice',
    'totalAmount',
    'invoiceNumber',
    'purchaseDate',
    'invoiceDate',
    'sellerName',
    'shopName',
    'warrantyExpiry',
    'warrantyPeriodMonths',
    'nextServiceDue',
    'category',
    'items',
  ]),
  [ASSET_DOC_CATEGORY.OTHER]: Object.freeze([
    'assetName',
    'productName',
    'serialNumber',
    'purchasePrice',
    'totalAmount',
    'invoiceNumber',
    'purchaseDate',
    'invoiceDate',
    'sellerName',
    'shopName',
    'category',
    'items',
  ]),
});

/**
 * True when review UI should show vehicle-only inputs.
 */
export function shouldShowVehicleFields(category) {
  return category === ASSET_DOC_CATEGORY.VEHICLE;
}

/**
 * Clear vehicle-only fields when category is not VEHICLE.
 * Mutates a shallow copy; never invents values.
 */
export function applyCategorySchema(data = {}, category) {
  const next = { ...data };
  next.assetDocCategory = category;
  next.documentAssetCategory = category;

  // Service bills must keep odometer / registration — never treat as gadget wipe.
  const serviceLike =
    next.isServiceInvoice ||
    /service/i.test(String(next.documentKind || '')) ||
    /service/i.test(String(next.scanDocumentType || '')) ||
    next.documentTypeV2 === 'SERVICE_BILL';
  if (serviceLike) {
    next.assetDocCategory = ASSET_DOC_CATEGORY.VEHICLE;
    next.documentAssetCategory = ASSET_DOC_CATEGORY.VEHICLE;
    next.purchaseCategory = 'Vehicles';
    next.smartCategory = 'vehicles';
    next.isVehicleInvoice = false;
    next.requiresVehicleLink = true;
    next.showVehicleFields = true;
    return next;
  }

  if (category === ASSET_DOC_CATEGORY.GADGET) {
    next.isVehicleInvoice = false;
    next.requiresVehicleLink = false;
    next.purchaseCategory = 'Electronics';
    next.smartCategory = 'gadgets';
    for (const key of VEHICLE_ONLY_FIELDS) {
      if (key === 'odometerKm' || key === 'nextServiceOdometerKm') next[key] = null;
      else next[key] = key.endsWith('Expiry') || key.includes('odometer') ? null : '';
    }
    next.odometerKm = null;
    next.nextServiceOdometerKm = null;
    next.pucExpiry = null;
    next.insuranceExpiry = null;
    next.chassisNumber = '';
    next.engineNumber = '';
    next.registration = '';
  } else if (category === ASSET_DOC_CATEGORY.HOME_APPLIANCE) {
    next.isVehicleInvoice = false;
    next.requiresVehicleLink = false;
    next.purchaseCategory = 'Electronics';
    next.smartCategory = 'home_appliances';
    next.chassisNumber = '';
    next.engineNumber = '';
    next.registration = '';
    next.odometerKm = null;
    next.nextServiceOdometerKm = null;
    next.pucExpiry = null;
    next.insuranceExpiry = null;
    // Home appliances do not use IMEI unless explicitly present
    if (!String(next.imei || '').replace(/\D/g, '')) next.imei = '';
  } else if (category === ASSET_DOC_CATEGORY.VEHICLE) {
    next.purchaseCategory = 'Vehicles';
    next.smartCategory = 'vehicles';
    next.isVehicleInvoice = true;
    // Vehicles do not inherit IMEI unless explicitly present on the doc
    if (!String(next.imei || '').replace(/\D/g, '')) next.imei = '';
  } else {
    next.isVehicleInvoice = false;
  }

  return next;
}

export default {
  VEHICLE_ONLY_FIELDS,
  CATEGORY_SCHEMAS,
  shouldShowVehicleFields,
  applyCategorySchema,
};

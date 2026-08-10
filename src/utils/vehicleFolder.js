/**
 * Normalize Indian vehicle registration for same-folder matching.
 * e.g. "MH 12 AB 1234" → "MH12AB1234"
 */

export function normalizeRegistration(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function normalizeChassis(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Find an existing vehicle asset with the same plate / registration.
 */
export function findAssetByRegistration(assets = [], registration) {
  const needle = normalizeRegistration(registration);
  if (!needle || needle.length < 6) return null;
  return (
    assets.find((a) => {
      const reg = normalizeRegistration(a.registration);
      return reg && reg === needle;
    }) || null
  );
}

/**
 * Find vehicle by chassis / frame number.
 */
export function findAssetByChassis(assets = [], chassis) {
  const needle = normalizeChassis(chassis);
  if (!needle || needle.length < 8) return null;
  return (
    assets.find((a) => {
      const ch = normalizeChassis(a.chassisNumber);
      return ch && ch === needle;
    }) || null
  );
}

/**
 * Docs that belong on a vehicle passport — never create a standalone "Other" asset.
 */
export function isVehicleAttachDocument(formOrType = {}) {
  const t = String(
    typeof formOrType === 'string'
      ? formOrType
      : formOrType.scanDocumentType ||
          formOrType.documentType ||
          formOrType.documentKind ||
          '',
  ).toLowerCase();
  return ['insurance', 'puc', 'rc', 'warranty'].includes(t);
}

/**
 * Resolve existing vehicle for attach/merge (registration → chassis → engine).
 */
export function findVehicleAsset(assets = [], form = {}) {
  return (
    findAssetByRegistration(assets, form.registration) ||
    findAssetByChassis(assets, form.chassisNumber) ||
    findAssetByChassis(assets, form.engineNumber) ||
    null
  );
}

/**
 * True when category is a vehicle bucket.
 */
export function isVehicleCategory(formOrAsset = {}) {
  const id = String(formOrAsset.categoryId || '').toLowerCase();
  const cat = String(formOrAsset.category || formOrAsset.categoryLabel || '').toLowerCase();
  const smart = String(formOrAsset.smartCategory || '').toLowerCase();
  return (
    ['bike', 'car', 'scooter', 'vehicle', 'motorcycle', 'vehicle_parts'].includes(id) ||
    smart === 'vehicles' ||
    Boolean(formOrAsset.isVehicleInvoice) ||
    cat.includes('vehicle') ||
    cat.includes('bike') ||
    cat.includes('car') ||
    cat.includes('scooter') ||
    cat.includes('automobile')
  );
}

export function listVehicleAssets(assets = []) {
  return (assets || []).filter(
    (a) => !a.deletedAt && (isVehicleCategory(a) || a.registration || a.chassisNumber),
  );
}

export default {
  normalizeRegistration,
  normalizeChassis,
  findAssetByRegistration,
  findAssetByChassis,
  findVehicleAsset,
  isVehicleAttachDocument,
  isVehicleCategory,
  listVehicleAssets,
};

/**
 * Smart vehicle matching for Insurance / PUC / RC scans.
 */

import {
  findAssetByChassis,
  findAssetByRegistration,
  findVehicleAsset,
  listVehicleAssets,
  normalizeChassis,
  normalizeRegistration,
} from '../../utils/vehicleFolder';

/**
 * Build match needles from OCR / form fields.
 */
export function extractVehicleMatchKeys(formOrInvoice = {}) {
  const extract = formOrInvoice.ocrExtract || {};
  const registration =
    formOrInvoice.registration ||
    formOrInvoice.registration_number ||
    formOrInvoice.registrationNumber ||
    extract.vehicle_registration_number ||
    extract.registration_number ||
    '';
  const chassis =
    formOrInvoice.chassisNumber ||
    formOrInvoice.chassis_or_frame_no ||
    extract.chassis_or_frame_no ||
    extract.chassis_number ||
    '';
  return {
    registration: normalizeRegistration(registration),
    chassis: normalizeChassis(chassis),
    registrationRaw: String(registration || '').trim(),
    chassisRaw: String(chassis || '').trim(),
  };
}

/**
 * Find best existing vehicle for an attach document.
 * @returns {{ matched: object|null, matchBy: 'link'|'registration'|'chassis'|null, vehicles: object[] }}
 */
export function matchVehicleForDocument(assets = [], formOrInvoice = {}) {
  const vehicles = listVehicleAssets(assets);
  if (formOrInvoice.linkAssetId) {
    const linked = vehicles.find(
      (a) => (a.assetId || a.id) === formOrInvoice.linkAssetId,
    );
    if (linked) {
      return { matched: linked, matchBy: 'link', vehicles };
    }
  }

  const keys = extractVehicleMatchKeys(formOrInvoice);
  const byReg = findAssetByRegistration(assets, keys.registrationRaw || keys.registration);
  if (byReg) return { matched: byReg, matchBy: 'registration', vehicles };

  const byChassis = findAssetByChassis(assets, keys.chassisRaw || keys.chassis);
  if (byChassis) return { matched: byChassis, matchBy: 'chassis', vehicles };

  const fallback = findVehicleAsset(assets, {
    registration: keys.registrationRaw,
    chassisNumber: keys.chassisRaw,
    engineNumber: formOrInvoice.engineNumber,
  });
  if (fallback) {
    return {
      matched: fallback,
      matchBy: keys.registration ? 'registration' : 'chassis',
      vehicles,
    };
  }

  return { matched: null, matchBy: null, vehicles };
}

export function vehicleMatchLabel(asset) {
  if (!asset) return 'Vehicle';
  const name = asset.assetName || 'Vehicle';
  const reg = asset.registration ? ` · ${asset.registration}` : '';
  return `${name}${reg}`;
}

export const VehicleMatchService = {
  extractVehicleMatchKeys,
  matchVehicleForDocument,
  vehicleMatchLabel,
};

export default VehicleMatchService;

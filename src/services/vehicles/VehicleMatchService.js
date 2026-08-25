/**
 * Smart vehicle matching for Insurance / PUC / RC scans.
 * Pure JS — no native modules (safe for Expo Go).
 */

import {
  findAssetByChassis,
  findAssetByEngine,
  findAssetByRegistration,
  findVehicleAsset,
  listVehicleAssets,
  normalizeChassis,
  normalizeRegistration,
} from '../../utils/vehicleFolder';

export function extractVehicleMatchKeys(formOrInvoice = {}) {
  try {
    const extract = formOrInvoice?.ocrExtract || {};
    const registration =
      formOrInvoice?.registration ||
      formOrInvoice?.registration_number ||
      formOrInvoice?.registrationNumber ||
      extract.vehicle_registration_number ||
      extract.registration_number ||
      '';
    const chassis =
      formOrInvoice?.chassisNumber ||
      formOrInvoice?.chassis_or_frame_no ||
      extract.chassis_or_frame_no ||
      extract.chassis_number ||
      '';
    const engine =
      formOrInvoice?.engineNumber ||
      formOrInvoice?.engine_number ||
      extract.engine_number ||
      '';
    return {
      registration: normalizeRegistration(registration),
      chassis: normalizeChassis(chassis),
      engine: normalizeChassis(engine),
      registrationRaw: String(registration || '').trim(),
      chassisRaw: String(chassis || '').trim(),
      engineRaw: String(engine || '').trim(),
    };
  } catch (error) {
    console.warn('[VehicleMatch] extractVehicleMatchKeys:', error?.message || error);
    return {
      registration: '',
      chassis: '',
      engine: '',
      registrationRaw: '',
      chassisRaw: '',
      engineRaw: '',
    };
  }
}

export function matchVehicleForDocument(assets = [], formOrInvoice = {}) {
  try {
    const vehicles = listVehicleAssets(assets) || [];
    if (formOrInvoice?.linkAssetId) {
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

    const byEngine = findAssetByEngine(assets, keys.engineRaw || keys.engine);
    if (byEngine) return { matched: byEngine, matchBy: 'engine', vehicles };

    const fallback = findVehicleAsset(assets, {
      registration: keys.registrationRaw,
      chassisNumber: keys.chassisRaw,
      engineNumber: keys.engineRaw,
    });
    if (fallback) {
      return {
        matched: fallback,
        matchBy: keys.registration ? 'registration' : keys.chassis ? 'chassis' : 'engine',
        vehicles,
      };
    }

    return { matched: null, matchBy: null, vehicles };
  } catch (error) {
    console.warn('[VehicleMatch] matchVehicleForDocument:', error?.message || error);
    return { matched: null, matchBy: null, vehicles: [] };
  }
}

export function vehicleMatchLabel(asset) {
  try {
    if (!asset) return 'Vehicle';
    const name = asset.assetName || 'Vehicle';
    const reg = asset.registration ? ` · ${asset.registration}` : '';
    return `${name}${reg}`;
  } catch {
    return 'Vehicle';
  }
}

export const VehicleMatchService = {
  extractVehicleMatchKeys,
  matchVehicleForDocument,
  vehicleMatchLabel,
};

export default VehicleMatchService;

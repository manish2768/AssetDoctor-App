/**
 * Home Active Asset card presentation helpers.
 * Presentation only — never invents battery %, plates, or cross-asset data.
 */

import { daysUntil } from './dates';
import { getAssetFolderType } from './assetFolders';
import {
  cleanAssetDisplayName,
  formatRegistrationDisplay,
  maskImeiDisplay,
} from './displayAssetName';
import { resolveAssetCapabilities } from '../services/assets/assetCapabilities';
import { getAssetHealthStatus } from './assetHealthStatus';
import { getCurrentValuation } from '../components/ValuationBlock';

function formatRupeeCompact(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** Measured battery only — never age-estimated invent for Home chips. */
export function resolveMeasuredBatteryLabel(asset = {}) {
  const bp = asset.batteryProfile || {};
  if (bp.healthPercent != null && bp.isEstimated === false) {
    const n = Number(bp.healthPercent);
    if (Number.isFinite(n) && n > 0 && n <= 100) {
      return { text: `Battery ${Math.round(n)}%`, available: true };
    }
  }
  const measured = asset.batteryHealthPercentMeasured ?? asset.batteryHealthMeasured;
  if (measured != null) {
    const n = Number(measured);
    if (Number.isFinite(n) && n > 0 && n <= 100) {
      return { text: `Battery ${Math.round(n)}%`, available: true };
    }
  }
  return { text: 'Battery · Not available', available: false };
}

function pickUpcoming(asset, caps, isVehicle) {
  const candidates = [];
  const push = (label, date) => {
    const d = daysUntil(date);
    if (d == null) return;
    candidates.push({ label, days: d, date });
  };
  if (caps.supportsServiceHistory || isVehicle) push('Service', asset.nextServiceDue);
  if (caps.supportsInsurance || isVehicle) push('Insurance', asset.insuranceExpiry);
  if (caps.supportsPUC || isVehicle) push('PUC', asset.pucExpiry);
  if (caps.supportsWarranty !== false) push('Warranty', asset.warrantyExpiry);
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.days - b.days);
  const top = candidates[0];
  if (top.days < 0) return `${top.label} expired`;
  if (top.days === 0) return `${top.label} due today`;
  if (top.days <= 45) return `${top.label} in ${top.days}d`;
  return `${top.label} · ${top.days}d`;
}

/**
 * @returns {{
 *   id: string,
 *   displayName: string,
 *   typeLabel: string,
 *   isVehicle: boolean,
 *   isGadget: boolean,
 *   identifierLine: string|null,
 *   health: object,
 *   upcomingLine: string|null,
 *   secondaryLine: string|null,
 *   batteryLine: string|null,
 * }}
 */
export function buildHomeAssetCardMeta(asset = {}) {
  const caps = resolveAssetCapabilities(asset);
  const folder = getAssetFolderType(asset);
  const isVehicle = folder === 'vehicle';
  const isGadget = folder === 'gadget' || caps.supportsBatteryHealth;
  const health = getAssetHealthStatus(asset);
  const displayName = cleanAssetDisplayName(asset.assetName, {
    registration: asset.registration,
  });
  const plate = formatRegistrationDisplay(asset.registration);
  const imeiMasked = maskImeiDisplay(asset.imei || asset.serialNumber);

  let identifierLine = null;
  if (isVehicle && plate) identifierLine = plate;
  else if (isGadget && imeiMasked) identifierLine = `IMEI ${imeiMasked}`;
  else if (!isVehicle && asset.serialNumber && !imeiMasked) {
    identifierLine = `S/N ···${String(asset.serialNumber).slice(-4)}`;
  }

  const upcomingLine = pickUpcoming(asset, caps, isVehicle);

  let secondaryLine = null;
  const valuation = getCurrentValuation(asset);
  if (isVehicle) {
    if (asset.odometerKm != null && Number(asset.odometerKm) > 0) {
      secondaryLine = `${Number(asset.odometerKm).toLocaleString('en-IN')} km`;
    } else if (valuation?.current > 0) {
      secondaryLine = `Est. ${formatRupeeCompact(valuation.current) || '—'}`;
    }
  } else if (isGadget) {
    const model = asset.model || asset.brandName || asset.categoryLabel;
    if (model && String(model).toLowerCase() !== String(displayName || '').toLowerCase()) {
      secondaryLine = String(model).slice(0, 40);
    } else if (valuation?.current > 0) {
      secondaryLine = `Est. ${formatRupeeCompact(valuation.current) || '—'}`;
    }
  } else if (valuation?.current > 0) {
    secondaryLine = `Est. ${formatRupeeCompact(valuation.current) || '—'}`;
  }

  // Measured battery only — omit estimated invents (never show 0% / age-decay as fact)
  let batteryLine = null;
  if (caps.supportsBatteryHealth) {
    const bat = resolveMeasuredBatteryLabel(asset);
    batteryLine = bat.available ? bat.text : null;
  }

  const typeLabel =
    asset.categoryLabel ||
    asset.category ||
    (isVehicle ? 'Vehicle' : isGadget ? 'Gadget' : 'Asset');

  const brand = String(asset.brand || asset.brandName || '').trim();
  const model = String(asset.model || asset.variant || '').trim();
  let brandModelLine = null;
  if (brand && model && brand.toLowerCase() !== model.toLowerCase()) {
    brandModelLine = `${brand} · ${model}`;
  } else if (model) {
    brandModelLine = model;
  } else if (brand) {
    brandModelLine = brand;
  } else if (secondaryLine) {
    brandModelLine = secondaryLine;
  } else {
    brandModelLine = typeLabel;
  }

  return {
    id: asset.assetId || asset.id,
    displayName: displayName || asset.assetName || 'Asset',
    typeLabel,
    brandModelLine,
    isVehicle,
    isGadget,
    identifierLine,
    health,
    upcomingLine,
    secondaryLine,
    batteryLine,
    caps,
  };
}

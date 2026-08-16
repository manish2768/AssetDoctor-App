/**
 * Home / vault card intelligence — progressive disclosure by asset type.
 * Always prefer Estimated labels unless source is actual/device.
 */

import { classifyFromCategoryId, ASSET_CATEGORY, POWERTRAIN } from './assetTaxonomy';
import { isBatteryRelevantAsset } from './batteryIntelligence';

/**
 * @returns {{ title: string, subtitle: string, lines: Array<{ label: string, value: string, tone?: string }> }}
 */
export function buildSmartAssetCard(asset = {}) {
  const tax = classifyFromCategoryId(asset.categoryId, asset.assetName);
  const title = asset.nickname || asset.assetName || 'Asset';
  const subtitle = [asset.brandName, asset.locationPath || asset.locationLabel]
    .filter(Boolean)
    .join(' · ');
  const lines = [];

  const warranty = warrantyLine(asset);
  if (warranty) lines.push(warranty);

  if (isBatteryRelevantAsset(asset) && asset.batteryProfile?.healthPercent != null) {
    const bp = asset.batteryProfile;
    lines.push({
      label: bp.displayTitle || (bp.isEstimated ? 'Estimated Battery Health' : 'Battery Health'),
      value: `${bp.healthPercent}%${bp.healthLabel ? ` · ${bp.healthLabel}` : ''}`,
      tone: bp.healthLabel === 'Poor' ? 'warn' : 'ok',
    });
  }

  if (tax.powertrain === POWERTRAIN.ELECTRIC && asset.energyProfile) {
    const ep = asset.energyProfile;
    if (ep.rangeKm) {
      lines.push({ label: 'Range', value: `~${ep.rangeKm} km` });
    }
    if (ep.energyConsumptionPer100Km) {
      lines.push({
        label: 'Energy',
        value: `~${ep.energyConsumptionPer100Km} kWh/100 km`,
      });
    }
    if (ep.estimatedCostPerKm != null) {
      lines.push({ label: 'Est. cost', value: `₹${ep.estimatedCostPerKm}/km` });
    }
  } else if (
    tax.assetCategory === ASSET_CATEGORY.HOME_APPLIANCE &&
    (asset.energyProfile?.estimatedMonthlyConsumptionKwh || asset.estimatedMonthlyUnits)
  ) {
    const kwh =
      asset.energyProfile?.estimatedMonthlyConsumptionKwh ?? asset.estimatedMonthlyUnits;
    lines.push({
      label: 'Estimated Energy',
      value: `~${kwh} kWh/month`,
    });
  }

  if (tax.assetCategory === ASSET_CATEGORY.VEHICLE && tax.powertrain !== POWERTRAIN.ELECTRIC) {
    if (asset.insuranceExpiry) {
      lines.push({ label: 'Insurance', value: String(asset.insuranceExpiry) });
    }
    if (asset.pucExpiry) {
      lines.push({ label: 'PUC', value: String(asset.pucExpiry) });
    }
  }

  if (asset.nextServiceDue && !lines.some((l) => /service/i.test(l.label))) {
    lines.push({ label: 'Next Service', value: String(asset.nextServiceDue).slice(0, 10) });
  }

  return {
    title,
    subtitle,
    publicAssetId: asset.publicAssetId || asset.assetCode || null,
    locationPath: asset.locationPath || '',
    assetCategory: tax.assetCategory,
    lines: lines.slice(0, 4),
  };
}

function warrantyLine(asset) {
  if (!asset.warrantyExpiry) return null;
  const end = new Date(asset.warrantyExpiry);
  if (Number.isNaN(end.getTime())) return { label: 'Warranty', value: String(asset.warrantyExpiry) };
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Warranty', value: 'Expired', tone: 'warn' };
  if (days <= 45) return { label: 'Warranty', value: 'Expiring Soon', tone: 'warn' };
  return { label: 'Warranty', value: 'Active', tone: 'ok' };
}

export default { buildSmartAssetCard };

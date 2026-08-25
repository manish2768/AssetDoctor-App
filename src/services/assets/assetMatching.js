/**
 * Smart asset matching foundation — never silent-guess identical models.
 * Wraps SmartAssetMapper + confidence tiers for service-bill linking.
 */

import { mapScanToExistingAsset } from '../ocr/SmartAssetMapper';

export const MATCH_LEVEL = Object.freeze({
  EXACT_ID: 'LEVEL_1_EXACT',
  STRONG_COMBO: 'LEVEL_2_STRONG',
  PHYSICAL_CONTEXT: 'LEVEL_3_CONTEXT',
  NEEDS_CONFIRMATION: 'LEVEL_4_CONFIRM',
});

export function matchConfidenceTier(match) {
  if (!match?.asset) return MATCH_LEVEL.NEEDS_CONFIRMATION;
  const kind = String(match.match?.kind || '');
  const conf = Number(match.match?.confidence) || 0;
  if (['imei', 'serial', 'vehicle_registration', 'invoice_number'].includes(kind) && conf >= 0.9) {
    return MATCH_LEVEL.EXACT_ID;
  }
  if (conf >= 0.88) return MATCH_LEVEL.STRONG_COMBO;
  if (conf >= 0.7) return MATCH_LEVEL.PHYSICAL_CONTEXT;
  return MATCH_LEVEL.NEEDS_CONFIRMATION;
}

/**
 * Find candidates for service-bill / OCR linking.
 * If multiple same brand+model, always require confirmation unless exact serial/IMEI.
 */
export function matchAssetForService(invoiceOrForm = {}, assets = []) {
  const primary = mapScanToExistingAsset(invoiceOrForm, assets);
  const tier = matchConfidenceTier(primary);

  const brand = String(invoiceOrForm.brand || invoiceOrForm.brandName || '').toLowerCase();
  const model = String(invoiceOrForm.model || invoiceOrForm.productName || '').toLowerCase();
  const candidates = (assets || [])
    .filter((a) => a && !a.deletedAt)
    .filter((a) => {
      const name = `${a.brandName || ''} ${a.assetName || ''}`.toLowerCase();
      if (brand && name.includes(brand)) return true;
      if (model && model.length >= 4 && name.includes(model.slice(0, 12))) return true;
      return false;
    })
    .map((a) => ({
      assetId: a.assetId || a.id,
      name: a.nickname || a.assetName,
      locationPath: a.locationPath || a.nickname || '',
      categoryId: a.categoryId,
    }))
    .slice(0, 12);

  const needsConfirmation =
    tier === MATCH_LEVEL.NEEDS_CONFIRMATION ||
    (candidates.length > 1 && !['imei', 'serial', 'vehicle_registration'].includes(primary.match?.kind));

  return {
    primary: primary.asset || null,
    match: primary.match || null,
    reason: primary.reason || '',
    tier,
    needsConfirmation,
    candidates: needsConfirmation ? candidates : primary.asset ? [{
      assetId: primary.asset.assetId || primary.asset.id,
      name: primary.asset.nickname || primary.asset.assetName,
      locationPath: primary.asset.locationPath || '',
    }] : candidates,
    autoLinkSafe: !needsConfirmation && Boolean(primary.asset) && tier === MATCH_LEVEL.EXACT_ID,
  };
}

export default {
  MATCH_LEVEL,
  matchConfidenceTier,
  matchAssetForService,
};

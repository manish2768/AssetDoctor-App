/**
 * Explainable Health Score — capability-aware factors + WHY bullets.
 * Reuses computeAssetHealth; strips battery factors when unsupported.
 */

import { computeAssetHealth } from '../health/computeAssetHealth';
import { resolveAssetCapabilities } from '../assets/assetCapabilities';
import { resolveHealthProfile, healthBandForScore } from '../health/healthScoreConfig';

/**
 * @param {object} asset
 * @param {{ repairs?: object[], now?: Date }} [opts]
 */
export function computeExplainableHealth(asset = {}, opts = {}) {
  const caps = resolveAssetCapabilities(asset);
  const profile = resolveHealthProfile(asset);

  // Zero battery weight when capability says no (defense in depth beyond profile)
  const safeAsset = { ...asset };
  if (!caps.supportsBatteryHealth) {
    safeAsset.batteryProfile = null;
    safeAsset.batteryHealthPercent = null;
  }

  const raw = computeAssetHealth(safeAsset, opts);
  const breakdown = { ...(raw.breakdown || {}) };

  if (!caps.supportsBatteryHealth && breakdown.battery) {
    delete breakdown.battery;
  }
  if (!caps.supportsEnergyTracking && breakdown.energy) {
    // Keep mild energy only when profile asked for it; else drop
    if ((profile.weights?.energy || 0) === 0) delete breakdown.energy;
  }
  if (!caps.supportsInsurance && breakdown.insurance) {
    delete breakdown.insurance;
  }

  // Rebuild score from remaining breakdown if we stripped battery points
  let score = raw.score;
  if (!caps.supportsBatteryHealth && (raw.breakdown?.battery?.max || 0) > 0) {
    let earned = 0;
    let max = 0;
    Object.values(breakdown).forEach((b) => {
      if (!b) return;
      earned += Number(b.earned) || 0;
      max += Number(b.max) || 0;
    });
    score = max > 0 ? Math.round((earned / max) * 100) : raw.score;
  }

  const why = Array.isArray(raw.why) ? [...raw.why] : [];
  const filteredWhy = why.filter((line) => {
    if (!caps.supportsBatteryHealth && /battery/i.test(String(line))) return false;
    if (!caps.supportsInsurance && /insurance/i.test(String(line))) return false;
    if (!caps.supportsPUC && /\bpuc\b/i.test(String(line))) return false;
    return true;
  });

  if (!filteredWhy.length) {
    filteredWhy.push('Core documents and dates look complete for this asset type.');
  }

  const bandObj = healthBandForScore(score);
  const bandLabel = bandObj?.label || raw.band || raw.grade || 'Health';

  return {
    score,
    band: bandLabel,
    label: bandLabel,
    grade: bandLabel,
    breakdown,
    why: filteredWhy,
    factors: Object.keys(breakdown),
    capabilities: {
      supportsBatteryHealth: caps.supportsBatteryHealth,
      supportsEnergyTracking: caps.supportsEnergyTracking,
      supportsInsurance: caps.supportsInsurance,
      supportsPUC: caps.supportsPUC,
    },
    profileKey: profile.key,
    explainability: filteredWhy.map((reason) => ({
      what: 'Health factor',
      why: reason,
      whatShouldIDo: suggestFix(reason, caps),
    })),
  };
}

function suggestFix(reason, caps) {
  const r = String(reason || '').toLowerCase();
  if (r.includes('warranty')) return 'Update warranty expiry or renew coverage.';
  if (r.includes('insurance') && caps.supportsInsurance) return 'Renew insurance and save the policy.';
  if (r.includes('puc') && caps.supportsPUC) return 'Renew PUC and attach the certificate.';
  if (r.includes('service') || r.includes('maintenance')) return 'Schedule service and log it.';
  if (r.includes('document') || r.includes('purchase') || r.includes('identifier')) {
    return 'Add purchase bill / serial / registration details.';
  }
  if (r.includes('battery') && caps.supportsBatteryHealth) {
    return 'Record battery health or plan service.';
  }
  if (r.includes('energy') && caps.supportsEnergyTracking) {
    return 'Add wattage and daily usage hours.';
  }
  return 'Review the asset passport and fill missing fields.';
}

export default { computeExplainableHealth };

/**
 * Asset Brain rules — recommendations from real vault signals only.
 * Never fabricates market values, energy, or warranty evidence.
 */

import { daysUntil } from '../../utils/dates';
import { resolveAssetCapabilities } from '../assets/assetCapabilities';
import { INSIGHT_TYPE, CONFIDENCE_BAND, formatWhatWhyDo } from './types';

function daysLeft(iso) {
  const d = daysUntil(iso);
  return d == null || Number.isNaN(d) ? null : d;
}

function explainable(partial) {
  const tri = formatWhatWhyDo(partial);
  return {
    type: partial.type || INSIGHT_TYPE.LIFECYCLE,
    key: partial.key || 'signal',
    title: tri.what,
    description: `${tri.why}\n\nWhat should I do: ${tri.whatShouldIDo}`,
    reason: partial.reason || tri.why,
    priority: tri.priority,
    confidenceScore: partial.confidenceScore ?? 0.7,
    confidence: CONFIDENCE_BAND.MEDIUM,
    action: tri.whatShouldIDo,
    supportingData: {
      what: tri.what,
      why: tri.why,
      whatShouldIDo: tri.whatShouldIDo,
      ...(partial.supportingData || {}),
    },
  };
}

/**
 * Evaluate brain recommendations for an AssetContext (+ raw asset for capabilities).
 * @returns {object[]}
 */
export function evaluateBrainSignals(ctx = {}, asset = {}, opts = {}) {
  if (!ctx?.usable) {
    return [
      explainable({
        type: INSIGHT_TYPE.LIFECYCLE,
        key: 'no_asset',
        what: 'Not enough data to recommend actions yet.',
        why: 'Asset identity is missing or the asset was removed.',
        whatShouldIDo: 'Open a valid asset passport and try again.',
        priority: 'LOW',
        confidenceScore: 0.2,
      }),
    ];
  }

  const caps = resolveAssetCapabilities(asset.categoryId ? asset : { ...asset, categoryId: ctx.categoryId });
  const out = [];

  const wDays = daysLeft(ctx.warrantyExpiry);
  if (wDays != null && wDays < 0) {
    out.push(
      explainable({
        type: INSIGHT_TYPE.WARRANTY,
        key: 'warranty_expired',
        what: 'Warranty has expired',
        why: `Warranty end date is ${ctx.warrantyExpiry}.`,
        whatShouldIDo: 'Use paid repair quotes carefully, or check if extended warranty was purchased.',
        priority: 'HIGH',
        confidenceScore: 0.9,
      }),
    );
  } else if (wDays != null && wDays <= 30) {
    out.push(
      explainable({
        type: INSIGHT_TYPE.WARRANTY,
        key: 'warranty_soon',
        what: `Warranty expires in ${wDays} day(s)`,
        why: `Recorded warranty expiry is ${ctx.warrantyExpiry}.`,
        whatShouldIDo: 'Schedule any covered repairs now and keep the claim pack ready.',
        priority: wDays <= 7 ? 'HIGH' : 'MEDIUM',
        confidenceScore: 0.85,
      }),
    );
  }

  if (caps.supportsInsurance) {
    const iDays = daysLeft(ctx.insuranceExpiry);
    if (iDays != null && iDays < 0) {
      out.push(
        explainable({
          type: INSIGHT_TYPE.DOCUMENT,
          key: 'insurance_expired',
          what: 'Insurance has expired',
          why: `Insurance expiry on file is ${ctx.insuranceExpiry}.`,
          whatShouldIDo: 'Renew insurance before driving; upload the new policy to the vault.',
          priority: 'HIGH',
          confidenceScore: 0.9,
        }),
      );
    } else if (iDays != null && iDays <= 30) {
      out.push(
        explainable({
          type: INSIGHT_TYPE.DOCUMENT,
          key: 'insurance_soon',
          what: `Insurance renews in ${iDays} day(s)`,
          why: `Insurance expiry on file is ${ctx.insuranceExpiry}.`,
          whatShouldIDo: 'Start renewal and save the new policy PDF in Documents.',
          priority: iDays <= 7 ? 'HIGH' : 'MEDIUM',
          confidenceScore: 0.85,
        }),
      );
    }
  }

  if (caps.supportsPUC) {
    const pDays = daysLeft(ctx.pucExpiry);
    if (pDays != null && pDays < 0) {
      out.push(
        explainable({
          type: INSIGHT_TYPE.DOCUMENT,
          key: 'puc_expired',
          what: 'PUC has expired',
          why: `PUC expiry on file is ${ctx.pucExpiry}.`,
          whatShouldIDo: 'Get a fresh PUC certificate and attach it to this vehicle.',
          priority: 'HIGH',
          confidenceScore: 0.9,
        }),
      );
    } else if (pDays != null && pDays <= 15) {
      out.push(
        explainable({
          type: INSIGHT_TYPE.DOCUMENT,
          key: 'puc_soon',
          what: `PUC expires in ${pDays} day(s)`,
          why: `PUC expiry on file is ${ctx.pucExpiry}.`,
          whatShouldIDo: 'Book a PUC check and upload the certificate.',
          priority: 'MEDIUM',
          confidenceScore: 0.85,
        }),
      );
    }
  }

  const svcDays = daysLeft(asset.nextServiceDue || ctx.nextServiceDue);
  if (caps.supportsServiceHistory && svcDays != null && svcDays <= 14) {
    out.push(
      explainable({
        type: INSIGHT_TYPE.MAINTENANCE,
        key: svcDays < 0 ? 'service_overdue' : 'service_soon',
        what: svcDays < 0 ? 'Service is overdue' : `Service due in ${svcDays} day(s)`,
        why: `Next service date on file is ${asset.nextServiceDue || 'set'}.`,
        whatShouldIDo: 'Book service and log the invoice under Maintenance.',
        priority: svcDays < 0 ? 'HIGH' : 'MEDIUM',
        confidenceScore: 0.8,
      }),
    );
  }

  if (caps.supportsBatteryHealth) {
    const pct =
      ctx.battery?.healthPercent != null
        ? Number(ctx.battery.healthPercent)
        : Number(asset.batteryHealthPercent);
    if (Number.isFinite(pct) && pct < 80) {
      out.push(
        explainable({
          type: INSIGHT_TYPE.BATTERY,
          key: 'battery_attention',
          what: `Battery health at ${Math.round(pct)}%`,
          why: ctx.battery?.isEstimated
            ? 'This is an estimate from age/capacity — not a lab measurement.'
            : 'Battery health is recorded on this gadget/EV.',
          whatShouldIDo:
            pct < 70
              ? 'Plan battery service or replacement; keep warranty claim documents ready.'
              : 'Monitor battery and avoid deep discharges.',
          priority: pct < 70 ? 'HIGH' : 'MEDIUM',
          confidenceScore: ctx.battery?.isEstimated ? 0.55 : 0.8,
        }),
      );
    }
  }

  if (caps.supportsEnergyTracking && caps.needsEnergyInputs) {
    out.push(
      explainable({
        type: INSIGHT_TYPE.ENERGY,
        key: 'energy_inputs',
        what: 'Energy estimate needs wattage / usage',
        why: 'Rated power or daily hours are missing — Asset Doctor will not invent kWh.',
        whatShouldIDo: 'Add rated watts and typical daily hours on the Energy screen.',
        priority: 'LOW',
        confidenceScore: 0.75,
      }),
    );
  }

  if (!(ctx.documents || []).length && !asset.hasBill && !asset.billImageUrl) {
    out.push(
      explainable({
        type: INSIGHT_TYPE.DOCUMENT,
        key: 'missing_docs',
        what: 'No purchase documents on file',
        why: 'Warranty claims and resale proofs work better with an invoice or bill.',
        whatShouldIDo: 'Scan or upload the purchase invoice to the Documents vault.',
        priority: 'MEDIUM',
        confidenceScore: 0.7,
      }),
    );
  }

  if (!out.length) {
    out.push(
      explainable({
        type: INSIGHT_TYPE.LIFECYCLE,
        key: 'insufficient',
        what: 'Not enough data to recommend actions yet.',
        why: 'No urgent warranty, document, service, battery, or energy signals were found.',
        whatShouldIDo: 'Add expiry dates, service history, or energy usage when available.',
        priority: 'LOW',
        confidenceScore: 0.4,
      }),
    );
  }

  // Cap spam — highest priority first, max 6
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  out.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
  return out.slice(0, opts.maxRecommendations ?? 6);
}

export const SignalBrainRule = Object.freeze({
  id: 'brain.signals.v1',
  types: Object.values(INSIGHT_TYPE),
  evaluate(ctx, opts = {}) {
    return evaluateBrainSignals(ctx, opts.asset || {}, opts);
  },
});

export default { evaluateBrainSignals, SignalBrainRule };

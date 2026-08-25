/**
 * Mobile UI helpers — next-action copy & category-aware health factor labels.
 * Presentation only. Uses existing capabilities; does not change scoring engines.
 */

import { daysUntil } from './dates';
import { resolveAssetCapabilities } from '../services/assets/assetCapabilities';
import { categoryFamilyLabel } from '../design-system/assetIntelligenceSchema';

/**
 * Single primary next-action for list cards / passport.
 * @returns {{ title: string, why: string, metric: string, priority: string, ctaLabel: string } | null}
 */
export function resolvePrimaryNextAction(asset = {}) {
  const caps = resolveAssetCapabilities(asset);
  const name = asset.nickname || asset.assetName || 'Asset';
  const cat = String(asset.categoryId || '').toLowerCase();
  const candidates = [];

  const pushExpiry = (key, title, enabled) => {
    if (!enabled) return;
    const d = daysUntil(asset[key]);
    if (d == null) return;
    let priority = 'MEDIUM';
    let metric = `${d} day${d === 1 ? '' : 's'}`;
    let why = `${title} expires in ${d} day${d === 1 ? '' : 's'}`;
    let displayTitle = title;
    if (d < 0) {
      priority = 'CRITICAL';
      metric = 'Expired';
      why = `${title} has expired for ${name}.`;
      displayTitle = `${title} expired`;
    } else if (d <= 7) {
      priority = 'HIGH';
      metric = `${d} day${d === 1 ? '' : 's'} left`;
      displayTitle = `${title} expires in ${d} day${d === 1 ? '' : 's'}`;
    } else if (d <= 30) {
      priority = 'MEDIUM';
      displayTitle = `${title} expires in ${d} days`;
    } else {
      return;
    }
    candidates.push({
      title: displayTitle,
      why,
      metric,
      priority,
      ctaLabel: 'Open asset',
      sort: priority === 'CRITICAL' ? 0 : priority === 'HIGH' ? 1 : 2,
    });
  };

  pushExpiry('insuranceExpiry', 'Insurance', caps.supportsInsurance);
  pushExpiry('pucExpiry', 'PUC', caps.supportsPUC);
  pushExpiry('warrantyExpiry', 'Warranty', caps.supportsWarranty !== false);

  if (caps.supportsOdometer && asset.nextServiceOdometerKm != null && asset.odometerKm != null) {
    const remaining = Number(asset.nextServiceOdometerKm) - Number(asset.odometerKm);
    if (Number.isFinite(remaining) && remaining <= 1000) {
      const dueNow = remaining <= 0;
      candidates.push({
        title: dueNow ? 'Service due now' : `Service due in ${Math.round(remaining)} KM`,
        why: dueNow
          ? `${name} has reached its next service odometer.`
          : `Next service is ${Math.round(remaining)} KM away for ${name}.`,
        metric: dueNow ? 'Due now' : `${Math.round(remaining)} KM remaining`,
        priority: remaining <= 200 ? 'HIGH' : 'MEDIUM',
        ctaLabel: 'View service',
        sort: dueNow ? 0 : 1,
      });
    }
  }

  if (caps.supportsServiceHistory || asset.nextServiceDue) {
    const d = daysUntil(asset.nextServiceDue);
    if (d != null && d <= 45) {
      const overdue = d < 0;
      const isAc = cat === 'ac';
      const title = isAc
        ? overdue
          ? 'AC filter cleaning is overdue'
          : `AC filter cleaning is due in ${d} day${d === 1 ? '' : 's'}`
        : overdue
          ? 'Service overdue'
          : `Service due in ${d} day${d === 1 ? '' : 's'}`;
      candidates.push({
        title,
        why: overdue
          ? `${name} service is overdue.`
          : isAc
            ? `AC filter / service care is due for ${name}.`
            : `Service is approaching for ${name}.`,
        metric: overdue ? 'Overdue' : `${d} day${d === 1 ? '' : 's'}`,
        priority: overdue || d <= 7 ? 'HIGH' : 'MEDIUM',
        ctaLabel: isAc ? 'View maintenance' : 'View service',
        sort: overdue ? 0 : 1,
      });
    }
  }

  if (!candidates.length) {
    const expectsMaintenance =
      caps.supportsServiceHistory ||
      caps.supportsOdometer ||
      cat === 'ac' ||
      cat === 'vehicle' ||
      cat === 'bike' ||
      cat === 'car';
    if (expectsMaintenance && !asset.nextServiceDue && asset.nextServiceOdometerKm == null) {
      return {
        title: 'Maintenance schedule unavailable',
        why: `Add service details for ${name} to get a next action.`,
        metric: '—',
        priority: 'LOW',
        ctaLabel: 'Add details',
      };
    }
    return null;
  }
  candidates.sort((a, b) => a.sort - b.sort);
  return candidates[0];
}

/**
 * Compact one-line next action for asset cards.
 */
export function primaryNextActionLine(asset = {}) {
  const a = resolvePrimaryNextAction(asset);
  if (!a) return null;
  if (a.metric && a.metric !== '—' && !a.title.includes(a.metric)) {
    return a.title;
  }
  return a.title;
}

/**
 * Category-aware health breakdown labels for HealthScoreExplain (display only).
 * Uses existing health.explainFactors when present; remaps labels by capability.
 */
export function categoryHealthFactors(asset = {}, health = {}) {
  const caps = resolveAssetCapabilities(asset);
  const base = Array.isArray(health.explainFactors) ? health.explainFactors : [];
  const byId = Object.fromEntries(base.map((f) => [f.id, f]));

  const factors = [];
  factors.push(
    byId.documents || {
      id: 'documents',
      label: 'Documents',
      status: '—',
      tone: 'neutral',
    },
  );

  if (caps.supportsInsurance) {
    const d = daysUntil(asset.insuranceExpiry);
    factors.push({
      id: 'insurance',
      label: 'Insurance',
      status: d == null ? 'Not set' : d < 0 ? 'Expired' : 'Active',
      tone: d == null ? 'neutral' : d < 0 ? 'error' : 'success',
    });
  }
  if (caps.supportsPUC) {
    const d = daysUntil(asset.pucExpiry);
    factors.push({
      id: 'puc',
      label: 'PUC',
      status: d == null ? 'Not set' : d < 0 ? 'Expired' : 'Active',
      tone: d == null ? 'neutral' : d < 0 ? 'error' : 'success',
    });
  }

  factors.push(
    byId.warranty || {
      id: 'warranty',
      label: 'Warranty',
      status: '—',
      tone: 'neutral',
    },
  );

  if (caps.supportsBatteryHealth) {
    const pct = asset.batteryProfile?.healthPercent;
    factors.push({
      id: 'battery',
      label: 'Battery',
      status: pct != null ? `${pct}%` : 'Not set',
      tone: pct == null ? 'neutral' : pct >= 80 ? 'success' : pct >= 60 ? 'warning' : 'error',
    });
  }

  if (caps.supportsServiceHistory || String(asset.categoryId || '').toLowerCase() === 'ac') {
    factors.push(
      byId.maintenance || {
        id: 'maintenance',
        label: String(asset.categoryId || '').toLowerCase() === 'ac' ? 'Filter / service' : 'Service',
        status: '—',
        tone: 'neutral',
      },
    );
  }

  factors.push(
    byId.issues || {
      id: 'issues',
      label: 'Recent issues',
      status: 'None',
      tone: 'success',
    },
  );

  return factors.slice(0, 6);
}

export function assetCategoryChip(asset = {}) {
  return categoryFamilyLabel(asset);
}

export default {
  resolvePrimaryNextAction,
  primaryNextActionLine,
  categoryHealthFactors,
  assetCategoryChip,
};

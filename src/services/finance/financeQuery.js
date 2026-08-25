/**
 * Structured finance query layer — real data only, no fake chatbot.
 * Returns null/empty when data cannot answer the question.
 */

import { buildPortfolioFinance, buildAssetFinanceSnapshot } from './portfolioFinance';
import { buildEnergyCostDashboard } from './energyCostAnalytics';
import { computeProfileCompleteness } from './completenessScore';
import { evaluateServiceDue } from '../health/serviceDueEngine';
import { daysUntil } from '../../utils/dates';

/**
 * @param {string} intent
 * @param {object[]} assets
 * @param {object} [opts]
 */
export function queryPortfolioFinance(intent, assets = [], opts = {}) {
  const key = String(intent || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const portfolio = buildPortfolioFinance(assets, opts);

  switch (key) {
    case 'portfolio_summary':
    case 'how_much_is_my_portfolio':
      return {
        intent: key,
        purchaseValue: portfolio.purchaseValue,
        currentEstimatedValue: portfolio.currentEstimatedValue,
        totalOwnershipCost: portfolio.totalOwnershipCost,
        totalAssets: portfolio.totalAssets,
        labels: {
          purchase: portfolio.purchaseLabel,
          current: portfolio.currentLabel,
          ownership: portfolio.ownershipLabel,
        },
      };

    case 'total_spent_this_month':
    case 'spending_this_month':
      return {
        intent: key,
        available: false,
        reason: 'Monthly expense rows not loaded in this query context',
        hint: 'Pass expenseRows via opts to enable',
      };

    case 'highest_energy_ac':
    case 'which_ac_costs_most': {
      const energy = buildEnergyCostDashboard(assets, opts);
      const top = energy.acDashboard?.highest;
      if (!top) return { intent: key, available: false, reason: 'No AC energy estimates' };
      return {
        intent: key,
        available: true,
        assetId: top.assetId,
        name: top.name,
        monthlyCost: top.monthlyCost,
        monthlyKwh: top.monthlyKwh,
        isEstimate: true,
        message: energy.comparisonMessage,
      };
    }

    case 'assets_needing_service': {
      const due = (assets || [])
        .filter((a) => a && !a.deletedAt)
        .map((a) => ({ asset: a, service: evaluateServiceDue(a) }))
        .filter((r) =>
          ['SERVICE_OVERDUE', 'SERVICE_DUE', 'SERVICE_UPCOMING'].includes(r.service.status),
        )
        .map((r) => ({
          assetId: r.asset.assetId || r.asset.id,
          name: r.asset.nickname || r.asset.assetName,
          status: r.service.status,
          message: r.service.message,
          recommended: r.service.recommended,
        }));
      return { intent: key, available: true, count: due.length, assets: due };
    }

    case 'missing_documents':
    case 'incomplete_profiles': {
      const rows = (assets || [])
        .filter((a) => a && !a.deletedAt)
        .map((a) => ({
          assetId: a.assetId || a.id,
          name: a.nickname || a.assetName,
          completeness: computeProfileCompleteness(a),
        }))
        .filter((r) => r.completeness.percent < 100)
        .sort((a, b) => a.completeness.percent - b.completeness.percent);
      return { intent: key, available: true, count: rows.length, assets: rows.slice(0, 20) };
    }

    case 'next_warranty_expiry': {
      const rows = (assets || [])
        .filter((a) => a && !a.deletedAt && a.warrantyExpiry)
        .map((a) => ({
          assetId: a.assetId || a.id,
          name: a.nickname || a.assetName,
          warrantyExpiry: a.warrantyExpiry,
          days: daysUntil(a.warrantyExpiry),
        }))
        .filter((r) => r.days != null)
        .sort((a, b) => a.days - b.days);
      const next = rows[0];
      if (!next) return { intent: key, available: false, reason: 'No warranty dates' };
      return { intent: key, available: true, ...next };
    }

    case 'asset_spend':
    case 'how_much_spent_on_asset': {
      const id = opts.assetId;
      const asset = (assets || []).find((a) => (a.assetId || a.id) === id);
      if (!asset) return { intent: key, available: false, reason: 'Asset not found' };
      const snap = buildAssetFinanceSnapshot(asset, opts);
      return {
        intent: key,
        available: true,
        assetId: id,
        ownership: snap.ownership,
        purchase: snap.purchase,
        currentEstimated: snap.currentEstimated,
      };
    }

    case 'highest_maintenance': {
      const top = portfolio.top?.highestMaintenance?.[0];
      if (!top) return { intent: key, available: false };
      return {
        intent: key,
        available: true,
        assetId: top.assetId,
        name: top.name,
        service: top.ownership.service,
        repair: top.ownership.repair,
      };
    }

    default:
      return { intent: key, available: false, reason: 'Unsupported query intent' };
  }
}

export const FINANCE_QUERY_INTENTS = Object.freeze([
  'portfolio_summary',
  'highest_energy_ac',
  'assets_needing_service',
  'missing_documents',
  'next_warranty_expiry',
  'asset_spend',
  'highest_maintenance',
]);

export default { queryPortfolioFinance, FINANCE_QUERY_INTENTS };

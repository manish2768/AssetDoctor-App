/**
 * Future export architecture for analytics (PDF / CSV / Excel).
 * Uses existing Print infrastructure when available — no new deps.
 */

export const ANALYTICS_EXPORT_FORMATS = Object.freeze({
  PDF: 'pdf',
  CSV: 'csv',
  EXCEL: 'excel',
});

export function buildAnalyticsExportPayload(analytics = {}, portfolio = null) {
  if (!analytics?.available) {
    return { available: false, reason: 'Analytics unavailable' };
  }
  return {
    available: true,
    generatedAt: new Date().toISOString(),
    currencyCode: analytics.currencyCode || 'INR',
    asset: {
      assetId: analytics.assetId,
      name: analytics.name,
      lifecycle: analytics.lifecycle?.status,
      replacementFlag: analytics.replacementFlag,
    },
    financial: {
      purchase: analytics.purchase?.available ? analytics.purchase.value : null,
      ownershipCost: analytics.ownership?.totalOwnershipCost ?? null,
      estimatedValue: analytics.currentEstimated?.available
        ? analytics.currentEstimated.value
        : null,
      costPerMonth: analytics.period?.costPerMonth ?? null,
      costPerYear: analytics.period?.costPerYear ?? null,
    },
    portfolio: portfolio
      ? {
          totalAssets: portfolio.totalAssets,
          purchaseValue: portfolio.purchaseValue,
          totalOwnershipCost: portfolio.totalOwnershipCost,
          currentEstimatedValue: portfolio.currentEstimatedValue,
        }
      : null,
    note: 'Export stub — wire to PdfExporter / CSV when product enables downloads.',
    supportedFormats: Object.values(ANALYTICS_EXPORT_FORMATS),
  };
}

export async function exportAnalyticsPdf(analytics, printAsync) {
  const payload = buildAnalyticsExportPayload(analytics);
  if (!payload.available) return { success: false, error: payload.reason };
  if (typeof printAsync !== 'function') {
    return { success: false, error: 'Print infrastructure unavailable', payload };
  }
  const html = `<html><body><h1>${payload.asset.name}</h1>
    <p>Purchase: ${payload.financial.purchase ?? 'N/A'}</p>
    <p>Ownership: ${payload.financial.ownershipCost ?? 'N/A'}</p>
    <p>Estimated: ${payload.financial.estimatedValue ?? 'N/A'}</p>
    <p>Generated: ${payload.generatedAt}</p>
    </body></html>`;
  await printAsync({ html });
  return { success: true, format: 'pdf' };
}

export default {
  ANALYTICS_EXPORT_FORMATS,
  buildAnalyticsExportPayload,
  exportAnalyticsPdf,
};

/**
 * Asset timeline foundation — merge purchase / service / location / docs later.
 */

export function buildAssetTimeline(asset = {}, { services = [], locationHistory = [], documents = [] } = {}) {
  const events = [];

  if (asset.purchaseDate) {
    events.push({
      id: `purchase_${asset.assetId}`,
      type: 'purchase',
      date: asset.purchaseDate,
      title: 'Purchased',
      amount: Number(asset.purchasePrice ?? asset.value) || 0,
      meta: { storeName: asset.storeName || '' },
    });
  }

  for (const s of services || []) {
    events.push({
      id: s.id || `svc_${events.length}`,
      type: 'service',
      date: s.serviceDate || s.repairDate || s.date,
      title: s.serviceType || s.title || 'Service',
      amount: Number(s.totalAmount ?? s.costInr ?? s.cost) || 0,
      meta: { provider: s.serviceProvider || s.vendor || '' },
    });
  }

  for (const h of locationHistory || []) {
    events.push({
      id: h.id || `loc_${events.length}`,
      type: 'location',
      date: h.startDate || h.createdAt || null,
      title: 'Location',
      amount: 0,
      meta: { path: h.locationPath || '' },
    });
  }

  for (const d of documents || []) {
    events.push({
      id: d.docId || d.id || `doc_${events.length}`,
      type: 'document',
      date: d.createdAt || d.date || null,
      title: d.type || d.label || 'Document',
      amount: 0,
      meta: {},
    });
  }

  return events
    .filter((e) => e.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export default { buildAssetTimeline };

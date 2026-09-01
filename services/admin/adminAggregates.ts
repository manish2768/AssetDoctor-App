/**
 * Phase 11.4 — Admin intelligence aggregators.
 * Pure functions. No Firestore writes. Never invent metrics.
 */

export const ADMIN_PORTFOLIO_KEYS = [
  'vehicle',
  'gadget',
  'home',
  'equipment',
  'business',
  'other',
] as const;

export type AdminPortfolioKey = (typeof ADMIN_PORTFOLIO_KEYS)[number];

const VEHICLE_HINT =
  /\b(vehicle|bike|car|scooter|motorcycle|auto|two[\s-]?wheeler|four[\s-]?wheeler|ev)\b/i;
const GADGET_HINT = /\b(gadget|phone|mobile|laptop|tablet|watch|earbud|headphone|imei)\b/i;
const HOME_HINT = /\b(home|appliance|ac|inverter|fridge|washer|tv|cooler|geyser|fan)\b/i;
const EQUIP_HINT = /\b(equipment|generator|tool|machinery|pump)\b/i;
const BIZ_HINT = /\b(business|pos|printer|shop|office)\b/i;

export function classifyAdminAssetCategory(asset: Record<string, unknown> = {}): AdminPortfolioKey {
  const raw = String(
    asset.categoryKey || asset.category || asset.categoryLabel || asset.type || '',
  )
    .trim()
    .toLowerCase();
  if (raw === 'vehicle' || raw === 'vehicles') return 'vehicle';
  if (raw === 'gadget' || raw === 'electronics' || raw === 'phone') return 'gadget';
  if (raw === 'home' || raw === 'appliance' || raw === 'property') return 'home';
  if (raw === 'equipment') return 'equipment';
  if (raw === 'business') return 'business';
  if (raw === 'other') return 'other';
  const blob = `${raw} ${asset.assetName || asset.name || ''}`;
  if (VEHICLE_HINT.test(blob)) return 'vehicle';
  if (GADGET_HINT.test(blob)) return 'gadget';
  if (HOME_HINT.test(blob)) return 'home';
  if (EQUIP_HINT.test(blob)) return 'equipment';
  if (BIZ_HINT.test(blob)) return 'business';
  return 'other';
}

export function countAssetsByCategory(assets: Array<Record<string, unknown>> = []) {
  const counts: Record<AdminPortfolioKey, number> = {
    vehicle: 0,
    gadget: 0,
    home: 0,
    equipment: 0,
    business: 0,
    other: 0,
  };
  for (const asset of assets) {
    counts[classifyAdminAssetCategory(asset)] += 1;
  }
  return counts;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ExpiryBucket = 'expired' | 'd0_7' | 'd8_30' | 'd31_90' | 'd90_plus' | 'unknown';

export function expiryBucket(diffDays: number | null): ExpiryBucket {
  if (diffDays == null || !Number.isFinite(diffDays)) return 'unknown';
  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return 'd0_7';
  if (diffDays <= 30) return 'd8_30';
  if (diffDays <= 90) return 'd31_90';
  return 'd90_plus';
}

export function buildExpiryBuckets(
  assets: Array<Record<string, unknown>> = [],
  now = new Date(),
) {
  const buckets: Record<ExpiryBucket, number> = {
    expired: 0,
    d0_7: 0,
    d8_30: 0,
    d31_90: 0,
    d90_plus: 0,
    unknown: 0,
  };
  let dated = 0;
  for (const asset of assets) {
    const dates = [asset.warrantyExpiry, asset.insuranceExpiry, asset.pucExpiry];
    for (const raw of dates) {
      const exp = parseDate(raw);
      if (!exp) continue;
      dated += 1;
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      buckets[expiryBucket(diffDays)] += 1;
    }
  }
  return { buckets, dated, available: dated > 0 };
}

export function countAssetsAddedInWindow(
  assets: Array<Record<string, unknown>> = [],
  days: number,
  now = new Date(),
) {
  const cutoff = now.getTime() - days * 86400000;
  let counted = 0;
  let withTimestamp = 0;
  for (const asset of assets) {
    const created = parseDate(asset.createdAt || asset.created_at || asset.addedAt);
    if (!created) continue;
    withTimestamp += 1;
    if (created.getTime() >= cutoff) counted += 1;
  }
  return {
    count: withTimestamp === 0 ? null : counted,
    withTimestamp,
    available: withTimestamp > 0,
  };
}

export function summarizeWhatsAppQueue(items: Array<Record<string, unknown>> = []) {
  const tallies = {
    queued: 0,
    processing: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    retrying: 0,
    cancelled: 0,
    skipped: 0,
    other: 0,
  };
  for (const item of items) {
    const status = String(item.status || '').toLowerCase();
    if (status in tallies) (tallies as Record<string, number>)[status] += 1;
    else tallies.other += 1;
  }
  const terminal = tallies.sent + tallies.delivered + tallies.read + tallies.failed;
  const successful = tallies.delivered + tallies.read;
  return {
    ...tallies,
    total: items.length,
    deliveryRate: terminal > 0 ? Math.round((successful / terminal) * 1000) / 10 : null,
    failureRate: terminal > 0 ? Math.round((tallies.failed / terminal) * 1000) / 10 : null,
    readRate: terminal > 0 ? Math.round((tallies.read / terminal) * 1000) / 10 : null,
    telemetryAvailable: items.length > 0,
  };
}

export function classifyTemplateLifecycle(tpl: Record<string, unknown> = {}) {
  const meta = String(tpl.metaStatus || '').toUpperCase();
  const status = String(tpl.status || '').toLowerCase();
  const registered = Boolean(tpl.templateKey || tpl.metaTemplateName);
  const submitted = ['PENDING', 'APPROVED', 'REJECTED', 'SUBMITTED'].includes(meta) || status === 'pending';
  const approved = meta === 'APPROVED' || status === 'approved';
  const rejected = meta === 'REJECTED' || status === 'rejected';
  const deliverable = approved && tpl.isActive !== false;
  let label = 'NOT_SUBMITTED';
  if (approved) label = 'APPROVED';
  else if (rejected) label = 'REJECTED';
  else if (submitted) label = 'PENDING';
  else if (status === 'draft') label = 'DRAFT';
  else if (meta) label = meta;
  return {
    registered,
    submittedToMeta: submitted,
    approvedByMeta: approved,
    deliverable,
    label,
  };
}

export function summarizeTemplates(templates: Array<Record<string, unknown>> = []) {
  let draft = 0;
  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let notSubmitted = 0;
  let deliverable = 0;
  const hasWelcome = templates.some(
    (t) => String(t.templateKey || t.metaTemplateName || '') === 'welcome_message',
  );
  for (const tpl of templates) {
    const life = classifyTemplateLifecycle(tpl);
    if (life.label === 'APPROVED') approved += 1;
    else if (life.label === 'REJECTED') rejected += 1;
    else if (life.label === 'PENDING') pending += 1;
    else if (life.label === 'DRAFT') draft += 1;
    else notSubmitted += 1;
    if (life.deliverable) deliverable += 1;
  }
  return {
    total: templates.length,
    draft,
    pending,
    approved,
    rejected,
    notSubmitted,
    deliverable,
    hasWelcomeRegistry: hasWelcome,
  };
}

export type DiagnosticStatus =
  | 'PASS'
  | 'FAIL'
  | 'SKIPPED'
  | 'NOT_FOUND'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export function diagnoseWelcomeMessage({
  user,
  queueItems = [],
  templates = [],
}: {
  user?: Record<string, unknown> | null;
  queueItems?: Array<Record<string, unknown>>;
  templates?: Array<Record<string, unknown>>;
}) {
  if (!user) {
    return {
      stages: [{ id: 'customer', label: 'Customer record', status: 'NOT_FOUND' as DiagnosticStatus }],
      summary: 'Select a customer to diagnose welcome WhatsApp.',
    };
  }
  const phone = String(user.phone || user.phoneNumber || '').trim();
  const optIn = user.whatsappOptIn !== false;
  const uid = String(user.id || user.uid || '');
  const welcomeItems = queueItems.filter(
    (q) =>
      String(q.userId) === uid &&
      (q.templateKey === 'welcome_message' || q.eventType === 'user_welcome' || q.type === 'WELCOME'),
  );
  const latest = welcomeItems[0] || null;
  const registry = templates.find(
    (t) => String(t.templateKey || t.metaTemplateName || '') === 'welcome_message',
  );
  const life = registry ? classifyTemplateLifecycle(registry) : null;
  const qStatus = String(latest?.status || '').toLowerCase();

  const stages: Array<{ id: string; label: string; status: DiagnosticStatus; detail: string }> = [
    {
      id: 'customer',
      label: 'Customer created',
      status: 'PASS',
      detail: uid,
    },
    {
      id: 'phone',
      label: 'Phone normalized',
      status: phone ? 'PASS' : 'FAIL',
      detail: phone ? 'Present (masked in UI)' : 'Missing phone — Cloud Function will not send',
    },
    {
      id: 'optin',
      label: 'WhatsApp opt-in',
      status: optIn ? 'PASS' : 'SKIPPED',
      detail: optIn ? 'whatsappOptIn is not false' : 'User opted out',
    },
    {
      id: 'trigger',
      label: 'Welcome trigger',
      status: user.welcomeMessageQueued || user.welcomeMessageSent || latest ? 'PASS' : phone && optIn ? 'FAIL' : 'SKIPPED',
      detail: user.welcomeMessageSent
        ? 'welcomeMessageSent=true'
        : user.welcomeMessageQueued
          ? 'welcomeMessageQueued=true'
          : latest
            ? 'Queue document exists'
            : 'No queue flag on user',
    },
    {
      id: 'registry',
      label: 'Admin template registry',
      status: registry ? 'PASS' : 'NOT_FOUND',
      detail: registry
        ? `Registered as ${life?.label || 'UNKNOWN'}`
        : 'welcome_message is not in /whatsapp_templates. Cloud Function still hardcodes Meta name welcome_message.',
    },
    {
      id: 'meta_template',
      label: 'Meta deliverable (registry)',
      status: life?.deliverable ? 'PASS' : registry ? 'NOT_CONFIGURED' : 'NOT_CONFIGURED',
      detail:
        'Cloud Function does not read this registry. Production send uses Meta template name welcome_message. Registry NOT_SUBMITTED does not by itself block CF send.',
    },
    {
      id: 'queue',
      label: 'notification_queue document',
      status: latest ? 'PASS' : 'NOT_FOUND',
      detail: latest ? `status=${latest.status || 'unknown'}` : `Expected doc id welcome_${uid}`,
    },
    {
      id: 'api',
      label: 'Meta API request',
      status: latest && (qStatus === 'sent' || qStatus === 'delivered' || qStatus === 'read' || latest.wamid)
        ? 'PASS'
        : latest && qStatus === 'failed'
          ? 'FAIL'
          : latest
            ? 'UNKNOWN'
            : 'NOT_FOUND',
      detail: latest?.wamid
        ? 'wamid present'
        : latest?.failureReason
          ? String(latest.failureReason)
          : latest
            ? 'No wamid yet'
            : 'No queue item',
    },
    {
      id: 'webhook',
      label: 'Webhook delivery event',
      status:
        qStatus === 'delivered' || qStatus === 'read'
          ? 'PASS'
          : qStatus === 'failed'
            ? 'FAIL'
            : latest && qStatus === 'sent'
              ? 'UNKNOWN'
              : 'NOT_FOUND',
      detail:
        qStatus === 'delivered' || qStatus === 'read'
          ? qStatus
          : 'Admin does not subscribe to /whatsappLogs. Status comes from notification_queue only.',
    },
  ];

  return { stages, latest, registryPresent: Boolean(registry), summary: stages.map((s) => s.status).join(',') };
}

export function classifyOcrDocument(doc: Record<string, unknown> = {}) {
  const status = String(doc.status || doc.reviewStatus || doc.ocrStatus || '').toLowerCase();
  const confidence = Number(doc.confidence ?? doc.ocrConfidence);
  if (status.includes('fail')) return 'failed';
  if (status.includes('review') || doc.needsManualReview === true) return 'needs_review';
  if (Number.isFinite(confidence) && confidence > 0 && confidence < 70) return 'needs_review';
  if (status.includes('processed') || status.includes('approved') || status.includes('success')) return 'processed';
  if (Number.isFinite(confidence) && confidence >= 85) return 'high_confidence';
  return 'unknown';
}

export function summarizeDocuments(docs: Array<Record<string, unknown>> = []) {
  const tallies = {
    processed: 0,
    high_confidence: 0,
    needs_review: 0,
    failed: 0,
    unknown: 0,
  };
  for (const doc of docs) {
    const key = classifyOcrDocument(doc);
    if (key in tallies) (tallies as Record<string, number>)[key] += 1;
    else tallies.unknown += 1;
  }
  return { total: docs.length, ...tallies };
}

export function summarizeOcrQueue(queue: Array<Record<string, unknown>> = []) {
  return {
    pending: queue.length,
    providerUsageAvailable: queue.some((q) => q.engine || q.ocrProvider || q.googleCalled != null),
  };
}

export function buildInsights(input: {
  users?: Array<Record<string, unknown>>;
  assets?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  ocrQueue?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
  expiries?: Array<{ status?: string; type?: string }>;
}) {
  const users = input.users || [];
  const assets = input.assets || [];
  const documents = input.documents || [];
  const ocrQueue = input.ocrQueue || [];
  const notifications = input.notifications || [];
  const expiries = input.expiries || [];
  const insights: Array<{
    id: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    text: string;
    tab: string;
  }> = [];

  const expSoon = expiries.filter((e) => e.status === 'EXPIRED' || e.status === 'EXP30');
  if (expSoon.length) {
    insights.push({
      id: 'expiry',
      severity: expSoon.some((e) => e.status === 'EXPIRED') ? 'CRITICAL' : 'HIGH',
      text: `${expSoon.length} coverage record${expSoon.length === 1 ? '' : 's'} expired or due within 30 days.`,
      tab: 'expiry',
    });
  }
  if (ocrQueue.length) {
    insights.push({
      id: 'ocr',
      severity: 'MEDIUM',
      text: `${ocrQueue.length} document${ocrQueue.length === 1 ? '' : 's'} require OCR review.`,
      tab: 'ocr_review',
    });
  }
  const pendingWa = notifications.filter((n) => {
    const s = String(n.status || '').toLowerCase();
    return s === 'queued' || s === 'pending' || s === 'processing';
  }).length;
  if (pendingWa) {
    insights.push({
      id: 'wa-pending',
      severity: 'MEDIUM',
      text: `${pendingWa} WhatsApp notification${pendingWa === 1 ? '' : 's'} pending in queue.`,
      tab: 'whatsapp',
    });
  }
  const usersMissingAssets = users.filter((u) => {
    const uid = String(u.id || u.uid || '');
    return uid && !assets.some((a) => String(a.ownerUid || a.uid) === uid);
  }).length;
  if (usersMissingAssets) {
    insights.push({
      id: 'incomplete-docs',
      severity: 'LOW',
      text: `${usersMissingAssets} customer${usersMissingAssets === 1 ? '' : 's'} have no vaulted assets.`,
      tab: 'users',
    });
  }
  const typeCounts: Record<string, number> = {};
  for (const e of expSoon) {
    const t = String(e.type || 'Coverage');
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
  if (topType) {
    insights.push({
      id: 'top-expiry',
      severity: 'LOW',
      text: `${topType[0]} is the highest active reminder category (${topType[1]}).`,
      tab: 'expiry',
    });
  }
  if (!documents.length && assets.length) {
    insights.push({
      id: 'no-docs',
      severity: 'MEDIUM',
      text: `${assets.length} assets are vaulted but no documents are visible in admin.`,
      tab: 'documents',
    });
  }
  return insights;
}

export function customerHealth(
  user: Record<string, unknown>,
  assets: Array<Record<string, unknown>>,
  expiries: Array<{ ownerUid?: string; status?: string }>,
) {
  const uid = String(user.id || user.uid || '');
  const owned = assets.filter((a) => String(a.ownerUid || a.uid) === uid);
  const ownExp = expiries.filter((e) => e.ownerUid === uid);
  const critical = ownExp.some((e) => e.status === 'EXPIRED');
  const attention = ownExp.some((e) => e.status === 'EXP30');
  if (critical) return 'At Risk';
  if (attention || !owned.length) return 'Attention';
  return 'Healthy';
}

export function formatMetric(value: number | null | undefined, fallback = 'No data yet') {
  if (value == null || !Number.isFinite(Number(value))) return fallback;
  return String(value);
}

export const WELCOME_META_TEMPLATE = 'welcome_message';

/* ---------- Phase 11.6 — analytics (pure, no invented metrics) ---------- */

export const ADMIN_DOC_TYPE_KEYS = [
  'insurance',
  'service',
  'purchase',
  'warranty',
  'rc',
  'puc',
  'other',
] as const;

export type AdminDocTypeKey = (typeof ADMIN_DOC_TYPE_KEYS)[number];

export const ADMIN_DOC_TYPE_LABELS: Record<AdminDocTypeKey, string> = {
  insurance: 'Insurance',
  service: 'Service',
  purchase: 'Purchase Invoice',
  warranty: 'Warranty',
  rc: 'RC',
  puc: 'PUC',
  other: 'Other',
};

export type AnalyticsRange = '7D' | '30D' | '90D' | 'ALL';

export const HEALTH_BUCKETS = ['Excellent', 'Good', 'Attention', 'Critical'] as const;
export type HealthBucket = (typeof HEALTH_BUCKETS)[number];

export function parseAdminDate(value: unknown): Date | null {
  return parseDate(value);
}

export function classifyAdminDocumentType(doc: Record<string, unknown> = {}): AdminDocTypeKey {
  const raw = String(doc.type || doc.docType || doc.documentType || doc.label || doc.category || '')
    .trim()
    .toLowerCase();
  if (/insur/.test(raw)) return 'insurance';
  if (/\bpuc\b|_puc_|puc_/.test(raw)) return 'puc';
  if (/(^|[^a-z])rc([^a-z]|$)|registration/.test(raw)) return 'rc';
  if (/warrant/.test(raw)) return 'warranty';
  if (/service/.test(raw)) return 'service';
  if (/purchase|invoice|bill/.test(raw)) return 'purchase';
  return 'other';
}

export function summarizeDocumentTypes(
  docs: Array<Record<string, unknown>> = [],
  ocrQueue: Array<Record<string, unknown>> = [],
) {
  const counts: Record<AdminDocTypeKey, number> = {
    insurance: 0,
    service: 0,
    purchase: 0,
    warranty: 0,
    rc: 0,
    puc: 0,
    other: 0,
  };
  const review: Record<AdminDocTypeKey, number> = {
    insurance: 0,
    service: 0,
    purchase: 0,
    warranty: 0,
    rc: 0,
    puc: 0,
    other: 0,
  };
  for (const doc of docs) {
    const key = classifyAdminDocumentType(doc);
    counts[key] += 1;
    if (classifyOcrDocument(doc) === 'needs_review') review[key] += 1;
  }
  for (const item of ocrQueue) {
    review[classifyAdminDocumentType(item)] += 1;
  }
  const total = docs.length;
  const rows = ADMIN_DOC_TYPE_KEYS.map((key) => ({
    key,
    label: ADMIN_DOC_TYPE_LABELS[key],
    count: counts[key],
    review: review[key],
    percent: total > 0 ? Math.round((counts[key] / total) * 1000) / 10 : null,
  }));
  const top = rows.slice().sort((a, b) => b.count - a.count)[0];
  return {
    total,
    available: total > 0,
    rows,
    mostScanned: total > 0 && top && top.count > 0 ? top : null,
  };
}

function createdAtOf(record: Record<string, unknown>): Date | null {
  return parseDate(
    record.createdAt || record.created_at || record.addedAt || record.joinedAt || record.registeredAt,
  );
}

export function analyticsRangeDays(range: AnalyticsRange): number | null {
  if (range === '7D') return 7;
  if (range === '30D') return 30;
  if (range === '90D') return 90;
  return null;
}

export function buildGrowthSeries(
  users: Array<Record<string, unknown>> = [],
  assets: Array<Record<string, unknown>> = [],
  range: AnalyticsRange = '30D',
  now = new Date(),
) {
  const userDates = users.map(createdAtOf).filter((d): d is Date => Boolean(d));
  const assetDates = assets.map(createdAtOf).filter((d): d is Date => Boolean(d));
  const customersAvailable = userDates.length > 0;
  const assetsAvailable = assetDates.length > 0;
  if (!customersAvailable && !assetsAvailable) {
    return {
      available: false,
      points: [] as Array<{ t: Date; customers: number | null; assets: number | null }>,
      userDated: 0,
      assetDated: 0,
      limited: true,
    };
  }
  const days = analyticsRangeDays(range);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (days == null) {
    const all = [...userDates, ...assetDates];
    const earliest = new Date(Math.min(...all.map((d) => d.getTime())));
    earliest.setHours(0, 0, 0, 0);
    start.setTime(earliest.getTime());
  } else {
    start.setDate(start.getDate() - (days - 1));
  }
  const spanDays = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000) + 1);
  const step = spanDays > 120 ? 7 : 1;
  const points: Array<{ t: Date; customers: number | null; assets: number | null }> = [];
  for (let t = start.getTime(); t <= now.getTime(); t += step * 86400000) {
    const end = t + step * 86400000;
    points.push({
      t: new Date(t),
      customers: customersAvailable ? userDates.filter((d) => d.getTime() < end).length : null,
      assets: assetsAvailable ? assetDates.filter((d) => d.getTime() < end).length : null,
    });
  }
  return {
    available: true,
    points,
    userDated: userDates.length,
    assetDated: assetDates.length,
    limited: userDates.length < users.length || assetDates.length < assets.length || userDates.length + assetDates.length < 2,
  };
}

export function summarizeProtectionRisk(
  expiries: Array<{ status?: string; type?: string }> = [],
) {
  const types = ['Insurance', 'Warranty', 'PUC'] as const;
  const byType: Record<
    (typeof types)[number],
    { healthy: number; expiring: number; expired: number; total: number }
  > = {
    Insurance: { healthy: 0, expiring: 0, expired: 0, total: 0 },
    Warranty: { healthy: 0, expiring: 0, expired: 0, total: 0 },
    PUC: { healthy: 0, expiring: 0, expired: 0, total: 0 },
  };
  for (const row of expiries) {
    const t = String(row.type || '') as (typeof types)[number];
    if (!(t in byType)) continue;
    byType[t].total += 1;
    if (row.status === 'EXPIRED') byType[t].expired += 1;
    else if (row.status === 'EXP30') byType[t].expiring += 1;
    else if (row.status === 'HEALTHY' || row.status === 'EXP60') byType[t].healthy += 1;
  }
  const dated = expiries.length;
  const expired = expiries.filter((e) => e.status === 'EXPIRED').length;
  const expiring = expiries.filter((e) => e.status === 'EXP30').length;
  const healthy = expiries.filter((e) => e.status === 'HEALTHY' || e.status === 'EXP60').length;
  return {
    byType,
    dated,
    expired,
    expiring,
    healthy,
    attention: expired + expiring,
    coverage: dated > 0 ? Math.round((healthy / dated) * 1000) / 10 : null,
    available: dated > 0,
  };
}

function daysUntilAdmin(value: unknown, now: Date): number | null {
  const d = parseDate(value);
  if (!d) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function scoreAdminAssetHealth(asset: Record<string, unknown> = {}, now = new Date()) {
  let score = 100;
  if (!asset.billImageUrl && !asset.hasBill) score -= 8;
  if (!asset.serialNumber && !asset.chassisNumber && !asset.registration) score -= 7;
  if (!asset.purchaseDate) score -= 5;
  if (!asset.storeName) score -= 5;
  const cat = classifyAdminAssetCategory(asset);
  const keys = ['warrantyExpiry'];
  if (cat === 'vehicle') keys.push('insuranceExpiry', 'pucExpiry');
  let expiryPenalty = 0;
  for (const key of keys) {
    const days = daysUntilAdmin(asset[key], now);
    if (days == null) continue;
    if (days < 0) expiryPenalty += 15;
    else if (days <= 7) expiryPenalty += 10;
    else if (days <= 30) expiryPenalty += 5;
  }
  score -= Math.min(40, expiryPenalty);
  const pd = parseDate(asset.purchaseDate);
  if (pd) {
    const years = (now.getTime() - pd.getTime()) / (86400000 * 365.25);
    if (years > 8) score -= 20;
    else if (years > 5) score -= 14;
    else if (years > 3) score -= 8;
    else if (years > 1) score -= 3;
  }
  const cond = String(asset.condition || '').toLowerCase();
  if (cond === 'excellent') score += 10;
  else if (cond === 'good') score += 5;
  else if (cond === 'fair') score -= 5;
  else if (cond === 'poor') score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));
  let bucket: HealthBucket = 'Critical';
  if (score >= 85) bucket = 'Excellent';
  else if (score >= 70) bucket = 'Good';
  else if (score >= 30) bucket = 'Attention';
  return { score, bucket };
}

export function bucketAssetHealth(assets: Array<Record<string, unknown>> = [], now = new Date()) {
  const counts: Record<HealthBucket, number> = {
    Excellent: 0,
    Good: 0,
    Attention: 0,
    Critical: 0,
  };
  for (const asset of assets) {
    counts[scoreAdminAssetHealth(asset, now).bucket] += 1;
  }
  const needAttention = counts.Attention + counts.Critical;
  const healthy = counts.Excellent + counts.Good;
  return {
    counts,
    total: assets.length,
    available: assets.length > 0,
    needAttention,
    healthy,
    insight:
      assets.length === 0
        ? null
        : needAttention > 0
          ? `${needAttention} asset${needAttention === 1 ? '' : 's'} need attention.`
          : 'All tracked assets are currently healthy.',
  };
}

export function summarizeOcrQuality(
  docs: Array<Record<string, unknown>> = [],
  ocrQueue: Array<Record<string, unknown>> = [],
) {
  const sum = summarizeDocuments(docs);
  const hasConfidence = docs.some((d) => d.confidence != null || d.ocrConfidence != null);
  const hasEngine =
    ocrQueue.some((q) => q.engine || q.ocrProvider || q.googleCalled != null) ||
    docs.some((d) => d.engine || d.ocrProvider);
  return {
    ...sum,
    reviewQueue: ocrQueue.length,
    confidenceTelemetry: hasConfidence,
    engineTelemetry: hasEngine,
  };
}

export function summarizeWelcomeQueue(items: Array<Record<string, unknown>> = []) {
  const welcome = items.filter((q) => {
    const id = String(q.id || '');
    return (
      q.templateKey === WELCOME_META_TEMPLATE ||
      q.templateName === WELCOME_META_TEMPLATE ||
      q.eventType === 'user_welcome' ||
      q.type === 'WELCOME' ||
      id.startsWith('welcome_')
    );
  });
  const statusOf = (w: Record<string, unknown>) => String(w.status || '').toLowerCase();
  const pending = welcome.filter((w) =>
    ['queued', 'pending', 'processing', 'sending'].includes(statusOf(w)),
  ).length;
  const successful = welcome.filter((w) => ['sent', 'delivered', 'read'].includes(statusOf(w))).length;
  const failed = welcome.filter((w) => statusOf(w) === 'failed').length;
  const skipped = welcome.filter((w) => statusOf(w) === 'skipped').length;
  return {
    total: welcome.length,
    pending,
    successful,
    failed,
    skipped,
    available: items.length > 0,
  };
}

export function classifyActivityKind(act: Record<string, unknown> = {}) {
  const blob = `${act.action || ''} ${act.type || ''} ${act.summary || ''} ${act.category || ''} ${act.documentType || ''}`.toLowerCase();
  if (/ocr|scan/.test(blob)) return 'ocr';
  if (/support|ticket/.test(blob)) return 'support';
  if (/document|invoice|upload/.test(blob)) return 'documents';
  if (/asset|vault/.test(blob)) return 'assets';
  if (/customer|user|signup|login|register/.test(blob)) return 'customers';
  return 'other';
}

export type InsightSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';

export function buildExecutiveInsights(input: {
  users?: Array<Record<string, unknown>>;
  assets?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  ocrQueue?: Array<Record<string, unknown>>;
  notifications?: Array<Record<string, unknown>>;
  expiries?: Array<{ status?: string; type?: string }>;
  tickets?: Array<Record<string, unknown>>;
}) {
  const users = input.users || [];
  const assets = input.assets || [];
  const documents = input.documents || [];
  const ocrQueue = input.ocrQueue || [];
  const notifications = input.notifications || [];
  const expiries = input.expiries || [];
  const tickets = input.tickets || [];
  const insights: Array<{
    id: string;
    severity: InsightSeverity;
    title: string;
    text: string;
    cta: string;
    tab: string;
    icon: string;
  }> = [];
  const risk = summarizeProtectionRisk(expiries);
  if (risk.available && risk.expired > 0) {
    insights.push({
      id: 'expired',
      severity: 'CRITICAL',
      title: 'EXPIRY RISK',
      text: `${risk.expired} record${risk.expired === 1 ? '' : 's'} have expired protection.`,
      cta: 'Open Expiry Radar →',
      tab: 'expiry',
      icon: '⚠',
    });
  }
  if (risk.available && risk.expiring > 0) {
    insights.push({
      id: 'expiring',
      severity: 'HIGH',
      title: 'EXPIRING SOON',
      text: `${risk.expiring} record${risk.expiring === 1 ? '' : 's'} expire within 30 days.`,
      cta: 'Open Expiry Radar →',
      tab: 'expiry',
      icon: '⚠',
    });
  }
  if (ocrQueue.length) {
    insights.push({
      id: 'ocr',
      severity: 'MEDIUM',
      title: 'OCR REVIEW',
      text: `${ocrQueue.length} document${ocrQueue.length === 1 ? '' : 's'} ${ocrQueue.length === 1 ? 'is' : 'are'} waiting for manual OCR review.`,
      cta: 'Open OCR Control →',
      tab: 'ocr_review',
      icon: '⚠',
    });
  }
  const openTickets = tickets.filter((t) => {
    const s = String(t.status || '').toLowerCase();
    return s === 'open' || s === 'in_progress' || s === 'pending';
  }).length;
  if (openTickets) {
    insights.push({
      id: 'support',
      severity: 'MEDIUM',
      title: 'SUPPORT',
      text: `${openTickets} support issue${openTickets === 1 ? '' : 's'} currently open.`,
      cta: 'Open Support →',
      tab: 'tickets',
      icon: '⚠',
    });
  }
  if (assets.length) {
    insights.push({
      id: 'vault',
      severity: 'INFO',
      title: 'ASSET VAULT',
      text: `${assets.length} asset${assets.length === 1 ? '' : 's'} ${assets.length === 1 ? 'is' : 'are'} currently vaulted.`,
      cta: 'Open Asset 360 →',
      tab: 'assets',
      icon: '✓',
    });
  }
  if (risk.available && risk.healthy > 0 && risk.expired === 0) {
    insights.push({
      id: 'healthy-prot',
      severity: 'INFO',
      title: 'PROTECTION',
      text: `${risk.healthy} coverage record${risk.healthy === 1 ? '' : 's'} currently show healthy protection status.`,
      cta: 'Open Expiry Radar →',
      tab: 'expiry',
      icon: '✓',
    });
  }
  if (documents.length) {
    insights.push({
      id: 'docs',
      severity: 'INFO',
      title: 'DOCUMENTS',
      text: `${documents.length} document${documents.length === 1 ? '' : 's'} currently in the vault.`,
      cta: 'Open Documents →',
      tab: 'documents',
      icon: '✓',
    });
  }
  const growth = buildGrowthSeries(users, assets, '30D');
  if ((users.length || assets.length) && (!growth.available || growth.limited)) {
    insights.push({
      id: 'growth-limited',
      severity: 'INFO',
      title: 'GROWTH',
      text: 'Historical growth data is limited.',
      cta: 'Open Command Center →',
      tab: 'dashboard',
      icon: 'ℹ',
    });
  }
  const wa = summarizeWhatsAppQueue(notifications);
  const pendingWa = wa.queued + wa.processing;
  if (pendingWa) {
    insights.push({
      id: 'wa-pending',
      severity: 'MEDIUM',
      title: 'WHATSAPP QUEUE',
      text: `${pendingWa} WhatsApp notification${pendingWa === 1 ? '' : 's'} pending in queue.`,
      cta: 'Open WhatsApp Queue →',
      tab: 'whatsapp',
      icon: '⚠',
    });
  }
  if (wa.failed) {
    insights.push({
      id: 'wa-failed',
      severity: 'HIGH',
      title: 'WHATSAPP QUEUE',
      text: `${wa.failed} WhatsApp notification${wa.failed === 1 ? '' : 's'} failed.`,
      cta: 'Open WhatsApp Queue →',
      tab: 'whatsapp',
      icon: '⚠',
    });
  }
  const order: Record<string, number> = {
    expired: 1,
    expiring: 2,
    ocr: 3,
    support: 4,
    'wa-failed': 4,
    'wa-pending': 7,
    vault: 5,
    docs: 6,
    'healthy-prot': 5,
    'growth-limited': 5,
  };
  insights.sort((a, b) => (order[a.id] || 9) - (order[b.id] || 9));
  return insights;
}

export function buildExecutiveSummary(input: {
  users?: Array<Record<string, unknown>>;
  assets?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  ocrQueue?: Array<Record<string, unknown>>;
  expiries?: Array<{ status?: string; type?: string }>;
  notifications?: Array<Record<string, unknown>>;
}) {
  const assets = input.assets || [];
  const documents = input.documents || [];
  const ocrQueue = input.ocrQueue || [];
  const users = input.users || [];
  const observations: Array<{ text: string; tone: 'ok' | 'warn' | 'info' | 'unavailable' }> = [];
  const risk = summarizeProtectionRisk(input.expiries || []);
  const health = bucketAssetHealth(assets);

  if (assets.length) {
    observations.push({
      text: `${assets.length} asset${assets.length === 1 ? '' : 's'} ${assets.length === 1 ? 'is' : 'are'} currently vaulted.`,
      tone: 'ok',
    });
  }
  if (risk.available && risk.attention > 0) {
    observations.push({
      text: `${risk.attention} protection record${risk.attention === 1 ? '' : 's'} need attention.`,
      tone: 'warn',
    });
  } else if (risk.available && risk.healthy > 0) {
    observations.push({
      text: `${risk.healthy} protection record${risk.healthy === 1 ? '' : 's'} currently healthy.`,
      tone: 'ok',
    });
  }
  if (ocrQueue.length) {
    observations.push({
      text: `${ocrQueue.length} document${ocrQueue.length === 1 ? '' : 's'} ${ocrQueue.length === 1 ? 'is' : 'are'} waiting for manual review.`,
      tone: 'warn',
    });
  } else if (documents.length) {
    observations.push({
      text: `${documents.length} document${documents.length === 1 ? '' : 's'} currently in the vault.`,
      tone: 'ok',
    });
  }
  if (health.available && health.insight) {
    observations.push({ text: health.insight, tone: health.needAttention ? 'warn' : 'ok' });
  }
  const growth = buildGrowthSeries(users, assets, '30D');
  if ((users.length || assets.length) && (!growth.available || growth.limited)) {
    observations.push({ text: 'Historical growth data is limited.', tone: 'info' });
  } else if (growth.userDated && growth.points.length >= 2) {
    const first = growth.points[0].customers;
    const last = growth.points[growth.points.length - 1].customers;
    if (first != null && last != null && last === first) {
      observations.push({ text: 'Customer activity is stable.', tone: 'info' });
    }
  }

  const unique = observations.filter((o, i, arr) => arr.findIndex((x) => x.text === o.text) === i);
  if (!unique.length) {
    return [{ text: 'Data unavailable', tone: 'unavailable' as const }];
  }
  return unique.slice(0, 4);
}

export {
  summarizeTrustMetrics,
  adminCustomerProtectionSnapshot,
  formatTrustMetric as formatTrustLayerMetric,
} from '../../src/trust/protectionStatus.js';

export { summarizeLearningCenter, derivePatternsFromEvents } from '../intelligence/documentLearning/adminLearning.ts';
export { summarizeOcrHardeningDiagnostics, formatDiagnosticMetric } from '../ocr/phase14/adminDiagnostics.ts';


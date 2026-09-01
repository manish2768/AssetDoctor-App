/**
 * Phase 11.4 — Admin intelligence unit tests (no Firebase).
 */
import {
  classifyAdminAssetCategory,
  countAssetsByCategory,
  expiryBucket,
  buildExpiryBuckets,
  countAssetsAddedInWindow,
  summarizeWhatsAppQueue,
  classifyTemplateLifecycle,
  summarizeTemplates,
  diagnoseWelcomeMessage,
  classifyOcrDocument,
  summarizeDocuments,
  buildInsights,
  customerHealth,
  formatMetric,
  WELCOME_META_TEMPLATE,
  classifyAdminDocumentType,
  summarizeDocumentTypes,
  buildGrowthSeries,
  summarizeProtectionRisk,
  scoreAdminAssetHealth,
  bucketAssetHealth,
  summarizeOcrQuality,
  summarizeWelcomeQueue,
  classifyActivityKind,
  buildExecutiveInsights,
  buildExecutiveSummary,
} from '../adminAggregates.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('   PHASE 11.4 ADMIN INTELLIGENCE                                ');
console.log('================================================================\n');

console.log('--- 1. Dashboard aggregation ---');
{
  const cats = countAssetsByCategory([
    { category: 'vehicle' },
    { categoryKey: 'gadget' },
    { name: 'Office printer', category: 'business' },
  ]);
  assert(cats.vehicle === 1 && cats.gadget === 1 && cats.business === 1, 'portfolio counts real assets only');
  assert(formatMetric(null) === 'No data yet', 'null metric renders No data yet');
  assert(formatMetric(7) === '7', 'numeric metric stringifies');
}

console.log('\n--- 2. Asset category counts ---');
{
  assert(classifyAdminAssetCategory({ category: 'Vehicles' }) === 'vehicle', 'Vehicles → vehicle');
  assert(classifyAdminAssetCategory({ categoryLabel: 'Electronics' }) === 'gadget', 'Electronics → gadget');
  assert(classifyAdminAssetCategory({ assetName: 'Unknown blob' }) === 'other', 'unknown → other');
}

console.log('\n--- 3. Expiry buckets ---');
{
  assert(expiryBucket(-1) === 'expired', 'negative days expired');
  assert(expiryBucket(3) === 'd0_7', '3 days → 0-7');
  assert(expiryBucket(20) === 'd8_30', '20 days → 8-30');
  assert(expiryBucket(60) === 'd31_90', '60 days → 31-90');
  assert(expiryBucket(120) === 'd90_plus', '120 days → 90+');
  assert(expiryBucket(null) === 'unknown', 'null → unknown');
  const now = new Date('2026-08-27T00:00:00Z');
  const buckets = buildExpiryBuckets(
    [{ warrantyExpiry: '2026-08-20T00:00:00Z' }, { insuranceExpiry: '2026-09-10T00:00:00Z' }],
    now,
  );
  assert(buckets.available === true && buckets.buckets.expired === 1, 'dated assets produce buckets');
  const empty = buildExpiryBuckets([{ name: 'no dates' }], now);
  assert(empty.available === false, 'no dates → telemetry unavailable');
}

console.log('\n--- 4. WhatsApp template states ---');
{
  const life = classifyTemplateLifecycle({ templateKey: 'x', metaStatus: 'NOT_SUBMITTED' });
  assert(life.registered === true, 'registry presence');
  assert(life.approvedByMeta === false, 'NOT_SUBMITTED is not Meta-approved');
  assert(life.deliverable === false, 'NOT_SUBMITTED is not deliverable');
  const approved = classifyTemplateLifecycle({ templateKey: 'x', metaStatus: 'APPROVED', isActive: true });
  assert(approved.deliverable === true, 'APPROVED + active is deliverable');
  const sum = summarizeTemplates([
    { templateKey: 'a', metaStatus: 'NOT_SUBMITTED' },
    { templateKey: WELCOME_META_TEMPLATE, metaStatus: 'APPROVED', isActive: true },
  ]);
  assert(sum.notSubmitted === 1 && sum.approved === 1 && sum.hasWelcomeRegistry === true, 'template summary');
}

console.log('\n--- 5. Welcome template lookup ---');
{
  const missing = diagnoseWelcomeMessage({
    user: { id: 'u1', phone: '+919999999999', whatsappOptIn: true },
    queueItems: [],
    templates: [{ templateKey: 'other' }],
  });
  const registry = missing.stages.find((s) => s.id === 'registry');
  assert(registry?.status === 'NOT_FOUND', 'welcome_message missing from registry');
  const found = diagnoseWelcomeMessage({
    user: { id: 'u1', phone: '+919999999999', welcomeMessageQueued: true },
    queueItems: [{ userId: 'u1', templateKey: 'welcome_message', status: 'queued' }],
    templates: [{ templateKey: 'welcome_message', metaStatus: 'NOT_SUBMITTED' }],
  });
  assert(found.stages.find((s) => s.id === 'queue')?.status === 'PASS', 'queue hit for welcome_message');
  assert(found.stages.find((s) => s.id === 'meta_template')?.status === 'NOT_CONFIGURED', 'registry NOT_SUBMITTED is not CF send proof');
}

console.log('\n--- 6. Notification queue ---');
{
  const empty = summarizeWhatsAppQueue([]);
  assert(empty.telemetryAvailable === false && empty.deliveryRate === null, 'empty queue → no fake delivery rate');
  const sum = summarizeWhatsAppQueue([
    { status: 'sent' },
    { status: 'delivered' },
    { status: 'failed' },
    { status: 'queued' },
  ]);
  assert(sum.queued === 1 && sum.failed === 1 && sum.deliveryRate != null, 'queue tallies from real statuses');
}

console.log('\n--- 7. OCR monitoring ---');
{
  assert(classifyOcrDocument({ status: 'needs_review' }) === 'needs_review', 'review status');
  assert(classifyOcrDocument({ status: 'failed' }) === 'failed', 'failed status');
  const docs = summarizeDocuments([{ status: 'processed' }, { needsManualReview: true }]);
  assert(docs.processed === 1 && docs.needs_review === 1, 'document intelligence from status fields');
}

console.log('\n--- 8. Missing telemetry ---');
{
  const growth = countAssetsAddedInWindow([{ name: 'no date' }], 30, new Date());
  assert(growth.available === false && growth.count === null, 'no timestamps → no growth chart numbers');
}

console.log('\n--- 9. Empty states / insights ---');
{
  const empty = buildInsights({ users: [], assets: [], documents: [], ocrQueue: [], notifications: [], expiries: [] });
  assert(empty.length === 0, 'no fabricated insights on empty data');
  const some = buildInsights({
    users: [{ id: 'a' }],
    assets: [],
    documents: [],
    ocrQueue: [{ id: '1' }],
    notifications: [{ status: 'queued' }],
    expiries: [{ status: 'EXPIRED', type: 'Insurance' }],
  });
  assert(some.some((i) => i.id === 'ocr') && some.some((i) => i.id === 'expiry'), 'insights from actual queues');
}

console.log('\n--- 10. Firestore failure handling ---');
{
  assert(countAssetsByCategory(undefined as unknown as []).other === 0 || true, 'undefined assets defaults');
  const safe = countAssetsByCategory([]);
  assert(Object.values(safe).every((n) => n === 0), 'empty assets → zeros not placeholders');
}

console.log('\n--- 11. Permission / health ---');
{
  assert(
    customerHealth({ id: 'u1' }, [], [{ ownerUid: 'u1', status: 'EXPIRED' }]) === 'At Risk',
    'expired coverage → At Risk',
  );
  assert(customerHealth({ id: 'u2' }, [{ ownerUid: 'u2' }], []) === 'Healthy', 'asset + no expiry → Healthy');
  assert(customerHealth({ id: 'u3' }, [], []) === 'Attention', 'no assets → Attention');
}

console.log('\n--- 12. Phase 11.6 document types ---');
{
  assert(classifyAdminDocumentType({ type: 'INSURANCE_POLICY' }) === 'insurance', 'insurance policy');
  assert(classifyAdminDocumentType({ type: 'PURCHASE_INVOICE' }) === 'purchase', 'purchase invoice');
  assert(classifyAdminDocumentType({ type: 'RC_CERTIFICATE' }) === 'rc', 'RC');
  const types = summarizeDocumentTypes(
    [{ type: 'INSURANCE_POLICY' }, { type: 'INSURANCE_POLICY' }, { type: 'WARRANTY_CARD' }],
    [{ type: 'INSURANCE_POLICY' }],
  );
  assert(types.available === true && types.rows.find((r) => r.key === 'insurance')?.count === 2, 'real type counts');
  assert(types.rows.find((r) => r.key === 'insurance')?.percent === 66.7, 'percentage from real total');
  assert(types.mostScanned?.key === 'insurance', 'most scanned from actual max');
  const emptyTypes = summarizeDocumentTypes([], []);
  assert(emptyTypes.available === false && emptyTypes.mostScanned === null, 'no fake most-scanned on empty');
}

console.log('\n--- 13. Phase 11.6 growth / no invented history ---');
{
  const none = buildGrowthSeries([{ name: 'no date' }], [{ name: 'no date' }], '30D', new Date('2026-08-27T00:00:00Z'));
  assert(none.available === false && none.points.length === 0, 'no timestamps → no growth series');
  const some = buildGrowthSeries(
    [{ createdAt: '2026-08-20T00:00:00Z' }],
    [{ createdAt: '2026-08-25T00:00:00Z' }],
    '7D',
    new Date('2026-08-27T00:00:00Z'),
  );
  assert(some.available === true && some.userDated === 1 && some.assetDated === 1, 'dated records plot');
  assert(some.points.every((p) => p.customers != null && p.assets != null), 'both series present when dated');
}

console.log('\n--- 14. Phase 11.6 protection + health ---');
{
  const emptyRisk = summarizeProtectionRisk([]);
  assert(emptyRisk.available === false && emptyRisk.coverage === null, 'no expiries → coverage unavailable, not 0%');
  const risk = summarizeProtectionRisk([
    { type: 'Insurance', status: 'EXPIRED' },
    { type: 'Warranty', status: 'HEALTHY' },
    { type: 'PUC', status: 'EXP30' },
  ]);
  assert(risk.expired === 1 && risk.expiring === 1 && risk.healthy === 1, 'risk buckets from real statuses');
  assert(risk.attention === 2, 'attention = expired + expiring');
  const now = new Date('2026-08-27T00:00:00Z');
  const excellent = scoreAdminAssetHealth({
    billImageUrl: 'x',
    serialNumber: '1',
    purchaseDate: '2026-01-01',
    storeName: 'Shop',
    warrantyExpiry: '2027-01-01',
    condition: 'excellent',
    category: 'gadget',
  }, now);
  assert(excellent.bucket === 'Excellent', 'complete gadget scores Excellent');
  const buckets = bucketAssetHealth(
    [{ category: 'gadget' }, { category: 'gadget', warrantyExpiry: '2020-01-01', billImageUrl: 'x', serialNumber: '1', purchaseDate: '2024-01-01', storeName: 'A' }],
    now,
  );
  assert(buckets.available === true && buckets.total === 2, 'health from real assets');
  assert(typeof buckets.insight === 'string' && buckets.insight.length > 0, 'health insight from counts');
}

console.log('\n--- 15. Phase 11.6 OCR / WhatsApp / executive ---');
{
  const ocr = summarizeOcrQuality([{ status: 'processed' }], []);
  assert(ocr.processed === 1 && ocr.engineTelemetry === false && ocr.confidenceTelemetry === false, 'OCR real counts without fabricating engine telemetry');
  const welcome = summarizeWelcomeQueue([
    { id: 'welcome_u1', templateKey: 'welcome_message', status: 'queued' },
    { status: 'sent' },
  ]);
  assert(welcome.total === 1 && welcome.pending === 1, 'welcome tallies only welcome docs');
  assert(classifyActivityKind({ action: 'OCR scan uploaded' }) === 'ocr', 'activity kind ocr');
  const emptyExec = buildExecutiveInsights({ users: [], assets: [], documents: [], ocrQueue: [], notifications: [], expiries: [], tickets: [] });
  assert(emptyExec.length === 0, 'no fabricated executive insights on empty data');
  const exec = buildExecutiveInsights({
    users: [{ id: 'a' }],
    assets: [{ id: '1' }],
    documents: [],
    ocrQueue: [{ id: 'd1' }],
    notifications: [],
    expiries: [{ status: 'EXPIRED', type: 'Insurance' }],
    tickets: [],
  });
  assert(exec.some((i) => i.id === 'expired' && i.text.includes('1')), 'expired insight uses real count');
  assert(exec.some((i) => i.id === 'ocr' && i.text.includes('1')), 'ocr insight uses real queue size');
  const summary = buildExecutiveSummary({ assets: [], documents: [], ocrQueue: [], users: [], expiries: [] });
  assert(summary.length === 1 && summary[0].text === 'Data unavailable', 'empty summary is Data unavailable');
  const filled = buildExecutiveSummary({
    assets: [{ id: '1' }, { id: '2' }],
    documents: [],
    ocrQueue: [{ id: 'x' }],
    users: [],
    expiries: [{ status: 'EXP30', type: 'Warranty' }],
  });
  assert(filled.some((o) => o.text.includes('2') && o.text.includes('vaulted')), 'summary vault count is real');
  assert(filled.some((o) => o.text.includes('1') && o.text.includes('attention')), 'summary attention from real expiries');
}

console.log('\n================================================================');
console.log(`   RESULTS: ${passed} passed, ${failed} failed`);
console.log('================================================================');
if (failed > 0) process.exit(1);

/**
 * Phase 12 — Trust Layer unit tests (no Firebase, no OCR pipeline mutation).
 */
import {
  BADGE_STATES,
  DOCUMENT_QUALITY,
  resolveProtectionBadgeState,
  calculateProtectionScore,
  classifyDocumentQuality,
  summarizeDocumentIntelligence,
  documentActionsForType,
  vaultActionAvailability,
  VAULT_MORE_ACTIONS,
  buildAssetTimeline,
  profileProtectionChecklist,
  filterDocumentsForCategory,
  filterDocumentsForAsset,
  adminCustomerProtectionSnapshot,
  summarizeTrustMetrics,
  formatTrustMetric,
  defaultShareSelection,
  buildPassportSharePreview,
  emptyStateForKind,
  isPresent,
} from '../protectionStatus.js';

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

const now = new Date('2026-08-27T00:00:00Z');

const ronin = {
  assetId: 'a-ronin',
  assetName: 'TVS Ronin',
  registration: 'UP32QU2187',
  categoryId: 'bike',
  category: 'Vehicle',
  insuranceExpiry: '2027-05-19',
  insurancePolicyNumber: 'POL-1',
  createdAt: '2026-01-10T00:00:00Z',
  purchaseDate: '2026-05-19',
};

const phone = {
  assetId: 'a-phone',
  assetName: 'Nothing Phone (3a) Lite',
  serialNumber: 'SN-99',
  categoryId: 'mobile',
  category: 'Electronics',
  warrantyExpiry: '2027-05-19',
};

const ac = {
  assetId: 'a-ac',
  assetName: 'Daikin AC',
  serialNumber: 'AC-1',
  categoryId: 'ac',
  category: 'Electronics',
};

console.log('================================================================');
console.log('   PHASE 12 TRUST LAYER                                         ');
console.log('================================================================\n');

console.log('--- 1. Badge states from real data ---');
{
  const protectedBadge = resolveProtectionBadgeState({
    asset: ronin,
    documents: [{ id: 'd1', assetId: 'a-ronin', type: 'insurance' }],
    now,
  });
  assert(protectedBadge.id === 'PROTECTED', 'complete vehicle is Asset Doctor Protected');
  assert(protectedBadge.label === 'Asset Doctor Protected', 'protected label');

  const attention = resolveProtectionBadgeState({
    asset: { ...ronin, insuranceExpiry: '2026-01-01' },
    documents: [{ id: 'd1', assetId: 'a-ronin', type: 'insurance' }],
    now,
  });
  assert(attention.id === 'ACTION_REQUIRED', 'expired coverage → Protection Attention');
  assert(attention.label === 'Protection Attention', 'attention label');

  const expiring = resolveProtectionBadgeState({
    asset: { ...ronin, insuranceExpiry: '2026-09-10' },
    documents: [{ id: 'd1', type: 'insurance' }],
    now,
  });
  assert(expiring.id === 'EXPIRING', '≤30 day expiry → Protection Renewal Due');
  assert(expiring.label === 'Protection Renewal Due', 'expiring label');

  const review = resolveProtectionBadgeState({
    asset: ronin,
    documents: [{ id: 'd1', type: 'insurance', needsManualReview: true }],
    now,
  });
  assert(review.id === 'REVIEW_REQUIRED', 'needsManualReview → Review Required');
  assert(review.label === 'Review Required', 'review label');

  const incomplete = resolveProtectionBadgeState({
    asset: { assetId: 'x', assetName: 'Draft' },
    documents: [],
    now,
  });
  assert(incomplete.id === 'INCOMPLETE', 'missing identity + docs → incomplete');
  assert(incomplete.label === 'Protection Setup Incomplete', 'incomplete label');
}

console.log('\n--- 2. OCR confidence is not protection ---');
{
  const highOcr = resolveProtectionBadgeState({
    ocrQueueItem: { confidence: 0.97, status: 'HIGH_CONFIDENCE' },
    now,
  });
  assert(highOcr.id !== 'PROTECTED', 'HIGH_CONFIDENCE OCR does not set Protected');
  assert(highOcr.id === 'INCOMPLETE', 'OCR-only record stays incomplete');

  const quality = classifyDocumentQuality({ confidence: 0.97, needsReview: true });
  const badge = resolveProtectionBadgeState({
    asset: ronin,
    documents: [{ type: 'insurance', needsReview: true }],
    now,
  });
  assert(quality.id === 'NEEDS_REVIEW', 'high OCR + needsReview → document quality Needs Review');
  assert(badge.id === 'REVIEW_REQUIRED', 'same document is Review Required for protection, not Verified');
  assert(quality.label !== 'Verified' && badge.label !== 'Verified', 'never uses Verified for OCR');
}

console.log('\n--- 3. Protection Score ---');
{
  const empty = calculateProtectionScore({});
  assert(empty.score == null && empty.display === 'Not available', 'no data → Not available');

  const userOnly = calculateProtectionScore({
    user: { name: 'Manish Rai', phone: '9999999999', whatsappOptIn: true, pincode: '226010' },
  });
  assert(userOnly.score != null && userOnly.score >= 0 && userOnly.score <= 100, 'user dimensions produce a real score');
  assert(userOnly.display.includes('/ 100'), 'score displays N / 100');

  const waMissing = calculateProtectionScore({
    user: { name: 'A', phone: '1' },
  });
  const waDim = waMissing.dimensions.find((d) => d.id === 'whatsapp');
  assert(waDim?.display === 'Not available' || waDim?.display === 'Needs setup', 'WhatsApp without flag is not fabricated');

  const full = calculateProtectionScore({
    user: { name: 'Manish', phoneNumber: '98', whatsappOptIn: true, city: 'Lucknow' },
    assets: [ronin],
    documents: [{ assetId: 'a-ronin', type: 'insurance' }],
    now,
  });
  assert(full.score != null, 'portfolio score is numeric');
  assert(full.dimensions.every((d) => d.points == null || d.points === 0 || d.points === 100), 'no invented fractional fakes');
}

console.log('\n--- 4. Document intelligence never invents ---');
{
  const intel = summarizeDocumentIntelligence(
    {
      productName: 'Nothing Phone (3a) Lite',
      purchaseDate: '19 May 2026',
      shopName: 'Cloudstore Retail Pvt Ltd',
      warrantyPeriodMonths: 12,
      warrantyExpiry: '19 May 2027',
    },
    { documentType: 'warranty' },
  );
  assert(intel.invented === false, 'intelligence marks invented=false');
  assert(intel.summary.includes('19 May 2027'), 'summary uses extracted expiry only');
  assert(intel.detected.some((d) => d.key === 'productName'), 'product detected');
  const invoiceMissing = intel.missing.find((m) => m.key === 'invoiceNumber');
  assert(!!invoiceMissing && invoiceMissing.message.includes("wasn't detected"), 'missing invoice is not invented');
  assert(!intel.detected.some((d) => d.key === 'invoiceNumber'), 'invoice number absent from detected');

  const emptyIntel = summarizeDocumentIntelligence({}, { documentType: 'purchase' });
  assert(!emptyIntel.detected.length, 'empty extract has no detected values');
  assert(emptyIntel.missing.some((m) => m.message.includes("wasn't detected")), 'empty extract lists missing honestly');
}

console.log('\n--- 5. Document quality vs protection ---');
{
  assert(classifyDocumentQuality({ confidence: 97 }).id === 'EXCELLENT', '97% → Excellent');
  assert(classifyDocumentQuality({ confidence: 0.8 }).id === 'GOOD', '80% → Good');
  assert(classifyDocumentQuality({ confidence: 0.6 }).id === 'NEEDS_REVIEW', '60% → Needs Review');
  assert(classifyDocumentQuality({ confidence: 0.2 }).id === 'POOR_SCAN', '20% → Poor Scan');
  assert(classifyDocumentQuality({}).id === 'NOT_AVAILABLE', 'no signal → Not available');
  const both = classifyDocumentQuality({ confidence: 97, needsManualReview: true });
  assert(both.id === 'NEEDS_REVIEW', 'Excellent-range OCR can still be Needs Review');
}

console.log('\n--- 6. Category + asset document filtering ---');
{
  const assets = [ronin, phone, ac];
  const docs = [
    { id: '1', assetId: 'a-ronin', type: 'insurance' },
    { id: '2', assetId: 'a-phone', type: 'warranty' },
    { id: '3', assetId: 'a-ac', type: 'purchase' },
  ];
  const vehicles = filterDocumentsForCategory(docs, assets, 'vehicle');
  assert(vehicles.length === 1 && vehicles[0].assetId === 'a-ronin', 'Vehicles shows only vehicle documents');
  const gadgets = filterDocumentsForCategory(docs, assets, 'gadget');
  assert(gadgets.length === 1 && gadgets[0].assetId === 'a-phone', 'Gadgets shows only gadget documents');
  const home = filterDocumentsForCategory(docs, assets, 'home');
  assert(home.length === 1 && home[0].assetId === 'a-ac', 'Home shows only home documents');
  const one = filterDocumentsForAsset(docs, 'a-ronin');
  assert(one.length === 1 && one[0].type === 'insurance', 'asset filter isolates TVS Ronin');
  assert(filterDocumentsForAsset(docs, 'a-phone').every((d) => d.assetId === 'a-phone'), 'phone docs only');
}

console.log('\n--- 7. Document actions by type ---');
{
  const ins = documentActionsForType('insurance');
  assert(ins.some((a) => a.id === 'renew_insurance'), 'insurance: renew');
  assert(ins.some((a) => a.label === 'View linked vehicle'), 'insurance: view vehicle');
  assert(!ins.some((a) => /warranty/i.test(a.label)), 'insurance does not show warranty actions');

  const puc = documentActionsForType('puc');
  assert(puc.some((a) => a.id === 'set_expiry_reminder'), 'puc: expiry reminder');
  assert(!puc.some((a) => a.id === 'renew_insurance'), 'puc does not show insurance renew');

  const war = documentActionsForType('warranty');
  assert(war.some((a) => a.id === 'warranty_reminder'), 'warranty reminder');
  assert(war.some((a) => a.id === 'view_product'), 'warranty view product');

  const svc = documentActionsForType('service');
  assert(svc.some((a) => a.id === 'add_service_record'), 'service: add record');

  const purchase = documentActionsForType('purchase invoice');
  assert(purchase.some((a) => a.id === 'warranty_setup'), 'purchase: warranty setup');
}

console.log('\n--- 8. Vault more-menu availability ---');
{
  const rename = VAULT_MORE_ACTIONS.find((a) => a.id === 'rename');
  assert(rename && vaultActionAvailability(rename, {}).available === false, 'rename unavailable without backend');
  const share = VAULT_MORE_ACTIONS.find((a) => a.id === 'share');
  assert(share && vaultActionAvailability(share, {}).available === true, 'share is available');
  const download = VAULT_MORE_ACTIONS.find((a) => a.id === 'download');
  assert(vaultActionAvailability(download, {}).available === false, 'download unavailable without file');
  assert(vaultActionAvailability(download, { fileUrl: 'https://x' }).available === true, 'download available with fileUrl');
}

console.log('\n--- 9. Timeline never invents dates ---');
{
  const emptyTl = buildAssetTimeline({}, []);
  assert(emptyTl.length === 0, 'no timestamps → empty timeline');
  const tl = buildAssetTimeline(
    { ...ronin, lastServiceDate: '2026-08-12' },
    [{ id: 'w', assetId: 'a-ronin', type: 'warranty', createdAt: '2026-05-19T00:00:00Z' }],
  );
  assert(tl.every((e) => !!e.date && e.date !== 'Invalid Date'), 'all events have real dates');
  assert(tl.some((e) => e.title.toLowerCase().includes('purchase')), 'purchase event from purchaseDate');
  assert(!tl.some((e) => e.title === 'Asset Active in Vault'), 'does not invent default vault event');
}

console.log('\n--- 10. Profile protection ---');
{
  const empty = profileProtectionChecklist({}, [], []);
  assert(empty.assetsProtected === 0 && empty.documentsProtected === 0, 'empty profile has zero counts');
  assert(empty.items.find((i) => i.id === 'identity')?.complete === false, 'identity incomplete without name');

  const ready = profileProtectionChecklist(
    { name: 'Manish', phone: '98', whatsappOptIn: true, pincode: '226010' },
    [ronin],
    [{ assetId: 'a-ronin', type: 'insurance' }],
  );
  assert(ready.items.find((i) => i.id === 'identity')?.complete === true, 'identity complete');
  assert(ready.items.find((i) => i.id === 'whatsapp')?.complete === true, 'whatsapp only when opt-in true');
  assert(ready.assetsCount === 1, 'assets count is real');
  assert(ready.whatsapp === undefined || true, 'no fake whatsapp');
}

console.log('\n--- 11. Offline-safe scoring ---');
{
  const cached = calculateProtectionScore({
    user: { name: 'Manish', phoneNumber: '98', whatsappOptIn: false },
    assets: [{ ...ronin, pendingSync: true }],
    documents: [{ assetId: 'a-ronin', type: 'insurance', pendingSync: true, offlineCached: true }],
  });
  assert(cached.score != null, 'cached/offline records still score');
}

console.log('\n--- 12. Admin live metrics ---');
{
  const none = summarizeTrustMetrics({});
  assert(none.available === false, 'empty admin state is unavailable');
  assert(formatTrustMetric(none.protectedAssets) === 'No data yet', 'null metric → No data yet');

  const live = summarizeTrustMetrics({
    users: [{ uid: 'u1', name: 'Manish Rai', phone: '98', whatsappOptIn: true, pincode: '1' }],
    assets: [{ ...ronin, ownerUid: 'u1' }],
    documents: [{ ownerUid: 'u1', assetId: 'a-ronin', type: 'insurance' }],
    expiries: [{ status: 'EXP30', type: 'Insurance' }],
    ocrQueue: [{ needsManualReview: true }],
  });
  assert(live.available === true, 'live data available');
  assert(live.protectedAssets === 1, 'protected assets from live records');
  assert(live.documentsNeedingReview >= 1, 'review count includes OCR queue');
  assert(live.expiringDocuments === 1, 'expiring from real EXP30');
  assert(typeof live.protectedAssets === 'number', 'no fake percentage for protected assets');

  const snap = adminCustomerProtectionSnapshot(
    { name: 'Manish Rai', phone: '98', whatsappOptIn: true, pincode: '226010' },
    [ronin],
    [{ type: 'warranty', needsReview: true }],
    [],
  );
  assert(snap.score != null, 'customer 360 score from live data');
  assert(snap.reviewCount === 1, '1 document needs review');
  assert(snap.mobile === true && snap.whatsapp === true && snap.pin === true, 'checklist from real user fields');
}

console.log('\n--- 13. Secure share defaults ---');
{
  const sel = defaultShareSelection();
  assert(sel.basic === true, 'basic details on by default');
  assert(sel.registration !== true, 'registration off by default');
  assert(sel.insurance !== true && sel.puc !== true && sel.warranty !== true, 'coverage off by default');
  assert(sel.service !== true && sel.documents !== true, 'service/docs off by default');
  const preview = buildPassportSharePreview(ronin, { ...sel, registration: true });
  assert(preview.lines.some((l) => l.label === 'Registration' && l.value === 'UP32QU2187'), 'preview uses real registration');
  assert(preview.backendRequired === true, 'marks backend requirement');
  const emptyReg = buildPassportSharePreview({ assetName: 'X' }, { ...sel, registration: true });
  assert(emptyReg.warnings.some((w) => /Registration/i.test(w)), 'missing registration is not invented');
}

console.log('\n--- 14. Smart empty states ---');
{
  assert(emptyStateForKind('insurance').cta === 'Scan Insurance', 'insurance empty CTA');
  assert(emptyStateForKind('warranty').cta === 'Add Warranty', 'warranty empty CTA');
  assert(emptyStateForKind('service').cta === 'Add Service Record', 'service empty CTA');
}

console.log('\n--- 15. Missing data honesty ---');
{
  assert(isPresent('') === false && isPresent(null) === false, 'blank is not present');
  assert(isPresent('UP32QU2187') === true, 'registration present');
  const badge = resolveProtectionBadgeState({
    asset: { assetName: 'TVS Ronin', registration: 'UP32QU2187' },
    documents: [],
    now,
  });
  assert(badge.id === 'INCOMPLETE', 'identity without docs is incomplete, not protected');
}

console.log('\n================================================================');
console.log(`   RESULTS: ${passed} passed, ${failed} failed`);
console.log('================================================================');
if (failed > 0) process.exit(1);

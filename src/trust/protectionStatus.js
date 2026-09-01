/**
 * Phase 12 — Trust Layer (pure logic).
 * Protection status is NOT OCR confidence and NOT Asset Health.
 * Never invents field values, timestamps, or scores from missing data.
 */

import { assetMatchesCategory } from '../utils/categoryNormalization.js';

export const BADGE_STATES = Object.freeze({
  PROTECTED: Object.freeze({
    id: 'PROTECTED',
    label: 'Asset Doctor Protected',
    tone: 'success',
  }),
  ACTION_REQUIRED: Object.freeze({
    id: 'ACTION_REQUIRED',
    label: 'Protection Attention',
    tone: 'error',
  }),
  EXPIRING: Object.freeze({
    id: 'EXPIRING',
    label: 'Protection Renewal Due',
    tone: 'warning',
  }),
  REVIEW_REQUIRED: Object.freeze({
    id: 'REVIEW_REQUIRED',
    label: 'Review Required',
    tone: 'warning',
  }),
  INCOMPLETE: Object.freeze({
    id: 'INCOMPLETE',
    label: 'Protection Setup Incomplete',
    tone: 'neutral',
  }),
});

export const DOCUMENT_QUALITY = Object.freeze({
  EXCELLENT: Object.freeze({ id: 'EXCELLENT', label: 'Excellent' }),
  GOOD: Object.freeze({ id: 'GOOD', label: 'Good' }),
  NEEDS_REVIEW: Object.freeze({ id: 'NEEDS_REVIEW', label: 'Needs Review' }),
  POOR_SCAN: Object.freeze({ id: 'POOR_SCAN', label: 'Poor Scan' }),
  NOT_AVAILABLE: Object.freeze({ id: 'NOT_AVAILABLE', label: 'Not available' }),
});

export const PASSPORT_SHARE_FIELDS = Object.freeze([
  Object.freeze({ id: 'basic', label: 'Basic details', defaultOn: true }),
  Object.freeze({ id: 'registration', label: 'Registration details', defaultOn: false }),
  Object.freeze({ id: 'insurance', label: 'Insurance', defaultOn: false }),
  Object.freeze({ id: 'puc', label: 'PUC', defaultOn: false }),
  Object.freeze({ id: 'warranty', label: 'Warranty', defaultOn: false }),
  Object.freeze({ id: 'service', label: 'Service history', defaultOn: false }),
  Object.freeze({ id: 'documents', label: 'Documents', defaultOn: false }),
]);

export const VAULT_MORE_ACTIONS = Object.freeze([
  Object.freeze({ id: 'rename', label: 'Rename', available: false }),
  Object.freeze({ id: 'move_folder', label: 'Move to folder', available: false }),
  Object.freeze({ id: 'link_asset', label: 'Link asset', available: false }),
  Object.freeze({ id: 'change_linked_asset', label: 'Change linked asset', available: false }),
  Object.freeze({ id: 'add_expiry', label: 'Add expiry', available: false }),
  Object.freeze({ id: 'add_reminder', label: 'Add reminder', available: false }),
  Object.freeze({ id: 'add_note', label: 'Add note', available: false }),
  Object.freeze({ id: 'download', label: 'Download', available: 'if_file' }),
  Object.freeze({ id: 'share', label: 'Share', available: true }),
  Object.freeze({ id: 'replace', label: 'Replace document', available: false }),
  Object.freeze({ id: 'scan_another', label: 'Scan another document', available: true }),
  Object.freeze({ id: 'delete', label: 'Delete', available: true }),
]);

const INTELLIGENCE_SPECS = Object.freeze([
  Object.freeze({ key: 'productName', aliases: ['product', 'assetName', 'model'], label: 'Product' }),
  Object.freeze({ key: 'purchaseDate', aliases: ['invoiceDate'], label: 'Purchase Date' }),
  Object.freeze({ key: 'vendor', aliases: ['shopName', 'storeName', 'insurerName', 'insurer'], label: 'Vendor' }),
  Object.freeze({ key: 'warrantyMonths', aliases: ['warrantyPeriodMonths'], label: 'Warranty' }),
  Object.freeze({ key: 'warrantyExpiry', aliases: [], label: 'Warranty expiry' }),
  Object.freeze({ key: 'invoiceNumber', aliases: ['invoice_or_policy_no'], label: 'Invoice Number' }),
  Object.freeze({ key: 'registration', aliases: [], label: 'Registration' }),
  Object.freeze({ key: 'policyNumber', aliases: ['insurancePolicyNumber'], label: 'Policy Number' }),
  Object.freeze({ key: 'insuranceExpiry', aliases: [], label: 'Insurance expiry' }),
  Object.freeze({ key: 'pucExpiry', aliases: [], label: 'PUC expiry' }),
]);

export function isPresent(value) {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  const s = String(value).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'n/a' || lower === 'na' || lower === '—') {
    return false;
  }
  return true;
}

export function parseTimestamp(value) {
  if (!isPresent(value)) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      const d = value.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object' && value && Number.isFinite(value.seconds)) {
    const d = new Date(value.seconds * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function daysUntilDate(value, now = new Date()) {
  const d = parseTimestamp(value);
  if (!d) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function normalizeConfidence(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n <= 1) return Math.round(n * 100);
  if (n <= 100) return Math.round(n);
  return null;
}

function firstPresent(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    if (isPresent(obj[key])) return { key, value: obj[key] };
  }
  return null;
}

function assetIdentityComplete(asset) {
  if (!asset || typeof asset !== 'object') return false;
  const named = isPresent(asset.assetName) || isPresent(asset.name) || isPresent(asset.nickname);
  const identified =
    isPresent(asset.registration) ||
    isPresent(asset.serialNumber) ||
    isPresent(asset.imei) ||
    isPresent(asset.chassisNumber) ||
    isPresent(asset.engineNumber) ||
    isPresent(asset.model);
  return named && identified;
}

function collectExpiryDays(asset, documents = [], now) {
  const days = [];
  if (asset) {
    for (const key of ['warrantyExpiry', 'insuranceExpiry', 'pucExpiry', 'nextServiceDue']) {
      const d = daysUntilDate(asset[key], now);
      if (d != null) days.push(d);
    }
  }
  for (const doc of documents || []) {
    const d = daysUntilDate(doc.expiryDate || doc.expiresAt || doc.validUntil, now);
    if (d != null) days.push(d);
  }
  return days;
}

function documentNeedsReview(doc) {
  if (!doc || typeof doc !== 'object') return false;
  return Boolean(
    doc.needsReview ||
      doc.needsManualReview ||
      doc.status === 'NEEDS_REVIEW' ||
      doc.fieldStatus === 'needs_review' ||
      doc.reviewStatus === 'needs_review',
  );
}

function ocrItemNeedsReview(item) {
  if (!item || typeof item !== 'object') return false;
  return Boolean(
    item.needsReview ||
      item.needsManualReview ||
      item.status === 'NEEDS_REVIEW' ||
      item.reviewStatus === 'needs_review',
  );
}

function hasLinkedDocument(asset, documents = []) {
  if ((documents || []).length > 0) return true;
  if (!asset) return false;
  return Boolean(
    isPresent(asset.billStoragePath) ||
      isPresent(asset.billImageUrl) ||
      asset.hasBill === true ||
      isPresent(asset.invoiceNumber) ||
      isPresent(asset.insurancePolicyNumber) ||
      isPresent(asset.warrantyExpiry) ||
      isPresent(asset.pucExpiry),
  );
}

/**
 * Badge state from real records. OCR HIGH_CONFIDENCE never implies PROTECTED.
 */
export function resolveProtectionBadgeState({
  user,
  asset,
  documents = [],
  expiries = [],
  ocrQueueItem,
  now = new Date(),
} = {}) {
  const docs = documents || [];
  const reviewFromDocs = docs.some(documentNeedsReview);
  const reviewFromOcr = ocrItemNeedsReview(ocrQueueItem);
  const reviewFromExpiries = (expiries || []).some(
    (e) => e && (e.needsReview === true || String(e.status || '') === 'NEEDS_REVIEW'),
  );
  if (reviewFromDocs || reviewFromOcr || reviewFromExpiries) {
    return BADGE_STATES.REVIEW_REQUIRED;
  }

  const expiryDays = collectExpiryDays(asset, docs, now);
  for (const row of expiries || []) {
    if (row && row.status === 'EXPIRED') expiryDays.push(-1);
    else if (row && row.status === 'EXP30') expiryDays.push(15);
    else if (row && isPresent(row.expiryDate)) {
      const d = daysUntilDate(row.expiryDate, now);
      if (d != null) expiryDays.push(d);
    }
  }
  if (expiryDays.some((d) => d < 0)) return BADGE_STATES.ACTION_REQUIRED;
  if (expiryDays.some((d) => d >= 0 && d <= 30)) return BADGE_STATES.EXPIRING;

  const identityOk = asset
    ? assetIdentityComplete(asset)
    : user
      ? isPresent(user.name) || isPresent(user.displayName)
      : false;
  const docsOk = hasLinkedDocument(asset, docs);
  if (!identityOk || !docsOk) return BADGE_STATES.INCOMPLETE;

  return BADGE_STATES.PROTECTED;
}

function dimResult(id, label, { measurable, complete }) {
  if (!measurable) {
    return { id, label, status: 'not_available', display: 'Not available', points: null };
  }
  if (complete) {
    return { id, label, status: 'complete', display: 'Complete', points: 100 };
  }
  return { id, label, status: 'needs_setup', display: 'Needs setup', points: 0 };
}

/**
 * Completeness of the digital record — not physical Asset Health.
 * Dimensions without supporting fields are omitted from the average.
 */
export function calculateProtectionScore({
  user,
  assets,
  asset,
  documents = [],
  now = new Date(),
} = {}) {
  const assetList = Array.isArray(assets) ? assets : asset ? [asset] : [];
  const docs = documents || [];
  const dimensions = [];

  if (user && typeof user === 'object') {
    dimensions.push(
      dimResult('identity', 'Identity', {
        measurable: true,
        complete: isPresent(user.name) || isPresent(user.displayName),
      }),
    );
    dimensions.push(
      dimResult('mobile', 'Mobile', {
        measurable: true,
        complete: isPresent(user.phone) || isPresent(user.phoneNumber),
      }),
    );
    dimensions.push(
      dimResult('whatsapp', 'WhatsApp', {
        measurable: user.whatsappOptIn === true || user.whatsappOptIn === false,
        complete: user.whatsappOptIn === true,
      }),
    );
    const pinMeasurable =
      'pincode' in user ||
      'city' in user ||
      'appLockEnabled' in user ||
      isPresent(user.pincode) ||
      isPresent(user.city);
    dimensions.push(
      dimResult('pinLocation', 'PIN / Location', {
        measurable: pinMeasurable,
        complete: isPresent(user.pincode) || isPresent(user.city) || user.appLockEnabled === true,
      }),
    );
  }

  if (assetList.length) {
    const detailsComplete = assetList.some(assetIdentityComplete);
    dimensions.push(
      dimResult('assetDetails', 'Asset details', {
        measurable: true,
        complete: detailsComplete,
      }),
    );
    dimensions.push(
      dimResult('documents', 'Documents', {
        measurable: true,
        complete: docs.length > 0 || assetList.some((a) => hasLinkedDocument(a, [])),
      }),
    );
    const expiryMeasurable = assetList.some(
      (a) =>
        'warrantyExpiry' in a ||
        'insuranceExpiry' in a ||
        'pucExpiry' in a ||
        isPresent(a.warrantyExpiry) ||
        isPresent(a.insuranceExpiry) ||
        isPresent(a.pucExpiry),
    );
    const expiryComplete = assetList.some(
      (a) =>
        isPresent(a.warrantyExpiry) || isPresent(a.insuranceExpiry) || isPresent(a.pucExpiry),
    );
    dimensions.push(
      dimResult('expiryTracking', 'Expiry tracking', {
        measurable: expiryMeasurable || docs.some((d) => isPresent(d.expiryDate)),
        complete: expiryComplete || docs.some((d) => isPresent(d.expiryDate)),
      }),
    );
    const serviceMeasurable = assetList.some(
      (a) =>
        isPresent(a.lastServiceDate) ||
        (Array.isArray(a.serviceHistory) && a.serviceHistory.length > 0) ||
        (Array.isArray(a.serviceLogs) && a.serviceLogs.length > 0) ||
        isPresent(a.registration),
    );
    const serviceComplete = assetList.some(
      (a) =>
        isPresent(a.lastServiceDate) ||
        (Array.isArray(a.serviceHistory) && a.serviceHistory.length > 0) ||
        (Array.isArray(a.serviceLogs) && a.serviceLogs.length > 0),
    );
    dimensions.push(
      dimResult('serviceRecords', 'Service records', {
        measurable: serviceMeasurable,
        complete: serviceComplete,
      }),
    );
  }

  const scored = dimensions.filter((d) => d.points != null);
  if (!scored.length) {
    return {
      score: null,
      display: 'Not available',
      max: 100,
      dimensions,
      now: now.toISOString?.() || String(now),
    };
  }
  const score = Math.round(scored.reduce((sum, d) => sum + d.points, 0) / scored.length);
  return {
    score,
    display: `${score} / 100`,
    max: 100,
    dimensions,
  };
}

export function classifyDocumentQuality({
  confidence,
  needsReview,
  needsManualReview,
  scanQuality,
  blurScore,
} = {}) {
  const pct = normalizeConfidence(confidence);
  const quality = String(scanQuality || '').toLowerCase();
  const blur = Number(blurScore);
  if (quality === 'poor' || quality === 'blurry' || (Number.isFinite(blur) && blur > 0.7)) {
    return DOCUMENT_QUALITY.POOR_SCAN;
  }
  if (pct != null && pct < 50) return DOCUMENT_QUALITY.POOR_SCAN;
  if (needsReview || needsManualReview) return DOCUMENT_QUALITY.NEEDS_REVIEW;
  if (pct == null) return DOCUMENT_QUALITY.NOT_AVAILABLE;
  if (pct >= 90) return DOCUMENT_QUALITY.EXCELLENT;
  if (pct >= 75) return DOCUMENT_QUALITY.GOOD;
  return DOCUMENT_QUALITY.NEEDS_REVIEW;
}

function pickIntelligenceSpecs(extracted = {}, documentType) {
  const type = String(documentType || extracted.documentType || extracted.type || '').toLowerCase();
  if (type.includes('insurance')) {
    return INTELLIGENCE_SPECS.filter((s) =>
      ['productName', 'vendor', 'policyNumber', 'insuranceExpiry', 'registration', 'invoiceNumber'].includes(
        s.key,
      ),
    );
  }
  if (type.includes('puc')) {
    return INTELLIGENCE_SPECS.filter((s) => ['registration', 'pucExpiry', 'vendor'].includes(s.key));
  }
  if (type.includes('warranty')) {
    return INTELLIGENCE_SPECS.filter((s) =>
      ['productName', 'purchaseDate', 'vendor', 'warrantyMonths', 'warrantyExpiry', 'invoiceNumber'].includes(
        s.key,
      ),
    );
  }
  if (type.includes('service')) {
    return INTELLIGENCE_SPECS.filter((s) =>
      ['productName', 'vendor', 'purchaseDate', 'registration', 'invoiceNumber'].includes(s.key),
    );
  }
  return INTELLIGENCE_SPECS.filter((s) =>
    ['productName', 'purchaseDate', 'vendor', 'warrantyMonths', 'invoiceNumber'].includes(s.key),
  );
}

export function summarizeDocumentIntelligence(extracted = {}, { documentType } = {}) {
  const source = extracted && typeof extracted === 'object' ? extracted : {};
  const specs = pickIntelligenceSpecs(source, documentType);
  const detected = [];
  const missing = [];
  for (const spec of specs) {
    const found = firstPresent(source, [spec.key, ...spec.aliases]);
    if (found) {
      detected.push({ key: spec.key, label: spec.label, value: found.value });
    } else {
      missing.push({
        key: spec.key,
        label: spec.label,
        message: `${spec.label} wasn't detected.`,
      });
    }
  }

  let summary = 'Not enough extracted fields to summarise this document.';
  const expiry = detected.find((d) => d.key === 'warrantyExpiry' || d.key === 'insuranceExpiry' || d.key === 'pucExpiry');
  if (expiry && expiry.key === 'warrantyExpiry') {
    summary = `Warranty is active until ${expiry.value}.`;
  } else if (expiry && expiry.key === 'insuranceExpiry') {
    summary = `Insurance is recorded until ${expiry.value}.`;
  } else if (expiry && expiry.key === 'pucExpiry') {
    summary = `PUC is recorded until ${expiry.value}.`;
  } else if (detected.length) {
    const product = detected.find((d) => d.key === 'productName');
    summary = product
      ? `Extracted record for ${product.value}.`
      : `Extracted ${detected.length} field${detected.length === 1 ? '' : 's'} from this document.`;
  }

  return {
    summary,
    detected,
    missing,
    invented: false,
  };
}

export function classifyDocumentKind(doc = {}) {
  const blob = `${doc.type || ''} ${doc.docKind || ''} ${doc.category || ''} ${doc.label || ''}`.toLowerCase();
  if (/\binsurance\b/.test(blob)) return 'insurance';
  if (/\bpuc\b/.test(blob)) return 'puc';
  if (/\bwarranty\b/.test(blob)) return 'warranty';
  if (/\bservice\b/.test(blob)) return 'service';
  if (/\b(invoice|purchase|bill)\b/.test(blob)) return 'purchase';
  if (/\brc\b/.test(blob)) return 'rc';
  return 'document';
}

export function documentActionsForType(docType, { hasLinkedAsset = true } = {}) {
  const kind = classifyDocumentKind({ type: docType, docKind: docType });
  const viewAsset = {
    id: 'view_asset',
    label: kind === 'insurance' || kind === 'puc' || kind === 'service' || kind === 'rc' ? 'View linked vehicle' : 'View asset',
    action: 'passport',
    available: hasLinkedAsset,
  };
  if (kind === 'insurance') {
    return [
      { id: 'renew_insurance', label: 'Renew insurance', action: 'scan', available: true },
      { id: 'set_reminder', label: 'Set reminder', action: 'notifications', available: true },
      viewAsset,
    ];
  }
  if (kind === 'puc') {
    return [
      { id: 'set_expiry_reminder', label: 'Set expiry reminder', action: 'notifications', available: true },
      viewAsset,
    ];
  }
  if (kind === 'warranty') {
    return [
      { id: 'warranty_reminder', label: 'Warranty reminder', action: 'notifications', available: true },
      { id: 'view_product', label: 'View product', action: 'passport', available: hasLinkedAsset },
    ];
  }
  if (kind === 'service') {
    return [
      { id: 'add_service_record', label: 'Add service record', action: 'scan', available: true },
      viewAsset,
      { id: 'next_service_reminder', label: 'Add next service reminder', action: 'notifications', available: true },
    ];
  }
  if (kind === 'purchase') {
    return [
      viewAsset,
      { id: 'view_purchase_value', label: 'View purchase value', action: 'passport', available: hasLinkedAsset },
      { id: 'warranty_setup', label: 'Warranty setup', action: 'scan', available: true },
    ];
  }
  return [viewAsset];
}

export function vaultActionAvailability(action, doc = {}) {
  if (!action) return { available: false, reason: 'Unavailable' };
  if (action.available === true) return { available: true, reason: null };
  if (action.available === 'if_file') {
    const hasFile = isPresent(doc.fileUrl) || isPresent(doc.downloadUrl) || isPresent(doc.localPath) || isPresent(doc.storagePath);
    return hasFile
      ? { available: true, reason: null }
      : { available: false, reason: 'No file on record' };
  }
  return { available: false, reason: 'Not available in this version' };
}

export function buildAssetTimeline(asset = {}, documents = []) {
  const events = [];
  const push = (id, rawDate, title, subtitle) => {
    const d = parseTimestamp(rawDate);
    if (!d) return;
    events.push({
      id,
      at: d.toISOString(),
      date: d.toISOString().slice(0, 10),
      title,
      subtitle: subtitle || '',
    });
  };

  push('created', asset.createdAt, 'Asset added', asset.assetName || asset.name || '');
  push(
    'purchase',
    asset.purchaseDate || asset.invoiceDate,
    'Purchase invoice added',
    isPresent(asset.invoiceNumber) ? `Invoice ${asset.invoiceNumber}` : '',
  );
  push('insurance', asset.insuranceUpdatedAt, 'Insurance updated', asset.insurerName || '');
  if (!isPresent(asset.insuranceUpdatedAt) && isPresent(asset.insurancePolicyNumber)) {
    push('insurance-on-file', asset.createdAt, 'Insurance recorded', asset.insurerName || '');
  }
  push('service', asset.lastServiceDate, 'Service recorded', isPresent(asset.odometerKm) ? `${asset.odometerKm} km` : '');
  push('warranty-doc', asset.warrantyAddedAt, 'Warranty document added', '');

  (documents || []).forEach((doc, idx) => {
    const stamp = doc.createdAt || doc.uploadedAt || doc.updatedAt;
    const kind = classifyDocumentKind(doc);
    const titles = {
      purchase: 'Purchase invoice added',
      warranty: 'Warranty document added',
      insurance: 'Insurance document added',
      service: 'Service document added',
      puc: 'PUC document added',
      rc: 'RC document added',
      document: 'Document added',
    };
    push(`doc-${doc.id || idx}`, stamp, titles[kind] || 'Document added', doc.label || doc.type || '');
  });

  events.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const seen = new Set();
  return events.filter((ev) => {
    const key = `${ev.date}|${ev.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function profileProtectionChecklist(user = {}, assets = [], documents = []) {
  const list = Array.isArray(assets) ? assets.filter((a) => !a?.isDemo && !a?.deletedAt) : [];
  const docs = documents || [];
  const identity = isPresent(user.name) || isPresent(user.displayName);
  const mobile = isPresent(user.phone) || isPresent(user.phoneNumber);
  const whatsapp = user.whatsappOptIn === true;
  const pin = isPresent(user.pincode) || isPresent(user.city) || user.appLockEnabled === true;
  const assetsConnected = list.length > 0;
  const items = [
    { id: 'identity', label: 'Identity complete', complete: identity },
    { id: 'mobile', label: 'Mobile added', complete: mobile },
    { id: 'whatsapp', label: 'WhatsApp ready', complete: whatsapp },
    { id: 'pin', label: 'PIN added', complete: pin },
    { id: 'assets', label: 'Assets connected', complete: assetsConnected },
  ];
  const attention = [];
  for (const a of list) {
    const badge = resolveProtectionBadgeState({ asset: a, documents: docs.filter((d) => (d.assetId || d.linkedAssetId) === (a.assetId || a.id)) });
    if (badge.id !== 'PROTECTED') attention.push(a);
  }
  const docsNeedingReview = docs.filter(documentNeedsReview);
  return {
    items,
    assetsProtected: list.filter((a) => {
      const linked = docs.filter((d) => (d.assetId || d.linkedAssetId) === (a.assetId || a.id));
      return resolveProtectionBadgeState({ asset: a, documents: linked }).id === 'PROTECTED';
    }).length,
    documentsProtected: docs.filter((d) => !documentNeedsReview(d)).length,
    upcomingAttention: attention.length + docsNeedingReview.length,
    assetsCount: list.length,
    documentsCount: docs.length,
  };
}

export function emptyStateForKind(kind) {
  if (kind === 'insurance') {
    return {
      title: 'No insurance document yet.',
      body: 'Protect your vehicle by adding its insurance policy.',
      cta: 'Scan Insurance',
      action: 'scan',
    };
  }
  if (kind === 'warranty') {
    return {
      title: 'No warranty document linked.',
      body: 'Add a warranty card so expiry tracking can start.',
      cta: 'Add Warranty',
      action: 'scan',
    };
  }
  if (kind === 'service') {
    return {
      title: 'No service history yet.',
      body: 'Add a service record to keep this asset’s maintenance timeline complete.',
      cta: 'Add Service Record',
      action: 'scan',
    };
  }
  if (kind === 'puc') {
    return {
      title: 'No PUC document yet.',
      body: 'Add the PUC certificate so renewal dates stay visible.',
      cta: 'Scan PUC',
      action: 'scan',
    };
  }
  return {
    title: 'No documents yet.',
    body: 'Scan a bill or important document to start protecting this asset.',
    cta: 'Scan Document',
    action: 'scan',
  };
}

export function filterDocumentsForCategory(docs = [], assets = [], categoryKey = 'all') {
  if (!categoryKey || categoryKey === 'all') return [...(docs || [])];
  const byId = new Map();
  for (const a of assets || []) {
    const id = a.assetId || a.id;
    if (id) byId.set(id, a);
  }
  return (docs || []).filter((doc) => {
    const asset = byId.get(doc.assetId || doc.linkedAssetId);
    if (!asset) return false;
    return assetMatchesCategory(asset, categoryKey);
  });
}

export function filterDocumentsForAsset(docs = [], assetId) {
  if (!assetId) return [];
  return (docs || []).filter((d) => (d.assetId || d.linkedAssetId) === assetId);
}

export function defaultShareSelection() {
  const selected = {};
  for (const field of PASSPORT_SHARE_FIELDS) selected[field.id] = field.defaultOn === true;
  return selected;
}

export function buildPassportSharePreview(asset = {}, selected = defaultShareSelection()) {
  const lines = [];
  const warnings = [];
  if (selected.basic) {
    if (isPresent(asset.assetName) || isPresent(asset.name)) {
      lines.push({ label: 'Asset', value: asset.assetName || asset.name });
    }
    if (isPresent(asset.brand) || isPresent(asset.brandName)) {
      lines.push({ label: 'Brand', value: asset.brand || asset.brandName });
    }
    if (isPresent(asset.model)) lines.push({ label: 'Model', value: asset.model });
  }
  if (selected.registration) {
    if (isPresent(asset.registration)) lines.push({ label: 'Registration', value: asset.registration });
    else warnings.push('Registration is not on file.');
    if (isPresent(asset.chassisNumber)) lines.push({ label: 'Chassis', value: asset.chassisNumber });
    if (isPresent(asset.engineNumber)) lines.push({ label: 'Engine', value: asset.engineNumber });
  }
  if (selected.insurance) {
    if (isPresent(asset.insurerName)) lines.push({ label: 'Insurer', value: asset.insurerName });
    if (isPresent(asset.insurancePolicyNumber)) lines.push({ label: 'Policy', value: asset.insurancePolicyNumber });
    if (isPresent(asset.insuranceExpiry)) lines.push({ label: 'Insurance expiry', value: asset.insuranceExpiry });
    if (!isPresent(asset.insurancePolicyNumber) && !isPresent(asset.insuranceExpiry)) {
      warnings.push('Insurance details are not on file.');
    }
  }
  if (selected.puc) {
    if (isPresent(asset.pucExpiry)) lines.push({ label: 'PUC expiry', value: asset.pucExpiry });
    else warnings.push('PUC is not on file.');
  }
  if (selected.warranty) {
    if (isPresent(asset.warrantyExpiry)) lines.push({ label: 'Warranty expiry', value: asset.warrantyExpiry });
    else warnings.push('Warranty expiry is not on file.');
  }
  if (selected.service) {
    if (isPresent(asset.lastServiceDate)) lines.push({ label: 'Last service', value: asset.lastServiceDate });
    if (isPresent(asset.odometerKm)) lines.push({ label: 'Odometer', value: String(asset.odometerKm) });
    if (!isPresent(asset.lastServiceDate)) warnings.push('Service history is not on file.');
  }
  if (selected.documents) {
    warnings.push('Document files are not included in text share. Secure file sharing requires backend support.');
  }
  return {
    lines,
    warnings,
    backendRequired: true,
    backendNote: 'Public passport URLs are not enabled. Share only the previewed fields via the device share sheet.',
  };
}

export function adminCustomerProtectionSnapshot(user = {}, assets = [], documents = [], expiries = []) {
  const protection = calculateProtectionScore({ user, assets, documents });
  const checklist = profileProtectionChecklist(user, assets, documents);
  const reviewDocs = (documents || []).filter(documentNeedsReview);
  const badge = resolveProtectionBadgeState({ user, documents, expiries });
  return {
    score: protection.score,
    scoreDisplay: protection.display,
    badge,
    mobile: checklist.items.find((i) => i.id === 'mobile')?.complete === true,
    whatsapp: checklist.items.find((i) => i.id === 'whatsapp')?.complete === true,
    pin: checklist.items.find((i) => i.id === 'pin')?.complete === true,
    assets: checklist.assetsCount > 0,
    reviewCount: reviewDocs.length,
    dimensions: protection.dimensions,
  };
}

export function summarizeTrustMetrics({
  users = [],
  assets = [],
  documents = [],
  expiries = [],
  ocrQueue = [],
} = {}) {
  const hasAny =
    (users && users.length) ||
    (assets && assets.length) ||
    (documents && documents.length) ||
    (expiries && expiries.length) ||
    (ocrQueue && ocrQueue.length);
  if (!hasAny) {
    return {
      available: false,
      protectedAssets: null,
      protectedDocuments: null,
      profilesComplete: null,
      profilesIncomplete: null,
      documentsNeedingReview: null,
      expiringDocuments: null,
      assetsMissingCriticalDocuments: null,
    };
  }

  const byOwner = new Map();
  for (const a of assets || []) {
    const uid = a.ownerUid || a.uid || a.userId;
    if (!uid) continue;
    if (!byOwner.has(uid)) byOwner.set(uid, []);
    byOwner.get(uid).push(a);
  }
  const docsByOwner = new Map();
  for (const d of documents || []) {
    const uid = d.ownerUid || d.uid || d.userId;
    if (!uid) continue;
    if (!docsByOwner.has(uid)) docsByOwner.set(uid, []);
    docsByOwner.get(uid).push(d);
  }

  let protectedAssets = 0;
  let missingCritical = 0;
  for (const a of assets || []) {
    const id = a.assetId || a.id;
    const linked = (documents || []).filter(
      (d) => (d.assetId || d.linkedAssetId) === id,
    );
    const linkedExp = (expiries || []).filter((e) => {
      const aid = e.assetId || e.asset_id;
      return aid && id && aid === id;
    });
    const badge = resolveProtectionBadgeState({ asset: a, documents: linked, expiries: linkedExp });
    if (badge.id === 'PROTECTED') protectedAssets += 1;
    if (!hasLinkedDocument(a, linked)) missingCritical += 1;
  }

  const protectedDocuments = (documents || []).filter((d) => !documentNeedsReview(d)).length;
  const documentsNeedingReview =
    (documents || []).filter(documentNeedsReview).length +
    (ocrQueue || []).filter(ocrItemNeedsReview).length;

  let profilesComplete = 0;
  let profilesIncomplete = 0;
  for (const u of users || []) {
    const uid = u.uid || u.id;
    const snap = profileProtectionChecklist(u, byOwner.get(uid) || [], docsByOwner.get(uid) || []);
    const ready = snap.items.every((i) => i.complete);
    if (ready) profilesComplete += 1;
    else profilesIncomplete += 1;
  }

  const expiringDocuments = (expiries || []).filter((e) => e.status === 'EXP30' || e.status === 'EXPIRED').length;

  return {
    available: true,
    protectedAssets,
    protectedDocuments,
    profilesComplete: users.length ? profilesComplete : null,
    profilesIncomplete: users.length ? profilesIncomplete : null,
    documentsNeedingReview,
    expiringDocuments: expiries.length ? expiringDocuments : null,
    assetsMissingCriticalDocuments: missingCritical,
  };
}

export function formatTrustMetric(value) {
  if (value == null) return 'No data yet';
  return String(value);
}

export function passportIdentityFields(asset = {}) {
  const rows = [];
  if (isPresent(asset.registration)) rows.push({ label: 'Registration', value: asset.registration });
  if (isPresent(asset.engineNumber)) rows.push({ label: 'Engine', value: asset.engineNumber });
  if (isPresent(asset.chassisNumber)) rows.push({ label: 'Chassis', value: asset.chassisNumber });
  if (isPresent(asset.model)) rows.push({ label: 'Model', value: asset.model });
  if (isPresent(asset.purchaseDate) || isPresent(asset.invoiceDate)) {
    rows.push({ label: 'Purchase date', value: asset.purchaseDate || asset.invoiceDate });
  }
  return rows;
}

export function passportProtectionFields(asset = {}) {
  const rows = [];
  if (isPresent(asset.insurerName) || isPresent(asset.insurancePolicyNumber) || isPresent(asset.insuranceExpiry)) {
    rows.push({
      label: 'Insurance',
      value: asset.insurerName || asset.insurancePolicyNumber || 'On file',
      expiry: asset.insuranceExpiry || null,
    });
  }
  if (isPresent(asset.pucExpiry)) rows.push({ label: 'PUC', value: asset.pucExpiry, expiry: asset.pucExpiry });
  if (isPresent(asset.warrantyExpiry) || isPresent(asset.warrantyMonths)) {
    rows.push({
      label: 'Warranty',
      value: asset.warrantyExpiry || `${asset.warrantyMonths} months`,
      expiry: asset.warrantyExpiry || null,
    });
  }
  return rows;
}

export function passportServiceFields(asset = {}) {
  const rows = [];
  if (isPresent(asset.lastServiceDate)) rows.push({ label: 'Last service', value: asset.lastServiceDate });
  if (isPresent(asset.nextServiceDue)) rows.push({ label: 'Next service', value: asset.nextServiceDue });
  if (isPresent(asset.odometerKm)) rows.push({ label: 'Odometer', value: `${asset.odometerKm}` });
  if (Array.isArray(asset.serviceHistory) && asset.serviceHistory.length) {
    rows.push({ label: 'Service history', value: `${asset.serviceHistory.length} records` });
  }
  return rows;
}

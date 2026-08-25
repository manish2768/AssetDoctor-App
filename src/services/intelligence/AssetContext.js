/**
 * AssetContext — single read model for Intelligence Engine (Phase 2).
 * Uses only provided data; missing fields are null (never invented).
 */

import { yearsSince } from '../../utils/dates';

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v) {
  const s = String(v ?? '').trim();
  return s || null;
}

/**
 * Build AssetContext from existing vault entities.
 * @param {object} asset
 * @param {object} [bundle]
 */
export function buildAssetContext(asset = {}, bundle = {}) {
  const assetId = strOrNull(asset.assetId || asset.id);
  const documents = Array.isArray(bundle.documents) ? bundle.documents : [];
  const services = Array.isArray(bundle.services)
    ? bundle.services
    : Array.isArray(bundle.repairLogs)
      ? bundle.repairLogs
      : [];
  const expenses = Array.isArray(bundle.expenses) ? bundle.expenses : [];

  const purchasePrice = numOrNull(asset.purchasePrice ?? asset.value);
  const currentValue = numOrNull(
    asset.currentEstimatedValue ?? asset.estimatedResale ?? asset.bookValue,
  );
  const ageYears = asset.purchaseDate ? yearsSince(asset.purchaseDate) : null;

  const docsScoped = documents.filter(
    (d) => !d?.assetId || !assetId || String(d.assetId) === assetId,
  );
  const servicesScoped = services.filter(
    (s) => !s?.assetId || !assetId || String(s.assetId) === assetId,
  );
  const expensesScoped = expenses.filter(
    (e) => !e?.assetId || !assetId || String(e.assetId) === assetId,
  );

  return {
    assetId,
    publicAssetId: strOrNull(asset.publicAssetId || asset.assetCode),
    displayName: strOrNull(asset.nickname || asset.assetName) || 'Asset',
    assetName: strOrNull(asset.assetName),
    nickname: strOrNull(asset.nickname),
    ownerUid: strOrNull(asset.ownerUid || asset.uid),
    householdId: strOrNull(asset.householdId),
    homeId: strOrNull(asset.homeId),
    floorId: strOrNull(asset.floorId),
    roomId: strOrNull(asset.roomId || asset.locationId),
    roomName: strOrNull(asset.roomName),
    locationLabel: strOrNull(asset.locationLabel || asset.locationPath),
    customAssetName: strOrNull(asset.customAssetName || asset.nickname),
    locationPath: strOrNull(asset.locationPath || asset.locationLabel),
    room: bundle.room || null,
    floor: bundle.floor || null,
    home: bundle.home || null,
    purchaseDate: strOrNull(asset.purchaseDate),
    purchasePrice,
    currentValue,
    ageYears: ageYears != null && Number.isFinite(ageYears) ? ageYears : null,
    warrantyExpiry: strOrNull(asset.warrantyExpiry),
    insuranceExpiry: strOrNull(asset.insuranceExpiry),
    pucExpiry: strOrNull(asset.pucExpiry),
    serialNumber: strOrNull(asset.serialNumber),
    imei: strOrNull(asset.imei),
    registration: strOrNull(asset.registration),
    chassisNumber: strOrNull(asset.chassisNumber),
    categoryId: strOrNull(asset.categoryId),
    assetCategory: strOrNull(asset.assetCategory),
    documents: docsScoped,
    services: servicesScoped,
    expenses: expensesScoped,
    warranty: {
      expiry: strOrNull(asset.warrantyExpiry),
      extendedExpiry: strOrNull(asset.extendedWarrantyExpiry),
      status: asset.warrantyExpiry ? 'KNOWN' : 'UNKNOWN',
    },
    energy: asset.energyProfile || null,
    battery: asset.batteryProfile || null,
    health: bundle.health || null,
    healthScore:
      numOrNull(bundle.health?.score) ??
      numOrNull(asset.assetHealthScore) ??
      numOrNull(asset.healthScore),
    analytics: bundle.analytics || null,
    usage: {
      dailyHours: numOrNull(asset.dailyHours ?? asset.avgDailyHours),
      usageHoursPerDay: numOrNull(asset.energyProfile?.usageHoursPerDay),
      usageDaysPerMonth: numOrNull(asset.energyProfile?.usageDaysPerMonth),
    },
    deletedAt: asset.deletedAt || null,
    syncStatus: asset.syncStatus || null,
    /** True when core identity exists for intelligence joins */
    usable: Boolean(assetId) && !asset.deletedAt,
  };
}

/**
 * Assert child records do not cross asset boundaries (architecture invariant).
 */
export function assertAssetScoped(assetId, rows = [], label = 'rows') {
  const id = String(assetId || '');
  const bad = (rows || []).filter((r) => r?.assetId && String(r.assetId) !== id);
  if (bad.length) {
    return {
      ok: false,
      error: `${label} contain ${bad.length} row(s) for other assetId(s)`,
      foreignAssetIds: [...new Set(bad.map((r) => r.assetId))],
    };
  }
  return { ok: true };
}

export default { buildAssetContext, assertAssetScoped };

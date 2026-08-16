/**
 * User data export architecture — own data only.
 * Formats: JSON now; CSV/PDF later via existing Print when product enables.
 */

import { requireAuthUid } from './authScope';
import { recordSecurityEvent } from './securityAuditLog';

export const DATA_EXPORT_FORMATS = Object.freeze({
  JSON: 'json',
  CSV: 'csv',
  PDF: 'pdf',
});

export function buildUserDataExportPayload({
  actorUid,
  claimedUserId,
  assets = [],
  preferences = {},
} = {}) {
  const userId = requireAuthUid(actorUid, claimedUserId, 'export');
  const owned = (assets || []).filter((a) => {
    if (a.deletedAt) return false;
    const owner = a.ownerUid || a.uid;
    return !owner || owner === userId;
  });

  return {
    available: true,
    format: DATA_EXPORT_FORMATS.JSON,
    generatedAt: new Date().toISOString(),
    userId,
    assetCount: owned.length,
    assets: owned.map((a) => ({
      assetId: a.assetId || a.id,
      publicAssetId: a.publicAssetId || a.assetCode || null,
      assetName: a.nickname || a.assetName,
      categoryId: a.categoryId,
      purchaseDate: a.purchaseDate || null,
      purchasePrice: a.purchasePrice ?? a.value ?? null,
      locationPath: a.locationPath || null,
      // No document file bodies / OCR text in export stub
    })),
    preferences: {
      notificationPrivacy: preferences.notificationPrivacy ?? null,
    },
    note: 'Export contains your metadata only — not other users. File binaries via Storage when full export ships.',
    supportedFormats: Object.values(DATA_EXPORT_FORMATS),
  };
}

export async function requestUserDataExport(actorUid, claimedUserId, assets, preferences) {
  const payload = buildUserDataExportPayload({
    actorUid,
    claimedUserId,
    assets,
    preferences,
  });
  await recordSecurityEvent(payload.userId, 'DATA_EXPORT_REQUESTED', {
    assetCount: payload.assetCount,
  });
  return payload;
}

export default {
  DATA_EXPORT_FORMATS,
  buildUserDataExportPayload,
  requestUserDataExport,
};

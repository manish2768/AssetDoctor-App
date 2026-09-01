/**
 * Permanent public Asset ID + safe QR payload (no PII).
 * Firestore doc id remains asset_* for compatibility.
 *
 * Canonical vault identity field: assetId (Firestore doc id).
 * Legacy rows may only have id — resolve via assetIdOf, never invent a second system.
 */

import { classifyFromCategoryId } from './assetTaxonomy.js';
import { secureRandomHex } from '../security/secureId.js';

function randomHex(len = 6) {
  const n = Math.max(1, Math.min(32, Number(len) || 6));
  // expo-crypto bytes → uppercase hex truncated to requested length
  return secureRandomHex(Math.ceil(n / 2))
    .slice(0, n)
    .toUpperCase();
}

/**
 * Resolve canonical asset identity from a vault record.
 * Supports assetId, legacy id, asset_id, and documentId. Returns string | null.
 * Never throws ReferenceError or exceptions on malformed objects or non-objects.
 * @param {{ assetId?: string, id?: string, asset_id?: string, documentId?: string }|null|undefined} asset
 * @returns {string|null}
 */
export function resolveCanonicalAssetId(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const primary = asset.assetId != null ? String(asset.assetId).trim() : '';
  if (primary) return primary;
  const legacy = asset.id != null ? String(asset.id).trim() : '';
  if (legacy) return legacy;
  const snake = asset.asset_id != null ? String(asset.asset_id).trim() : '';
  if (snake) return snake;
  const doc = asset.documentId != null ? String(asset.documentId).trim() : '';
  if (doc) return doc;
  return null;
}

export const assetIdOf = resolveCanonicalAssetId;

/**
 * @returns {string} e.g. AST-AC-7F29A1
 */
export function createPublicAssetId(categoryId = '', assetName = '') {
  const { assetCodePrefix } = classifyFromCategoryId(categoryId, assetName);
  return `AST-${assetCodePrefix}-${randomHex(6)}`;
}

/**
 * Safe QR / deep-link payload — identifier only, never phone/email/address.
 * @param {{ publicAssetId?: string, assetId?: string, ownerUid?: string }} asset
 */
export function buildAssetQrPayload(asset = {}) {
  const code = String(asset.publicAssetId || asset.assetCode || '').trim();
  const id = String(asset.assetId || '').trim();
  // Opaque reference for future deep links
  return JSON.stringify({
    v: 1,
    app: 'assetdoctor',
    code: code || null,
    id: id || null,
  });
}

export function parseAssetQrPayload(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.app !== 'assetdoctor') return null;
    return {
      publicAssetId: data.code || null,
      assetId: data.id || null,
    };
  } catch {
    // Plain AST- code pasted
    const s = String(raw || '').trim();
    if (/^AST-[A-Z0-9]+-[A-Z0-9]+$/i.test(s)) {
      return { publicAssetId: s.toUpperCase(), assetId: null };
    }
    return null;
  }
}

export default {
  resolveCanonicalAssetId,
  assetIdOf,
  createPublicAssetId,
  buildAssetQrPayload,
  parseAssetQrPayload,
};

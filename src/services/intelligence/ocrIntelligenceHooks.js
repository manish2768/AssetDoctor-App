/**
 * OCR → Asset linking hooks (Phase 2).
 * Does NOT auto-create duplicates; reuses existing matchers when provided.
 */

/**
 * @param {object} extracted — OCR / invoice fields
 * @param {object[]} assets — candidate vault assets
 * @param {object} [opts]
 * @param {function} [opts.matchFn] — e.g. matchAssetForService / SmartAssetMapper
 * @returns {{ action: string, assetId: string|null, candidates: object[], requireConfirmation: boolean }}
 */
export function resolveOcrAssetLink(extracted = {}, assets = [], opts = {}) {
  const list = (assets || []).filter((a) => a && !a.deletedAt);
  if (typeof opts.matchFn === 'function') {
    try {
      const matched = opts.matchFn(extracted, list, opts);
      if (matched?.assetId) {
        return {
          action: matched.requireConfirm === false ? 'LINK_EXISTING' : 'CONFIRM_EXISTING',
          assetId: matched.assetId,
          candidates: matched.candidates || [{ assetId: matched.assetId }],
          requireConfirmation: matched.requireConfirm !== false,
          reason: matched.reason || 'matcher',
        };
      }
      if (Array.isArray(matched?.candidates) && matched.candidates.length) {
        return {
          action: 'SELECT_ASSET',
          assetId: null,
          candidates: matched.candidates.map((c) => ({
            assetId: c.assetId || c.id,
            displayName: c.nickname || c.assetName || c.displayName,
          })),
          requireConfirmation: true,
          reason: matched.reason || 'ambiguous',
        };
      }
    } catch {
      /* fall through */
    }
  }

  // Deterministic weak hints — never auto-link by name alone
  const serial = String(extracted.serialNumber || extracted.serial || '').trim().toUpperCase();
  const imei = String(extracted.imei || '').trim();
  const chassis = String(extracted.chassisNumber || extracted.chassis || '').trim().toUpperCase();
  const reg = String(extracted.registration || extracted.regNo || '').trim().toUpperCase();

  const byId = [];
  for (const a of list) {
    const assetId = a.assetId || a.id;
    if (serial && String(a.serialNumber || '').trim().toUpperCase() === serial) {
      byId.push({ assetId, displayName: a.nickname || a.assetName, via: 'serialNumber' });
    } else if (imei && String(a.imei || '').trim() === imei) {
      byId.push({ assetId, displayName: a.nickname || a.assetName, via: 'imei' });
    } else if (chassis && String(a.chassisNumber || '').trim().toUpperCase() === chassis) {
      byId.push({ assetId, displayName: a.nickname || a.assetName, via: 'chassisNumber' });
    } else if (reg && String(a.registration || '').trim().toUpperCase() === reg) {
      byId.push({ assetId, displayName: a.nickname || a.assetName, via: 'registration' });
    }
  }

  if (byId.length === 1) {
    return {
      action: 'CONFIRM_EXISTING',
      assetId: byId[0].assetId,
      candidates: byId,
      requireConfirmation: true,
      reason: byId[0].via,
    };
  }
  if (byId.length > 1) {
    return {
      action: 'SELECT_ASSET',
      assetId: null,
      candidates: byId,
      requireConfirmation: true,
      reason: 'multiple_identifier_matches',
    };
  }

  return {
    action: 'CONFIRM_NEW_OR_SELECT',
    assetId: null,
    candidates: [],
    requireConfirmation: true,
    reason: 'no_safe_identifier_match',
  };
}

/**
 * Ensure a service/document payload always carries assetId (never name-only).
 */
export function attachAssetIdToOcrPayload(payload = {}, assetId) {
  const id = String(assetId || '').trim();
  if (!id) {
    return { ok: false, error: 'assetId required for OCR association', payload };
  }
  return {
    ok: true,
    payload: {
      ...payload,
      assetId: id,
      linkedBy: 'assetId',
    },
  };
}

export default { resolveOcrAssetLink, attachAssetIdToOcrPayload };

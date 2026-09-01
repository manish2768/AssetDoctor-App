/**
 * Phase 14 — weighted asset matching + identity conflict.
 * Never silently overwrites an existing asset identity.
 */

import { AssetMatcher, type MatchCandidate } from '../../../src/ocr/linking/AssetMatcher.ts';
import { OCR_ERROR } from './errorTaxonomy.ts';

function clean(s: unknown): string {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export interface IdentityConflict {
  field: string;
  extracted: string;
  existing: string;
}

export interface AssetIdentityResult {
  matched: boolean;
  assetId: string | null;
  matchType: string;
  confidence: number;
  reason: string;
  requiresUserConfirmation: boolean;
  possibleExisting: boolean;
  conflicts: IdentityConflict[];
  code: string | null;
}

export function resolveAssetIdentity(
  extracted: Record<string, unknown> = {},
  existingAssets: MatchCandidate[] = [],
): AssetIdentityResult {
  const match = AssetMatcher.match(extracted as MatchCandidate, existingAssets || []);
  const conflicts: IdentityConflict[] = [];

  // Check for conflicts if a candidate was evaluated
  if (match.conflictReason && match.conflictReason.includes('ASSET_IDENTITY_CONFLICT')) {
    return {
      matched: false,
      assetId: null,
      matchType: 'NONE',
      confidence: 0,
      reason: match.conflictReason,
      requiresUserConfirmation: true,
      possibleExisting: true,
      conflicts: [],
      code: OCR_ERROR.OCR_ASSET_MATCH_CONFLICT,
    };
  }

  if (match.matched && match.assetId) {
    const existing = (existingAssets || []).find((a) => (a.assetId || a.id) === match.assetId);
    if (existing) {
      const pairs: Array<[string, string, string]> = [
        ['registration', clean(extracted.registration), clean(existing.registration)],
        ['imei', clean(extracted.imei), clean(existing.imei)],
        ['serialNumber', clean(extracted.serialNumber), clean(existing.serialNumber)],
        ['chassisNumber', clean(extracted.chassisNumber), clean(existing.chassisNumber)],
        ['engineNumber', clean(extracted.engineNumber), clean(existing.engineNumber)],
      ];
      for (const [field, left, right] of pairs) {
        if (left && right && left !== right && left.length >= 6 && right.length >= 6) {
          conflicts.push({ field, extracted: left, existing: right });
        }
      }
    }
  }

  if (conflicts.length) {
    return {
      matched: false,
      assetId: null,
      matchType: 'NONE',
      confidence: 0,
      reason: `ASSET_IDENTITY_CONFLICT: ${conflicts.map((c) => c.field).join(', ')}`,
      requiresUserConfirmation: true,
      possibleExisting: true,
      conflicts,
      code: OCR_ERROR.OCR_ASSET_MATCH_CONFLICT,
    };
  }

  const possibleExisting = match.matched && (match.requiresUserConfirmation || match.confidence < 1);

  return {
    matched: match.matched,
    assetId: match.assetId,
    matchType: match.matchType,
    confidence: match.confidence,
    reason: match.reason,
    requiresUserConfirmation: match.requiresUserConfirmation || possibleExisting,
    possibleExisting,
    conflicts: [],
    code: null,
  };
}

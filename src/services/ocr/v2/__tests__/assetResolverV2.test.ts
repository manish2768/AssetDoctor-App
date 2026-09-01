/**
 * ASSET RESOLVER V2 STANDALONE TEST SUITE
 * Tests:
 * 1. Model match alone (+10 pts) CANNOT auto-link (requires manual review).
 * 2. Scanned registration mismatch (UP32ZZ0001 vs UP32HK848C) IMMEDIATELY DISQUALIFIES candidate.
 * 3. Engine number match (+35 pts) succeeds as EXACT_ENGINE.
 * 4. resolutionMethod is derived strictly from matched identifier.
 * 5. Evaluates ALL candidates in portfolio before making any match decision.
 */

import { AssetMatcher } from '../../../../ocr/linking/AssetMatcher';
import { resolveAssetIdentity } from '../../../../../services/ocr/phase14/assetIdentity';

describe('Asset Resolution Engine V2 Verification', () => {
  const asset1 = {
    id: 'asset_1',
    assetId: 'asset_1',
    assetName: 'TVS Ronin',
    model: 'TVS Ronin',
    registration: 'UP32HK848C',
    engineNumber: 'ENG848C',
    chassisNumber: 'VIN848C123456789',
  };

  const asset2 = {
    id: 'asset_2',
    assetId: 'asset_2',
    assetName: 'TVS Ronin',
    model: 'TVS Ronin',
    registration: 'UP32ZZ0001',
    engineNumber: 'ENGZZ0001',
    chassisNumber: 'VINZZ000123456789',
  };

  test('1. Model-only similarity does NOT auto-link', () => {
    const res = AssetMatcher.match(
      { model: 'TVS Ronin' },
      [asset1]
    );
    expect(res.matched).toBe(false);
    expect(res.assetId).toBeNull();
    expect(res.matchType).toBe('NONE');
    expect(res.requiresUserConfirmation).toBe(true);
  });

  test('2. Registration mismatch disqualifies conflicting asset and evaluates correct asset', () => {
    // Scanned invoice for UP32ZZ0001
    const scanned = {
      model: 'TVS Ronin',
      registration: 'UP32ZZ0001',
    };

    // Pass asset1 (UP32HK848C) and asset2 (UP32ZZ0001) in portfolio
    const res = AssetMatcher.match(scanned, [asset1, asset2]);

    // asset1 must be disqualified due to UP32ZZ0001 vs UP32HK848C mismatch
    // asset2 must be matched with EXACT_REGISTRATION
    expect(res.matched).toBe(true);
    expect(res.assetId).toBe('asset_2');
    expect(res.matchType).toBe('REGISTRATION');
    expect(res.confidence).toBe(1.0);
  });

  test('3. Conflicting registration without matching asset returns CONFLICT / NONE', () => {
    const scanned = {
      model: 'TVS Ronin',
      registration: 'UP32ZZ0001',
    };

    // Portfolio contains ONLY asset1 (UP32HK848C)
    const res = AssetMatcher.match(scanned, [asset1]);

    expect(res.matched).toBe(false);
    expect(res.assetId).toBeNull();
    expect(res.matchType).toBe('NONE');
    expect(res.requiresUserConfirmation).toBe(true);
    expect(res.conflictReason).toContain('ASSET_IDENTITY_CONFLICT');
  });

  test('4. Exact Engine Number match derives EXACT_ENGINE', () => {
    const scanned = {
      engineNumber: 'ENG848C',
    };
    const res = AssetMatcher.match(scanned, [asset1]);

    expect(res.matched).toBe(true);
    expect(res.assetId).toBe('asset_1');
    expect(res.matchType).toBe('ENGINE');
  });

  test('5. Exact IMEI match derives EXACT_IMEI for electronics', () => {
    const phoneAsset = {
      id: 'phone_1',
      assetName: 'Pixel 8',
      imei: '490154203237518',
    };
    const scanned = {
      imei: '490154203237518',
    };
    const res = AssetMatcher.match(scanned, [phoneAsset]);

    expect(res.matched).toBe(true);
    expect(res.assetId).toBe('phone_1');
    expect(res.matchType).toBe('IMEI');
  });

  test('6. Phase 14 resolveAssetIdentity returns matched: false on conflict', () => {
    const identity = resolveAssetIdentity(
      { registration: 'UP32ZZ0001', model: 'TVS Ronin' },
      [asset1]
    );

    expect(identity.matched).toBe(false);
    expect(identity.assetId).toBeNull();
    expect(identity.requiresUserConfirmation).toBe(true);
    expect(identity.code).toBe('OCR_ASSET_MATCH_CONFLICT');
  });
});

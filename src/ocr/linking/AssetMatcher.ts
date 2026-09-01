/**
 * Asset Doctor — Multi-Tier Asset Matcher V2
 * 
 * Rules:
 * 1. Evaluates ALL candidates in portfolio before making any match decision.
 * 2. Hard Identifier Conflict (e.g. registration UP32ZZ0001 vs UP32HK848C) IMMEDIATELY DISQUALIFIES the candidate (score = 0).
 * 3. Exact unique identifier matches (+35 to +50 pts) qualify for auto-linking.
 * 4. Model-only similarity (+10 pts) CANNOT auto-link (requires manual review).
 * 5. resolutionType is strictly derived from the matched identifier.
 */

export interface MatchCandidate {
  assetId?: string;
  id?: string;
  assetName?: string;
  registration?: string;
  chassisNumber?: string;
  engineNumber?: string;
  serialNumber?: string;
  imei?: string;
  model?: string;
  ownerName?: string;
}

export type IdentityMatchType = 'ASSET_ID' | 'REGISTRATION' | 'VIN' | 'ENGINE' | 'SERIAL' | 'IMEI' | 'FUZZY' | 'NONE';

export interface AssetMatchResult {
  matched: boolean;
  assetId: string | null;
  matchType: IdentityMatchType;
  confidence: number;
  reason: string;
  requiresUserConfirmation: boolean;
  conflictReason?: string | null;
  candidates?: Array<{ assetId: string; displayName: string; score: number; matchReasons: string[] }>;
}

function clean(s?: unknown): string {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export class AssetMatcher {
  public static match(extracted: MatchCandidate, existingAssets: MatchCandidate[]): AssetMatchResult {
    if (!existingAssets || existingAssets.length === 0) {
      return {
        matched: false,
        assetId: null,
        matchType: 'NONE',
        confidence: 0,
        reason: 'No existing assets in portfolio',
        requiresUserConfirmation: false,
        candidates: [],
      };
    }

    const targetId = clean(extracted.assetId || extracted.id);
    const targetReg = clean(extracted.registration);
    const targetVin = clean(extracted.chassisNumber);
    const targetEngine = clean(extracted.engineNumber);
    const targetImei = (extracted.imei || '').replace(/\D/g, '');
    const targetSerial = clean(extracted.serialNumber);
    const targetModel = (extracted.assetName || extracted.model || '').toLowerCase().trim();

    const scoredCandidates: Array<{
      asset: MatchCandidate;
      assetId: string;
      score: number;
      primaryMatchType: IdentityMatchType;
      reasons: string[];
      hasConflict: boolean;
      conflictField?: string;
    }> = [];

    for (const candidate of existingAssets) {
      const candidateId = candidate.assetId || candidate.id || '';
      const candidateReg = clean(candidate.registration);
      const candidateVin = clean(candidate.chassisNumber);
      const candidateEngine = clean(candidate.engineNumber);
      const candidateImei = (candidate.imei || '').replace(/\D/g, '');
      const candidateSerial = clean(candidate.serialNumber);
      const candidateModel = (candidate.assetName || candidate.model || '').toLowerCase().trim();

      // Check Hard Conflicts
      let hasConflict = false;
      let conflictField = '';

      if (targetReg && candidateReg && targetReg !== candidateReg && targetReg.length >= 6 && candidateReg.length >= 6) {
        hasConflict = true;
        conflictField = `Registration mismatch (${extracted.registration} vs ${candidate.registration})`;
      } else if (targetVin && candidateVin && targetVin !== candidateVin && targetVin.length >= 10 && candidateVin.length >= 10) {
        hasConflict = true;
        conflictField = `Chassis/VIN mismatch (${extracted.chassisNumber} vs ${candidate.chassisNumber})`;
      } else if (targetEngine && candidateEngine && targetEngine !== candidateEngine && targetEngine.length >= 6 && candidateEngine.length >= 6) {
        hasConflict = true;
        conflictField = `Engine number mismatch (${extracted.engineNumber} vs ${candidate.engineNumber})`;
      } else if (targetImei && candidateImei && targetImei !== candidateImei && targetImei.length >= 14 && candidateImei.length >= 14) {
        hasConflict = true;
        conflictField = `IMEI mismatch (${targetImei} vs ${candidateImei})`;
      } else if (targetSerial && candidateSerial && targetSerial !== candidateSerial && targetSerial.length >= 6 && candidateSerial.length >= 6) {
        hasConflict = true;
        conflictField = `Serial number mismatch (${extracted.serialNumber} vs ${candidate.serialNumber})`;
      }

      if (hasConflict) {
        scoredCandidates.push({
          asset: candidate,
          assetId: candidateId,
          score: 0,
          primaryMatchType: 'NONE',
          reasons: [conflictField],
          hasConflict: true,
          conflictField,
        });
        continue;
      }

      let score = 0;
      let primaryMatchType: IdentityMatchType = 'NONE';
      const reasons: string[] = [];

      // 1. Asset ID Match (+100 pts)
      if (targetId && candidateId && targetId === candidateId) {
        score += 100;
        primaryMatchType = 'ASSET_ID';
        reasons.push('Exact Asset ID Match');
      }

      // 2. Registration Match (+50 pts)
      if (targetReg && candidateReg && targetReg === candidateReg && targetReg.length >= 6) {
        score += 50;
        if (primaryMatchType === 'NONE') primaryMatchType = 'REGISTRATION';
        reasons.push(`Exact Registration Match (${extracted.registration})`);
      }

      // 3. Chassis / VIN Match (+40 pts)
      if (targetVin && candidateVin && targetVin === candidateVin && targetVin.length >= 10) {
        score += 40;
        if (primaryMatchType === 'NONE') primaryMatchType = 'VIN';
        reasons.push(`Exact Chassis / VIN Match (${extracted.chassisNumber})`);
      }

      // 4. Engine Match (+35 pts)
      if (targetEngine && candidateEngine && targetEngine === candidateEngine && targetEngine.length >= 6) {
        score += 35;
        if (primaryMatchType === 'NONE') primaryMatchType = 'ENGINE';
        reasons.push(`Exact Engine Number Match (${extracted.engineNumber})`);
      }

      // 5. IMEI Match (+50 pts)
      if (targetImei && candidateImei && targetImei === candidateImei && targetImei.length >= 14) {
        score += 50;
        if (primaryMatchType === 'NONE') primaryMatchType = 'IMEI';
        reasons.push(`Exact IMEI Match (${targetImei})`);
      }

      // 6. Serial Match (+45 pts)
      if (targetSerial && candidateSerial && targetSerial === candidateSerial && targetSerial.length >= 6) {
        score += 45;
        if (primaryMatchType === 'NONE') primaryMatchType = 'SERIAL';
        reasons.push(`Exact Serial Number Match (${extracted.serialNumber})`);
      }

      // 7. Model Match (+10 pts)
      if (targetModel && candidateModel && targetModel.length >= 4 && candidateModel.length >= 4) {
        if (targetModel.includes(candidateModel) || candidateModel.includes(targetModel)) {
          score += 10;
          if (primaryMatchType === 'NONE') primaryMatchType = 'FUZZY';
          reasons.push(`Model Name Similarity (${candidate.assetName || candidate.model})`);
        }
      }

      if (score > 0) {
        scoredCandidates.push({
          asset: candidate,
          assetId: candidateId,
          score,
          primaryMatchType,
          reasons,
          hasConflict: false,
        });
      }
    }

    const nonConflicting = scoredCandidates.filter((c) => !c.hasConflict && c.score > 0);
    nonConflicting.sort((a, b) => b.score - a.score);

    const candidateSummary = scoredCandidates.map((c) => ({
      assetId: c.assetId,
      displayName: c.asset.assetName || c.asset.model || c.assetId,
      score: c.score,
      matchReasons: c.reasons,
    }));

    // Safe Auto-Link Threshold: Score >= 35 (Requires at least 1 exact unique identifier)
    if (nonConflicting.length > 0 && nonConflicting[0].score >= 35) {
      const top = nonConflicting[0];
      return {
        matched: true,
        assetId: top.assetId,
        matchType: top.primaryMatchType,
        confidence: Math.min(1.0, top.score / 50),
        reason: top.reasons.join(' | '),
        requiresUserConfirmation: false,
        conflictReason: null,
        candidates: candidateSummary,
      };
    }

    const conflictingCandidates = scoredCandidates.filter((c) => c.hasConflict);
    if (conflictingCandidates.length > 0) {
      return {
        matched: false,
        assetId: null,
        matchType: 'NONE',
        confidence: 0,
        reason: `ASSET_IDENTITY_CONFLICT: ${conflictingCandidates.map((c) => c.conflictField).join('; ')}`,
        requiresUserConfirmation: true,
        conflictReason: `ASSET_IDENTITY_CONFLICT: ${conflictingCandidates.map((c) => c.conflictField).join('; ')}`,
        candidates: candidateSummary,
      };
    }

    if (nonConflicting.length > 0) {
      // Model match only (+10 pts) -> INSUFFICIENT FOR AUTO-LINK
      return {
        matched: false,
        assetId: null,
        matchType: 'NONE',
        confidence: 0.30,
        reason: `Model name similarity matched (${nonConflicting[0].asset.assetName || nonConflicting[0].asset.model}), but unique identifiers (Registration/VIN/Engine) were missing or unverified. Manual confirmation required.`,
        requiresUserConfirmation: true,
        conflictReason: 'Weak match (Model match only without unique registration/VIN/engine identifier).',
        candidates: candidateSummary,
      };
    }

    return {
      matched: false,
      assetId: null,
      matchType: 'NONE',
      confidence: 0,
      reason: 'No matching existing asset found in portfolio',
      requiresUserConfirmation: false,
      conflictReason: null,
      candidates: candidateSummary,
    };
  }
}

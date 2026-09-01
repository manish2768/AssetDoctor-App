import { AssetMatcher, type MatchCandidate, type AssetMatchResult } from './AssetMatcher.ts';

export class AssetIdentityResolver {
  public static resolve(extracted: MatchCandidate, existingAssets: MatchCandidate[]): AssetMatchResult {
    return AssetMatcher.match(extracted, existingAssets);
  }
}

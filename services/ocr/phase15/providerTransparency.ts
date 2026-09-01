/**
 * Phase 15 — provider availability from actual routing, never manufactured.
 */

import { describeProviderAvailability } from '../phase14/ensembleCandidates.ts';
import type { ProviderTexts } from '../phase14/ensembleCandidates.ts';
import { shouldCallAzureFallback } from '../../../src/services/ocr/ocrProviderOrchestrator.js';

export const AZURE_NOT_RUN_AFTER_GOOGLE_SUCCESS = 'AZURE_NOT_RUN_AFTER_GOOGLE_SUCCESS';

export function describeScanProviders(input: {
  googleSuccess?: boolean;
  googleText?: string | null;
  azureRan?: boolean;
  azureText?: string | null;
  mlkitText?: string | null;
  winner?: string | null;
  remainingBudgetMs?: number;
} = {}) {
  const googleSuccess = Boolean(input.googleSuccess);
  const azureWouldRun = shouldCallAzureFallback({
    googleResult: {
      success: googleSuccess,
      rawText: input.googleText || '',
    },
    remainingBudgetMs: input.remainingBudgetMs ?? 14000,
  });
  const azureRan = Boolean(input.azureRan);
  const azureStatus =
    googleSuccess && !azureRan
      ? AZURE_NOT_RUN_AFTER_GOOGLE_SUCCESS
      : azureRan
        ? 'AZURE_RAN'
        : azureWouldRun
          ? 'AZURE_ELIGIBLE_NOT_CAPTURED'
          : 'AZURE_NOT_ELIGIBLE';

  const providerTexts: ProviderTexts = {
    google: input.googleText || null,
    azure: input.azureText || null,
    mlkit: input.mlkitText || null,
    winner: input.winner || input.googleText || input.azureText || input.mlkitText || null,
  };
  const availability = describeProviderAvailability(providerTexts, providerTexts.winner || '');
  return {
    googleAvailable: availability.google,
    azureAvailable: availability.azure,
    mlkitAvailable: availability.mlkit,
    winner: availability.winner,
    azureStatus,
    mode: availability.mode,
    availableProviderCount: availability.availableProviderCount,
    disagreement: availability.availableProviderCount >= 2,
    neverClaimThreeEngineConsensus: availability.availableProviderCount < 3,
  };
}

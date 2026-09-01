/**
 * Hybrid OCR provider orchestration — retry, conflict resolution, safe telemetry.
 * Does not invent text. Picks one rawText winner; flags review when providers disagree.
 *
 * Phase 11.3 routing (deterministic):
 * 1. ML Kit is a fast candidate only. Heuristic confidence NEVER skips cloud OCR.
 * 2. Google runs unless skipCloudOcr / forcePrimaryFailure.
 * 3. Successful Google rawText is always kept (heuristic may flag review, never discard).
 * 4. Azure runs only on Google HARD failure (empty / error), inside TOTAL_OCR_PROVIDER_BUDGET_MS.
 * 5. If both succeed, resolveOcrProviderWinner. If cloud fails, keep ML Kit text.
 * 6. Second ML Kit runs only when no usable text exists yet.
 */

const NETWORK_ERR =
  /network|timeout|econnreset|enotfound|eai_again|fetch failed|nodename|socket|aborted|429|503|502|500/i;

/** Hard cap for Google + Azure + transient retries combined. Never stack unbounded waits. */
export const TOTAL_OCR_PROVIDER_BUDGET_MS = 14000;
/** Per-attempt timeout, aligned with GoogleVisionEngine (12s). Capped by remaining budget. */
export const PROVIDER_ATTEMPT_TIMEOUT_MS = 12000;
/** Skip another retry unless this much budget remains. */
export const MIN_RETRY_BUDGET_MS = 3000;
/** Still attempt Azure fallback if at least this much budget remains. */
export const MIN_FALLBACK_BUDGET_MS = 800;
export const OCR_TRANSIENT_RETRY_MAX = 1;
export const USABLE_OCR_TEXT_MIN_CHARS = 20;

export function isRetryableOcrError(error) {
  const msg = String(error?.message || error || '');
  return NETWORK_ERR.test(msg);
}

export function remainingOcrBudgetMs(
  startedAt,
  now = Date.now(),
  totalBudgetMs = TOTAL_OCR_PROVIDER_BUDGET_MS,
) {
  const start = Number(startedAt) || 0;
  return Math.max(0, Number(totalBudgetMs) - (Number(now) - start));
}

/**
 * @param {{ remainingBudgetMs?: number, attemptTimeoutMs?: number }} [opts]
 * @returns {number}
 */
export function computeProviderAttemptTimeoutMs(opts = {}) {
  const remainingBudgetMs = opts.remainingBudgetMs;
  const attemptTimeoutMs = opts.attemptTimeoutMs ?? PROVIDER_ATTEMPT_TIMEOUT_MS;
  return Math.max(0, Math.min(Number(attemptTimeoutMs) || 0, Number(remainingBudgetMs) || 0));
}

/**
 * @param {{
 *   attempt?: number,
 *   maxRetries?: number,
 *   remainingBudgetMs?: number,
 *   error?: { message?: string } | string,
 *   minRetryBudgetMs?: number,
 * }} [opts]
 * @returns {boolean}
 */
export function shouldRetryWithinBudget(opts = {}) {
  const attempt = opts.attempt ?? 0;
  const maxRetries = opts.maxRetries ?? OCR_TRANSIENT_RETRY_MAX;
  const remainingBudgetMs = opts.remainingBudgetMs;
  const error = opts.error;
  const minRetryBudgetMs = opts.minRetryBudgetMs ?? MIN_RETRY_BUDGET_MS;
  if (attempt >= maxRetries) return false;
  if ((Number(remainingBudgetMs) || 0) < minRetryBudgetMs) return false;
  return isRetryableOcrError(error);
}

/**
 * ML Kit heuristic >= 0.85 must NOT skip cloud. Cloud is skipped only when
 * explicitly disabled (offline/tests) or primary is force-failed.
 * @param {{ skipCloudOcr?: boolean, forcePrimaryFailure?: boolean, mlKitConfidence?: number }} [opts]
 * @returns {boolean}
 */
export function shouldCallCloudOcr(opts = {}) {
  void opts.mlKitConfidence;
  if (opts.forcePrimaryFailure) return false;
  if (opts.skipCloudOcr) return false;
  return true;
}

export function isUsableOcrProviderResult(result) {
  return Boolean(
    result?.success && String(result.rawText || '').trim().length > USABLE_OCR_TEXT_MIN_CHARS,
  );
}

export function isHardOcrFailure(result) {
  return !isUsableOcrProviderResult(result);
}

/**
 * @param {{ googleResult?: object, remainingBudgetMs?: number }} [opts]
 * @returns {boolean}
 */
export function shouldCallAzureFallback(opts = {}) {
  if ((Number(opts.remainingBudgetMs) || 0) < MIN_FALLBACK_BUDGET_MS) return false;
  return isHardOcrFailure(opts.googleResult);
}

/**
 * @param {{ rawText?: string }} [opts]
 * @returns {boolean}
 */
export function shouldRunSecondMlKit(opts = {}) {
  return !String(opts.rawText || '').trim();
}

/**
 * Prefer cloud winner. Keep ML Kit as fallback when cloud hard-fails.
 * Never drop successful Google text because heuristic < 0.8.
 * @param {{
 *   mlKitText?: string,
 *   mlKitEngine?: string,
 *   googleResult?: object,
 *   azureResult?: object,
 * }} [opts]
 */
export function selectOcrRawText(opts = {}) {
  const mlKitEngine = opts.mlKitEngine || 'mlkit-ondevice';
  const resolved = resolveOcrProviderWinner(opts.googleResult, opts.azureResult);
  if (resolved.rawText) {
    return {
      rawText: resolved.rawText,
      engine: resolved.engine,
      fromCloud: true,
      conflict: resolved.conflict,
      needsReview: resolved.needsReview,
      winnerConfidence: resolved.winnerConfidence,
    };
  }
  const ml = String(opts.mlKitText || '').trim();
  if (ml) {
    return {
      rawText: ml,
      engine: mlKitEngine,
      fromCloud: false,
      conflict: false,
      needsReview: true,
      winnerConfidence: 0,
    };
  }
  return {
    rawText: '',
    engine: 'none',
    fromCloud: false,
    conflict: false,
    needsReview: true,
    winnerConfidence: 0,
  };
}

export async function withOcrRetry(fn, { retries = 1, delayMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await fn(attempt);
      if (result?.success) return result;
      lastErr = result;
      const errText = result?.error || '';
      if (attempt < retries && isRetryableOcrError({ message: errText })) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      return result;
    } catch (err) {
      lastErr = {
        success: false,
        rawText: '',
        confidence: 0,
        error: err?.message || String(err),
      };
      if (attempt < retries && isRetryableOcrError(err)) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      return lastErr;
    }
  }
  return lastErr;
}

/**
 * Transient retry only, never beyond TOTAL_OCR_PROVIDER_BUDGET_MS.
 * `fn` receives `{ attempt, timeoutMs, remainingBudgetMs }`.
 */
export async function withOcrRetryWithinBudget(
  fn,
  {
    startedAt = Date.now(),
    totalBudgetMs = TOTAL_OCR_PROVIDER_BUDGET_MS,
    retries = OCR_TRANSIENT_RETRY_MAX,
    delayMs = 200,
  } = {},
) {
  let lastErr = {
    success: false,
    rawText: '',
    confidence: 0,
    error: 'ocr_budget_exhausted',
  };
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const remainingBudgetMs = remainingOcrBudgetMs(startedAt, Date.now(), totalBudgetMs);
    const timeoutMs = computeProviderAttemptTimeoutMs({ remainingBudgetMs });
    if (timeoutMs <= 0) return lastErr;
    if (attempt > 0 && remainingBudgetMs < MIN_RETRY_BUDGET_MS) return lastErr;
    try {
      const result = await fn({ attempt, timeoutMs, remainingBudgetMs });
      if (result?.success) return result;
      lastErr = result;
      const retry = shouldRetryWithinBudget({
        attempt,
        maxRetries: retries,
        remainingBudgetMs: remainingOcrBudgetMs(startedAt, Date.now(), totalBudgetMs),
        error: { message: result?.error },
      });
      if (retry) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      return result;
    } catch (err) {
      lastErr = {
        success: false,
        rawText: '',
        confidence: 0,
        aborted: /abort/i.test(String(err?.message || '')),
        error: err?.message || String(err),
      };
      const retry = shouldRetryWithinBudget({
        attempt,
        maxRetries: retries,
        remainingBudgetMs: remainingOcrBudgetMs(startedAt, Date.now(), totalBudgetMs),
        error: err,
      });
      if (retry) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      return lastErr;
    }
  }
  return lastErr;
}

function normalizeCompare(text) {
  return String(text || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

/**
 * PRIMARY → confidence check → SECONDARY → compare → winner.
 * Never merges invented fields. Disagreement forces human review.
 */
export function resolveOcrProviderWinner(googleResult, azureResult) {
  const usable = (r) =>
    Boolean(r?.success && String(r.rawText || '').trim().length > 20);

  const g = usable(googleResult) ? googleResult : null;
  const a = usable(azureResult) ? azureResult : null;

  if (!g && !a) {
    return {
      rawText: '',
      engine: 'none',
      conflict: false,
      needsReview: true,
      winnerConfidence: 0,
    };
  }
  if (g && !a) {
    return {
      rawText: g.rawText,
      engine: g.engine,
      conflict: false,
      needsReview: Number(g.confidence) < 0.8,
      winnerConfidence: Number(g.confidence) || 0,
    };
  }
  if (a && !g) {
    return {
      rawText: a.rawText,
      engine: a.engine,
      conflict: false,
      needsReview: Number(a.confidence) < 0.8,
      winnerConfidence: Number(a.confidence) || 0,
    };
  }

  const same = normalizeCompare(g.rawText) === normalizeCompare(a.rawText);
  const gConf = Number(g.confidence) || 0;
  const aConf = Number(a.confidence) || 0;
  const winner = gConf >= aConf ? g : a;

  return {
    rawText: winner.rawText,
    engine: winner.engine,
    conflict: !same,
    needsReview: !same,
    winnerConfidence: Number(winner.confidence) || 0,
    googleConfidence: gConf,
    azureConfidence: aConf,
  };
}

/**
 * @param {Record<string, any>} [telemetry]
 * @returns {Record<string, any>}
 */
export function sanitizeOcrTelemetry(telemetry = {}) {
  const next = { ...telemetry };
  const gText = String(next.googleRawText || '');
  const aText = String(next.azureRawText || '');
  next.googleTextChars = gText.length;
  next.azureTextChars = aText.length;
  delete next.googleRawText;
  delete next.azureRawText;
  return next;
}

export function buildOcrObservability({
  requestId,
  userId,
  assetId,
  documentId,
  documentType,
  ocrProvider,
  processingTime,
  confidence,
  status,
  errorCode,
} = {}) {
  return {
    requestId: requestId || null,
    userId: userId ? String(userId).slice(0, 64) : null,
    assetId: assetId || null,
    documentId: documentId || null,
    documentType: documentType || null,
    ocrProvider: ocrProvider || null,
    processingTime: Number.isFinite(processingTime) ? processingTime : null,
    confidence: Number.isFinite(confidence) ? confidence : null,
    status: status || null,
    errorCode: errorCode || null,
  };
}

export default {
  isRetryableOcrError,
  withOcrRetry,
  withOcrRetryWithinBudget,
  remainingOcrBudgetMs,
  computeProviderAttemptTimeoutMs,
  shouldRetryWithinBudget,
  shouldCallCloudOcr,
  shouldCallAzureFallback,
  shouldRunSecondMlKit,
  selectOcrRawText,
  isUsableOcrProviderResult,
  isHardOcrFailure,
  resolveOcrProviderWinner,
  sanitizeOcrTelemetry,
  buildOcrObservability,
  TOTAL_OCR_PROVIDER_BUDGET_MS,
  PROVIDER_ATTEMPT_TIMEOUT_MS,
};

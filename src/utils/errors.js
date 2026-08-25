/**
 * Normalized app errors + safe async wrapper
 */

export class AppError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, cause?: unknown, retryable?: boolean }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = 'AppError';
    this.code = opts.code || 'APP_ERROR';
    this.cause = opts.cause;
    this.retryable = Boolean(opts.retryable);
  }
}

export function toErrorMessage(error, fallback = 'Something went wrong') {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof AppError) return error.message;
  return error.message || fallback;
}

/**
 * Wrap an async fn so callers always get { success, data?, error? }
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ success: true, data: T } | { success: false, error: string }>}
 */
export async function safeAsync(fn) {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: toErrorMessage(error) };
  }
}

/** Fire-and-forget with logged failure (avoids unhandled rejections) */
export function runDetached(promise, label = 'detached') {
  Promise.resolve(promise).catch((err) => {
    if (typeof console !== 'undefined') {
      console.warn(`[AssetDoctor:${label}]`, toErrorMessage(err));
    }
  });
}

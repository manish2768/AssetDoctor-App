/**
 * Asset Doctor — Notification Provider Abstraction & Meta WhatsApp Export
 */

export { MetaWhatsAppProvider } from './metaWhatsAppProvider.ts';

/**
 * Retry policy manager for failed queue items
 */
export class RetryPolicyManager {
  static readonly MAX_RETRIES = 3;
  static readonly BASE_DELAY_SECONDS = 60; // 1 min exponential backoff

  static shouldRetry(retryCount: number): boolean {
    return retryCount < RetryPolicyManager.MAX_RETRIES;
  }

  static getNextRetryTimestamp(retryCount: number): string {
    const delaySeconds = RetryPolicyManager.BASE_DELAY_SECONDS * Math.pow(2, retryCount);
    const nextDate = new Date(Date.now() + delaySeconds * 1000);
    return nextDate.toISOString();
  }
}

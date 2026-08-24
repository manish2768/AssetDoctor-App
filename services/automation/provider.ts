/**
 * Asset Doctor — Notification Provider Abstraction & Meta WhatsApp Boundary
 */

import type { NotificationProvider, NotificationQueueItem, NotificationStatus, ProviderResult } from './types.ts';

export class MetaWhatsAppProvider implements NotificationProvider {
  private isConfigured: boolean;

  constructor() {
    // Check environment variables without exposing secrets or failing if unset
    this.isConfigured = Boolean(
      process.env.META_WHATSAPP_TOKEN &&
      process.env.META_WHATSAPP_PHONE_NUMBER_ID
    );
  }

  async send(item: NotificationQueueItem): Promise<ProviderResult> {
    if (!this.isConfigured) {
      // Safe provider boundary: Meta WhatsApp is not connected yet.
      // Notification remains queued in Firestore without failing or faking credentials.
      return {
        success: false,
        status: 'queued',
        error: 'meta_whatsapp_provider_standby'
      };
    }

    try {
      // Future Meta Cloud API payload generation
      const url = `https://graph.facebook.com/v20.0/${process.env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: item.recipientPhone.replace(/[^0-9]/g, ''),
          type: 'template',
          template: {
            name: item.templateKey,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: Object.entries(item.payload).map(([_, val]) => ({
                  type: 'text',
                  text: String(val)
                }))
              }
            ]
          }
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        return {
          success: false,
          status: 'failed',
          error: resData.error?.message || 'Meta API delivery error'
        };
      }

      return {
        success: true,
        status: 'sent',
        messageId: resData.messages?.[0]?.id || `wamid-${Date.now()}`
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: err.message || 'Network error delivering to Meta WhatsApp API'
      };
    }
  }

  async getStatus(messageId: string): Promise<NotificationStatus> {
    return 'sent';
  }

  async handleWebhook(payload: Record<string, any>): Promise<any> {
    // Process inbound status updates: delivered, read, failed
    const entry = payload?.entry?.[0]?.changes?.[0]?.value;
    const statusObj = entry?.statuses?.[0];
    if (statusObj) {
      return {
        messageId: statusObj.id,
        status: statusObj.status as NotificationStatus,
        timestamp: statusObj.timestamp
      };
    }
    return null;
  }
}

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

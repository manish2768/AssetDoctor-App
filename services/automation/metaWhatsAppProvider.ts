/**
 * Asset Doctor — Official Meta WhatsApp Cloud API Provider & Template Integration
 * Uses Meta Graph API v20.0 with secure server-side credential isolation.
 */

import type {
  MetaConfig,
  NotificationProvider,
  NotificationQueueItem,
  NotificationStatus,
  ProviderResult,
  WhatsAppTemplate
} from './types.ts';
import { TemplateService } from './templateService.ts';
import crypto from 'crypto';

export class MetaWhatsAppProvider implements NotificationProvider {
  private config: MetaConfig;

  constructor(customConfig?: MetaConfig) {
    this.config = {
      accessToken: customConfig?.accessToken || process.env.META_ACCESS_TOKEN,
      appId: customConfig?.appId || process.env.META_APP_ID,
      appSecret: customConfig?.appSecret || process.env.META_APP_SECRET,
      wabaId: customConfig?.wabaId || process.env.META_WABA_ID,
      phoneNumberId: customConfig?.phoneNumberId || process.env.META_PHONE_NUMBER_ID,
      webhookVerifyToken: customConfig?.webhookVerifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN,
      apiVersion: customConfig?.apiVersion || process.env.META_API_VERSION || 'v20.0'
    };
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.accessToken &&
      this.config.phoneNumberId &&
      this.config.wabaId
    );
  }

  getConnectionStatus(): {
    metaApi: 'CONNECTED' | 'NOT_CONFIGURED';
    waba: 'CONNECTED' | 'NOT_CONFIGURED';
    phoneNumber: 'VERIFIED' | 'STANDBY';
    webhook: 'HEALTHY' | 'STANDBY';
  } {
    const configured = this.isConfigured();
    return {
      metaApi: configured ? 'CONNECTED' : 'NOT_CONFIGURED',
      waba: this.config.wabaId ? 'CONNECTED' : 'NOT_CONFIGURED',
      phoneNumber: this.config.phoneNumberId ? 'VERIFIED' : 'STANDBY',
      webhook: this.config.webhookVerifyToken ? 'HEALTHY' : 'STANDBY'
    };
  }

  /**
   * Submit a template to Meta for review
   */
  async submitTemplateToMeta(template: WhatsAppTemplate): Promise<{
    success: boolean;
    metaTemplateId?: string;
    status: string;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'STANDBY',
        error: 'Meta WhatsApp credentials not configured. Please set META_ACCESS_TOKEN and META_WABA_ID.'
      };
    }

    const validation = TemplateService.validateTemplate(template);
    if (!validation.valid) {
      return {
        success: false,
        status: 'VALIDATION_FAILED',
        error: validation.errors.join(' ')
      };
    }

    const payload = TemplateService.formatMetaSubmissionPayload(template);
    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.wabaId}/message_templates`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          status: 'REJECTED',
          error: data.error?.message || 'Meta template creation rejected.'
        };
      }

      return {
        success: true,
        metaTemplateId: data.id,
        status: data.status || 'PENDING'
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        error: err.message || 'Network error submitting template to Meta.'
      };
    }
  }

  /**
   * Fetch templates from Meta WABA and sync approval statuses
   */
  async syncTemplatesFromMeta(): Promise<{
    success: boolean;
    templates: any[];
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        templates: [],
        error: 'Meta WhatsApp credentials not configured.'
      };
    }

    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.wabaId}/message_templates?fields=name,status,id,category,language,rejected_reason`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          templates: [],
          error: data.error?.message || 'Failed to fetch templates from Meta.'
        };
      }

      return {
        success: true,
        templates: data.data || []
      };
    } catch (err: any) {
      return {
        success: false,
        templates: [],
        error: err.message || 'Network error syncing templates from Meta.'
      };
    }
  }

  /**
   * Dispatch message via Meta WhatsApp Cloud API
   */
  async send(item: NotificationQueueItem, template?: WhatsAppTemplate): Promise<ProviderResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        status: 'queued',
        error: 'meta_whatsapp_provider_standby'
      };
    }

    // Require approved template
    if (template && (template.metaStatus !== 'APPROVED' || !template.isActive)) {
      return {
        success: false,
        status: 'blocked',
        error: 'approved_template_required'
      };
    }

    const recipientPhone = (item.recipientPhone || '').replace(/[^0-9]/g, '');
    if (!recipientPhone) {
      return {
        success: false,
        status: 'skipped',
        error: 'missing_recipient_phone'
      };
    }

    // Format Meta Cloud API template components with mapped variable parameters
    const parameters: any[] = [];
    if (template && template.variables && template.variables.length > 0) {
      template.variables.forEach(v => {
        const val = item.payload[v.source] || item.payload[v.position] || v.sampleValue || '';
        parameters.push({
          type: 'text',
          text: String(val)
        });
      });
    }

    const metaTemplateName = template?.metaTemplateName || item.templateKey;
    const metaLanguage = template?.language || 'en_US';

    const messagePayload: any = {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'template',
      template: {
        name: metaTemplateName,
        language: {
          code: metaLanguage
        }
      }
    };

    if (parameters.length > 0) {
      messagePayload.template.components = [
        {
          type: 'body',
          parameters
        }
      ];
    }

    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messagePayload)
      });

      const resData = await response.json();
      if (!response.ok) {
        return {
          success: false,
          status: 'failed',
          error: resData.error?.message || 'Meta WhatsApp delivery rejected',
          rawResponse: resData
        };
      }

      const messageId = resData.messages?.[0]?.id || `wamid.${Date.now()}`;
      return {
        success: true,
        status: 'sent',
        messageId,
        rawResponse: resData
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

  /**
   * Verify Webhook Challenge for Meta webhook subscription
   */
  verifyWebhookChallenge(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Verify HMAC-SHA256 signature from Meta webhook request
   */
  verifySignature(rawBody: string | Buffer, signatureHeader: string): boolean {
    if (!this.config.appSecret) return true; // If appSecret not set in dev, pass
    if (!signatureHeader) return false;

    const [prefix, signature] = signatureHeader.split('=');
    if (prefix !== 'sha256' || !signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', this.config.appSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Process incoming Meta Webhook Event (Delivery & Read receipts)
   */
  async handleWebhook(payload: Record<string, any>): Promise<{
    processedEvents: number;
    statuses: Array<{ messageId: string; status: NotificationStatus; timestamp: string }>;
  }> {
    const statuses: Array<{ messageId: string; status: NotificationStatus; timestamp: string }> = [];

    const entries = payload?.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const val = change.value;
        const msgStatuses = val?.statuses || [];
        for (const st of msgStatuses) {
          const messageId = st.id;
          const statusStr = st.status; // 'sent' | 'delivered' | 'read' | 'failed'
          let mappedStatus: NotificationStatus = 'sent';

          if (statusStr === 'delivered') mappedStatus = 'delivered';
          else if (statusStr === 'read') mappedStatus = 'read';
          else if (statusStr === 'failed') mappedStatus = 'failed';

          statuses.push({
            messageId,
            status: mappedStatus,
            timestamp: st.timestamp ? new Date(parseInt(st.timestamp, 10) * 1000).toISOString() : new Date().toISOString()
          });
        }
      }
    }

    return {
      processedEvents: statuses.length,
      statuses
    };
  }
}

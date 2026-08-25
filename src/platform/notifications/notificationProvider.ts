/**
 * Asset Doctor — Multi-Channel Notification Provider Abstraction
 * Decouples business event triggers from physical delivery channels (WhatsApp, Email, InApp, Push, SMS).
 */

import { DomainEvent } from '../core/eventBus';

export type NotificationChannel = 'IN_APP' | 'WHATSAPP' | 'EMAIL' | 'PUSH' | 'SMS';

export interface NotificationPayload {
  recipientId: string;
  recipientPhone?: string;
  recipientEmail?: string;
  title: string;
  body: string;
  actionUrl?: string;
  category: string;
  metadata?: Record<string, any>;
}

export interface NotificationChannelProvider {
  channel: NotificationChannel;
  isAvailable(): boolean;
  send(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export class InAppNotificationProvider implements NotificationChannelProvider {
  public channel: NotificationChannel = 'IN_APP';
  public isAvailable(): boolean { return true; }
  public async send(payload: NotificationPayload) {
    console.log(`[Notification:InApp] Dispatched to user ${payload.recipientId}: "${payload.title}"`);
    return { success: true, messageId: `inapp_${Date.now()}` };
  }
}

export class NotificationDispatcher {
  private providers: Map<NotificationChannel, NotificationChannelProvider> = new Map();

  constructor() {
    this.registerProvider(new InAppNotificationProvider());
  }

  public registerProvider(provider: NotificationChannelProvider): void {
    this.providers.set(provider.channel, provider);
  }

  public async dispatch(
    payload: NotificationPayload,
    channels: NotificationChannel[] = ['IN_APP']
  ): Promise<Record<NotificationChannel, { success: boolean; error?: string }>> {
    const results: any = {};

    for (const ch of channels) {
      const provider = this.providers.get(ch);
      if (provider && provider.isAvailable()) {
        try {
          results[ch] = await provider.send(payload);
        } catch (err: any) {
          results[ch] = { success: false, error: err.message };
        }
      } else {
        results[ch] = { success: false, error: `Provider for channel ${ch} is not active` };
      }
    }

    return results;
  }

  /**
   * Translates domain events into typed multi-channel notifications
   */
  public async handleDomainEvent(event: DomainEvent): Promise<void> {
    if (event.eventType === 'warranty.expiring') {
      await this.dispatch({
        recipientId: event.userId,
        title: 'Warranty Expiring Soon',
        body: `Your asset ${event.payload.assetName} warranty expires on ${event.payload.expiryDate}.`,
        category: 'WARRANTY'
      }, ['IN_APP']);
    } else if (event.eventType === 'maintenance.due') {
      await this.dispatch({
        recipientId: event.userId,
        title: 'Preventive Maintenance Due',
        body: `Scheduled maintenance is due for ${event.payload.assetName}.`,
        category: 'MAINTENANCE'
      }, ['IN_APP']);
    }
  }
}

export const notificationDispatcher = new NotificationDispatcher();

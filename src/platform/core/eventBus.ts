/**
 * Asset Doctor — Domain Event Bus
 * Decouples business event triggers from execution channels (e.g. notifications, webhooks, analytics).
 */

export type DomainEventType =
  | 'asset.created'
  | 'asset.updated'
  | 'asset.deleted'
  | 'asset.archived'
  | 'asset.sold'
  | 'document.uploaded'
  | 'document.processed'
  | 'service.completed'
  | 'maintenance.due'
  | 'warranty.expiring'
  | 'insurance.expiring'
  | 'puc.expiring'
  | 'health.degraded';

export interface DomainEvent<TPayload = any> {
  eventId: string;
  eventType: DomainEventType;
  tenantId: string;
  userId: string;
  assetId?: string;
  timestamp: string;
  payload: TPayload;
}

type EventHandler<TPayload = any> = (event: DomainEvent<TPayload>) => void | Promise<void>;

class DomainEventBus {
  private handlers: Map<DomainEventType, Set<EventHandler>> = new Map();

  public subscribe<T = any>(eventType: DomainEventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler);
    };
  }

  public async publish<T = any>(eventType: DomainEventType, data: Omit<DomainEvent<T>, 'eventId' | 'timestamp' | 'eventType'>): Promise<void> {
    const event: DomainEvent<T> = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      timestamp: new Date().toISOString(),
      ...data
    };

    const listeners = this.handlers.get(eventType);
    if (listeners) {
      for (const handler of listeners) {
        try {
          await handler(event);
        } catch (err) {
          console.error(`[EventBus] Error executing handler for ${eventType}:`, err);
        }
      }
    }
  }
}

export const eventBus = new DomainEventBus();

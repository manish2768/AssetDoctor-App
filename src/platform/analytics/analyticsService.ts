/**
 * Asset Doctor — Privacy-First Analytics Service
 * Tracks aggregated usage events with strict client-side PII scrubbing.
 */

export type AnalyticsEventType =
  | 'tool_used'
  | 'tool_completed'
  | 'result_saved'
  | 'asset_created'
  | 'asset_opened'
  | 'passport_shared'
  | 'calculator_recalculated'
  | 'knowledge_article_opened';

export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  toolName?: string;
  category?: string;
  timestamp: string;
  isGuest: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export class AnalyticsService {
  private static eventLog: AnalyticsEvent[] = [];

  /**
   * Track product interaction event (with strict PII scrubbing)
   */
  public static trackEvent(
    eventType: AnalyticsEventType,
    payload: {
      toolName?: string;
      category?: string;
      isGuest?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): void {
    // PII Scrubbing: Ensure no emails, phone numbers, or tokens are logged
    const cleanMeta: Record<string, string | number | boolean> = {};
    if (payload.metadata) {
      Object.entries(payload.metadata).forEach(([k, v]) => {
        const keyLower = k.toLowerCase();
        if (
          !keyLower.includes('email') &&
          !keyLower.includes('phone') &&
          !keyLower.includes('address') &&
          !keyLower.includes('name') &&
          !keyLower.includes('token')
        ) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            cleanMeta[k] = v;
          }
        }
      });
    }

    const event: AnalyticsEvent = {
      eventType,
      toolName: payload.toolName,
      category: payload.category,
      timestamp: new Date().toISOString(),
      isGuest: Boolean(payload.isGuest),
      metadata: cleanMeta
    };

    this.eventLog.push(event);

    // Keep max 50 recent events in memory
    if (this.eventLog.length > 50) {
      this.eventLog.shift();
    }
  }

  /**
   * Retrieve event log for diagnostic auditing
   */
  public static getEventLog(): AnalyticsEvent[] {
    return [...this.eventLog];
  }
}

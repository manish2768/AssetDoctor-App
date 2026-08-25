/**
 * Asset Doctor — Standardized Privacy-First Analytics Service
 * Dispatches structured product events, scrubs PII, and aggregates metrics for Admin Website Intelligence.
 */

export type AnalyticsEventType =
  | 'page_view'
  | 'tool_opened'
  | 'tool_completed'
  | 'result_saved'
  | 'asset_created'
  | 'asset_opened'
  | 'passport_shared'
  | 'search_performed'
  | 'cta_clicked'
  | 'auth_started'
  | 'auth_completed';

export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  path?: string;
  toolName?: string;
  category?: string;
  intent?: string;
  timestamp: string;
  isGuest: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface WebsiteAggregatedMetrics {
  totalPageViews: number;
  totalToolCompletions: number;
  totalResultsSaved: number;
  topTools: Array<{ name: string; completions: number; saves: number; conversionRate: string }>;
  topSearchIntents: Array<{ intent: string; count: number }>;
  topLandingPaths: Array<{ path: string; views: number }>;
  trafficSources: Array<{ source: string; percentage: number }>;
  lastUpdated: string;
}

const ANALYTICS_STORE_KEY = 'ad_analytics_agg_metrics';
const memoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (_) {}
  return memoryStore[key] || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch (_) {}
  memoryStore[key] = value;
}

export class AnalyticsService {
  private static eventLog: AnalyticsEvent[] = [];

  /**
   * Track standardized product event with strict PII scrubbing
   */
  public static trackEvent(
    eventType: AnalyticsEventType,
    payload: {
      path?: string;
      toolName?: string;
      category?: string;
      intent?: string;
      isGuest?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): void {
    // 1. Strict PII Scrubbing: Strip email, phone, token, full names, and OCR payloads
    const cleanMeta: Record<string, string | number | boolean> = {};
    if (payload.metadata) {
      Object.entries(payload.metadata).forEach(([k, v]) => {
        const keyLower = k.toLowerCase();
        if (
          !keyLower.includes('email') &&
          !keyLower.includes('phone') &&
          !keyLower.includes('address') &&
          !keyLower.includes('name') &&
          !keyLower.includes('token') &&
          !keyLower.includes('ocr') &&
          !keyLower.includes('receipt') &&
          !keyLower.includes('password')
        ) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            cleanMeta[k] = v;
          }
        }
      });
    }

    const event: AnalyticsEvent = {
      eventType,
      path: payload.path || (typeof window !== 'undefined' ? window.location.pathname : '/'),
      toolName: payload.toolName,
      category: payload.category,
      intent: payload.intent ? this.normalizeSearchIntent(payload.intent) : undefined,
      timestamp: new Date().toISOString(),
      isGuest: payload.isGuest !== undefined ? payload.isGuest : true,
      metadata: cleanMeta
    };

    this.eventLog.push(event);
    if (this.eventLog.length > 100) {
      this.eventLog.shift();
    }

    // 2. Dispatch to window.gtag if GA4 is loaded
    try {
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', eventType, {
          page_path: event.path,
          tool_name: event.toolName,
          asset_category: event.category,
          search_intent: event.intent,
          is_guest: event.isGuest,
          ...cleanMeta
        });
      }
    } catch (_) {}

    // 3. Update local aggregation ledger for Super Admin reporting
    this.updateAggregatedMetrics(event);
  }

  /**
   * Normalize search queries into privacy-safe categorical intents
   */
  public static normalizeSearchIntent(query: string): string {
    const q = (query || '').toLowerCase();
    if (q.includes('solar') || q.includes('inverter') || q.includes('pv')) return 'solar_energy_upkeep';
    if (q.includes('amc') || q.includes('business') || q.includes('printer') || q.includes('enterprise')) return 'business_asset_amc';
    if (q.includes('warranty') || q.includes('guarantee')) return 'warranty_inquiry';
    if (q.includes('service') || q.includes('periodic') || q.includes('oil') || q.includes('bike') || q.includes('car')) return 'service_due_inquiry';
    if (q.includes('repair') || q.includes('replace') || q.includes('broken')) return 'repair_vs_replace_decision';
    if (q.includes('depreciat') || q.includes('worth') || q.includes('value') || q.includes('resale')) return 'valuation_depreciation';
    if (q.includes('filter') || q.includes('clean') || q.includes('ac') || q.includes('maint')) return 'preventative_maintenance';
    if (q.includes('puc') || q.includes('insurance') || q.includes('bill') || q.includes('invoice')) return 'document_compliance';
    return 'general_discovery';
  }

  /**
   * Update aggregation counters
   */
  private static updateAggregatedMetrics(event: AnalyticsEvent): void {
    try {
      const metrics = this.getAggregatedMetrics();

      if (event.eventType === 'page_view') {
        metrics.totalPageViews += 1;
        const currentPath = event.path || '/';
        const pathEntry = metrics.topLandingPaths.find(p => p.path === currentPath);
        if (pathEntry) {
          pathEntry.views += 1;
        } else {
          metrics.topLandingPaths.push({ path: currentPath, views: 1 });
        }
      }

      if (event.eventType === 'tool_completed' && event.toolName) {
        metrics.totalToolCompletions += 1;
        const toolEntry = metrics.topTools.find(t => t.name === event.toolName);
        if (toolEntry) {
          toolEntry.completions += 1;
          const rate = toolEntry.completions > 0 ? `${Math.round((toolEntry.saves / toolEntry.completions) * 100)}%` : '0%';
          toolEntry.conversionRate = rate;
        } else {
          metrics.topTools.push({ name: event.toolName, completions: 1, saves: 0, conversionRate: '0%' });
        }
      }

      if (event.eventType === 'result_saved' && event.toolName) {
        metrics.totalResultsSaved += 1;
        const toolEntry = metrics.topTools.find(t => t.name === event.toolName);
        if (toolEntry) {
          toolEntry.saves += 1;
          const rate = toolEntry.completions > 0 ? `${Math.round((toolEntry.saves / toolEntry.completions) * 100)}%` : '100%';
          toolEntry.conversionRate = rate;
        }
      }

      if (event.eventType === 'search_performed' && event.intent) {
        const intentEntry = metrics.topSearchIntents.find(i => i.intent === event.intent);
        if (intentEntry) {
          intentEntry.count += 1;
        } else {
          metrics.topSearchIntents.push({ intent: event.intent, count: 1 });
        }
      }

      metrics.lastUpdated = new Date().toISOString();
      safeSetItem(ANALYTICS_STORE_KEY, JSON.stringify(metrics));
    } catch (_) {}
  }

  /**
   * Get aggregated metrics for Super Admin dashboard
   */
  public static getAggregatedMetrics(): WebsiteAggregatedMetrics {
    try {
      const raw = safeGetItem(ANALYTICS_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.totalPageViews === 'number') {
          return parsed;
        }
      }
    } catch (_) {}

    return {
      totalPageViews: 0,
      totalToolCompletions: 0,
      totalResultsSaved: 0,
      topTools: [
        { name: 'Repair vs Replace', completions: 0, saves: 0, conversionRate: '0%' },
        { name: 'Warranty Checker', completions: 0, saves: 0, conversionRate: '0%' },
        { name: 'Asset Depreciation', completions: 0, saves: 0, conversionRate: '0%' },
        { name: 'Maintenance Interval', completions: 0, saves: 0, conversionRate: '0%' }
      ],
      topSearchIntents: [],
      topLandingPaths: [
        { path: '/', views: 0 },
        { path: '/tools/warranty-checker', views: 0 },
        { path: '/tools/repair-or-replace', views: 0 }
      ],
      trafficSources: [
        { source: 'Direct / PWA', percentage: 54 },
        { source: 'Organic Search', percentage: 32 },
        { source: 'Referral', percentage: 14 }
      ],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Retrieve event log
   */
  public static getEventLog(): AnalyticsEvent[] {
    return [...this.eventLog];
  }

  /**
   * Clear event log (for testing)
   */
  public static clearEventLog(): void {
    this.eventLog = [];
    safeSetItem(ANALYTICS_STORE_KEY, JSON.stringify({
      totalPageViews: 0,
      totalToolCompletions: 0,
      totalResultsSaved: 0,
      topTools: [],
      topSearchIntents: [],
      topLandingPaths: [],
      trafficSources: [],
      lastUpdated: new Date().toISOString()
    }));
  }
}

/**
 * Asset Doctor — Guest Session Service
 * Manages transient in-memory and local browser state for anonymous visitors.
 * ZERO automatic writes to Firestore for guest sessions.
 */

export interface GuestCalculation {
  id: string;
  toolType: 'REPAIR_VS_REPLACE' | 'DEPRECIATION' | 'WARRANTY' | 'TCO' | 'MAINTENANCE' | 'HEALTH_SCORE';
  assetName: string;
  assetCategory: string;
  summary: string;
  primaryMetricLabel: string;
  primaryMetricValue: string | number;
  details: Record<string, any>;
  calculatedAt: string;
}

const GUEST_CALCULATIONS_KEY = 'assetdoctor_guest_calculations';
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

function safeRemoveItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
  } catch (_) {}
  delete memoryStore[key];
}

export class GuestSessionService {
  /**
   * Add a calculation result to guest local state
   */
  public static addGuestCalculation(
    calc: Omit<GuestCalculation, 'id' | 'calculatedAt'>
  ): GuestCalculation {
    const newRecord: GuestCalculation = {
      ...calc,
      id: `guest_calc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      calculatedAt: new Date().toISOString()
    };

    try {
      const existing = this.getGuestCalculations();
      // Keep most recent 10 calculations
      const updated = [newRecord, ...existing.filter(c => c.assetName !== calc.assetName || c.toolType !== calc.toolType)].slice(0, 10);
      safeSetItem(GUEST_CALCULATIONS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('[GuestSessionService] Failed to write to storage:', e);
    }

    return newRecord;
  }

  /**
   * Get all guest calculations from local state
   */
  public static getGuestCalculations(): GuestCalculation[] {
    try {
      const raw = safeGetItem(GUEST_CALCULATIONS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('[GuestSessionService] Failed to read guest calculations:', e);
    }
    return [];
  }

  /**
   * Clear all transient guest calculations (e.g. after migration or manual clear)
   */
  public static clearGuestCalculations(): void {
    try {
      safeRemoveItem(GUEST_CALCULATIONS_KEY);
    } catch (e) {
      console.warn('[GuestSessionService] Failed to clear guest calculations:', e);
    }
  }

  /**
   * Check if there are pending guest calculations to offer migration on login
   */
  public static hasGuestCalculations(): boolean {
    return this.getGuestCalculations().length > 0;
  }
}

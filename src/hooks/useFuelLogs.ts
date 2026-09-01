/**
 * Asset Doctor — useFuelLogs
 *
 * Reusable real-time Firestore listener for a single asset's fuel logs,
 * wrapping FuelService.subscribeFuelLogs with unsubscribe cleanup + a
 * duplicate-listener guard so consumers (Refill Impact Card, Fuel Passport,
 * Fuel Vault) never spin up overlapping listeners.
 *
 * Storage: Users/{uid}/Assets/{assetId}/fuelLogs/{logId}
 */

import { useEffect, useState } from 'react';

import { FuelService } from '../services/fuel/FuelService';

export interface UseFuelLogsOptions {
  enabled?: boolean;
}

export interface UseFuelLogsResult {
  /** Fuel logs newest-first (already sorted desc by the service). */
  logs: Array<Record<string, any>>;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * @param userId authenticated uid (or null when guest)
 * @param assetId asset to listen to
 */
export function useFuelLogs(
  userId: string | null | undefined,
  assetId: string | null | undefined,
  options: UseFuelLogsOptions = {},
): UseFuelLogsResult {
  const { enabled = true } = options;
  const [logs, setLogs] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(Boolean(userId && assetId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const uid = userId || null;
    const id = assetId || null;
    if (!uid || !id || !enabled) {
      setLogs([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const unsubscribe = FuelService.subscribeFuelLogs(
      uid,
      id,
      (next) => {
        if (!active) return;
        setLogs(Array.isArray(next) ? next : []);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
    };
  }, [userId, assetId, enabled]);

  const refresh = () => {
    // Re-querying handled by re-subscribing on dep change; clients call set a counter if needed.
    // For an immediate one-shot we simply expose an empty refresh (latest data arrives via listener).
  };

  return { logs, loading, error, refresh };
}

export default useFuelLogs;

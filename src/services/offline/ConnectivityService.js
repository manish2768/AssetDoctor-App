/**
 * Connectivity detection without requiring NetInfo native module.
 * ONLINE | OFFLINE | CONNECTING — probe is lightweight and cached briefly.
 */

import { AppState } from 'react-native';

export const CONNECTIVITY = Object.freeze({
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  CONNECTING: 'CONNECTING',
});

const PROBE_URLS = [
  'https://clients3.google.com/generate_204',
  'https://www.gstatic.com/generate_204',
];

let cached = {
  status: CONNECTIVITY.CONNECTING,
  checkedAt: 0,
};
let listeners = new Set();
let appSub = null;
let probeTimer = null;

function emit() {
  for (const fn of listeners) {
    try {
      fn(cached.status);
    } catch {
      /* ignore */
    }
  }
}

async function probeOnce() {
  cached = { ...cached, status: CONNECTIVITY.CONNECTING };
  emit();
  for (const url of PROBE_URLS) {
    try {
      const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = setTimeout(() => controller?.abort?.(), 4000);
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller?.signal,
      });
      clearTimeout(timer);
      if (res && (res.ok || res.status === 204 || res.status === 0)) {
        cached = { status: CONNECTIVITY.ONLINE, checkedAt: Date.now() };
        emit();
        return cached.status;
      }
    } catch {
      /* try next */
    }
  }
  cached = { status: CONNECTIVITY.OFFLINE, checkedAt: Date.now() };
  emit();
  return cached.status;
}

export class ConnectivityService {
  static getStatus() {
    return cached.status;
  }

  static isOnlineSync() {
    return cached.status === CONNECTIVITY.ONLINE;
  }

  static async isOnline({ force = false } = {}) {
    const age = Date.now() - (cached.checkedAt || 0);
    if (!force && age < 8_000 && cached.status !== CONNECTIVITY.CONNECTING) {
      return cached.status === CONNECTIVITY.ONLINE;
    }
    const status = await probeOnce();
    return status === CONNECTIVITY.ONLINE;
  }

  static subscribe(listener) {
    listeners.add(listener);
    try {
      listener(cached.status);
    } catch {
      /* ignore */
    }
    return () => listeners.delete(listener);
  }

  static start() {
    if (appSub) return () => this.stop();
    this.isOnline({ force: true }).catch(() => {});
    appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') this.isOnline({ force: true }).catch(() => {});
    });
    probeTimer = setInterval(() => {
      this.isOnline({ force: true }).catch(() => {});
    }, 45_000);
    return () => this.stop();
  }

  static stop() {
    appSub?.remove?.();
    appSub = null;
    if (probeTimer) clearInterval(probeTimer);
    probeTimer = null;
  }
}

export default ConnectivityService;

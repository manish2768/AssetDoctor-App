import type { OcrResult } from '../core/OcrResult.ts';

interface CacheEntry {
  fingerprint: string;
  result: OcrResult;
  timestamp: number;
  expiresAt: number;
}

export class OcrCache {
  private static memoryCache = new Map<string, CacheEntry>();
  private static DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

  public static computeFingerprint(input: string): string {
    if (!input) return 'empty_hash';
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0, ch; i < input.length; i++) {
      ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return `sha256_${hex1}${hex2}${input.length.toString(16)}`;
  }

  public static get(fingerprint: string): OcrResult | null {
    if (!fingerprint) return null;
    const entry = this.memoryCache.get(fingerprint);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(fingerprint);
      return null;
    }
    return {
      ...entry.result,
      fromCache: true,
      engine: 'cache'
    };
  }

  public static set(fingerprint: string, result: OcrResult, ttlMs: number = this.DEFAULT_TTL_MS): void {
    if (!fingerprint || !result) return;
    this.memoryCache.set(fingerprint, {
      fingerprint,
      result: { ...result, fingerprint },
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs
    });
    if (this.memoryCache.size > 150) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
  }

  public static clear(): void {
    this.memoryCache.clear();
  }
}

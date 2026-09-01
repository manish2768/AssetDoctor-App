/**
 * OCR scan session isolation.
 * Every scan gets a unique scanSessionId. Stale async responses MUST be discarded.
 */

export const PIPELINE_VERSION = '3.0.0';
export const CLASSIFIER_VERSION = '3.0.0';
export const EXTRACTOR_VERSION = '3.0.0';

export interface ScanContext {
  scanSessionId: string;
  documentId: string;
  imageHash: string | null;
  documentType: string | null;
  extractionStartedAt: number;
}

export function createScanSessionId(): string {
  return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createScanContext(partial: Partial<ScanContext> = {}): ScanContext {
  return {
    scanSessionId: partial.scanSessionId || createScanSessionId(),
    documentId: partial.documentId || createDocumentId(),
    imageHash: partial.imageHash || null,
    documentType: partial.documentType || null,
    extractionStartedAt: partial.extractionStartedAt || Date.now(),
  };
}

/**
 * In-memory generation guard for React screens.
 * Increment on every new scan; drop responses whose session is no longer current.
 */
export class ScanSessionGuard {
  private currentId: string | null = null;
  private generation = 0;

  begin(scanSessionId?: string): { scanSessionId: string; generation: number } {
    this.generation += 1;
    this.currentId = scanSessionId || createScanSessionId();
    return { scanSessionId: this.currentId, generation: this.generation };
  }

  isCurrent(scanSessionId: string, generation?: number): boolean {
    if (generation != null && generation !== this.generation) return false;
    return Boolean(scanSessionId) && scanSessionId === this.currentId;
  }

  get current(): string | null {
    return this.currentId;
  }

  get gen(): number {
    return this.generation;
  }
}

function sha256Node(input: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHash } = require('crypto');
    if (typeof createHash !== 'function') return null;
    return createHash('sha256').update(input).digest('hex');
  } catch {
    return null;
  }
}

function sha256CryptoJs(input: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const CryptoJS = require('crypto-js');
    if (!CryptoJS?.SHA256) return null;
    return CryptoJS.SHA256(input).toString();
  } catch {
    return null;
  }
}

/** Cryptographic content hash. Never hash by filename / assetId / userId alone. */
export function sha256Hex(input: string): string {
  const cj = sha256CryptoJs(input);
  if (cj) return cj;
  const node = sha256Node(input);
  if (node) return node;
  // Last-resort non-crypto fallback (should not run in production RN / Node)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${hash}_${input.length}`;
}

export function cacheKeyForExtraction(opts: {
  imageHash?: string | null;
  rawText?: string | null;
}): string {
  const content = opts.imageHash
    ? `img:${opts.imageHash}`
    : `txt:${sha256Hex(String(opts.rawText || '').replace(/\s+/g, ' ').trim())}`;
  return sha256Hex(
    `${content}|p=${PIPELINE_VERSION}|c=${CLASSIFIER_VERSION}|e=${EXTRACTOR_VERSION}`,
  );
}

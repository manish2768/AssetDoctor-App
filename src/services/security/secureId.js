/**
 * Cryptographically secure ID helpers.
 * Uses globalThis.crypto (after installSecureCrypto polyfill) when available,
 * then expo-crypto, then SHA-256 DRBG. Never Math.random() for identifiers.
 */

import { ensureCryptoSurface } from '../../polyfills/installSecureCrypto.js';
import { softwareRandomHex, softwareRandomUUID } from '../../polyfills/softwareCsprng.js';

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @param {number} byteCount
 * @returns {string} lowercase hex
 */
export function secureRandomHex(byteCount = 16) {
  const n = Math.max(1, Math.min(1024, Number(byteCount) || 16));
  const bytes = new Uint8Array(n);
  try {
    const crypto = ensureCryptoSurface();
    if (crypto?.getRandomValues) {
      crypto.getRandomValues(bytes);
      return bytesToHex(bytes);
    }
  } catch {
    /* continue */
  }
  try {
    const Crypto = require('expo-crypto');
    if (Crypto?.getRandomBytes) {
      const native = Crypto.getRandomBytes(n);
      return bytesToHex(Array.from(native));
    }
  } catch {
    /* continue */
  }
  return softwareRandomHex(n);
}

/**
 * Stable vault asset document id — CSPRNG only.
 * @returns {string} e.g. asset_<32 hex>
 */
export function createSecureAssetId() {
  return `asset_${secureRandomHex(16)}`;
}

/**
 * @returns {string} RFC4122 UUID v4
 */
export function createSecureUuid() {
  try {
    const crypto = ensureCryptoSurface();
    if (typeof crypto?.randomUUID === 'function') {
      const id = crypto.randomUUID();
      if (id && typeof id === 'string') return id;
    }
  } catch {
    /* continue */
  }
  try {
    const Crypto = require('expo-crypto');
    if (Crypto?.randomUUID) return Crypto.randomUUID();
  } catch {
    /* continue */
  }
  return softwareRandomUUID();
}

/**
 * Fill a TypedArray via universal crypto. Never throws; never uses Math.random.
 */
export function getSecureRandomValues(typedArray) {
  if (!typedArray) return typedArray;
  try {
    const crypto = ensureCryptoSurface();
    if (crypto?.getRandomValues) {
      return crypto.getRandomValues(typedArray);
    }
  } catch {
    /* continue */
  }
  try {
    const Crypto = require('expo-crypto');
    if (Crypto?.getRandomValues) return Crypto.getRandomValues(typedArray);
  } catch {
    /* continue */
  }
  const { fillSoftwareRandomValues } = require('../../polyfills/softwareCsprng');
  return fillSoftwareRandomValues(typedArray);
}

export default {
  secureRandomHex,
  createSecureAssetId,
  createSecureUuid,
  getSecureRandomValues,
};

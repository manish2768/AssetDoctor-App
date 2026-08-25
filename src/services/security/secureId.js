/**
 * Cryptographically secure ID helpers (expo-crypto).
 * Prefer these over Math.random / Date.now for vault asset IDs and keys.
 */

import * as Crypto from 'expo-crypto';

/**
 * @param {number} byteCount
 * @returns {string} lowercase hex
 */
export function secureRandomHex(byteCount = 16) {
  const n = Math.max(1, Math.min(1024, Number(byteCount) || 16));
  const bytes = Crypto.getRandomBytes(n);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
  return Crypto.randomUUID();
}

/**
 * Fill a TypedArray via expo-crypto (also used by crypto polyfill).
 */
export function getSecureRandomValues(typedArray) {
  return Crypto.getRandomValues(typedArray);
}

export default {
  secureRandomHex,
  createSecureAssetId,
  createSecureUuid,
  getSecureRandomValues,
};

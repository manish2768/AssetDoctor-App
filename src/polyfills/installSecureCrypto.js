/**
 * Polyfill Web Crypto getRandomValues for Hermes / React Native.
 * crypto-js AES uses WordArray.random → crypto.getRandomValues; without this,
 * encryption throws: "Native crypto module could not be used to get secure random number."
 *
 * MUST be imported before crypto-js (see EncryptedVaultStorage / App.js).
 * Uses expo-crypto native CSPRNG only — no Math.random / Date.now fallbacks.
 */

import * as ExpoCrypto from 'expo-crypto';

function ensureCryptoSurface() {
  const root =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof global !== 'undefined'
        ? global
        : typeof window !== 'undefined'
          ? window
          : null;
  if (!root) return;

  const getRandomValues = (typedArray) => ExpoCrypto.getRandomValues(typedArray);
  const randomUUID = () => ExpoCrypto.randomUUID();

  if (!root.crypto || typeof root.crypto !== 'object') {
    root.crypto = { getRandomValues, randomUUID };
  } else {
    if (typeof root.crypto.getRandomValues !== 'function') {
      root.crypto.getRandomValues = getRandomValues;
    }
    if (typeof root.crypto.randomUUID !== 'function') {
      root.crypto.randomUUID = randomUUID;
    }
  }

  // Hermes sometimes exposes a separate `global` object
  if (typeof global !== 'undefined' && global !== root && !global.crypto) {
    global.crypto = root.crypto;
  }
  if (typeof window !== 'undefined' && window !== root && !window.crypto) {
    window.crypto = root.crypto;
  }
}

ensureCryptoSurface();

export { ensureCryptoSurface };
export default ensureCryptoSurface;

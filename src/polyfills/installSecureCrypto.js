/**
 * Polyfill Web Crypto getRandomValues for Hermes / React Native.
 * crypto-js AES uses WordArray.random → crypto.getRandomValues; without this,
 * encryption throws: "Native crypto module could not be used to get secure random number."
 *
 * MUST be imported before crypto-js (see EncryptedVaultStorage / App.js).
 *
 * Android production: Hermes may expose crypto.getRandomValues that THROWS
 * (expo-crypto native module missing / mismatched). crypto-js swallows that
 * throw and surfaces the generic "Native crypto module..." error.
 * This wrapper never throws — expo-crypto first, then SHA-256 DRBG.
 */

import {
  fillSoftwareRandomValues,
  softwareRandomUUID,
} from './softwareCsprng.js';

let ExpoCrypto = null;
try {
  ExpoCrypto = require('expo-crypto');
} catch {
  ExpoCrypto = null;
}

function tryNativeFill(typedArray) {
  if (!typedArray) return false;
  if (ExpoCrypto?.getRandomValues) {
    try {
      ExpoCrypto.getRandomValues(typedArray);
      return true;
    } catch {
      /* native module unavailable on this Android runtime */
    }
  }
  if (ExpoCrypto?.getRandomBytes) {
    try {
      const bytes = ExpoCrypto.getRandomBytes(typedArray.byteLength);
      if (bytes && bytes.length) {
        const view =
          typedArray instanceof Uint8Array
            ? typedArray
            : new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
        view.set(bytes.subarray ? bytes.subarray(0, view.length) : bytes);
        return true;
      }
    } catch {
      /* ignore */
    }
  }
  return false;
}

function safeGetRandomValues(typedArray) {
  if (!typedArray || typedArray.length == null) return typedArray;
  if (tryNativeFill(typedArray)) return typedArray;
  return fillSoftwareRandomValues(typedArray);
}

function safeRandomUUID() {
  try {
    if (typeof ExpoCrypto?.randomUUID === 'function') return ExpoCrypto.randomUUID();
  } catch {
    /* native UUID unavailable */
  }
  return softwareRandomUUID();
}

function ensureCryptoSurface() {
  const root =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof global !== 'undefined'
        ? global
        : typeof window !== 'undefined'
          ? window
          : null;
  if (!root) return root;

  if (!root.crypto || typeof root.crypto !== 'object') {
    root.crypto = {};
  }

  const previous =
    typeof root.crypto.getRandomValues === 'function' ? root.crypto.getRandomValues : null;

  root.crypto.getRandomValues = (typedArray) => {
    if (previous && previous !== root.crypto.getRandomValues) {
      try {
        previous.call(root.crypto, typedArray);
        return typedArray;
      } catch {
        /* broken Hermes / expo native */
      }
    }
    return safeGetRandomValues(typedArray);
  };

  if (typeof root.crypto.randomUUID !== 'function') {
    root.crypto.randomUUID = safeRandomUUID;
  } else {
    const prevUuid = root.crypto.randomUUID;
    root.crypto.randomUUID = () => {
      try {
        return prevUuid.call(root.crypto);
      } catch {
        return safeRandomUUID();
      }
    };
  }

  if (typeof global !== 'undefined' && global !== root) {
    if (!global.crypto) global.crypto = root.crypto;
    else {
      global.crypto.getRandomValues = root.crypto.getRandomValues;
      if (typeof global.crypto.randomUUID !== 'function') {
        global.crypto.randomUUID = root.crypto.randomUUID;
      }
    }
  }
  if (typeof window !== 'undefined' && window !== root) {
    if (!window.crypto) window.crypto = root.crypto;
    else {
      window.crypto.getRandomValues = root.crypto.getRandomValues;
      if (typeof window.crypto.randomUUID !== 'function') {
        window.crypto.randomUUID = root.crypto.randomUUID;
      }
    }
  }

  return root.crypto;
}

ensureCryptoSurface();

export { ensureCryptoSurface, safeGetRandomValues, safeRandomUUID };
export default ensureCryptoSurface;

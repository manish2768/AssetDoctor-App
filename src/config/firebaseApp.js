/**
 * Safe Firebase App bootstrap for React Native Firebase.
 *
 * Native [DEFAULT] app is created by FirebaseInitProvider once google-services.json
 * is processed. JS must not permanently cache a failed probe — early boot can race
 * native init by a few hundred ms.
 */

let appModule = null;
/** @type {boolean | null} null = never succeeded yet / retry allowed */
let ready = null;
let lastError = null;
/** @type {Promise<boolean> | null} */
let waitPromise = null;

/**
 * @returns {boolean}
 */
export function isFirebaseAppReady() {
  return ready === true;
}

/**
 * @returns {Error | null}
 */
export function getFirebaseInitError() {
  return lastError;
}

/**
 * Soft-require + touch default app. Always retries when not yet ready.
 * @returns {boolean}
 */
export function ensureFirebaseApp() {
  if (ready === true) return true;

  try {
    if (!appModule) {
      // eslint-disable-next-line global-require
      appModule = require('@react-native-firebase/app').default;
    }
    // Touch default app — throws if google-services / native init not ready yet
    if (typeof appModule?.app === 'function') {
      appModule.app();
    }
    ready = true;
    lastError = null;
    return true;
  } catch (error) {
    ready = false;
    lastError = error instanceof Error ? error : new Error(String(error));
    console.warn('[Firebase] init not ready:', lastError?.message || lastError);
    return false;
  }
}

/**
 * Wait until the default Firebase app is available (or timeout).
 * Safe to call multiple times — shares one in-flight wait.
 * @param {{ timeoutMs?: number, intervalMs?: number }} [opts]
 * @returns {Promise<boolean>}
 */
export function waitForFirebaseApp(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const intervalMs = opts.intervalMs ?? 75;

  if (ensureFirebaseApp()) return Promise.resolve(true);
  if (waitPromise) return waitPromise;

  waitPromise = (async () => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, intervalMs));
      if (ensureFirebaseApp()) return true;
    }
    return ensureFirebaseApp();
  })().finally(() => {
    waitPromise = null;
  });

  return waitPromise;
}

/**
 * @returns {import('@react-native-firebase/app').FirebaseApp | null}
 */
export function getFirebaseAppSafe() {
  if (!ensureFirebaseApp() || !appModule) return null;
  try {
    return appModule.app();
  } catch (error) {
    console.warn('[Firebase] getApp failed:', error?.message || error);
    return null;
  }
}

export default {
  ensureFirebaseApp,
  waitForFirebaseApp,
  getFirebaseAppSafe,
  isFirebaseAppReady,
  getFirebaseInitError,
};

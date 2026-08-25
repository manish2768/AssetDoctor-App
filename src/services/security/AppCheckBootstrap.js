/**
 * Optional Firebase App Check bootstrap.
 * Does not weaken security if the native module is missing — skips silently.
 * Enable enforcement in Firebase Console after Play Integrity / DeviceCheck are configured.
 */

let initialized = false;

export async function initializeAppCheckIfAvailable() {
  if (initialized) return { ok: true, skipped: false };
  try {
    // eslint-disable-next-line global-require
    const appCheck = require('@react-native-firebase/app-check').default;
    // eslint-disable-next-line global-require
    const app = require('@react-native-firebase/app').default;
    if (!appCheck || !app?.apps?.length) {
      return { ok: false, skipped: true, reason: 'module_or_app_unavailable' };
    }
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: { provider: __DEV__ ? 'debug' : 'playIntegrity' },
      apple: { provider: __DEV__ ? 'debug' : 'deviceCheck' },
    });
    await appCheck().initializeAppCheck({
      provider,
      isTokenAutoRefreshEnabled: true,
    });
    initialized = true;
    return { ok: true, skipped: false };
  } catch (e) {
    return {
      ok: false,
      skipped: true,
      reason: e?.message || 'app_check_unavailable',
    };
  }
}

export default { initializeAppCheckIfAvailable };

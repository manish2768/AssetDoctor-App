/**
 * Firebase Crashlytics — graceful when native module missing (Expo Go / old APK).
 */

let crashlyticsModule = null;
let globalHandlerInstalled = false;

function getCrashlytics() {
  if (crashlyticsModule === false) return null;
  if (crashlyticsModule) return crashlyticsModule;
  try {
    // eslint-disable-next-line global-require
    crashlyticsModule = require('@react-native-firebase/crashlytics').default;
    return crashlyticsModule;
  } catch {
    crashlyticsModule = false;
    return null;
  }
}

function safeRun(fn) {
  try {
    const crashlytics = getCrashlytics();
    if (!crashlytics) return false;
    fn(crashlytics());
    return true;
  } catch (error) {
    console.warn('[Crashlytics]', error?.message || error);
    return false;
  }
}

function installGlobalHandler(c) {
  if (globalHandlerInstalled) return;
  try {
    const { ErrorUtils } = global;
    if (!ErrorUtils?.getGlobalHandler || !ErrorUtils?.setGlobalHandler) return;
    const prev = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      try {
        c.setAttribute('js_fatal', String(Boolean(isFatal)));
        c.recordError(error instanceof Error ? error : new Error(String(error)));
      } catch {
        /* ignore */
      }
      if (typeof prev === 'function') prev(error, isFatal);
    });
    globalHandlerInstalled = true;
  } catch {
    /* ignore */
  }
}

export const CrashlyticsService = {
  init() {
    return safeRun((c) => {
      c.setCrashlyticsCollectionEnabled(true);
      c.log('Asset Doctor Crashlytics ready');
      installGlobalHandler(c);
    });
  },

  /** Identify session for decoded crash reports */
  setUser(user) {
    return safeRun((c) => {
      if (!user?.uid) {
        c.setUserId('');
        return;
      }
      c.setUserId(String(user.uid));
      if (user.email) c.setAttribute('email', String(user.email).slice(0, 64));
      if (user.phoneNumber) c.setAttribute('phone', String(user.phoneNumber).slice(0, 32));
      c.log(`session_user:${user.uid}`);
    });
  },

  clearUser() {
    return safeRun((c) => {
      c.setUserId('');
      c.log('session_user:signed_out');
    });
  },

  log(message) {
    return safeRun((c) => c.log(String(message || '').slice(0, 500)));
  },

  recordError(error, context = {}) {
    const recorded = safeRun((c) => {
      if (context && typeof context === 'object') {
        Object.entries(context).forEach(([key, value]) => {
          if (value == null) return;
          c.setAttribute(String(key).slice(0, 40), String(value).slice(0, 100));
        });
      }
      const err =
        error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : 'Unknown error');
      c.recordError(err);
    });

    // Best-effort alert email for fatal / support triage
    if (context?.alertEmail !== false && (context?.fatal || context?.notifySupport)) {
      try {
        // eslint-disable-next-line global-require
        const firestore = require('@react-native-firebase/firestore').default;
        const message =
          error instanceof Error ? error.message : String(error || 'Unknown crash');
        firestore()
          .collection('mail_queue')
          .add({
            to: ['support@assetdoctor.in'],
            message: {
              subject: `[Asset Doctor Crash] ${String(message).slice(0, 80)}`,
              text: `Crashlytics alert\n\n${message}\n\nContext: ${JSON.stringify(context || {})}\nTime: ${new Date().toISOString()}`,
            },
            createdAt: firestore.FieldValue.serverTimestamp(),
          })
          .catch(() => {});
      } catch {
        /* ignore mail enqueue failures */
      }
    }
    return recorded;
  },
};

export default CrashlyticsService;

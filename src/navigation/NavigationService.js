/**
 * Global navigation service — hard resets for Auth ↔ App switches.
 * Prefer this over ad-hoc navigate() after logout / login.
 */

import { CommonActions } from '@react-navigation/native';

import { navigationRef } from './navActions';

function whenReady(fn, attempt = 0) {
  try {
    if (navigationRef.isReady()) {
      fn();
      return true;
    }
  } catch (e) {
    console.warn('[NavigationService]', e?.message || e);
  }
  if (attempt >= 12) return false;
  setTimeout(() => whenReady(fn, attempt + 1), 80 + attempt * 40);
  return false;
}

/**
 * Hard reset to Auth Login (post Sign Out).
 * Works with AuthSwitch when the Auth stack is mounted.
 */
export function resetToLogin(params = {}) {
  return whenReady(() => {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login', params }],
      }),
    );
  });
}

/** Hard reset into the main app (post successful sign-in). */
export function resetToMainApp() {
  return whenReady(() => {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              routes: [
                {
                  name: 'Home',
                  state: { routes: [{ name: 'Dashboard' }], index: 0 },
                },
              ],
              index: 0,
            },
          },
        ],
      }),
    );
  });
}

/** Alias used by older call sites. */
export function resetRoot(routeName, params) {
  return whenReady(() => {
    navigationRef.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: routeName, params }],
      }),
    );
  });
}

export function navigate(name, params) {
  return whenReady(() => {
    navigationRef.navigate(name, params);
  });
}

export function goBack() {
  return whenReady(() => {
    if (navigationRef.canGoBack()) navigationRef.goBack();
  });
}

export const NavigationService = {
  resetToLogin,
  resetToMainApp,
  resetRoot,
  navigate,
  goBack,
  get ref() {
    return navigationRef;
  },
};

export default NavigationService;

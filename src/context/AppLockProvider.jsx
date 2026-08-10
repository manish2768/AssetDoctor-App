/**
 * App lock gate — phone PIN / pattern / biometric before vault UI.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, View, ActivityIndicator } from 'react-native';

import { AppLockScreen } from '../screens/security/AppLockScreen';
import { AppLockService } from '../services/security/AppLockService';
import { COLORS } from '../theme/branding';
import { Haptics } from '../services/haptics';

const AppLockContext = createContext({
  locked: false,
  enabled: true,
  canUseDeviceLock: false,
  securityLabel: 'Phone PIN / pattern',
  unlock: async () => ({ success: false }),
  setAppLockEnabled: async () => ({ success: false }),
  refresh: async () => {},
});

export function useAppLock() {
  return useContext(AppLockContext);
}

export function AppLockProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [locked, setLocked] = useState(true);
  const [canUseDeviceLock, setCanUse] = useState(false);
  const [missingEnrollment, setMissingEnrollment] = useState(false);
  const [securityLabel, setSecurityLabel] = useState('Phone PIN / pattern');
  const backgroundAt = useRef(null);

  const refresh = useCallback(async () => {
    const nativeOk = AppLockService.isNativeAvailable();
    if (!nativeOk) {
      setEnabled(false);
      setLocked(false);
      setCanUse(false);
      setMissingEnrollment(false);
      setSecurityLabel('Install latest APK for App Lock');
      return { on: false, enrolled: false };
    }
    const [on, enrolled, label] = await Promise.all([
      AppLockService.isEnabled(),
      AppLockService.canUseDeviceLock(),
      AppLockService.getSecurityLabel(),
    ]);
    setEnabled(on);
    setCanUse(enrolled);
    setSecurityLabel(label);
    setMissingEnrollment(on && !enrolled);
    if (!on) {
      setLocked(false);
    } else {
      setLocked(true);
    }
    return { on, enrolled };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Re-lock after background (bank-app style)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        backgroundAt.current = Date.now();
        return;
      }
      if (next !== 'active') return;
      const leftAt = backgroundAt.current;
      backgroundAt.current = null;
      if (!enabled) return;
      const elapsed = leftAt ? Date.now() - leftAt : AppLockService.BACKGROUND_LOCK_MS;
      if (elapsed >= AppLockService.BACKGROUND_LOCK_MS) {
        setLocked(true);
        setMissingEnrollment(!canUseDeviceLock);
      }
    });
    return () => sub.remove();
  }, [enabled, canUseDeviceLock]);

  const unlock = useCallback(async () => {
    if (!enabled) {
      setLocked(false);
      return { success: true };
    }
    const result = await AppLockService.authenticate({
      reason: 'Unlock Asset Doctor vault',
    });
    if (result.success) {
      setLocked(false);
      setMissingEnrollment(false);
      Haptics.success();
    } else if (result.missingEnrollment) {
      setMissingEnrollment(true);
      setLocked(true);
    }
    return result;
  }, [enabled]);

  const setAppLockEnabled = useCallback(async (nextEnabled) => {
    // Confirm with device lock before changing preference
    if (nextEnabled) {
      const enrolled = await AppLockService.canUseDeviceLock();
      if (!enrolled) {
        return {
          success: false,
          missingEnrollment: true,
          error:
            'Set a PIN, pattern, or password in phone Settings before enabling App Lock.',
        };
      }
      const auth = await AppLockService.authenticate({
        reason: 'Confirm to enable App Lock',
      });
      if (!auth.success) return auth;
      await AppLockService.setEnabled(true);
      setEnabled(true);
      setCanUse(true);
      setMissingEnrollment(false);
      setLocked(false);
      Haptics.success();
      return { success: true };
    }

    const auth = await AppLockService.authenticate({
      reason: 'Confirm to turn off App Lock',
    });
    if (!auth.success) return auth;
    await AppLockService.setEnabled(false);
    setEnabled(false);
    setLocked(false);
    setMissingEnrollment(false);
    Haptics.success();
    return { success: true };
  }, []);

  const onUnlocked = useCallback(() => {
    setLocked(false);
    setMissingEnrollment(false);
  }, []);

  const value = useMemo(
    () => ({
      locked: enabled && locked,
      enabled,
      canUseDeviceLock,
      securityLabel,
      unlock,
      setAppLockEnabled,
      refresh,
    }),
    [
      locked,
      enabled,
      canUseDeviceLock,
      securityLabel,
      unlock,
      setAppLockEnabled,
      refresh,
    ],
  );

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.emerald} />
      </View>
    );
  }

  return (
    <AppLockContext.Provider value={value}>
      {enabled && locked ? (
        <AppLockScreen
          missingEnrollment={missingEnrollment}
          onUnlocked={onUnlocked}
        />
      ) : (
        children
      )}
    </AppLockContext.Provider>
  );
}

export default AppLockProvider;

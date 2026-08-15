/**
 * Full-screen gate — unlock with phone PIN / pattern / biometrics.
 * Biometric prompt runs at most once per lock session (no vibration loops).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Linking,
  Platform,
  AppState,
  Vibration,
} from 'react-native';

import { GlassButton } from '../../components/ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { AppLockService } from '../../services/security/AppLockService';

export function AppLockScreen({ onUnlocked, missingEnrollment }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('Phone PIN / pattern');
  const isAuthenticatingRef = useRef(false);
  const hasTriggeredBiometrics = useRef(false);
  const onUnlockedRef = useRef(onUnlocked);
  onUnlockedRef.current = onUnlocked;

  useEffect(() => {
    AppLockService.getSecurityLabel().then(setLabel).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const backgroundAt = { current: null };

    const tryUnlock = async ({ force = false } = {}) => {
      if (cancelled || missingEnrollment) return;
      if (isAuthenticatingRef.current) return;
      if (!force && hasTriggeredBiometrics.current) return;

      isAuthenticatingRef.current = true;
      hasTriggeredBiometrics.current = true;
      setBusy(true);
      setError('');

      try {
        const result = await AppLockService.authenticate({
          reason: 'Unlock Asset Doctor vault',
        });
        if (cancelled) return;
        setBusy(false);
        if (result.success) {
          Haptics.success();
          onUnlockedRef.current?.();
          return;
        }
        if (result.missingEnrollment) {
          setError(result.error);
          return;
        }
        if (result.error && result.error !== 'Authentication cancelled') {
          Haptics.error();
          setError(result.error);
        }
      } catch (e) {
        if (!cancelled) {
          setBusy(false);
          setError(e?.message || 'Unlock failed');
        }
      } finally {
        isAuthenticatingRef.current = false;
        try {
          Vibration.cancel();
        } catch {
          /* ignore */
        }
      }
    };

    // Single auto-prompt on mount only — never re-fire from biometric UI AppState churn
    tryUnlock({ force: false });

    const sub = AppState.addEventListener('change', (state) => {
      // Never treat `inactive` as left — biometric sheets / nav overlays would re-prompt
      if (state === 'background') {
        if (!backgroundAt.current) backgroundAt.current = Date.now();
        return;
      }
      if (state === 'inactive') return;
      if (state !== 'active') return;
      const leftAt = backgroundAt.current;
      backgroundAt.current = null;
      if (!leftAt || isAuthenticatingRef.current) return;
      // Only re-prompt after a real background (≥3s), not dialog flicker
      if (Date.now() - leftAt < 3000) return;
      hasTriggeredBiometrics.current = false;
      tryUnlock({ force: true });
    });

    return () => {
      cancelled = true;
      isAuthenticatingRef.current = false;
      sub.remove();
      try {
        Vibration.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [missingEnrollment]);

  const onUnlockPress = async () => {
    if (isAuthenticatingRef.current) return;
    Haptics.tap();
    isAuthenticatingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await AppLockService.authenticate({
        reason: 'Unlock Asset Doctor vault',
      });
      setBusy(false);
      if (result.success) {
        Haptics.success();
        onUnlockedRef.current?.();
        return;
      }
      if (result.missingEnrollment) {
        setError(result.error);
        return;
      }
      Haptics.error();
      setError(result.error || 'Unlock failed');
    } finally {
      isAuthenticatingRef.current = false;
      try {
        Vibration.cancel();
      } catch {
        /* ignore */
      }
    }
  };

  const openSecuritySettings = () => {
    Haptics.tap();
    if (Platform.OS === 'android') {
      Linking.sendIntent?.('android.settings.SECURITY_SETTINGS').catch(() => {
        Linking.openSettings().catch(() => {});
      });
    } else {
      Linking.openURL('App-Prefs:PASSCODE').catch(() => Linking.openSettings());
    }
  };

  return (
    <View style={styles.root}>
      <Image
        source={require('../../../assets/icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.brand}>{BRAND.name}</Text>
      <Text style={styles.title}>Vault locked</Text>
      <Text style={styles.sub}>
        {missingEnrollment
          ? 'Set a PIN, pattern, or password on this phone to protect your documents.'
          : `Unlock with your ${label.toLowerCase()} to open the vault.`}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {missingEnrollment ? (
        <GlassButton
          title="Open phone security settings"
          onPress={openSecuritySettings}
          style={{ marginTop: SPACING.lg, alignSelf: 'stretch' }}
        />
      ) : (
        <GlassButton
          title="Unlock with phone lock"
          onPress={onUnlockPress}
          loading={busy}
          style={{ marginTop: SPACING.lg, alignSelf: 'stretch' }}
        />
      )}
    </View>
  );
}

export default AppLockScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  logo: { width: 88, height: 88, alignSelf: 'center', marginBottom: 12 },
  brand: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  title: {
    color: COLORS.emerald,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 20,
  },
  sub: {
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    fontSize: 14,
    paddingHorizontal: 8,
  },
  error: {
    color: COLORS.rose,
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
  },
});

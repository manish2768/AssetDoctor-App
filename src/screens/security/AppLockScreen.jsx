/**
 * Full-screen gate — unlock with phone PIN / pattern / biometrics.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Linking,
  Platform,
  AppState,
} from 'react-native';

import { GlassButton } from '../../components/ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { AppLockService } from '../../services/security/AppLockService';

export function AppLockScreen({ onUnlocked, missingEnrollment }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('Phone PIN / pattern');

  useEffect(() => {
    AppLockService.getSecurityLabel().then(setLabel).catch(() => {});
  }, []);

  // Auto-prompt once when screen mounts / app returns to foreground while locked
  useEffect(() => {
    let cancelled = false;
    const tryUnlock = async () => {
      if (missingEnrollment || cancelled) return;
      setBusy(true);
      setError('');
      const result = await AppLockService.authenticate({
        reason: 'Unlock Asset Doctor vault',
      });
      if (cancelled) return;
      setBusy(false);
      if (result.success) {
        Haptics.success();
        onUnlocked?.();
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
    };

    tryUnlock();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tryUnlock();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [missingEnrollment, onUnlocked]);

  const onUnlockPress = async () => {
    Haptics.tap();
    setBusy(true);
    setError('');
    const result = await AppLockService.authenticate({
      reason: 'Unlock Asset Doctor vault',
    });
    setBusy(false);
    if (result.success) {
      Haptics.success();
      onUnlocked?.();
      return;
    }
    if (result.missingEnrollment) {
      setError(result.error);
      return;
    }
    Haptics.error();
    setError(result.error || 'Unlock failed');
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

export default AppLockScreen;

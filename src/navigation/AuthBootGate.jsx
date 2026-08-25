/**
 * Auth boot gate — never infinite spinner.
 * After 3s shows Retry instead of looping "Loading your vault…".
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

import { GlassButton } from '../components/ui/Glass';
import { COLORS, SPACING } from '../theme/branding';
import { Haptics } from '../services/haptics';

const BOOT_TIMEOUT_MS = 3000;

export function AuthBootGate({ loading, onRetry, onContinueAnyway }) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return undefined;
    }
    setTimedOut(false);
    const t = setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loading]);

  if (!loading) return null;

  return (
    <View style={styles.wrap}>
      {!timedOut ? (
        <>
          <ActivityIndicator color={COLORS.emerald} size="large" />
          <Text style={styles.title}>Loading your vault…</Text>
          <Text style={styles.sub}>Syncing your secure profile</Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>Taking longer than usual</Text>
          <Text style={styles.sub}>
            Check your connection, then retry — or continue with cached data.
          </Text>
          <GlassButton
            title="Retry"
            style={{ marginTop: SPACING.md, alignSelf: 'stretch' }}
            onPress={() => {
              Haptics.tap();
              setTimedOut(false);
              onRetry?.();
            }}
          />
          <GlassButton
            title="Continue anyway"
            variant="ghost"
            style={{ marginTop: SPACING.sm, alignSelf: 'stretch' }}
            onPress={() => {
              Haptics.select();
              onContinueAnyway?.();
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  sub: {
    color: COLORS.muted,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  },
});

export default AuthBootGate;

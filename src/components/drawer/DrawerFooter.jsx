/**
 * Asset Doctor — Drawer Footer Component
 * Version stamp, security status & authentication action.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { FONTS } from '../../theme/branding';
import { RADIUS } from '../../theme/tokens';

export function DrawerFooter({ onAuthAction }) {
  const { isAuthenticated, signOut } = useAuth();
  const colors = useThemeColors();

  const handleAuthPress = async () => {
    Haptics.impactLight();
    if (isAuthenticated) {
      try {
        await signOut?.();
      } catch (e) {
        console.warn('[DrawerFooter] Sign out error:', e);
      }
    } else {
      onAuthAction?.();
    }
  };

  return (
    <View style={[styles.container, { borderTopColor: colors.border || '#E2E8F0' }]}>
      <View style={styles.topRow}>
        <View style={styles.securityBadge}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={[styles.securityText, { color: colors.textMuted || '#64748B' }]}>
            End-to-End Encrypted Vault
          </Text>
        </View>

        <Pressable
          onPress={handleAuthPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.authBtn,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isAuthenticated ? 'Sign Out of Account' : 'Sign In to Account'}
        >
          <Text style={[styles.authBtnText, { color: isAuthenticated ? '#EF4444' : '#059669' }]}>
            {isAuthenticated ? 'Sign Out' : 'Sign In'}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.versionText, { color: colors.textMuted || '#94A3B8' }]}>
        Asset Doctor v1.0.67 (122) · Universal Intelligence Platform
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 22,
    borderTopWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockEmoji: {
    fontSize: 12,
    marginRight: 5,
  },
  securityText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  authBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  authBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 11.5,
    fontWeight: '700',
  },
  versionText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
});

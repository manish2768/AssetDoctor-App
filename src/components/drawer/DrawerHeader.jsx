/**
 * Asset Doctor — Drawer Header Component
 * Displays branding logo, product tagline, user profile info, and live vault status.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { FONTS } from '../../theme/branding';
import { RADIUS } from '../../theme/tokens';
import { AppLogo } from '../AppLogo';

function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function DrawerHeader({ onClose, onProfilePress }) {
  const { displayName, user, isAuthenticated } = useAuth();
  const { assets } = useAssets();
  const colors = useThemeColors();

  const activeAssets = (assets || []).filter((a) => !a.isArchived);
  const assetCount = activeAssets.length;
  const assetCountLabel = assetCount === 1 ? '1 Asset' : `${assetCount} Assets`;
  const nameDisplay = isAuthenticated ? (displayName || 'Vault Owner') : 'Guest Explorer';

  return (
    <View style={[styles.container, { borderBottomColor: colors.border || '#E2E8F0' }]}>
      {/* Top row: Brand & Close Button */}
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <AppLogo size={36} />
          <View style={styles.brandTextWrap}>
            <View style={styles.titleRow}>
              <Text style={[styles.brandTitle, { color: colors.text || '#0F172A' }]}>
                Asset<Text style={styles.brandAccent}>Doctor</Text>
              </Text>
              <View style={styles.vaultPill}>
                <Text style={styles.vaultPillText}>VAULT</Text>
              </View>
            </View>
            <Text style={[styles.tagline, { color: colors.textMuted || '#64748B' }]} numberOfLines={1}>
              INTELLIGENCE PLATFORM
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            Haptics.tap();
            onClose?.();
          }}
          hitSlop={12}
          style={({ pressed }) => [
            styles.closeBtn,
            { backgroundColor: colors.surfaceSubtle || '#F1F5F9' },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Close navigation drawer"
        >
          <Text style={[styles.closeIcon, { color: colors.text || '#334155' }]}>×</Text>
        </Pressable>
      </View>

      {/* Bottom Profile & Vault Status Card */}
      <Pressable
        onPress={() => {
          Haptics.tap();
          onProfilePress?.();
        }}
        style={({ pressed }) => [
          styles.profileCard,
          {
            backgroundColor: colors.card || '#F8FAFC',
            borderColor: colors.border || '#E2E8F0',
          },
          pressed && { opacity: 0.9 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`User profile: ${nameDisplay}, ${assetCountLabel}`}
      >
        <View style={styles.avatar}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initialsFromName(nameDisplay)}</Text>
          )}
        </View>

        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text || '#0F172A' }]} numberOfLines={1}>
            {nameDisplay}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.assetCountText, { color: colors.textMuted || '#64748B' }]}>
              {assetCountLabel}
            </Text>
            <Text style={styles.metaDot}>•</Text>
            <View style={styles.statusIndicator}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Vault Protected</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.profileChevron, { color: colors.textMuted || '#94A3B8' }]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  brandTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandAccent: {
    color: '#14B8A6',
  },
  vaultPill: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: RADIUS.full,
    marginLeft: 6,
  },
  vaultPillText: {
    fontSize: 9,
    fontFamily: FONTS.bold,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.6,
  },
  tagline: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 13,
    fontWeight: '700',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '800',
  },
  profileInfo: {
    marginLeft: 11,
    flex: 1,
  },
  profileName: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  assetCountText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  metaDot: {
    color: '#94A3B8',
    marginHorizontal: 5,
    fontSize: 11,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981', // Emerald active
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: FONTS.semibold,
    fontWeight: '600',
    color: '#059669',
  },
  profileChevron: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 6,
  },
});

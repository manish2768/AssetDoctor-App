/**
 * Asset Doctor — Drawer Item Component
 * High-touch, accessible row with rounded icon container, title, subtitle & badge.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PremiumIcon } from '../../design-system/icons';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { FONTS } from '../../theme/branding';
import { RADIUS } from '../../theme/tokens';

export function DrawerItem({
  icon,
  label,
  subtitle,
  badge,
  badgeColor,
  isActive = false,
  onPress,
}) {
  const colors = useThemeColors();
  const isEmoji = typeof icon === 'string' && /[^\x00-\x7F]/.test(icon);

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.container,
        isActive && {
          backgroundColor: colors.accentLight,
        },
        pressed && {
          opacity: 0.9,
          transform: [{ scale: 0.99 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={`${label}${subtitle ? `: ${subtitle}` : ''}${badge ? `, ${badge}` : ''}`}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: isActive ? colors.accentLight : colors.surfaceMuted },
        ]}
      >
        {isEmoji ? (
          <Text style={styles.iconText}>{icon}</Text>
        ) : (
          <PremiumIcon name={icon} size={18} color={isActive ? colors.primary : colors.text} />
        )}
      </View>

      <View style={styles.contentWrap}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.label,
              { color: colors.text || '#0F172A' },
              isActive && { color: '#059669', fontWeight: '800' },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {badge != null ? (
            <View
              style={[
                styles.badgePill,
                badgeColor ? { backgroundColor: badgeColor } : null,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  badgeColor ? { color: '#FFFFFF' } : null,
                ]}
              >
                {badge}
              </Text>
            </View>
          ) : null}
        </View>

        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: colors.textMuted || '#64748B' }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginVertical: 1.5,
    borderRadius: RADIUS.lg,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  iconBoxActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.15)',
  },
  iconText: {
    fontSize: 16,
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: FONTS.bold,
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.1,
    flex: 1,
  },
  badgePill: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    fontWeight: '800',
    color: '#059669',
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    marginTop: 1.5,
    lineHeight: 14,
  },
});

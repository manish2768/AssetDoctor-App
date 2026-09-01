/**
 * Reusable Asset Doctor Protected badge (mobile).
 * No emoji. Uses existing PremiumIcon stroke set.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { PremiumIcon } from '../../design-system/icons';
import { TYPE, RADIUS, SPACING } from '../../theme/tokens';
import { BADGE_STATES } from '../../trust/protectionStatus';

export function AssetDoctorProtectedBadge({ state, compact = false, style }) {
  const colors = useThemeColors();
  const resolved = state && state.id && BADGE_STATES[state.id] ? BADGE_STATES[state.id] : state;
  const id = resolved?.id || 'INCOMPLETE';
  const label = resolved?.label || BADGE_STATES.INCOMPLETE.label;

  const palettes = {
    PROTECTED: {
      bg: colors.heroSurface || colors.midnight || '#07111F',
      fg: colors.electricTeal || '#10B981',
      icon: 'shield-check',
    },
    ACTION_REQUIRED: {
      bg: colors.errorSoft || 'rgba(239,68,68,0.12)',
      fg: colors.danger || '#EF4444',
      icon: 'alert',
    },
    EXPIRING: {
      bg: colors.warningSoft || 'rgba(245,158,11,0.12)',
      fg: colors.warning || '#F59E0B',
      icon: 'clock',
    },
    REVIEW_REQUIRED: {
      bg: colors.warningSoft || 'rgba(245,158,11,0.12)',
      fg: colors.warning || '#F59E0B',
      icon: 'alert',
    },
    INCOMPLETE: {
      bg: colors.surfaceMuted || 'rgba(148,163,184,0.12)',
      fg: colors.textMuted || '#94A3B8',
      icon: 'shield',
    },
  };
  const pal = palettes[id] || palettes.INCOMPLETE;

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.compact,
        { backgroundColor: pal.bg, borderColor: pal.fg },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <PremiumIcon name={pal.icon} size={compact ? 12 : 14} color={pal.fg} />
      <Text style={[compact ? TYPE.micro : TYPE.caption, styles.label, { color: pal.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    minHeight: 28,
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    minHeight: 22,
    gap: 4,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default AssetDoctorProtectedBadge;

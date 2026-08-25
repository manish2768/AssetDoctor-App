/**
 * SmartActionCard — premium actionable attention card (mobile UI only).
 * Presentation: title, why, metric, primary CTA.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useThemeColors } from '../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT, elevation } from '../theme/tokens';
import { StatusBadge } from './ui/DesignSystem';
import { Haptics } from '../services/haptics';

/**
 * @param {{
 *  title: string,
 *  why?: string,
 *  metric?: string,
 *  priority?: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'|'INFO',
 *  ctaLabel?: string,
 *  onPress?: () => void,
 *  onCta?: () => void,
 *  style?: object,
 * }} props
 */
export function SmartActionCard({
  title,
  why,
  metric,
  priority = 'MEDIUM',
  ctaLabel = 'View',
  onPress,
  onCta,
  style,
}) {
  const colors = useThemeColors();
  if (!title) return null;

  const tone =
    priority === 'CRITICAL' || priority === 'HIGH'
      ? 'error'
      : priority === 'LOW' || priority === 'INFO'
        ? 'info'
        : 'warning';

  const handle = () => {
    Haptics.tap();
    (onCta || onPress)?.();
  };

  return (
    <Pressable
      onPress={handle}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${why || ''}. ${metric || ''}`}
    >
      <View style={styles.head}>
        <Text style={[TYPE.label, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
          {(title || '').toUpperCase()}
        </Text>
        <StatusBadge
          label={
            priority === 'CRITICAL'
              ? 'Critical'
              : priority === 'HIGH'
                ? 'Important'
                : priority === 'LOW'
                  ? 'Info'
                  : 'Attention'
          }
          tone={tone}
        />
      </View>
      {why ? (
        <Text style={[TYPE.body, { color: colors.text, marginTop: 6 }]} numberOfLines={3}>
          {why}
        </Text>
      ) : null}
      {metric ? (
        <Text style={[TYPE.metric, { color: colors.primary, fontSize: 22, marginTop: 8 }]}>
          {metric}
        </Text>
      ) : null}
      {ctaLabel ? (
        <View style={[styles.cta, { backgroundColor: colors.infoSoft || colors.surfaceMuted }]}>
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '800' }]}>
            {ctaLabel} →
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    minHeight: HIT.min,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cta: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
});

export default SmartActionCard;

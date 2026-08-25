/**
 * InsightActionCard — WHAT / WHY / WHAT TO DO presentation (Phase E).
 * Presentation only — no invented insights.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT, elevation } from '../../theme/tokens';
import { StatusBadge } from './DesignSystem';
import { Haptics } from '../../services/haptics';

/**
 * @param {{
 *  what?: string,
 *  why?: string,
 *  whatShouldIDo?: string,
 *  priority?: string,
 *  ctaLabel?: string,
 *  onCta?: () => void,
 *  style?: object,
 * }} props
 */
export function InsightActionCard({
  what,
  why,
  whatShouldIDo,
  priority = 'MEDIUM',
  ctaLabel,
  onCta,
  style,
}) {
  const colors = useThemeColors();
  if (!what && !why) return null;

  const tone =
    priority === 'CRITICAL' || priority === 'HIGH'
      ? 'error'
      : priority === 'LOW'
        ? 'neutral'
        : 'warning';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${what || 'Insight'}. ${why || ''}. ${whatShouldIDo || ''}`}
    >
      <View style={styles.head}>
        <Text style={[TYPE.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={3}>
          {what || 'Insight'}
        </Text>
        <StatusBadge label={String(priority || 'INFO')} tone={tone} />
      </View>
      {why ? (
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 8 }]}>
          Why: {why}
        </Text>
      ) : null}
      {whatShouldIDo ? (
        <Text style={[TYPE.caption, { color: colors.text, marginTop: 6, fontWeight: '600' }]}>
          What to do: {whatShouldIDo}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <Pressable
          onPress={() => {
            Haptics.tap();
            onCta();
          }}
          style={[styles.cta, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[TYPE.caption, { color: colors.textOnPrimary, fontWeight: '800' }]}>
            {ctaLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cta: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    minHeight: HIT.min,
    justifyContent: 'center',
  },
});

export default InsightActionCard;

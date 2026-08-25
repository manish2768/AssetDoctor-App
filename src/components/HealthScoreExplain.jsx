/**
 * Explainable Health Score — score + label + factor breakdown.
 * Never invents metrics; only displays factors passed in.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useThemeColors } from '../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, elevation } from '../theme/tokens';
import { StatusBadge } from './ui/DesignSystem';

/**
 * @param {object} props
 * @param {number|null|undefined} props.score — 0–100; null/undefined = unknown
 * @param {string} [props.label] — e.g. Healthy / Needs attention
 * @param {{ id: string, label: string, status: string, tone?: string }[]} [props.factors]
 * @param {string} [props.footnote]
 */
export function HealthScoreExplain({ score, label, factors = [], footnote, style }) {
  const colors = useThemeColors();
  const numeric = Number.isFinite(Number(score)) ? Math.round(Number(score)) : null;
  const derivedLabel =
    label ||
    (numeric == null
      ? 'Not scored'
      : numeric >= 80
        ? 'Healthy'
        : numeric >= 60
          ? 'Fair'
          : numeric >= 40
            ? 'Needs attention'
            : 'Critical');

  const tone =
    numeric == null
      ? 'neutral'
      : numeric >= 80
        ? 'success'
        : numeric >= 60
          ? 'info'
          : numeric >= 40
            ? 'warning'
            : 'error';

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Health score ${numeric ?? 'unknown'}, ${derivedLabel}`}
    >
      <View style={styles.top}>
        <View>
          <Text style={[TYPE.label, { color: colors.textMuted }]}>HEALTH SCORE</Text>
          <Text style={[TYPE.metric, { color: colors.text, marginTop: 4 }]}>
            {numeric == null ? '—' : numeric}
          </Text>
        </View>
        <StatusBadge label={derivedLabel} tone={tone} />
      </View>

      {factors.length > 0 ? (
        <View style={styles.factors}>
          {factors.map((f) => (
            <View key={f.id || f.label} style={styles.factorRow}>
              <Text style={[TYPE.caption, { color: colors.text, flex: 1 }]}>{f.label}</Text>
              <StatusBadge label={f.status} tone={f.tone || 'neutral'} />
            </View>
          ))}
        </View>
      ) : null}

      {footnote ? (
        <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: SPACING.sm }]}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  factors: {
    marginTop: SPACING.md,
    gap: 8,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default HealthScoreExplain;

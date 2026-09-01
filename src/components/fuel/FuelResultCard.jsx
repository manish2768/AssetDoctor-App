/**
 * Fuel & Mileage - Instant Result Card
 *
 * Shows the computed mileage / cost-per-km / distance for the entry currently
 * being typed, BEFORE it is saved. Reuses the same trusted calculation engine
 * the service will persist, so the preview never fabricates anything.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../context/ThemeProvider';
import { SPACING, TYPE, RADIUS } from '../../theme/tokens';

function fmt(v, decimals = 1) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toFixed(decimals);
}

export function FuelResultCard({ result }) {
  const colors = useThemeColors();
  if (!result) return null;

  const ref = result.result || {};
  const verdict = ref.verdict || null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[TYPE.label, styles.heading, { color: colors.textMuted }]}>
        INSTANT FUEL PREVIEW
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>Mileage</Text>
          <Text style={[TYPE.h3, { color: colors.text }]}>
            {ref.mileage != null ? `${fmt(ref.mileage)}` : '—'}
            <Text style={[TYPE.caption, { color: colors.textMuted }]}> km/L</Text>
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>Cost / km</Text>
          <Text style={[TYPE.h3, { color: colors.text }]}>
            {ref.costPerKm != null ? `₹${fmt(ref.costPerKm, 2)}` : '—'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>Distance</Text>
          <Text style={[TYPE.h3, { color: colors.text }]}>
            {ref.distanceSincePrevious != null ? `${fmt(ref.distanceSincePrevious, 0)} km` : '—'}
          </Text>
        </View>
      </View>

      {ref.isFirstEntry ? (
        <Text style={[TYPE.caption, { color: colors.warning || '#D97706', marginTop: 8 }]}>
          First fuel entry — mileage unlocks after the next full-tank refill.
        </Text>
      ) : null}

      {ref.needsNextFullTank ? (
        <Text style={[TYPE.caption, { color: colors.warning || '#D97706', marginTop: 6 }]}>
          Mark this as a full-tank refill (and the previous one) to get real mileage.
        </Text>
      ) : null}

      {verdict ? (
        <View style={styles.verdictRow}>
          <Text style={styles.verdictEmoji}>{verdict.emoji}</Text>
          <Text style={[TYPE.bodyStrong, { color: colors.text }]}>{verdict.label}</Text>
        </View>
      ) : null}

      {ref.flaggedMileage ? (
        <Text style={[TYPE.caption, { color: colors.danger || '#DC2626', marginTop: 6 }]}>
          Mileage value outside a realistic range — not displayed.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  heading: {
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  verdictEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
});

export default FuelResultCard;

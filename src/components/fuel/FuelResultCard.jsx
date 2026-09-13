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

import { Pressable } from 'react-native';

function fmt(v, decimals = 1) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return Number(v).toFixed(decimals);
}

export function FuelResultCard({ result, onCorrectOdometer }) {
  const colors = useThemeColors();
  if (!result) return null;

  const ref = result.result || {};
  const validation = result.validation || {};
  const verdict = ref.verdict || null;
  const isRegression = Boolean(validation.odometerRegression);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: isRegression ? (colors.danger || '#EF4444') : colors.border }]}>
      <Text style={[TYPE.label, styles.heading, { color: isRegression ? (colors.danger || '#EF4444') : colors.textMuted }]}>
        {isRegression ? '⚠️ ODOMETER ERROR' : 'INSTANT FUEL PREVIEW'}
      </Text>

      {isRegression ? (
        <View style={[styles.regressionBox, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
          <Text style={[TYPE.bodyStrong, { color: colors.danger || '#EF4444' }]}>
            Odometer reading cannot be lower than the previous reading.
          </Text>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonItem}>
              <Text style={[TYPE.micro, { color: colors.textMuted }]}>PREVIOUS READING</Text>
              <Text style={[TYPE.bodyStrong, { color: colors.text }]}>
                {validation.previousOdometerKM != null ? `${Number(validation.previousOdometerKM).toLocaleString('en-IN')} km` : '—'}
              </Text>
            </View>
            <View style={styles.comparisonItem}>
              <Text style={[TYPE.micro, { color: colors.textMuted }]}>ENTERED READING</Text>
              <Text style={[TYPE.bodyStrong, { color: colors.danger || '#EF4444' }]}>
                {validation.enteredOdometerKM != null ? `${Number(validation.enteredOdometerKM).toLocaleString('en-IN')} km` : '—'}
              </Text>
            </View>
          </View>
          {onCorrectOdometer ? (
            <Pressable
              onPress={onCorrectOdometer}
              style={[styles.correctBtn, { backgroundColor: colors.danger || '#EF4444' }]}
              accessibilityRole="button"
              accessibilityLabel="Correct Reading"
            >
              <Text style={styles.correctBtnText}>Correct Reading</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>Mileage</Text>
          <Text style={[TYPE.h3, { color: colors.text }]}>
            {!isRegression && ref.mileage != null && ref.mileage > 0 ? `${fmt(ref.mileage)}` : '—'}
            <Text style={[TYPE.caption, { color: colors.textMuted }]}> km/L</Text>
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>Cost / km</Text>
          <Text style={[TYPE.h3, { color: colors.text }]}>
            {!isRegression && ref.costPerKm != null && ref.costPerKm > 0 ? `₹${fmt(ref.costPerKm, 2)}` : '—'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>Distance</Text>
          <Text style={[TYPE.h3, { color: colors.text }]}>
            {!isRegression && ref.distanceSincePrevious != null && ref.distanceSincePrevious > 0 ? `${fmt(ref.distanceSincePrevious, 0)} km` : '—'}
          </Text>
        </View>
      </View>

      {!isRegression && ref.isFirstEntry ? (
        <Text style={[TYPE.caption, { color: colors.warning || '#D97706', marginTop: 8 }]}>
          First fuel entry — mileage unlocks after the next full-tank refill.
        </Text>
      ) : null}

      {!isRegression && ref.needsNextFullTank ? (
        <Text style={[TYPE.caption, { color: colors.warning || '#D97706', marginTop: 6 }]}>
          Mark this as a full-tank refill (and the previous one) to get real mileage.
        </Text>
      ) : null}

      {!isRegression && verdict ? (
        <View style={styles.verdictRow}>
          <Text style={styles.verdictEmoji}>{verdict.emoji}</Text>
          <Text style={[TYPE.bodyStrong, { color: colors.text }]}>{verdict.label}</Text>
        </View>
      ) : null}

      {!isRegression && ref.flaggedMileage ? (
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
  regressionBox: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  comparisonItem: {
    flex: 1,
  },
  correctBtn: {
    marginTop: SPACING.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  correctBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default FuelResultCard;

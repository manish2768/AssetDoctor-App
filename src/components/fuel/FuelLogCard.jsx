/**
 * Fuel & Mileage — Single Log Row
 *
 * Compact display of one fuel entry in the Fuel Vault list. Shows recorded
 * values only (odometer, litres/amount) plus any computed mileage / cost-per-km
 * that the save-time calculation engine derived.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../context/ThemeProvider';
import { SPACING, TYPE, RADIUS, HIT } from '../../theme/tokens';
import { formatDateIN } from '../../utils/dates';

function fmtKm(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toLocaleString('en-IN');
}

export function FuelLogCard({ log }) {
  const colors = useThemeColors();
  if (!log) return null;

  const date = log.timestamp
    ? typeof log.timestamp.toDate === 'function'
      ? log.timestamp.toDate()
      : new Date(log.timestamp)
    : log.createdAt
    ? new Date(log.createdAt)
    : null;

  const hasMileage = log.calculatedMileage != null && Number(log.calculatedMileage) > 0;
  const hasCost = log.costPerKm != null && Number(log.costPerKm) > 0;
  const volume = Number(log.liters) > 0 ? `${Number(log.liters).toFixed(2)} L` : null;
  const spend = Number(log.amountPaid) > 0 ? `₹${Number(log.amountPaid).toLocaleString('en-IN')}` : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <Text style={[TYPE.caption, { color: colors.textMuted }]}>
          {date && !isNaN(date.getTime()) ? formatDateIN(date) : '—'}
        </Text>
        <View style={styles.tags}>
          {log.isFullTank ? (
            <View style={[styles.tag, { backgroundColor: colors.successSoft }]}>
              <Text style={[TYPE.micro, { color: colors.success, fontWeight: '700' }]}>FULL TANK</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={[TYPE.h3, { color: colors.text, marginTop: 2 }]}>
        {fmtKm(log.odometerKM)} km
      </Text>

      <View style={styles.factRow}>
        {volume ? (
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>⛽ {volume}</Text>
        ) : null}
        {spend ? (
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>{spend}</Text>
        ) : null}
        {hasMileage ? (
          <Text style={[TYPE.caption, { color: colors.success, fontWeight: '700' }]}>
            {Number(log.calculatedMileage).toFixed(1)} km/L
          </Text>
        ) : null}
        {hasCost ? (
          <Text style={[TYPE.caption, { color: colors.textMuted }]}>
            ₹{Number(log.costPerKm).toFixed(2)}/km
          </Text>
        ) : null}
      </View>

      {log.distanceSincePreviousKM != null ? (
        <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>
          Since previous fill: {fmtKm(log.distanceSincePreviousKM)} km
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.xs,
    minHeight: HIT.min,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tags: {
    flexDirection: 'row',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.small,
  },
  factRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    alignItems: 'center',
  },
});

export default FuelLogCard;

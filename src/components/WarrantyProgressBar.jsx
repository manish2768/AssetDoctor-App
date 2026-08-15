/**
 * Warranty / insurance / service remaining — color-coded progress (green → orange → red).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { daysUntil } from '../utils/dates';

function toneForRatio(ratio, daysLeft) {
  if (daysLeft != null && daysLeft < 0) return { bar: COLORS.rose, label: 'Expired' };
  if (ratio == null) return { bar: COLORS.muted, label: '—' };
  if (ratio > 0.45) return { bar: COLORS.emerald, label: 'Healthy' };
  if (ratio > 0.18) return { bar: '#F59E0B', label: 'Attention' };
  return { bar: COLORS.rose, label: 'Critical' };
}

/**
 * @param {{
 *   label?: string,
 *   startDate?: string|Date,
 *   endDate?: string|Date,
 *   totalDays?: number,
 *   unitLabel?: string,
 * }} props
 */
export function WarrantyProgressBar({
  label = 'Warranty',
  startDate,
  endDate,
  totalDays,
  unitLabel = 'days left',
}) {
  const model = useMemo(() => {
    const left = daysUntil(endDate);
    let total = Number(totalDays) || 0;
    if (!total && startDate && endDate) {
      const a = new Date(startDate).getTime();
      const b = new Date(endDate).getTime();
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
        total = Math.max(1, Math.round((b - a) / 86400000));
      }
    }
    if (!total) total = 365;
    const remaining = left == null ? null : Math.max(0, left);
    const ratio =
      remaining == null ? null : Math.max(0, Math.min(1, remaining / total));
    const tone = toneForRatio(ratio, left);
    return { left, remaining, ratio, tone, total };
  }, [startDate, endDate, totalDays]);

  const widthPct = model.ratio == null ? 0 : Math.round(model.ratio * 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.status, { color: model.tone.bar }]}>
          {model.left == null
            ? 'Not set'
            : model.left < 0
              ? `Expired ${Math.abs(model.left)}d ago`
              : `${model.left} ${unitLabel}`}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${widthPct}%`,
              backgroundColor: model.tone.bar,
            },
          ]}
        />
      </View>
      <Text style={styles.meta}>{model.tone.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
  },
  status: {
    fontWeight: '700',
    fontSize: 12,
  },
  track: {
    height: 8,
    borderRadius: RADIUS.full || 999,
    backgroundColor: COLORS.bgDeep,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  meta: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
  },
});

export default WarrantyProgressBar;

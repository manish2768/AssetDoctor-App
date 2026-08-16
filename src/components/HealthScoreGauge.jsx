/**
 * Interactive Asset Health Score gauge (0–100).
 * Uses existing portfolio health — does not invent a new algorithm.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';

import { useThemeColors } from '../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, elevation } from '../theme/tokens';
import { Haptics } from '../services/haptics';

function toneForScore(score, colors) {
  if (score >= 100) return { ring: colors.gold, label: 'Perfect' };
  if (score >= 85) return { ring: colors.emerald, label: 'Healthy' };
  if (score >= 70) return { ring: colors.neonBlue, label: 'Good' };
  if (score >= 50) return { ring: colors.amber, label: 'Fair' };
  return { ring: colors.rose, label: 'Needs attention' };
}

export function HealthScoreGauge({
  score = 100,
  grade = '',
  assetCount = 0,
  attentionCount = 0,
  size = 132,
  title = 'Asset Health',
  onPress,
  onViewDetails,
  style,
}) {
  const colors = useThemeColors();
  const clamped = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const tone = useMemo(() => toneForScore(clamped, colors), [clamped, colors]);
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 100) * circumference;
  const statusLabel = grade || tone.label;

  return (
    <Pressable
      onPress={() => {
        Haptics.select();
        onPress?.();
      }}
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        elevation(2, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Asset health ${clamped} of 100, ${statusLabel}${
        attentionCount ? `, ${attentionCount} assets need attention` : ''
      }`}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={tone.ring} stopOpacity="1" />
              <Stop offset="100%" stopColor={colors.neonBlue} stopOpacity="0.85" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.backgroundDeep}
            strokeWidth={stroke}
            fill="none"
          />
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={clamped >= 100 ? colors.gold : 'url(#healthGrad)'}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
          <Text style={[styles.percent, { color: colors.text }]}>{clamped}</Text>
          <Text style={[styles.over, { color: colors.textMuted }]}>/100</Text>
          <Text style={[styles.grade, { color: tone.ring }]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={styles.meta}>
        <Text style={[TYPE.h3, { color: colors.text }]}>{title}</Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
          {assetCount > 0
            ? `Across ${assetCount} asset${assetCount === 1 ? '' : 's'}`
            : 'Add assets to start scoring your vault'}
        </Text>
        {attentionCount > 0 ? (
          <Text style={[TYPE.caption, { color: colors.warning, marginTop: 8, fontWeight: '700' }]}>
            {attentionCount} asset{attentionCount === 1 ? '' : 's'} need attention
          </Text>
        ) : assetCount > 0 ? (
          <Text style={[TYPE.caption, { color: colors.success, marginTop: 8, fontWeight: '600' }]}>
            No urgent attention items
          </Text>
        ) : null}
        <Pressable
          onPress={() => {
            Haptics.tap();
            (onViewDetails || onPress)?.();
          }}
          style={styles.detailsBtn}
          accessibilityRole="button"
          accessibilityLabel="View health details"
        >
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>
            View Details ›
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: 14,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  over: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: -2,
  },
  grade: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  meta: { flex: 1 },
  detailsBtn: {
    marginTop: 10,
    minHeight: 32,
    justifyContent: 'center',
  },
});

export default HealthScoreGauge;

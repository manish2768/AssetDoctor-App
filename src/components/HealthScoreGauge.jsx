/**
 * Interactive Asset Health Score gauge (0–100%).
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';

import { COLORS } from '../theme/branding';
import { Haptics } from '../services/haptics';

function toneForScore(score) {
  if (score >= 100) return { ring: COLORS.gold, label: 'Perfect' };
  if (score >= 85) return { ring: COLORS.emerald, label: 'Excellent' };
  if (score >= 70) return { ring: COLORS.neonBlue, label: 'Good' };
  if (score >= 50) return { ring: COLORS.amber, label: 'Fair' };
  return { ring: COLORS.rose, label: 'At Risk' };
}

export function HealthScoreGauge({
  score = 100,
  grade = '',
  assetCount = 0,
  size = 148,
  title = 'Vault Protection Score',
  onPress,
  style,
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const tone = useMemo(() => toneForScore(clamped), [clamped]);
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (clamped / 100) * circumference;

  return (
    <Pressable
      onPress={() => {
        Haptics.select();
        onPress?.();
      }}
      style={[styles.wrap, style]}
      accessibilityRole="button"
      accessibilityLabel={`Asset health score ${clamped} percent, ${grade || tone.label}`}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={tone.ring} stopOpacity="1" />
              <Stop offset="100%" stopColor={COLORS.neonBlue} stopOpacity="0.85" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={COLORS.bgDeep}
            strokeWidth={stroke}
            fill="none"
          />
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={clamped >= 100 ? COLORS.gold : 'url(#healthGrad)'}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
          <Text style={styles.percent}>{clamped}%</Text>
          <Text style={styles.grade}>{grade || tone.label}</Text>
        </View>
      </View>
      <View style={styles.meta}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          {assetCount > 0
            ? `Portfolio average across ${assetCount} asset${assetCount === 1 ? '' : 's'}`
            : 'Add assets to start scoring your vault'}
        </Text>
        {clamped >= 100 ? (
          <Text style={styles.perfect}>Golden shield unlocked</Text>
        ) : (
          <Text style={styles.hint}>Tap for passport tips to improve score</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
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
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  grade: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  meta: { flex: 1 },
  title: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  sub: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  perfect: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  hint: {
    color: COLORS.emerald,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
});

export default HealthScoreGauge;

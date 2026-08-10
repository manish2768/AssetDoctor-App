/**
 * Actionable Energy Doctor tip banner.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../theme/branding';

const TIPS = [
  {
    id: 'ac',
    test: (name) => /\bac\b|air[\s-]?cond/i.test(name),
    tip: 'Set AC to 24–26°C and use a timer — every degree cooler can add ~6% to the bill.',
  },
  {
    id: 'fridge',
    test: (name) => /fridge|refrigerator/i.test(name),
    tip: 'Keep fridge coils dust-free and avoid frequent door opens to cut standby load.',
  },
  {
    id: 'geyser',
    test: (name) => /geyser|water\s*heater/i.test(name),
    tip: 'Heat water once and switch off — short geyser bursts beat leaving it on standby.',
  },
  {
    id: 'washer',
    test: (name) => /wash|washer/i.test(name),
    tip: 'Run full loads on eco mode. Partial cycles waste water and electricity.',
  },
];

function pickTip(breakdown = [], monthlyCost = 0) {
  const top = [...breakdown].sort((a, b) => (b.dailyKwh || 0) - (a.dailyKwh || 0))[0];
  if (top?.assetName) {
    const hit = TIPS.find((t) => t.test(top.assetName));
    if (hit) {
      return {
        title: 'Energy Doctor Tip',
        body: `${top.assetName} is your top draw. ${hit.tip}`,
      };
    }
  }
  if (monthlyCost > 2500) {
    return {
      title: 'Energy Doctor Tip',
      body: 'Your estimated bill is high — stagger heavy appliances and lower daily hours on the top 2 loads.',
    };
  }
  if (!breakdown.length) {
    return {
      title: 'Energy Doctor Tip',
      body: 'Add AC, fridge, or geyser to unlock personalized savings tips for your home.',
    };
  }
  return {
    title: 'Energy Doctor Tip',
    body: 'Unplug idle chargers and switch lights to LED — small standby cuts add up every month.',
  };
}

export function EnergyDoctorTip({ breakdown = [], monthlyCost = 0, style }) {
  const tip = useMemo(() => pickTip(breakdown, monthlyCost), [breakdown, monthlyCost]);

  return (
    <View style={[styles.banner, style]}>
      <View style={styles.iconOrb}>
        <Text style={styles.icon}>💡</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{tip.title}</Text>
        <Text style={styles.body}>{tip.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(8, 145, 178, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(8, 145, 178, 0.22)',
  },
  iconOrb: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 16 },
  title: {
    color: COLORS.neonBlue,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  body: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default EnergyDoctorTip;

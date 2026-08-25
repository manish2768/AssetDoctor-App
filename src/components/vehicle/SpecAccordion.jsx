/**
 * Expandable accordion row for vehicle specs (RTO / Fuel / Chassis).
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';

import { COLORS, RADIUS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function SpecAccordion({ title = 'Vehicle Specs', rows = [], defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const visible = (rows || []).filter((r) => r?.value && r.value !== '—');

  if (!rows?.length) return null;

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          Haptics.select();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        style={styles.header}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {(visible.length ? visible : rows).map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value} numberOfLines={2}>
                {row.value || '—'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  title: { color: COLORS.text, fontWeight: '800', fontSize: 13 },
  chevron: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  body: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  label: { color: COLORS.muted, fontSize: 12, fontWeight: '600', flex: 1 },
  value: { color: COLORS.text, fontSize: 12, fontWeight: '800', flex: 1.3, textAlign: 'right' },
});

export default SpecAccordion;

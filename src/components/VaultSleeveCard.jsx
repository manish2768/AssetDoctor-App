/**
 * DigiLocker / Apple Wallet–style vault sleeve card.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { COLORS, RADIUS } from '../theme/branding';
import { CategoryIcon } from './icons/CategoryIcon';
import { Haptics } from '../services/haptics';

export function VaultSleeveCard({
  title,
  subtitle,
  count = 0,
  countLabel = 'items',
  accent = COLORS.emerald,
  iconKey = 'personal',
  onPress,
  children,
  style,
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.shell, pressed && { transform: [{ scale: 0.985 }] }, style]}
    >
      <View style={[styles.sleeve, { borderColor: accent }]}>
        <View style={[styles.sheen, { backgroundColor: accent }]} />
        <View style={styles.topRow}>
          <View style={[styles.iconWell, { backgroundColor: `${accent}18` }]}>
            <CategoryIcon name={iconKey} size={30} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.sub} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          <View style={[styles.chip, { borderColor: `${accent}55` }]}>
            <Text style={[styles.chipText, { color: accent }]}>
              {count} {countLabel}
            </Text>
          </View>
        </View>
        <View style={[styles.ribbon, { backgroundColor: accent }]} />
        {children ? <View style={styles.body}>{children}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 12,
  },
  sleeve: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 14,
    shadowColor: '#0A1628',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sheen: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.08,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWell: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 15,
  },
  sub: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: COLORS.bgDeep,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  ribbon: {
    height: 3,
    borderRadius: 99,
    marginTop: 14,
    opacity: 0.85,
  },
  body: {
    marginTop: 10,
  },
});

export default VaultSleeveCard;

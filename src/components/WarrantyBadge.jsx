import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { getWarrantyStatus } from '../utils/warrantyStatus';

export function WarrantyBadge({ warrantyExpiry, style }) {
  const status = getWarrantyStatus(warrantyExpiry);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${status.color}22`,
          borderColor: status.color,
          shadowColor: status.color,
        },
        status.id === 'warn' && styles.glow,
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: status.color }]} />
      <Text style={[styles.text, { color: status.color }]} numberOfLines={1}>
        {status.label}
        {status.days != null && status.days >= 0 ? ` · ${status.days}d` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  glow: {
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 10, fontWeight: '800' },
});

export default WarrantyBadge;

/**
 * Professional health pill for Home asset cards.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { getAssetHealthStatus } from '../utils/assetHealthStatus';

export function AssetHealthBadge({ asset, status: statusProp, style }) {
  const status = statusProp || getAssetHealthStatus(asset);
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: status.bg,
          borderColor: status.border,
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Health ${status.label}`}
    >
      <View style={[styles.dot, { backgroundColor: status.color }]} />
      <Text style={[styles.label, { color: status.color }]}>{status.label}</Text>
    </View>
  );
}

export default AssetHealthBadge;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

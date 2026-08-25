/**
 * Reusable Branding Banner + Ashutosh creator badge
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { BRAND, COLORS } from '../theme/branding';

export function BrandingBanner({ compact = false, showCreatorBadge = true }) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>{BRAND.name}</Text>
        {showCreatorBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Crafted by Ashutosh (14) 🚀</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.tagline}>{BRAND.tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,245,160,0.35)',
    backgroundColor: 'rgba(0,245,160,0.08)',
  },
  compact: { paddingVertical: 12 },
  topRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  brand: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: 'rgba(0,245,160,0.16)',
    borderColor: 'rgba(0,245,160,0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { color: COLORS.emerald, fontSize: 10, fontWeight: '800' },
  tagline: {
    marginTop: 8,
    color: COLORS.emerald,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});

export default BrandingBanner;

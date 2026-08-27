/**
 * Asset Doctor — Universal Search Entry in Drawer
 * Quick search bar touch target to search across assets, IMEI, VIN, serial, and bills.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { FONTS } from '../../theme/branding';
import { RADIUS } from '../../theme/tokens';

export function UniversalSearchEntry({ onPress }) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.card || '#F8FAFC',
          borderColor: colors.border || '#E2E8F0',
        },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="search"
      accessibilityLabel="Universal Search: Search assets, serials, IMEI, or documents"
    >
      <Text style={styles.searchIcon}>🔍</Text>
      <Text style={[styles.placeholder, { color: colors.textMuted || '#94A3B8' }]} numberOfLines={1}>
        Search serial, IMEI, plate, bill...
      </Text>
      <View style={styles.shortcutPill}>
        <Text style={styles.shortcutText}>ALL</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  placeholder: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12.5,
  },
  shortcutPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  shortcutText: {
    fontSize: 9,
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: '#64748B',
  },
});

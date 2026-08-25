/**
 * Subtle privacy badge for Settings / Upload screens.
 */

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';

import { COLORS } from '../theme/branding';

export function PrivacyVaultTag({ style }) {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="text">
      <Text style={styles.text}>🔒 100% Encrypted & Private Vault</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  text: {
    color: COLORS.emerald,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default PrivacyVaultTag;

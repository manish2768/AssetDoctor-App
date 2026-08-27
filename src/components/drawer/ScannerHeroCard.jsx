/**
 * Asset Doctor — Scanner Hero Action Card
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Haptics } from '../../services/haptics';
import { FONTS } from '../../theme/branding';
import { RADIUS } from '../../theme/tokens';
import { PremiumIcon } from '../../design-system/icons';
import { ScanBeam } from '../../design-system/primitives';

export function ScannerHeroCard({ onPress }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactMedium();
        onPress?.();
      }}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel="Scan and Identify: Scan any bill, warranty, insurance or document"
    >
      <View style={styles.iconCircle}>
        <PremiumIcon name="scan" size={22} color="#00B8A9" />
        <ScanBeam />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.kicker}>SMART DOCUMENT INTELLIGENCE</Text>
        <Text style={styles.titleText}>Scan anything.</Text>
        <Text style={styles.subtitleText} numberOfLines={2}>
          Asset Doctor identifies the rest.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: RADIUS.hero,
    backgroundColor: '#07111F',
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,184,169,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  textContainer: {
    flex: 1,
  },
  kicker: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(0,184,169,0.9)',
    fontWeight: '600',
  },
  titleText: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 6,
  },
  subtitleText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: 'rgba(248,250,252,0.65)',
    marginTop: 4,
  },
});

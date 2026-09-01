import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { TYPE, SPACING, RADIUS } from '../../theme/tokens';
import { PremiumCard, SectionHeader } from '../../design-system/primitives';

export function ProtectionScoreCard({ protection, style }) {
  const colors = useThemeColors();
  if (!protection) return null;
  const scoreLabel = protection.score == null ? protection.display || 'Not available' : protection.display;

  return (
    <PremiumCard level={2} style={style}>
      <SectionHeader title="Protection Score" subtitle="Digital record completeness — not Asset Health" />
      <Text style={[TYPE.h1, { color: colors.text, marginTop: SPACING.xs }]}>{scoreLabel}</Text>
      <View style={styles.dims}>
        {(protection.dimensions || []).map((d) => (
          <View key={d.id} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[TYPE.micro, { color: colors.textMuted }]}>{d.label}</Text>
            <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700', marginTop: 2 }]}>{d.display}</Text>
          </View>
        ))}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  dims: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '30%',
    flexGrow: 1,
  },
});

export default ProtectionScoreCard;

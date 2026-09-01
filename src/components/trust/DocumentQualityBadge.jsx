import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { TYPE, RADIUS, SPACING } from '../../theme/tokens';
import { DOCUMENT_QUALITY } from '../../trust/protectionStatus';

export function DocumentQualityBadge({ quality, style }) {
  const colors = useThemeColors();
  const q = quality && quality.id ? quality : DOCUMENT_QUALITY.NOT_AVAILABLE;
  const tone =
    q.id === 'EXCELLENT' || q.id === 'GOOD'
      ? colors.success || '#10B981'
      : q.id === 'POOR_SCAN'
        ? colors.danger || '#EF4444'
        : q.id === 'NEEDS_REVIEW'
          ? colors.warning || '#F59E0B'
          : colors.textMuted;
  return (
    <View style={[styles.wrap, { borderColor: tone }, style]} accessibilityLabel={`Document quality ${q.label}`}>
      <Text style={[TYPE.micro, { color: tone, fontWeight: '700' }]}>{q.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
});

export default DocumentQualityBadge;

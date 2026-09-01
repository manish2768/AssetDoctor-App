import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { TYPE, SPACING, RADIUS, HIT } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';
import { documentActionsForType } from '../../trust/protectionStatus';

export function SmartDocumentActions({ documentType, hasLinkedAsset = true, onAction, style }) {
  const colors = useThemeColors();
  const actions = documentActionsForType(documentType, { hasLinkedAsset }).filter((a) => a.available);
  if (!actions.length) return null;

  return (
    <View style={style}>
      <Text style={[TYPE.label, { color: colors.textMuted, marginBottom: SPACING.xs }]}>ACTIONS</Text>
      <View style={styles.row}>
        {actions.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              Haptics.tap();
              onAction?.(a);
            }}
            style={({ pressed }) => [
              styles.btn,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={a.label}
          >
            <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: HIT.min,
    justifyContent: 'center',
  },
});

export default SmartDocumentActions;

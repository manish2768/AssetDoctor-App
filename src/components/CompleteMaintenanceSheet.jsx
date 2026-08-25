/**
 * Bottom action sheet for marking maintenance complete.
 * Presentation only — callers keep existing markComplete / log flows.
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT } from '../theme/tokens';
import { Haptics } from '../services/haptics';

export function CompleteMaintenanceSheet({
  visible,
  title,
  subtitle,
  onClose,
  onCompletedInApp,
  onCompletedElsewhere,
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay || 'rgba(15,23,42,0.4)' }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            },
          ]}
          onPress={() => {}}
          accessibilityViewIsModal
        >
          <Text style={[TYPE.h3, { color: colors.text, fontSize: 17 }]}>
            Mark maintenance complete
          </Text>
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4, marginBottom: 14 }]}>
            {subtitle || title || 'Choose how this maintenance was completed:'}
          </Text>

          <Pressable
            style={[
              styles.btn,
              styles.btnPrimary,
              { backgroundColor: colors.primary, borderColor: colors.primary, minHeight: HIT.min },
            ]}
            onPress={() => {
              Haptics.tap();
              onCompletedInApp?.();
            }}
            accessibilityRole="button"
            accessibilityLabel="Completed with Asset Doctor"
          >
            <Text style={[TYPE.bodyStrong, { color: colors.textOnPrimary, textAlign: 'center' }]}>
              Completed with Asset Doctor
            </Text>
            <Text style={[TYPE.micro, { color: colors.textOnPrimary, opacity: 0.85, textAlign: 'center', marginTop: 2 }]}>
              Log cost and details
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.btn,
              {
                backgroundColor: colors.surfaceMuted || colors.bg,
                borderColor: colors.border,
                minHeight: HIT.min,
              },
            ]}
            onPress={() => {
              Haptics.tap();
              onCompletedElsewhere?.();
            }}
            accessibilityRole="button"
            accessibilityLabel="Completed elsewhere"
          >
            <Text style={[TYPE.bodyStrong, { color: colors.text, textAlign: 'center' }]}>
              Completed elsewhere
            </Text>
            <Text style={[TYPE.micro, { color: colors.textMuted, textAlign: 'center', marginTop: 2 }]}>
              Mark done without logging cost
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.select();
              onClose?.();
            }}
            style={[styles.cancel, { minHeight: HIT.min }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={[TYPE.bodyStrong, { color: colors.textMuted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl || 20,
    borderTopRightRadius: RADIUS.xl || 20,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    justifyContent: 'center',
  },
  btnPrimary: {},
  cancel: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CompleteMaintenanceSheet;

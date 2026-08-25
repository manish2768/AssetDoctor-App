/**
 * Reusable confirmation dialog — replaces Alert.alert for destructive / audit actions.
 * Prefer this over browser/native alert for product-grade UX.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useThemeColors } from '../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT } from '../theme/tokens';
import { Haptics } from '../services/haptics';

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {string} [props.confirmLabel]
 * @param {string} [props.cancelLabel]
 * @param {'danger'|'primary'|'neutral'} [props.tone]
 * @param {boolean} [props.requireReason] — for audit / destructive admin-style flows
 * @param {string} [props.reasonPlaceholder]
 * @param {() => void} props.onCancel
 * @param {(reason?: string) => void} props.onConfirm
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  requireReason = false,
  reasonPlaceholder = 'Reason (required for audit log)',
  onCancel,
  onConfirm,
}) {
  const colors = useThemeColors();
  const [reason, setReason] = useState('');
  const canConfirm = !requireReason || String(reason || '').trim().length >= 3;

  const confirmBg =
    tone === 'danger' ? colors.error : tone === 'neutral' ? colors.surfaceMuted : colors.primary;
  const confirmFg = tone === 'neutral' ? colors.text : colors.textOnPrimary;

  const close = () => {
    setReason('');
    onCancel?.();
  };

  const confirm = () => {
    if (!canConfirm) return;
    Haptics.tap();
    const r = String(reason || '').trim();
    onConfirm?.(requireReason ? r : undefined);
    setReason('');
  };

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={close}
          accessibilityLabel="Dismiss dialog"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          accessibilityRole="alert"
          accessibilityViewIsModal
        >
          <Text style={[TYPE.h3, { color: colors.text }]}>{title}</Text>
          {message ? (
            <Text style={[TYPE.body, { color: colors.textMuted, marginTop: SPACING.sm }]}>
              {message}
            </Text>
          ) : null}
          {requireReason ? (
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={reasonPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.reason,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.surfaceMuted,
                },
              ]}
              multiline
              accessibilityLabel="Reason"
            />
          ) : null}
          <View style={styles.actions}>
            <Pressable
              onPress={close}
              style={[styles.btn, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={[TYPE.button, { color: colors.text }]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={confirm}
              disabled={!canConfirm}
              style={[
                styles.btn,
                styles.btnFill,
                { backgroundColor: confirmBg, opacity: canConfirm ? 1 : 0.45 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              accessibilityState={{ disabled: !canConfirm }}
            >
              <Text style={[TYPE.button, { color: confirmFg }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    zIndex: 2,
  },
  reason: {
    marginTop: SPACING.md,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.lg,
  },
  btn: {
    flex: 1,
    minHeight: HIT.min,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnFill: {
    borderWidth: 0,
  },
});

export default ConfirmDialog;

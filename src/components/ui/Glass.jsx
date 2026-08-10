/**
 * Glassmorphic UI primitives — shared across Asset Doctor screens
 */

import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';

import { BRAND, COLORS, RADIUS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';

export function Screen({ children, style }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function GlassCard({ children, style, glow = false }) {
  return (
    <View style={[styles.card, glow && styles.cardGlow, style]}>
      {children}
    </View>
  );
}

export function GlassInput({
  label,
  error,
  style,
  inputStyle,
  ...props
}) {
  return (
    <View style={[{ marginBottom: SPACING.md }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={COLORS.muted}
        style={[styles.input, error && styles.inputError, inputStyle]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function GlassButton({
  title,
  onPress,
  loading = false,
  variant = 'primary',
  disabled = false,
  style,
}) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && styles.btnPrimary,
        isGhost && styles.btnGhost,
        isDanger && styles.btnDanger,
        (disabled || loading) && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.onPrimary} />
      ) : (
        <Text
          style={[
            styles.btnText,
            (isGhost || isDanger) && { color: COLORS.text },
            isDanger && { color: COLORS.rose },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function BrandFooter({ compact = false }) {
  return (
    <View style={[styles.footer, compact && { marginTop: SPACING.sm }]}>
      <Text style={styles.footerTag}>{BRAND.tagline}</Text>
      <Text style={styles.footerCredit}>{BRAND.footer}</Text>
    </View>
  );
}

/**
 * Custom glass confirmation modal
 */
export function GlassConfirmModal({
  visible,
  title = 'Confirm',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <GlassCard style={styles.modalCard} glow>
          <Text style={styles.modalTitle}>{title}</Text>
          {message ? <Text style={styles.modalMsg}>{message}</Text> : null}
          <View style={styles.modalActions}>
            <GlassButton title={cancelLabel} variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
            <GlassButton
              title={confirmLabel}
              onPress={onConfirm}
              loading={loading}
              style={{ flex: 1 }}
            />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardGlow: {
    borderColor: COLORS.borderGlow,
    shadowColor: COLORS.emerald,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: COLORS.text,
    fontSize: 15,
  },
  inputError: { borderColor: COLORS.rose },
  errorText: { color: COLORS.rose, fontSize: 12, marginTop: 6 },
  btn: {
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: COLORS.emerald,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnDanger: {
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.35)',
  },
  btnText: {
    color: COLORS.onPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  footer: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    paddingBottom: SPACING.md,
  },
  footerTag: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  footerCredit: {
    color: COLORS.emerald,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: { padding: SPACING.lg },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalMsg: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.lg,
  },
});

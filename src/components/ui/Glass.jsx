/**
 * Glassmorphic UI primitives — theme-aware (STEP 13).
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';

import { BRAND } from '../../theme/branding';
import { RADIUS, SPACING, HIT, elevation } from '../../theme/tokens';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';

export function Screen({ children, style }) {
  const colors = useThemeColors();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>
  );
}

export function GlassCard({ children, style, glow = false }) {
  const colors = useThemeColors();
  const cardStyle = useMemo(
    () => [
      {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: glow ? colors.borderAccent || colors.borderGlow : colors.border,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        ...elevation(glow ? 2 : 1, colors.shadow),
      },
      style,
    ],
    [colors, glow, style],
  );
  return <View style={cardStyle}>{children}</View>;
}

export function GlassInput({ label, error, style, inputStyle, ...props }) {
  const colors = useThemeColors();
  return (
    <View style={[{ marginBottom: SPACING.md }, style]}>
      {label ? (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label || props.placeholder || 'Input'}
        style={[
          {
            backgroundColor: colors.backgroundDeep,
            borderWidth: 1,
            borderColor: error ? colors.error : colors.border,
            borderRadius: RADIUS.md,
            paddingHorizontal: 14,
            paddingVertical: 13,
            color: colors.text,
            fontSize: 15,
            minHeight: HIT.min,
          },
          inputStyle,
        ]}
        {...props}
      />
      {error ? (
        <Text style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>{error}</Text>
      ) : null}
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
  const colors = useThemeColors();
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  const bg = isPrimary
    ? colors.primary
    : isDanger
      ? colors.dangerSoft || colors.errorSoft
      : 'transparent';
  const borderColor = isGhost ? colors.border : isDanger ? colors.error : 'transparent';
  const textColor = isPrimary
    ? colors.textOnPrimary
    : isDanger
      ? colors.error
      : colors.text;

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={title || 'Button'}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        {
          borderRadius: RADIUS.md,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: HIT.min,
          backgroundColor: bg,
          borderWidth: isGhost || isDanger ? 1 : 0,
          borderColor,
          opacity: disabled || loading ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={isGhost || isDanger ? colors.primary : colors.textOnPrimary} />
          <Text style={{ color: textColor, fontWeight: '800', fontSize: 15 }}>
            {title || 'Please wait…'}
          </Text>
        </View>
      ) : (
        <Text style={{ color: textColor, fontWeight: '800', fontSize: 15 }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function BrandFooter({ compact = false }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        { marginTop: SPACING.lg, alignItems: 'center', paddingBottom: SPACING.md },
        compact && { marginTop: SPACING.sm },
      ]}
    >
      <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', fontWeight: '600' }}>
        {BRAND.tagline}
      </Text>
      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
        {BRAND.footer}
      </Text>
    </View>
  );
}

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
  const colors = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          padding: SPACING.lg,
        }}
      >
        <GlassCard style={{ padding: SPACING.lg }} glow>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
          {message ? (
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 10, lineHeight: 20 }}>
              {message}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: SPACING.lg }}>
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

export default {
  Screen,
  GlassCard,
  GlassInput,
  GlassButton,
  BrandFooter,
  GlassConfirmModal,
};

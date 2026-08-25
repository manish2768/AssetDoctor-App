/**
 * Shared UI primitives — STEP 13 design system consumers.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT, elevation } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';

export function SectionHeader({ title, subtitle, actionLabel, onAction, style }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.h3, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            Haptics.select();
            onAction();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={{ minHeight: HIT.min, justifyContent: 'center' }}
        >
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function FilterChip({ label, selected, onPress, icon, style }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.select();
        onPress?.();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.infoSoft : colors.surfaceMuted,
          borderColor: selected ? colors.secondary : colors.border,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
    >
      {icon ? <Text style={{ marginRight: 4 }}>{icon}</Text> : null}
      <Text
        style={[
          TYPE.caption,
          { color: selected ? colors.secondary : colors.textMuted, fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Status badge — always includes text (never color-only).
 * tone: success | warning | error | info | neutral
 */
export function StatusBadge({ label, tone = 'neutral', icon, style }) {
  const colors = useThemeColors();
  const map = {
    success: { bg: colors.successSoft, fg: colors.success, fallbackIcon: '●' },
    warning: { bg: colors.warningSoft, fg: colors.warning, fallbackIcon: '●' },
    error: { bg: colors.errorSoft, fg: colors.error, fallbackIcon: '●' },
    info: { bg: colors.infoSoft, fg: colors.info, fallbackIcon: '●' },
    neutral: { bg: colors.surfaceMuted, fg: colors.textMuted, fallbackIcon: '○' },
  };
  const t = map[tone] || map.neutral;
  return (
    <View
      style={[styles.badge, { backgroundColor: t.bg }, style]}
      accessibilityRole="text"
      accessibilityLabel={`${label}`}
    >
      <Text style={{ color: t.fg, marginRight: 4, fontSize: 10 }}>{icon || t.fallbackIcon}</Text>
      <Text style={[TYPE.micro, { color: t.fg, textTransform: 'uppercase' }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  message,
  ctaLabel,
  onCta,
  icon = '📦',
  style,
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.empty,
        { backgroundColor: colors.surface, borderColor: colors.border },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="summary"
    >
      <Text style={{ fontSize: 28, marginBottom: 8 }} accessibilityElementsHidden>
        {icon}
      </Text>
      <Text style={[TYPE.h3, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text style={[TYPE.body, { color: colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
          {message}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <Pressable
          onPress={() => {
            Haptics.tap();
            onCta();
          }}
          style={[styles.emptyCta, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={[TYPE.bodyStrong, { color: colors.textOnPrimary }]}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SkeletonBlock({ height = 16, width = '100%', radius = RADIUS.sm, style }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: colors.border,
          opacity: 0.55,
        },
        style,
      ]}
      accessibilityLabel="Loading"
    />
  );
}

export function ErrorState({
  title = "Couldn't load this screen",
  message = 'Check your connection and try again.',
  onRetry,
  onContinueOffline,
  style,
}) {
  const colors = useThemeColors();
  return (
    <View style={[{ padding: SPACING.lg, alignItems: 'center' }, style]}>
      <Text style={{ fontSize: 28, marginBottom: 8 }}>⚠️</Text>
      <Text style={[TYPE.h3, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[TYPE.body, { color: colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
        {message}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: SPACING.md }}>
        {onRetry ? (
          <Pressable
            onPress={() => {
              Haptics.tap();
              onRetry();
            }}
            style={[styles.emptyCta, { backgroundColor: colors.primary, marginTop: 0 }]}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={[TYPE.bodyStrong, { color: colors.textOnPrimary }]}>Retry</Text>
          </Pressable>
        ) : null}
        {onContinueOffline ? (
          <Pressable
            onPress={() => {
              Haptics.select();
              onContinueOffline();
            }}
            style={[
              styles.emptyCta,
              {
                marginTop: 0,
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue Offline"
          >
            <Text style={[TYPE.bodyStrong, { color: colors.text }]}>Continue Offline</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SyncStatusPill({ state = 'synced' }) {
  const colors = useThemeColors();
  const map = {
    offline: { label: 'Offline', tone: colors.warning, bg: colors.warningSoft },
    syncing: { label: 'Syncing', tone: colors.info, bg: colors.infoSoft },
    synced: { label: 'Synced', tone: colors.success, bg: colors.successSoft },
    error: { label: 'Sync issue', tone: colors.error, bg: colors.errorSoft },
  };
  const m = map[state] || map.synced;
  return (
    <View
      style={[styles.syncPill, { backgroundColor: m.bg }]}
      accessibilityRole="text"
      accessibilityLabel={m.label}
    >
      <View style={[styles.syncDot, { backgroundColor: m.tone }]} />
      <Text style={[TYPE.micro, { color: m.tone }]}>{m.label}</Text>
    </View>
  );
}

export function QuickActionGrid({ actions = [], style }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.qaGrid, style]}>
      {actions.map((a) => (
        <Pressable
          key={a.id || a.label}
          onPress={() => {
            Haptics.tap();
            a.onPress?.();
          }}
          style={[
            styles.qaItem,
            { backgroundColor: colors.surface, borderColor: colors.border },
            elevation(1, colors.shadow),
          ]}
          accessibilityRole="button"
          accessibilityLabel={a.label}
        >
          <Text style={{ fontSize: 20 }}>{a.icon || '•'}</Text>
          <Text
            style={[TYPE.micro, { color: colors.text, marginTop: 6, textAlign: 'center' }]}
            numberOfLines={2}
          >
            {a.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function LoadingInline({ label = 'Loading…' }) {
  const colors = useThemeColors();
  return (
    <View style={styles.loadingRow} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[TYPE.caption, { color: colors.textMuted, marginLeft: 8 }]}>{label}</Text>
    </View>
  );
}

/**
 * Primary / secondary / ghost / danger buttons — single source for CTAs.
 * variant: primary | secondary | ghost | danger
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}) {
  const colors = useThemeColors();
  const map = {
    primary: { bg: colors.primary, fg: colors.textOnPrimary, border: 'transparent' },
    secondary: { bg: 'transparent', fg: colors.text, border: colors.borderStrong || colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.error, fg: colors.textOnPrimary, border: 'transparent' },
  };
  const v = map[variant] || map.primary;
  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        Haptics.tap();
        onPress?.();
      }}
      disabled={disabled || loading}
      style={[
        styles.btn,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled || loading ? 0.5 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!(disabled || loading) }}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[TYPE.button, { color: v.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SurfaceCard({ children, style, elevated = true }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        elevated ? elevation(1, colors.shadow) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function FieldLabel({ children, required }) {
  const colors = useThemeColors();
  return (
    <Text style={[TYPE.label, { color: colors.textMuted, marginBottom: 6 }]}>
      {children}
      {required ? <Text style={{ color: colors.error }}> *</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 36,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  empty: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  emptyCta: {
    marginTop: SPACING.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    minHeight: HIT.min,
    justifyContent: 'center',
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  qaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  qaItem: {
    width: '18%',
    minWidth: 64,
    flexGrow: 1,
    maxWidth: '22%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minHeight: 72,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    justifyContent: 'center',
  },
  btn: {
    minHeight: HIT.min,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
});

export default {
  SectionHeader,
  FilterChip,
  StatusBadge,
  EmptyState,
  SkeletonBlock,
  ErrorState,
  SyncStatusPill,
  QuickActionGrid,
  LoadingInline,
  Button,
  SurfaceCard,
  FieldLabel,
};

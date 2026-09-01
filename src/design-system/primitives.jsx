/**
 * Phase 10 premium primitives. Presentation only — no data invention.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';

import { useThemeColors } from '../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT, elevation, MOTION } from '../theme/tokens';
import { Haptics } from '../services/haptics';
import { PremiumIcon } from './icons';

function surfaceFor(level, colors) {
  if (level === 3) return colors.heroSurface || colors.midnight || '#07111F';
  if (level === 2) return colors.surfaceElevated || colors.surface;
  return 'transparent';
}

export function PremiumCard({
  level = 2,
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityRole,
}) {
  const colors = useThemeColors();
  const bg = surfaceFor(level, colors);
  const bordered = level !== 1;
  const inner = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderWidth: bordered && level !== 3 ? 1 : 0,
          borderColor: colors.border,
          borderRadius: level === 3 ? RADIUS.hero : RADIUS.lg,
        },
        level === 2 ? elevation(1, colors.shadow) : null,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress();
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}
      accessibilityRole={accessibilityRole || 'button'}
      accessibilityLabel={accessibilityLabel}
    >
      {inner}
    </Pressable>
  );
}

export function GlassSurface({ children, style }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: RADIUS.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({ title, subtitle, actionLabel, onAction, style }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.label, { color: colors.textMuted }]}>{String(title || '').toUpperCase()}</Text>
        {subtitle ? (
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            Haptics.tap();
            onAction();
          }}
          hitSlop={HIT.slop8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={{ minHeight: HIT.min, justifyContent: 'center' }}
        >
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '600' }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function StatusBadge({ label, tone = 'neutral', style }) {
  const colors = useThemeColors();
  const map = {
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    error: { bg: colors.errorSoft, fg: colors.danger },
    danger: { bg: colors.errorSoft, fg: colors.danger },
    info: { bg: colors.infoSoft, fg: colors.info },
    neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
  };
  const t = map[tone] || map.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]} accessibilityLabel={label}>
      <View style={[styles.badgeDot, { backgroundColor: t.fg }]} />
      <Text style={[TYPE.micro, { color: t.fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function ConfidenceBar({ confidence = 0, status, style }) {
  const colors = useThemeColors();
  const pct = Math.max(0, Math.min(100, Number(confidence) || 0));
  const isVerified = status === 'VERIFIED';
  const needsReview = status === 'NEEDS_REVIEW' || status === 'NEEDS_VERIFICATION';
  const notFound = status === 'NOT_FOUND' || status === 'EMPTY';
  let label = `${pct}% confidence`;
  let fg = colors.info;
  if (notFound) {
    label = 'Not found';
    fg = colors.textMuted;
  } else if (isVerified) {
    label = 'Verified';
    fg = colors.success;
  } else if (needsReview) {
    label = 'Please verify';
    fg = colors.warning;
  } else if (status === 'HIGH_CONFIDENCE') {
    label = 'High confidence';
    fg = colors.success;
  }
  return (
    <View style={style} accessibilityLabel={label}>
      <Text style={[TYPE.micro, { color: fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function ProgressRing({ progress = 0, size = 88, stroke = 8, color, trackColor, children }) {
  const colors = useThemeColors();
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <View style={[styles.progressTrack, { backgroundColor: trackColor || colors.surfaceMuted, height: 6, borderRadius: 99, width: size }]}>
        <View
          style={{
            width: `${pct}%`,
            height: 6,
            borderRadius: 99,
            backgroundColor: color || colors.primary,
          }}
        />
      </View>
      {children}
    </View>
  );
}

export function CountUp({ value, style }) {
  const [shown, setShown] = useState(value == null ? '—' : 0);
  useEffect(() => {
    if (value == null || !Number.isFinite(Number(value))) {
      setShown('—');
      return undefined;
    }
    const to = Math.round(Number(value));
    const start = Date.now();
    const dur = MOTION.slow;
    let frame;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      setShown(Math.round(to * t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <Text style={style}>{shown}</Text>;
}

export function ScanBeam({ active = true }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [4, 46] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 10,
        right: 10,
        height: 2,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 184, 169, 0.85)',
        transform: [{ translateY }],
      }}
    />
  );
}

export function PremiumButton({ title, onPress, icon, loading, disabled, variant = 'primary', style }) {
  const colors = useThemeColors();
  const bg = variant === 'primary' ? colors.primary : variant === 'hero' ? colors.electricTeal || '#00B8A9' : colors.surface;
  const fg = variant === 'ghost' ? colors.primary : variant === 'primary' || variant === 'hero' ? '#FFFFFF' : colors.text;
  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        Haptics.tap();
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variant === 'ghost' ? 'transparent' : bg,
          borderWidth: variant === 'secondary' || variant === 'ghost' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <View style={{ marginRight: 8 }}>{typeof icon === 'string' ? <PremiumIcon name={icon} size={16} color={fg} /> : icon}</View> : null}
          <Text style={[TYPE.button, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, size = 44, variant = 'subtle', badge, style }) {
  const colors = useThemeColors();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'hero'
      ? 'rgba(255,255,255,0.08)'
      : colors.surface;
  const fg = variant === 'primary' ? '#FFFFFF' : colors.text;
  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      hitSlop={HIT.slop8}
      style={({ pressed }) => [
        styles.iconBtn,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label || name}
    >
      <PremiumIcon name={name} size={18} color={fg} />
      {badge ? <View style={[styles.iconBadge, { backgroundColor: colors.danger }]} /> : null}
    </Pressable>
  );
}

export function SearchBar({ value, onChangeText, placeholder = 'Search...', onClear, style }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <PremiumIcon name="search" size={16} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.searchInput, { color: colors.text }]}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable
          onPress={() => {
            Haptics.tap();
            onClear ? onClear() : onChangeText?.('');
          }}
          hitSlop={HIT.slop8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <PremiumIcon name="x" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function FilterChip({ label, selected, onPress, style }) {
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
          backgroundColor: selected ? colors.accentLight : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
    >
      <Text style={[TYPE.caption, { color: selected ? colors.primary : colors.textMuted, fontWeight: selected ? '600' : '500' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({ title, message, ctaLabel, onCta, secondaryLabel, onSecondary, icon = 'shield', style }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentLight }]}>
        <PremiumIcon name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={[TYPE.h2, { color: colors.text, textAlign: 'center', marginTop: 14 }]}>{title}</Text>
      {message ? (
        <Text style={[TYPE.body, { color: colors.textMuted, textAlign: 'center', marginTop: 8 }]}>{message}</Text>
      ) : null}
      {ctaLabel && onCta ? (
        <PremiumButton title={ctaLabel} onPress={onCta} icon="scan" style={{ marginTop: 16, minWidth: 180 }} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <PremiumButton title={secondaryLabel} onPress={onSecondary} variant="ghost" style={{ marginTop: 8 }} />
      ) : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', radius = RADIUS.sm, style }) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        { height, width, borderRadius: radius, backgroundColor: colors.surfaceMuted, opacity },
        style,
      ]}
    />
  );
}

export function MetricCard({ title, value, subtitle, style }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.metric, { backgroundColor: 'transparent' }, style]}>
      <Text style={[TYPE.micro, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[TYPE.h2, { color: colors.textOnHero || colors.text, marginTop: 4 }]}>{value}</Text>
      {subtitle ? <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function AssetCollectionCard({ icon, title, count, healthLabel, healthTone, onPress, style }) {
  const colors = useThemeColors();
  const countLabel = `${count} ${count === 1 ? 'Asset' : 'Assets'}`;
  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.collection,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${countLabel}`}
    >
      <View style={[styles.collectionIcon, { backgroundColor: colors.accentLight }]}>
        <PremiumIcon name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[TYPE.bodyStrong, { color: colors.text, marginTop: 10 }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]}>{countLabel}</Text>
      {count > 0 && healthLabel ? (
        <View style={{ marginTop: 8 }}>
          <StatusBadge label={healthLabel} tone={healthTone || 'success'} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function InsightCard({ title, subtitle, actionLabel, onPress, style }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.insight,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle || ''}`}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={[TYPE.h3, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 3 }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '600' }]}>{actionLabel || 'View →'}</Text>
    </Pressable>
  );
}

export function DocumentCard({
  documentType,
  assetName,
  dateText,
  verified,
  needsReview,
  accent,
  onPress,
  style,
}) {
  const colors = useThemeColors();
  const bar = accent || colors.primary;
  const statusLabel = needsReview ? 'Needs Review' : 'On file';
  const tone = needsReview ? 'warning' : 'neutral';
  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.docCard,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${documentType}, ${assetName}, ${statusLabel}`}
    >
      <View style={[styles.docAccent, { backgroundColor: bar }]} />
      <View style={[styles.docIcon, { backgroundColor: colors.surfaceMuted }]}>
        <PremiumIcon name="file-text" size={18} color={bar} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.h3, { color: colors.text }]} numberOfLines={1}>
          {documentType}
        </Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {assetName}
        </Text>
        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
          <StatusBadge label={statusLabel} tone={tone} />
          {dateText ? (
            <Text style={[TYPE.micro, { color: colors.textMuted, marginLeft: 8 }]} numberOfLines={1}>
              {dateText}
            </Text>
          ) : null}
        </View>
      </View>
      <PremiumIcon name="chevron" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export function HeroCard({ children, style }) {
  const colors = useThemeColors();
  const midnight = colors.heroSurface || colors.midnight || '#07111F';
  return (
    <View style={[styles.hero, { backgroundColor: midnight }, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: colors.electricTeal || '#00B8A9',
            opacity: 0.07,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.md,
    overflow: 'hidden',
  },
  hero: {
    borderRadius: RADIUS.hero,
    padding: SPACING.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  progressTrack: {
    overflow: 'hidden',
  },
  button: {
    minHeight: HIT.min,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: 8,
    minHeight: HIT.min,
    justifyContent: 'center',
  },
  empty: {
    padding: SPACING.xl,
    borderRadius: RADIUS.hero,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metric: {
    flex: 1,
  },
  collection: {
    width: '48%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  collectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    paddingLeft: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  docAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
});

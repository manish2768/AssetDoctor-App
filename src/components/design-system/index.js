/**
 * Asset Doctor — Master Design System Component Library
 * Standard, reusable, accessible, data-focused mobile primitives.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { useThemeColors } from '../../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT, ICON_SIZE, elevation } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';
import { CategoryIcon } from '../icons/CategoryIcon';

// ============================================================================
// 1. APP HEADER
// ============================================================================
export function AppHeader({
  title,
  subtitle,
  rightAction,
  onRightAction,
  rightIcon,
  showAvatar = false,
  userName,
  onAvatarPress,
  style,
}) {
  const colors = useThemeColors();
  const initials = (userName || 'AD')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.headerContainer, style]}>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <Text style={[TYPE.caption, { color: colors.textMuted, marginBottom: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
        <Text style={[TYPE.h1, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <View style={styles.headerRight}>
        {rightAction && onRightAction ? (
          <Pressable
            onPress={() => {
              Haptics.tap();
              onRightAction();
            }}
            hitSlop={HIT.slop8}
            style={styles.headerActionBtn}
            accessibilityRole="button"
            accessibilityLabel={typeof rightAction === 'string' ? rightAction : 'Action'}
          >
            {rightIcon ? <Text style={styles.headerActionIcon}>{rightIcon}</Text> : null}
            {typeof rightAction === 'string' ? (
              <Text style={[TYPE.button, { color: colors.primary, fontWeight: '700' }]}>
                {rightAction}
              </Text>
            ) : (
              rightAction
            )}
          </Pressable>
        ) : null}
        {showAvatar ? (
          <Pressable
            onPress={() => {
              Haptics.tap();
              onAvatarPress?.();
            }}
            hitSlop={HIT.slop8}
            style={[styles.avatarCircle, { backgroundColor: colors.accentLight, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '800' }]}>
              {initials}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ============================================================================
// 2. BUTTONS (PRIMARY, SECONDARY, ICON)
// ============================================================================
export function PrimaryButton({
  title,
  onPress,
  icon,
  loading = false,
  disabled = false,
  size = 'md',
  style,
  textStyle,
}) {
  const colors = useThemeColors();
  const height = size === 'sm' ? 40 : size === 'lg' ? 52 : 46;

  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        Haptics.tap();
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          height,
          backgroundColor: disabled ? colors.border : colors.primary,
          opacity: pressed ? 0.88 : 1,
        },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
          <Text style={[TYPE.button, { color: '#FFFFFF', fontWeight: '700' }, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  title,
  onPress,
  icon,
  disabled = false,
  size = 'md',
  style,
  textStyle,
}) {
  const colors = useThemeColors();
  const height = size === 'sm' ? 40 : size === 'lg' ? 52 : 46;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.tap();
        onPress?.();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondaryButton,
        {
          height,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={title}
    >
      <View style={styles.buttonInner}>
        {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
        <Text style={[TYPE.button, { color: colors.text, fontWeight: '600' }, textStyle]}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, size = 44, variant = 'subtle', style }) {
  const colors = useThemeColors();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'accent'
      ? colors.accentLight
      : variant === 'surface'
      ? colors.surface
      : colors.surfaceMuted;
  const fg =
    variant === 'primary' ? '#FFFFFF' : variant === 'accent' ? colors.primary : colors.text;

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      hitSlop={HIT.slop8}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: RADIUS.medium,
          backgroundColor: bg,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {typeof icon === 'string' ? (
        <Text style={{ fontSize: 18, color: fg }}>{icon}</Text>
      ) : (
        icon
      )}
    </Pressable>
  );
}

// ============================================================================
// 3. STATUS BADGES & HEALTH SCORE
// ============================================================================
export function StatusBadge({ label, tone = 'neutral', icon, style }) {
  const colors = useThemeColors();
  const map = {
    success: { bg: colors.successSoft, fg: colors.success, dot: '●' },
    warning: { bg: colors.warningSoft, fg: colors.warning, dot: '●' },
    error: { bg: colors.errorSoft, fg: colors.danger, dot: '●' },
    danger: { bg: colors.errorSoft, fg: colors.danger, dot: '●' },
    info: { bg: colors.accentLight, fg: colors.primary, dot: '●' },
    neutral: { bg: colors.surfaceMuted, fg: colors.textMuted, dot: '○' },
  };
  const t = map[tone] || map.neutral;

  return (
    <View style={[styles.statusBadge, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.statusDot, { color: t.fg }]}>{icon || t.dot}</Text>
      <Text style={[TYPE.caption, { color: t.fg, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

export function HealthScore({ score = 100, label, size = 'md', style }) {
  const colors = useThemeColors();
  const num = Number(score) || 0;
  const isExcellent = num >= 85;
  const isWarning = num >= 60 && num < 85;
  const fg = isExcellent ? colors.success : isWarning ? colors.warning : colors.danger;
  const bg = isExcellent ? colors.successSoft : isWarning ? colors.warningSoft : colors.errorSoft;
  const textLabel = label || (isExcellent ? 'Healthy' : isWarning ? 'Attention' : 'Urgent');

  return (
    <View style={[styles.healthScoreWrap, { backgroundColor: bg }, style]}>
      <Text style={[TYPE.label, { color: fg, fontWeight: '800' }]}>{num}</Text>
      <Text style={[TYPE.caption, { color: fg, fontWeight: '700', marginLeft: 4 }]}>
        {textLabel}
      </Text>
    </View>
  );
}

export function ConfidenceBadge({ tier = 'VERIFIED', confidence = 0.95, style }) {
  const colors = useThemeColors();
  const isHigh = tier === 'HIGH_CONFIDENCE' || (tier !== 'VERIFIED' && confidence >= 0.85 && tier !== 'NEEDS_REVIEW');
  const isVerified = tier === 'VERIFIED';
  const isMed = tier === 'PROBABLE' || tier === 'NEEDS_REVIEW' || (confidence >= 0.6 && confidence < 0.85);

  if (tier === 'NOT_FOUND' || tier === 'EMPTY') {
    return (
      <View style={[styles.confidenceBadge, { backgroundColor: colors.surfaceMuted }, style]}>
        <Text style={[TYPE.caption, { color: colors.textMuted }]}>Not found</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.confidenceBadge,
        { backgroundColor: isVerified || isHigh ? colors.successSoft : isMed ? colors.warningSoft : colors.errorSoft },
        style,
      ]}
    >
      <Text
        style={[
          TYPE.caption,
          { color: isVerified || isHigh ? colors.success : isMed ? colors.warning : colors.danger, fontWeight: '700' },
        ]}
      >
        {isVerified ? 'Verified' : isHigh ? 'High confidence' : isMed ? 'Please verify' : 'Review'}
      </Text>
    </View>
  );
}

// ============================================================================
// 4. ROWS (ASSET ROW, DOCUMENT ROW, ALERT ROW)
// ============================================================================
export function AssetRow({
  item,
  title,
  subtitle,
  registration,
  statusText,
  statusTone = 'success',
  healthScore = 100,
  iconKey,
  onPress,
  style,
}) {
  const colors = useThemeColors();
  const name = title || item?.assetName || item?.nickname || 'Asset';
  const reg = registration || item?.registration || item?.serialNumber || item?.model;
  const icon = iconKey || item?.categoryId || item?.icon || 'car';
  const rawScore = typeof healthScore === 'object' ? healthScore?.score : healthScore;
  const score = Number.isFinite(rawScore) ? rawScore : (item?.healthScore ?? 100);

  // Deduplicate metadata tokens (e.g. prevent "UP32QU2187 · UP32QU2187 · Bike")
  let metaLine = '';
  if (subtitle) {
    // If subtitle already has the registration/identifier, use subtitle directly
    if (reg && subtitle.includes(reg)) {
      metaLine = subtitle;
    } else if (reg) {
      metaLine = `${reg} · ${subtitle}`;
    } else {
      metaLine = subtitle;
    }
  } else {
    const parts = [];
    if (reg) parts.push(reg);
    if (item?.categoryLabel || item?.category) parts.push(item.categoryLabel || item.category);
    metaLine = parts.join(' · ') || 'Protected';
  }

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.(item);
      }}
      style={({ pressed }) => [
        styles.assetRowCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${metaLine}`}
    >
      <View style={[styles.assetIconBox, { backgroundColor: colors.accentLight }]}>
        <CategoryIcon category={icon} size={22} color={colors.primary} />
      </View>

      <View style={styles.assetRowContent}>
        <Text style={[TYPE.h3, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {metaLine}
        </Text>
        {statusText ? (
          <View style={{ marginTop: 4 }}>
            <StatusBadge label={statusText} tone={statusTone} />
          </View>
        ) : null}
      </View>

      <View style={styles.assetRowRight}>
        <HealthScore score={score} />
        <Text style={[styles.rowChevron, { color: colors.textMuted }]}>›</Text>
      </View>
    </Pressable>
  );
}

export function DocumentRow({
  documentType,
  assetName,
  identifier,
  dateText,
  verified = true,
  onPress,
  style,
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.docRowCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${documentType}, ${assetName}`}
    >
      <View style={[styles.docIconBox, { backgroundColor: colors.accentLight }]}>
        <Text style={{ fontSize: 18, color: colors.primary }}>📄</Text>
      </View>

      <View style={styles.docRowContent}>
        <Text style={[TYPE.h3, { color: colors.text }]} numberOfLines={1}>
          {documentType}
        </Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {assetName}
          {identifier ? ` · ${identifier}` : ''}
        </Text>
        {dateText ? (
          <Text style={[TYPE.bodySmall, { color: colors.textMuted, marginTop: 3 }]}>
            {dateText}
          </Text>
        ) : null}
      </View>

      <View style={styles.docRowRight}>
        {verified ? (
          <StatusBadge label="Verified" tone="success" icon="✓" />
        ) : (
          <StatusBadge label="Review" tone="warning" icon="⚠" />
        )}
        <Text style={[styles.rowChevron, { color: colors.textMuted, marginTop: 4 }]}>›</Text>
      </View>
    </Pressable>
  );
}

export function AlertRow({
  title,
  subtitle,
  daysLeft,
  actionLabel = 'Review →',
  onAction,
  priority = 'warning',
  style,
}) {
  const colors = useThemeColors();
  const isUrgent = daysLeft != null && daysLeft <= 7;
  const tone = isUrgent ? 'error' : priority === 'error' ? 'error' : 'warning';
  const fg = tone === 'error' ? colors.danger : colors.warning;
  const bg = tone === 'error' ? colors.errorSoft : colors.warningSoft;

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onAction?.();
      }}
      style={({ pressed }) => [
        styles.alertRowCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle || ''}`}
    >
      <View style={[styles.alertIconBox, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 16, color: fg }}>{isUrgent ? '⚠' : '⏰'}</Text>
      </View>

      <View style={styles.alertRowContent}>
        <Text style={[TYPE.h3, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {daysLeft != null ? (
          <Text style={[TYPE.bodySmall, { color: fg, fontWeight: '700', marginTop: 3 }]}>
            {daysLeft < 0
              ? `${Math.abs(daysLeft)}d overdue`
              : daysLeft === 0
              ? 'Due today'
              : `Expires in ${daysLeft} days`}
          </Text>
        ) : null}
      </View>

      <View style={styles.alertRowRight}>
        <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>
          {actionLabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ============================================================================
// 5. SECTION HEADERS & FILTER CHIPS & SEARCH
// ============================================================================
export function SectionHeader({ title, subtitle, actionLabel, onAction, style }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.sectionHeaderWrap, style]}>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.label, { color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' }]}>
          {title}
        </Text>
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
        >
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>
            {actionLabel}
          </Text>
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
        styles.filterChip,
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
      {icon ? <Text style={{ marginRight: 6 }}>{icon}</Text> : null}
      <Text
        style={[
          TYPE.caption,
          { color: selected ? colors.primary : colors.textMuted, fontWeight: selected ? '700' : '600' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SearchBar({ value, onChangeText, placeholder = 'Search...', onClear, style }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.searchBarWrap,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <Text style={{ fontSize: 16, color: colors.textMuted, marginRight: 8 }}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.searchInput, { color: colors.text }]}
        autoCorrect={false}
        returnKeyType="search"
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
          <Text style={{ fontSize: 14, color: colors.textMuted, paddingHorizontal: 4 }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ============================================================================
// 6. STATES (EMPTY, LOADING, ERROR)
// ============================================================================
export function EmptyState({ title, message, ctaLabel, onCta, icon = '📦', style }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.emptyStateCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        elevation(1, colors.shadow),
        style,
      ]}
    >
      <Text style={styles.emptyStateIcon}>{icon}</Text>
      <Text style={[TYPE.h2, { color: colors.text, textAlign: 'center', marginTop: 12 }]}>
        {title}
      </Text>
      {message ? (
        <Text
          style={[
            TYPE.body,
            { color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 20 },
          ]}
        >
          {message}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <PrimaryButton
          title={ctaLabel}
          onPress={onCta}
          style={{ marginTop: 16, minWidth: 160 }}
          size="sm"
        />
      ) : null}
    </View>
  );
}

export function LoadingState({ message = 'Loading...', style }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.centerState, style]}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 8 }]}>{message}</Text>
    </View>
  );
}

// ============================================================================
// 7. EXTRACTION & REVIEW FIELD
// ============================================================================
export function ExtractionField({
  label,
  value,
  confidence = 0.95,
  tier = 'VERIFIED',
  editable = true,
  onPress,
  style,
}) {
  const colors = useThemeColors();
  const displayVal = value != null && value !== '' ? String(value) : null;

  return (
    <Pressable
      onPress={() => {
        if (editable) {
          Haptics.tap();
          onPress?.();
        }
      }}
      style={({ pressed }) => [
        styles.extractionFieldRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${displayVal || 'Not found'}`}
    >
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.caption, { color: colors.textMuted }]}>{label}</Text>
        <Text
          style={[
            TYPE.h3,
            { color: displayVal ? colors.text : colors.textMuted, marginTop: 2 },
          ]}
          numberOfLines={2}
        >
          {displayVal || '— Not found on bill'}
        </Text>
      </View>
      <View style={{ marginLeft: 8, alignItems: 'flex-end' }}>
        <ConfidenceBadge tier={displayVal ? tier : 'NOT_FOUND'} confidence={confidence} />
        {editable && displayVal ? (
          <Text style={[TYPE.micro, { color: colors.primary, marginTop: 4, fontWeight: '700' }]}>
            Edit
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ============================================================================
// 8. METRIC CARD & TIMELINE ITEM
// ============================================================================
export function MetricCard({ title, value, subtitle, icon, tone = 'neutral', style }) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.metricCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        elevation(1, colors.shadow),
        style,
      ]}
    >
      <View style={styles.metricHeader}>
        <Text style={[TYPE.label, { color: colors.textMuted, textTransform: 'uppercase' }]}>
          {title}
        </Text>
        {icon ? <Text style={{ fontSize: 16 }}>{icon}</Text> : null}
      </View>
      <Text style={[TYPE.metric, { color: colors.text, marginTop: 6 }]}>{value}</Text>
      {subtitle ? (
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function TimelineItem({ date, title, subtitle, status = 'completed', isLast = false, style }) {
  const colors = useThemeColors();

  return (
    <View style={[styles.timelineRow, style]}>
      <View style={styles.timelineLeft}>
        <View
          style={[
            styles.timelineDot,
            { backgroundColor: status === 'completed' ? colors.primary : colors.border },
          ]}
        />
        {!isLast ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
      </View>

      <View style={styles.timelineBody}>
        <Text style={[TYPE.caption, { color: colors.textMuted, fontWeight: '700' }]}>{date}</Text>
        <Text style={[TYPE.h3, { color: colors.text, marginTop: 2 }]}>{title}</Text>
        {subtitle ? (
          <Text style={[TYPE.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  headerActionIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  primaryButton: {
    borderRadius: RADIUS.medium,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  secondaryButton: {
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: RADIUS.small,
    alignSelf: 'flex-start',
  },
  statusDot: {
    fontSize: 8,
    marginRight: 4,
  },
  healthScoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: RADIUS.small,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.small,
  },
  assetRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  assetIconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  assetRowContent: {
    flex: 1,
  },
  assetRowRight: {
    alignItems: 'flex-end',
    marginLeft: SPACING.xs,
  },
  rowChevron: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  docRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  docRowContent: {
    flex: 1,
  },
  docRowRight: {
    alignItems: 'flex-end',
    marginLeft: SPACING.xs,
  },
  alertRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  alertIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  alertRowContent: {
    flex: 1,
  },
  alertRowRight: {
    marginLeft: SPACING.xs,
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.xs,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    height: 42,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  emptyStateCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.large,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.sm,
  },
  emptyStateIcon: {
    fontSize: 36,
  },
  centerState: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractionFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  metricCard: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  timelineLeft: {
    width: 20,
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  timelineBody: {
    flex: 1,
  },
});

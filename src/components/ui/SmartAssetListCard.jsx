/**
 * Intelligent asset list card — shows type-relevant fields only.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { CategoryIcon } from '../icons/CategoryIcon';
import { StatusBadge } from './DesignSystem';
import { useThemeColors } from '../../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';
import { buildSmartAssetCard } from '../../services/assets/smartAssetCard';
import { getAssetHealthStatus } from '../../utils/assetHealthStatus';
import { calculateHealthScore } from '../../utils/healthScore';
import { Haptics } from '../../services/haptics';
import { daysUntil } from '../../utils/dates';

function healthTone(score) {
  if (score >= 80) return 'success';
  if (score >= 55) return 'warning';
  return 'error';
}

function serviceLine(asset) {
  const d = daysUntil(asset.nextServiceDue);
  if (d == null) return null;
  if (d < 0) return { label: 'Service', value: 'Overdue', tone: 'error' };
  if (d <= 15) return { label: 'Next service', value: `${d}d`, tone: 'warning' };
  return { label: 'Next service', value: String(asset.nextServiceDue).slice(0, 10), tone: 'info' };
}

export function SmartAssetListCard({ asset, onPress, onLongPress, style }) {
  const colors = useThemeColors();
  const smart = useMemo(() => buildSmartAssetCard(asset), [asset]);
  const score = useMemo(() => {
    try {
      return Number(calculateHealthScore(asset)?.score) || 0;
    } catch {
      return 0;
    }
  }, [asset]);
  const healthStatus = useMemo(() => {
    try {
      return getAssetHealthStatus(asset);
    } catch {
      return null;
    }
  }, [asset]);

  const lines = useMemo(() => {
    const out = [...(smart.lines || [])];
    const svc = serviceLine(asset);
    if (svc && !out.some((l) => /service/i.test(l.label))) {
      out.unshift(svc);
    }
    return out.slice(0, 3);
  }, [smart.lines, asset]);

  const category =
    asset.categoryLabel || asset.category || smart.assetCategory || 'Asset';

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.(asset);
      }}
      onLongPress={onLongPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        elevation(1, colors.shadow),
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${smart.title}, ${category}, health ${score}`}
    >
      <View style={styles.top}>
        <CategoryIcon name={asset.categoryId || asset.icon || 'other'} size={40} />
        <View style={styles.meta}>
          <Text style={[TYPE.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {smart.title}
          </Text>
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {[category, smart.locationPath || smart.subtitle].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <StatusBadge
          label={healthStatus?.label || `${score}`}
          tone={healthTone(score)}
          icon="♥"
        />
      </View>
      {lines.length ? (
        <View style={styles.lines}>
          {lines.map((line) => (
            <View key={`${line.label}-${line.value}`} style={styles.lineRow}>
              <Text style={[TYPE.micro, { color: colors.textMuted }]}>{line.label}</Text>
              <Text
                style={[
                  TYPE.caption,
                  {
                    color:
                      line.tone === 'warn' || line.tone === 'error'
                        ? colors.warning
                        : line.tone === 'ok'
                          ? colors.success
                          : colors.text,
                    fontWeight: '600',
                  },
                ]}
                numberOfLines={1}
              >
                {line.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { flex: 1, minWidth: 0 },
  lines: {
    marginTop: SPACING.sm,
    gap: 6,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(100,116,139,0.25)',
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});

export default SmartAssetListCard;

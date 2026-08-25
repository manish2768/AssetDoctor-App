/**
 * Intelligent asset list card — category-aware health + one next action.
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
import {
  assetCategoryChip,
  primaryNextActionLine,
} from '../../utils/nextActionUi';

function healthTone(score) {
  if (score >= 80) return 'success';
  if (score >= 55) return 'warning';
  return 'error';
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

  const nextLine = useMemo(() => primaryNextActionLine(asset), [asset]);
  const family = useMemo(() => assetCategoryChip(asset), [asset]);
  const brandModel = [asset.brandName || asset.brand, asset.model]
    .filter(Boolean)
    .join(' ')
    .trim();

  const category =
    asset.categoryLabel || asset.category || family || smart.assetCategory || 'Asset';

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
      accessibilityLabel={`${smart.title}, ${category}, health ${score}${nextLine ? `, ${nextLine}` : ''}`}
    >
      <View style={styles.top}>
        <CategoryIcon name={asset.categoryId || asset.icon || 'other'} size={44} />
        <View style={styles.meta}>
          <Text style={[TYPE.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {smart.title}
          </Text>
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {[category, brandModel || smart.subtitle].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.scoreWrap}>
          <Text style={[TYPE.metric, { color: colors.text, fontSize: 20 }]}>{score}</Text>
          <StatusBadge
            label={healthStatus?.label || (score >= 80 ? 'Healthy' : 'Check')}
            tone={healthTone(score)}
          />
        </View>
      </View>
      {nextLine ? (
        <View
          style={[
            styles.next,
            { backgroundColor: colors.infoSoft || colors.surfaceMuted },
          ]}
        >
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]} numberOfLines={1}>
            {nextLine}
          </Text>
        </View>
      ) : (
        <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 10 }]}>
          No urgent action
        </Text>
      )}
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  meta: { flex: 1, minWidth: 0 },
  scoreWrap: { alignItems: 'flex-end', gap: 4 },
  next: {
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
});

export default SmartAssetListCard;

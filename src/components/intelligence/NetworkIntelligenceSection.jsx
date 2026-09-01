/**
 * Network Intelligence Section — user-facing NIG card block for the Home dashboard.
 *
 * Presentation only. Reuses the existing NetworkIntelligenceService (the NIG engine).
 * Never recreates the engine, never writes to Firestore, and never invents data —
 * values are shown exactly as the service reports them, always labelled ESTIMATED.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { useAssets } from '../../context/AssetProvider';
import { Haptics } from '../../services/haptics';
import { buildNetworkIntelligence } from '../../services/intelligence/NetworkIntelligenceService';
import { formatINR } from '../../utils/format';
import {
  SectionHeader,
  StatusBadge,
  PremiumIcon,
  PremiumCard,
} from '../../design-system';
import { RADIUS, SPACING, TYPE } from '../../theme/tokens';

/** ~ prefix + ESTIMATED label for every estimate we render. */
function EstimatedLabel({ colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <StatusBadge label="ESTIMATED" tone="info" />
    </View>
  );
}

/** Small labelled metric tile used for daily / monthly kWh and cost. */
function NigMetric({ title, value, subtitle, colors }) {
  return (
    <View style={[styles.metric, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[TYPE.micro, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[TYPE.h2, { color: colors.text, marginTop: 4 }]} numberOfLines={1}>
        {value}
      </Text>
      {subtitle ? (
        <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function NetworkIntelligenceSection({ navigation, style }) {
  const colors = useThemeColors();
  const { assets, loading } = useAssets();

  const nig = useMemo(() => buildNetworkIntelligence(assets || []), [assets]);

  // Real rooms only — the service emits an "unassigned" bucket when an asset has no
  // roomId; that is not a room, so we never present it as one (no invented data).
  const rooms = useMemo(
    () => (nig.byRoom || []).filter((r) => r.roomId),
    [nig.byRoom],
  );
  const top = nig.highestConsumer || null;
  const evs = nig.estimateVsActual || {};

  // Only render when there is something honest to show (assets with real energy data).
  const hasEnergy = nig.hasConsumption || nig.assetsWithEnergy > 0;
  if (loading || (!hasEnergy && !(nig.assetsNeedingInputs > 0))) return null;

  const dailyKwh = nig.totalDailyKwh > 0 ? `${nig.displayPrefix}${nig.totalDailyKwh} kWh` : '—';
  const monthlyKwh =
    nig.totalMonthlyKwh > 0 ? `${nig.displayPrefix}${nig.totalMonthlyKwh} kWh` : '—';
  const monthlyCost =
    nig.totalMonthlyCost > 0
      ? `${nig.displayPrefix}${formatINR(nig.totalMonthlyCost)}`
      : '—';

  return (
    <View style={style}>
      <SectionHeader
        title="Network Intelligence"
        subtitle="Estimated household energy graph (usage assumptions apply)"
      />

      <PremiumCard level={2} accessibilityLabel="Network intelligence, estimated energy usage">
        <View style={styles.headRow}>
          <View style={{ flex: 1, marginRight: SPACING.sm }}>
            <Text style={[TYPE.label, { color: colors.textMuted }]}>
              ⚡ HOME ENERGY NETWORK
            </Text>
            <Text style={[TYPE.h3, { color: colors.text, marginTop: 4 }]}>
              {nig.assetCount} tracked
              {nig.assetsWithEnergy > 0 ? ` · ${nig.assetsWithEnergy} with energy data` : ''}
            </Text>
          </View>
          <EstimatedLabel colors={colors} />
        </View>

        <View style={styles.metricRow}>
          <NigMetric title="Daily" value={dailyKwh} subtitle="est." colors={colors} />
          <NigMetric title="Monthly" value={monthlyKwh} subtitle="est." colors={colors} />
          <NigMetric title="Monthly cost" value={monthlyCost} subtitle="est." colors={colors} />
        </View>

        {nig.tariffResolved ? (
          <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 8 }]}>
            Tariff {nig.tariffResolved.unit || '₹/kWh'} @ ~{nig.tariffResolved.value} ·{' '}
            {nig.tariffResolved.source === 'asset-electricity-tariff'
              ? 'from asset tariff'
              : 'platform default'}
          </Text>
        ) : null}
        <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 4 }]}>
          {nig.calculationLabel || 'Estimated home energy (usage assumptions apply)'}
        </Text>
      </PremiumCard>

      {top && top.monthlyKwh > 0 ? (
        <Pressable
          onPress={() => {
            if (!top.assetId) return;
            Haptics.tap();
            navigation?.navigate?.('AssetPassport', { assetId: top.assetId });
          }}
          disabled={!top.assetId}
          style={({ pressed }) => [
            styles.topCard,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
          ]}
          accessibilityRole={top.assetId ? 'button' : 'summary'}
          accessibilityLabel={`Top energy consumer ${top.displayName}, about ${top.monthlyKwh} kilowatt hours per month`}
        >
          <View style={[styles.topIcon, { backgroundColor: colors.accentLight }]}>
            <PremiumIcon name="zap" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Text style={[TYPE.micro, { color: colors.textMuted }]}>TOP ENERGY CONSUMER</Text>
            <Text style={[TYPE.bodyStrong, { color: colors.text, marginTop: 2 }]} numberOfLines={1}>
              {top.displayName}
            </Text>
            <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]}>
              ~{top.monthlyKwh} kWh/mo · {top.consumptionSharePct}% of network
            </Text>
          </View>
          <PremiumIcon name="chevron" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {rooms.length > 0 ? (
        <View>
          <Text style={[TYPE.label, { color: colors.textMuted, marginTop: SPACING.md, marginBottom: SPACING.xs }]}>
            ROOM-WISE CONSUMPTION
          </Text>
          <View style={styles.roomRow}>
            {rooms.slice(0, 4).map((room) => (
              <View
                key={room.roomId}
                style={[styles.roomCell, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                accessibilityLabel={`${room.displayName} about ${room.monthlyKwh} kilowatt hours per month`}
              >
                <PremiumIcon name="house" size={14} color={colors.primary} />
                <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700', marginTop: 6 }]} numberOfLines={1}>
                  {room.displayName}
                </Text>
                <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>
                  ~{room.monthlyKwh} kWh/mo
                </Text>
                <Text style={[TYPE.micro, { color: colors.textMuted }]}>
                  {room.assetCount} asset{room.assetCount === 1 ? '' : 's'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {evs.available && evs.applianceKwh != null && evs.billKwh != null ? (
        <View
          style={[styles.effCard, { backgroundColor: colors.surfaceMuted }]}
          accessibilityRole="summary"
          accessibilityLabel="Energy efficiency comparison"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <PremiumIcon name="chart" size={16} color={colors.info} />
            <Text style={[TYPE.label, { color: colors.textMuted, marginLeft: 6 }]}>ENERGY EFFICIENCY</Text>
          </View>
          <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 6, lineHeight: 18 }]}>
            {evs.gapPct > 0
              ? `Appliance estimate (~${evs.applianceKwh} kWh) is ${evs.gapPct}% below your real electricity bill (~${evs.billKwh} kWh).`
              : evs.gapPct < 0
                ? `Appliance estimate (~${evs.applianceKwh} kWh) is ${Math.abs(evs.gapPct)}% above your real bill (~${evs.billKwh} kWh).`
                : `Appliance estimate (~${evs.applianceKwh} kWh) matches your real bill (~${evs.billKwh} kWh).`}
          </Text>
        </View>
      ) : null}

      {nig.assetsNeedingInputs > 0 ? (
        <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: SPACING.sm }]}>
          {nig.assetsNeedingInputs} energy-capable asset
          {nig.assetsNeedingInputs === 1 ? ' needs' : 's need'} wattage/usage inputs before its
          usage can be estimated.
        </Text>
      ) : null}
    </View>
  );
}

export default NetworkIntelligenceSection;

const styles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  metric: {
    flex: 1,
    minWidth: 96,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  topCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  topIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  roomCell: {
    width: '48%',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  effCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
  },
});

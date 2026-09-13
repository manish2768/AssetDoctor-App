/**
 * Asset Doctor — Master Asset Financial & Lifetime Analytics Screen.
 * Transforms recorded & calculated figures into a premium financial intelligence dashboard.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { OfflineVaultCache } from '../../services/offline/OfflineVaultCache';
import { buildAssetAnalytics } from '../../services/finance/assetAnalyticsEngine';
import { ANALYTICS_DATE_RANGES } from '../../services/finance/dateRangeFilter';
import { formatInr } from '../../services/finance/financeConstants';
import { Haptics } from '../../services/haptics';
import { formatINRCompact } from '../../utils/format';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';
import { IconButton, PremiumIcon } from '../../design-system';
import { SecondaryButton } from '../../components/design-system';

const RANGE_CHIPS = [
  { key: ANALYTICS_DATE_RANGES.THIS_MONTH, label: 'Month' },
  { key: ANALYTICS_DATE_RANGES.LAST_3_MONTHS, label: '3M' },
  { key: ANALYTICS_DATE_RANGES.LAST_6_MONTHS, label: '6M' },
  { key: ANALYTICS_DATE_RANGES.THIS_YEAR, label: 'Year' },
  { key: ANALYTICS_DATE_RANGES.ALL, label: 'All Time' },
];

function Row({ label, value, source, onPress }) {
  const colors = useThemeColors();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {source ? <Text style={[styles.source, { color: colors.textMuted }]}>{source}</Text> : null}
      </View>
      <Text style={[styles.rowValue, { color: colors.primary }]}>{value}</Text>
    </Pressable>
  );
}

function SimpleBars({ series, colors }) {
  if (!series?.length) {
    return <Text style={[styles.emptyChart, { color: colors.textMuted }]}>Insufficient data for trend chart</Text>;
  }
  const max = Math.max(...series.map((s) => s.total || 0), 1);
  return (
    <View style={styles.chartWrap}>
      {series.slice(-12).map((s) => {
        const h = Math.max(6, Math.round(((s.total || 0) / max) * 80));
        return (
          <View key={s.month} style={styles.barCol}>
            <View style={[styles.barFill, { height: h, backgroundColor: colors.primary }]} />
            <Text style={[styles.barLabel, { color: colors.textMuted }]}>{String(s.month).slice(5)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function AssetAnalyticsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const routeAssetId = route?.params?.assetId;
  const { user } = useAuth();
  const { assets, getAsset } = useAssets();

  const [selectedAsset, setSelectedAsset] = useState(() => {
    if (!routeAssetId) return null;
    return getAsset?.(routeAssetId) || (assets || []).find((a) => (a.assetId || a.id) === routeAssetId) || null;
  });

  useEffect(() => {
    if (routeAssetId) {
      const found = getAsset?.(routeAssetId) || (assets || []).find((a) => (a.assetId || a.id) === routeAssetId);
      setSelectedAsset(found || null);
    } else {
      setSelectedAsset(null);
    }
  }, [routeAssetId, assets, getAsset]);

  const asset = selectedAsset;
  const assetId = (asset && (asset.assetId || asset.id)) || null;

  const [expenseRows, setExpenseRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(ANALYTICS_DATE_RANGES.ALL);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.uid || !assetId) {
        setLoading(false);
        return;
      }
      try {
        const rows = await OfflineVaultCache.listRepairLogs(user.uid, assetId);
        if (!cancelled) setExpenseRows(rows || []);
      } catch {
        if (!cancelled) setExpenseRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, assetId]);

  const analytics = useMemo(() => {
    if (!asset) return null;
    return buildAssetAnalytics(asset, {
      repairRows: expenseRows,
      userId: asset.ownerUid || asset.uid || user?.uid,
      dateRangeKey: dateRange,
    });
  }, [asset, expenseRows, user?.uid, dateRange]);

  if (!asset) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={[TYPE.h2, { color: colors.text, marginBottom: 8 }]}>Select an Asset</Text>
        <Text style={[TYPE.body, { color: colors.textMuted, textAlign: 'center', marginBottom: 20 }]}>
          Select an asset to view financial, depreciation and lifetime analytics.
        </Text>
        <SecondaryButton title="Back to Assets" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (loading || !analytics) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const purchaseVal = Number(analytics.purchase.value || 0);
  const currentVal = Number(analytics.currentEstimated.value || analytics.depreciation.bookValue || 0);
  const depreciationVal = purchaseVal > currentVal ? purchaseVal - currentVal : 0;
  const costPerMonth = Number(analytics.period?.costPerMonth || 0);
  const costPerYear = Number(analytics.period?.costPerYear || 0);

  const openMaintenance = (bucket) => {
    Haptics.tap();
    navigation.navigate('Maintenance', { assetId, filterBucket: bucket });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 8) }]}>
        <IconButton
          icon={<PremiumIcon name="arrow-left" size={18} color={colors.text} />}
          label="Back"
          onPress={() => navigation.goBack()}
          variant="surface"
          size={44}
        />
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={[TYPE.h3, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
            {analytics.name}
          </Text>
          <Text style={[TYPE.micro, { color: colors.textMuted }]}>Financial Intelligence</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Range Chips */}
        <View style={styles.chipRow}>
          {RANGE_CHIPS.map((c) => (
            <Pressable
              key={c.key}
              style={[
                styles.chip,
                {
                  backgroundColor: dateRange === c.key ? colors.accentLight : colors.surface,
                  borderColor: dateRange === c.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.tap();
                setDateRange(c.key);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: dateRange === c.key ? colors.primary : colors.textMuted },
                  dateRange === c.key && { fontWeight: '700' },
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Hero Value Card */}
        <View style={[styles.heroCard, { backgroundColor: '#07111F', borderColor: 'rgba(15,143,135,0.25)' }]}>
          <Text style={styles.heroLabel}>CURRENT ESTIMATED VALUE</Text>
          <Text style={styles.heroValue}>₹{formatINRCompact(currentVal)}</Text>
          {depreciationVal > 0 ? (
            <Text style={styles.heroSub}>
              ↓ ₹{formatINRCompact(depreciationVal)} ({Math.round((depreciationVal / (purchaseVal || 1)) * 100)}%) since purchase
            </Text>
          ) : (
            <Text style={styles.heroSub}>Stable valuation in vault</Text>
          )}

          {/* Metric Quad */}
          <View style={styles.quadGrid}>
            <View style={styles.quadItem}>
              <Text style={styles.quadLabel}>Purchase</Text>
              <Text style={styles.quadVal}>₹{formatINRCompact(purchaseVal)}</Text>
            </View>
            <View style={styles.quadItem}>
              <Text style={styles.quadLabel}>Current</Text>
              <Text style={styles.quadVal}>₹{formatINRCompact(currentVal)}</Text>
            </View>
            <View style={styles.quadItem}>
              <Text style={styles.quadLabel}>Depreciation</Text>
              <Text style={styles.quadVal}>₹{formatINRCompact(depreciationVal)}</Text>
            </View>
            <View style={styles.quadItem}>
              <Text style={styles.quadLabel}>Ownership</Text>
              <Text style={styles.quadVal}>{analytics.age?.label || '1y'}</Text>
            </View>
          </View>
        </View>

        {/* Ownership Cost Summary */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(1, colors.shadow)]}>
          <Text style={[TYPE.label, { color: colors.textMuted, marginBottom: 8 }]}>OWNERSHIP RUNNING COST</Text>
          <View style={styles.ownershipRow}>
            <View style={{ flex: 1 }}>
              <Text style={[TYPE.h2, { color: colors.text, fontWeight: '700' }]}>
                ₹{formatINRCompact(costPerMonth)}
              </Text>
              <Text style={[TYPE.micro, { color: colors.textMuted }]}>Estimated / month</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[TYPE.h2, { color: colors.text, fontWeight: '700' }]}>
                ₹{formatINRCompact(costPerYear)}
              </Text>
              <Text style={[TYPE.micro, { color: colors.textMuted }]}>Annualized rate</Text>
            </View>
          </View>
        </View>

        {/* Cost Breakdown */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(1, colors.shadow)]}>
          <Text style={[TYPE.label, { color: colors.textMuted, marginBottom: 8 }]}>EXPENSE BREAKDOWN</Text>
          {['purchase', 'service', 'repair', 'insurance', 'maintenance', 'total'].map((k) => {
            const b = analytics.breakdown[k];
            if (!b) return null;
            return (
              <Row
                key={k}
                label={b.label}
                value={b.value != null ? `₹${formatINRCompact(b.value)}` : '—'}
                source={b.source}
                onPress={k !== 'purchase' && k !== 'total' ? () => openMaintenance(k) : undefined}
              />
            );
          })}
        </View>

        {/* Cost Trend */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(1, colors.shadow)]}>
          <Text style={[TYPE.label, { color: colors.textMuted, marginBottom: 12 }]}>MAINTENANCE & COST TREND</Text>
          <SimpleBars series={analytics.costTrendSeries} colors={colors} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
    marginTop: 4,
  },
  quadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  quadItem: {
    width: '50%',
    marginBottom: 8,
  },
  quadLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  quadVal: {
    fontSize: 15,
    color: '#F8FAFC',
    fontWeight: '700',
    marginTop: 2,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  ownershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  source: {
    fontSize: 10,
    marginTop: 2,
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 90,
    paddingTop: 10,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barFill: {
    width: 14,
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 9,
    marginTop: 4,
  },
  emptyChart: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
});

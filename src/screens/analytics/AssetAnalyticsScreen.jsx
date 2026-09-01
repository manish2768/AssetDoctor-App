/**
 * STEP 10 — Asset Analytics screen (financial + lifecycle + trends + charts).
 * Uses only recorded / calculated-labeled values.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { OfflineVaultCache } from '../../services/offline/OfflineVaultCache';
import { buildAssetAnalytics, compareAssets } from '../../services/finance/assetAnalyticsEngine';
import { ANALYTICS_DATE_RANGES } from '../../services/finance/dateRangeFilter';
import { buildLocationAnalytics } from '../../services/finance/locationAnalytics';
import { buildAnalyticsExportPayload } from '../../services/finance/analyticsExport';
import { formatInr } from '../../services/finance/financeConstants';
import { Haptics } from '../../services/haptics';
import { COLORS } from '../../theme/branding';

const RANGE_CHIPS = [
  { key: ANALYTICS_DATE_RANGES.THIS_MONTH, label: 'Month' },
  { key: ANALYTICS_DATE_RANGES.LAST_3_MONTHS, label: '3M' },
  { key: ANALYTICS_DATE_RANGES.LAST_6_MONTHS, label: '6M' },
  { key: ANALYTICS_DATE_RANGES.THIS_YEAR, label: 'Year' },
  { key: ANALYTICS_DATE_RANGES.ALL, label: 'All' },
];

function Row({ label, value, source, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {source ? <Text style={styles.source}>{source}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </Pressable>
  );
}

function SimpleBars({ series }) {
  if (!series?.length) {
    return <Text style={styles.emptyChart}>Insufficient data for chart</Text>;
  }
  const max = Math.max(...series.map((s) => s.total || 0), 1);
  return (
    <View style={styles.chartWrap}>
      {series.slice(-12).map((s) => {
        const h = Math.max(4, Math.round(((s.total || 0) / max) * 96));
        return (
          <View key={s.month} style={styles.barCol}>
            <View style={[styles.barFill, { height: h }]} />
            <Text style={styles.barLabel}>{String(s.month).slice(5)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function AssetAnalyticsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
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
  const [expenseRowsByAsset, setExpenseRowsByAsset] = useState({});
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

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid;
    if (!uid || !assets?.length) {
      setExpenseRowsByAsset({});
      return undefined;
    }
    (async () => {
      const folder = String(
        (getAsset?.(assetId) || assets.find((a) => (a.assetId || a.id) === assetId))?.categoryId ||
          '',
      ).toLowerCase();
      const similar = assets
        .filter((a) => !a.deletedAt && String(a.categoryId || '').toLowerCase() === folder)
        .slice(0, 5);
      const map = {};
      await Promise.all(
        similar.map(async (a) => {
          const id = a.assetId || a.id;
          try {
            map[id] = (await OfflineVaultCache.listRepairLogs(uid, id)) || [];
          } catch {
            map[id] = [];
          }
        }),
      );
      if (!cancelled) setExpenseRowsByAsset(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, assets, assetId, getAsset]);

  const analytics = useMemo(() => {
    if (!asset) return null;
    return buildAssetAnalytics(asset, {
      expenseRows,
      actorUserId: user?.uid,
      userId: asset.ownerUid || asset.uid || user?.uid,
      dateRange,
    });
  }, [asset, expenseRows, user?.uid, dateRange]);

  const peers = useMemo(() => {
    if (!asset) return null;
    const folder = String(asset.categoryId || '').toLowerCase();
    const similar = assets
      .filter((a) => !a.deletedAt && String(a.categoryId || '').toLowerCase() === folder)
      .slice(0, 5);
    if (similar.length < 2) return null;
    return compareAssets(similar, {
      actorUserId: user?.uid,
      expenseRowsByAsset,
    });
  }, [asset, assets, user?.uid, expenseRowsByAsset]);

  const locationSpend = useMemo(() => {
    if (!asset?.categoryId) return null;
    const same = assets.filter(
      (a) => !a.deletedAt && String(a.categoryId) === String(asset.categoryId),
    );
    return buildLocationAnalytics(same, {
      actorUserId: user?.uid,
      expenseRowsByAsset,
    });
  }, [asset, assets, user?.uid, expenseRowsByAsset]);

  if (!asset) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingHorizontal: 16 }]}>
        <Text style={styles.heading}>Asset Analytics</Text>
        <Text style={[styles.muted, { marginTop: 4, marginBottom: 16 }]}>
          Select an asset to view financial & lifetime analytics.
        </Text>
        {assets && assets.length > 0 ? (
          <ScrollView style={{ marginTop: 8 }}>
            {assets.map((item) => (
              <Pressable
                key={item.assetId || item.id}
                onPress={() => setSelectedAsset(item)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderWidth: 1,
                  padding: 14,
                  borderRadius: 10,
                  marginBottom: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                    {item.model || item.assetName || item.name || 'Asset'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {item.registrationNumber || item.registration || item.category || 'Protected'}
                  </Text>
                </View>
                <Text style={{ color: COLORS.primary || '#0F766E', fontWeight: '800' }}>Select →</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Pressable
            onPress={() => navigation.navigate('Home', { screen: 'AddAsset' })}
            style={{ backgroundColor: COLORS.primary || '#0F766E', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginTop: 16, alignSelf: 'flex-start' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>+ Add Asset</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (loading || !analytics) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator color={COLORS.primary || '#0F766E'} />
      </View>
    );
  }

  if (analytics.error === 'UNAUTHORIZED') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.heading}>Asset Analytics</Text>
        <Text style={styles.muted}>You do not have access to this asset.</Text>
      </View>
    );
  }

  const money = (v, available = true) =>
    available && v != null ? formatInr(v) : 'Not available';

  const openMaintenance = (bucket) => {
    Haptics.tap();
    navigation.navigate('Maintenance', { assetId, filterBucket: bucket });
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 48, paddingHorizontal: 16 }}
    >
      <Text style={styles.heading}>{analytics.name}</Text>
      <Text style={styles.sub}>
        Lifecycle: {analytics.lifecycle.status} · Replacement: {analytics.replacementFlag}
      </Text>

      <View style={styles.chipRow}>
        {RANGE_CHIPS.map((c) => (
          <Pressable
            key={c.key}
            style={[styles.chip, dateRange === c.key && styles.chipOn]}
            onPress={() => {
              Haptics.tap();
              setDateRange(c.key);
            }}
          >
            <Text style={[styles.chipText, dateRange === c.key && styles.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.source}>Range: {analytics.dateRange?.label || 'All Time'}</Text>

      <Text style={styles.section}>Financial summary</Text>
      <View style={styles.card}>
        <Row
          label="Purchase Price"
          value={money(analytics.purchase.value, analytics.purchase.available)}
          source={analytics.breakdown.purchase.source}
        />
        <Row
          label="Total Ownership Cost"
          value={money(analytics.breakdown.total.value)}
          source={analytics.breakdown.total.source}
        />
        <Row
          label="Estimated Current Value"
          value={money(analytics.currentEstimated.value, analytics.currentEstimated.available)}
          source={analytics.currentEstimated.marketValueLabel}
        />
        <Row
          label="Calculated depreciated value"
          value={
            analytics.depreciation.available
              ? money(analytics.depreciation.bookValue)
              : 'Not available'
          }
          source={analytics.depreciation.label}
        />
        <Row
          label="Ownership Duration"
          value={analytics.age.available ? analytics.age.label : 'Not available'}
        />
        <Row
          label="Average Monthly Cost"
          value={
            analytics.period.available ? money(analytics.period.costPerMonth) : 'Not available'
          }
          source={analytics.period.label}
        />
        <Row
          label="Average Yearly Cost"
          value={analytics.period.available ? money(analytics.period.costPerYear) : 'Not available'}
          source={analytics.period.label}
        />
      </View>

      <Text style={styles.section}>Cost breakdown</Text>
      <View style={styles.card}>
        {['purchase', 'service', 'repair', 'insurance', 'maintenance', 'other', 'total'].map((k) => {
          const b = analytics.breakdown[k];
          const tappable = k === 'service' || k === 'repair' || k === 'maintenance' || k === 'other';
          return (
            <Row
              key={k}
              label={b.label}
              value={money(b.value, b.available !== false)}
              source={b.source}
              onPress={tappable ? () => openMaintenance(k) : undefined}
            />
          );
        })}
      </View>

      <Text style={styles.section}>Cost trend</Text>
      <View style={styles.card}>
        <SimpleBars series={analytics.costTrendSeries} />
        <Row
          label="Maintenance trend"
          value={
            analytics.maintenanceTrend.available
              ? analytics.maintenanceTrend.trend
              : analytics.maintenanceTrend.trend
          }
        />
        {analytics.maintenanceTrend.available ? (
          <>
            <Row
              label="Service (12m)"
              value={money(analytics.maintenanceTrend.last12Months.service)}
              source="Actual Recorded"
            />
            <Row
              label="Repair (12m)"
              value={money(analytics.maintenanceTrend.last12Months.repair)}
              source="Actual Recorded"
            />
          </>
        ) : null}
      </View>

      <Text style={styles.section}>Health & ownership</Text>
      <View style={styles.card}>
        <Row
          label="Health Score"
          value={
            analytics.health.score != null ? `${analytics.health.score}/100` : 'Not available'
          }
          source={analytics.health.source}
        />
        <Row
          label="Ownership Cost Score"
          value={
            analytics.ownershipScore.available
              ? `${analytics.ownershipScore.score} · ${analytics.ownershipScore.band}`
              : 'Not available'
          }
          source={analytics.ownershipScore.formula}
        />
        <Row label="Health vs Cost" value={analytics.healthVsCost.label} />
        <Row
          label="Repair frequency"
          value={`${analytics.repairFrequency.last3Months}/3m · ${analytics.repairFrequency.last6Months}/6m · ${analytics.repairFrequency.last12Months}/12m`}
          source={analytics.repairFrequency.source}
        />
        <Row
          label="Service frequency"
          value={analytics.maintenanceFrequency.message}
          source={analytics.maintenanceFrequency.source}
        />
        <Row
          label="Repair vs replace"
          value={analytics.repairVsReplace.advisory || 'Not available'}
        />
      </View>

      {(analytics.categoryProfile === 'vehicle' || analytics.categoryProfile === 'ev') && (
        <>
          <Text style={styles.section}>Vehicle</Text>
          <View style={styles.card}>
            <Row
              label="Registration"
              value={analytics.vehicleExtras?.registration || 'Not available'}
            />
            <Row
              label="Insurance expiry"
              value={analytics.vehicleExtras?.insuranceExpiry || 'Not available'}
            />
            <Row label="PUC expiry" value={analytics.vehicleExtras?.pucExpiry || 'Not available'} />
            <Row
              label="Odometer"
              value={
                analytics.vehicleExtras?.odometerKm != null
                  ? `${analytics.vehicleExtras.odometerKm} km`
                  : 'Not available'
              }
            />
            {analytics.categoryProfile === 'ev' ? (
              <>
                <Row
                  label="Battery health"
                  value={
                    analytics.battery.healthPercent != null
                      ? `${analytics.battery.healthPercent}%`
                      : 'No data available'
                  }
                  source={analytics.battery.source || analytics.battery.label}
                />
                <Row
                  label="Charging cost"
                  value={
                    analytics.charging?.value != null
                      ? money(analytics.charging.value)
                      : 'Charging cost data unavailable'
                  }
                  source={analytics.charging?.source}
                />
              </>
            ) : null}
          </View>
        </>
      )}

      {(analytics.categoryProfile === 'appliance' || analytics.categoryProfile === 'gadget') && (
        <>
          <Text style={styles.section}>
            {analytics.categoryProfile === 'appliance' ? 'Appliance' : 'Gadget'}
          </Text>
          <View style={styles.card}>
            <Row
              label="Warranty"
              value={analytics.warranty.end || 'Not available'}
              source={analytics.warranty.source}
            />
            <Row
              label="Energy estimate"
              value={
                analytics.energy.estimatedMonthlyCost != null
                  ? `${money(analytics.energy.estimatedMonthlyCost)}/mo`
                  : 'Energy data unavailable'
              }
              source={analytics.energy.source || analytics.energy.label}
            />
            {analytics.categoryProfile === 'gadget' ? (
              <Row
                label="Battery health"
                value={
                  analytics.battery.healthPercent != null
                    ? `${analytics.battery.healthPercent}%`
                    : 'No data available'
                }
                source={analytics.battery.source || analytics.battery.label}
              />
            ) : null}
          </View>
        </>
      )}

      {analytics.warnings?.length ? (
        <>
          <Text style={styles.section}>Data quality</Text>
          <View style={styles.card}>
            {analytics.warnings.map((w) => (
              <Text key={w.code} style={styles.warn}>
                · {w.message}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      {peers?.count > 1 ? (
        <>
          <Text style={styles.section}>Similar assets</Text>
          <View style={styles.card}>
            {peers.rows.map((r) => (
              <Pressable
                key={r.assetId}
                style={styles.row}
                onPress={() => {
                  Haptics.tap();
                  navigation.replace('AssetAnalytics', { assetId: r.assetId });
                }}
              >
                <Text style={styles.rowLabel}>{r.name}</Text>
                <Text style={styles.rowValue}>
                  {r.ownershipCost != null ? formatInr(r.ownershipCost) : '—'}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {locationSpend?.available ? (
        <>
          <Text style={styles.section}>By location (same category)</Text>
          <View style={styles.card}>
            {locationSpend.rows.slice(0, 5).map((r) => (
              <Row
                key={r.location}
                label={`${r.location} (${r.count})`}
                value={money(r.ownershipCost)}
                source={locationSpend.source}
              />
            ))}
          </View>
        </>
      ) : null}

      <Pressable
        style={styles.link}
        onPress={() => {
          Haptics.tap();
          const payload = buildAnalyticsExportPayload(analytics);
          // Architecture stub — payload ready for future PDF/CSV
          // eslint-disable-next-line no-console
          console.log('[AnalyticsExport]', payload.available ? 'ready' : payload.reason);
          navigation.navigate('Maintenance', { assetId });
        }}
      >
        <Text style={styles.linkText}>Open Service & Expenses</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg || '#F8FAFC' },
  heading: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  sub: { marginTop: 4, color: '#64748B', fontSize: 13, fontWeight: '600' },
  muted: { color: '#64748B', marginTop: 12 },
  section: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  rowLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F766E',
    maxWidth: '48%',
    textAlign: 'right',
  },
  source: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  warn: { color: '#B45309', fontSize: 13, paddingVertical: 4 },
  link: { marginTop: 20, paddingVertical: 12 },
  linkText: { color: COLORS.primary || '#0F766E', fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  chipOn: { backgroundColor: '#0F766E' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  chipTextOn: { color: '#fff' },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    paddingVertical: 12,
    gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barFill: { width: '70%', backgroundColor: '#0F766E', borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 9, color: '#94A3B8', marginTop: 4 },
  emptyChart: { color: '#94A3B8', paddingVertical: 16, fontSize: 13 },
});

export default AssetAnalyticsScreen;

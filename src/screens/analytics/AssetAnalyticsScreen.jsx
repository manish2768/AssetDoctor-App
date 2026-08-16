/**
 * STEP 10 — Asset Analytics screen (financial + lifecycle + trends).
 * Uses only recorded / calculated-labeled values.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { OfflineVaultCache } from '../../services/offline/OfflineVaultCache';
import { buildAssetAnalytics, compareAssets } from '../../services/finance/assetAnalyticsEngine';
import { formatInr } from '../../services/finance/financeConstants';
import { Haptics } from '../../services/haptics';
import { COLORS } from '../../theme/branding';

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

export function AssetAnalyticsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const assetId = route?.params?.assetId;
  const { user } = useAuth();
  const { assets, getAsset } = useAssets();
  const asset = getAsset?.(assetId) || assets.find((a) => (a.assetId || a.id) === assetId);
  const [expenseRows, setExpenseRows] = useState([]);
  const [expenseRowsByAsset, setExpenseRowsByAsset] = useState({});
  const [loading, setLoading] = useState(true);

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
    });
  }, [asset, expenseRows, user?.uid]);

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

  if (!asset) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.heading}>Asset Analytics</Text>
        <Text style={styles.muted}>Asset not found.</Text>
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 48, paddingHorizontal: 16 }}
    >
      <Text style={styles.heading}>{analytics.name}</Text>
      <Text style={styles.sub}>
        Lifecycle: {analytics.lifecycle.status} · Replacement: {analytics.replacementFlag}
      </Text>

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
        <Row label="Ownership Duration" value={analytics.age.available ? analytics.age.label : 'Not available'} />
        <Row
          label="Average Monthly Cost"
          value={
            analytics.period.available ? money(analytics.period.costPerMonth) : 'Not available'
          }
          source={analytics.period.label}
        />
      </View>

      <Text style={styles.section}>Cost breakdown</Text>
      <View style={styles.card}>
        {['purchase', 'service', 'repair', 'insurance', 'maintenance', 'other', 'total'].map((k) => {
          const b = analytics.breakdown[k];
          return (
            <Row
              key={k}
              label={b.label}
              value={money(b.value, b.available !== false)}
              source={b.source}
              onPress={
                k === 'service' || k === 'repair' || k === 'maintenance'
                  ? () => {
                      Haptics.tap();
                      navigation.navigate('Maintenance', { assetId });
                    }
                  : undefined
              }
            />
          );
        })}
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
          label="Repair frequency (12m)"
          value={analytics.repairFrequency.message}
          source={analytics.repairFrequency.source}
        />
        <Row
          label="Maintenance trend"
          value={
            analytics.maintenanceTrend.available
              ? analytics.maintenanceTrend.trend
              : analytics.maintenanceTrend.trend
          }
        />
        <Row
          label="Repair vs replace"
          value={analytics.repairVsReplace.advisory || 'Not available'}
        />
      </View>

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

      <Pressable
        style={styles.link}
        onPress={() => {
          Haptics.tap();
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
  rowValue: { fontSize: 14, fontWeight: '800', color: '#0F766E', maxWidth: '48%', textAlign: 'right' },
  source: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  warn: { color: '#B45309', fontSize: 13, paddingVertical: 4 },
  link: { marginTop: 20, paddingVertical: 12 },
  linkText: { color: COLORS.primary || '#0F766E', fontWeight: '800' },
});

export default AssetAnalyticsScreen;

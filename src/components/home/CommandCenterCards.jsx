/**
 * Home command-center cards — Phase G+ presentation only; consume real hooks/services.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';

import { useThemeColors } from '../../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT, elevation } from '../../theme/tokens';
import { StatusBadge, EmptyState, SectionHeader } from '../ui/DesignSystem';
import { InsightActionCard } from '../ui/InsightActionCard';
import { Entrance, PressScale } from '../ui/PremiumMotion';
import { Haptics } from '../../services/haptics';
import { daysUntil } from '../../utils/dates';
import { DigitalTwinService } from '../../services/intelligence/DigitalTwinService';
import {
  attachAssetsToTwinTree,
  buildDigitalTwinTree,
  LOCATION_NODE_TYPE,
} from '../../services/intelligence/digitalTwinModel';
import { aggregateHomeEnergy } from '../../services/intelligence/HomeEnergyService';
import { assetSupportsEnergyTracking } from '../../services/assets/assetCapabilities';
import { buildSmartAlertsForPortfolio } from '../../services/intelligence/smartAlertBuilder';
import { buildAssetContext } from '../../services/intelligence/AssetContext';
import { analyzeRepairVsReplace } from '../../services/intelligence/RepairReplaceAnalyzer';
import { formatINR } from '../../utils/format';
import { commandHealthLabel } from '../../utils/commandHealthLabel';
import { computeAssetHealth } from '../../services/health/computeAssetHealth';
import { cleanAssetDisplayName } from '../../utils/displayAssetName';

function collectRooms(home) {
  const rooms = [];
  for (const child of home.children || []) {
    if (child.type === LOCATION_NODE_TYPE.ROOM) {
      rooms.push({ ...child, floorName: null });
    } else if (child.type === LOCATION_NODE_TYPE.FLOOR) {
      for (const room of child.children || []) {
        rooms.push({ ...room, floorName: child.name });
      }
    }
  }
  return rooms;
}

function roomHealthTone(assetsInRoom = [], colors) {
  if (!assetsInRoom.length) return { color: colors.textMuted, label: 'Empty' };
  const scores = assetsInRoom.map((a) => computeAssetHealth(a).score);
  const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
  if (avg >= 75) return { color: colors.success, label: 'Healthy' };
  if (avg >= 40) return { color: colors.warning, label: 'Watch' };
  return { color: colors.error, label: 'Attention' };
}

function eventTs(asset) {
  const raw =
    asset?.updatedAt ||
    asset?.clientUpdatedAt ||
    asset?.createdAt ||
    asset?.purchaseDate ||
    null;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  if (raw?.seconds) return raw.seconds * 1000;
  if (raw?.toMillis) {
    try {
      return raw.toMillis();
    } catch {
      return 0;
    }
  }
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : 0;
}

/** Map engine grades to Excellent / Good / Attention for the 5-second read. */
export { commandHealthLabel };

export function WarrantyRadarCard({ assets = [], onPress, style }) {
  const colors = useThemeColors();
  const radar = useMemo(() => {
    let protectedCount = 0;
    let expiring = 0;
    let expired = 0;
    for (const a of assets || []) {
      if (!a?.warrantyExpiry) continue;
      const d = daysUntil(a.warrantyExpiry);
      if (d == null) continue;
      if (d < 0) expired += 1;
      else if (d < 30) expiring += 1;
      else protectedCount += 1;
    }
    return {
      protected: protectedCount,
      expiring,
      expired,
      total: protectedCount + expiring + expired,
    };
  }, [assets]);

  if (!radar.total) return null;

  const cells = [
    { key: 'protected', label: 'Protected', value: radar.protected, tone: colors.success, icon: '✓' },
    { key: 'expiring', label: 'Expiring', value: radar.expiring, tone: colors.warning, icon: '!' },
    { key: 'expired', label: 'Expired', value: radar.expired, tone: colors.error, icon: '×' },
  ];

  return (
    <Entrance delay={80}>
      <Pressable
        onPress={() => {
          Haptics.select();
          onPress?.();
        }}
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          elevation(1, colors.shadow),
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Warranty radar: ${radar.protected} protected, ${radar.expiring} expiring, ${radar.expired} expired`}
      >
        <Text style={[TYPE.label, { color: colors.textMuted }]}>WARRANTY RADAR</Text>
        <View style={styles.radarRow}>
          {cells.map((c) => (
            <View key={c.key} style={styles.radarCell}>
              <View style={[styles.radarIcon, { backgroundColor: `${c.tone}22` }]}>
                <Text style={{ color: c.tone, fontWeight: '800', fontSize: 12 }}>{c.icon}</Text>
              </View>
              <Text style={[styles.radarValue, { color: c.tone }]}>{c.value}</Text>
              <Text style={[TYPE.caption, { color: colors.textMuted }]}>{c.label}</Text>
            </View>
          ))}
        </View>
      </Pressable>
    </Entrance>
  );
}

export function CommandSummaryStrip({
  assetCount = 0,
  vaultValueLabel = '—',
  upcomingServices = 0,
  warrantyAlerts = 0,
  empty,
  onScan,
  style,
}) {
  const colors = useThemeColors();

  if (empty) {
    return (
      <Entrance delay={40}>
        <EmptyState
          title="Your Asset Journey Starts Here"
          message="Scan a bill or RC to build your household command center. OCR pulls name, store, date, serial, and warranty — you confirm before save."
          icon="📷"
          ctaLabel="Scan a document"
          onCta={onScan}
          style={style}
        />
      </Entrance>
    );
  }

  const cells = [
    { label: 'Assets', value: String(assetCount) },
    { label: 'Value', value: vaultValueLabel },
    { label: 'Services', value: String(upcomingServices) },
    { label: 'Warranty', value: String(warrantyAlerts) },
  ];

  return (
    <Entrance delay={40}>
      <View
        style={[
          styles.card,
          styles.summaryGrid,
          { backgroundColor: colors.surface, borderColor: colors.border },
          elevation(1, colors.shadow),
          style,
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`Assets ${assetCount}, value ${vaultValueLabel}, upcoming services ${upcomingServices}, warranty alerts ${warrantyAlerts}`}
      >
        {cells.map((c) => (
          <View key={c.label} style={styles.summaryCell}>
            <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={1}>
              {c.value}
            </Text>
            <Text style={[TYPE.micro, { color: colors.textMuted }]}>{c.label}</Text>
          </View>
        ))}
      </View>
    </Entrance>
  );
}

export function TodayPulseCard({ pulse: pulseProp, onPress, style }) {
  const colors = useThemeColors();
  if (!pulseProp) return null;
  let pulse = pulseProp;
  // Missing battery data is not an actionable pulse — stay calm.
  if (
    /battery health is 0%|battery health data unavailable|battery health isn't available|battery health not|add battery health data/i.test(
      `${pulse.title || ''} ${pulse.message || ''}`,
    )
  ) {
    pulse = {
      kind: 'calm',
      title: "You're all caught up",
      message: 'No urgent warranty, service, or document alerts for today.',
      action: null,
      calm: true,
    };
  }

  const calm = !!pulse.calm;
  return (
    <Entrance delay={30}>
      <Pressable
        onPress={() => {
          if (!pulse.action) return;
          Haptics.tap();
          onPress?.(pulse.action);
        }}
        disabled={!pulse.action}
        style={[
          styles.card,
          styles.pulseCard,
          {
            backgroundColor: calm ? colors.successSoft : colors.surface,
            borderColor: calm ? 'transparent' : colors.border,
          },
          elevation(2, colors.shadow),
          style,
        ]}
        accessibilityRole={pulse.action ? 'button' : 'summary'}
        accessibilityLabel={`Today's asset pulse. ${pulse.title}. ${pulse.message || ''}`}
      >
        <Text style={[TYPE.label, { color: colors.textMuted, letterSpacing: 0.2 }]}>
          Today&apos;s Pulse
        </Text>
        <Text style={[TYPE.h3, { color: colors.text, marginTop: 8 }]} numberOfLines={2}>
          {pulse.title}
        </Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 6, lineHeight: 18 }]} numberOfLines={3}>
          {pulse.message}
        </Text>
        {pulse.action ? (
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '600', marginTop: 12 }]}>
            Open asset →
          </Text>
        ) : null}
      </Pressable>
    </Entrance>
  );
}

export function AllCaughtUpCard({ visible, style }) {
  const colors = useThemeColors();
  if (!visible) return null;
  return (
    <Entrance delay={45}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.successSoft,
            borderColor: colors.borderGlow,
          },
          style,
        ]}
        accessibilityRole="summary"
        accessibilityLabel="You're all caught up. No urgent attention items."
      >
        <Text style={[TYPE.h3, { color: colors.success }]}>You&apos;re all caught up</Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
          No urgent warranty, service, or document alerts right now.
        </Text>
      </View>
    </Entrance>
  );
}

export function EnergySnapshotCard({ assets = [], onPress, style }) {
  const colors = useThemeColors();
  const snapshot = useMemo(() => {
    const eligible = (assets || []).filter(
      (a) => a && !a.deletedAt && assetSupportsEnergyTracking(a),
    );
    const agg = aggregateHomeEnergy(eligible, {});
    const kwh = Number(agg?.estimatedMonthlyConsumptionKWh || agg?.totalMonthlyConsumptionKWh) || 0;
    if (!eligible.length || !(kwh > 0)) return null;
    return {
      monthlyKWh: Math.round(kwh * 10) / 10,
      monthlyCost: agg.estimatedMonthlyCost != null ? Math.round(agg.estimatedMonthlyCost) : null,
      assetCount: eligible.length,
    };
  }, [assets]);

  if (!snapshot) return null;

  return (
    <Entrance delay={100}>
      <Pressable
        onPress={() => {
          Haptics.tap();
          onPress?.();
        }}
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          elevation(1, colors.shadow),
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Energy about ${snapshot.monthlyKWh} kilowatt hours per month`}
      >
        <View style={styles.rowBetween}>
          <Text style={[TYPE.label, { color: colors.textMuted }]}>ENERGY</Text>
          <StatusBadge label="Estimated" tone="info" />
        </View>
        <Text style={[TYPE.h2, { color: colors.text, marginTop: 8 }]}>
          ~{snapshot.monthlyKWh} kWh/mo
        </Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
          {snapshot.monthlyCost != null
            ? `~${formatINR(snapshot.monthlyCost)} · ${snapshot.assetCount} tracked`
            : `${snapshot.assetCount} energy-capable asset${snapshot.assetCount === 1 ? '' : 's'}`}
          {' · Open Energy Center ›'}
        </Text>
      </Pressable>
    </Entrance>
  );
}

export function HomeTwinPreviewCard({ userId, assets = [], onPress, style }) {
  const colors = useThemeColors();
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setLocations([]);
      return undefined;
    }
    (async () => {
      try {
        const list = await DigitalTwinService.listLocations(userId);
        if (!cancelled) setLocations(Array.isArray(list) ? list : list?.locations || []);
      } catch {
        if (!cancelled) setLocations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const rooms = useMemo(() => {
    const tree = attachAssetsToTwinTree(buildDigitalTwinTree(locations), assets || []);
    const all = [];
    for (const home of tree.homes || []) {
      for (const room of collectRooms(home)) {
        const roomAssets = room.assets || [];
        const tone = roomHealthTone(roomAssets, colors);
        all.push({
          id: room.id || room.name,
          name: room.name || 'Room',
          count: roomAssets.length,
          floorName: room.floorName,
          toneColor: tone.color,
          toneLabel: tone.label,
        });
      }
    }
    return all.slice(0, 8);
  }, [locations, assets, colors]);

  if (!rooms.length) return null;

  return (
    <Entrance delay={120}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          elevation(1, colors.shadow),
          style,
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.tap();
            onPress?.();
          }}
          style={styles.rowBetween}
          accessibilityRole="button"
          accessibilityLabel={`Your home digital twin, ${rooms.length} rooms`}
        >
          <Text style={[TYPE.label, { color: colors.textMuted }]}>YOUR HOME</Text>
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>Open ›</Text>
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roomScroll}
        >
          {rooms.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                Haptics.tap();
                onPress?.();
              }}
              style={[
                styles.roomChip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}, ${r.count} assets, ${r.toneLabel}`}
            >
              <View style={styles.roomHead}>
                <View
                  style={[styles.healthDot, { backgroundColor: r.toneColor }]}
                  accessibilityLabel={r.toneLabel}
                />
                <Text style={[TYPE.micro, { color: colors.textMuted }]}>{r.toneLabel}</Text>
              </View>
              <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={[TYPE.micro, { color: colors.textMuted }]}>
                {r.count} asset{r.count === 1 ? '' : 's'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Entrance>
  );
}

export function AssetConstellationCard({ assets = [], onOpenAsset, style }) {
  const colors = useThemeColors();
  const nodes = useMemo(() => {
    const list = (assets || []).filter((a) => a && !a.deletedAt);
    if (!list.length) return [];
    const sorted = [...list].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const maxShow = 8;
    if (sorted.length <= maxShow) {
      return sorted.map((a) => ({
        id: a.assetId || a.id,
        name: cleanAssetDisplayName(a.assetName || a.nickname, { registration: a.registration }) || 'Asset',
        score: computeAssetHealth(a).score,
        grouped: false,
      }));
    }
    const head = sorted.slice(0, maxShow - 1).map((a) => ({
      id: a.assetId || a.id,
      name: cleanAssetDisplayName(a.assetName || a.nickname, { registration: a.registration }) || 'Asset',
      score: computeAssetHealth(a).score,
      grouped: false,
    }));
    const rest = sorted.length - (maxShow - 1);
    head.push({
      id: '__more__',
      name: `+${rest} more`,
      score: null,
      grouped: true,
    });
    return head;
  }, [assets]);

  if (!nodes.length) return null;

  return (
    <Entrance delay={130}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          elevation(1, colors.shadow),
          style,
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`Asset constellation, ${nodes.length} nodes`}
      >
        <Text style={[TYPE.label, { color: colors.textMuted }]}>ASSET CONSTELLATION</Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
          Light overview — tap a node for passport
        </Text>
        <View style={styles.constellation}>
          {nodes.map((n) => {
            const tone =
              n.score == null
                ? colors.textMuted
                : n.score >= 75
                  ? colors.success
                  : n.score >= 40
                    ? colors.warning
                    : colors.error;
            return (
              <Pressable
                key={n.id}
                onPress={() => {
                  if (n.grouped || !n.id) return;
                  Haptics.tap();
                  onOpenAsset?.(n.id);
                }}
                disabled={n.grouped}
                style={[
                  styles.node,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: tone,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  n.grouped
                    ? n.name
                    : `${n.name}, health ${n.score}`
                }
              >
                <View style={[styles.nodeDot, { backgroundColor: tone }]} />
                <Text style={[TYPE.micro, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
                  {n.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Entrance>
  );
}

export function AssetBrainHomeCard({ assets = [], onOpenAsset, style }) {
  const colors = useThemeColors();
  const top = useMemo(() => {
    const alerts = buildSmartAlertsForPortfolio(assets, {}, { maxPortfolioAlerts: 3 });
    return alerts[0] || null;
  }, [assets]);

  if (!top?.what) return null;

  return (
    <Entrance delay={140}>
      <View style={style}>
        <SectionHeader title="Asset Brain" subtitle="Advisor · real signals only" />
        <InsightActionCard
          what={top.what}
          why={top.why}
          whatShouldIDo={top.whatShouldIDo}
          priority={top.priority}
          ctaLabel={top.assetId ? 'Open asset' : undefined}
          onCta={
            top.assetId
              ? () => {
                  Haptics.tap();
                  onOpenAsset?.(top.assetId);
                }
              : undefined
          }
        />
      </View>
    </Entrance>
  );
}

export function RepairReplaceHomeCard({
  assets = [],
  expenseRowsByAsset = {},
  onOpenAsset,
  style,
}) {
  const colors = useThemeColors();
  const pick = useMemo(() => {
    for (const asset of assets || []) {
      const id = asset.assetId || asset.id;
      if (!id) continue;
      const expenses = expenseRowsByAsset[id] || [];
      if (!expenses.length) continue;
      const ctx = buildAssetContext(asset, { expenses, services: expenses });
      const result = analyzeRepairVsReplace(ctx);
      if (result?.available) {
        return { asset, result, id };
      }
    }
    return null;
  }, [assets, expenseRowsByAsset]);

  if (!pick?.result?.explanation) return null;

  const { result, id } = pick;
  const name = pick.asset?.nickname || pick.asset?.assetName || 'Asset';

  return (
    <Entrance delay={160}>
      <View style={style}>
        <SectionHeader title="Repair vs Replace" subtitle={name} />
        <InsightActionCard
          what={result.explanation.what}
          why={result.explanation.why}
          whatShouldIDo={result.explanation.whatShouldIDo}
          priority={
            result.explanation.priority ||
            (result.decision === 'REPLACE' ? 'HIGH' : 'MEDIUM')
          }
          ctaLabel="View passport"
          onCta={() => {
            Haptics.tap();
            onOpenAsset?.(id);
          }}
          style={{
            borderColor: result.decision === 'REPLACE' ? colors.warning : colors.border,
          }}
        />
      </View>
    </Entrance>
  );
}

export function PortfolioHomeCard({
  purchaseTotal = 0,
  assetCount = 0,
  empty,
  onScan,
  onPress,
  style,
}) {
  const colors = useThemeColors();

  if (empty || !(purchaseTotal > 0)) {
    return (
      <Entrance delay={170}>
        <EmptyState
          title="Unlock portfolio value"
          message="Add purchase amounts on assets (or scan invoices) to see your real portfolio total."
          icon="₹"
          ctaLabel="Scan invoice"
          onCta={onScan}
          style={style}
        />
      </Entrance>
    );
  }

  return (
    <Entrance delay={170}>
      <Pressable
        onPress={() => {
          Haptics.tap();
          onPress?.();
        }}
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          elevation(1, colors.shadow),
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Portfolio purchase value ${formatINR(purchaseTotal)} across ${assetCount} assets`}
      >
        <Text style={[TYPE.label, { color: colors.textMuted }]}>PORTFOLIO</Text>
        <Text style={[TYPE.h2, { color: colors.text, marginTop: 8 }]}>{formatINR(purchaseTotal)}</Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
          Purchase total · {assetCount} asset{assetCount === 1 ? '' : 's'}
        </Text>
      </Pressable>
    </Entrance>
  );
}

export function RecentlyChangedCard({ assets = [], onOpenAsset, style }) {
  const colors = useThemeColors();
  const events = useMemo(() => {
    const list = (assets || [])
      .filter((a) => a && !a.deletedAt && eventTs(a) > 0)
      .map((a) => ({
        id: a.assetId || a.id,
        name:
          cleanAssetDisplayName(a.assetName || a.nickname, { registration: a.registration }) ||
          'Asset',
        ts: eventTs(a),
      }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 4);
    return list;
  }, [assets]);

  if (!events.length) return null;

  return (
    <Entrance delay={180}>
      <View style={style}>
        <SectionHeader title="Recently changed" subtitle="Real updates only" />
        {events.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => {
              Haptics.tap();
              onOpenAsset?.(e.id);
            }}
            style={[
              styles.recentRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${e.name}, recently updated`}
          >
            <Text style={[TYPE.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {e.name}
            </Text>
            <Text style={[TYPE.micro, { color: colors.textMuted }]}>
              {new Date(e.ts).toLocaleDateString('en-IN')}
            </Text>
          </Pressable>
        ))}
      </View>
    </Entrance>
  );
}

export function PremiumScanCta({ onPress, style }) {
  const colors = useThemeColors();
  return (
    <Entrance delay={60}>
      <PressScale
        onPress={onPress}
        accessibilityLabel="Scan a bill or document"
        style={style}
        haptic="tap"
      >
        <View
          style={[
            styles.scanCta,
            {
              backgroundColor: colors.surfaceTint || colors.infoSoft,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth,
            },
            elevation(1, colors.shadow),
          ]}
        >
          <Text style={[TYPE.h3, { color: colors.text }]}>
            Scan a Bill or Document
          </Text>
          <Text
            style={[
              TYPE.caption,
              { color: colors.textMuted, marginTop: 6, lineHeight: 18 },
            ]}
          >
            Scan a purchase bill, warranty, service record, or category-relevant document. AI
            extracts the details — you confirm before saving.
          </Text>
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '600', marginTop: 12 }]}>
            Scan Document →
          </Text>
        </View>
      </PressScale>
    </Entrance>
  );
}

export function UpcomingSummaryCard({ summary, unread = 0, onPress, style }) {
  const colors = useThemeColors();
  // Universal reminders — only surface cells with signal (never force vehicle-only PUC/Insurance).
  const allCells = [
    { label: 'Insurance', value: summary?.insurance ?? 0, key: 'insurance' },
    { label: 'Service', value: summary?.service ?? 0, key: 'service' },
    { label: 'Warranty', value: summary?.warranty ?? 0, key: 'warranty' },
    { label: 'PUC', value: summary?.puc ?? 0, key: 'puc' },
    { label: 'Expired', value: summary?.expired ?? 0, key: 'expired' },
  ];
  const active = allCells.filter((c) => c.value > 0);
  const cells =
    active.length > 0
      ? active.slice(0, 5)
      : [
          { label: 'Service', value: 0 },
          { label: 'Warranty', value: 0 },
          { label: 'Docs', value: 0 },
        ];
  return (
    <Entrance delay={50}>
      <Pressable
        onPress={() => {
          Haptics.tap();
          onPress?.();
        }}
        style={[
          styles.card,
          styles.upcomingCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          elevation(2, colors.shadow),
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Upcoming reminders. ${cells.map((c) => `${c.label} ${c.value}`).join(', ')}`}
      >
        <View style={styles.rowBetween}>
          <Text style={[TYPE.h2, { color: colors.text, fontSize: 18 }]}>Upcoming</Text>
          {unread > 0 ? (
            <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '600' }]}>
              {unread > 9 ? '9+' : unread} notification{unread === 1 ? '' : 's'} unread
            </Text>
          ) : (
            <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '600' }]}>View →</Text>
          )}
        </View>
        <View style={styles.upcomingRow}>
          {cells.map((c) => (
            <View key={c.label} style={styles.upcomingCell}>
              <Text style={[styles.upcomingValue, { color: colors.text }]}>{c.value}</Text>
              <Text style={[TYPE.micro, { color: colors.textMuted }]}>{c.label}</Text>
            </View>
          ))}
        </View>
      </Pressable>
    </Entrance>
  );
}

export function SmartInsightCard({ insight, onPress, style }) {
  const colors = useThemeColors();
  if (!insight?.message) return null;
  return (
    <Entrance delay={70}>
      <Pressable
        onPress={() => {
          if (!insight.assetId) return;
          Haptics.tap();
          onPress?.(insight);
        }}
        disabled={!insight.assetId}
        style={[
          styles.card,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: 'transparent',
          },
          style,
        ]}
        accessibilityRole={insight.assetId ? 'button' : 'summary'}
        accessibilityLabel={`${insight.title || 'Smart insight'}. ${insight.message}`}
      >
        <Text style={[TYPE.label, { color: colors.textMuted }]}>
          Smart insight
        </Text>
        <Text style={[TYPE.body, { color: colors.text, marginTop: 8, lineHeight: 20 }]}>
          {insight.message}
        </Text>
        {insight.assetId ? (
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '600', marginTop: 10 }]}>
            Open asset →
          </Text>
        ) : null}
      </Pressable>
    </Entrance>
  );
}

export function HomeEmptyOnboarding({ onScan, onAdd, style }) {
  const colors = useThemeColors();
  return (
    <Entrance delay={40}>
      <View
        style={[
          styles.card,
          styles.emptyOnboard,
          { backgroundColor: colors.surface, borderColor: colors.border },
          elevation(2, colors.shadow),
          style,
        ]}
      >
        <Text style={[TYPE.h2, { color: colors.text, textAlign: 'center' }]}>
          Your Asset Journey Starts Here
        </Text>
        <Text
          style={[
            TYPE.caption,
            { color: colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 18 },
          ]}
        >
          Scan a purchase bill, warranty card, or service document for any asset you own. Asset
          Doctor extracts the details — you always confirm before saving.
        </Text>
        <Pressable
          onPress={() => {
            Haptics.tap();
            onScan?.();
          }}
          style={[styles.emptyPrimaryBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Scan a document"
        >
          <Text style={{ color: colors.textOnPrimary || '#FFF', fontWeight: '800' }}>
            Scan a document
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.select();
            onAdd?.();
          }}
          style={{ marginTop: 14, minHeight: HIT.min, justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel="Add asset manually"
        >
          <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700', textAlign: 'center' }]}>
            Or add an asset manually
          </Text>
        </Pressable>
      </View>
    </Entrance>
  );
}

export function TodayAttentionSection({ actions = [], onOpen, style }) {
  const colors = useThemeColors();
  const rows = useMemo(() => (actions || []).slice(0, 3), [actions]);
  if (!rows.length) return null;

  return (
    <Entrance delay={50}>
      <View style={style}>
        <SectionHeader title="Needs your attention" subtitle="What · Why · Do · max 3" />
        {rows.map((action) => {
          const what = action.what || action.title;
          const why = action.why || action.message;
          const todo = action.whatShouldIDo || action.message;
          return (
            <Pressable
              key={action.alertId || `${action.rank}-${what}`}
              onPress={() => {
                Haptics.tap();
                onOpen?.(action);
              }}
              style={[
                styles.todayRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                elevation(1, colors.shadow),
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${what}. Why: ${why || ''}. Do: ${todo || ''}`}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[TYPE.bodyStrong, { color: colors.text }]} numberOfLines={2}>
                  {action.rank ? `${action.rank}. ` : ''}
                  {what}
                </Text>
                {why ? (
                  <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]} numberOfLines={2}>
                    Why: {why}
                  </Text>
                ) : null}
                {todo ? (
                  <Text
                    style={[TYPE.caption, { color: colors.text, marginTop: 2, fontWeight: '600' }]}
                    numberOfLines={2}
                  >
                    Do: {todo}
                  </Text>
                ) : null}
              </View>
              <StatusBadge
                label={action.priority || 'INFO'}
                tone={
                  action.priority === 'CRITICAL' || action.priority === 'HIGH'
                    ? 'error'
                    : action.priority === 'LOW'
                      ? 'neutral'
                      : 'warning'
                }
              />
            </Pressable>
          );
        })}
      </View>
    </Entrance>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radarRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  radarCell: {
    flex: 1,
    alignItems: 'center',
  },
  radarIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  radarValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: SPACING.sm,
  },
  summaryCell: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  roomScroll: {
    gap: 8,
    paddingTop: SPACING.sm,
    paddingRight: 8,
  },
  roomChip: {
    width: 120,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.sm,
    minHeight: HIT.min + 24,
  },
  roomHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  constellation: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.sm,
  },
  node: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: HIT.min,
    maxWidth: '48%',
  },
  nodeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scanCta: {
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    paddingHorizontal: SPACING.md,
    minHeight: 88,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  pulseCard: {
    borderRadius: RADIUS.md,
    paddingVertical: 16,
  },
  upcomingCard: {
    borderRadius: RADIUS.md,
    paddingVertical: 16,
  },
  upcomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 4,
  },
  upcomingCell: {
    flex: 1,
    alignItems: 'center',
  },
  upcomingValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyOnboard: {
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyPrimaryBtn: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    minHeight: HIT.min,
    justifyContent: 'center',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    minHeight: HIT.min,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.xs,
    minHeight: HIT.min,
  },
});

export default {
  WarrantyRadarCard,
  CommandSummaryStrip,
  EnergySnapshotCard,
  HomeTwinPreviewCard,
  AssetBrainHomeCard,
  RepairReplaceHomeCard,
  PremiumScanCta,
  UpcomingSummaryCard,
  SmartInsightCard,
  HomeEmptyOnboarding,
  TodayAttentionSection,
  TodayPulseCard,
  AllCaughtUpCard,
  AssetConstellationCard,
  PortfolioHomeCard,
  RecentlyChangedCard,
  commandHealthLabel,
};

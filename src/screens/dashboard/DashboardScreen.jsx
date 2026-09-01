/**
 * Asset Doctor — Home dashboard (Phase 10 presentation).
 * Data still comes from useAssets / calculateHealthScore / summarizePortfolioCost.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useDrawer } from '../../context/DrawerContext';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { requireAuth } from '../../navigation/authGate';
import { openScanInvoice, openAssetCategoryList } from '../../navigation/navActions';
import { daysUntil, formatDateIN } from '../../utils/dates';
import { calculateHealthScore } from '../../utils/healthScore';
import { needsAttention, hasExpiredDocuments } from '../../utils/assetExpiry';
import { resolveAssetCategory } from '../../utils/categoryNormalization';
import { resolveAssetCapabilities } from '../../services/assets/assetCapabilities';
import { VehicleInsightsSection } from '../../components/fuel/VehicleInsightsSection';
import { NetworkIntelligenceSection } from '../../components/intelligence/NetworkIntelligenceSection';
import { isHomeVehicle } from '../../utils/vehicleFolder';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';
import {
  StatusBadge,
  SectionHeader,
  EmptyState,
  HeroCard,
  IconButton,
  PremiumButton,
  PremiumIcon,
  CountUp,
  ScanBeam,
  AssetCollectionCard,
  InsightCard,
  MetricCard,
} from '../../design-system';
import { RADIUS, SPACING, TYPE } from '../../theme/tokens';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function assetSubtitle(asset) {
  const parts = [];
  const id = asset.registration || asset.serialNumber || asset.imei;
  if (id) parts.push(id);
  const typeOrCat = asset.categoryLabel || asset.category || asset.model || 'Protected';
  if (typeOrCat && (!id || !id.includes(typeOrCat))) parts.push(typeOrCat);
  return parts.length > 0 ? parts.join(' · ') : 'Protected';
}

function assetCoverageStatus(asset) {
  const ins = daysUntil(asset.insuranceExpiry);
  const puc = daysUntil(asset.pucExpiry);
  const svc = daysUntil(asset.nextServiceDue);
  const war = daysUntil(asset.warrantyExpiry);

  if (ins != null && ins < 0) return { label: 'Insurance expired', tone: 'error' };
  if (puc != null && puc < 0) return { label: 'PUC expired', tone: 'error' };
  if (svc != null && svc < 0) return { label: 'Service overdue', tone: 'error' };
  if (ins != null && ins <= 15) return { label: `Insurance ${ins}d left`, tone: 'warning' };
  if (puc != null && puc <= 15) return { label: `PUC ${puc}d left`, tone: 'warning' };
  if (svc != null && svc <= 15) return { label: `Service ${svc}d left`, tone: 'warning' };
  if (war != null && war > 0) return { label: 'Warranty active', tone: 'success' };
  if (ins != null && ins > 15) return { label: 'Insurance active', tone: 'success' };
  return { label: 'Healthy', tone: 'success' };
}

function countDocuments(asset) {
  let n = 0;
  if (asset.invoiceNumber || asset.purchasePrice || asset.invoiceDate || asset.billStoragePath) n += 1;
  if (asset.insurancePolicyNumber || asset.insuranceExpiry) n += 1;
  if (asset.pucExpiry) n += 1;
  if (asset.lastServiceDate || (asset.serviceHistory && asset.serviceHistory.length)) n += 1;
  if (asset.warrantyExpiry || asset.warrantyMonths) n += 1;
  if (asset.rcNumber) n += 1;
  return n;
}

export function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { user, profile, isAuthenticated } = useAuth();
  const { assets, loading, refreshAssets } = useAssets();
  const { openDrawer } = useDrawer();

  const [refreshing, setRefreshing] = useState(false);

  const userName =
    profile?.name || user?.displayName || user?.email?.split('@')[0] || 'there';
  const greeting = getGreeting();

  const healthStats = useMemo(() => {
    const list = (assets || []).filter((a) => !a.isArchived && !a.deletedAt);
    if (!list.length) {
      return {
        score: null,
        displayScore: '—',
        label: 'Ready',
        protectedCount: 0,
        urgentCount: 0,
        documentCount: 0,
        isEmpty: true,
      };
    }

    let totalScore = 0;
    let validCount = 0;
    let urgent = 0;
    let docs = 0;

    for (const a of list) {
      const res = calculateHealthScore(a);
      const scoreVal = typeof res === 'number' ? res : res?.score;
      if (Number.isFinite(scoreVal)) {
        totalScore += scoreVal;
        validCount += 1;
      }
      if (hasExpiredDocuments(a) || needsAttention(a, 7)) urgent += 1;
      docs += countDocuments(a);
    }

    if (validCount === 0) {
      return {
        score: null,
        displayScore: '—',
        label: 'Building health score',
        protectedCount: list.length,
        urgentCount: urgent,
        documentCount: docs,
        isEmpty: true,
      };
    }

    const avg = Math.round(totalScore / validCount);
    const label = avg >= 90 ? 'Excellent' : avg >= 75 ? 'Good' : avg >= 60 ? 'Fair' : 'Attention';

    return {
      score: avg,
      displayScore: String(avg),
      label,
      protectedCount: list.length,
      urgentCount: urgent,
      documentCount: docs,
      isEmpty: false,
    };
  }, [assets]);

  const priorityItems = useMemo(() => {
    const list = assets || [];
    const items = [];

    for (const a of list) {
      const ins = daysUntil(a.insuranceExpiry);
      const puc = daysUntil(a.pucExpiry);
      const svc = daysUntil(a.nextServiceDue);
      const war = daysUntil(a.warrantyExpiry);
      const kmLeft =
        Number.isFinite(Number(a.nextServiceOdometerKm)) && Number.isFinite(Number(a.odometerKm))
          ? Number(a.nextServiceOdometerKm) - Number(a.odometerKm)
          : null;

      if (ins != null && ins <= 30) {
        items.push({
          id: `${a.assetId || a.id}-ins`,
          title: a.assetName,
          subtitle: ins < 0 ? 'Insurance has expired' : `Insurance expires in ${ins} days`,
          actionLabel: 'View policy →',
          onAction: () => navigation.navigate('AssetPassport', { assetId: a.assetId || a.id }),
        });
      }
      if (puc != null && puc <= 15) {
        items.push({
          id: `${a.assetId || a.id}-puc`,
          title: a.assetName,
          subtitle: puc < 0 ? 'PUC certificate expired' : `PUC expires in ${puc} days`,
          actionLabel: 'View asset →',
          onAction: () => navigation.navigate('AssetPassport', { assetId: a.assetId || a.id }),
        });
      }
      if (svc != null && svc <= 15) {
        items.push({
          id: `${a.assetId || a.id}-svc`,
          title: a.assetName,
          subtitle: svc < 0 ? 'Service schedule overdue' : `Service due in ${svc} days`,
          actionLabel: 'View asset →',
          onAction: () => navigation.navigate('AssetPassport', { assetId: a.assetId || a.id }),
        });
      } else if (kmLeft != null && kmLeft <= 800) {
        items.push({
          id: `${a.assetId || a.id}-km`,
          title: a.assetName,
          subtitle:
            kmLeft <= 0
              ? 'Service odometer interval reached'
              : `Service due in ${Math.round(kmLeft)} KM`,
          actionLabel: 'View asset →',
          onAction: () => navigation.navigate('AssetPassport', { assetId: a.assetId || a.id }),
        });
      }
      if (war != null && war > 0 && war <= 90) {
        items.push({
          id: `${a.assetId || a.id}-war`,
          title: a.assetName,
          subtitle: `Warranty active until ${formatDateIN(a.warrantyExpiry)}`,
          actionLabel: 'View warranty →',
          onAction: () => navigation.navigate('AssetPassport', { assetId: a.assetId || a.id }),
        });
      }
    }
    return items.slice(0, 6);
  }, [assets, navigation]);

  const intelligenceFeed = useMemo(() => {
    if (priorityItems.length) return priorityItems.slice(0, 4);
    const list = (assets || []).filter((a) => !a.isArchived).slice(0, 3);
    return list.map((a) => {
      const cov = assetCoverageStatus(a);
      return {
        id: a.assetId || a.id,
        title: a.assetName,
        subtitle: cov.label,
        actionLabel: 'View asset →',
        onAction: () => navigation.navigate('AssetPassport', { assetId: a.assetId || a.id }),
      };
    });
  }, [assets, navigation, priorityItems]);

  // Vehicles — shown in the Home "Vehicle Insights" section.
  // A vehicle is surfaced when it supports fuel tracking (petrol/diesel/CNG)
  // OR mileage/odometer (which also covers EVs). This keeps the entry point
  // visible even for a brand-new vehicle with no fuel logs yet.
  const vehicles = useMemo(
    () =>
      (assets || []).filter((a) => {
        if (a.isArchived || a.deletedAt) return false;
        // Robust vehicle detection first so vehicles carried by category /
        // identifiers are always surfaced on Home (fuel + mileage).
        if (isHomeVehicle(a)) return true;
        const caps = resolveAssetCapabilities(a);
        if (caps.supportsFuelTracking) return true;
        return caps.supportsOdometer && caps.supportsMileage;
      }),
    [assets],
  );

  const categorySummaries = useMemo(() => {
    const groups = [
      { key: 'vehicle', label: 'Vehicles', icon: 'car', category: 'vehicle', count: 0, health: [] },
      { key: 'gadget', label: 'Gadgets & Electronics', icon: 'smartphone', category: 'gadget', count: 0, health: [] },
      { key: 'home', label: 'Home & Appliances', icon: 'house', category: 'home', count: 0, health: [] },
      { key: 'equipment', label: 'Equipment & Tools', icon: 'wrench', category: 'equipment', count: 0, health: [] },
    ];
    const indexByKey = Object.fromEntries(groups.map((g, i) => [g.key, i]));
    const bump = (idx, asset) => {
      groups[idx].count += 1;
      const res = calculateHealthScore(asset);
      const scoreVal = typeof res === 'number' ? res : res?.score;
      if (Number.isFinite(scoreVal)) groups[idx].health.push(scoreVal);
    };

    for (const a of assets || []) {
      if (a.isArchived) continue;
      const resolved = resolveAssetCategory(a) || 'other';
      const idx = indexByKey[resolved];
      // Skip categories no longer surfaced on the Home grid (business / other).
      if (idx == null) continue;
      bump(idx, a);
    }

    return groups.map((g) => {
      const avg = g.health.length ? Math.round(g.health.reduce((s, n) => s + n, 0) / g.health.length) : null;
      const healthLabel = avg == null ? null : avg >= 75 ? 'Healthy' : avg >= 60 ? 'Fair' : 'Attention';
      const healthTone = avg == null ? 'neutral' : avg >= 75 ? 'success' : avg >= 60 ? 'warning' : 'error';
      return { ...g, avg, healthLabel, healthTone };
    });
  }, [assets]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.select();
    try {
      if (refreshAssets) await refreshAssets();
    } finally {
      setRefreshing(false);
    }
  };

  const onScan = () => {
    Haptics.select();
    openScanInvoice(navigation);
  };

  const healthTone =
    healthStats.isEmpty ? 'neutral' : healthStats.score >= 85 ? 'success' : healthStats.score >= 60 ? 'warning' : 'error';
  const barColor =
    healthStats.score >= 85 ? colors.success : healthStats.score >= 60 ? colors.warning : colors.danger;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerLeft}>
          <IconButton name="menu" label="Open navigation menu" onPress={openDrawer} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={[TYPE.caption, { color: colors.textMuted }]}>{greeting}</Text>
            <Text style={[TYPE.h1, { color: colors.text }]} numberOfLines={1}>
              {userName}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={onScan}
            style={({ pressed }) => [styles.headerScan, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Scan document"
          >
            <PremiumIcon name="scan" size={16} color="#FFFFFF" />
            <Text style={styles.headerScanText}>Scan</Text>
          </Pressable>
          <IconButton
            name="bell"
            label="View alerts and reminders"
            onPress={() => navigation.navigate('Alerts')}
            badge={healthStats.urgentCount > 0}
            style={{ marginLeft: 8 }}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {healthStats.isEmpty && !loading ? (
          <EmptyState
            icon="shield"
            title="Welcome to Asset Doctor."
            message="Protect everything you own. Start by scanning a bill, warranty, insurance policy or purchase receipt."
            ctaLabel="Scan my first document"
            onCta={onScan}
            secondaryLabel="Add asset manually"
            onSecondary={() =>
              requireAuth({
                isAuthenticated,
                navigation,
                message: 'Sign in to add assets.',
                onAuthed: () => navigation.navigate('AddAsset'),
              })
            }
            style={{ marginBottom: SPACING.md }}
          />
        ) : null}

        <HeroCard style={{ marginBottom: SPACING.md }}>
          <View style={styles.heroTop}>
            <Text style={[TYPE.label, { color: 'rgba(248,250,252,0.55)' }]}>ASSET HEALTH</Text>
            <StatusBadge label={healthStats.label} tone={healthTone} />
          </View>
          <View style={styles.heroScoreRow}>
            <CountUp
              value={healthStats.score}
              style={[TYPE.display, { color: '#F8FAFC', fontVariant: ['tabular-nums'] }]}
            />
            <Text style={[TYPE.caption, { color: 'rgba(248,250,252,0.45)', marginLeft: 8, marginTop: 12 }]}>/ 100</Text>
          </View>
          <Text style={[TYPE.body, { color: 'rgba(248,250,252,0.72)', marginTop: 4 }]}>
            {healthStats.isEmpty
              ? 'Your vault is ready to protect what you own'
              : healthStats.urgentCount === 0
              ? 'Your vault is well protected'
              : `${healthStats.urgentCount} item${healthStats.urgentCount === 1 ? '' : 's'} need attention`}
          </Text>
          {!healthStats.isEmpty ? (
            <View style={styles.heroBarTrack}>
              <View
                style={[
                  styles.heroBarFill,
                  { width: `${Math.min(100, Math.max(4, healthStats.score || 0))}%`, backgroundColor: barColor },
                ]}
              />
            </View>
          ) : (
            <View style={styles.heroBarTrack} />
          )}
          <View style={styles.heroMetrics}>
            <MetricCard title="Assets" value={String(healthStats.protectedCount)} />
            <MetricCard title="Documents" value={String(healthStats.documentCount)} />
            <MetricCard title="Urgent" value={String(healthStats.urgentCount)} />
          </View>
          <Pressable
            onPress={() => {
              Haptics.tap();
              navigation.navigate('AssetAnalytics');
            }}
            style={{ marginTop: 14, minHeight: 44, justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="View health report"
          >
            <Text style={[TYPE.caption, { color: colors.electricTeal || '#00B8A9', fontWeight: '600' }]}>
              View health report →
            </Text>
          </Pressable>
        </HeroCard>

        <Pressable
          onPress={onScan}
          style={({ pressed }) => [styles.scanHero, { opacity: pressed ? 0.94 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Scan document"
        >
          <View style={styles.scanRow}>
            <View style={styles.scanFrame}>
              <PremiumIcon name="scan" size={22} color="#00B8A9" />
              <ScanBeam />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[TYPE.h2, { color: '#F8FAFC' }]}>Scan a document</Text>
              <Text style={[TYPE.caption, { color: 'rgba(248,250,252,0.6)', marginTop: 4 }]}>
                Invoice · Insurance · Warranty · RC · PUC · Service Bill
              </Text>
            </View>
            <View style={styles.energyArrow}>
              <Text style={{ color: '#00B8A9', fontSize: 20, fontWeight: '800' }}>→</Text>
            </View>
          </View>
        </Pressable>

        {/* Quick Actions Row */}
        <View style={{ flexDirection: 'row', marginVertical: SPACING.md, gap: 10 }}>
          <Pressable
            onPress={() => {
              Haptics.tap();
              requireAuth({
                isAuthenticated,
                navigation,
                message: 'Sign in to add assets.',
                onAuthed: () => navigation.navigate('AddAsset'),
              });
            }}
            style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: RADIUS.md, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 20 }}>➕</Text>
            <Text style={[TYPE.micro, { color: colors.text, marginTop: 4, fontWeight: '700' }]}>Add Asset</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.tap();
              navigation.navigate('FuelVault');
            }}
            style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: RADIUS.md, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 20 }}>⛽</Text>
            <Text style={[TYPE.micro, { color: colors.text, marginTop: 4, fontWeight: '700' }]}>Fuel & Mileage</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.tap();
              navigation.navigate('Maintenance');
            }}
            style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: RADIUS.md, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 20 }}>🔧</Text>
            <Text style={[TYPE.micro, { color: colors.text, marginTop: 4, fontWeight: '700' }]}>Maintenance</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.tap();
              navigation.navigate('DocsVault');
            }}
            style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 12, borderRadius: RADIUS.md, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 20 }}>📁</Text>
            <Text style={[TYPE.micro, { color: colors.text, marginTop: 4, fontWeight: '700' }]}>Vault</Text>
          </Pressable>
        </View>

        <SectionHeader title="Smart Insights" subtitle="Energy & network intelligence" />
        <Pressable
          onPress={() => {
            Haptics.tap();
            navigation.navigate('EnergyOverview');
          }}
          style={[styles.energyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Open energy intelligence"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: SPACING.md }}>
              <Text style={[TYPE.label, { color: colors.textMuted }]}>⚡ ENERGY INTELLIGENCE</Text>
              <Text style={[TYPE.h3, { color: colors.text, marginTop: 4 }]}>
                Appliance power bill
              </Text>
              <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
                Daily & monthly kWh and cost for AC, refrigerator, washing machine, TV, microwave,
                geyser and other electrical assets.
              </Text>
            </View>
            <View style={styles.energyArrow}>
              <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>→</Text>
            </View>
          </View>
        </Pressable>

        <NetworkIntelligenceSection navigation={navigation} style={{ marginTop: SPACING.sm }} />

        <SectionHeader title="Vehicle Insights & Fuel" subtitle="Mileage · running cost · refills" />
        <VehicleInsightsSection vehicles={vehicles} navigation={navigation} loading={loading} />

        <SectionHeader title="Your asset collection" />
        <View style={styles.collectionGrid}>
          {categorySummaries.map((cat) => (
            <AssetCollectionCard
              key={cat.key}
              icon={cat.icon}
              title={cat.label}
              count={cat.count}
              healthLabel={cat.healthLabel}
              healthTone={cat.healthTone}
              onPress={() => {
                Haptics.tap();
                const opened = openAssetCategoryList(cat.category);
                if (!opened) {
                  navigation.navigate('Assets', {
                    screen: 'AssetList',
                    params: { category: cat.category },
                  });
                }
              }}
            />
          ))}
        </View>

        <SectionHeader title="Upcoming alerts" actionLabel="View all →" onAction={() => navigation.navigate('Alerts')} />
        {intelligenceFeed.length ? (
          intelligenceFeed.map((item) => (
            <InsightCard
              key={item.id}
              title={item.title}
              subtitle={item.subtitle}
              actionLabel={item.actionLabel}
              onPress={item.onAction}
            />
          ))
        ) : (
          <InsightCard
            title="No alerts right now"
            subtitle="Scan documents to start receiving service, warranty and insurance intelligence."
            actionLabel="Scan →"
            onPress={onScan}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerScan: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: RADIUS.full,
  },
  headerScanText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  heroBarTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 16,
    overflow: 'hidden',
  },
  heroBarFill: {
    height: 6,
    borderRadius: 99,
  },
  heroMetrics: {
    flexDirection: 'row',
    marginTop: 18,
  },
  scanHero: {
    backgroundColor: '#07111F',
    borderRadius: RADIUS.hero,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanFrame: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,184,169,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  portfolio: {
    padding: SPACING.lg,
    borderRadius: RADIUS.hero,
    borderWidth: 1,
  },
  energyCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  energyArrow: {
    padding: SPACING.sm,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

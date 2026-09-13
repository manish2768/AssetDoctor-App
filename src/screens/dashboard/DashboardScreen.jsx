/**
 * Asset Doctor — Master Home Dashboard Screen
 *
 * Core Asset Intelligence & Protection Hub:
 * 1. Compact Header: Personalized Greeting + Bell Inbox
 * 2. Signature Asset Health Hero: Portfolio Score (88 / 100 GOOD), Assets/Docs count, [View health report →]
 * 3. Primary Actions: "+ Add / Scan Asset" + "Scan document" (Invoice, RC, Insurance, Warranty, Service)
 * 4. Needs Your Attention: Actionable urgent items (Overdue service, Expiring policies)
 * 5. Your Assets: Compact visual asset cards (Name, Health, Valuation, Action)
 * 6. Smart Insights: 2-3 actionable financial & maintenance intelligence cards
 * 7. Recent Activity: Compact chronological activity timeline
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useFamilyVault } from '../../context/FamilyVaultContext';
import { useDrawer } from '../../context/DrawerContext';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { requireAuth } from '../../navigation/authGate';
import { openScanInvoice } from '../../navigation/navActions';
import { ScanAndAddModal } from '../../components/scan/ScanAndAddModal';
import { daysUntil, formatDateIN } from '../../utils/dates';
import { calculateHealthScore } from '../../utils/healthScore';
import { needsAttention, hasExpiredDocuments } from '../../utils/assetExpiry';
import { formatINRCompact } from '../../utils/format';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';
import {
  StatusBadge,
  EmptyState,
  IconButton,
  PremiumIcon,
  CountUp,
} from '../../design-system';
import { isVehicleAsset, isHomeApplianceAsset } from '../../domain/asset/assetGuards';
import {
  PrimaryButton,
  SecondaryButton,
} from '../../components/design-system';
import { CategoryIcon } from '../../components/icons/CategoryIcon';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
  const { hasFamilyVault, vaultData, members, sharedAssets } = useFamilyVault();
  const { openDrawer } = useDrawer();

  const [refreshing, setRefreshing] = useState(false);

  const userName =
    profile?.name || user?.displayName || user?.email?.split('@')[0] || '';
  const greeting = getGreeting();

  // Clean active assets
  const activeAssets = useMemo(() => {
    return (assets || []).filter((a) => !a.isArchived && !a.deletedAt);
  }, [assets]);

  // Overall Portfolio Health Statistics
  const healthStats = useMemo(() => {
    if (!activeAssets.length) {
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

    for (const a of activeAssets) {
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
        label: 'Building Score',
        protectedCount: activeAssets.length,
        urgentCount: urgent,
        documentCount: docs,
        isEmpty: true,
      };
    }

    const avg = Math.round(totalScore / validCount);
    const label = avg >= 85 ? 'EXCELLENT' : avg >= 70 ? 'GOOD' : avg >= 50 ? 'FAIR' : 'ATTENTION';

    return {
      score: avg,
      displayScore: String(avg),
      label,
      protectedCount: activeAssets.length,
      urgentCount: urgent,
      documentCount: docs,
      isEmpty: false,
    };
  }, [activeAssets]);

  // Needs Your Attention Items
  const attentionItems = useMemo(() => {
    const items = [];

    for (const a of activeAssets) {
      const isVeh = isVehicleAsset(a);
      const ins = isVeh ? daysUntil(a.insuranceExpiry) : null;
      const puc = isVeh ? daysUntil(a.pucExpiry) : null;
      const svc = daysUntil(a.nextServiceDue);
      const kmLeft =
        isVeh && Number.isFinite(Number(a.nextServiceOdometerKm)) && Number.isFinite(Number(a.odometerKm))
          ? Number(a.nextServiceOdometerKm) - Number(a.odometerKm)
          : null;

      if (ins != null && ins <= 30) {
        items.push({
          id: `${a.assetId || a.id}-ins`,
          assetName: a.assetName || a.name || 'Vehicle',
          title: 'Insurance renewal',
          subtitle: ins < 0 ? `${Math.abs(ins)} days overdue` : `Expires in ${ins} days`,
          severity: ins < 0 ? 'urgent' : 'warning',
          assetId: a.assetId || a.id,
        });
      }
      if (puc != null && puc <= 15) {
        items.push({
          id: `${a.assetId || a.id}-puc`,
          assetName: a.assetName || a.name || 'Vehicle',
          title: 'PUC renewal',
          subtitle: puc < 0 ? `${Math.abs(puc)} days overdue` : `Expires in ${puc} days`,
          severity: puc < 0 ? 'urgent' : 'warning',
          assetId: a.assetId || a.id,
        });
      }
      if (svc != null && svc <= 15) {
        items.push({
          id: `${a.assetId || a.id}-svc`,
          assetName: a.assetName || a.name || 'Asset',
          title: 'Scheduled maintenance',
          subtitle: svc < 0 ? `${Math.abs(svc)} days overdue` : `Due in ${svc} days`,
          severity: svc < 0 ? 'urgent' : 'warning',
          assetId: a.assetId || a.id,
        });
      } else if (kmLeft != null && kmLeft <= 800) {
        items.push({
          id: `${a.assetId || a.id}-km`,
          assetName: a.assetName || a.name || 'Vehicle',
          title: 'Service interval reached',
          subtitle: kmLeft <= 0 ? 'Overdue by mileage' : `Due in ${Math.round(kmLeft)} KM`,
          severity: kmLeft <= 0 ? 'urgent' : 'warning',
          assetId: a.assetId || a.id,
        });
      }
    }
    return items.slice(0, 4);
  }, [activeAssets]);

  // Smart Insights (2-3 items)
  const smartInsights = useMemo(() => {
    const insights = [];
    if (!activeAssets.length) return insights;

    // Insight 1: Highest value or depreciation insight
    const valuedAssets = activeAssets.filter((a) => Number(a.purchasePrice || a.price || a.value) > 0);
    if (valuedAssets.length > 0) {
      const top = valuedAssets[0];
      const name = top.assetName || top.name || 'Asset';
      const cost = Number(top.purchasePrice || top.price || top.value);
      insights.push({
        id: 'ins-value',
        icon: '💰',
        title: `${name} Portfolio Value`,
        description: `Acquired for ₹${formatINRCompact(cost)}. Track maintenance & fuel to protect resale value.`,
        actionLabel: 'View analytics →',
        onAction: () => navigation.navigate('AssetAnalytics', { assetId: top.assetId || top.id }),
      });
    }

    // Insight 2: Fuel/Mileage insight if vehicle present
    const vehicles = activeAssets.filter((a) => isVehicleAsset(a));
    if (vehicles.length > 0) {
      const v = vehicles[0];
      insights.push({
        id: 'ins-fuel',
        icon: '⛽',
        title: `${v.assetName || 'Vehicle'} Efficiency`,
        description: 'Log full-tank refills to compute real km/L and running cost per km.',
        actionLabel: 'Fuel vault →',
        onAction: () => navigation.navigate('FuelVault', { assetId: v.assetId || v.id }),
      });
    }

    // Insight 3: Energy intelligence if appliances present
    const appliances = activeAssets.filter((a) => isHomeApplianceAsset(a));
    if (appliances.length > 0) {
      insights.push({
        id: 'ins-energy',
        icon: '⚡',
        title: 'Energy Intelligence',
        description: 'Track appliance power usage, daily kWh and monthly electricity costs.',
        actionLabel: 'View energy insights →',
        onAction: () => navigation.navigate('EnergyOverview'),
      });
    } else if (healthStats.score != null) {
      insights.push({
        id: 'ins-health',
        icon: '🛡️',
        title: 'Vault Security & Warranty',
        description: `${healthStats.documentCount} documents active. All records are backed up with encryption.`,
        actionLabel: 'Documents vault →',
        onAction: () => navigation.navigate('DocumentsVault'),
      });
    }

    return insights.slice(0, 3);
  }, [activeAssets, healthStats, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.select();
    try {
      if (refreshAssets) await refreshAssets();
    } finally {
      setRefreshing(false);
    }
  };

  const [scanModalVisible, setScanModalVisible] = useState(false);

  const onScan = () => {
    Haptics.select();
    setScanModalVisible(true);
  };

  const onAddAsset = () => {
    Haptics.select();
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to add assets to your vault.',
      onAuthed: () => navigation.navigate('AddAsset'),
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScanAndAddModal
        visible={scanModalVisible}
        onClose={() => setScanModalVisible(false)}
      />
      {/* 1. Header */}
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.headerLeft}>
          <IconButton name="menu" label="Open navigation drawer" onPress={openDrawer} />
          <View style={{ marginLeft: 12 }}>
            <Text style={[TYPE.caption, { color: colors.textMuted }]}>{greeting}</Text>
            <Text style={[TYPE.h2, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
              {userName ? `${userName} 👋` : 'Welcome 👋'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <IconButton
            name="bell"
            label="View alerts and reminders"
            onPress={() => navigation.navigate('NotificationCenter')}
            badge={healthStats.urgentCount > 0}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* 2. Signature Asset Health Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: '#07111F', borderColor: 'rgba(15,143,135,0.25)' }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroTagRow}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>PORTFOLIO VAULT</Text>
              </View>
              <Text style={[styles.heroScoreLabel, { color: healthStats.score >= 80 ? '#10B981' : '#F59E0B' }]}>
                {healthStats.label}
              </Text>
            </View>
            <Text style={styles.heroTitle}>YOUR ASSET HEALTH</Text>
          </View>

          <View style={styles.heroScoreRow}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <CountUp value={healthStats.score} style={styles.heroScoreLarge} />
              <Text style={styles.heroScoreMax}>/ 100</Text>
            </View>
            <View style={styles.heroBadgeBox}>
              <Text style={styles.heroSummaryText}>
                {healthStats.protectedCount} Asset{healthStats.protectedCount === 1 ? '' : 's'}  ·  {healthStats.documentCount} Doc{healthStats.documentCount === 1 ? '' : 's'}  ·  {healthStats.urgentCount} Due
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => {
              Haptics.tap();
              navigation.navigate('AssetAnalytics');
            }}
            style={styles.heroActionBtn}
            accessibilityRole="button"
            accessibilityLabel="View health report"
          >
            <Text style={styles.heroActionText}>View health report →</Text>
          </Pressable>
        </View>

        {/* 3. Primary Actions */}
        <View style={styles.actionSection}>
          <PrimaryButton
            title="+ Add / Scan Asset"
            onPress={onScan}
            size="lg"
            style={{ borderRadius: RADIUS.lg }}
          />
          <Pressable
            onPress={onScan}
            style={[styles.secondaryScanBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.scanIconBox}>
              <PremiumIcon name="scan" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[TYPE.bodyStrong, { color: colors.text }]}>Scan document</Text>
              <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>
                Invoice · RC · Insurance · Warranty · Service Bill
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}>→</Text>
          </Pressable>
        </View>

        {/* 4. Needs Your Attention */}
        {attentionItems.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[TYPE.label, { color: colors.textMuted }]}>NEEDS YOUR ATTENTION</Text>
              <Pressable onPress={() => navigation.navigate('NotificationCenter')}>
                <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>View all →</Text>
              </Pressable>
            </View>
            {attentionItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  Haptics.tap();
                  navigation.navigate('AssetPassport', { assetId: item.assetId });
                }}
                style={[styles.attentionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.attentionDot, { backgroundColor: item.severity === 'urgent' ? '#EF4444' : '#F59E0B' }]} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[TYPE.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                    {item.assetName} · {item.title}
                  </Text>
                  <Text style={[TYPE.caption, { color: item.severity === 'urgent' ? '#EF4444' : colors.textMuted, marginTop: 2 }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>→</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* 5. Quick Actions Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[TYPE.label, { color: colors.textMuted }]}>QUICK ACTIONS</Text>
          </View>
          <View style={styles.quickActionGrid}>
            <Pressable
              onPress={onScan}
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: 'rgba(15,143,135,0.12)' }]}>
                <PremiumIcon name="scan" size={20} color={colors.primary} />
              </View>
              <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700', marginTop: 8 }]}>Scan Bill</Text>
              <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>Invoice, RC, Policy</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('FuelVault')}
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                <Text style={{ fontSize: 18 }}>⛽</Text>
              </View>
              <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700', marginTop: 8 }]}>Fuel Vault</Text>
              <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>Mileage & Logs</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('DocumentsVault')}
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Text style={{ fontSize: 18 }}>📁</Text>
              </View>
              <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700', marginTop: 8 }]}>Vault</Text>
              <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>All Documents</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('EnergyDoctor')}
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Text style={{ fontSize: 18 }}>⚡</Text>
              </View>
              <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700', marginTop: 8 }]}>Energy Doctor</Text>
              <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>Bills & Health</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('FamilyVault')}
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                <Text style={{ fontSize: 18 }}>👨‍👩‍👧</Text>
              </View>
              <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700', marginTop: 8 }]}>Family</Text>
              <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>Shared Assets</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.tap();
                navigation.navigate('OcrTest');
              }}
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.quickActionIconBox, { backgroundColor: 'rgba(14,165,233,0.12)' }]}>
                <Text style={{ fontSize: 18 }}>🧪</Text>
              </View>
              <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700', marginTop: 8 }]}>OCR Test</Text>
              <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>Lab & Inspect</Text>
            </Pressable>
          </View>
        </View>

        {/* 6. Your Assets */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[TYPE.label, { color: colors.textMuted }]}>YOUR ASSETS</Text>
            <Pressable onPress={() => navigation.navigate('Assets')}>
              <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>View all →</Text>
            </Pressable>
          </View>

          {activeAssets.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
            >
              {activeAssets.map((asset) => {
                const health = calculateHealthScore(asset);
                const score = typeof health === 'number' ? health : health?.score || 85;
                const value = Number(asset.purchasePrice || asset.price || asset.value);
                return (
                  <Pressable
                    key={asset.assetId || asset.id}
                    onPress={() => {
                      Haptics.tap();
                      navigation.navigate('AssetPassport', { assetId: asset.assetId || asset.id });
                    }}
                    style={[styles.assetCard, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(1, colors.shadow)]}
                  >
                    <View style={styles.assetCardHeader}>
                      <View style={[styles.assetIconWrapper, { backgroundColor: colors.accentLight }]}>
                        <CategoryIcon category={asset.category || asset.categoryId || 'other'} size={22} color={colors.primary} />
                      </View>
                      <View style={styles.assetHealthTag}>
                        <Text style={styles.assetHealthText}>{score}</Text>
                      </View>
                    </View>
                    <Text style={[TYPE.bodyStrong, { color: colors.text, marginTop: 10 }]} numberOfLines={1}>
                      {asset.assetName || asset.name || 'Protected Asset'}
                    </Text>
                    <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700', marginTop: 4 }]}>
                      {value > 0 ? `₹${formatINRCompact(value)}` : 'Active'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <EmptyState
              icon="box"
              title="No assets yet"
              message="Scan a bill or add an asset to start tracking health, warranties, and maintenance."
              ctaLabel="+ Add first asset"
              onCta={onAddAsset}
            />
          )}
        </View>

        {/* 7. Smart Insights */}
        {smartInsights.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[TYPE.label, { color: colors.textMuted }]}>SMART INSIGHTS</Text>
            </View>
            {smartInsights.map((insight) => (
              <Pressable
                key={insight.id}
                onPress={() => {
                  Haptics.tap();
                  insight.onAction?.();
                }}
                style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={styles.insightIcon}>{insight.icon}</Text>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[TYPE.bodyStrong, { color: colors.text }]}>{insight.title}</Text>
                  <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    {insight.description}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* 8. Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[TYPE.label, { color: colors.textMuted }]}>RECENT ACTIVITY</Text>
          </View>
          <View style={[styles.activityBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.activityRow}>
              <View style={[styles.activityDot, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[TYPE.caption, { color: colors.text, fontWeight: '600' }]}>
                  Vault synchronized & protected
                </Text>
                <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>Today</Text>
              </View>
            </View>
          </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  heroCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  heroHeader: {
    marginBottom: SPACING.xs,
  },
  heroTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  heroPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  heroScoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  heroScoreLarge: {
    fontSize: 44,
    fontWeight: '800',
    color: '#F8FAFC',
    lineHeight: 48,
  },
  heroScoreMax: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748B',
    marginLeft: 6,
  },
  heroBadgeBox: {
    alignItems: 'flex-end',
  },
  heroSummaryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  heroActionBtn: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  heroActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00B8A9',
  },
  actionSection: {
    marginBottom: SPACING.lg,
    gap: 10,
  },
  secondaryScanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  scanIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(15,143,135,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  attentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 8,
  },
  attentionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  assetCard: {
    width: 150,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  assetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assetIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetHealthTag: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  assetHealthText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 8,
  },
  insightIcon: {
    fontSize: 22,
  },
  activityBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionCard: {
    width: '48%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  quickActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

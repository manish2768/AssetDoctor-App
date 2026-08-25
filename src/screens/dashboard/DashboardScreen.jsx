/**
 * Home Dashboard — premium vault overview (light slate UI).
 */

import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import * as Print from 'expo-print';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { buildCountdownTasks } from '../../utils/countdownTasks';
import {
  buildTodaysAssetActions,
  buildHouseholdHealthOverview,
} from '../../services/health/homeHealthSummary';
import { requireAuth, openLogin } from '../../navigation/authGate';
import { openScanInvoice } from '../../navigation/navActions';
import { BRAND, COLORS } from '../../theme/branding';
import { formatINR, formatLakhs } from '../../utils/format';
import { Haptics } from '../../services/haptics';
import { daysUntil } from '../../utils/dates';
import {
  getAssetFolderType,
  FOLDER_META,
  countAssetsByFolder,
} from '../../utils/assetFolders';
import { isAlertableStatus } from '../../constants/assetStatus';
import { OTA_BUNDLE_LABEL } from '../../services/updates/OtaUpdateService';
import { getCurrentValuation } from '../../components/ValuationBlock';
import { AssetHealthBadge } from '../../components/AssetHealthBadge';
import { getAssetHealthStatus } from '../../utils/assetHealthStatus';
import { resolveSupportContact } from '../../constants/brandDirectory';
import { CategoryIcon } from '../../components/icons/CategoryIcon';
import { HealthScoreGauge } from '../../components/HealthScoreGauge';
import { GoldenShieldBadge } from '../../components/GoldenShieldBadge';
import { ReminderActionSheet } from '../../components/ReminderActionSheet';
import {
  cleanAssetDisplayName,
  formatRegistrationDisplay,
} from '../../utils/displayAssetName';
import { computeGadgetSmartMetrics } from '../../utils/gadgetSmartMetrics';
import { enqueueReminder } from '../../services/reminders/ReminderService';
import {
  hasExpiredDocuments,
  needsAttention,
  attentionSummary,
} from '../../utils/assetExpiry';
import { normalizeAssetRecord } from '../../services/storageService';
import { summarizePortfolioCost, calculateCostToUse } from '../../utils/costToUse';
import { calculateResaleValue } from '../../utils/resaleCalculator';
import { summarizeHouseholdNetWorth } from '../../utils/portfolioNetWorth';
import { buildPortfolioFinance } from '../../services/finance/portfolioFinance';
import { formatInr as formatFinanceInr } from '../../services/finance/financeConstants';
import { findUpgradeReviewAlerts } from '../../utils/maintenanceValueAlert';
import { OfflineSyncBanner } from '../../components/OfflineSyncBanner';
import { OfflineVaultCache } from '../../services/offline/OfflineVaultCache';
import { buildUpcomingSummary } from '../../services/notifications/notificationRules';
import { evaluatePortfolioNotifications } from '../../services/notifications/notificationRules';
import { unreadCount as getUnreadNotificationCount } from '../../services/health/notificationCenter';
import { QuickActionGrid, SectionHeader } from '../../components/ui/DesignSystem';
import { SmartAssetListCard } from '../../components/ui/SmartAssetListCard';
import { useResponsiveLayout } from '../../utils/responsive';

function formatRupee(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function initialsFromName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function assetStatusLine(asset) {
  const bits = [];
  const puc = daysUntil(asset.pucExpiry);
  const svc = daysUntil(asset.nextServiceDue);
  const ins = daysUntil(asset.insuranceExpiry);
  const war = daysUntil(asset.warrantyExpiry);
  if (puc != null) {
    if (puc < 0) bits.push('PUC Expired');
    else if (puc <= 15) bits.push(`PUC ${puc}d`);
    else bits.push('PUC Valid');
  }
  if (svc != null) {
    if (svc < 0) bits.push('Service Overdue');
    else if (svc <= 15) bits.push(`Service ${svc}d`);
  }
  if (ins != null) {
    if (ins < 0) bits.push('Insurance Expired');
    else if (ins <= 15) bits.push('Insurance Due');
    else bits.push('Insurance OK');
  }
  if (war != null) {
    if (war < 0) bits.push('Warranty Expired');
    else if (war <= 30) bits.push(`Warranty ${war}d`);
    else bits.push('Warranty Active');
  }
  if (!bits.length) bits.push(asset.storeName || asset.categoryLabel || 'Protected');
  return bits.slice(0, 2).join(' · ');
}

function urgentLabel(task) {
  if (task.days == null) return 'SOON';
  if (task.days < 0) return 'EXPIRED';
  if (task.days === 0) return 'TODAY';
  return `${task.days} DAY${task.days === 1 ? '' : 'S'}`;
}

export function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isCompact } = useResponsiveLayout();
  const { profile, isAuthenticated, user, displayName: authDisplayName } = useAuth();
  const { assets, urgent, loading, removeAsset, portfolioHealth } = useAssets();
  const [exporting, setExporting] = useState(false);
  const [listFilter, setListFilter] = useState('all'); // all | expired | attention
  const [reminderTask, setReminderTask] = useState(null);
  const [expenseRowsByAsset, setExpenseRowsByAsset] = useState({});
  const swipeRefs = useRef({});

  // Never blank the greeting on auth hydrate flicker — use cached name immediately
  const displayName =
    authDisplayName ||
    profile?.name ||
    user?.displayName ||
    (isAuthenticated ? 'Asset Owner' : 'Guest');
  const avatarUri = String(user?.photoURL || profile?.photoURL || '').trim();
  const defaultAvatarColors = {
    'default:teal': '#0D9488',
    'default:blue': '#2563EB',
    'default:amber': '#D97706',
    'default:rose': '#E11D48',
  };
  const isDefaultAvatar = avatarUri.startsWith('default:');
  // Bust Image cache when the same Storage path is overwritten (skip preset avatars)
  const avatarSource =
    avatarUri && !isDefaultAvatar
      ? {
          uri: avatarUri.includes('?')
            ? `${avatarUri}&v=${encodeURIComponent(String(profile?.updatedAt?.seconds || profile?.updatedAt || Date.now()))}`
            : `${avatarUri}?v=${encodeURIComponent(String(profile?.updatedAt?.seconds || profile?.updatedAt || Date.now()))}`,
        }
      : null;
  const defaultAvatarColor = defaultAvatarColors[avatarUri] || null;
  const familyCount = Number(profile?.familyMemberCount || profile?.familyCount || 0);
  const showGoldenShield = (portfolioHealth?.score ?? 0) >= 100 && (portfolioHealth?.count ?? 0) > 0;

  const activeAssets = useMemo(
    () => assets.filter((asset) => isAlertableStatus(asset.status) && !asset.deletedAt),
    [assets],
  );

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid;
    if (!uid || !activeAssets.length) {
      setExpenseRowsByAsset({});
      return undefined;
    }
    (async () => {
      const map = {};
      const slice = activeAssets.slice(0, 50);
      await Promise.all(
        slice.map(async (a) => {
          const id = a.assetId || a.id;
          if (!id) return;
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
  }, [user?.uid, activeAssets]);

  const netWorth = useMemo(
    () => summarizeHouseholdNetWorth(activeAssets),
    [activeAssets],
  );
  const portfolioFinance = useMemo(
    () =>
      buildPortfolioFinance(activeAssets, {
        expenseRowsByAsset,
        actorUserId: user?.uid,
      }),
    [activeAssets, expenseRowsByAsset, user?.uid],
  );
  const totalVaultValue = netWorth.totalCurrent;
  const vehicleValue = netWorth.vehiclesCurrent;
  const gadgetsValue = netWorth.gadgetsCurrent;

  const upgradeAlerts = useMemo(
    () => findUpgradeReviewAlerts(activeAssets),
    [activeAssets],
  );
  const portfolioCost = useMemo(() => summarizePortfolioCost(activeAssets), [activeAssets]);
  const topResaleAsset = useMemo(() => {
    let best = null;
    let bestVal = 0;
    for (const asset of activeAssets) {
      const row = calculateResaleValue({
        purchaseValue: asset.value,
        purchaseDate: asset.purchaseDate,
        categoryId: asset.categoryId,
        category: asset.category,
        condition: asset.condition || 'good',
      });
      if ((row.estimatedResale || 0) > bestVal) {
        bestVal = row.estimatedResale || 0;
        best = { asset, ...row };
      }
    }
    return best;
  }, [activeAssets]);
  const warrantyHealthy = useMemo(() => {
    const withWarranty = activeAssets.filter((a) => a.warrantyExpiry);
    if (!withWarranty.length) return { active: 0, total: 0 };
    const active = withWarranty.filter((a) => {
      const d = daysUntil(a.warrantyExpiry);
      return d != null && d >= 0;
    }).length;
    return { active, total: withWarranty.length };
  }, [activeAssets]);


  const countdownTasks = useMemo(
    () => buildCountdownTasks(assets, { withinDays: 45, maxItems: 8 }),
    [assets],
  );

  const todaysActions = useMemo(
    () => buildTodaysAssetActions(assets, { maxItems: 5 }),
    [assets],
  );

  const householdHealth = useMemo(
    () => buildHouseholdHealthOverview(assets),
    [assets],
  );

  const upcomingSummary = useMemo(() => {
    const rows = evaluatePortfolioNotifications(activeAssets, {
      userId: user?.uid,
    });
    return buildUpcomingSummary(rows);
  }, [activeAssets, user?.uid]);

  const [notifUnread, setNotifUnread] = useState(0);
  React.useEffect(() => {
    getUnreadNotificationCount()
      .then(setNotifUnread)
      .catch(() => setNotifUnread(0));
  }, [assets]);

  /** Expired + due-soon banners (expired first, red alert) */
  const urgentBanners = useMemo(() => {
    const expiredFirst = (urgent || [])
      .filter((entry) => entry.days != null && entry.days <= 15)
      .sort((a, b) => a.days - b.days)
      .slice(0, 6)
      .map((entry) => ({
        id: `urgent-${entry.asset?.assetId || entry.field}-${entry.field}`,
        title: cleanAssetDisplayName(entry.asset?.assetName, {
          registration: entry.asset?.registration,
        }) || 'Asset',
        subtitle: entry.message || entry.field,
        days: entry.days,
        assetId: entry.asset?.assetId || entry.asset?.id,
        tone: entry.days < 0 ? 'expired' : entry.days <= 3 ? 'critical' : 'warn',
        field: entry.field,
      }));
    if (expiredFirst.length) return expiredFirst;

    return countdownTasks
      .filter((t) => t.days == null || t.days <= 15)
      .slice(0, 4)
      .map((task) => ({
        ...task,
        title: cleanAssetDisplayName(task.title, {}) || task.title,
        tone: task.days != null && task.days < 0 ? 'expired' : 'warn',
      }));
  }, [countdownTasks, urgent]);

  const folderCounts = useMemo(() => countAssetsByFolder(activeAssets), [activeAssets]);

  const listedAssets = useMemo(() => {
    if (listFilter === 'expired') {
      return activeAssets.filter((a) => hasExpiredDocuments(a));
    }
    if (listFilter === 'attention') {
      return activeAssets.filter((a) => needsAttention(a, 15));
    }
    return activeAssets.slice(0, 8);
  }, [activeAssets, listFilter]);

  const expiredCount = useMemo(
    () => activeAssets.filter((a) => hasExpiredDocuments(a)).length,
    [activeAssets],
  );
  const attentionCount = useMemo(
    () => activeAssets.filter((a) => needsAttention(a, 15)).length,
    [activeAssets],
  );

  const confirmDelete = (item) => {
    const id = item.assetId || item.id;
    Alert.alert('Delete Asset', `Remove “${item.assetName}” from your vault?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await removeAsset(id);
          if (!result?.success) {
            Alert.alert('Delete failed', result?.error || 'Could not delete');
            return;
          }
          Haptics.success();
          swipeRefs.current[id]?.close?.();
        },
      },
    ]);
  };

  const goScan = () => {
    // TODO: RE-ENABLE AUTH REQUIREMENT BEFORE PRODUCTION
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to scan a bill into your vault.',
      onAuthed: () => openScanInvoice(),
    });
  };

  const goManual = () => {
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to add an asset manually.',
      onAuthed: () => navigation?.getParent()?.navigate?.('Assets', { screen: 'AddAsset' }),
    });
  };

  const goProfile = () => {
    navigation?.getParent()?.navigate?.('Settings', { screen: 'ProfileHome' });
  };

  const goVault = () => {
    Haptics.tap();
    navigation?.navigate?.('VaultHome');
  };

  const goAssets = () => {
    navigation?.getParent()?.navigate?.('Assets');
  };

  const goFolders = () => {
    Haptics.tap();
    navigation?.navigate?.('CategoryFolders');
  };

  const exportPdf = async () => {
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to export your vault PDF.',
      onAuthed: async () => {
        Haptics.tap();
        setExporting(true);
        try {
          const rows = activeAssets
            .map(
              (a) =>
                `<tr><td>${a.assetName || ''}</td><td>${a.categoryLabel || a.category || ''}</td><td>${formatINR(a.value)}</td><td>${a.registration || a.serialNumber || '—'}</td></tr>`,
            )
            .join('');
          const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
            body{font-family:system-ui;padding:24px;color:#0f172a}
            h1{font-size:22px;margin:0 0 4px} .muted{color:#64748b;font-size:12px}
            .total{font-size:28px;font-weight:800;margin:16px 0}
            table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
            th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}
            th{color:#64748b;font-size:10px;text-transform:uppercase}
          </style></head><body>
            <h1>Asset Doctor — Vault Export</h1>
            <div class="muted">${displayName} · ${new Date().toLocaleDateString('en-IN')}</div>
            <div class="total">${formatINR(totalVaultValue)}</div>
            <div class="muted">Total managed net worth · ${activeAssets.length} assets</div>
            <table><thead><tr><th>Asset</th><th>Category</th><th>Value</th><th>ID</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4">No assets yet</td></tr>'}</tbody></table>
          </body></html>`;
          const file = await Print.printToFileAsync({ html });
          try {
            // eslint-disable-next-line global-require, import/no-extraneous-dependencies
            const ShareRN = require('react-native-share').default;
            await ShareRN.open({
              url: file.uri,
              type: 'application/pdf',
              title: 'Export Asset Doctor vault',
              filename: 'asset-doctor-vault.pdf',
            });
          } catch {
            Alert.alert('PDF ready', 'Vault PDF was created on this device.');
          }
          Haptics.success();
        } catch (error) {
          Haptics.error();
          Alert.alert('Export failed', error?.message || 'Could not create PDF');
        } finally {
          setExporting(false);
        }
      },
    });
  };

  return (
    <View style={styles.shell}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <OfflineSyncBanner userId={user?.uid} />
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable style={styles.profileChip} onPress={goProfile}>
            <View style={styles.avatarWrap}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatarImage} />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    defaultAvatarColor ? { backgroundColor: defaultAvatarColor } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      defaultAvatarColor ? { color: '#FFFFFF' } : null,
                    ]}
                  >
                    {initialsFromName(displayName)}
                  </Text>
                </View>
              )}
              {showGoldenShield ? (
                <GoldenShieldBadge size={16} style={styles.shieldBadge} />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeEyebrow}>
                {(() => {
                  const h = new Date().getHours();
                  if (h < 12) return 'Good Morning';
                  if (h < 17) return 'Good Afternoon';
                  return 'Good Evening';
                })()}
              </Text>
              <Text style={styles.welcomeName} numberOfLines={1}>
                {displayName} ›
              </Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            <IconButton
              label="🔎"
              accessibilityLabel="Search vault"
              onPress={() => {
                Haptics.tap();
                navigation?.navigate?.('GlobalSearch');
              }}
            />
            <IconButton
              label={notifUnread > 0 ? `🔔${notifUnread > 9 ? '9+' : notifUnread}` : '🔔'}
              accessibilityLabel={
                notifUnread > 0
                  ? `Notifications, ${notifUnread} unread`
                  : 'Notifications'
              }
              onPress={() => {
                Haptics.tap();
                navigation?.navigate?.('NotificationCenter');
              }}
            />
            <IconButton
              label="▦"
              accessibilityLabel="Category folders"
              onPress={goFolders}
            />
          </View>
        </View>

        {!isAuthenticated ? (
          <Pressable style={styles.guestBanner} onPress={() => openLogin(navigation)}>
            <Text style={styles.guestTitle}>Sign in to sync your locker</Text>
            <Text style={styles.guestSub}>Cloud backup for assets, bills & reminders</Text>
          </Pressable>
        ) : null}

        <HealthScoreGauge
          score={portfolioHealth?.score ?? 100}
          grade={portfolioHealth?.grade}
          assetCount={portfolioHealth?.count ?? 0}
          attentionCount={attentionCount}
          onPress={() => {
            Haptics.tap();
            setListFilter('attention');
          }}
          onViewDetails={() => {
            Haptics.tap();
            setListFilter('attention');
            goAssets();
          }}
        />

        {/* Compact asset summary */}
        <View style={styles.summaryStrip}>
          {(isCompact
            ? [
                { label: 'Assets', value: activeAssets.length },
                { label: 'Vehicles', value: folderCounts.vehicle || 0 },
                { label: 'Home', value: (folderCounts.appliances || 0) + (folderCounts.gadgets || 0) },
                { label: 'Expiring', value: (upcomingSummary?.insurance || 0) + (upcomingSummary?.warranty || 0) + (upcomingSummary?.puc || 0) || expiredCount },
              ]
            : [
                { label: 'Assets', value: activeAssets.length },
                { label: 'Vehicles', value: folderCounts.vehicle || 0 },
                { label: 'Appliances', value: folderCounts.appliances || 0 },
                { label: 'Gadgets', value: folderCounts.gadgets || 0 },
                { label: 'Docs', value: folderCounts.documents || 0 },
                { label: 'Services', value: upcomingSummary?.service ?? 0 },
                { label: 'Expiring', value: (upcomingSummary?.insurance || 0) + (upcomingSummary?.warranty || 0) + (upcomingSummary?.puc || 0) || expiredCount },
              ]
          ).map((cell) => (
            <View
              key={cell.label}
              style={[styles.summaryCell, isCompact && { width: '25%', minWidth: 72 }]}
            >
              <Text style={styles.summaryValue}>{cell.value}</Text>
              <Text style={styles.summaryLabel}>{cell.label}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Quick actions" subtitle="Most used tools" />
        <QuickActionGrid
          actions={[
            {
              id: 'add',
              icon: '＋',
              label: 'Add Asset',
              onPress: goManual,
            },
            {
              id: 'scan',
              icon: '📷',
              label: 'Scan Bill',
              onPress: goScan,
            },
            {
              id: 'doc',
              icon: '📄',
              label: 'Documents',
              onPress: goVault,
            },
            {
              id: 'svc',
              icon: '🛠',
              label: 'Service',
              onPress: () => {
                Haptics.tap();
                const first = activeAssets[0];
                if (first) {
                  navigation?.navigate?.('Maintenance', {
                    assetId: first.assetId || first.id,
                  });
                } else {
                  goManual();
                }
              },
            },
            {
              id: 'analytics',
              icon: '📊',
              label: 'Analytics',
              onPress: () => {
                Haptics.tap();
                const first = activeAssets[0];
                if (first) {
                  navigation?.navigate?.('AssetAnalytics', {
                    assetId: first.assetId || first.id,
                  });
                } else {
                  goAssets();
                }
              },
            },
            {
              id: 'qr',
              icon: '⬚',
              label: 'Scan QR',
              onPress: () => {
                Haptics.tap();
                navigation?.navigate?.('ScanAssetQr');
              },
            },
          ]}
        />

        {/* Net worth card — estimated current / resale value across household */}
        <View style={styles.worthCard}>
          <View style={styles.worthTop}>
            <Text style={styles.worthEyebrow}>HOUSEHOLD NET WORTH</Text>
            <View style={styles.lockerBadge}>
              <Text style={styles.lockerBadgeText}>🛡 Est. market value</Text>
            </View>
          </View>
          <Text style={styles.worthValue}>{formatINR(totalVaultValue)}</Text>
          <Text style={[styles.guestSub, { marginBottom: 10 }]}>
            Purchase total {formatINR(netWorth.totalPurchase)} · {netWorth.count} assets
          </Text>
          <View style={styles.worthSplit}>
            <View style={styles.worthSplitItem}>
              <Text style={styles.splitIcon}>🏍️</Text>
              <View>
                <Text style={styles.splitLabel}>Vehicles</Text>
                <Text style={styles.splitValue}>{formatLakhs(vehicleValue)}</Text>
              </View>
            </View>
            <View style={styles.worthDivider} />
            <View style={styles.worthSplitItem}>
              <Text style={styles.splitIcon}>💻</Text>
              <View>
                <Text style={styles.splitLabel}>Gadgets / Home</Text>
                <Text style={styles.splitValue}>{formatLakhs(gadgetsValue)}</Text>
              </View>
            </View>
          </View>
        </View>

        {portfolioFinance?.totalAssets > 0 ? (
          <View style={[styles.worthCard, { marginTop: 12 }]}>
            <Text style={styles.worthEyebrow}>MY ASSET PORTFOLIO</Text>
            <Text style={[styles.guestSub, { marginBottom: 8 }]}>
              {portfolioFinance.totalAssets} assets · estimates labeled clearly
            </Text>
            <Text style={styles.splitLabel}>
              Purchase Value:{' '}
              <Text style={styles.splitValue}>{formatFinanceInr(portfolioFinance.purchaseValue)}</Text>
            </Text>
            <Text style={styles.splitLabel}>
              Estimated Current Value:{' '}
              <Text style={styles.splitValue}>
                {formatFinanceInr(portfolioFinance.currentEstimatedValue)}
              </Text>
            </Text>
            <Text style={styles.splitLabel}>
              Maintenance:{' '}
              <Text style={styles.splitValue}>
                {formatFinanceInr(portfolioFinance.expenses.maintenance)}
              </Text>
            </Text>
            <Text style={styles.splitLabel}>
              Repairs:{' '}
              <Text style={styles.splitValue}>
                {formatFinanceInr(portfolioFinance.expenses.repairs)}
              </Text>
            </Text>
            <Text style={styles.splitLabel}>
              Insurance:{' '}
              <Text style={styles.splitValue}>
                {formatFinanceInr(portfolioFinance.expenses.insurance)}
              </Text>
            </Text>
            <Text style={[styles.splitLabel, { marginTop: 4, fontWeight: '800' }]}>
              Total Ownership Cost:{' '}
              <Text style={styles.splitValue}>
                {formatFinanceInr(portfolioFinance.totalOwnershipCost)}
              </Text>
            </Text>
            <Text style={styles.splitLabel}>
              Monthly ownership (sum):{' '}
              <Text style={styles.splitValue}>
                {formatFinanceInr(portfolioFinance.monthlyMaintenanceCost || 0)}
              </Text>
            </Text>
            <Text style={styles.splitLabel}>
              Annual ownership (×12):{' '}
              <Text style={styles.splitValue}>
                {formatFinanceInr(portfolioFinance.annualMaintenanceCost || 0)}
              </Text>
            </Text>
            <Text style={styles.splitLabel}>
              Requiring attention:{' '}
              <Text style={styles.splitValue}>
                {portfolioFinance.assetsRequiringAttention ?? 0}
              </Text>
            </Text>
            <Text style={styles.splitLabel}>
              Near replacement:{' '}
              <Text style={styles.splitValue}>{portfolioFinance.assetsNearReplacement ?? 0}</Text>
            </Text>
            <Text style={[styles.guestSub, { marginTop: 8 }]}>
              Open any asset passport → View Asset Analytics for age, depreciation, and lifecycle.
            </Text>
            {(portfolioFinance.byCategory || [])
              .filter((c) => c.folder !== 'documents')
              .slice(0, 4)
              .map((c) => (
                <Pressable
                  key={c.folder}
                  onPress={() => {
                    Haptics.tap();
                    navigation?.navigate?.('CategoryFolders', { focusFolder: c.folder });
                  }}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 6,
                  }}
                >
                  <Text style={styles.splitLabel}>
                    {c.label} · {c.count}
                  </Text>
                  <Text style={styles.splitValue}>{formatFinanceInr(c.purchaseValue)}</Text>
                </Pressable>
              ))}
          </View>
        ) : null}

        {upgradeAlerts.length ? (
          <View style={[styles.worthCard, { marginTop: 12, borderColor: '#F59E0B', borderWidth: 1 }]}>
            <Text style={styles.worthEyebrow}>MAINTENANCE VS VALUE</Text>
            {upgradeAlerts.slice(0, 2).map((row) => (
              <Pressable
                key={row.asset?.assetId || row.asset?.id}
                onPress={() => {
                  Haptics.tap();
                  const id = row.asset?.assetId || row.asset?.id;
                  if (id) navigation?.navigate?.('AssetPassport', { assetId: id });
                }}
                style={{ marginTop: 8 }}
              >
                <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: 14 }}>
                  {cleanAssetDisplayName(row.asset?.assetName) || 'Asset'}
                </Text>
                <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                  {row.eval?.message}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}


        {/* Master feature modules */}
        <Text style={styles.sectionLabel}>SMART TOOLS</Text>
        <View style={styles.featureGrid}>
          <Pressable
            style={styles.featureCard}
            onPress={() => {
              Haptics.tap();
              const sample = activeAssets[0];
              const row = sample
                ? calculateCostToUse(sample)
                : { dailyCost: portfolioCost.dailyCost, monthlyCost: portfolioCost.monthlyCost, assetName: 'your vault' };
              Alert.alert(
                'AI Cost-to-Use',
                sample
                  ? `${row.assetName}\n\n~₹${row.dailyCost}/day · ₹${row.monthlyCost}/month\nOwnership cost so far: ₹${row.ownershipCost?.toLocaleString?.('en-IN') || row.ownershipCost}`
                  : `Vault average usage\n\n~₹${portfolioCost.dailyCost}/day · ₹${portfolioCost.monthlyCost}/month across ${portfolioCost.count} assets.`,
              );
            }}
          >
            <Text style={styles.featureIcon}>📉</Text>
            <Text style={styles.featureTitle}>Cost-to-Use</Text>
            <Text style={styles.featureValue}>₹{portfolioCost.dailyCost}/day</Text>
            <Text style={styles.featureSub}>₹{portfolioCost.monthlyCost}/mo ownership</Text>
          </Pressable>
          <Pressable
            style={styles.featureCard}
            onPress={() => {
              Haptics.tap();
              if (!topResaleAsset) {
                Alert.alert('Resale estimate', 'Add an asset with purchase price to see market value.');
                return;
              }
              Alert.alert(
                'One-Click Resale',
                `${cleanAssetDisplayName(topResaleAsset.asset?.assetName, { registration: topResaleAsset.asset?.registration }) || 'Asset'}\n\nEst. market value: ${formatINR(topResaleAsset.estimatedResale)}\nRetained: ${topResaleAsset.breakdown?.retainedPercent || 0}%`,
              );
            }}
          >
            <Text style={styles.featureIcon}>💰</Text>
            <Text style={styles.featureTitle}>Resale Value</Text>
            <Text style={styles.featureValue}>
              {topResaleAsset ? formatINR(topResaleAsset.estimatedResale) : '—'}
            </Text>
            <Text style={styles.featureSub}>Tap for estimate</Text>
          </Pressable>
          <Pressable
            style={styles.featureCard}
            onPress={() => {
              Haptics.tap();
              Alert.alert(
                'Warranty health',
                warrantyHealthy.total
                  ? `${warrantyHealthy.active} of ${warrantyHealthy.total} warranties still active.`
                  : 'Scan warranty cards to track coverage windows.',
              );
            }}
          >
            <Text style={styles.featureIcon}>🛡️</Text>
            <Text style={styles.featureTitle}>Warranty</Text>
            <Text style={styles.featureValue}>
              {warrantyHealthy.total ? `${warrantyHealthy.active}/${warrantyHealthy.total}` : '—'}
            </Text>
            <Text style={styles.featureSub}>Active cover</Text>
          </Pressable>
          <Pressable
            style={styles.featureCard}
            onPress={() => {
              Haptics.tap();
              Alert.alert(
                'Insurance & PUC',
                urgentBanners.length
                  ? `${urgentBanners.length} reminder(s) need attention — scroll to Urgent Reminders.`
                  : 'No PUC / insurance alerts in the next 15 days.',
              );
            }}
          >
            <Text style={styles.featureIcon}>🔔</Text>
            <Text style={styles.featureTitle}>Expiry Alerts</Text>
            <Text style={styles.featureValue}>{urgentBanners.length || 0}</Text>
            <Text style={styles.featureSub}>PUC · Insurance</Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.sectionBlock}
          onPress={() => {
            Haptics.tap();
            navigation?.navigate?.('NotificationCenter');
          }}
        >
          <Text style={styles.sectionTitle}>
            Upcoming {notifUnread > 0 ? `· 🔔 ${notifUnread}` : ''}
          </Text>
          <Text style={styles.sectionSub}>
            Insurance {upcomingSummary.insurance} · Service {upcomingSummary.service} · Warranty{' '}
            {upcomingSummary.warranty} · PUC {upcomingSummary.puc} · Expired {upcomingSummary.expired}
          </Text>
        </Pressable>
        {householdHealth.totalAssets > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Household health</Text>
            <Text style={styles.sectionSub}>
              {householdHealth.healthyAssets} healthy · {householdHealth.needsAttention} need
              attention · {householdHealth.criticalAssets} critical
            </Text>
          </View>
        ) : null}
        {todaysActions.length ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Today&apos;s asset actions</Text>
            {todaysActions.map((action) => (
              <Pressable
                key={action.alertId || `${action.rank}-${action.title}`}
                style={styles.urgentCard}
                onPress={() => {
                  Haptics.tap();
                  if (action.assetId) {
                    navigation.navigate('AssetPassport', { assetId: action.assetId });
                  } else {
                    Alert.alert(action.title, action.message);
                  }
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.urgentTitle} numberOfLines={1}>
                    {action.rank}. {action.title}
                  </Text>
                  <Text style={styles.urgentSub} numberOfLines={2}>
                    {action.message}
                  </Text>
                </View>
                <View style={styles.urgentPill}>
                  <Text style={styles.urgentPillText}>{action.priority}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        {/* Action row */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionPrimary}
            onPress={() => {
              Haptics.tap();
              goScan();
            }}
          >
            <Text style={styles.actionPrimaryText}>Scan bill</Text>
          </Pressable>
          <Pressable
            style={styles.actionSecondary}
            onPress={exportPdf}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={COLORS.emerald} size="small" />
            ) : (
              <Text style={styles.actionSecondaryText}>Export</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.actionSecondary}
            onPress={() => {
              Haptics.tap();
              goManual();
            }}
          >
            <Text style={styles.actionSecondaryText}>Manual</Text>
          </Pressable>
        </View>

        {/* Family vault */}
        <Pressable
          style={styles.familyCard}
          onPress={() => {
            Haptics.select();
            goVault();
          }}
        >
          <View style={styles.familyIconWrap}>
            <Text style={{ fontSize: 18 }}>👨‍👩‍👧‍👦</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.familyTitle}>Family Vault Access</Text>
            <Text style={styles.familySub}>
              {familyCount > 0
                ? `Shared with ${familyCount} Member${familyCount === 1 ? '' : 's'} (Active)`
                : 'Shared locker for household docs · tap to open Vault'}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        {/* Urgent — expired (red) + due soon */}
        <Text style={styles.sectionLabel}>URGENT REMINDERS</Text>
        {urgentBanners.length ? (
          urgentBanners.map((task) => {
            const isExpired = task.tone === 'expired' || (task.days != null && task.days < 0);
            return (
              <Pressable
                key={task.id}
                style={styles.urgentCard}
                onPress={() => {
                  Haptics.tap();
                  setReminderTask(task);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.urgentTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={styles.urgentSub} numberOfLines={1}>
                    {task.subtitle || task.detail || 'Due soon'}
                  </Text>
                </View>
                <View style={[styles.urgentPill, isExpired && styles.urgentPillExpired]}>
                  <Text style={[styles.urgentPillText, isExpired && styles.urgentPillTextExpired]}>
                    {urgentLabel(task)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.clearCard}>
            <Text style={styles.clearText}>
              All clear — no expired or due-soon PUC / insurance / warranty alerts.
            </Text>
          </View>
        )}

        {/* Folder vaults — primary home organization */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabelTight}>YOUR FOLDERS</Text>
          <Pressable onPress={goFolders}>
            <Text style={styles.viewAll}>Open all →</Text>
          </Pressable>
        </View>
        <View style={styles.folderGrid}>
          {['vehicle', 'gadgets', 'appliances', 'documents'].map((id) => {
            const folder = FOLDER_META[id];
            if (!folder) return null;
            return (
              <Pressable
                key={id}
                style={[styles.folderTile, { borderLeftColor: folder.accent }]}
                onPress={() => {
                  Haptics.tap();
                  navigation?.navigate?.('CategoryFolders', { focusFolder: id });
                }}
              >
                <CategoryIcon name={folder.iconKey || id} size={28} color={folder.accent} />
                <Text style={styles.folderTileTitle}>{folder.title}</Text>
                <Text style={styles.folderTileCount}>
                  {folderCounts[id] || 0} {folder.countLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Attention filters */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabelTight}>ACTIVE ASSETS</Text>
          <Pressable onPress={goAssets}>
            <Text style={styles.viewAll}>View All →</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {[
            { id: 'all', label: 'All' },
            { id: 'expired', label: `Expired Assets${expiredCount ? ` (${expiredCount})` : ''}` },
            {
              id: 'attention',
              label: `Attention Required${attentionCount ? ` (${attentionCount})` : ''}`,
            },
          ].map((f) => (
            <Pressable
              key={f.id}
              onPress={() => {
                Haptics.select();
                setListFilter(f.id);
              }}
              style={[styles.filterChip, listFilter === f.id && styles.filterChipOn]}
            >
              <Text style={[styles.filterChipText, listFilter === f.id && styles.filterChipTextOn]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? <Text style={styles.muted}>Loading vault…</Text> : null}
        {!loading && !listedAssets.length ? (
          <Pressable style={styles.emptyCard} onPress={goScan}>
            <Text style={styles.emptyTitle}>No assets yet</Text>
            <Text style={styles.emptySub}>Tap Scan bill to add your first purchase bill.</Text>
          </Pressable>
        ) : null}

        {listedAssets.map((rawItem) => {
          const item = normalizeAssetRecord(rawItem);
          const id = item.assetId || item.id;
          const valuation = getCurrentValuation(item);
          const health = getAssetHealthStatus(item);
          const support = resolveSupportContact(item);
          const displayName = cleanAssetDisplayName(item.assetName, {
            registration: item.registration,
          });
          const plate = formatRegistrationDisplay(item.registration);
          const gadget = computeGadgetSmartMetrics(item);
          const expired = hasExpiredDocuments(item) || health.id === 'critical';
          return (
            <Swipeable
              key={id}
              ref={(ref) => {
                if (ref) swipeRefs.current[id] = ref;
              }}
              renderRightActions={() => (
                <Pressable
                  style={styles.swipeDelete}
                  onPress={() => confirmDelete(item)}
                >
                  <Text style={styles.swipeDeleteText}>Delete</Text>
                </Pressable>
              )}
            >
              <Pressable
                style={[
                  styles.assetCard,
                  expired && styles.assetCardExpired,
                ]}
                onPress={() => {
                  Haptics.tap();
                  navigation.navigate('AssetPassport', { assetId: id });
                }}
                onLongPress={() => confirmDelete(item)}
              >
                <View style={[styles.statusBar, { backgroundColor: health.bar }]} />
                <View style={styles.assetIconWrap}>
                  <CategoryIcon
                    name={item.categoryId || item.icon || 'other'}
                    size={32}
                    color={COLORS.emerald}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.assetName} numberOfLines={1}>
                    {displayName || item.assetName}
                  </Text>
                  {plate ? (
                    <Text style={styles.plateText} numberOfLines={1}>
                      {plate}
                    </Text>
                  ) : null}
                  <Text style={styles.assetMeta} numberOfLines={1}>
                    {health.detail || (expired ? attentionSummary(item) : assetStatusLine(item))}
                  </Text>
                  <View style={styles.valuationRow}>
                    <Text style={styles.purPrice} numberOfLines={1}>
                      Pur: {formatRupee(valuation.purchase)}
                    </Text>
                    <Text style={styles.nowPrice} numberOfLines={1}>
                      Now: {formatRupee(valuation.current)}
                    </Text>
                  </View>
                  <AssetHealthBadge status={health} style={{ marginTop: 8 }} />
                  {gadget ? (
                    <View style={styles.gadgetRow}>
                      <Text style={styles.gadgetChip}>🔋 {gadget.batteryHealthPercent}%</Text>
                      <Text style={styles.gadgetChip}>
                        ₹{Math.round(gadget.liveResaleValue / 1000)}k
                      </Text>
                    </View>
                  ) : null}
                  {support?.phone ? (
                    <Text style={styles.helplineHint} numberOfLines={1}>
                      ☎ {support.label}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </Swipeable>
          );
        })}

        <Text style={styles.buildStamp}>Asset Doctor · {OTA_BUNDLE_LABEL}</Text>
      </ScrollView>

      <ReminderActionSheet
        visible={Boolean(reminderTask)}
        task={reminderTask}
        onClose={() => setReminderTask(null)}
        onOpenAsset={(task) => {
          setReminderTask(null);
          if (task?.assetId) navigation.navigate('AssetPassport', { assetId: task.assetId });
        }}
        onBookService={(task) => {
          setReminderTask(null);
          if (task?.assetId) {
            navigation.navigate('Maintenance', { assetId: task.assetId });
          }
        }}
        onSetReminder={async (task) => {
          setReminderTask(null);
          if (!user?.uid || !task?.assetId) {
            Alert.alert('Reminder', 'Sign in to set email & push reminders.');
            return;
          }
          const trigger = new Date();
          trigger.setDate(trigger.getDate() + Math.max(1, Number(task.days) || 3));
          const queued = await enqueueReminder(user.uid, {
            assetId: task.assetId,
            email: profile?.email || user?.email || '',
            title: task.title || 'Asset Doctor reminder',
            message:
              task.subtitle ||
              `Asset Doctor reminder: ${task.title} needs attention. Open the app → assetdoctor://asset/${task.assetId}`,
            triggerAt: trigger,
            type: 'urgent_card',
          });
          Alert.alert(
            'Reminder',
            queued.success
              ? 'Reminder queued — you will get push / email alerts.'
              : queued.error || 'Could not queue reminder',
          );
        }}
      />
    </View>
  );
}

function IconButton({ label, onPress, accessibilityLabel }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.select();
        onPress?.();
      }}
      style={styles.iconBtn}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      hitSlop={6}
    >
      <Text style={styles.iconBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: COLORS.bg },
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 120 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 10,
  },
  profileChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    backgroundColor: COLORS.successSoft,
  },
  shieldBadge: {
    position: 'absolute',
    bottom: -4,
    right: -6,
  },
  avatarText: { color: COLORS.emerald, fontWeight: '900', fontSize: 15 },
  welcomeEyebrow: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  welcomeName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16 },

  guestBanner: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  guestTitle: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  guestSub: { color: COLORS.muted, marginTop: 4, fontSize: 12 },

  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  summaryCell: {
    width: '14.28%',
    minWidth: 48,
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  worthCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  worthTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  worthEyebrow: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
  },
  lockerBadge: {
    backgroundColor: COLORS.successSoft,
    borderColor: COLORS.borderGlow,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  lockerBadgeText: { color: COLORS.emerald, fontSize: 10, fontWeight: '800' },
  worthValue: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 10,
    letterSpacing: -0.5,
  },
  worthSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  worthSplitItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  worthDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  splitIcon: { fontSize: 20 },
  splitLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  splitValue: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 2 },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionPrimary: {
    flex: 1.4,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimaryText: { color: COLORS.onPrimary, fontWeight: '900', fontSize: 14 },
  actionSecondary: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionSecondaryText: { color: COLORS.text, fontWeight: '800', fontSize: 13 },


  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  featureCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: '42%',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  featureIcon: { fontSize: 18, marginBottom: 6 },
  featureTitle: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  featureValue: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  featureSub: { color: COLORS.muted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  familyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  familyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyTitle: { color: COLORS.text, fontWeight: '800', fontSize: 15 },
  familySub: { color: COLORS.muted, fontSize: 12, marginTop: 3, lineHeight: 16 },
  chevron: { color: COLORS.muted, fontSize: 26, fontWeight: '300' },

  sectionLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sectionLabelTight: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  sectionBlock: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 4,
  },
  sectionSub: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 8,
  },
  viewAll: { color: COLORS.neonBlue, fontWeight: '800', fontSize: 12 },

  urgentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.urgentBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.urgentBorder,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  urgentTitle: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  urgentSub: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  urgentPill: {
    backgroundColor: COLORS.bgDeep,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  urgentPillText: { color: COLORS.amber, fontWeight: '900', fontSize: 10 },
  urgentPillExpired: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: 'transparent',
  },
  urgentPillTextExpired: { color: COLORS.rose },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.card,
  },
  filterChipOn: {
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.successSoft,
  },
  filterChipText: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  filterChipTextOn: { color: COLORS.emerald },
  clearCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    marginBottom: 18,
  },
  clearText: { color: COLORS.emerald, fontWeight: '700', fontSize: 13, lineHeight: 18 },

  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  statusBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  statusBarGreen: { backgroundColor: COLORS.success || '#10B981' },
  statusBarRed: { backgroundColor: COLORS.rose },
  plateText: {
    color: COLORS.neonBlue,
    fontWeight: '800',
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  gadgetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  gadgetChip: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.emerald,
    backgroundColor: 'rgba(13,148,136,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  assetCardExpired: {
    borderColor: COLORS.urgentBorder,
    backgroundColor: COLORS.bgDeep,
  },
  assetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.bgDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetName: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  assetMeta: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  valuationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  purPrice: { color: COLORS.text, fontWeight: '800', fontSize: 12 },
  nowPrice: { color: COLORS.emerald, fontWeight: '800', fontSize: 12 },
  assetValue: { color: COLORS.text, fontWeight: '800', fontSize: 12 },
  assetCurrent: { color: COLORS.emerald, fontWeight: '700', fontSize: 11, marginTop: 3 },
  helplineHint: { color: COLORS.neonBlue, fontSize: 10, fontWeight: '700', marginTop: 4 },
  swipeDelete: {
    backgroundColor: COLORS.rose,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginBottom: 10,
    borderRadius: 18,
  },
  swipeDeleteText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  emptyCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginBottom: 10,
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  folderTile: {
    width: '47%',
    flexGrow: 1,
    minWidth: '42%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    padding: 14,
  },
  folderTileTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 8,
  },
  folderTileCount: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyTitle: { color: COLORS.text, fontWeight: '800', fontSize: 15 },
  emptySub: { color: COLORS.muted, marginTop: 6, fontSize: 12, lineHeight: 17 },
  muted: { color: COLORS.muted, marginBottom: 8 },
  buildStamp: {
    color: COLORS.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
    opacity: 0.65,
  },
});

export default DashboardScreen;

/**
 * STEP 9 — Notification Center / Alerts (mobile UI polish)
 * Groups: Today · This Week · Upcoming. Uses existing NotificationEngine only.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { NotificationEngine } from '../../services/notifications/NotificationEngine';
import {
  NOTIFICATION_STATUS,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
  TYPE_TO_PREF_KEY,
} from '../../services/notifications/notificationTypes';
import { Haptics } from '../../services/haptics';
import { useThemeColors } from '../../context/ThemeProvider';
import { RADIUS, SPACING, TYPE, HIT } from '../../theme/tokens';
import { EmptyState, StatusBadge } from '../../components/ui/DesignSystem';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'due_soon', label: 'Due Soon' },
  { id: 'expired', label: 'Expired' },
];

const PRIORITY_RANK = {
  [NOTIFICATION_PRIORITY.CRITICAL]: 0,
  [NOTIFICATION_PRIORITY.HIGH]: 1,
  [NOTIFICATION_PRIORITY.MEDIUM]: 2,
  [NOTIFICATION_PRIORITY.LOW]: 3,
};

function priorityMeta(p) {
  if (p === NOTIFICATION_PRIORITY.CRITICAL) return { tone: 'error', label: 'Critical' };
  if (p === NOTIFICATION_PRIORITY.HIGH) return { tone: 'warning', label: 'Important' };
  if (p === NOTIFICATION_PRIORITY.MEDIUM) return { tone: 'info', label: 'Attention' };
  return { tone: 'neutral', label: 'Info' };
}

function alertTypeLabel(item) {
  const type = item.notificationType || item.type;
  if (type === NOTIFICATION_TYPE.SERVICE_DUE) return 'SERVICE DUE';
  if (type === NOTIFICATION_TYPE.MAINTENANCE_DUE) return 'MAINTENANCE';
  if (type === NOTIFICATION_TYPE.INSURANCE_EXPIRY) return 'INSURANCE';
  if (type === NOTIFICATION_TYPE.PUC_EXPIRY) return 'PUC';
  if (type === NOTIFICATION_TYPE.WARRANTY_EXPIRY) return 'WARRANTY';
  if (type === NOTIFICATION_TYPE.BATTERY_HEALTH) return 'BATTERY';
  if (type === NOTIFICATION_TYPE.ASSET_HEALTH) return 'HEALTH';
  if (type === NOTIFICATION_TYPE.DOCUMENT_EXPIRY) return 'DOCUMENT';
  const pref = TYPE_TO_PREF_KEY[type];
  if (pref) return String(pref).toUpperCase();
  if (item.category) return String(item.category).toUpperCase();
  return 'ALERT';
}

function metricLabel(item) {
  const d = item.daysLeft;
  if (d == null || Number.isNaN(Number(d))) return null;
  const n = Number(d);
  if (n < 0) return `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'} overdue`;
  if (n === 0) return 'Due today';
  if (n === 1) return '1 day left';
  return `${n} days left`;
}

function itemTime(item) {
  const raw =
    item.dueAt ||
    item.scheduledFor ||
    item.eventDate ||
    item.createdAt ||
    item.updatedAt ||
    item.timestamp ||
    null;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : Date.now();
}

function sortByPriority(items = []) {
  return [...items].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 9;
    const pb = PRIORITY_RANK[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    const da = a.daysLeft != null ? Number(a.daysLeft) : 999;
    const db = b.daysLeft != null ? Number(b.daysLeft) : 999;
    return da - db;
  });
}

function groupAlerts(items = []) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const todayEnd = start.getTime() + 86400000;
  const weekEnd = start.getTime() + 7 * 86400000;
  const today = [];
  const week = [];
  const upcoming = [];
  for (const item of items) {
    const t = itemTime(item);
    if (t < todayEnd) today.push(item);
    else if (t < weekEnd) week.push(item);
    else upcoming.push(item);
  }
  const sections = [];
  if (today.length) sections.push({ title: 'Today', data: sortByPriority(today) });
  if (week.length) sections.push({ title: 'This Week', data: sortByPriority(week) });
  if (upcoming.length) sections.push({ title: 'Upcoming', data: sortByPriority(upcoming) });
  if (!sections.length && items.length) {
    sections.push({ title: 'Alerts', data: sortByPriority(items) });
  }
  return sections;
}

function resolveAssetName(item, assets = []) {
  const id = item.assetId || item.deepLink?.assetId;
  if (id) {
    const match = assets.find((a) => (a.assetId || a.id) === id);
    if (match?.assetName) return match.assetName;
  }
  const title = String(item.title || '');
  const colon = title.indexOf(':');
  if (colon > 0) return title.slice(colon + 1).trim();
  return title || 'Your asset';
}

function isUnread(item) {
  return (
    item.status === NOTIFICATION_STATUS.UNREAD ||
    item.status === 'SCHEDULED' ||
    item.status === 'SENT' ||
    !item.status
  );
}

export function NotificationCenterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { assets } = useAssets();
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const filter =
      tab === 'all'
        ? {}
        : tab === 'unread'
          ? { status: 'unread' }
          : tab === 'expired'
            ? { status: 'expired' }
            : { status: 'due_soon' };
    const list = await NotificationEngine.getCenter(filter);
    setItems(list);
  }, [tab]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.tap();
    await NotificationEngine.refreshForUser(user?.uid, assets).catch(() => {});
    await load();
    setRefreshing(false);
  };

  const navigateToItem = async (item) => {
    await NotificationEngine.markRead(item.alertId || item.notificationId);
    const assetId = item.assetId || item.deepLink?.assetId;
    const screen = item.deepLink?.screen || 'AssetPassport';
    const focusSection = item.deepLink?.focusSection || null;
    if (!assetId) return;
    if (screen === 'Maintenance') {
      navigation.navigate('Maintenance', { assetId, focusSection });
    } else if (screen === 'DocumentsVault') {
      navigation.navigate('DocumentsVault', { assetId, focusSection });
    } else {
      navigation.navigate('AssetPassport', { assetId, focusSection });
    }
    load().catch(() => {});
  };

  const openItem = async (item) => {
    Haptics.tap();
    await navigateToItem(item);
  };

  const dismissItem = async (item) => {
    Haptics.tap();
    await NotificationEngine.dismiss(item.alertId || item.notificationId);
    load().catch(() => {});
  };

  const sections = useMemo(() => groupAlerts(items), [items]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
      <Text style={[TYPE.h1, { color: colors.text, paddingHorizontal: 16 }]}>Alerts</Text>
      <Text style={[TYPE.caption, { color: colors.textMuted, paddingHorizontal: 16, marginTop: 4 }]}>
        Actionable reminders for the assets you own
      </Text>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              Haptics.tap();
              setTab(t.id);
            }}
            style={[
              styles.tab,
              {
                backgroundColor: tab === t.id ? colors.infoSoft : colors.surfaceMuted,
                borderColor: tab === t.id ? colors.secondary : colors.border,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
          >
            <Text
              style={[
                TYPE.caption,
                {
                  color: tab === t.id ? colors.secondary : colors.textMuted,
                  fontWeight: '700',
                },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.alertId || item.notificationId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="✓"
            title="You're all caught up"
            message="Expiry, service, and warranty alerts will appear here when something needs attention."
            style={{ marginHorizontal: 16, marginTop: 24 }}
          />
        }
        contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 16, flexGrow: 1 }}
        renderSectionHeader={({ section }) => (
          <Text style={[TYPE.label, { color: colors.textMuted, marginTop: 16, marginBottom: 8 }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const unread = isUnread(item);
          const meta = priorityMeta(item.priority);
          const typeLabel = alertTypeLabel(item);
          const assetName = resolveAssetName(item, assets);
          const metric = metricLabel(item);
          const priorityBorder =
            item.priority === NOTIFICATION_PRIORITY.CRITICAL
              ? colors.error
              : item.priority === NOTIFICATION_PRIORITY.HIGH
                ? colors.warning
                : unread
                  ? colors.borderAccent || colors.secondary
                  : colors.border;

          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: unread ? colors.surface : colors.surfaceMuted,
                  borderColor: priorityBorder,
                  borderLeftWidth: unread ? 3 : 1,
                  opacity: unread ? 1 : 0.88,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.typeRow}>
                    <Text style={[TYPE.micro, styles.typeLabel, { color: colors.primary }]}>
                      {typeLabel}
                    </Text>
                    {unread ? (
                      <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                    ) : (
                      <Text style={[TYPE.micro, { color: colors.textMuted }]}>Read</Text>
                    )}
                  </View>
                  <Text style={[TYPE.bodyStrong, { color: colors.text }]} numberOfLines={2}>
                    {assetName}
                  </Text>
                  {metric ? (
                    <Text style={[TYPE.caption, { color: colors.text, fontWeight: '700' }]}>
                      {metric}
                    </Text>
                  ) : null}
                  {item.body || item.message ? (
                    <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>
                      {item.body || item.message}
                    </Text>
                  ) : null}
                </View>
                <StatusBadge label={meta.label} tone={meta.tone} />
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  style={[styles.viewBtn, { backgroundColor: colors.infoSoft, borderColor: colors.secondary }]}
                  onPress={() => openItem(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`View asset ${assetName}`}
                >
                  <Text style={[TYPE.caption, { color: colors.secondary, fontWeight: '800' }]}>
                    View Asset
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => dismissItem(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss alert"
                  style={styles.dismissBtn}
                >
                  <Text style={[TYPE.micro, { color: colors.textMuted }]}>Dismiss</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeLabel: {
    letterSpacing: 0.6,
    fontWeight: '800',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  cardActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minHeight: HIT.min,
    justifyContent: 'center',
  },
  dismissBtn: {
    minHeight: HIT.min,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});

export default NotificationCenterScreen;

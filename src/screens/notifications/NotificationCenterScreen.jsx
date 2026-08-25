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
import { NOTIFICATION_STATUS } from '../../services/notifications/notificationTypes';
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

function priorityMeta(p) {
  if (p === 'CRITICAL') return { tone: 'error', label: 'Critical' };
  if (p === 'HIGH') return { tone: 'warning', label: 'Important' };
  if (p === 'MEDIUM') return { tone: 'info', label: 'Attention' };
  return { tone: 'neutral', label: 'Info' };
}

function itemTime(item) {
  const raw =
    item.dueAt ||
    item.scheduledFor ||
    item.createdAt ||
    item.updatedAt ||
    item.timestamp ||
    null;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : Date.now();
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
  if (today.length) sections.push({ title: 'Today', data: today });
  if (week.length) sections.push({ title: 'This Week', data: week });
  if (upcoming.length) sections.push({ title: 'Upcoming', data: upcoming });
  if (!sections.length && items.length) {
    sections.push({ title: 'Alerts', data: items });
  }
  return sections;
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

  const openItem = async (item) => {
    Haptics.tap();
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
        contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 16 }}
        renderSectionHeader={({ section }) => (
          <Text style={[TYPE.label, { color: colors.textMuted, marginTop: 16, marginBottom: 8 }]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const unread =
            item.status === NOTIFICATION_STATUS.UNREAD ||
            item.status === 'SCHEDULED' ||
            item.status === 'SENT' ||
            !item.status;
          const meta = priorityMeta(item.priority);
          return (
            <Pressable
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: unread ? colors.borderAccent || colors.border : colors.border,
                },
              ]}
              onPress={() => openItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`${meta.label}. ${item.title || 'Asset reminder'}`}
            >
              <View style={styles.cardTop}>
                <Text style={[TYPE.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={2}>
                  {item.title || 'Asset reminder'}
                </Text>
                <StatusBadge label={meta.label} tone={meta.tone} />
              </View>
              {item.body || item.message ? (
                <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 6 }]} numberOfLines={3}>
                  {item.body || item.message}
                </Text>
              ) : null}
              <View style={styles.cardActions}>
                <Text style={[TYPE.micro, { color: colors.primary, fontWeight: '700' }]}>
                  Open asset →
                </Text>
                <Pressable
                  onPress={() => dismissItem(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Mark as read"
                  style={{ minHeight: HIT.min, justifyContent: 'center' }}
                >
                  <Text style={[TYPE.micro, { color: colors.textMuted }]}>Dismiss</Text>
                </Pressable>
              </View>
            </Pressable>
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
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default NotificationCenterScreen;

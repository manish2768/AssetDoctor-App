/**
 * STEP 9 — Notification Center
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { NotificationEngine } from '../../services/notifications/NotificationEngine';
import { NOTIFICATION_STATUS } from '../../services/notifications/notificationTypes';
import { Haptics } from '../../services/haptics';
import { COLORS } from '../../theme/branding';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'due_soon', label: 'Due Soon' },
  { id: 'expired', label: 'Expired' },
];

function priorityMeta(p) {
  if (p === 'CRITICAL') return { color: '#DC2626', label: 'Critical' };
  if (p === 'HIGH') return { color: '#F97316', label: 'High' };
  if (p === 'MEDIUM') return { color: '#EAB308', label: 'Medium' };
  return { color: '#22C55E', label: 'Normal' };
}

export function NotificationCenterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
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

  const empty = useMemo(
    () => (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No notifications</Text>
        <Text style={styles.emptySub}>
          Expiry, service, and health alerts will appear here.
        </Text>
      </View>
    ),
    [],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.heading}>Notifications</Text>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              Haptics.tap();
              setTab(t.id);
            }}
            style={[styles.tab, tab === t.id && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.alertId || item.notificationId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}
        renderItem={({ item }) => {
          const unread =
            item.status === NOTIFICATION_STATUS.UNREAD ||
            item.status === 'SCHEDULED' ||
            item.status === 'SENT' ||
            !item.status;
          return (
            <Pressable
              style={styles.card}
              onPress={() => openItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`${priorityMeta(item.priority).label} priority. ${item.title || 'Asset reminder'}`}
            >
              <View style={styles.priorityCol}>
                <View
                  style={[styles.dot, { backgroundColor: priorityMeta(item.priority).color }]}
                />
                <Text
                  style={[styles.priorityText, { color: priorityMeta(item.priority).color }]}
                >
                  {priorityMeta(item.priority).label}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={2}>
                  {item.title || 'Asset reminder'}
                </Text>
                <Text style={styles.body} numberOfLines={2}>
                  {item.body}
                </Text>
                <Text style={styles.meta}>
                  {item.notificationType || item.category || 'Alert'}
                  {item.daysLeft != null ? ` · ${item.daysLeft}d` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => dismissItem(item)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
              >
                <Text style={styles.dismiss}>Dismiss</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg || '#F8FAFC' },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text || '#0F172A',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 8, gap: 6 },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  tabOn: { backgroundColor: COLORS.primary || '#0F766E' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  tabTextOn: { color: '#fff' },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    minHeight: 64,
  },
  priorityCol: { alignItems: 'center', width: 52, paddingTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  priorityText: { fontSize: 9, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' },
  title: { fontSize: 14, fontWeight: '600', color: '#334155' },
  titleUnread: { fontWeight: '800', color: '#0F172A' },
  body: { fontSize: 12, color: '#64748B', marginTop: 2 },
  meta: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  dismiss: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontWeight: '800', fontSize: 16, color: '#0F172A' },
  emptySub: { marginTop: 6, color: '#64748B', textAlign: 'center' },
});

export default NotificationCenterScreen;

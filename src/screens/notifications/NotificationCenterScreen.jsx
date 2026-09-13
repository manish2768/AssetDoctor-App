/**
 * Asset Doctor — Master Alert Center Screen
 *
 * Dedicated Actionable Alert Center:
 * - Segmented filters: All · Urgent · Upcoming · Overdue · Resolved
 * - Clear action deep links: View asset · Renew · Log service
 * - Derived strictly from real asset state
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { daysUntil } from '../../utils/dates';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';
import { AppHeader, FilterChip, EmptyState } from '../../components/design-system';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';

const ALERT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'resolved', label: 'Resolved' },
];

export function NotificationCenterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { assets, loading, refreshAssets } = useAssets();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Actionable alerts from real asset state
  const alertsList = useMemo(() => {
    const list = [];
    const assetList = assets || [];

    for (const a of assetList) {
      const assetId = a.assetId || a.id;
      const ins = daysUntil(a.insuranceExpiry);
      const puc = daysUntil(a.pucExpiry);
      const svc = daysUntil(a.nextServiceDue);
      const war = daysUntil(a.warrantyExpiry);

      if (ins != null) {
        if (ins < 0) {
          list.push({
            id: `${assetId}-ins-exp`,
            assetId,
            title: `${a.assetName || 'Vehicle'} · Insurance Expired`,
            subtitle: `${Math.abs(ins)} days overdue (${a.registration || 'Policy'})`,
            priority: 'urgent',
            category: 'overdue',
            actionLabel: 'Renew policy →',
            onPress: () => navigation.navigate('AssetPassport', { assetId }),
          });
        } else if (ins <= 30) {
          list.push({
            id: `${assetId}-ins-due`,
            assetId,
            title: `${a.assetName || 'Vehicle'} · Insurance Renewal`,
            subtitle: `Expires in ${ins} days`,
            priority: ins <= 7 ? 'urgent' : 'upcoming',
            category: ins <= 7 ? 'urgent' : 'upcoming',
            actionLabel: 'Review policy →',
            onPress: () => navigation.navigate('AssetPassport', { assetId }),
          });
        }
      }

      if (puc != null) {
        if (puc < 0) {
          list.push({
            id: `${assetId}-puc-exp`,
            assetId,
            title: `${a.assetName || 'Vehicle'} · PUC Expired`,
            subtitle: `${Math.abs(puc)} days overdue`,
            priority: 'urgent',
            category: 'overdue',
            actionLabel: 'Update PUC →',
            onPress: () => navigation.navigate('DocumentsVault', { assetId }),
          });
        } else if (puc <= 15) {
          list.push({
            id: `${assetId}-puc-due`,
            assetId,
            title: `${a.assetName || 'Vehicle'} · PUC Due`,
            subtitle: `Expires in ${puc} days`,
            priority: 'upcoming',
            category: 'upcoming',
            actionLabel: 'View details →',
            onPress: () => navigation.navigate('DocumentsVault', { assetId }),
          });
        }
      }

      if (svc != null) {
        if (svc < 0) {
          list.push({
            id: `${assetId}-svc-exp`,
            assetId,
            title: `${a.assetName || 'Asset'} · Service Overdue`,
            subtitle: `${Math.abs(svc)} days overdue for scheduled maintenance`,
            priority: 'urgent',
            category: 'overdue',
            actionLabel: 'Log service →',
            onPress: () => navigation.navigate('Maintenance', { assetId }),
          });
        } else if (svc <= 20) {
          list.push({
            id: `${assetId}-svc-due`,
            assetId,
            title: `${a.assetName || 'Asset'} · Service Due`,
            subtitle: `Maintenance due in ${svc} days`,
            priority: 'upcoming',
            category: 'upcoming',
            actionLabel: 'Schedule service →',
            onPress: () => navigation.navigate('Maintenance', { assetId }),
          });
        }
      }

      if (war != null && war > 0 && war <= 60) {
        list.push({
          id: `${assetId}-war-due`,
          assetId,
          title: `${a.assetName || 'Asset'} · Warranty Expiring`,
          subtitle: `Warranty coverage active for ${war} more days`,
          priority: 'upcoming',
          category: 'upcoming',
          actionLabel: 'View warranty →',
          onPress: () => navigation.navigate('AssetPassport', { assetId }),
        });
      }
    }

    return list;
  }, [assets, navigation]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alertsList;
    if (filter === 'urgent') return alertsList.filter((a) => a.priority === 'urgent');
    if (filter === 'upcoming') return alertsList.filter((a) => a.category === 'upcoming');
    if (filter === 'overdue') return alertsList.filter((a) => a.category === 'overdue');
    if (filter === 'resolved') return [];
    return alertsList;
  }, [alertsList, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.select();
    try {
      if (refreshAssets) await refreshAssets();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: Math.max(insets.top, 8) }}>
        <AppHeader
          title="Alert Center"
          subtitle={`${alertsList.length} actionable item${alertsList.length === 1 ? '' : 's'}`}
        />
      </View>

      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipScroll}
        >
          {ALERT_FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              selected={filter === f.id}
              onPress={() => {
                Haptics.select();
                setFilter(f.id);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredAlerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              Haptics.tap();
              item.onPress?.();
            }}
            style={[
              styles.alertCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              elevation(1, colors.shadow),
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: item.priority === 'urgent' ? '#EF4444' : '#F59E0B' },
              ]}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[TYPE.bodyStrong, { color: colors.text }]}>{item.title}</Text>
              <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {item.subtitle}
              </Text>
            </View>
            <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>
              {item.actionLabel}
            </Text>
          </Pressable>
        )}
        contentContainerStyle={{
          paddingHorizontal: SPACING.md,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24,
          gap: 10,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="bell"
              title="All clear"
              message={
                filter === 'resolved'
                  ? 'Resolved items are archived safely.'
                  : 'No pending alerts or expiring items at this moment.'
              }
              ctaLabel="Scan document"
              onCta={() => navigation.getParent()?.navigate?.('ScanBill')}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterSection: {
    marginBottom: SPACING.sm,
  },
  filterChipScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

/**
 * Asset Doctor — Master Alerts & Notification Center Screen
 * Clean, priority-driven alerts center with segmented filters and direct resolution actions.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { daysUntil } from '../../utils/dates';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';
import { EmptyState, SectionHeader } from '../../design-system';
import {
  AppHeader,
  FilterChip,
  AlertRow,
} from '../../components/design-system';
import { SPACING } from '../../theme/tokens';

const ALERT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'due_soon', label: 'Due Soon' },
  { id: 'expired', label: 'Expired' },
];

export function NotificationCenterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { assets, loading, refreshAssets } = useAssets();
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Derive actionable alerts from real asset state (zero fake alerts)
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
            title: `Insurance Expired: ${a.assetName}`,
            subtitle: a.registration ? `Vehicle Reg: ${a.registration}` : (a.insurerName || 'Policy coverage'),
            daysLeft: ins,
            priority: 'error',
            status: 'expired',
            actionLabel: 'Renew →',
          });
        } else if (ins <= 30) {
          list.push({
            id: `${assetId}-ins-due`,
            assetId,
            title: `Insurance Renewal: ${a.assetName}`,
            subtitle: `Expires in ${ins} days (${a.registration || a.insurerName || 'Active Policy'})`,
            daysLeft: ins,
            priority: ins <= 7 ? 'error' : 'warning',
            status: 'due_soon',
            actionLabel: 'Review →',
          });
        }
      }

      if (puc != null) {
        if (puc < 0) {
          list.push({
            id: `${assetId}-puc-exp`,
            assetId,
            title: `PUC Expired: ${a.assetName}`,
            subtitle: `Vehicle: ${a.registration || a.assetName}`,
            daysLeft: puc,
            priority: 'error',
            status: 'expired',
            actionLabel: 'Test Now →',
          });
        } else if (puc <= 15) {
          list.push({
            id: `${assetId}-puc-due`,
            assetId,
            title: `PUC Renewal Due: ${a.assetName}`,
            subtitle: `Expires in ${puc} days`,
            daysLeft: puc,
            priority: puc <= 5 ? 'error' : 'warning',
            status: 'due_soon',
            actionLabel: 'Renew →',
          });
        }
      }

      if (svc != null) {
        if (svc < 0) {
          list.push({
            id: `${assetId}-svc-exp`,
            assetId,
            title: `Service Overdue: ${a.assetName}`,
            subtitle: a.odometerKm ? `Last recorded: ${a.odometerKm.toLocaleString()} KM` : 'Periodic maintenance',
            daysLeft: svc,
            priority: 'error',
            status: 'expired',
            actionLabel: 'Book Now →',
          });
        } else if (svc <= 15) {
          list.push({
            id: `${assetId}-svc-due`,
            assetId,
            title: `Service Due: ${a.assetName}`,
            subtitle: `Scheduled within ${svc} days`,
            daysLeft: svc,
            priority: 'warning',
            status: 'due_soon',
            actionLabel: 'Schedule →',
          });
        }
      }

      if (war != null && war <= 30 && war >= 0) {
        list.push({
          id: `${assetId}-war-due`,
          assetId,
          title: `Warranty Ending: ${a.assetName}`,
          subtitle: `Expires in ${war} days`,
          daysLeft: war,
          priority: 'warning',
          status: 'due_soon',
          actionLabel: 'Extend →',
        });
      }
    }

    return list.sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
  }, [assets]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alertsList;
    return alertsList.filter((a) => a.status === filter);
  }, [alertsList, filter]);

  const groupedAlerts = useMemo(() => {
    const urgent = [];
    const upcoming = [];
    for (const item of filteredAlerts) {
      if (item.daysLeft != null && item.daysLeft <= 7) urgent.push(item);
      else upcoming.push(item);
    }
    return { urgent, upcoming };
  }, [filteredAlerts]);

  const alertSections = useMemo(() => {
    const sections = [];
    if (groupedAlerts.urgent.length) {
      sections.push({ title: 'Urgent', data: groupedAlerts.urgent });
    }
    if (groupedAlerts.upcoming.length) {
      sections.push({ title: 'Upcoming', data: groupedAlerts.upcoming });
    }
    return sections;
  }, [groupedAlerts]);

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
          title="Alerts"
          subtitle={
            alertsList.length === 0
              ? 'Nothing needs attention right now'
              : `${alertsList.length} ${alertsList.length === 1 ? 'alert' : 'alerts'} across your vault`
          }
        />
      </View>

      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {ALERT_FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              selected={filter === f.id}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </ScrollView>
      </View>

      <SectionList
        sections={alertSections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} style={{ marginHorizontal: SPACING.md }} />
        )}
        renderItem={({ item }) => (
          <AlertRow
            title={item.title}
            subtitle={item.subtitle}
            daysLeft={item.daysLeft}
            actionLabel={item.actionLabel}
            priority={item.priority}
            onAction={() =>
              navigation.navigate('AssetPassport', { assetId: item.assetId })
            }
            style={{ marginHorizontal: SPACING.md }}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
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
              title="You're all caught up"
              message="No insurance, warranty, PUC or service reminders need attention right now."
              icon="shield-check"
              style={{ marginHorizontal: SPACING.md }}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  filterSection: {
    marginBottom: SPACING.xs,
  },
  tabScroll: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  listContent: {
    paddingTop: SPACING.xs,
  },
});

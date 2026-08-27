/**
 * Asset Doctor — Master Assets List Screen
 * Clean, compact, data-rich list with search, category filtering and health scoring.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { Haptics } from '../../services/haptics';
import { requireAuth } from '../../navigation/authGate';
import { getAssetFolderType } from '../../utils/assetFolders';
import { calculateHealthScore } from '../../utils/healthScore';
import { daysUntil } from '../../utils/dates';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';
import {
  AppHeader,
  SearchBar,
  FilterChip,
  AssetRow,
  EmptyState,
  PrimaryButton,
} from '../../components/design-system';
import { RADIUS, SPACING, TYPE } from '../../theme/tokens';

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'vehicle', label: 'Vehicles' },
  { id: 'appliances', label: 'Appliances' },
  { id: 'gadgets', label: 'Gadgets' },
];

function assetSubtitle(asset) {
  const parts = [];
  if (asset.registration) parts.push(asset.registration);
  if (asset.model && asset.model !== asset.assetName) parts.push(asset.model);
  parts.push(asset.categoryLabel || asset.category || 'Protected');
  return parts.slice(0, 2).join(' · ');
}

function assetCoverageStatus(asset) {
  const ins = daysUntil(asset.insuranceExpiry);
  const puc = daysUntil(asset.pucExpiry);
  const svc = daysUntil(asset.nextServiceDue);
  const war = daysUntil(asset.warrantyExpiry);

  if (ins != null && ins < 0) return { label: 'Insurance expired', tone: 'error' };
  if (puc != null && puc < 0) return { label: 'PUC expired', tone: 'error' };
  if (svc != null && svc < 0) return { label: 'Service overdue', tone: 'error' };
  if (ins != null && ins <= 15) return { label: `Insurance ${ins}d`, tone: 'warning' };
  if (puc != null && puc <= 15) return { label: `PUC ${puc}d`, tone: 'warning' };
  if (svc != null && svc <= 15) return { label: `Service ${svc}d`, tone: 'warning' };
  if (war != null && war > 0) return { label: 'Warranty active', tone: 'success' };
  if (ins != null && ins > 15) return { label: 'Insurance active', tone: 'success' };
  return { label: 'Protected', tone: 'info' };
}

export function AssetListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const ui = useUiFeedback();
  const { assets, loading, removeAsset, refreshAssets } = useAssets();
  const { isAuthenticated } = useAuth();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredAssets = useMemo(() => {
    let list = assets || [];
    if (filter === 'vehicle' || filter === 'appliances' || filter === 'gadgets') {
      list = list.filter((a) => getAssetFolderType(a) === filter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => {
      const blob = `${a.assetName || ''} ${a.nickname || ''} ${a.categoryLabel || a.category || ''} ${
        a.registration || ''
      } ${a.serialNumber || ''} ${a.model || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [assets, query, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.select();
    try {
      if (refreshAssets) await refreshAssets();
    } finally {
      setRefreshing(false);
    }
  };

  const onAddAsset = () => {
    requireAuth({
      isAuthenticated,
      navigation,
      message: 'Sign in to add an asset.',
      onAuthed: () => navigation.navigate('AddAsset'),
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: Math.max(insets.top, 8) }}>
        <AppHeader
          title="Assets"
          subtitle={`${assets?.length || 0} ${assets?.length === 1 ? 'asset' : 'assets'} protected`}
          rightAction="+ Add"
          onRightAction={onAddAsset}
        />
      </View>

      <View style={styles.filterSection}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search assets, registration, serial number..."
          style={{ marginHorizontal: SPACING.md }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipScroll}
        >
          {CATEGORY_FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              selected={filter === f.id}
              onPress={() => setFilter(f.id)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredAssets}
        keyExtractor={(item) => item.assetId || item.id || String(Math.random())}
        renderItem={({ item }) => {
          const cov = assetCoverageStatus(item);
          return (
            <AssetRow
              item={item}
              title={item.assetName}
              subtitle={assetSubtitle(item)}
              registration={item.registration}
              statusText={cov.label}
              statusTone={cov.tone}
              healthScore={calculateHealthScore(item)}
              onPress={() =>
                navigation.navigate('AssetPassport', { assetId: item.assetId || item.id })
              }
              style={{ marginHorizontal: SPACING.md }}
            />
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 },
        ]}
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
              title={query ? 'No matching assets' : 'No assets in this category'}
              message={
                query
                  ? 'Try searching with a different name, registration or serial number.'
                  : 'Add your vehicle or home appliance to protect and track it.'
              }
              ctaLabel={query ? 'Clear Search' : '+ Add Asset'}
              onCta={query ? () => setQuery('') : onAddAsset}
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
  filterChipScroll: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  listContent: {
    paddingTop: SPACING.xs,
  },
});

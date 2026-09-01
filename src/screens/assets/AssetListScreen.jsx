/**
 * Asset Doctor — Master Assets List Screen.
 * Category isolation: route.params.category is the source of truth.
 * Search runs only after the category filter.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { requireAuth } from '../../navigation/authGate';
import { calculateHealthScore } from '../../utils/healthScore';
import { daysUntil } from '../../utils/dates';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';
import {
  AppHeader,
  SearchBar,
  FilterChip,
  AssetRow,
  EmptyState,
} from '../../components/design-system';
import { SPACING } from '../../theme/tokens';
import {
  CATEGORY_META,
  getCategoryMeta,
  resolveRouteCategory,
  searchAssetsInCategory,
} from '../../utils/categoryNormalization';
import { AssetDoctorProtectedBadge } from '../../components/trust/AssetDoctorProtectedBadge';
import { resolveProtectionBadgeState } from '../../trust/protectionStatus';

const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'vehicle', label: 'Vehicles' },
  { id: 'gadget', label: 'Gadgets' },
  { id: 'home', label: 'Home' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'business', label: 'Business' },
  { id: 'other', label: 'Other' },
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

export function AssetListScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { assets, loading, refreshAssets } = useAssets();
  const { isAuthenticated } = useAuth();

  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const routeCategory = resolveRouteCategory(route?.params);
  const selectedCategory = routeCategory.valid ? routeCategory.key : null;
  const meta = selectedCategory ? getCategoryMeta(selectedCategory) : CATEGORY_META.all;

  const filteredAssets = useMemo(() => {
    if (!routeCategory.valid) return [];
    return searchAssetsInCategory(assets || [], selectedCategory, query);
  }, [assets, query, routeCategory.valid, selectedCategory]);

  useEffect(() => {
    if (!__DEV__) return undefined;
    const total = assets?.length || 0;
    console.log('[CategoryIsolation] Selected category:', selectedCategory || `INVALID(${routeCategory.raw})`);
    console.log('[CategoryIsolation] Total assets:', total);
    console.log('[CategoryIsolation] Filtered assets:', filteredAssets.length);
    console.log('[CategoryIsolation] Excluded assets:', total - filteredAssets.length);
    return undefined;
  }, [assets, filteredAssets.length, routeCategory.raw, selectedCategory]);

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

  const setCategory = (id) => {
    Haptics.select();
    navigation.setParams({ category: id, folder: undefined });
  };

  const emptyState = query
    ? {
        title: 'No matching assets',
        message: 'Try searching with a different name, registration or serial number.',
        ctaLabel: 'Clear Search',
        onCta: () => setQuery(''),
      }
    : {
        title: routeCategory.valid ? meta.emptyTitle : 'No assets in this category',
        message: routeCategory.valid
          ? meta.emptyBody
          : 'This collection could not be resolved. Go back and choose Vehicles, Gadgets, Home, Equipment, Business or Other.',
        ctaLabel: routeCategory.valid ? meta.addLabel : '+ Add Asset',
        onCta: onAddAsset,
      };

  const countLabel = `${filteredAssets.length} ${filteredAssets.length === 1 ? 'asset' : 'assets'} protected`;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: Math.max(insets.top, 8) }}>
        <AppHeader
          title={routeCategory.valid ? meta.title : 'Assets'}
          subtitle={countLabel}
          rightAction="+ Add"
          onRightAction={onAddAsset}
        />
      </View>

      <View style={styles.filterSection}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={routeCategory.valid ? meta.searchPlaceholder : 'Search...'}
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
              selected={selectedCategory === f.id || (f.id === 'all' && selectedCategory === 'all')}
              onPress={() => setCategory(f.id)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredAssets}
        keyExtractor={(item) => item.assetId || item.id}
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
              protectionState={resolveProtectionBadgeState({ asset: item })}
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
              title={emptyState.title}
              message={emptyState.message}
              ctaLabel={emptyState.ctaLabel}
              onCta={emptyState.onCta}
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

export default AssetListScreen;

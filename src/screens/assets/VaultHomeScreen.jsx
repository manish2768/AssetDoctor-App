/**
 * Asset Doctor — Master Document Vault Screen
 * Clean, organized document management with segmented tabs and instant scan action.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { openScanInvoice } from '../../navigation/navActions';
import { formatDateIN, daysUntil } from '../../utils/dates';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';
import {
  AppHeader,
  FilterChip,
  SearchBar,
} from '../../components/design-system';
import { EmptyState } from '../../design-system';
import { DocumentVaultCard } from '../../components/trust/DocumentVaultCard';
import { SPACING } from '../../theme/tokens';
import { resolveAssetCategory } from '../../utils/categoryNormalization';
import { ShareService } from '../../services/share/ShareService';
import { useUiFeedback } from '../../context/UiFeedbackProvider';

const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'vehicle', label: 'Vehicles' },
  { id: 'gadget', label: 'Gadgets' },
  { id: 'home', label: 'Home & Appliances' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'business', label: 'Business' },
  { id: 'other', label: 'Other' },
];

const DOC_TYPE_TABS = [
  { id: 'all', label: 'All types' },
  { id: 'warranty', label: 'Warranty' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'service', label: 'Service' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'rc', label: 'RC' },
  { id: 'puc', label: 'PUC' },
];

export function VaultHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { assets, loading, refreshAssets } = useAssets();
  const ui = useUiFeedback();

  const [categoryTab, setCategoryTab] = useState('all');
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Extract all documents from all assets
  const allDocuments = useMemo(() => {
    const list = [];
    const assetList = assets || [];

    for (const a of assetList) {
      const assetId = a.assetId || a.id;
      const categoryKey = resolveAssetCategory(a) || 'other';

      // 1. Purchase / Invoice
      if (a.invoiceNumber || a.purchasePrice || a.invoiceDate || a.billStoragePath) {
        list.push({
          id: `${assetId}-invoice`,
          assetId,
          type: 'Purchase Invoice',
          categoryKey,
          docKind: 'purchase',
          assetName: a.assetName,
          identifier: a.registration || a.serialNumber || a.model,
          dateText: a.invoiceDate ? `Issued ${formatDateIN(a.invoiceDate)}` : 'On file',
        });
      }

      // 2. Insurance Policy
      if (a.insurancePolicyNumber || a.insuranceExpiry) {
        const insDays = daysUntil(a.insuranceExpiry);
        list.push({
          id: `${assetId}-insurance`,
          assetId,
          type: 'Insurance Policy',
          categoryKey,
          docKind: 'insurance',
          assetName: a.assetName,
          identifier: a.insurancePolicyNumber || a.registration,
          dateText: a.insuranceExpiry ? `Expires ${formatDateIN(a.insuranceExpiry)}` : 'On file',
          daysLeft: insDays,
        });
      }

      // 3. PUC Certificate
      if (a.pucExpiry) {
        const pucDays = daysUntil(a.pucExpiry);
        list.push({
          id: `${assetId}-puc`,
          assetId,
          type: 'PUC Certificate',
          categoryKey,
          docKind: 'puc',
          assetName: a.assetName,
          identifier: a.registration,
          dateText: `Expires ${formatDateIN(a.pucExpiry)}`,
          daysLeft: pucDays,
        });
      }

      // 4. Service Invoice
      if (a.lastServiceDate || a.odometerKm) {
        list.push({
          id: `${assetId}-service`,
          assetId,
          type: 'Service Invoice',
          categoryKey,
          docKind: 'service',
          assetName: a.assetName,
          identifier: a.odometerKm ? `${a.odometerKm.toLocaleString()} KM` : a.registration,
          dateText: a.lastServiceDate ? formatDateIN(a.lastServiceDate) : 'Service record on file',
        });
      }

      // 5. Warranty
      if (a.warrantyExpiry || a.warrantyMonths) {
        const warDays = daysUntil(a.warrantyExpiry);
        list.push({
          id: `${assetId}-warranty`,
          assetId,
          type: 'Warranty Card',
          categoryKey,
          docKind: 'warranty',
          assetName: a.assetName,
          identifier: a.serialNumber || a.imei,
          dateText: a.warrantyExpiry ? `Expires ${formatDateIN(a.warrantyExpiry)}` : 'Warranty on file',
          daysLeft: warDays,
        });
      }
    }

    return list;
  }, [assets]);

  const filteredDocs = useMemo(() => {
    let list = allDocuments;
    if (categoryTab !== 'all') {
      list = list.filter((d) => d.categoryKey === categoryTab);
    }
    if (activeTab !== 'all') {
      list = list.filter((d) => d.docKind === activeTab);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) => {
      const blob = `${d.type} ${d.assetName} ${d.identifier || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [allDocuments, categoryTab, activeTab, query]);

  const onScan = () => {
    Haptics.select();
    openScanInvoice(navigation);
  };

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
          title="Document Vault"
          subtitle="Everything protecting your assets"
          rightAction="Scan"
          onRightAction={onScan}
        />
      </View>

      <View style={styles.filterSection}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search documents..."
          style={{ marginHorizontal: SPACING.md }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {CATEGORY_TABS.map((t) => (
            <FilterChip
              key={t.id}
              label={t.label}
              selected={categoryTab === t.id}
              onPress={() => setCategoryTab(t.id)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {DOC_TYPE_TABS.map((t) => (
            <FilterChip
              key={t.id}
              label={t.label}
              selected={activeTab === t.id}
              onPress={() => setActiveTab(t.id)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredDocs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const parent = (assets || []).find((a) => (a.assetId || a.id) === item.assetId);
          return (
            <DocumentVaultCard
              item={item}
              asset={parent}
              onView={() => navigation.navigate('AssetPassport', { assetId: item.assetId })}
              onShare={async () => {
                const result = await ShareService.quickShareDocuments({
                  asset: parent,
                  documents: [item],
                });
                if (!result?.success) ui.info('Share', result?.error || 'Could not share this document.');
              }}
              onMoreAction={(id, doc, reason) => {
                if (id === 'unavailable') {
                  ui.info('Unavailable', reason || 'This action is not available yet.');
                  return;
                }
                if (id === 'share') {
                  ShareService.quickShareDocuments({ asset: parent, documents: [doc] });
                  return;
                }
                if (id === 'scan_another') {
                  onScan();
                  return;
                }
                if (id === 'delete' || id === 'download' || id === 'view') {
                  navigation.navigate('DocumentsVault', { assetId: item.assetId });
                  return;
                }
                ui.info('Unavailable', 'This action is not available in the current vault service.');
              }}
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
              title={query ? 'No matching documents' : 'Your vault is ready.'}
              message={
                query
                  ? 'Try a different asset name, policy number, or document type.'
                  : 'Scan a bill, insurance policy or warranty card and Asset Doctor will file it for you.'
              }
              ctaLabel="Scan a document"
              onCta={onScan}
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

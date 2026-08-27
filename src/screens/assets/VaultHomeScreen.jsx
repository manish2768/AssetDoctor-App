/**
 * Asset Doctor — Master Document Vault Screen
 * Clean, organized document management with segmented tabs and instant scan action.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { requireAuth } from '../../navigation/authGate';
import { openScanInvoice } from '../../navigation/navActions';
import { formatDateIN, daysUntil } from '../../utils/dates';
import { TAB_BAR_HEIGHT } from '../../components/CustomBottomTabBar';
import {
  AppHeader,
  PrimaryButton,
  FilterChip,
  SearchBar,
} from '../../components/design-system';
import { DocumentCard, EmptyState } from '../../design-system';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';

const DOC_TABS = [
  { id: 'all', label: 'All' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'appliances', label: 'Appliances' },
  { id: 'warranty', label: 'Warranty' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'service', label: 'Service' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'rc', label: 'RC' },
  { id: 'puc', label: 'PUC' },
];

function docAccent(kind, colors) {
  if (kind === 'insurance') return colors.docInsurance || colors.info;
  if (kind === 'warranty') return colors.docWarranty || colors.primary;
  if (kind === 'service') return colors.docService || colors.warning;
  if (kind === 'purchase') return colors.docPurchase || colors.aiIndigo;
  if (kind === 'rc') return colors.docRc || colors.violet;
  if (kind === 'puc') return colors.docPuc || colors.aiCyan;
  return colors.primary;
}

export function VaultHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { assets, loading, refreshAssets } = useAssets();
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Extract all documents from all assets
  const allDocuments = useMemo(() => {
    const list = [];
    const assetList = assets || [];

    for (const a of assetList) {
      const assetId = a.assetId || a.id;
      const isVehicle = !!a.registration || a.categoryId === 'car' || a.categoryId === 'bike' || a.categoryId === 'scooter';

      // 1. Purchase / Invoice
      if (a.invoiceNumber || a.purchasePrice || a.invoiceDate || a.billStoragePath) {
        list.push({
          id: `${assetId}-invoice`,
          assetId,
          type: isVehicle ? 'Vehicle Purchase Invoice' : 'Purchase Invoice',
          category: isVehicle ? 'vehicles' : 'appliances',
          docKind: 'purchase',
          assetName: a.assetName,
          identifier: a.registration || a.serialNumber || a.model,
          dateText: a.invoiceDate ? `Issued ${formatDateIN(a.invoiceDate)}` : 'Verified bill',
          verified: true,
        });
      }

      // 2. Insurance Policy
      if (a.insurancePolicyNumber || a.insuranceExpiry) {
        const insDays = daysUntil(a.insuranceExpiry);
        list.push({
          id: `${assetId}-insurance`,
          assetId,
          type: 'Insurance Policy',
          category: 'insurance',
          docKind: 'insurance',
          assetName: a.assetName,
          identifier: a.insurancePolicyNumber || a.registration,
          dateText: a.insuranceExpiry ? `Valid until ${formatDateIN(a.insuranceExpiry)}` : 'Active Policy',
          verified: true,
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
          category: 'vehicles',
          docKind: 'puc',
          assetName: a.assetName,
          identifier: a.registration,
          dateText: `Valid until ${formatDateIN(a.pucExpiry)}`,
          verified: true,
          daysLeft: pucDays,
        });
      }

      // 4. Service Invoice
      if (a.lastServiceDate || a.odometerKm) {
        list.push({
          id: `${assetId}-service`,
          assetId,
          type: 'Service Invoice',
          category: 'service',
          docKind: 'service',
          assetName: a.assetName,
          identifier: a.odometerKm ? `${a.odometerKm.toLocaleString()} KM` : a.registration,
          dateText: a.lastServiceDate ? formatDateIN(a.lastServiceDate) : 'Service maintenance',
          verified: true,
        });
      }

      // 5. Warranty
      if (a.warrantyExpiry || a.warrantyMonths) {
        const warDays = daysUntil(a.warrantyExpiry);
        list.push({
          id: `${assetId}-warranty`,
          assetId,
          type: 'Warranty Card',
          category: 'warranty',
          docKind: 'warranty',
          assetName: a.assetName,
          identifier: a.serialNumber || a.imei,
          dateText: a.warrantyExpiry ? `Valid until ${formatDateIN(a.warrantyExpiry)}` : 'Warranty active',
          verified: true,
          daysLeft: warDays,
        });
      }
    }

    return list;
  }, [assets]);

  // Tab & Search Filtering
  const filteredDocs = useMemo(() => {
    let list = allDocuments;
    if (activeTab !== 'all') {
      list = list.filter((d) => d.category === activeTab || d.docKind === activeTab);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) => {
      const blob = `${d.type} ${d.assetName} ${d.identifier || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [allDocuments, activeTab, query]);

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
          {DOC_TABS.map((t) => (
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
        renderItem={({ item }) => (
          <DocumentCard
            documentType={item.type}
            assetName={item.assetName}
            dateText={item.dateText}
            verified={item.verified === true}
            needsReview={item.daysLeft != null && item.daysLeft < 0}
            accent={docAccent(item.docKind, colors)}
            onPress={() =>
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

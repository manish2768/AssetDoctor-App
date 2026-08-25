/**
 * Assets tab — searchable list with smart cards + filter chips
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ScrollView,
} from 'react-native';

import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { Screen } from '../../components/ui/Glass';
import { EmptyState, FilterChip } from '../../components/ui/DesignSystem';
import { SmartAssetListCard } from '../../components/ui/SmartAssetListCard';
import { COLORS, SPACING } from '../../theme/branding';
import { TYPE } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';
import { requireAuth } from '../../navigation/authGate';
import { getAssetFolderType } from '../../utils/assetFolders';
import { useTabSafeBottomPadding } from '../../utils/tabSafePadding';
import { needsAttention, hasExpiredDocuments } from '../../utils/assetExpiry';
import { useThemeColors } from '../../context/ThemeProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'appliances', label: 'Appliance' },
  { id: 'gadgets', label: 'Gadget' },
  { id: 'attention', label: 'Needs Attention' },
  { id: 'expired', label: 'Expired' },
];

export function AssetListScreen({ navigation }) {
  const colors = useThemeColors();
  const ui = useUiFeedback();
  const { assets, loading, removeAsset } = useAssets();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const bottomPad = useTabSafeBottomPadding();

  const filtered = useMemo(() => {
    let list = assets || [];
    if (filter === 'vehicle' || filter === 'appliances' || filter === 'gadgets') {
      list = list.filter((a) => getAssetFolderType(a) === filter);
    } else if (filter === 'attention') {
      list = list.filter((a) => needsAttention(a, 15));
    } else if (filter === 'expired') {
      list = list.filter((a) => hasExpiredDocuments(a));
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => {
      const blob = `${a.assetName || ''} ${a.nickname || ''} ${a.categoryLabel || a.category || ''} ${a.registration || ''} ${a.locationPath || ''} ${a.publicAssetId || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [assets, query, filter]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.select();
    setTimeout(() => setRefreshing(false), 600);
  };

  const onDelete = async (item) => {
    const ok = await ui.confirm({
      title: 'Delete asset?',
      message: `${item.assetName} will be removed from your vault.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const id = item.assetId || item.id;
    const result = await removeAsset(id, item.billStoragePath);
    if (!result?.success) {
      ui.error('Delete failed', result?.error || 'Try again');
    }
  };

  return (
    <Screen style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.h2 || styles.title, { color: colors.text, fontSize: 22, fontWeight: '800' }]}>
              Assets
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              {assets.length} in your vault
            </Text>
          </View>
          <Pressable
            style={[styles.addChip, { backgroundColor: colors.primary }]}
            onPress={() =>
              requireAuth({
                isAuthenticated,
                navigation,
                message: 'Sign in to add and save assets in your vault.',
                onAuthed: () => navigation.navigate('AddAsset'),
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Add asset"
          >
            <Text style={[styles.addChipText, { color: colors.textOnPrimary }]}>+ Add</Text>
          </Pressable>
          <Pressable
            style={[styles.iconChip, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('GlobalSearch')}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Text>🔎</Text>
          </Pressable>
          <Pressable
            style={[styles.iconChip, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('ScanAssetQr')}
            accessibilityRole="button"
            accessibilityLabel="Scan asset QR"
          >
            <Text>⬚</Text>
          </Pressable>
        </View>
        <TextInput
          style={[
            styles.search,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, location, registration…"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Filter assets"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {FILTERS.map((f) => (
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
        data={filtered}
        keyExtractor={(item) => item.id || item.assetId}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: bottomPad }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🏠"
            title={loading ? 'Loading assets…' : query || filter !== 'all' ? 'No matches' : 'Your assets deserve a home.'}
            message={
              query || filter !== 'all'
                ? 'Try a different search or filter.'
                : 'Add a vehicle, phone, appliance, or equipment to start tracking health and documents.'
            }
            ctaLabel={!query && filter === 'all' && !loading ? 'Add Your First Asset' : undefined}
            onCta={
              !query && filter === 'all' && !loading
                ? () => navigation.navigate('AddAsset')
                : undefined
            }
          />
        }
        renderItem={({ item }) => (
          <SmartAssetListCard
            asset={item}
            onPress={() =>
              navigation.navigate('AssetPassport', { assetId: item.assetId || item.id })
            }
            onLongPress={() => onDelete(item)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 2 },
  addChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 40,
    justifyContent: 'center',
  },
  addChipText: { fontWeight: '800', fontSize: 13 },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  search: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});

export default AssetListScreen;

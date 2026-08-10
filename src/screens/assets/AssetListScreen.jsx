/**
 * Assets tab — searchable list with empty state + delete
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';

import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { Screen, GlassCard, GlassButton } from '../../components/ui/Glass';
import { COLORS, SPACING } from '../../theme/branding';
import { formatINR } from '../../utils/format';
import { calculateHealthScore } from '../../utils/healthScore';
import { Haptics } from '../../services/haptics';
import { requireAuth } from '../../navigation/authGate';
import { ShareService } from '../../services/share/ShareService';
import { CategoryIcon } from '../../components/icons/CategoryIcon';
import { VehicleCard } from '../../components/vehicle/VehicleCard';
import { getAssetFolderType } from '../../utils/assetFolders';
import { useTabSafeBottomPadding } from '../../utils/tabSafePadding';

export function AssetListScreen({ navigation }) {
  const { assets, loading, removeAsset } = useAssets();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const bottomPad = useTabSafeBottomPadding();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const blob = `${a.assetName || ''} ${a.categoryLabel || a.category || ''} ${a.registration || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [assets, query]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.select();
    setTimeout(() => setRefreshing(false), 600);
  };

  const onDelete = (item) => {
    Alert.alert('Delete asset?', `${item.assetName} will be removed from your vault.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const id = item.assetId || item.id;
          const result = await removeAsset(id, item.billStoragePath);
          if (!result?.success) {
            Alert.alert('Delete failed', result?.error || 'Try again');
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Assets</Text>
            <Text style={styles.sub}>{assets.length} in your vault</Text>
          </View>
          <Pressable
            style={styles.addChip}
            onPress={() =>
              requireAuth({
                isAuthenticated,
                navigation,
                message: 'Sign in to add and save assets in your vault.',
                onAuthed: () => navigation.navigate('AddAsset'),
              })
            }
          >
            <Text style={styles.addChipText}>+ Add</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, category, registration…"
          placeholderTextColor="#6B7280"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id || item.assetId}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: bottomPad }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.emerald} />
        }
        ListEmptyComponent={
          <GlassCard glow>
            <Text style={styles.emptyTitle}>
              {loading ? 'Loading assets…' : query ? 'No matches' : 'No assets yet'}
            </Text>
            <Text style={styles.sub}>
              {query
                ? 'Try a different search.'
                : 'Add vehicles, electronics, or appliances to track warranty, insurance & value.'}
            </Text>
            {!query && !loading ? (
              <GlassButton
                title="Add your first asset"
                style={{ marginTop: 14 }}
                onPress={() => navigation.navigate('AddAsset')}
              />
            ) : null}
          </GlassCard>
        }
        renderItem={({ item }) => {
          const health = calculateHealthScore(item);
          if (getAssetFolderType(item) === 'vehicle') {
            return (
              <VehicleCard
                asset={item}
                onPress={() =>
                  navigation.navigate('AssetPassport', { assetId: item.assetId || item.id })
                }
              />
            );
          }
          return (
            <Pressable
              onPress={() => {
                Haptics.tap();
                navigation.navigate('AssetPassport', { assetId: item.assetId || item.id });
              }}
              onLongPress={() => onDelete(item)}
            >
              <GlassCard style={{ marginBottom: 10 }}>
                <View style={styles.row}>
                  <CategoryIcon
                    name={item.categoryId || item.icon || 'other'}
                    size={36}
                    color={COLORS.emerald}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {item.assetName}
                      {item.isDemo ? ' · Demo' : ''}
                    </Text>
                    <Text style={styles.sub}>
                      {item.registration || item.categoryLabel || item.category} · Health{' '}
                      {health.score}
                    </Text>
                    <Text style={styles.valueText}>{formatINR(item.value)}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    style={styles.waBtn}
                    onPress={async () => {
                      Haptics.tap();
                      await ShareService.sharePassportCard({
                        asset: item,
                        prefer: 'whatsapp',
                      });
                    }}
                  >
                    <Text style={styles.waText}>💬 WhatsApp</Text>
                  </Pressable>
                  <Pressable
                    style={styles.editBtn}
                    onPress={() => {
                      Haptics.tap();
                      requireAuth({
                        isAuthenticated,
                        navigation,
                        message: 'Sign in to edit assets.',
                        onAuthed: () =>
                          navigation.navigate('AddAsset', {
                            assetId: item.assetId || item.id,
                          }),
                      });
                    }}
                  >
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={() => onDelete(item)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
      />

      <View style={styles.fabWrap}>
        <GlassButton
          title="+ Add Asset"
          onPress={() =>
            requireAuth({
              isAuthenticated,
              navigation,
              message: 'Sign in to add and save assets in your vault.',
              onAuthed: () => navigation.navigate('AddAsset'),
            })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: SPACING.lg, paddingTop: 48, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  sub: { color: COLORS.muted, marginTop: 4, fontSize: 12 },
  addChip: {
    backgroundColor: COLORS.neonBlue,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  addChipText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  search: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 28 },
  name: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  valueText: { color: COLORS.emerald, fontWeight: '800', fontSize: 13, marginTop: 4 },
  emptyTitle: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  waBtn: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#128C7E',
    minWidth: '30%',
  },
  waText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  editBtn: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    minWidth: '28%',
  },
  editText: { color: COLORS.text, fontWeight: '700', fontSize: 12 },
  deleteBtn: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.4)',
    backgroundColor: 'rgba(244,63,94,0.12)',
    minWidth: '28%',
  },
  deleteText: { color: COLORS.rose, fontWeight: '700', fontSize: 12 },
  fabWrap: { paddingHorizontal: SPACING.lg, paddingBottom: 8 },
});

export default AssetListScreen;

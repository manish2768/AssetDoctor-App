/**
 * Category Folders — four-bucket vault explorer (PolicyBazaar-style vehicle list).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssets } from '../../context/AssetProvider';
import { Screen, GlassCard } from '../../components/ui/Glass';
import { COLORS, SPACING, RADIUS } from '../../theme/branding';
import {
  FOLDER_META,
  countAssetsByFolder,
  filterAssetsByFolder,
} from '../../utils/assetFolders';
import { Haptics } from '../../services/haptics';
import { CategoryIcon } from '../../components/icons/CategoryIcon';
import { VehicleCard } from '../../components/vehicle/VehicleCard';
import { ItemDetailCard } from '../../components/ItemDetailCard';
import { useTabSafeBottomPadding } from '../../utils/tabSafePadding';

export function CategoryFoldersScreen({ navigation, route }) {
  const { assets } = useAssets();
  const counts = useMemo(() => countAssetsByFolder(assets), [assets]);
  const [openFolder, setOpenFolder] = useState(route?.params?.focusFolder || null);
  const insets = useSafeAreaInsets();
  const bottomPad = useTabSafeBottomPadding();

  useEffect(() => {
    if (route?.params?.focusFolder) {
      setOpenFolder(route.params.focusFolder);
    }
  }, [route?.params?.focusFolder]);

  const folderMeta = openFolder ? FOLDER_META[openFolder] : null;
  const folderAssets = useMemo(
    () => (openFolder ? filterAssetsByFolder(assets, openFolder) : []),
    [assets, openFolder],
  );
  const foundText = folderMeta
    ? `${folderAssets.length} ${folderMeta.foundLabel || 'items found'}`
    : '';

  const openPassport = (item) => {
    setOpenFolder(null);
    Haptics.tap();
    navigation?.getParent()?.navigate?.('Assets', {
      screen: 'AssetPassport',
      params: { assetId: item.assetId || item.id },
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Category Folders</Text>
            <Text style={styles.sub}>Organized vaults for invoices & documents</Text>
          </View>
        </View>

        {Object.values(FOLDER_META).map((folder) => (
          <Pressable
            key={folder.id}
            onPress={() => {
              Haptics.tap();
              setOpenFolder(folder.id);
            }}
          >
            <GlassCard
              style={[styles.folderCard, { borderLeftColor: folder.accent, borderLeftWidth: 4 }]}
            >
              <View style={styles.folderRow}>
                <CategoryIcon name={folder.iconKey || folder.id} size={34} color={folder.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.folderTitle}>{folder.title}</Text>
                  <Text style={styles.sub}>{folder.subtitle}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {counts[folder.id] || 0} {folder.countLabel}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        visible={Boolean(openFolder)}
        animationType="fade"
        transparent
        onRequestClose={() => setOpenFolder(null)}
      >
        <View style={[styles.modalBackdrop, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <View style={styles.modalTitleRow}>
                  {folderMeta ? (
                    <CategoryIcon
                      name={folderMeta.iconKey || folderMeta.id}
                      size={28}
                      color={folderMeta.accent}
                    />
                  ) : null}
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {folderMeta?.title || 'Vault'}
                  </Text>
                </View>
                <Text style={styles.modalFound} numberOfLines={1}>
                  {foundText}
                </Text>
              </View>
              <Pressable
                onPress={() => setOpenFolder(null)}
                hitSlop={12}
                style={styles.closeBtn}
              >
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <FlatList
              data={folderAssets}
              keyExtractor={(item) => item.id || item.assetId}
              contentContainerStyle={{ paddingBottom: 12 }}
              ListEmptyComponent={
                <Text style={[styles.sub, { textAlign: 'center', paddingVertical: 28 }]}>
                  Folder is empty.
                </Text>
              }
              renderItem={({ item }) =>
                openFolder === 'vehicle' ? (
                  <VehicleCard asset={item} onPress={() => openPassport(item)} />
                ) : (
                  <Pressable style={styles.fileRow} onPress={() => openPassport(item)}>
                    <ItemDetailCard
                      title={item.assetName}
                      subtitle={item.storeName || item.categoryLabel}
                      amount={item.value}
                      registration={item.registration}
                      warrantyExpiry={item.warrantyExpiry}
                      pucExpiry={item.pucExpiry}
                      insuranceExpiry={item.insuranceExpiry}
                      nextServiceDue={item.nextServiceDue}
                      onPress={() => openPassport(item)}
                    />
                  </Pressable>
                )
              }
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  sub: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  folderCard: { marginBottom: 12 },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  folderTitle: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 88,
  },
  badgeText: { color: COLORS.muted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  modalHeaderText: { flex: 1, minWidth: 0, paddingRight: 4 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 16,
    flex: 1,
    lineHeight: 22,
  },
  modalFound: {
    color: COLORS.emerald,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    marginLeft: 38,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  close: { color: COLORS.muted, fontSize: 16, fontWeight: '700' },
  fileRow: { marginBottom: 4 },
});

export default CategoryFoldersScreen;

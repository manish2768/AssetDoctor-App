/**
 * Document Vault — four primary household and vehicle buckets.
 */

import React, { useMemo } from 'react';
import { ScrollView, Text, Pressable, StyleSheet, View } from 'react-native';

import { useAssets } from '../../context/AssetProvider';
import { useAuth } from '../../context/AuthProvider';
import { Screen, GlassCard, GlassButton } from '../../components/ui/Glass';
import { COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { requireAuth, openLogin } from '../../navigation/authGate';
import {
  FOLDER_META,
  countAssetsByFolder,
  filterAssetsByFolder,
} from '../../utils/assetFolders';
import { ItemDetailCard } from '../../components/ItemDetailCard';
import { VehicleCard } from '../../components/vehicle/VehicleCard';
import { VaultSleeveCard } from '../../components/VaultSleeveCard';
import { ShareService } from '../../services/share/ShareService';
import { DocumentVaultService } from '../../services/documents/DocumentVaultService';
import { useTabSafeBottomPadding } from '../../utils/tabSafePadding';

export function VaultHomeScreen({ navigation }) {
  const { assets, loading } = useAssets();
  const { isAuthenticated, user } = useAuth();
  const counts = useMemo(() => countAssetsByFolder(assets), [assets]);
  const bottomPad = useTabSafeBottomPadding();

  const openFolder = (folderId) => {
    Haptics.tap();
    navigation.navigate('CategoryFolders', { focusFolder: folderId });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <Text style={styles.title}>Document Vault</Text>
        <Text style={styles.sub}>
          Vehicles, appliances, digital bills and legal records — protected in one place
        </Text>

        {!isAuthenticated ? (
          <Pressable style={styles.syncBanner} onPress={() => openLogin(navigation)}>
            <Text style={styles.syncTitle}>☁️ Sync & Backup</Text>
            <Text style={styles.syncBody}>
              Sign in to keep vault docs safe in the cloud across devices.
            </Text>
          </Pressable>
        ) : null}

        {Object.values(FOLDER_META).map((folder) => (
          <VaultSleeveCard
            key={folder.id}
            title={folder.title}
            subtitle={folder.subtitle}
            accent={folder.accent}
            iconKey={folder.iconKey || folder.id}
            count={counts[folder.id] || 0}
            countLabel={folder.countLabel}
            onPress={() => openFolder(folder.id)}
          >
            {filterAssetsByFolder(assets, folder.id)
              .slice(0, 2)
              .map((a) => (
                <View key={a.id || a.assetId} style={{ marginTop: 8 }}>
                  {folder.id === 'vehicle' ? (
                    <VehicleCard
                      asset={a}
                      showAccordion={false}
                      onPress={() => {
                        navigation.navigate('DocumentsVault', {
                          assetId: a.assetId || a.id,
                        });
                      }}
                    />
                  ) : (
                    <ItemDetailCard
                      title={a.assetName}
                      subtitle={a.storeName || a.categoryLabel}
                      amount={a.value}
                      registration={a.registration}
                      warrantyExpiry={a.warrantyExpiry}
                      pucExpiry={a.pucExpiry}
                      insuranceExpiry={a.insuranceExpiry}
                      nextServiceDue={a.nextServiceDue}
                      onPress={() => {
                        Haptics.tap();
                        navigation.navigate('DocumentsVault', {
                          assetId: a.assetId || a.id,
                        });
                      }}
                    />
                  )}
                  <Pressable
                    style={styles.wa}
                    onPress={async () => {
                      Haptics.tap();
                      if (ShareService.isEmergencyShareEligible(a) && user?.uid) {
                        const docs = await DocumentVaultService.listDocuments(
                          user.uid,
                          a.assetId || a.id,
                        );
                        await ShareService.shareEmergencyBundle({
                          asset: a,
                          documents: docs,
                        });
                        return;
                      }
                      await ShareService.sharePassportCard({
                        asset: a,
                        prefer: 'whatsapp',
                      });
                    }}
                  >
                    <Text style={styles.waText}>
                      {ShareService.isEmergencyShareEligible(a) ? 'SOS PDF' : 'Share'}
                    </Text>
                  </Pressable>
                </View>
              ))}
          </VaultSleeveCard>
        ))}

        {loading ? <Text style={styles.sub}>Loading…</Text> : null}

        {!loading && assets.length === 0 ? (
          <GlassCard style={{ marginTop: 8 }}>
            <Text style={styles.sub}>Add an asset, then store RC / PUC / invoices here.</Text>
            <GlassButton
              title={isAuthenticated ? '+ Add Asset' : 'Sign in to save docs'}
              style={{ marginTop: 12 }}
              onPress={() =>
                requireAuth({
                  isAuthenticated,
                  navigation,
                  message: 'Sign in to save documents to your vault.',
                  onAuthed: () =>
                    navigation.getParent()?.navigate?.('Assets', { screen: 'AddAsset' }),
                })
              }
            />
          </GlassCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '900' },
  sub: { color: COLORS.muted, marginTop: 4, fontSize: 12 },
  syncBanner: {
    marginTop: 14,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  syncTitle: { color: COLORS.text, fontWeight: '900', fontSize: 14 },
  syncBody: { color: COLORS.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  wa: {
    backgroundColor: '#128C7E',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  waText: { color: '#fff', fontWeight: '800', fontSize: 11 },
});

export default VaultHomeScreen;

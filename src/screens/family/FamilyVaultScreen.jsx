/**
 * Asset Doctor — Family Vault Hub Screen
 * 
 * Central hub for family collaboration:
 * - Visual Family Health Hero
 * - Shared Assets list with permission tags
 * - Quick Actions: Log Fuel (with explicit multi-vehicle selector), Share Asset, Invite Member
 * - Recent Collaborator Activity Feed
 */

import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFamilyVault } from '../../context/FamilyVaultContext';
import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { FamilyHealthHero } from '../../components/family/FamilyHealthHero';
import { FamilyActivityFeed } from '../../components/family/FamilyActivityFeed';
import { InviteMemberModal } from './InviteMemberModal';
import { VehicleSelectorModal } from '../../components/family/VehicleSelectorModal';
import { ShareAssetModal } from '../../components/family/ShareAssetModal';
import { COLORS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';

export function FamilyVaultScreen({ navigation }) {
  const {
    hasFamilyVault,
    vaultData,
    members,
    sharedAssets,
    activities,
    loading,
    isOwner,
    isAdmin,
    createVault,
  } = useFamilyVault();

  const { assets } = useAssets();
  const { isAuthenticated } = useAuth();

  const [newVaultName, setNewVaultName] = useState('');
  const [creatingVault, setCreatingVault] = useState(false);

  // Modals
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [vehicleSelectorVisible, setVehicleSelectorVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedAssetToShare, setSelectedAssetToShare] = useState(null);

  // Attention items across shared assets
  const attentionItems = useMemo(() => {
    const items = [];
    (sharedAssets || []).forEach((sa) => {
      if (sa.attentionItems && sa.attentionItems.length) {
        sa.attentionItems.forEach((ai) => {
          items.push(`${sa.assetName}: ${ai}`);
        });
      }
    });
    return items;
  }, [sharedAssets]);

  const handleCreateVault = async () => {
    if (!newVaultName.trim()) {
      Alert.alert('Vault Name Required', 'Please enter a name for your Family Vault.');
      return;
    }

    Haptics.tap();
    setCreatingVault(true);
    try {
      await createVault(newVaultName.trim());
      Haptics.success();
      setNewVaultName('');
    } catch (err) {
      Haptics.error();
      Alert.alert('Error', err?.message || 'Failed to create vault');
    } finally {
      setCreatingVault(false);
    }
  };

  const handleSelectVehicleForFuel = (vehicle) => {
    navigation?.navigate?.('FuelVaultScreen', {
      preselectedAssetId: vehicle.canonicalAssetId || vehicle.assetId,
      vehicle,
    });
  };

  const handleOpenShareModal = (asset) => {
    setSelectedAssetToShare(asset);
    setShareModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text style={styles.loadingText}>Opening Family Vault...</Text>
      </View>
    );
  }

  // 1. Unonboarded / No Family Vault View
  if (!hasFamilyVault) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation?.goBack?.()}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Family Vault</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={styles.heroCircle}>
            <Text style={styles.heroIcon}>👨‍👩‍👧‍👦</Text>
          </View>

          <Text style={styles.emptyHeading}>Protect Your Assets Together</Text>
          <Text style={styles.emptyDesc}>
            Manage vehicles, home appliances, documents, insurance, and fuel logs with your family in one shared vault.
          </Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>🛡️</Text>
              <Text style={styles.featureText}>Personal Vault stays private & secure</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>⛽</Text>
              <Text style={styles.featureText}>Collaborative multi-vehicle fuel tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>📄</Text>
              <Text style={styles.featureText}>Shared insurance, PUC & service records</Text>
            </View>
          </View>

          <View style={styles.createCard}>
            <Text style={styles.cardLabel}>CREATE NEW FAMILY VAULT</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Rai Family Vault"
              placeholderTextColor="#64748B"
              value={newVaultName}
              onChangeText={setNewVaultName}
            />
            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleCreateVault}
              disabled={creatingVault}
              activeOpacity={0.8}
            >
              {creatingVault ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.createBtnText}>+ Create Family Vault</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // 2. Active Family Vault View
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>{vaultData?.name || 'Family Vault'}</Text>
          <Text style={styles.subtitle}>{members.length} Members • {sharedAssets.length} Assets</Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.inviteTopBtn}
            onPress={() => setInviteModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.inviteTopBtnText}>+ Invite</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Family Health Hero */}
        <FamilyHealthHero
          vaultName={vaultData?.name || 'Family Vault'}
          memberCount={members.length}
          assetCount={sharedAssets.length}
          documentCount={vaultData?.documentCount || (sharedAssets.length * 3)}
          attentionItems={attentionItems}
          sharedAssets={sharedAssets}
        />

        {/* Quick Action Pills */}
        <View style={styles.actionPillsRow}>
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => setVehicleSelectorVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionPillIcon}>⛽</Text>
            <Text style={styles.actionPillText}>Add Fuel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => {
              if (assets && assets.length > 0) {
                handleOpenShareModal(assets[0]);
              } else {
                Alert.alert('No Assets', 'Add an asset to your personal vault first.');
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.actionPillIcon}>🔗</Text>
            <Text style={styles.actionPillText}>Share Asset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => navigation?.navigate?.('FamilyMembersScreen')}
            activeOpacity={0.7}
          >
            <Text style={styles.actionPillIcon}>👥</Text>
            <Text style={styles.actionPillText}>Members</Text>
          </TouchableOpacity>
        </View>

        {/* Shared Assets Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SHARED ASSETS ({sharedAssets.length})</Text>
          <TouchableOpacity
            onPress={() => {
              if (assets && assets.length > 0) handleOpenShareModal(assets[0]);
            }}
          >
            <Text style={styles.sectionAction}>+ Share More</Text>
          </TouchableOpacity>
        </View>

        {sharedAssets.length === 0 ? (
          <View style={styles.emptySharedAssetsCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No assets shared with this vault yet</Text>
            <Text style={styles.emptySubtext}>Share vehicles or home appliances with family members</Text>
          </View>
        ) : (
          <View style={styles.assetsList}>
            {sharedAssets.map((asset) => {
              const reg = asset.registration ? ` (${asset.registration})` : '';
              return (
                <TouchableOpacity
                  key={asset.id || asset.sharedAssetId}
                  style={styles.assetCard}
                  onPress={() => {
                    navigation?.navigate?.('AssetPassport', {
                      asset: {
                        ...asset,
                        assetId: asset.canonicalAssetId || asset.assetId,
                      },
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.assetIconCircle}>
                    <Text style={styles.assetEmoji}>{asset.icon || '📦'}</Text>
                  </View>

                  <View style={styles.assetMeta}>
                    <Text style={styles.assetName} numberOfLines={1}>
                      {asset.assetName || 'Asset'}{reg}
                    </Text>
                    <Text style={styles.assetCategory}>{asset.category}</Text>
                  </View>

                  <View style={styles.assetHealthBadge}>
                    <Text style={styles.assetHealthScore}>{asset.healthScore || 90}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Recent Family Activity Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
        </View>
        <FamilyActivityFeed activities={activities} />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
      <InviteMemberModal
        visible={inviteModalVisible}
        onClose={() => setInviteModalVisible(false)}
      />

      <VehicleSelectorModal
        visible={vehicleSelectorVisible}
        onClose={() => setVehicleSelectorVisible(false)}
        onSelectVehicle={handleSelectVehicleForFuel}
      />

      {selectedAssetToShare ? (
        <ShareAssetModal
          visible={shareModalVisible}
          asset={selectedAssetToShare}
          onClose={() => setShareModalVisible(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 20,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  inviteTopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#14B8A6',
  },
  inviteTopBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  scroll: {
    flex: 1,
    paddingTop: 16,
  },
  actionPillsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionPillIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#14B8A6',
  },
  assetsList: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  assetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  assetEmoji: {
    fontSize: 22,
  },
  assetMeta: {
    flex: 1,
  },
  assetName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  assetCategory: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  assetHealthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
  },
  assetHealthScore: {
    fontSize: 13,
    fontWeight: '800',
    color: '#14B8A6',
  },
  emptySharedAssetsCard: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  heroCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  heroIcon: {
    fontSize: 46,
  },
  emptyHeading: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  featuresList: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureBullet: {
    fontSize: 18,
    marginRight: 10,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  createCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#14B8A6',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#14B8A6',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  createBtn: {
    backgroundColor: '#14B8A6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
});

export default FamilyVaultScreen;

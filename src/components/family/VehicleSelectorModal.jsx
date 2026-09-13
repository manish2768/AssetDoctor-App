/**
 * Asset Doctor — Multi-Vehicle Selector Modal
 * 
 * When logging fuel or maintenance, displays all accessible vehicles
 * (Personal + Family Vault Shared) and forces an explicit selection.
 * Prevents silent fallback to assets[0].
 */

import React, { useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useAssets } from '../../context/AssetProvider';
import { useFamilyVault } from '../../context/FamilyVaultContext';
import { COLORS } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { isVehicleCategory } from '../../utils/vehicleFolder';
import { resolveCanonicalAssetId } from '../../services/assets/assetIdentity';

export function VehicleSelectorModal({
  visible,
  onClose,
  onSelectVehicle,
  title = 'Select Vehicle',
  subtitle = 'Choose which vehicle to log fuel for',
}) {
  const { assets } = useAssets();
  const { sharedAssets } = useFamilyVault();

  // Combine personal vehicles + family shared vehicles (deduplicated by canonicalAssetId)
  const accessibleVehicles = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    // 1. Personal vehicles
    (assets || []).forEach((a) => {
      const id = resolveCanonicalAssetId(a);
      if (id && isVehicleCategory(a.category || a.categoryId) && !seenIds.has(id)) {
        seenIds.add(id);
        list.push({
          ...a,
          canonicalAssetId: id,
          isPersonal: true,
          vaultTag: 'Personal',
        });
      }
    });

    // 2. Family shared vehicles
    (sharedAssets || []).forEach((sa) => {
      const id = sa.canonicalAssetId || sa.sharedAssetId;
      if (id && isVehicleCategory(sa.category) && !seenIds.has(id)) {
        seenIds.add(id);
        list.push({
          ...sa,
          canonicalAssetId: id,
          isPersonal: false,
          vaultTag: 'Family Shared',
        });
      }
    });

    return list;
  }, [assets, sharedAssets]);

  const handleSelect = (vehicle) => {
    Haptics.tap();
    onSelectVehicle(vehicle);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {accessibleVehicles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.emptyText}>No vehicles found in your vault</Text>
              <Text style={styles.emptySubtext}>Add a vehicle to your vault to start tracking fuel</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {accessibleVehicles.map((v) => {
                const id = v.canonicalAssetId;
                const reg = v.registration ? ` (${v.registration})` : '';
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.vehicleCard}
                    onPress={() => handleSelect(v)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.iconCircle}>
                      <Text style={styles.vehicleIcon}>{v.icon || '🚗'}</Text>
                    </View>

                    <View style={styles.vehicleInfo}>
                      <Text style={styles.vehicleName} numberOfLines={1}>
                        {v.assetName || 'Vehicle'}{reg}
                      </Text>
                      <View style={styles.tagRow}>
                        <View style={[styles.badge, v.isPersonal ? styles.badgePersonal : styles.badgeFamily]}>
                          <Text style={styles.badgeText}>{v.vaultTag}</Text>
                        </View>
                        {v.fuelNorm ? (
                          <Text style={styles.fuelNormText}>• {v.fuelNorm}</Text>
                        ) : null}
                      </View>
                    </View>

                    <Text style={styles.chevron}>→</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  list: {
    maxHeight: 320,
  },
  listContent: {
    paddingVertical: 4,
    gap: 10,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  vehicleIcon: {
    fontSize: 22,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  badgePersonal: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  badgeFamily: {
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    textTransform: 'uppercase',
  },
  fuelNormText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  chevron: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94A3B8',
  },
});

export default VehicleSelectorModal;

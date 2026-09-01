/**
 * Asset Doctor — Vehicle Selection Card for Fuel & Mileage
 * Displays highlighted active vehicle context with registration, model, and current odometer.
 * Allows instant switching when multiple vehicles exist in portfolio.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useThemeColors } from '../../context/ThemeProvider';
import { TYPE, SPACING, RADIUS } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';

export function VehicleSelectCard({ vehicleAssets = [], selectedAssetId, onSelectAsset }) {
  const colors = useThemeColors();

  if (!vehicleAssets || vehicleAssets.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[TYPE.label, { color: colors.warning || '#F59E0B' }]}>NO VEHICLES IN PORTFOLIO</Text>
        <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
          Add a vehicle asset to start recording fuel logs and tracking mileage.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[TYPE.micro, { color: colors.textMuted, marginBottom: 8, letterSpacing: 0.8 }]}>
        FUEL FOR VEHICLE ({vehicleAssets.length})
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
        {vehicleAssets.map((v) => {
          const vId = v.assetId || v.id;
          const isSelected = vId === selectedAssetId;
          const reg = v.registrationNumber || v.registration || 'No Reg';
          const modelName = v.model || v.assetName || v.name || 'Vehicle';
          const odo = v.odometerKm != null ? `${Number(v.odometerKm).toLocaleString('en-IN')} km` : 'No odo';

          return (
            <Pressable
              key={vId}
              onPress={() => {
                Haptics.select();
                onSelectAsset?.(v);
              }}
              style={({ pressed }) => [
                styles.vehicleItem,
                {
                  backgroundColor: isSelected ? (colors.primaryMuted || '#0F766E20') : (colors.surface || '#FFFFFF'),
                  borderColor: isSelected ? (colors.primary || '#0F766E') : (colors.border || '#E2E8F0'),
                  borderWidth: isSelected ? 2 : 1,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Select vehicle ${modelName} registration ${reg}`}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.icon}>🏍️</Text>
                {isSelected ? (
                  <View style={[styles.badge, { backgroundColor: colors.primary || '#0F766E' }]}>
                    <Text style={styles.badgeText}>✓ Selected</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[TYPE.h4, { color: colors.text, marginTop: 6 }]} numberOfLines={1}>
                {modelName}
              </Text>
              <Text style={[TYPE.micro, { color: isSelected ? (colors.primary || '#0F766E') : colors.textMuted, fontWeight: '700' }]}>
                {reg.toUpperCase()}
              </Text>
              <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]} numberOfLines={1}>
                {odo}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: SPACING.sm,
  },
  scrollList: {
    paddingRight: SPACING.md,
    gap: SPACING.sm,
  },
  vehicleItem: {
    width: 155,
    padding: SPACING.sm + 4,
    borderRadius: RADIUS.md,
    justifyContent: 'space-between',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

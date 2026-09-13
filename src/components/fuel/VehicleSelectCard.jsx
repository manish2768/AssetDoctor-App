/**
 * Asset Doctor — Vehicle Selection Card for Fuel & Mileage
 * Displays highlighted active vehicle context with registration, model, and current odometer.
 * Allows instant switching when multiple vehicles exist in portfolio.
 * Strict vehicle isolation: passes selected vehicle ID directly to parent.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useThemeColors } from '../../context/ThemeProvider';
import { TYPE, SPACING, RADIUS } from '../../theme/tokens';
import { PremiumIcon } from '../../design-system/icons';
import { getVehiclePresentation } from '../../utils/vehiclePresentation';

export function VehicleSelectCard({
  vehicleAssets = [],
  selectedAssetId,
  selectedVehicleId,
  onSelectVehicleId,
  onSelectAsset,
}) {
  const colors = useThemeColors();
  const currentSelectedId = selectedVehicleId || selectedAssetId;

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
          const isSelected = vId === currentSelectedId;
          const pres = getVehiclePresentation(v);
          const reg = pres.registration || 'NO REG';
          const modelName = pres.displayName;
          const odo = v.odometerKm != null ? `${Number(v.odometerKm).toLocaleString('en-IN')} km` : 'No odo';

          return (
            <Pressable
              key={vId}
              onPress={() => {
                Haptics.select();
                onSelectVehicleId?.(vId);
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
                <View style={styles.iconWrap}>
                  <PremiumIcon
                    name={pres.icon}
                    size={20}
                    color={isSelected ? (colors.primary || '#0F766E') : colors.text}
                  />
                </View>
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
                {reg}
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
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default VehicleSelectCard;

/**
 * PolicyBazaar-inspired vehicle card — plate, compliance badges, expandable specs.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { COLORS, RADIUS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { getVehicleSpecs } from '../../utils/vehicleSpecs';
import { cleanAssetDisplayName } from '../../utils/displayAssetName';
import { CategoryIcon } from '../icons/CategoryIcon';
import { IndiaNumberPlate } from './IndiaNumberPlate';
import { VehicleStatusBadges } from './VehicleStatusBadges';
import { SpecAccordion } from './SpecAccordion';

export function VehicleCard({ asset, onPress, style, showAccordion = true }) {
  if (!asset) return null;
  const specs = getVehicleSpecs(asset);
  const title =
    cleanAssetDisplayName(asset.assetName, { registration: asset.registration }) ||
    asset.assetName ||
    'Vehicle';

  return (
    <Pressable
      onPress={() => {
        Haptics.tap();
        onPress?.(asset);
      }}
      style={[styles.card, style]}
    >
      <View style={styles.top}>
        <CategoryIcon name={asset.categoryId || 'vehicle'} size={36} color="#5B8DEF" />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {asset.categoryLabel || asset.category || 'Vehicle'}
            {asset.storeName ? ` · ${asset.storeName}` : ''}
          </Text>
        </View>
      </View>

      {specs.rawRegistration ? (
        <IndiaNumberPlate registration={specs.rawRegistration} style={{ marginTop: 12 }} />
      ) : (
        <View style={styles.noPlate}>
          <Text style={styles.noPlateText}>Registration not on file</Text>
        </View>
      )}

      <VehicleStatusBadges
        pucExpiry={asset.pucExpiry}
        insuranceExpiry={asset.insuranceExpiry}
        style={{ marginTop: 10 }}
      />

      {showAccordion ? (
        <SpecAccordion
          title="Vehicle Specs"
          rows={[
            { label: 'RTO', value: specs.rto },
            { label: 'Fuel Norms', value: specs.fuelNorm },
            { label: 'Chassis No', value: specs.chassis },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: 10,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: COLORS.text, fontWeight: '900', fontSize: 15 },
  meta: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  noPlate: {
    marginTop: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    paddingVertical: 12,
    alignItems: 'center',
  },
  noPlateText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
});

export default VehicleCard;

/**
 * Asset Doctor — 🚗 VEHICLE INSIGHTS section (Home dashboard)
 *
 * Renders a compact per-vehicle card on the Home screen so real mileage and
 * running cost are visible without opening the asset passport. Each card is
 * linked to its own assetId and exposes both "+ Log Fuel" and "History".
 *
 * Data always stays symmetric with the shared FuelService / fuelCalculator and
 * is vehicle-specific (never mixed across assets).
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';

import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { Haptics } from '../../services/haptics';
import { resolveAssetCapabilities } from '../../services/assets/assetCapabilities';
import { isHomeVehicle } from '../../utils/vehicleFolder';
import { deriveVehicleFuelSummary } from '../../services/fuel/vehicleFuelSummary';
import { QuickFuelLogModal } from './QuickFuelLogModal';
import { SectionHeader, PrimaryButton, SecondaryButton } from '../../components/design-system';
import { SPACING, TYPE, RADIUS } from '../../theme/tokens';

function VehicleCard({ vehicle, navigation, onLogFuel }) {
  const colors = useThemeColors();
  const { user } = useAuth();
  const assetId = vehicle.assetId || vehicle.id;
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let active = true;
    const uid = user?.uid;
    if (!uid || !assetId || vehicle.isDemo) {
      setSummary({ mileage: null, costPerKm: null, hasLogs: false });
      return () => {
        active = false;
      };
    }
    deriveVehicleFuelSummary(uid, assetId).then((res) => {
      if (active) setSummary(res);
    });
    return () => {
      active = false;
    };
  }, [user?.uid, assetId, vehicle.isDemo]);

  const plate = vehicle.registration
    ? vehicle.registration
    : vehicle.serialNumber
      ? vehicle.serialNumber
      : vehicle.categoryLabel || 'Vehicle';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.bodyStrong, { color: colors.text }]} numberOfLines={1}>
            {vehicle.assetName || vehicle.name || 'Vehicle'}
          </Text>
          <Text style={[TYPE.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {plate}
          </Text>
        </View>
        <View style={styles.statsRight}>
          <Text style={[TYPE.micro, { color: colors.textMuted }]}>Mileage</Text>
          <Text style={[TYPE.h2, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {summary?.mileage != null ? `${summary.mileage} km/L` : '—'}
          </Text>
          <Text style={[TYPE.micro, { color: colors.textMuted }]}>
            {summary?.costPerKm != null ? `₹${summary.costPerKm}/km` : ''}
          </Text>
        </View>
      </View>

      {summary && summary.hasLogs === false ? (
        <View style={styles.noLogs}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={[TYPE.caption, { color: colors.textMuted }]}>
              Start tracking mileage & running cost — every refill makes your
              numbers more accurate.
            </Text>
          </View>
          <Pressable
            onPress={() => onLogFuel(vehicle)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Start tracking mileage for ${vehicle.assetName || vehicle.name || 'vehicle'}`}
          >
            <Text style={[TYPE.label, { color: colors.primary }]}>START →</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          title="+ Log Fuel"
          onPress={() => onLogFuel(vehicle)}
          size="sm"
          style={styles.logBtn}
        />
        <SecondaryButton
          title="History"
          onPress={() =>
            navigation.navigate('FuelVault', { assetId })
          }
          size="sm"
          style={styles.historyBtn}
        />
      </View>
    </View>
  );
}

export function VehicleInsightsSection({ vehicles = [], navigation, loading }) {
  const colors = useThemeColors();
  const ui = useUiFeedback();
  const { user } = useAuth();
  const [activeLog, setActiveLog] = useState(null);
  // Surface a vehicle whenever it supports fuel tracking (petrol/diesel/CNG) OR
  // mileage/odometer (covers EVs and brand-new vehicles with no logs). Keeps the
  // "start tracking" entry point visible on Home even without any fuel logs yet.
  const eligible = (vehicles || []).filter((v) => {
    if (v.isArchived || v.deletedAt) return false;
    // Robust vehicle detection first (category + identifiers) so vehicles
    // never miss the Home fuel & mileage entry point.
    if (isHomeVehicle(v)) return true;
    const caps = resolveAssetCapabilities(v);
    if (caps.supportsFuelTracking) return true;
    return caps.supportsOdometer && caps.supportsMileage;
  });

  if (!eligible.length) return null;

  const onLogFuel = (vehicle) => {
    if (!user?.uid) {
      Haptics.tap();
      ui.info('Sign in to save', 'Create a free account to keep your fuel & mileage history.');
      return;
    }
    if (vehicle.isDemo) {
      Haptics.tap();
      ui.info('Demo asset', 'Sign in to save your own fuel & mileage history.');
      return;
    }
    Haptics.select();
    setActiveLog(vehicle);
  };

  return (
    <View>
      <SectionHeader title="🚗 Vehicle Insights" style={{ marginTop: SPACING.md }} />
      {loading && eligible.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.sm }} />
      ) : (
        eligible.map((vehicle) => (
          <VehicleCard
            key={vehicle.assetId || vehicle.id}
            vehicle={vehicle}
            navigation={navigation}
            onLogFuel={onLogFuel}
          />
        ))
      )}
      <QuickFuelLogModal
        visible={Boolean(activeLog)}
        asset={activeLog || {}}
        onClose={() => setActiveLog(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statsRight: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },
  noLogs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.15)',
  },
  actions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: 8,
  },
  logBtn: {
    flex: 1,
  },
  historyBtn: {
    flex: 1,
  },
});

export default VehicleInsightsSection;

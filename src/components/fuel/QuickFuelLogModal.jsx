/**
 * Fuel & Mileage — Quick Log Sheet
 *
 * A bottom-sheet that lets a vehicle owner log a fuel-up in seconds:
 *   - Current odometer (required)
 *   - Fuel entry mode: Amount paid (₹) or Litres dispensed
 *   - Optional fuel price (₹/L) so the calc engine can derive litres from amount
 *   - Full-tank flag for real mileage computation
 *
 * Shows the INSTANT FUEL PREVIEW card computed by the same trusted engine that
 * persists the log, and saves via FuelService.logFuel (offline-first).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../../context/ThemeProvider';
import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { Haptics } from '../../services/haptics';
import { FuelService } from '../../services/fuel/FuelService';
import { computeFuelCalculation, validateFuelInput } from '../../utils/fuelCalculator';
import { SPACING, TYPE, RADIUS, HIT } from '../../theme/tokens';
import { PrimaryButton, SecondaryButton } from '../design-system';
import { MobileNumericField } from '../ui/MobileNumericField';
import { FuelResultCard } from './FuelResultCard';
import { RefillImpactCard } from './RefillImpactCard';
import { VehicleSelectCard } from './VehicleSelectCard';

export function QuickFuelLogModal({ visible, asset: passedAsset, onClose }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { assets } = useAssets();
  const ui = useUiFeedback();

  // Multi-vehicle assets filtering
  const vehicleAssets = useMemo(() => {
    return (assets || []).filter(
      (a) => !a.isArchived && !a.deletedAt && (a.category === 'VEHICLE' || String(a.categoryId) === 'vehicles' || a.isVehicleInvoice || a.registrationNumber || a.registration)
    );
  }, [assets]);

  const [selectedAsset, setSelectedAsset] = useState(passedAsset || vehicleAssets[0] || null);

  useEffect(() => {
    if (passedAsset) {
      setSelectedAsset(passedAsset);
    } else if (vehicleAssets.length > 0 && !selectedAsset) {
      setSelectedAsset(vehicleAssets[0]);
    }
  }, [passedAsset, vehicleAssets]);

  const activeAsset = selectedAsset || passedAsset;
  const assetId = (activeAsset && (activeAsset.assetId || activeAsset.id)) || null;

  // Entry fields (strings managed by MobileNumericField)
  const [mode, setMode] = useState('amount'); // 'amount' | 'liters'
  const [odometer, setOdometer] = useState('');
  const [amount, setAmount] = useState('');
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [previousLog, setPreviousLog] = useState(null);
  const [saving, setSaving] = useState(false);
  // Refill Impact Card — shown after a successful save that yields a 2nd+ reading.
  const [impactVisible, setImpactVisible] = useState(false);

  // Reset form each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setMode('amount');
      setOdometer('');
      setAmount('');
      setLiters('');
      setPrice('');

      setIsFullTank(true);
      setPreviousLog(null);
      const uid = user?.uid;
      if (uid && assetId && !asset?.isDemo) {
        FuelService.getPreviousLog(uid, assetId)
          .then((prev) => setPreviousLog(prev || null))
          .catch(() => setPreviousLog(null));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, assetId]);

  const previousOdometerKM = previousLog ? Number(previousLog.odometerKM) : null;

  // Normalize + live preview using the trusted calc engine.
  const preview = useMemo(() => {
    if (!odometer) return null;
    const input = {
      odometerKM: Number(odometer),
      amountPaid: mode === 'amount' ? Number(amount) : 0,
      liters: mode === 'liters' ? Number(liters) : 0,
      fuelPricePerLiter: Number(price) > 0 ? Number(price) : null,
      isFullTank,
      entryMode: mode,
    };
    if (mode === 'amount' && !amount) return null;
    if (mode === 'liters' && !liters) return null;
    const previewResult = computeFuelCalculation(input, previousLog, asset || {});
    return { result: previewResult, validation: validateFuelInput(input, previousOdometerKM) };
  }, [odometer, amount, liters, price, isFullTank, mode, previousLog, asset, previousOdometerKM]);

  const toggleMode = (next) => {
    if (next === mode) return;
    Haptics.select();
    setMode(next);
  };

  const onSave = async () => {
    if (!user?.uid) {
      ui.info('Sign in to save', 'Create a free account to keep your fuel logs in the vault.');
      return;
    }
    if (!assetId) {
      ui.error('Save failed', 'Asset passport is missing.');
      return;
    }
    if (asset?.isDemo) {
      ui.info('Demo asset', 'Sign in to save your own fuel & mileage history.');
      return;
    }

    const input = {
      odometerKM: Number(odometer),
      amountPaid: mode === 'amount' ? Number(amount) : 0,
      liters: mode === 'liters' ? Number(liters) : 0,
      fuelPricePerLiter: Number(price) > 0 ? Number(price) : null,
      isFullTank,
      entryMode: mode,
    };

    const validation = validateFuelInput(input, previousOdometerKM);
    if (!validation.valid) {
      Haptics.error();
      ui.error('Check your entry', validation.error || 'Please fix the highlighted field.');
      return;
    }

    setSaving(true);
    try {
      const res = await FuelService.logFuel(user.uid, assetId, input, asset || {});
      if (res.success) {
        Haptics.success();
        ui.success('Fuel logged', 'Your mileage & cost update is saved to the vault.');
        onClose?.();
        // Show the premium Refill Impact Card when there is at least one prior
        // fuel reading (2nd+ entry → we have a real distance/mileage span).
        const hasPrior = Boolean(previousLog && Number(previousLog.odometerKM) > 0);
        if (hasPrior) {
          // Delay slightly so the sheet has already closed (no modal-on-modal clash).
          setTimeout(() => setImpactVisible(true), 80);
        }
      } else {
        Haptics.error();
        ui.error('Could not log', res.error || res.validation?.error || 'Please check the values.');
      }
    } catch (error) {
      Haptics.error();
      ui.error('Could not log', error?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.backdrop, { backgroundColor: colors.overlay || 'rgba(5,10,15,0.72)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <Text style={[TYPE.h2, { color: colors.text }]}>Log Fuel ⛽</Text>
              <VehicleSelectCard
                vehicleAssets={vehicleAssets}
                selectedAssetId={assetId}
                onSelectAsset={(v) => setSelectedAsset(v)}
              />
              <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
                {activeAsset?.assetName || activeAsset?.model ? `${activeAsset.assetName || activeAsset.model} — real mileage comes from full-tank refills.` : 'Record a fuel top-up for this vehicle.'}
              </Text>

              <View style={styles.modeRow}>
                <FilterPill label="Amount ₹" active={mode === 'amount'} onPress={() => toggleMode('amount')} colors={colors} />
                <FilterPill label="Litres (L)" active={mode === 'liters'} onPress={() => toggleMode('liters')} colors={colors} />
              </View>

              <MobileNumericField
                label="Current odometer (KM) *"
                value={odometer}
                onChangeText={setOdometer}
                placeholder="e.g. 12480"
              />

              {mode === 'amount' ? (
                <MobileNumericField
                  label="Amount paid (₹) *"
                  value={amount}
                  onChangeText={setAmount}
                  allowDecimal
                  placeholder="e.g. 1500"
                />
              ) : (
                <MobileNumericField
                  label="Fuel quantity (Litres) *"
                  value={liters}
                  onChangeText={setLiters}
                  allowDecimal
                  placeholder="e.g. 12.5"
                />
              )}

              {mode === 'amount' ? (
                <MobileNumericField
                  label="Fuel price (₹/L) — used to derive litres"
                  value={price}
                  onChangeText={setPrice}
                  allowDecimal
                  placeholder="e.g. 106.5"
                />
              ) : null}

              <View style={[styles.fullTankRow, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[TYPE.bodyStrong, { color: colors.text }]}>Full tank refill</Text>
                  <Text style={[TYPE.caption, { color: colors.textMuted }]}>
                    Needed to calculate real mileage
                  </Text>
                </View>
                <Switch
                  value={isFullTank}
                  onValueChange={(v) => {
                    Haptics.select();
                    setIsFullTank(v);
                  }}
                  accessibilityLabel="Full tank refill"
                />
              </View>

              <FuelResultCard result={preview} />

              {saving ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.md }} />
              ) : (
                <View style={styles.actions}>
                  <SecondaryButton title="Cancel" onPress={onClose} style={styles.cancelBtn} />
                  <PrimaryButton
                    title="Save fuel log"
                    onPress={onSave}
                    style={styles.saveBtn}
                    loading={saving}
                  />
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      <RefillImpactCard
        visible={impactVisible}
        asset={asset}
        onClose={() => setImpactVisible(false)}
        onPreview={(canvas) => {
          setImpactVisible(false);
          // Future: open the share canvas (1:1 / 9:16) capture preview.
        }}
      />
    </Modal>
  );
}

function FilterPill({ label, active, onPress, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? colors.accentLight : colors.surface,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[TYPE.caption, { color: active ? colors.primary : colors.textMuted, fontWeight: '700' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    maxHeight: '92%',
  },
  sheetContent: { padding: SPACING.lg },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    minHeight: HIT.min,
    justifyContent: 'center',
  },
  fullTankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.lg,
  },
  cancelBtn: { flex: 1 },
  saveBtn: { flex: 2 },
});

export default QuickFuelLogModal;

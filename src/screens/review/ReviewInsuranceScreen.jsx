/**
 * Asset Doctor — Dedicated Vehicle Insurance Review Screen
 *
 * Tailored exclusively for Vehicle Insurance Policies:
 * - Insurer & Policy Number
 * - Policy Start & Expiry Dates
 * - IDV & Premium
 * - Engine & Chassis Numbers
 * - Strict Vehicle Passport Linking
 *
 * NEVER shows irrelevant purchase/warranty/appliance fields.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../../theme/branding';
import { GlassButton, GlassCard, GlassInput, Screen } from '../../components/ui/Glass';
import { Haptics } from '../../services/haptics';
import { useAssets } from '../../context/AssetProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { listVehicleAssets } from '../../utils/vehicleFolder';
import { VehicleLinkingEngine } from '../../services/vehicles/VehicleLinkingEngine';
import { DuplicateProtectionService } from '../../services/duplicateProtectionService';
import { formatINRExact } from '../../utils/format';
import { goHomeDashboard, openRescanInvoice } from '../../navigation/navActions';
import { markScanSession, clearScanSession } from '../../utils/scanNavGuard';

import { normalizeInsurance } from '../../services/ocr/UnifiedDocumentNormalizer';
import { SmartCore } from '../../smartCore';

export function ReviewInsuranceScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const ui = useUiFeedback();
  const { assets, createAsset } = useAssets();

  const params = route?.params || {};
  const initialData = params.extractedData || params.assetData || params.invoice || {};
  const norm = normalizeInsurance(initialData);
  const imageUri = params.imageUri || '';

  // Form State
  const [form, setForm] = useState({
    insurerName: norm.insurerName,
    policyNumber: norm.policyNumber,
    policyType: norm.policyType,
    registration: norm.registration,
    insuredName: norm.insuredName,
    engineNumber: norm.engineNumber,
    chassisNumber: norm.chassisNumber,
    policyStartDate: norm.policyStartDate,
    policyExpiryDate: norm.policyExpiryDate,
    idv: norm.idv != null ? String(norm.idv) : '',
    premiumAmount: norm.premiumAmount != null ? String(norm.premiumAmount) : '',
  });

  const [saving, setSaving] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Available vehicles from user vault
  const vehicles = useMemo(() => listVehicleAssets(assets) || [], [assets]);

  // Persist review session in scanNavGuard to survive Activity kill
  useEffect(() => {
    markScanSession('ReviewInsurance', {
      scanSessionId: params.scanSessionId || `scan_${Date.now()}`,
      documentType: 'VEHICLE_INSURANCE',
      reviewRoute: 'ReviewInsurance',
      imageUri,
      extractedData: initialData,
      assetData: initialData,
      invoice: initialData,
      audit: params.audit,
    }).catch(() => {});
  }, []);

  // Automatic Vehicle Matching
  useEffect(() => {
    if (!vehicles.length) return;

    const matchRes = VehicleLinkingEngine.resolveVehicleLink(
      {
        registrationNumber: form.registration,
        chassisNumber: form.chassisNumber,
        engineNumber: form.engineNumber,
        ownerName: form.insuredName,
        vehicleMake: norm.vehicleMake || initialData.vehicleMake || initialData.brand,
        vehicleModel: norm.vehicleModel || initialData.vehicleModel || initialData.model,
      },
      assets,
    );

    if (matchRes.matchedVehicle) {
      const vId = matchRes.matchedVehicle.assetId || matchRes.matchedVehicle.id;
      setSelectedVehicleId(vId);
    } else if (vehicles.length === 1) {
      const single = vehicles[0];
      const identityCheck = SmartCore.validateVehicleIdentity(
        {
          registration: form.registration,
          chassisNumber: form.chassisNumber,
          engineNumber: form.engineNumber,
        },
        single,
      );
      if (!identityCheck.hasMismatch) {
        const vId = single.assetId || single.id;
        setSelectedVehicleId(vId);
      }
    }
  }, [form.registration, form.chassisNumber, form.engineNumber, vehicles, assets]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    Haptics.tap();

    if (!form.insurerName.trim()) {
      ui.error('Insurer Name Required', 'Please enter the insurance company name.');
      return;
    }

    if (!form.policyNumber.trim()) {
      ui.error('Policy Number Required', 'Please enter the insurance policy number.');
      return;
    }

    // Chronological Date Validation (SmartCore Consistency Engine)
    if (form.policyStartDate && form.policyExpiryDate) {
      const dateCheck = SmartCore.validateDates(form.policyStartDate, form.policyExpiryDate, {
        startLabel: 'Policy start date',
        endLabel: 'Policy expiry date',
      });
      if (!dateCheck.isValid) {
        Haptics.error();
        ui.error('Invalid Policy Dates', dateCheck.error || 'Expiry date cannot be before start date.');
        return;
      }
    }

    if (!selectedVehicleId && vehicles.length > 0) {
      ui.info('Select Vehicle', 'Please select which vehicle this insurance policy belongs to.');
      return;
    }

    // Duplicate Check
    if (selectedVehicleId) {
      const targetVehicle = vehicles.find((v) => (v.assetId || v.id) === selectedVehicleId);
      const dup = DuplicateProtectionService.checkInsuranceDuplicate(
        form.policyNumber,
        targetVehicle,
      );
      if (dup.isDuplicate) {
        Haptics.warning();
        const proceed = await ui.confirm({
          title: 'Insurance Already Exists',
          message: `${dup.reason}\n\nDo you want to update the insurance policy on ${targetVehicle?.assetName || 'the vehicle'}?`,
          confirmLabel: 'Update Policy',
        });
        if (!proceed) return;
      }

      // Registration / Identity Mismatch Protection (SmartCore Consistency Engine)
      if (targetVehicle) {
        const identityCheck = SmartCore.validateVehicleIdentity(
          {
            registration: form.registration,
            chassisNumber: form.chassisNumber,
            engineNumber: form.engineNumber,
          },
          targetVehicle,
        );
        if (identityCheck.hasMismatch) {
          Haptics.warning();
          const proceed = await ui.confirm({
            title: identityCheck.warningTitle || 'Vehicle Details Mismatch',
            message: identityCheck.warningMessage || 'Vehicle details do not match.',
            confirmLabel: 'Attach Anyway',
            cancelLabel: 'Change Vehicle',
          });
          if (!proceed) return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        assetName: 'Vehicle Insurance Policy',
        insurerName: form.insurerName,
        shopName: form.insurerName,
        policyNumber: form.policyNumber,
        invoiceNumber: form.policyNumber,
        policyType: form.policyType,
        registration: form.registration,
        insuredName: form.insuredName,
        customerName: form.insuredName,
        engineNumber: form.engineNumber,
        chassisNumber: form.chassisNumber,
        policyStartDate: form.policyStartDate,
        policyExpiryDate: form.policyExpiryDate,
        insuranceExpiry: form.policyExpiryDate,
        idv: form.idv ? Number(form.idv) : null,
        totalAmount: form.premiumAmount ? Number(form.premiumAmount) : 0,
        premium: form.premiumAmount ? Number(form.premiumAmount) : null,
        documentType: 'VEHICLE_INSURANCE',
        classifiedDocumentType: 'INSURANCE',
        scanDocumentType: 'insurance',
        isAttachDoc: true,
        requiresVehicleLink: true,
        linkAssetId: selectedVehicleId || null,
        ocrVerified: true,
      };

      const res = await createAsset(payload, imageUri || null);
      if (res?.success) {
        Haptics.success();
        ui.success('Insurance Saved', 'Successfully added to your vehicle passport.');
        goHomeDashboard();
      } else {
        throw new Error(res?.error || 'Could not save insurance policy');
      }
    } catch (err) {
      Haptics.error();
      ui.error('Save Failed', err?.message || 'Could not save insurance policy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              clearScanSession().catch(() => {});
              navigation.goBack();
            }}
            style={styles.closeBtn}
            hitSlop={12}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerBadge}>🛡️ VEHICLE INSURANCE</Text>
            <Text style={styles.headerTitle}>Review Insurance Policy</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, SPACING.md) + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {params.audit?.manualEntry || params.ocrFailed ? (
            <View style={styles.manualEntryBanner}>
              <Text style={styles.manualEntryTitle}>⚠️ Details not auto-detected</Text>
              <Text style={styles.manualEntrySubtitle}>
                We couldn't read all details from this photo. Please enter or verify details below.
              </Text>
            </View>
          ) : null}

          {/* IMAGE PREVIEW */}
          {imageUri ? (
            <GlassCard style={styles.postcardCard}>
              <Image source={{ uri: imageUri }} style={styles.thumbnail} resizeMode="cover" />
              <View style={styles.postcardInfo}>
                <Text style={styles.postcardShop} numberOfLines={1}>
                  {form.insurerName || 'Insurance Company'}
                </Text>
                <Text style={styles.postcardDate}>Policy: {form.policyNumber || '—'}</Text>
                {form.premiumAmount ? (
                  <Text style={styles.postcardAmount}>{formatINRExact(form.premiumAmount)}</Text>
                ) : null}
              </View>
            </GlassCard>
          ) : null}

          {/* CARD 1: POLICY & INSURER */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>1. Insurer & Policy</Text>
            <Text style={styles.cardSub}>Insurance provider and policy schedule</Text>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>Insurance Company *</Text>
              <GlassInput
                value={form.insurerName}
                onChangeText={(t) => updateField('insurerName', t)}
                placeholder="e.g. Tata AIG, HDFC ERGO, ICICI Lombard"
              />
            </View>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Policy Number *</Text>
                <GlassInput
                  value={form.policyNumber}
                  onChangeText={(t) => updateField('policyNumber', t)}
                  placeholder="e.g. 0159988223"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Policy Type</Text>
                <GlassInput
                  value={form.policyType}
                  onChangeText={(t) => updateField('policyType', t)}
                  placeholder="Comprehensive / Third Party"
                />
              </View>
            </View>
          </GlassCard>

          {/* CARD 2: INSURED VEHICLE */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>2. Insured Vehicle</Text>
            <Text style={styles.cardSub}>Vehicle identification on policy schedule</Text>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Registration Number</Text>
                <GlassInput
                  value={form.registration}
                  onChangeText={(t) => updateField('registration', t.toUpperCase().replace(/\s+/g, ''))}
                  autoCapitalize="characters"
                  placeholder="e.g. DL04AB1234"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Insured / Owner Name</Text>
                <GlassInput
                  value={form.insuredName}
                  onChangeText={(t) => updateField('insuredName', t)}
                  placeholder="Policyholder Name"
                />
              </View>
            </View>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Chassis Number / VIN</Text>
                <GlassInput
                  value={form.chassisNumber}
                  onChangeText={(t) => updateField('chassisNumber', t.toUpperCase().replace(/\s+/g, ''))}
                  autoCapitalize="characters"
                  placeholder="Chassis No"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Engine Number</Text>
                <GlassInput
                  value={form.engineNumber}
                  onChangeText={(t) => updateField('engineNumber', t.toUpperCase().replace(/\s+/g, ''))}
                  autoCapitalize="characters"
                  placeholder="Engine No"
                />
              </View>
            </View>
          </GlassCard>

          {/* CARD 3: COVERAGE PERIOD & FINANCIALS */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>3. Coverage Period & Premium</Text>
            <Text style={styles.cardSub}>Validity dates and premium paid</Text>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Start Date</Text>
                <GlassInput
                  value={form.policyStartDate}
                  onChangeText={(t) => updateField('policyStartDate', t)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Policy Expiry Date *</Text>
                <GlassInput
                  value={form.policyExpiryDate}
                  onChangeText={(t) => updateField('policyExpiryDate', t)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>IDV (Insured Value ₹)</Text>
                <GlassInput
                  value={form.idv}
                  onChangeText={(t) => updateField('idv', t.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 150000"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Premium Paid (₹)</Text>
                <GlassInput
                  value={form.premiumAmount}
                  onChangeText={(t) => updateField('premiumAmount', t.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 3450"
                />
              </View>
            </View>
          </GlassCard>

          {/* CARD 4: VEHICLE LINKING */}
          {vehicles.length > 0 ? (
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>4. Link to Vehicle Passport</Text>
              <Text style={styles.cardSub}>Attach this insurance policy to your vehicle in vault</Text>

              <View style={styles.vehicleList}>
                {vehicles.map((v) => {
                  const vId = v.assetId || v.id;
                  const isSelected = selectedVehicleId === vId;
                  return (
                    <Pressable
                      key={vId}
                      style={[styles.vehicleOption, isSelected && styles.vehicleOptionSelected]}
                      onPress={() => {
                        Haptics.select();
                        setSelectedVehicleId(vId);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.vehicleOptionTitle, isSelected && styles.vehicleOptionTitleSelected]}>
                          {v.assetName || v.productName || 'Vehicle'}
                        </Text>
                        <Text style={styles.vehicleOptionSub}>
                          {v.registration || 'No Plate'} {v.model ? `· ${v.model}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          ) : null}

          {/* ACTIONS */}
          <GlassButton
            title="Save Insurance Policy"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8B5CF6',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  scroll: {
    padding: SPACING.md,
  },
  postcardCard: {
    flexDirection: 'row',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  postcardInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  postcardShop: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  postcardDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  postcardAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8B5CF6',
    marginTop: 2,
  },
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  fieldItem: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  rowTwoCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleList: {
    marginTop: SPACING.xs,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  vehicleOptionSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  vehicleOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  vehicleOptionTitleSelected: {
    color: '#A78BFA',
  },
  vehicleOptionSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#8B5CF6',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
  },
  saveBtn: {
    marginTop: SPACING.sm,
  },
  manualEntryBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  manualEntryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 2,
  },
  manualEntrySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
});

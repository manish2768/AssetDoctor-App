/**
 * Asset Doctor — Dedicated Vehicle PUC Review Screen
 *
 * Tailored exclusively for Pollution Under Control (PUC) Certificates:
 * - Certificate Number & Validity
 * - Fuel Type & Testing Center
 * - Emission Values (CO, HC, CO2) & Pass Status
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
import { goHomeDashboard, openRescanInvoice } from '../../navigation/navActions';
import { markScanSession, clearScanSession } from '../../utils/scanNavGuard';

import { normalizePuc } from '../../services/ocr/UnifiedDocumentNormalizer';
import { SmartCore } from '../../smartCore';

export function ReviewPucScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const ui = useUiFeedback();
  const { assets, createAsset } = useAssets();

  const params = route?.params || {};
  const initialData = params.extractedData || params.assetData || params.invoice || {};
  const norm = normalizePuc(initialData);
  const imageUri = params.imageUri || '';

  // Form State
  const [form, setForm] = useState({
    certificateNumber: norm.certificateNumber,
    registration: norm.registration,
    issueDate: norm.issueDate,
    validUntil: norm.validUntil,
    fuelType: norm.fuelType,
    testingCentre: norm.testingCentre,
    coValue: norm.coValue,
    hcValue: norm.hcValue,
    co2Value: norm.co2Value,
    emissionResult: norm.emissionResult,
  });

  const [saving, setSaving] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Available vehicles from user vault
  const vehicles = useMemo(() => listVehicleAssets(assets) || [], [assets]);

  // Persist review session in scanNavGuard to survive Activity kill
  useEffect(() => {
    markScanSession('ReviewPuc', {
      scanSessionId: params.scanSessionId || `scan_${Date.now()}`,
      documentType: 'VEHICLE_PUC',
      reviewRoute: 'ReviewPuc',
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
        chassisNumber: norm.chassisNumber || initialData.chassisNumber,
        engineNumber: norm.engineNumber || initialData.engineNumber,
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
          chassisNumber: norm.chassisNumber || initialData.chassisNumber,
          engineNumber: norm.engineNumber || initialData.engineNumber,
        },
        single,
      );
      if (!identityCheck.hasMismatch) {
        const vId = single.assetId || single.id;
        setSelectedVehicleId(vId);
      }
    }
  }, [form.registration, vehicles, assets, norm.chassisNumber, norm.engineNumber]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    Haptics.tap();

    if (!form.certificateNumber.trim()) {
      ui.error('Certificate Number Required', 'Please enter the PUC certificate number.');
      return;
    }

    if (!form.validUntil.trim()) {
      ui.error('Validity Date Required', 'Please enter the PUC expiry/valid until date.');
      return;
    }

    // Chronological Date Validation (SmartCore Consistency Engine)
    if (form.issueDate && form.validUntil) {
      const dateCheck = SmartCore.validateDates(form.issueDate, form.validUntil, {
        startLabel: 'PUC issue date',
        endLabel: 'PUC valid until date',
      });
      if (!dateCheck.isValid) {
        Haptics.error();
        ui.error('Invalid PUC Dates', dateCheck.error || 'Valid until date cannot be before issue date.');
        return;
      }
    }

    if (!selectedVehicleId && vehicles.length > 0) {
      ui.info('Select Vehicle', 'Please select which vehicle this PUC certificate belongs to.');
      return;
    }

    // Duplicate Check
    if (selectedVehicleId) {
      const targetVehicle = vehicles.find((v) => (v.assetId || v.id) === selectedVehicleId);
      const dup = DuplicateProtectionService.checkPucDuplicate(
        form.certificateNumber,
        targetVehicle,
      );
      if (dup.isDuplicate) {
        Haptics.warning();
        const proceed = await ui.confirm({
          title: 'PUC Already Exists',
          message: `${dup.reason}\n\nDo you want to update the PUC certificate on ${targetVehicle?.assetName || 'the vehicle'}?`,
          confirmLabel: 'Update Certificate',
        });
        if (!proceed) return;
      }

      // Registration / Identity Mismatch Protection (SmartCore Consistency Engine)
      if (targetVehicle) {
        const identityCheck = SmartCore.validateVehicleIdentity(
          {
            registration: form.registration,
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
        assetName: 'Vehicle PUC Certificate',
        certificateNumber: form.certificateNumber,
        invoiceNumber: form.certificateNumber,
        registration: form.registration,
        issueDate: form.issueDate,
        invoiceDate: form.issueDate,
        validUntil: form.validUntil,
        pucExpiry: form.validUntil,
        fuelType: form.fuelType,
        shopName: form.testingCentre,
        testingCentre: form.testingCentre,
        issuingAuthority: form.testingCentre,
        coValue: form.coValue,
        hcValue: form.hcValue,
        co2Value: form.co2Value,
        emissionResult: form.emissionResult,
        documentType: 'VEHICLE_PUC',
        classifiedDocumentType: 'PUC',
        scanDocumentType: 'puc',
        isAttachDoc: true,
        requiresVehicleLink: true,
        linkAssetId: selectedVehicleId || null,
        ocrVerified: true,
      };

      const res = await createAsset(payload, imageUri || null);
      if (res?.success) {
        Haptics.success();
        ui.success('PUC Certificate Saved', 'Successfully added to your vehicle passport.');
        goHomeDashboard();
      } else {
        throw new Error(res?.error || 'Could not save PUC certificate');
      }
    } catch (err) {
      Haptics.error();
      ui.error('Save Failed', err?.message || 'Could not save PUC certificate.');
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
            <Text style={styles.headerBadge}>🟢 PUC CERTIFICATE</Text>
            <Text style={styles.headerTitle}>Review PUC Details</Text>
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
                  PUC #{form.certificateNumber || '—'}
                </Text>
                <Text style={styles.postcardDate}>Valid Until: {form.validUntil || '—'}</Text>
                <Text style={styles.postcardStatus}>Result: {form.emissionResult || 'PASS'}</Text>
              </View>
            </GlassCard>
          ) : null}

          {/* CARD 1: CERTIFICATE & DATES */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>1. Certificate & Validity</Text>
            <Text style={styles.cardSub}>Pollution certificate number and validity dates</Text>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>Certificate Number *</Text>
              <GlassInput
                value={form.certificateNumber}
                onChangeText={(t) => updateField('certificateNumber', t)}
                placeholder="e.g. DL0120240098231"
              />
            </View>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Issue / Test Date</Text>
                <GlassInput
                  value={form.issueDate}
                  onChangeText={(t) => updateField('issueDate', t)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Valid Until *</Text>
                <GlassInput
                  value={form.validUntil}
                  onChangeText={(t) => updateField('validUntil', t)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>Fuel Type</Text>
              <GlassInput
                value={form.fuelType}
                onChangeText={(t) => updateField('fuelType', t)}
                placeholder="Petrol / Diesel / CNG / EV"
              />
            </View>
          </GlassCard>

          {/* CARD 2: VEHICLE & TESTING CENTRE */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>2. Vehicle & Testing Centre</Text>
            <Text style={styles.cardSub}>Vehicle registration and testing station authority</Text>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>Registration Number</Text>
              <GlassInput
                value={form.registration}
                onChangeText={(t) => updateField('registration', t.toUpperCase().replace(/\s+/g, ''))}
                autoCapitalize="characters"
                placeholder="e.g. DL04AB1234"
              />
            </View>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>Testing Centre / Authority</Text>
              <GlassInput
                value={form.testingCentre}
                onChangeText={(t) => updateField('testingCentre', t)}
                placeholder="Authorized Pollution Testing Centre"
              />
            </View>
          </GlassCard>

          {/* CARD 3: EMISSION READINGS */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>3. Emission Readings</Text>
            <Text style={styles.cardSub}>Gas analysis values & compliance outcome</Text>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>CO (% vol)</Text>
                <GlassInput
                  value={form.coValue}
                  onChangeText={(t) => updateField('coValue', t)}
                  placeholder="e.g. 0.05"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>HC (ppm)</Text>
                <GlassInput
                  value={form.hcValue}
                  onChangeText={(t) => updateField('hcValue', t)}
                  placeholder="e.g. 120"
                />
              </View>
            </View>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>Emission Result</Text>
              <GlassInput
                value={form.emissionResult}
                onChangeText={(t) => updateField('emissionResult', t)}
                placeholder="PASS / COMPLIANT"
              />
            </View>
          </GlassCard>

          {/* CARD 4: VEHICLE LINKING */}
          {vehicles.length > 0 ? (
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>4. Link to Vehicle Passport</Text>
              <Text style={styles.cardSub}>Attach this certificate to your vehicle in vault</Text>

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
            title="Save PUC Certificate"
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
    color: '#10B981',
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
  postcardStatus: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
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
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  vehicleOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  vehicleOptionTitleSelected: {
    color: '#34D399',
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
    borderColor: '#10B981',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
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

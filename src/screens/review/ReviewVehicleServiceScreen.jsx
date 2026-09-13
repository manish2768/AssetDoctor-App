/**
 * Asset Doctor — Dedicated Vehicle Service Bill Review Screen
 *
 * Tailored exclusively for Vehicle Service & Maintenance Invoices:
 * - Workshop & Job Card details
 * - Current Odometer & Mileage
 * - Parts, Labour & Grand Total
 * - Next Service Due (Date & KM)
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
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../../theme/branding';
import { GlassButton, GlassCard, GlassInput, Screen } from '../../components/ui/Glass';
import { Haptics } from '../../services/haptics';
import { useAssets } from '../../context/AssetProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { listVehicleAssets, normalizeRegistration } from '../../utils/vehicleFolder';
import { VehicleLinkingEngine } from '../../services/vehicles/VehicleLinkingEngine';
import { DuplicateProtectionService } from '../../services/duplicateProtectionService';
import { formatINRExact } from '../../utils/format';
import { goHomeDashboard, openRescanInvoice } from '../../navigation/navActions';
import { markScanSession, clearScanSession } from '../../utils/scanNavGuard';

import { normalizeVehicleService } from '../../services/ocr/UnifiedDocumentNormalizer';
import { SmartCore } from '../../smartCore';

export function ReviewVehicleServiceScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const ui = useUiFeedback();
  const { assets, createAsset } = useAssets();

  const params = route?.params || {};
  const initialData = params.extractedData || params.assetData || params.invoice || {};
  const norm = normalizeVehicleService(initialData);
  const imageUri = params.imageUri || '';

  // Form State
  const [form, setForm] = useState({
    workshopName: norm.workshopName,
    serviceInvoiceNumber: norm.serviceInvoiceNumber,
    serviceDate: norm.serviceDate,
    serviceType: norm.serviceType,
    registration: norm.registration,
    odometerReading: norm.odometerReading != null ? String(norm.odometerReading) : '',
    labourAmount: norm.labourAmount != null ? String(norm.labourAmount) : '',
    partsAmount: norm.partsAmount != null ? String(norm.partsAmount) : '',
    taxAmount: norm.taxAmount != null ? String(norm.taxAmount) : '',
    totalAmount: norm.totalAmount != null ? String(norm.totalAmount) : '',
    nextServiceDueDate: norm.nextServiceDueDate,
    nextServiceDueKm: norm.nextServiceDueKm != null ? String(norm.nextServiceDueKm) : '',
  });

  const [saving, setSaving] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // Available vehicles from user vault
  const vehicles = useMemo(() => listVehicleAssets(assets) || [], [assets]);

  // Persist review session in scanNavGuard to survive Activity kill
  useEffect(() => {
    markScanSession('ReviewVehicleService', {
      scanSessionId: params.scanSessionId || `scan_${Date.now()}`,
      documentType: 'VEHICLE_SERVICE_BILL',
      reviewRoute: 'ReviewVehicleService',
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

    if (!form.workshopName.trim()) {
      ui.error('Workshop Name Required', 'Please enter the workshop or dealer name.');
      return;
    }

    if (!selectedVehicleId && vehicles.length > 0) {
      ui.info('Select Vehicle', 'Please select which vehicle this service bill belongs to.');
      return;
    }

    // Duplicate Check
    if (selectedVehicleId) {
      const targetVehicle = vehicles.find((v) => (v.assetId || v.id) === selectedVehicleId);
      const dup = DuplicateProtectionService.checkVehicleServiceDuplicate(
        form.serviceInvoiceNumber,
        form.serviceDate,
        targetVehicle,
      );
      if (dup.isDuplicate) {
        Haptics.warning();
        const proceed = await ui.confirm({
          title: 'Service Bill Already Exists',
          message: `${dup.reason}\n\nDo you want to update this service record on ${targetVehicle?.assetName || 'the vehicle'}?`,
          confirmLabel: 'Update Record',
        });
        if (!proceed) return;
      }

      // Registration Mismatch Protection (SmartCore Consistency Engine)
      if (targetVehicle) {
        const identityCheck = SmartCore.validateVehicleIdentity(
          {
            registration: form.registration,
            chassisNumber: norm.chassisNumber || initialData.chassisNumber,
            engineNumber: norm.engineNumber || initialData.engineNumber,
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

      // Odometer Consistency Check (SmartCore Consistency Engine)
      if (targetVehicle && form.odometerReading) {
        const odoCheck = SmartCore.validateOdometer(
          form.odometerReading,
          targetVehicle.odometerKm || targetVehicle.odometerReading || 0,
        );
        if (odoCheck.isRollback) {
          Haptics.warning();
          const proceed = await ui.confirm({
            title: odoCheck.warningTitle || 'Odometer Reading Check',
            message: odoCheck.warningMessage || 'Odometer reading appears inconsistent.',
            confirmLabel: 'Keep Reading',
            cancelLabel: 'Review',
          });
          if (!proceed) return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        assetName: 'Vehicle Service Record',
        workshopName: form.workshopName,
        shopName: form.workshopName,
        invoiceNumber: form.serviceInvoiceNumber,
        serviceInvoiceNumber: form.serviceInvoiceNumber,
        invoiceDate: form.serviceDate,
        serviceDate: form.serviceDate,
        registration: form.registration,
        odometerKm: form.odometerReading ? Number(form.odometerReading) : null,
        totalAmount: form.totalAmount ? Number(form.totalAmount) : 0,
        labourCharges: form.labourAmount ? Number(form.labourAmount) : null,
        partsTotal: form.partsAmount ? Number(form.partsAmount) : null,
        taxAmount: form.taxAmount ? Number(form.taxAmount) : null,
        nextServiceDue: form.nextServiceDueDate || null,
        nextServiceOdometerKm: form.nextServiceDueKm ? Number(form.nextServiceDueKm) : null,
        jobType: form.serviceType,
        documentType: 'VEHICLE_SERVICE_BILL',
        classifiedDocumentType: 'VEHICLE_SERVICE',
        scanDocumentType: 'vehicle_service',
        isAttachDoc: true,
        requiresVehicleLink: true,
        linkAssetId: selectedVehicleId || null,
        ocrVerified: true,
      };

      const res = await createAsset(payload, imageUri || null);
      if (res?.success) {
        Haptics.success();
        ui.success('Service Bill Saved', 'Successfully added to your vehicle passport.');
        goHomeDashboard();
      } else {
        throw new Error(res?.error || 'Could not save service record');
      }
    } catch (err) {
      Haptics.error();
      ui.error('Save Failed', err?.message || 'Could not save vehicle service record.');
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
            <Text style={styles.headerBadge}>🚗 VEHICLE SERVICE</Text>
            <Text style={styles.headerTitle}>Review Service Bill</Text>
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
                  {form.workshopName || 'Vehicle Service Workshop'}
                </Text>
                <Text style={styles.postcardDate}>{form.serviceDate || 'Date: —'}</Text>
                {form.totalAmount ? (
                  <Text style={styles.postcardAmount}>{formatINRExact(form.totalAmount)}</Text>
                ) : null}
              </View>
            </GlassCard>
          ) : null}

          {/* CARD 1: WORKSHOP & INVOICE */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>1. Workshop & Job Card</Text>
            <Text style={styles.cardSub}>Authorized dealer or independent service center</Text>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>Workshop / Dealer Name *</Text>
              <GlassInput
                value={form.workshopName}
                onChangeText={(t) => updateField('workshopName', t)}
                placeholder="e.g. Apex Motors Authorized Service"
              />
            </View>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Invoice / Job Card #</Text>
                <GlassInput
                  value={form.serviceInvoiceNumber}
                  onChangeText={(t) => updateField('serviceInvoiceNumber', t)}
                  placeholder="e.g. JC-81587"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Service Date</Text>
                <GlassInput
                  value={form.serviceDate}
                  onChangeText={(t) => updateField('serviceDate', t)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>

            <View style={styles.fieldItem}>
              <Text style={styles.fieldLabel}>Service Description</Text>
              <GlassInput
                value={form.serviceType}
                onChangeText={(t) => updateField('serviceType', t)}
                placeholder="e.g. Periodic Maintenance, Oil Change"
              />
            </View>
          </GlassCard>

          {/* CARD 2: VEHICLE & ODOMETER */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>2. Vehicle & Mileage</Text>
            <Text style={styles.cardSub}>Registration plate and odometer at time of service</Text>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Registration Number</Text>
                <GlassInput
                  value={form.registration}
                  onChangeText={(t) => updateField('registration', t.toUpperCase().replace(/\s+/g, ''))}
                  autoCapitalize="characters"
                  placeholder="e.g. UP32QU2187"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Odometer (KM)</Text>
                <GlassInput
                  value={form.odometerReading}
                  onChangeText={(t) => updateField('odometerReading', t.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 12273"
                />
              </View>
            </View>
          </GlassCard>

          {/* CARD 3: BILLING & FINANCIALS */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>3. Billing & Financials</Text>
            <Text style={styles.cardSub}>Labour charges, spare parts and total paid</Text>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Labour Charges (₹)</Text>
                <GlassInput
                  value={form.labourAmount}
                  onChangeText={(t) => updateField('labourAmount', t.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 850"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Parts Total (₹)</Text>
                <GlassInput
                  value={form.partsAmount}
                  onChangeText={(t) => updateField('partsAmount', t.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 1450"
                />
              </View>
            </View>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Tax (GST ₹)</Text>
                <GlassInput
                  value={form.taxAmount}
                  onChangeText={(t) => updateField('taxAmount', t.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 414"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Grand Total (₹) *</Text>
                <GlassInput
                  value={form.totalAmount}
                  onChangeText={(t) => updateField('totalAmount', t.replace(/[^0-9.]/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 2714"
                />
              </View>
            </View>
          </GlassCard>

          {/* CARD 4: NEXT SERVICE SCHEDULE */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>4. Next Service Schedule</Text>
            <Text style={styles.cardSub}>Recommended next service due milestone</Text>

            <View style={styles.rowTwoCol}>
              <View style={[styles.fieldItem, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Next Service Date</Text>
                <GlassInput
                  value={form.nextServiceDueDate}
                  onChangeText={(t) => updateField('nextServiceDueDate', t)}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={[styles.fieldItem, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Next Service KM</Text>
                <GlassInput
                  value={form.nextServiceDueKm}
                  onChangeText={(t) => updateField('nextServiceDueKm', t.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 15000"
                />
              </View>
            </View>
          </GlassCard>

          {/* CARD 5: VEHICLE LINKING */}
          {vehicles.length > 0 ? (
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>5. Link to Vehicle Passport</Text>
              <Text style={styles.cardSub}>Attach this service bill to your vehicle in vault</Text>

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
            title="Save Service Bill"
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
    color: '#3B82F6',
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
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  vehicleOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  vehicleOptionTitleSelected: {
    color: '#60A5FA',
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
    borderColor: '#3B82F6',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
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

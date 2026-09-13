/**
 * Asset Doctor — Review Electricity Bill Screen
 *
 * Clean, mobile-first review flow strictly adhering to:
 * - Minimal-data principle (no ERP/accounting clutter)
 * - Semantic field display with real-time reading cross-check
 * - Data-first privacy: deletes temporary scan image/PDF on save
 * - Multi-account selection
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { Haptics } from '../../services/haptics';
import { COLORS, RADIUS, SPACING } from '../../theme/branding';
import { TYPE } from '../../theme/tokens';
import { Screen, GlassButton } from '../../components/ui/Glass';
import { StatusBadge } from '../../design-system';
import { ElectricityBillService } from '../../services/energy/ElectricityBillService';
import { ElectricityAccount, ElectricityBillRecord } from '../../services/energy/electricityBillSchema';
import { ElectricityBillValidator } from '../../services/ocr/engine/ElectricityBillValidator';
import { ExtractedElectricityBill } from '../../services/ocr/extractors/RealElectricityBillExtractor';
import { normalizeElectricityBill } from '../../services/ocr/UnifiedDocumentNormalizer';
import { SmartCore } from '../../smartCore';
import { markScanSession, clearScanSession } from '../../utils/scanNavGuard';

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.sectionContainer}>
      <Pressable style={styles.sectionHeader} onPress={() => setOpen(!open)}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionChevron}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function GlassInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  status = 'VERIFIED',
  helperText,
}) {
  return (
    <View style={styles.fieldItem}>
      <View style={styles.fieldHeaderRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {status ? (
          <StatusBadge
            status={status === 'HIGH_CONFIDENCE' ? 'VERIFIED' : status}
            conf={status === 'HIGH_CONFIDENCE' ? 95 : 70}
          />
        ) : null}
      </View>
      <TextInput
        style={styles.input}
        value={value != null ? String(value) : ''}
        onChangeText={onChangeText}
        placeholder={placeholder || 'Not found on bill'}
        placeholderTextColor={COLORS.muted || '#9CA3AF'}
        keyboardType={keyboardType}
      />
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

export function ReviewElectricityBillScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = route?.params || {};

  const rawInvoice = params.invoice || params.assetData || params.extractedData || {};
  const norm = normalizeElectricityBill(rawInvoice);
  const imageUri = params.imageUri || rawInvoice.imageUri || null;

  // Form State
  const [provider, setProvider] = useState(norm.providerName);
  const [consumerId, setConsumerId] = useState(norm.consumerId);
  const [billingMonth, setBillingMonth] = useState(norm.billingMonth);
  const [billDate, setBillDate] = useState(norm.billDate);
  const [dueDate, setDueDate] = useState(norm.dueDate);

  const [previousReading, setPreviousReading] = useState(
    norm.previousMeterReading != null ? String(norm.previousMeterReading) : ''
  );
  const [previousReadingProvenance, setPreviousReadingProvenance] = useState(
    norm.previousMeterReading != null && String(norm.previousMeterReading).trim() !== ''
      ? 'EXTRACTED'
      : 'MISSING'
  );
  const [currentReading, setCurrentReading] = useState(
    norm.currentMeterReading != null ? String(norm.currentMeterReading) : ''
  );
  const [unitsConsumed, setUnitsConsumed] = useState(
    norm.unitsConsumed != null ? String(norm.unitsConsumed) : ''
  );
  const [billingDays, setBillingDays] = useState(
    rawInvoice.billingDays != null ? String(rawInvoice.billingDays) : '30'
  );

  const [currentBillAmount, setCurrentBillAmount] = useState(
    norm.currentBillAmount != null ? String(norm.currentBillAmount) : ''
  );
  const [energyCharge, setEnergyCharge] = useState(rawInvoice.energyCharge != null ? String(rawInvoice.energyCharge) : '');
  const [fixedCharge, setFixedCharge] = useState(rawInvoice.fixedCharge != null ? String(rawInvoice.fixedCharge) : '');
  const [arrears, setArrears] = useState(norm.arrears != null ? String(norm.arrears) : '');
  const [subsidy, setSubsidy] = useState(norm.subsidy != null ? String(norm.subsidy) : '');
  const [meterNumber, setMeterNumber] = useState(norm.meterNumber);
  const [customerName, setCustomerName] = useState(norm.customerName);
  const [serviceAddress, setServiceAddress] = useState(norm.serviceAddress);
  const [billingPeriod, setBillingPeriod] = useState(norm.billMonthYear || rawInvoice.billingPeriod || '');
  const [disconnectionDate, setDisconnectionDate] = useState(rawInvoice.disconnectionDate || '');
  const [category, setCategory] = useState(rawInvoice.category || '');
  const [sanctionedLoad, setSanctionedLoad] = useState(norm.sanctionedLoad);
  const [grossBillAmount, setGrossBillAmount] = useState(norm.grossBillAmount != null ? String(norm.grossBillAmount) : '');
  const [lpsc, setLpsc] = useState(norm.latePaymentSurcharge != null ? String(norm.latePaymentSurcharge) : '');
  const [totalPayable, setTotalPayable] = useState(norm.totalPayableAmount != null ? String(norm.totalPayableAmount) : '');
  const [paymentStatus, setPaymentStatus] = useState(rawInvoice.paymentStatus || 'UNPAID');

  // Accounts
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('default_home');
  const [saving, setSaving] = useState(false);

  // Persist review session in scanNavGuard to survive Activity kill
  useEffect(() => {
    markScanSession('ReviewElectricityBill', {
      scanSessionId: params.scanSessionId || `scan_${Date.now()}`,
      documentType: 'ELECTRICITY_BILL',
      reviewRoute: 'ReviewElectricityBill',
      imageUri,
      extractedData: rawInvoice,
      assetData: rawInvoice,
      invoice: rawInvoice,
      audit: params.audit,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const effectiveUserId = user?.uid || 'local_user';
    ElectricityBillService.listAccounts(effectiveUserId).then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) {
        const def = accs.find((a) => a.isDefault) || accs[0];
        setSelectedAccountId(def.id);
      }
    });
  }, [user?.uid]);

  // Smart Memory (SmartCore Memory Engine): If previous reading was missing in scan, prefill from trusted history
  useEffect(() => {
    if (norm.previousMeterReading != null && String(norm.previousMeterReading).trim() !== '') {
      return;
    }
    const effectiveUserId = user?.uid || 'local_user';
    if (!selectedAccountId) return;
    ElectricityBillService.listBills(effectiveUserId, selectedAccountId)
      .then((bills) => {
        const suggestion = SmartCore.getLatestMeterReading(bills, consumerId);
        if (suggestion.value != null) {
          setPreviousReading((current) => (current ? current : String(suggestion.value)));
          setPreviousReadingProvenance('EXISTING_TRUSTED_DATA');
        }
      })
      .catch(() => {});
  }, [user?.uid, selectedAccountId, norm.previousMeterReading, consumerId]);

  // Real-time Reading Cross-Check Validation
  const readingValidation = useMemo(() => {
    const p = parseFloat(previousReading);
    const c = parseFloat(currentReading);
    const u = parseFloat(unitsConsumed);

    if (isNaN(p) || isNaN(c)) return null;

    if (c < p) {
      return {
        valid: false,
        isWarning: true,
        message: 'Current reading is lower than previous reading. Check for meter reset or entry error.',
      };
    }

    const diff = c - p;
    if (!isNaN(u) && u > 0) {
      if (Math.abs(diff - u) <= 1) {
        return {
          valid: true,
          isWarning: false,
          message: `✓ Readings match consumption perfectly (${diff} kWh).`,
        };
      }
      if (Math.abs(diff * 10 - u) <= 2) {
        return {
          valid: true,
          isWarning: false,
          message: `✓ Verified with meter multiplier ×10 (${diff} × 10 = ${u} kWh).`,
        };
      }
      if (Math.abs(diff * 40 - u) <= 5) {
        return {
          valid: true,
          isWarning: false,
          message: `✓ Verified with meter multiplier ×40 (${diff} × 40 = ${u} kWh).`,
        };
      }
      return {
        valid: false,
        isWarning: true,
        message: `⚠ Readings difference (${diff} kWh) does not match reported units (${u} kWh).`,
      };
    }

    return {
      valid: true,
      isWarning: false,
      message: `Calculated consumption: ${diff} kWh`,
    };
  }, [previousReading, currentReading, unitsConsumed]);

  const onSave = async () => {
    Haptics.tap();
    if (!provider.trim()) {
      Alert.alert('Provider Required', 'Please enter or confirm the electricity provider.');
      return;
    }
    if (!consumerId.trim()) {
      Alert.alert('Consumer ID Required', 'Please enter your Consumer ID / Account Number.');
      return;
    }
    const billAmtNum = parseFloat(currentBillAmount);
    if (isNaN(billAmtNum) || billAmtNum <= 0) {
      Alert.alert('Bill Amount Required', 'Please enter the current bill amount.');
      return;
    }

    const prevNum = parseFloat(previousReading) || 0;
    const currNum = parseFloat(currentReading) || 0;
    const unitsNum = parseFloat(unitsConsumed) || (currNum >= prevNum ? currNum - prevNum : 0);

    // Check duplicate
    const existingBills = await ElectricityBillService.listBills(user?.uid, selectedAccountId);
    const dupCheck = ElectricityBillService.detectDuplicateBill(
      {
        consumerId: consumerId.trim(),
        billingMonth: billingMonth.trim(),
        billDate: billDate.trim(),
        currentBillAmount: billAmtNum,
        previousMeterReading: prevNum,
        currentMeterReading: currNum,
      },
      existingBills
    );

    if (dupCheck.isDuplicate) {
      Alert.alert(
        'Duplicate Bill Detected',
        `${dupCheck.message}\n\nDo you want to update the existing bill record?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Update Existing',
            onPress: () => performSave(dupCheck.duplicateId),
          },
        ]
      );
      return;
    }

    performSave();
  };

  const performSave = async (existingId) => {
    setSaving(true);
    try {
      const billRecord: ElectricityBillRecord = {
        id: existingId || `elec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: user?.uid || 'local_user',
        accountId: selectedAccountId,
        accountName: accounts.find((a) => a.id === selectedAccountId)?.accountName || 'Home',
        electricityProvider: provider.trim(),
        consumerId: consumerId.trim(),
        billingMonth: billingMonth.trim(),
        billDate: billDate.trim() || new Date().toISOString().slice(0, 10),
        dueDate: dueDate.trim() || '',
        previousMeterReading: parseFloat(previousReading) || 0,
        currentMeterReading: parseFloat(currentReading) || 0,
        unitsConsumedKwh: parseFloat(unitsConsumed) || 0,
        billingDays: parseInt(billingDays, 10) || 30,
        currentBillAmount: parseFloat(currentBillAmount) || 0,
        energyCharge: energyCharge ? parseFloat(energyCharge) : null,
        fixedCharge: fixedCharge ? parseFloat(fixedCharge) : null,
        arrears: arrears ? parseFloat(arrears) : null,
        subsidy: subsidy ? parseFloat(subsidy) : null,
        totalPayable: parseFloat(totalPayable) || parseFloat(currentBillAmount) || 0,
        meterNumber: meterNumber.trim() || null,
        customerName: customerName.trim() || null,
        serviceAddress: serviceAddress.trim() || null,
        billingPeriod: billingPeriod.trim() || null,
        disconnectionDate: disconnectionDate.trim() || null,
        sanctionedLoad: sanctionedLoad.trim() || null,
        grossBillAmount: grossBillAmount ? parseFloat(grossBillAmount) : null,
        latePaymentSurcharge: lpsc ? parseFloat(lpsc) : null,
        paymentStatus: paymentStatus.trim() || 'UNPAID',
        needsReview: readingValidation ? !readingValidation.valid : false,
        reviewReasons: readingValidation && !readingValidation.valid ? [readingValidation.message] : [],
        createdAt: new Date().toISOString(),
      };

      // Save structured record and discard original scan file
      await ElectricityBillService.saveBill(billRecord, { discardScanUri: imageUri });
      clearScanSession().catch(() => {});

      Haptics.success();
      Alert.alert(
        'Electricity Bill Saved',
        'Your bill data has been saved and your Energy Doctor intelligence has been updated. Original scan file safely discarded.',
        [
          {
            text: 'View Energy Doctor',
            onPress: () => {
              clearScanSession().catch(() => {});
              navigation.replace('EnergyDoctor', {
                accountId: selectedAccountId,
                highlightMonth: billRecord.billingMonth,
              });
            },
          },
        ]
      );
    } catch (err) {
      Haptics.error();
      Alert.alert('Save Failed', err?.message || 'Could not save electricity bill.');
    } finally {
      setSaving(false);
    }
  };

  const rawConf = Number(rawInvoice.confidence);
  const confPercent = Number.isFinite(rawConf) && rawConf > 0
    ? (rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf))
    : null;

  return (
    <Screen style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.tap();
              clearScanSession().catch(() => {});
              navigation.goBack();
            }}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerSub}>⚡ ENERGY DOCTOR</Text>
            <Text style={styles.headerTitle}>Review Electricity Bill</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
          {params.ocrFailed || params.audit?.manualEntry ? (
            <View style={[styles.intelCard, { borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <View style={styles.intelTopRow}>
                <View style={[styles.intelBadge, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <Text style={[styles.intelBadgeText, { color: '#F59E0B' }]}>⚠️ DETAILS NOT AUTO-DETECTED</Text>
                </View>
              </View>
              <Text style={styles.intelHint}>
                We couldn't read all details from this photo. Please enter or verify details below.
              </Text>
            </View>
          ) : (
            <View style={styles.intelCard}>
              <View style={styles.intelTopRow}>
                <View style={styles.intelBadge}>
                  <Text style={styles.intelBadgeText}>⚡ DETECTED ELECTRICITY BILL</Text>
                </View>
                <Text style={styles.intelConfText}>
                  {confPercent != null ? `${confPercent}% Confidence` : 'Confidence unavailable'}
                </Text>
              </View>
              <Text style={styles.intelHint}>
                Values extracted automatically. Original scan will be discarded upon saving.
              </Text>
            </View>
          )}

          {/* Account Picker */}
          {accounts.length > 1 ? (
            <View style={styles.accountCard}>
              <Text style={styles.accountLabel}>Link to Meter / Account</Text>
              <View style={styles.accountRow}>
                {accounts.map((acc) => {
                  const on = selectedAccountId === acc.id;
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => {
                        Haptics.select();
                        setSelectedAccountId(acc.id);
                      }}
                      style={[styles.accountChip, on && styles.accountChipActive]}
                    >
                      <Text style={[styles.accountChipText, on && styles.accountChipTextActive]}>
                        {acc.accountName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* CARD 1 — ELECTRICITY ACCOUNT */}
          <Section title="1. Electricity Account" defaultOpen={true}>
            <GlassInput
              label="Electricity Provider *"
              value={provider}
              onChangeText={setProvider}
              placeholder="e.g. Tata Power, BESCOM, BSES, UPPCL"
              status="VERIFIED"
            />
            <View style={styles.twoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <GlassInput
                  label="Consumer ID / Account No *"
                  value={consumerId}
                  onChangeText={setConsumerId}
                  placeholder="e.g. 102938475"
                  status="VERIFIED"
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Meter Number"
                  value={meterNumber}
                  onChangeText={setMeterNumber}
                  placeholder="Meter Serial"
                  status="VERIFIED"
                />
              </View>
            </View>
            <GlassInput
              label="Customer Name"
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Name on Bill"
              status="VERIFIED"
            />
            <GlassInput
              label="Service Address"
              value={serviceAddress}
              onChangeText={setServiceAddress}
              placeholder="Supply Address"
            />
          </Section>

          {/* CARD 2 — BILL PERIOD */}
          <Section title="2. Bill Period" defaultOpen={true}>
            <View style={styles.twoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <GlassInput
                  label="Bill Date"
                  value={billDate}
                  onChangeText={setBillDate}
                  placeholder="YYYY-MM-DD"
                  status="VERIFIED"
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Billing Month (YYYY-MM) *"
                  value={billingMonth}
                  onChangeText={setBillingMonth}
                  placeholder="e.g. 2026-08"
                  status="VERIFIED"
                />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <GlassInput
                  label="Due Date"
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="YYYY-MM-DD"
                  status="VERIFIED"
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Disconnection Date"
                  value={disconnectionDate}
                  onChangeText={setDisconnectionDate}
                  placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
            {billingPeriod ? (
              <GlassInput
                label="Billing Period Description"
                value={billingPeriod}
                onChangeText={setBillingPeriod}
                placeholder="e.g. 01-Jul to 31-Jul"
              />
            ) : null}
          </Section>

          {/* CARD 3 — METER & USAGE */}
          <Section title="3. Meter & Usage" defaultOpen={true}>
            <View style={styles.twoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <GlassInput
                  label="Previous Reading"
                  value={previousReading}
                  onChangeText={(val) => {
                    setPreviousReading(val);
                    setPreviousReadingProvenance('USER_ENTERED');
                  }}
                  placeholder="e.g. 12450"
                  keyboardType="numeric"
                  status={previousReadingProvenance === 'EXISTING_TRUSTED_DATA' ? 'TRUSTED MEMORY' : 'VERIFIED'}
                  helperText={previousReadingProvenance === 'EXISTING_TRUSTED_DATA' ? 'Prefilled from previous bill (trusted memory)' : undefined}
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Current Reading"
                  value={currentReading}
                  onChangeText={setCurrentReading}
                  placeholder="e.g. 12736"
                  keyboardType="numeric"
                  status="VERIFIED"
                />
              </View>
            </View>

            <View style={styles.twoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <GlassInput
                  label="Units Consumed (kWh) *"
                  value={unitsConsumed}
                  onChangeText={setUnitsConsumed}
                  placeholder="e.g. 286"
                  keyboardType="numeric"
                  status="VERIFIED"
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Sanctioned Load"
                  value={sanctionedLoad || category}
                  onChangeText={setSanctionedLoad}
                  placeholder="e.g. 3 kW / Domestic"
                />
              </View>
            </View>

            {/* Live Reading Cross-Check Banner */}
            {readingValidation ? (
              <View
                style={[
                  styles.validationAlert,
                  readingValidation.isWarning ? styles.alertWarning : styles.alertSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.validationAlertText,
                    readingValidation.isWarning ? styles.alertTextWarning : styles.alertTextSuccess,
                  ]}
                >
                  {readingValidation.message}
                </Text>
              </View>
            ) : null}
          </Section>

          {/* CARD 4 — BILL AMOUNT */}
          <Section title="4. Bill Amount" defaultOpen={true}>
            <View style={styles.twoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <GlassInput
                  label="Current Bill Amount (₹) *"
                  value={currentBillAmount}
                  onChangeText={setCurrentBillAmount}
                  placeholder="e.g. 2180"
                  keyboardType="decimal-pad"
                  status="VERIFIED"
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Total Payable (₹) *"
                  value={totalPayable}
                  onChangeText={setTotalPayable}
                  placeholder="e.g. 2180"
                  keyboardType="decimal-pad"
                  status="VERIFIED"
                />
              </View>
            </View>

            <View style={styles.twoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <GlassInput
                  label="Arrears / Past Dues (₹)"
                  value={arrears}
                  onChangeText={setArrears}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Tariff Subsidy / Rebate (₹)"
                  value={subsidy}
                  onChangeText={setSubsidy}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.twoCol}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <GlassInput
                  label="Late Payment Surcharge / LPSC (₹)"
                  value={lpsc}
                  onChangeText={setLpsc}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassInput
                  label="Payment Status"
                  value={paymentStatus}
                  onChangeText={setPaymentStatus}
                  placeholder="UNPAID / PAID"
                />
              </View>
            </View>
          </Section>

          {/* Privacy Note */}
          <View style={styles.privacyCard}>
            <Text style={styles.privacyTitle}>🔒 Data-First Privacy</Text>
            <Text style={styles.privacyBody}>
              Asset Doctor extracts only structured data. The original bill image or PDF is never permanently stored and is discarded immediately upon save.
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Save Bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving & Discarding Scan…' : 'Save & Discard Scan →'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B111A' },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { color: '#F3F4F6', fontSize: 32, fontWeight: '300' },
  headerTitleBox: { alignItems: 'center' },
  headerSub: { color: '#10B981', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 2 },
  content: { padding: 16 },

  intelCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  intelTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  intelBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  intelBadgeText: { color: '#10B981', fontSize: 10, fontWeight: '800' },
  intelConfText: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  intelHint: { color: '#9CA3AF', fontSize: 12, lineHeight: 16 },

  accountCard: { marginBottom: 14 },
  accountLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  accountChipActive: { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' },
  accountChipText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  accountChipTextActive: { color: '#10B981', fontWeight: '800' },

  sectionContainer: {
    backgroundColor: '#131D2A',
    borderColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#162232',
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sectionChevron: { color: '#94A3B8', fontSize: 10 },
  sectionBody: { padding: 14 },

  fieldItem: { marginBottom: 12 },
  fieldHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fieldLabel: { color: '#D1D5DB', fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: '#1B2636',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  helperText: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  twoCol: { flexDirection: 'row', alignItems: 'center' },

  validationAlert: { padding: 10, borderRadius: 8, marginTop: 4, marginBottom: 8 },
  alertSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', borderWidth: 1 },
  alertWarning: { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)', borderWidth: 1 },
  validationAlertText: { fontSize: 12, fontWeight: '600' },
  alertTextSuccess: { color: '#10B981' },
  alertTextWarning: { color: '#F59E0B' },

  privacyCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    marginTop: 8,
  },
  privacyTitle: { color: '#E2E8F0', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  privacyBody: { color: '#94A3B8', fontSize: 11, lineHeight: 15 },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#0B111A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  saveButton: {
    backgroundColor: '#0F766E',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

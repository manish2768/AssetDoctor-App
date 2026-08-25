/**
 * OCR Diagnostic & Developer Test Mode Screen
 * Internal tool for testing and inspecting the full OCR pipeline:
 * IMAGE -> RAW OCR -> EXTRACTION -> NORMALIZATION -> VALIDATION -> FINAL MAPPING -> PERSISTENCE
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, GlassCard, GlassButton } from '../../components/ui/Glass';
import { COLORS, SPACING, BRAND } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { captureDocumentImage, pickGalleryImage } from '../../services/ocr/DocumentScannerService';
import {
  SAMPLE_FIXTURES,
  runOcrDiagnosticTrace,
  loadDiagnosticHistory,
  clearDiagnosticHistory,
  saveAsBaseline,
  loadBaseline,
  formatDiagnosticReport,
} from '../../services/ocr/ocrDiagnosticService';

const DOC_TYPES = [
  { id: 'SERVICE_BILL', label: 'Service Bill' },
  { id: 'INSURANCE', label: 'Insurance' },
  { id: 'VEHICLE_INVOICE', label: 'Vehicle Invoice' },
  { id: 'REGISTRATION_RC', label: 'RC / Plate' },
  { id: 'WARRANTY', label: 'Warranty' },
  { id: 'OTHER', label: 'Other' },
];

export function OcrDiagnosticScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState('SERVICE_BILL');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [activeTab, setActiveTab] = useState('pipeline'); // 'pipeline' | 'odometer' | 'insurance' | 'bh_series' | 'compare'
  const [historyModal, setHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [baselineData, setBaselineData] = useState(null);
  const [exportModal, setExportModal] = useState(false);
  const [fixtureModal, setFixtureModal] = useState(false);

  // Load baseline on mount
  useEffect(() => {
    loadBaseline().then((b) => setBaselineData(b)).catch(() => {});
  }, []);

  // Execute diagnostic on a given input (image URI or fixture object)
  const runDiagnostic = useCallback(async (input, typeHint) => {
    setLoading(true);
    setLoadingMsg('Running OCR Diagnostic Pipeline…');
    try {
      Haptics.tap();
      const result = await runOcrDiagnosticTrace(input, { docTypeHint: typeHint || selectedType });
      setDiagnosticData(result);
      Haptics.success();
    } catch (error) {
      console.error('[OcrDiagnostic] Trace failed:', error);
      Alert.alert('Diagnostic Failed', error?.message || 'Could not process document.');
      Haptics.error();
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }, [selectedType]);

  // Handle Camera Capture
  const onCaptureCamera = async () => {
    try {
      Haptics.tap();
      const uri = await captureDocumentImage();
      if (uri) {
        await runDiagnostic(uri, selectedType);
      }
    } catch (e) {
      Alert.alert('Camera Error', e?.message || 'Failed to capture image.');
    }
  };

  // Handle Gallery Pick
  const onPickGallery = async () => {
    try {
      Haptics.tap();
      const uri = await pickGalleryImage();
      if (uri) {
        await runDiagnostic(uri, selectedType);
      }
    } catch (e) {
      Alert.alert('Gallery Error', e?.message || 'Failed to pick image.');
    }
  };

  // Load Test History
  const onOpenHistory = async () => {
    const list = await loadDiagnosticHistory();
    setHistoryList(list);
    setHistoryModal(true);
  };

  // Clear History
  const onClearHistory = async () => {
    Alert.alert('Clear History', 'Delete all stored test history on this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearDiagnosticHistory();
          setHistoryList([]);
          setHistoryModal(false);
          Haptics.success();
        },
      },
    ]);
  };

  // Save Baseline
  const onSaveBaseline = async () => {
    if (!diagnosticData) return;
    const ok = await saveAsBaseline(diagnosticData);
    if (ok) {
      setBaselineData(diagnosticData);
      Alert.alert('Baseline Saved', 'Current test run saved as comparison baseline.');
      Haptics.success();
    }
  };

  // Export Report
  const onExportReport = async () => {
    if (!diagnosticData) return;
    const reportText = formatDiagnosticReport(diagnosticData);
    try {
      await Share.share({
        message: reportText,
        title: 'Asset Doctor — OCR Diagnostic Report',
      });
    } catch (e) {
      Alert.alert('Export Failed', e?.message || 'Could not share report.');
    }
  };

  return (
    <Screen style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>🛠️ DEV / TEST MODE</Text>
            </View>
            <Text style={styles.appVer}>v1.0-diag</Text>
          </View>
          <Text style={styles.headerTitle}>OCR Diagnostic</Text>
          <Text style={styles.headerSub}>Inspect pipeline stages & verification</Text>
        </View>
        <Pressable
          onPress={() => navigation?.goBack?.()}
          style={styles.closeBtn}
          hitSlop={12}
        >
          <Text style={styles.closeBtnText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Document Type Selector Chips */}
        <Text style={styles.sectionLabel}>TARGET DOCUMENT TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {DOC_TYPES.map((dt) => {
            const isSel = selectedType === dt.id;
            return (
              <Pressable
                key={dt.id}
                onPress={() => {
                  Haptics.select();
                  setSelectedType(dt.id);
                }}
                style={[styles.chip, isSel && styles.chipActive]}
              >
                <Text style={[styles.chipText, isSel && styles.chipTextActive]}>{dt.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Action Buttons Grid */}
        <View style={styles.actionGrid}>
          <GlassButton
            title="📸 Scan Document"
            onPress={onCaptureCamera}
            loading={loading}
            style={styles.actionBtn}
          />
          <GlassButton
            title="🖼️ Select Image"
            variant="ghost"
            onPress={onPickGallery}
            loading={loading}
            style={styles.actionBtn}
          />
        </View>

        <View style={styles.secondaryActionRow}>
          <Pressable
            style={styles.secBtn}
            onPress={() => setFixtureModal(true)}
          >
            <Text style={styles.secBtnText}>⚡ Load Sample Fixtures</Text>
          </Pressable>
          <Pressable
            style={styles.secBtn}
            onPress={onOpenHistory}
          >
            <Text style={styles.secBtnText}>📋 History</Text>
          </Pressable>
        </View>

        {loading && (
          <GlassCard style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.emerald} size="large" />
            <Text style={styles.loadingText}>{loadingMsg || 'Processing document…'}</Text>
          </GlassCard>
        )}

        {diagnosticData && !loading && (
          <>
            {/* Summary Statistics Card */}
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.summaryTitle}>
                    {diagnosticData.finalMapping?.documentType?.toUpperCase() || 'DOCUMENT'} TRACE
                  </Text>
                  <Text style={styles.summaryMeta}>
                    {diagnosticData.imageMeta?.source} • {diagnosticData.durationMs}ms • {diagnosticData.charCount} chars
                  </Text>
                </View>
                <View style={styles.statsPillRow}>
                  <View style={[styles.statPill, { backgroundColor: '#05966922' }]}>
                    <Text style={[styles.statPillText, { color: COLORS.emerald }]}>
                      {diagnosticData.stats.pass} PASS
                    </Text>
                  </View>
                  {diagnosticData.stats.fail > 0 && (
                    <View style={[styles.statPill, { backgroundColor: '#DC262622' }]}>
                      <Text style={[styles.statPillText, { color: '#EF4444' }]}>
                        {diagnosticData.stats.fail} FAIL
                      </Text>
                    </View>
                  )}
                  {diagnosticData.stats.warning > 0 && (
                    <View style={[styles.statPill, { backgroundColor: '#D9770622' }]}>
                      <Text style={[styles.statPillText, { color: '#F59E0B' }]}>
                        {diagnosticData.stats.warning} WARN
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.summaryActionRow}>
                <Pressable style={styles.smallActionBtn} onPress={onSaveBaseline}>
                  <Text style={styles.smallActionText}>💾 Save as Baseline</Text>
                </Pressable>
                <Pressable style={styles.smallActionBtn} onPress={onExportReport}>
                  <Text style={styles.smallActionText}>📤 Export Report</Text>
                </Pressable>
              </View>
            </GlassCard>

            {/* Diagnostic Mode Tab Selector */}
            <View style={styles.tabBar}>
              <Pressable
                onPress={() => setActiveTab('pipeline')}
                style={[styles.tabItem, activeTab === 'pipeline' && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, activeTab === 'pipeline' && styles.tabTextActive]}>
                  7-Stage Pipeline
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('odometer')}
                style={[styles.tabItem, activeTab === 'odometer' && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, activeTab === 'odometer' && styles.tabTextActive]}>
                  Odometer
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('insurance')}
                style={[styles.tabItem, activeTab === 'insurance' && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, activeTab === 'insurance' && styles.tabTextActive]}>
                  Insurance
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('bh_series')}
                style={[styles.tabItem, activeTab === 'bh_series' && styles.tabItemActive]}
              >
                <Text style={[styles.tabText, activeTab === 'bh_series' && styles.tabTextActive]}>
                  BH Series
                </Text>
              </Pressable>
              {baselineData && (
                <Pressable
                  onPress={() => setActiveTab('compare')}
                  style={[styles.tabItem, activeTab === 'compare' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabText, activeTab === 'compare' && styles.tabTextActive]}>
                    ⚖️ Compare
                  </Text>
                </Pressable>
              )}
            </View>

            {/* TAB 1: 7-STAGE PIPELINE TRACE */}
            {activeTab === 'pipeline' && (
              <View style={styles.tabContent}>
                {/* STEP 1: IMAGE */}
                <GlassCard style={styles.stageCard}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>STEP 1</Text>
                    <Text style={styles.stageTitle}>IMAGE PREVIEW & INPUT</Text>
                  </View>
                  {diagnosticData.imageMeta?.uri ? (
                    <Image
                      source={{ uri: diagnosticData.imageMeta.uri }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.metaNote}>Input: Text Fixture ({diagnosticData.imageMeta?.source})</Text>
                  )}
                  <Text style={styles.metaSub}>Engine: {diagnosticData.imageMeta?.ocrEngine}</Text>
                </GlassCard>

                {/* STEP 2: RAW OCR TEXT */}
                <GlassCard style={styles.stageCard}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>STEP 2</Text>
                    <Text style={styles.stageTitle}>RAW OCR TEXT (UNMODIFIED)</Text>
                  </View>
                  <Text style={styles.rawTextSample} numberOfLines={12}>
                    {diagnosticData.rawOcrText}
                  </Text>
                  <Pressable
                    style={styles.copyRawBtn}
                    onPress={async () => {
                      try {
                        await Share.share({ message: diagnosticData.rawOcrText, title: 'Raw OCR Text' });
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <Text style={styles.copyRawText}>📤 Share Raw OCR ({diagnosticData.charCount} chars)</Text>
                  </Pressable>
                </GlassCard>

                {/* STEP 3: EXTRACTED FIELDS */}
                <GlassCard style={styles.stageCard}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>STEP 3</Text>
                    <Text style={styles.stageTitle}>EXTRACTED FIELDS</Text>
                  </View>
                  <View style={styles.fieldGrid}>
                    <FieldRow label="Registration" value={diagnosticData.finalMapping.registration} />
                    <FieldRow
                      label="Odometer"
                      value={diagnosticData.finalMapping.odometerKm != null ? `${diagnosticData.finalMapping.odometerKm} KM` : null}
                    />
                    <FieldRow label="Invoice #" value={diagnosticData.finalMapping.invoiceNumber} />
                    <FieldRow label="Date" value={diagnosticData.finalMapping.purchaseDate} />
                    <FieldRow label="Workshop / Seller" value={diagnosticData.finalMapping.sellerName} />
                    <FieldRow label="Customer / Buyer" value={diagnosticData.finalMapping.buyerName} />
                    <FieldRow label="Make / Model" value={diagnosticData.finalMapping.productName} />
                    <FieldRow
                      label="Total Amount"
                      value={diagnosticData.finalMapping.totalAmount != null ? `₹ ${diagnosticData.finalMapping.totalAmount}` : null}
                    />
                  </View>
                </GlassCard>

                {/* STEP 4: NORMALIZATION */}
                <GlassCard style={styles.stageCard}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>STEP 4</Text>
                    <Text style={styles.stageTitle}>NORMALIZATION TRACE (RAW → NORMALIZED)</Text>
                  </View>
                  {diagnosticData.normalizations.length === 0 ? (
                    <Text style={styles.emptyText}>No transformation required for extracted tokens.</Text>
                  ) : (
                    diagnosticData.normalizations.map((norm, idx) => (
                      <View key={idx} style={styles.normRow}>
                        <Text style={styles.normLabel}>{norm.label}</Text>
                        <View style={styles.normDiff}>
                          <Text style={styles.normRaw}>"{norm.raw}"</Text>
                          <Text style={styles.normArrow}> → </Text>
                          <Text style={styles.normFinal}>"{norm.normalized}"</Text>
                        </View>
                      </View>
                    ))
                  )}
                </GlassCard>

                {/* STEP 5: VALIDATION */}
                <GlassCard style={styles.stageCard}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>STEP 5</Text>
                    <Text style={styles.stageTitle}>VALIDATION RESULTS</Text>
                  </View>
                  {diagnosticData.validations.map((v, idx) => {
                    const isPass = v.status === 'PASS';
                    const isFail = v.status === 'FAIL';
                    return (
                      <View key={idx} style={styles.valRow}>
                        <View style={styles.valLeft}>
                          <Text style={styles.valField}>{v.field}</Text>
                          <Text style={styles.valValue}>{v.value || '—'}</Text>
                          <Text style={styles.valMsg}>{v.message}</Text>
                        </View>
                        <View
                          style={[
                            styles.valBadge,
                            isPass ? styles.valPass : isFail ? styles.valFail : styles.valWarn,
                          ]}
                        >
                          <Text
                            style={[
                              styles.valBadgeText,
                              { color: isPass ? COLORS.emerald : isFail ? '#EF4444' : '#F59E0B' },
                            ]}
                          >
                            {isPass ? '✅ PASS' : isFail ? '❌ FAIL' : '⚠️ WARN'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </GlassCard>

                {/* STEP 6: FINAL REVIEW MAPPING */}
                <GlassCard style={styles.stageCard}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>STEP 6</Text>
                    <Text style={styles.stageTitle}>FINAL MAPPING TO REVIEW SCREEN</Text>
                  </View>
                  <Text style={styles.jsonText}>
                    {JSON.stringify(diagnosticData.finalMapping, null, 2)}
                  </Text>
                </GlassCard>

                {/* STEP 7: PERSISTENCE CHECK */}
                <GlassCard style={styles.stageCard}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>STEP 7</Text>
                    <Text style={styles.stageTitle}>PERSISTENCE STATUS</Text>
                  </View>
                  <View style={styles.persistRow}>
                    <Text style={styles.persistLabel}>Can Save Directly:</Text>
                    <Text
                      style={[
                        styles.persistVal,
                        { color: diagnosticData.persistenceCheck.canSaveDirectly ? COLORS.emerald : '#EF4444' },
                      ]}
                    >
                      {diagnosticData.persistenceCheck.canSaveDirectly ? '✅ READY TO PERSIST' : '❌ BLOCKED'}
                    </Text>
                  </View>
                  <Text style={styles.persistSub}>
                    Saved Keys: {diagnosticData.persistenceCheck.savedFields.join(', ')}
                  </Text>
                </GlassCard>
              </View>
            )}

            {/* TAB 2: CRITICAL ODOMETER DIAGNOSTIC */}
            {activeTab === 'odometer' && (
              <View style={styles.tabContent}>
                <GlassCard style={styles.stageCard}>
                  <Text style={styles.specialTitle}>🔍 Odometer Candidate Scorer</Text>
                  <Text style={styles.specialLead}>
                    Inspects all numeric tokens near mileage labels and explains selection vs rejection.
                  </Text>

                  <View style={styles.odoSelectedCard}>
                    <Text style={styles.odoSelectedLabel}>SELECTED ODOMETER</Text>
                    <Text style={styles.odoSelectedValue}>
                      {diagnosticData.odometerAnalysis?.selected != null
                        ? `${diagnosticData.odometerAnalysis.selected} KM`
                        : 'No valid odometer found'}
                    </Text>
                    <Text style={styles.odoEvidence}>
                      Evidence: {diagnosticData.odometerAnalysis?.selectedEvidence}
                    </Text>
                  </View>

                  <Text style={[styles.sectionLabel, { marginTop: 16 }]}>FALSE-POSITIVE CANDIDATE REJECTIONS</Text>
                  {diagnosticData.odometerAnalysis?.falsePositiveRejections.map((rej, idx) => (
                    <View key={idx} style={styles.rejRow}>
                      <Text style={styles.rejCand}>`{rej.candidate}`</Text>
                      <Text style={styles.rejArrow}> → </Text>
                      <Text style={styles.rejLabel}>{rej.label} (Protected)</Text>
                      <Text style={styles.rejStatus}>✅ REJECTED</Text>
                    </View>
                  ))}
                </GlassCard>
              </View>
            )}

            {/* TAB 3: INSURANCE DIAGNOSTIC */}
            {activeTab === 'insurance' && (
              <View style={styles.tabContent}>
                <GlassCard style={styles.stageCard}>
                  <Text style={styles.specialTitle}>🛡️ Insurance Schedule Inspector</Text>
                  <Text style={styles.specialLead}>
                    RAW → EXTRACTED → NORMALIZED → VALIDATED → FINAL
                  </Text>

                  {diagnosticData.insuranceAnalysis ? (
                    Object.entries(diagnosticData.insuranceAnalysis).map(([key, val]) => (
                      <View key={key} style={styles.insRow}>
                        <Text style={styles.insField}>{key.toUpperCase()}</Text>
                        <Text style={styles.insRaw}>Raw: {val.raw || '—'}</Text>
                        <Text style={styles.insFinal}>Final: {val.normalized || '—'}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyText}>Not classified as an insurance document.</Text>
                  )}
                </GlassCard>
              </View>
            )}

            {/* TAB 4: BH SERIES DIAGNOSTIC */}
            {activeTab === 'bh_series' && (
              <View style={styles.tabContent}>
                <GlassCard style={styles.stageCard}>
                  <Text style={styles.specialTitle}>🇮🇳 Bharat (BH) Series Test Suite</Text>
                  <Text style={styles.specialLead}>
                    Validates standard, spaced, hyphenated, and lowercase BH plates.
                  </Text>

                  {diagnosticData.bhSuite?.map((bh, idx) => (
                    <View key={idx} style={styles.bhRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bhInput}>Input: "{bh.input}"</Text>
                        <Text style={styles.bhNorm}>Normalized: "{bh.normalized}"</Text>
                      </View>
                      <View style={[styles.valBadge, bh.status === 'PASS' ? styles.valPass : styles.valFail]}>
                        <Text style={[styles.valBadgeText, { color: bh.status === 'PASS' ? COLORS.emerald : '#EF4444' }]}>
                          {bh.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                </GlassCard>
              </View>
            )}

            {/* TAB 5: BEFORE / AFTER BASELINE COMPARISON */}
            {activeTab === 'compare' && baselineData && (
              <View style={styles.tabContent}>
                <GlassCard style={styles.stageCard}>
                  <Text style={styles.specialTitle}>⚖️ Before vs After Baseline Comparison</Text>
                  <Text style={styles.specialLead}>
                    Baseline Date: {new Date(baselineData.timestamp).toLocaleTimeString()}
                  </Text>

                  <View style={styles.compareGrid}>
                    <CompareRow
                      label="Registration"
                      before={baselineData.finalMapping?.registration}
                      after={diagnosticData.finalMapping?.registration}
                    />
                    <CompareRow
                      label="Odometer"
                      before={baselineData.finalMapping?.odometerKm}
                      after={diagnosticData.finalMapping?.odometerKm}
                    />
                    <CompareRow
                      label="Total Amount"
                      before={baselineData.finalMapping?.totalAmount}
                      after={diagnosticData.finalMapping?.totalAmount}
                    />
                    <CompareRow
                      label="Invoice Number"
                      before={baselineData.finalMapping?.invoiceNumber}
                      after={diagnosticData.finalMapping?.invoiceNumber}
                    />
                  </View>
                </GlassCard>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Preloaded Fixtures Modal */}
      <Modal visible={fixtureModal} transparent animationType="slide" onRequestClose={() => setFixtureModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFixtureModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Preloaded Indian Document</Text>
            <Text style={styles.modalLead}>Instant physical fixture OCR testing</Text>

            {SAMPLE_FIXTURES.map((fix) => (
              <Pressable
                key={fix.id}
                style={styles.fixtureItem}
                onPress={() => {
                  setFixtureModal(false);
                  runDiagnostic(fix, fix.type);
                }}
              >
                <Text style={styles.fixtureName}>{fix.name}</Text>
                <Text style={styles.fixtureType}>{fix.type}</Text>
              </Pressable>
            ))}

            <GlassButton title="Cancel" variant="ghost" onPress={() => setFixtureModal(false)} style={{ marginTop: 12 }} />
          </View>
        </Pressable>
      </Modal>

      {/* History Modal */}
      <Modal visible={historyModal} transparent animationType="slide" onRequestClose={() => setHistoryModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setHistoryModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Diagnostic Test History</Text>
              <Pressable onPress={onClearHistory}>
                <Text style={styles.clearText}>Clear All</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {historyList.length === 0 ? (
                <Text style={styles.emptyText}>No stored diagnostic test runs.</Text>
              ) : (
                historyList.map((h, idx) => (
                  <Pressable
                    key={h.id || idx}
                    style={styles.historyItem}
                    onPress={() => {
                      if (h.fullTrace) {
                        setDiagnosticData(h.fullTrace);
                        setHistoryModal(false);
                      }
                    }}
                  >
                    <Text style={styles.histSource}>{h.source}</Text>
                    <Text style={styles.histMeta}>
                      {new Date(h.timestamp).toLocaleTimeString()} • {h.documentType} • {h.durationMs}ms
                    </Text>
                    <Text style={styles.histStats}>
                      PASS: {h.stats?.pass} | FAIL: {h.stats?.fail} | WARN: {h.stats?.warning}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <GlassButton title="Close" variant="ghost" onPress={() => setHistoryModal(false)} style={{ marginTop: 12 }} />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function FieldRow({ label, value }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldVal}>{value || '—'}</Text>
    </View>
  );
}

function CompareRow({ label, before, after }) {
  const match = before === after;
  return (
    <View style={styles.compRow}>
      <Text style={styles.compLabel}>{label}</Text>
      <View style={styles.compValues}>
        <Text style={styles.compBefore}>Before: {before ?? 'null'}</Text>
        <Text style={[styles.compAfter, { color: match ? COLORS.emerald : '#F59E0B' }]}>
          After: {after ?? 'null'} {match ? '✓' : '⚡'}
        </Text>
      </View>
    </View>
  );
}

export default OcrDiagnosticScreen;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  devBadge: {
    backgroundColor: '#05966933',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.emerald,
  },
  devBadgeText: { color: COLORS.emerald, fontSize: 10, fontWeight: '800' },
  appVer: { color: COLORS.textMuted, fontSize: 10 },
  headerTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  headerSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeBtnText: { color: COLORS.emerald, fontWeight: '700', fontSize: 14 },
  scrollContent: { padding: SPACING.lg, paddingBottom: 64 },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', marginBottom: 16 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: '#05966922',
    borderColor: COLORS.emerald,
  },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: COLORS.emerald, fontWeight: '800' },
  actionGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1 },
  secondaryActionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  secBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  loadingCard: { alignItems: 'center', padding: 24, marginVertical: 16 },
  loadingText: { color: COLORS.text, fontSize: 14, marginTop: 12, fontWeight: '600' },
  summaryCard: { marginBottom: 16, padding: SPACING.md },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  summaryMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  statsPillRow: { flexDirection: 'row', gap: 6 },
  statPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statPillText: { fontSize: 11, fontWeight: '800' },
  summaryActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  smallActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  smallActionText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabItemActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  tabText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: COLORS.emerald, fontWeight: '800' },
  tabContent: { gap: 12 },
  stageCard: { padding: SPACING.md },
  stageHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stageNumber: {
    color: COLORS.emerald,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: '#05966922',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stageTitle: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  previewImage: { width: '100%', height: 180, borderRadius: 8, backgroundColor: '#000' },
  metaNote: { color: COLORS.textMuted, fontSize: 12 },
  metaSub: { color: COLORS.muted, fontSize: 11, marginTop: 4 },
  rawTextSample: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 6,
  },
  copyRawBtn: { marginTop: 8, alignItems: 'flex-end' },
  copyRawText: { color: COLORS.emerald, fontSize: 11, fontWeight: '700' },
  fieldGrid: { gap: 6 },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  fieldLabel: { color: COLORS.textMuted, fontSize: 12 },
  fieldVal: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  normRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  normLabel: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  normDiff: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  normRaw: { color: '#EF4444', fontSize: 12 },
  normArrow: { color: COLORS.textMuted, fontSize: 12 },
  normFinal: { color: COLORS.emerald, fontSize: 12, fontWeight: '700' },
  valRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  valLeft: { flex: 1, paddingRight: 12 },
  valField: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  valValue: { color: COLORS.emerald, fontSize: 11, marginTop: 1 },
  valMsg: { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
  valBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  valPass: { backgroundColor: '#05966922' },
  valFail: { backgroundColor: '#DC262622' },
  valWarn: { backgroundColor: '#D9770622' },
  valBadgeText: { fontSize: 10, fontWeight: '800' },
  jsonText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.emerald,
    fontSize: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 8,
    borderRadius: 6,
  },
  persistRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  persistLabel: { color: COLORS.textMuted, fontSize: 12 },
  persistVal: { fontSize: 12, fontWeight: '800' },
  persistSub: { color: COLORS.muted, fontSize: 10, marginTop: 4 },
  specialTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  specialLead: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, marginBottom: 12 },
  odoSelectedCard: {
    backgroundColor: '#05966918',
    borderColor: COLORS.emerald,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  odoSelectedLabel: { color: COLORS.emerald, fontSize: 10, fontWeight: '800' },
  odoSelectedValue: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  odoEvidence: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  rejRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rejCand: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },
  rejArrow: { color: COLORS.textMuted },
  rejLabel: { flex: 1, color: COLORS.textMuted, fontSize: 11 },
  rejStatus: { color: COLORS.emerald, fontSize: 10, fontWeight: '800' },
  insRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  insField: { color: COLORS.emerald, fontSize: 11, fontWeight: '800' },
  insRaw: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  insFinal: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  bhRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  bhInput: { color: COLORS.textMuted, fontSize: 12 },
  bhNorm: { color: COLORS.emerald, fontSize: 13, fontWeight: '800', marginTop: 2 },
  compareGrid: { gap: 8 },
  compRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  compLabel: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  compValues: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  compBefore: { color: '#EF4444', fontSize: 12 },
  compAfter: { fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  modalLead: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  clearText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  fixtureItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  fixtureName: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  fixtureType: { color: COLORS.emerald, fontSize: 10, fontWeight: '800', marginTop: 2 },
  historyItem: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  histSource: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  histMeta: { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
  histStats: { color: COLORS.emerald, fontSize: 10, fontWeight: '800', marginTop: 2 },
  emptyText: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginVertical: 16 },
});

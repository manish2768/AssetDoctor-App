/**
 * Asset Doctor — Energy Doctor Dashboard & History Screen
 *
 * Full-featured electricity intelligence hub:
 * - Real-time derived analytics (MoM bill %, consumption %, daily kWh, cost/unit)
 * - Transparent 3-tier status logic (Green, Yellow, Red) with causal explanation
 * - "Why did my bill change?" card
 * - Multi-account / multi-meter switcher with isolation
 * - Reactive month filtering (September NEVER displays August data)
 * - All History mode with lifetime analytics
 * - 6-Month Trend Graph (kWh & ₹)
 * - Deterministic Energy Health Scorecard
 * - Honest Smart Insights & Bill Forecast
 * - Shareable Energy Card with masked Consumer ID
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Share,
  RefreshControl,
  Dimensions,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { Haptics } from '../../services/haptics';
import { COLORS, RADIUS, SPACING } from '../../theme/branding';
import { TYPE } from '../../theme/tokens';
import { Screen, GlassCard } from '../../components/ui/Glass';
import { StatusBadge } from '../../design-system';
import { ElectricityBillService } from '../../services/energy/ElectricityBillService';
import {
  ElectricityAccount,
  ElectricityBillRecord,
  EnergyAnalytics,
} from '../../services/energy/electricityBillSchema';
import { EnergyAnalyticsEngine } from '../../services/energy/energyAnalyticsEngine';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function EnergyDoctorScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const highlightMonth = route?.params?.highlightMonth || null;
  const initialAccountId = route?.params?.accountId || null;

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId || 'default_home');
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // View modes: 'MONTHLY' | 'ALL_HISTORY'
  const [viewMode, setViewMode] = useState('MONTHLY');
  const [selectedMonth, setSelectedMonth] = useState(highlightMonth || null);
  const [graphMetric, setGraphMetric] = useState('UNITS'); // 'UNITS' | 'SPEND'

  // Modals
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newConsumerId, setNewConsumerId] = useState('');
  const [newProvider, setNewProvider] = useState('');

  const [showShareModal, setShowShareModal] = useState(false);
  const [includeConsumerIdInShare, setIncludeConsumerIdInShare] = useState(false);

  const loadData = useCallback(async () => {
    const effectiveUserId = user?.uid || 'local_user';
    try {
      const accList = await ElectricityBillService.listAccounts(effectiveUserId);
      setAccounts(accList);

      const activeAccId = selectedAccountId || (accList[0]?.id ?? 'default_home');
      setSelectedAccountId(activeAccId);

      const billList = await ElectricityBillService.listBills(effectiveUserId, activeAccId);
      setBills(billList);

      // Default selectedMonth to newest bill if none chosen
      if (!selectedMonth && billList.length > 0) {
        const sorted = EnergyAnalyticsEngine.sortBills(billList);
        setSelectedMonth(sorted[sorted.length - 1].billingMonth);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid, selectedAccountId, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activeAccount = useMemo(() => {
    return accounts.find((a) => a.id === selectedAccountId) || accounts[0] || null;
  }, [accounts, selectedAccountId]);

  // Derived Analytics from canonical stored records
  const analytics: EnergyAnalytics = useMemo(() => {
    return EnergyAnalyticsEngine.computeEnergyAnalytics(bills, selectedMonth || undefined);
  }, [bills, selectedMonth]);

  // Sorted list of available billing months for the tabs
  const availableMonths = useMemo(() => {
    const sorted = EnergyAnalyticsEngine.sortBills(bills);
    return sorted.map((b) => b.billingMonth).reverse(); // Newest first
  }, [bills]);

  // Reactive Month Record Check: guarantees September never returns August data
  const currentMonthRecord = useMemo(() => {
    if (!selectedMonth) return bills[bills.length - 1] || null;
    const match = EnergyAnalyticsEngine.filterBillsByMonth(bills, selectedMonth);
    return match[0] || null;
  }, [bills, selectedMonth]);

  // All History Lifetime Metrics
  const historyMetrics = useMemo(() => {
    if (bills.length === 0) return null;
    const sorted = EnergyAnalyticsEngine.sortBills(bills);
    const totalSpend = sorted.reduce((sum, b) => sum + (Number(b.currentBillAmount) || 0), 0);
    const totalUnits = sorted.reduce((sum, b) => sum + (Number(b.unitsConsumedKwh) || 0), 0);
    const totalDays = sorted.reduce((sum, b) => sum + (Number(b.billingDays) || 30), 0);

    const avgMonthlyBill = Math.round(totalSpend / sorted.length);
    const avgDailyKwh = totalDays > 0 ? Math.round((totalUnits / totalDays) * 10) / 10 : 0;

    let highestConsumptionMonth = sorted[0];
    let lowestConsumptionMonth = sorted[0];
    let highestBill = sorted[0];
    let lowestBill = sorted[0];

    for (const b of sorted) {
      if ((b.unitsConsumedKwh || 0) > (highestConsumptionMonth.unitsConsumedKwh || 0)) {
        highestConsumptionMonth = b;
      }
      if ((b.unitsConsumedKwh || 0) < (lowestConsumptionMonth.unitsConsumedKwh || 0)) {
        lowestConsumptionMonth = b;
      }
      if ((b.currentBillAmount || 0) > (highestBill.currentBillAmount || 0)) {
        highestBill = b;
      }
      if ((b.currentBillAmount || 0) < (lowestBill.currentBillAmount || 0)) {
        lowestBill = b;
      }
    }

    return {
      totalSpend,
      totalUnits,
      avgMonthlyBill,
      avgDailyKwh,
      highestConsumptionMonth,
      lowestConsumptionMonth,
      highestBill,
      lowestBill,
      billCount: sorted.length,
    };
  }, [bills]);

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      Alert.alert('Name Required', 'Enter account name (e.g. Office, Shop).');
      return;
    }
    const newAcc: ElectricityAccount = {
      id: `acc_${Date.now()}`,
      userId: user?.uid || 'local_user',
      accountName: newAccountName.trim(),
      consumerId: newConsumerId.trim(),
      provider: newProvider.trim() || 'Electricity Provider',
      createdAt: new Date().toISOString(),
    };
    await ElectricityBillService.saveAccount(newAcc);
    setAccounts([...accounts, newAcc]);
    setSelectedAccountId(newAcc.id);
    setShowAddAccountModal(false);
    setNewAccountName('');
    setNewConsumerId('');
    setNewProvider('');
    Haptics.success();
  };

  const handleShare = async () => {
    try {
      const consumerDisplay = includeConsumerIdInShare
        ? `\nConsumer ID: ${activeAccount?.consumerId || currentMonthRecord?.consumerId || 'N/A'}`
        : '';
      const message = `⚡ ASSET DOCTOR — ENERGY DOCTOR REPORT\nMonth: ${selectedMonth || 'Current'}\nBill: ₹${analytics.currentBill.toLocaleString('en-IN')}\nConsumption: ${analytics.currentUnits} kWh (${analytics.dailyConsumption} kWh/day)\nStatus: ${analytics.statusSummary}\nHealth Score: ${analytics.healthScore ? `${analytics.healthScore}/100` : 'Building'}${consumerDisplay}\n\nVerified by Asset Doctor`;
      await Share.share({ message });
      setShowShareModal(false);
    } catch {
      /* ignore */
    }
  };

  const handleDeleteBill = (billId: string) => {
    Alert.alert(
      'Delete Electricity Bill',
      'Are you sure you want to delete this bill record? Analytics will update immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await ElectricityBillService.deleteBill(user?.uid || 'local_user', selectedAccountId, billId);
            Haptics.tap();
            loadData();
          },
        },
      ]
    );
  };

  const statusTone =
    analytics.statusColor === 'GREEN'
      ? { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#10B981' }
      : analytics.statusColor === 'RED'
      ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#EF4444' }
      : { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#F59E0B' };

  return (
    <Screen style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.tap();
              navigation.goBack();
            }}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerSub}>ENERGY DOCTOR</Text>
            <Text style={styles.headerTitle}>Electricity Intelligence</Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.tap();
              navigation.navigate('ScanBill', { isEnergyScan: true, accountId: selectedAccountId });
            }}
            style={styles.scanHeaderBtn}
          >
            <Text style={styles.scanHeaderBtnText}>+ Scan</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />}
        >
          {/* Account Switcher Chips */}
          <View style={styles.accountBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountRow}>
              {accounts.map((acc) => {
                const on = acc.id === selectedAccountId;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => {
                      Haptics.select();
                      setSelectedAccountId(acc.id);
                    }}
                    style={[styles.accPill, on && styles.accPillOn]}
                  >
                    <Text style={[styles.accPillText, on && styles.accPillTextOn]}>
                      ⚡ {acc.accountName}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  Haptics.tap();
                  setShowAddAccountModal(true);
                }}
                style={styles.accAddPill}
              >
                <Text style={styles.accAddPillText}>+ New Meter</Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* Due Date Alert Banner */}
          {analytics.dueStatus.message ? (
            <View
              style={[
                styles.dueBanner,
                analytics.dueStatus.isOverdue ? styles.dueBannerOverdue : styles.dueBannerSoon,
              ]}
            >
              <Text
                style={[
                  styles.dueBannerText,
                  analytics.dueStatus.isOverdue ? styles.dueTextOverdue : styles.dueTextSoon,
                ]}
              >
                {analytics.dueStatus.message}
              </Text>
            </View>
          ) : null}

          {/* Top Hero Card (This Month / Selected Month) */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroLabel}>
                  {selectedMonth ? `Month: ${selectedMonth}` : 'Current Month'}
                </Text>
                <Text style={styles.heroAmount}>₹{analytics.currentBill.toLocaleString('en-IN')}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusTone.bg, borderColor: statusTone.border }]}>
                <Text style={[styles.statusBadgeText, { color: statusTone.text }]}>
                  {analytics.statusLabel}
                </Text>
              </View>
            </View>

            {/* Sub-row: Bill % change and Units % change */}
            <View style={styles.heroSubRow}>
              {analytics.billChangePercent != null ? (
                <Text style={[styles.heroSubText, { color: analytics.billChangePercent <= 0 ? '#10B981' : '#EF4444' }]}>
                  {analytics.billChangePercent <= 0 ? '↓ ' : '↑ '}
                  {Math.abs(analytics.billChangePercent)}% vs last month
                </Text>
              ) : (
                <Text style={styles.heroSubText}>First monthly record</Text>
              )}
              <Text style={styles.heroSubDot}>·</Text>
              <Text style={styles.heroSubUnits}>
                {analytics.currentUnits} kWh
                {analytics.consumptionChangePercent != null
                  ? ` (${analytics.consumptionChangePercent <= 0 ? '↓ ' : '↑ '}${Math.abs(
                      analytics.consumptionChangePercent
                    )}%)`
                  : ''}
              </Text>
            </View>

            <View style={[styles.heroSummaryBox, { backgroundColor: statusTone.bg }]}>
              <Text style={[styles.heroSummaryText, { color: statusTone.text }]}>
                {analytics.statusColor === 'GREEN' ? '🟢 ' : analytics.statusColor === 'RED' ? '🔴 ' : '🟡 '}
                {analytics.statusSummary}
              </Text>
            </View>
          </View>

          {/* Primary Action Button */}
          <Pressable
            onPress={() => {
              Haptics.tap();
              navigation.navigate('ScanBill', { isEnergyScan: true, accountId: selectedAccountId });
            }}
            style={styles.primaryScanBtn}
          >
            <Text style={styles.primaryScanBtnText}>⚡ Scan Electricity Bill</Text>
          </Pressable>

          {/* WHY DID MY BILL CHANGE? Card */}
          {analytics.previousBill != null ? (
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>WHY DID MY BILL CHANGE?</Text>
              <View style={styles.explainBox}>
                <Text style={styles.explainLine}>• {analytics.explanation.billChangeText}</Text>
                <Text style={styles.explainLine}>• {analytics.explanation.consumptionChangeText}</Text>
                <Text style={styles.explainLine}>• {analytics.explanation.billingDaysText}</Text>
                <Text style={[styles.explainLine, styles.explainConclusion]}>
                  • {analytics.explanation.conclusionText}
                </Text>
              </View>
            </View>
          ) : null}

          {/* View Mode Switcher: [ Monthly ] vs [ All History ] */}
          <View style={styles.modeToggleRow}>
            <Pressable
              onPress={() => {
                Haptics.select();
                setViewMode('MONTHLY');
              }}
              style={[styles.modeBtn, viewMode === 'MONTHLY' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeBtnText, viewMode === 'MONTHLY' && styles.modeBtnTextActive]}>
                Monthly
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.select();
                setViewMode('ALL_HISTORY');
              }}
              style={[styles.modeBtn, viewMode === 'ALL_HISTORY' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeBtnText, viewMode === 'ALL_HISTORY' && styles.modeBtnTextActive]}>
                All History
              </Text>
            </Pressable>
          </View>

          {/* Mode 1: MONTHLY */}
          {viewMode === 'MONTHLY' ? (
            <>
              {/* Month Selector Tabs */}
              {availableMonths.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthTabsScroll}>
                  {availableMonths.map((m) => {
                    const on = m === selectedMonth;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => {
                          Haptics.select();
                          setSelectedMonth(m);
                        }}
                        style={[styles.monthTab, on && styles.monthTabOn]}
                      >
                        <Text style={[styles.monthTabText, on && styles.monthTabTextOn]}>{m}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {/* Reactive Check: If selected month has no bill, show clean empty state */}
              {!currentMonthRecord ? (
                <View style={styles.emptyMonthCard}>
                  <Text style={styles.emptyMonthTitle}>
                    No electricity record for {selectedMonth || 'this month'}.
                  </Text>
                  <Text style={styles.emptyMonthSub}>
                    September records never display August data.
                  </Text>
                  <Pressable
                    onPress={() => navigation.navigate('ScanBill', { isEnergyScan: true, accountId: selectedAccountId })}
                    style={styles.emptyScanBtn}
                  >
                    <Text style={styles.emptyScanBtnText}>+ Scan Bill for {selectedMonth || 'this Month'}</Text>
                  </Pressable>
                </View>
              ) : (
                /* Month Breakdown Cards */
                <View style={styles.card}>
                  <Text style={styles.cardHeaderTitle}>MONTH BREAKDOWN — {selectedMonth}</Text>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Bill Amount</Text>
                      <Text style={styles.gridVal}>₹{analytics.currentBill.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Consumption</Text>
                      <Text style={styles.gridVal}>{analytics.currentUnits} kWh</Text>
                    </View>
                  </View>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Billing Period</Text>
                      <Text style={styles.gridVal}>{analytics.billingDays} days</Text>
                    </View>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Daily Intensity</Text>
                      <Text style={styles.gridVal}>{analytics.dailyConsumption} kWh/day</Text>
                    </View>
                  </View>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Cost per Unit</Text>
                      <Text style={styles.gridVal}>₹{analytics.costPerUnit} / kWh</Text>
                    </View>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Meter Readings</Text>
                      <Text style={styles.gridVal}>
                        {currentMonthRecord.previousMeterReading} → {currentMonthRecord.currentMeterReading}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.billActionRow}>
                    <Pressable
                      onPress={() => {
                        Haptics.tap();
                        setShowShareModal(true);
                      }}
                      style={styles.actionBtnOutline}
                    >
                      <Text style={styles.actionBtnOutlineText}>Share Report</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteBill(currentMonthRecord.id)}
                      style={styles.actionBtnDelete}
                    >
                      <Text style={styles.actionBtnDeleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          ) : (
            /* Mode 2: ALL HISTORY */
            <View style={styles.card}>
              <Text style={styles.cardHeaderTitle}>ALL HISTORY & LIFETIME METRICS</Text>
              {historyMetrics ? (
                <>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Total Spend</Text>
                      <Text style={styles.gridVal}>₹{historyMetrics.totalSpend.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Total Energy</Text>
                      <Text style={styles.gridVal}>{historyMetrics.totalUnits.toLocaleString('en-IN')} kWh</Text>
                    </View>
                  </View>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Average Monthly Bill</Text>
                      <Text style={styles.gridVal}>₹{historyMetrics.avgMonthlyBill.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Average Daily Usage</Text>
                      <Text style={styles.gridVal}>{historyMetrics.avgDailyKwh} kWh/day</Text>
                    </View>
                  </View>
                  <View style={styles.gridRow}>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Lowest Bill</Text>
                      <Text style={styles.gridVal}>
                        ₹{historyMetrics.lowestBill?.currentBillAmount} ({historyMetrics.lowestBill?.billingMonth})
                      </Text>
                    </View>
                    <View style={styles.gridCell}>
                      <Text style={styles.gridLabel}>Highest Bill</Text>
                      <Text style={styles.gridVal}>
                        ₹{historyMetrics.highestBill?.currentBillAmount} ({historyMetrics.highestBill?.billingMonth})
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.cardHeaderTitle, { marginTop: 16 }]}>LOGGED BILLS ({bills.length})</Text>
                  {bills.map((b) => (
                    <View key={b.id} style={styles.historyRowItem}>
                      <View>
                        <Text style={styles.historyRowMonth}>{b.billingMonth}</Text>
                        <Text style={styles.historyRowSub}>
                          {b.unitsConsumedKwh} kWh · {b.billingDays || 30} days · Readings: {b.previousMeterReading}→{b.currentMeterReading}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.historyRowAmt}>₹{Number(b.currentBillAmount).toLocaleString('en-IN')}</Text>
                        <Pressable onPress={() => handleDeleteBill(b.id)} hitSlop={6}>
                          <Text style={styles.historyRowDel}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.hintText}>No bills logged yet.</Text>
              )}
            </View>
          )}

          {/* 6-Month Trend Graph */}
          {analytics.historyTrend.length > 0 ? (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeaderTitle}>6-MONTH TREND</Text>
                <View style={styles.togglePillRow}>
                  <Pressable
                    onPress={() => setGraphMetric('UNITS')}
                    style={[styles.togglePill, graphMetric === 'UNITS' && styles.togglePillActive]}
                  >
                    <Text style={[styles.togglePillText, graphMetric === 'UNITS' && styles.togglePillTextActive]}>
                      kWh
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setGraphMetric('SPEND')}
                    style={[styles.togglePill, graphMetric === 'SPEND' && styles.togglePillActive]}
                  >
                    <Text style={[styles.togglePillText, graphMetric === 'SPEND' && styles.togglePillTextActive]}>
                      ₹ Bill
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Bar Chart Representation */}
              <View style={styles.chartContainer}>
                {analytics.historyTrend.map((item, idx) => {
                  const maxVal = Math.max(
                    ...analytics.historyTrend.map((t) => (graphMetric === 'UNITS' ? t.unitsConsumed : t.billAmount)),
                    1
                  );
                  const currentVal = graphMetric === 'UNITS' ? item.unitsConsumed : item.billAmount;
                  const barHeight = Math.max(12, Math.round((currentVal / maxVal) * 110));

                  return (
                    <View key={item.month} style={styles.chartBarCol}>
                      <Text style={styles.chartValText}>
                        {graphMetric === 'UNITS' ? currentVal : `₹${currentVal}`}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: barHeight }]} />
                      </View>
                      <Text style={styles.chartLabelText}>{item.displayMonth}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Energy Health Scorecard */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>ENERGY HEALTH</Text>
            {analytics.healthScore != null ? (
              <View style={styles.healthScoreRow}>
                <View style={styles.healthScoreCircle}>
                  <Text style={styles.healthScoreNum}>{analytics.healthScore}</Text>
                  <Text style={styles.healthScoreMax}>/ 100</Text>
                </View>
                <View style={styles.healthScoreInfo}>
                  <Text style={styles.healthScoreLabel}>{analytics.healthScoreLabel}</Text>
                  <Text style={styles.healthScoreDesc}>
                    Deterministic score based on consumption trend, daily intensity stability, and billing consistency.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.buildingScoreBox}>
                <Text style={styles.buildingScoreTitle}>⚡ Building your Energy Health score</Text>
                <Text style={styles.buildingScoreSub}>
                  Need at least 2 consecutive monthly bills to compute a deterministic health score.
                </Text>
              </View>
            )}
          </View>

          {/* Smart Insights (Honest, Zero Appliance Fabrication) */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>SMART INSIGHTS</Text>
            {analytics.insights.map((ins, idx) => (
              <View key={idx} style={styles.insightRow}>
                <Text style={styles.insightText}>{ins}</Text>
              </View>
            ))}
          </View>

          {/* Next Bill Forecast */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>🔮 NEXT BILL ESTIMATE</Text>
            {analytics.forecast.available ? (
              <>
                <Text style={styles.forecastRange}>
                  ₹{analytics.forecast.minAmount?.toLocaleString('en-IN')} – ₹
                  {analytics.forecast.maxAmount?.toLocaleString('en-IN')}
                </Text>
                <Text style={styles.forecastDisclaimer}>{analytics.forecast.disclaimer}</Text>
              </>
            ) : (
              <Text style={styles.hintText}>{analytics.forecast.disclaimer}</Text>
            )}
          </View>
        </ScrollView>

        {/* Share Card Modal */}
        <Modal visible={showShareModal} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.shareModalCard}>
              <Text style={styles.shareModalTitle}>Share Energy Report</Text>

              {/* Verified Share Card Preview */}
              <View style={styles.shareCardPreview}>
                <Text style={styles.shareBrand}>ASSET DOCTOR</Text>
                <Text style={styles.shareSub}>⚡ ENERGY DOCTOR</Text>
                <Text style={styles.shareMonth}>{selectedMonth || 'MONTH REPORT'}</Text>

                <View style={styles.shareStatsRow}>
                  <View>
                    <Text style={styles.shareAmount}>₹{analytics.currentBill.toLocaleString('en-IN')}</Text>
                    <Text style={styles.shareUnits}>{analytics.currentUnits} kWh</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.shareDaily}>{analytics.dailyConsumption} kWh/day</Text>
                    {analytics.healthScore ? (
                      <Text style={styles.shareHealth}>🟢 HEALTH {analytics.healthScore}/100</Text>
                    ) : null}
                  </View>
                </View>

                {includeConsumerIdInShare ? (
                  <Text style={styles.shareConsumer}>Consumer ID: {activeAccount?.consumerId || 'N/A'}</Text>
                ) : (
                  <Text style={styles.shareConsumer}>Consumer ID: XXXXXX (Masked)</Text>
                )}
                <Text style={styles.shareVerified}>Verified by Asset Doctor</Text>
              </View>

              {/* Masking Option */}
              <Pressable
                onPress={() => setIncludeConsumerIdInShare(!includeConsumerIdInShare)}
                style={styles.maskToggleRow}
              >
                <Text style={styles.maskCheckbox}>{includeConsumerIdInShare ? '☑' : '☐'}</Text>
                <Text style={styles.maskLabel}>Include unmasked Consumer ID in share text</Text>
              </Pressable>

              <View style={styles.shareBtnRow}>
                <Pressable onPress={() => setShowShareModal(false)} style={styles.shareCancelBtn}>
                  <Text style={styles.shareCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleShare} style={styles.shareConfirmBtn}>
                  <Text style={styles.shareConfirmBtnText}>Share →</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Account Modal */}
        <Modal visible={showAddAccountModal} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.addAccModalCard}>
              <Text style={styles.shareModalTitle}>Add Electricity Meter / Account</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Account Nickname (e.g. Office, Shop)"
                placeholderTextColor="#94A3B8"
                value={newAccountName}
                onChangeText={setNewAccountName}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Consumer ID / Account No (Optional)"
                placeholderTextColor="#94A3B8"
                value={newConsumerId}
                onChangeText={setNewConsumerId}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Provider Name (e.g. Tata Power, BSES)"
                placeholderTextColor="#94A3B8"
                value={newProvider}
                onChangeText={setNewProvider}
              />

              <View style={styles.shareBtnRow}>
                <Pressable onPress={() => setShowAddAccountModal(false)} style={styles.shareCancelBtn}>
                  <Text style={styles.shareCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleCreateAccount} style={styles.shareConfirmBtn}>
                  <Text style={styles.shareConfirmBtnText}>Create Account</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
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
  headerCenter: { alignItems: 'center' },
  headerSub: { color: '#10B981', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginTop: 2 },
  scanHeaderBtn: { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  scanHeaderBtnText: { color: '#10B981', fontSize: 13, fontWeight: '700' },
  content: { padding: 16 },

  accountBar: { marginBottom: 12 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#162232',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  accPillOn: { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: '#10B981' },
  accPillText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  accPillTextOn: { color: '#10B981', fontWeight: '800' },
  accAddPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed' },
  accAddPillText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  dueBanner: { padding: 10, borderRadius: 10, marginBottom: 12 },
  dueBannerSoon: { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.35)', borderWidth: 1 },
  dueBannerOverdue: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.35)', borderWidth: 1 },
  dueBannerText: { fontSize: 13, fontWeight: '700' },
  dueTextSoon: { color: '#F59E0B' },
  dueTextOverdue: { color: '#EF4444' },

  heroCard: {
    backgroundColor: '#131D2A',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  heroAmount: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { fontSize: 12, fontWeight: '800' },
  heroSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  heroSubText: { fontSize: 13, fontWeight: '700' },
  heroSubDot: { color: '#64748B', marginHorizontal: 6 },
  heroSubUnits: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  heroSummaryBox: { padding: 10, borderRadius: 8, marginTop: 12 },
  heroSummaryText: { fontSize: 13, fontWeight: '700' },

  primaryScanBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  primaryScanBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  card: {
    backgroundColor: '#131D2A',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardHeaderTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  explainBox: { backgroundColor: '#182433', padding: 12, borderRadius: 10 },
  explainLine: { color: '#CBD5E1', fontSize: 13, lineHeight: 19, marginBottom: 4 },
  explainConclusion: { color: '#10B981', fontWeight: '700', marginTop: 4 },

  modeToggleRow: { flexDirection: 'row', backgroundColor: '#182433', padding: 3, borderRadius: 10, marginBottom: 12 },
  modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  modeBtnActive: { backgroundColor: '#0F766E' },
  modeBtnText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  modeBtnTextActive: { color: '#FFFFFF', fontWeight: '800' },

  monthTabsScroll: { flexDirection: 'row', marginBottom: 12 },
  monthTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: '#182433', marginRight: 8 },
  monthTabOn: { backgroundColor: 'rgba(16,185,129,0.2)', borderWidth: 1, borderColor: '#10B981' },
  monthTabText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  monthTabTextOn: { color: '#10B981', fontWeight: '800' },

  emptyMonthCard: { padding: 24, alignItems: 'center', backgroundColor: '#131D2A', borderRadius: 14, marginBottom: 14 },
  emptyMonthTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  emptyMonthSub: { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  emptyScanBtn: { backgroundColor: '#0F766E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  emptyScanBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  gridRow: { flexDirection: 'row', marginBottom: 12 },
  gridCell: { flex: 1 },
  gridLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 2 },
  gridVal: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  billActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  actionBtnOutline: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#10B981' },
  actionBtnOutlineText: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  actionBtnDelete: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  actionBtnDeleteText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },

  historyRowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  historyRowMonth: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  historyRowSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  historyRowAmt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  historyRowDel: { color: '#EF4444', fontSize: 11, marginTop: 2 },

  togglePillRow: { flexDirection: 'row', backgroundColor: '#182433', borderRadius: 6, padding: 2 },
  togglePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  togglePillActive: { backgroundColor: '#0F766E' },
  togglePillText: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  togglePillTextActive: { color: '#FFFFFF', fontWeight: '800' },

  chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, paddingTop: 10 },
  chartBarCol: { alignItems: 'center', flex: 1 },
  chartValText: { color: '#94A3B8', fontSize: 9, fontWeight: '600', marginBottom: 4 },
  barTrack: { width: 22, height: 110, justifyContent: 'flex-end', backgroundColor: '#182433', borderRadius: 4, overflow: 'hidden' },
  barFill: { backgroundColor: '#10B981', borderRadius: 4 },
  chartLabelText: { color: '#64748B', fontSize: 10, marginTop: 6 },

  healthScoreRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  healthScoreCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 2, borderColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  healthScoreNum: { color: '#10B981', fontSize: 22, fontWeight: '800' },
  healthScoreMax: { color: '#64748B', fontSize: 10, fontWeight: '600' },
  healthScoreInfo: { flex: 1, marginLeft: 14 },
  healthScoreLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  healthScoreDesc: { color: '#94A3B8', fontSize: 12, lineHeight: 16 },

  buildingScoreBox: { padding: 12, backgroundColor: '#182433', borderRadius: 10 },
  buildingScoreTitle: { color: '#F59E0B', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  buildingScoreSub: { color: '#94A3B8', fontSize: 12 },

  insightRow: { paddingVertical: 6 },
  insightText: { color: '#CBD5E1', fontSize: 13, lineHeight: 18 },

  forecastRange: { color: '#10B981', fontSize: 22, fontWeight: '800', marginTop: 4 },
  forecastDisclaimer: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  hintText: { color: '#64748B', fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  shareModalCard: { backgroundColor: '#131D2A', borderRadius: 16, padding: 18 },
  shareModalTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 14, textAlign: 'center' },

  shareCardPreview: {
    backgroundColor: '#0F172A',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  shareBrand: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  shareSub: { color: '#10B981', fontSize: 14, fontWeight: '800', marginTop: 2 },
  shareMonth: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginBottom: 10 },
  shareStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  shareAmount: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  shareUnits: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  shareDaily: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  shareHealth: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  shareConsumer: { color: '#64748B', fontSize: 11, fontStyle: 'italic', marginBottom: 4 },
  shareVerified: { color: '#10B981', fontSize: 10, fontWeight: '700', textAlign: 'right' },

  maskToggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  maskCheckbox: { color: '#10B981', fontSize: 18, marginRight: 8 },
  maskLabel: { color: '#CBD5E1', fontSize: 12 },

  shareBtnRow: { flexDirection: 'row', gap: 10 },
  shareCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1E293B', alignItems: 'center' },
  shareCancelBtnText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  shareConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#0F766E', alignItems: 'center' },
  shareConfirmBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  addAccModalCard: { backgroundColor: '#131D2A', borderRadius: 16, padding: 18 },
  modalInput: {
    backgroundColor: '#182433',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 12,
  },
});

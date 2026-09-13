/**
 * Asset Doctor — Fuel Vault Screen
 *
 * Authoritative Fuel & Mileage Management Hub:
 * - Pure selectedVehicleId state isolation (no cross-vehicle pollution)
 * - Strict isVehicleAsset domain filtering
 * - Compact View Switcher: [ Monthly View ] [ All History ]
 * - Canonical computeFuelAnalytics engine for deterministic metrics
 * - Unified Vehicle Identity & presentation (Car gets car icon, Bike gets bike icon)
 * - Single Primary Screen Header (no duplicate title or excess blank space)
 */

import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useAssets } from '../../context/AssetProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { Haptics } from '../../services/haptics';
import { FuelService, getCurrentPeriod } from '../../services/fuel/FuelService';
import { computeFuelAnalytics } from '../../services/fuel/fuelMetrics';
import { isVehicleAsset } from '../../domain/asset/assetGuards';
import { SPACING, TYPE, RADIUS, HIT } from '../../theme/tokens';
import { IconButton, PrimaryButton, EmptyState } from '../../components/design-system';
import { PremiumIcon } from '../../design-system/icons';
import { FuelLogCard } from '../../components/fuel/FuelLogCard';
import { QuickFuelLogModal } from '../../components/fuel/QuickFuelLogModal';
import { VehicleSelectCard } from '../../components/fuel/VehicleSelectCard';
import { getVehiclePresentation } from '../../utils/vehiclePresentation';

function monthLabel(period) {
  if (!period) return '—';
  const [y, m] = period.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[(m || 1) - 1]} ${y}`;
}

function recentPeriods(now = new Date()) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function FuelMetric({ label, value, subtitle }) {
  const colors = useThemeColors();
  return (
    <View style={styles.metric}>
      <Text style={[TYPE.micro, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[TYPE.h3, { color: colors.text, marginTop: 4 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {subtitle ? (
        <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function FuelVaultScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const ui = useUiFeedback();
  const { user } = useAuth();
  const { assets, getAsset } = useAssets();

  // Hide the native React Navigation header to prevent duplicate titles
  useLayoutEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  const routeAssetId = route?.params?.assetId;

  // 1. Authoritative Vehicle Asset List (strictly filtered via domain guard)
  const vehicleAssets = useMemo(() => {
    return (assets || []).filter((a) => !a.isArchived && !a.deletedAt && isVehicleAsset(a));
  }, [assets]);

  // 2. Canonical State: selectedVehicleId only
  const [selectedVehicleId, setSelectedVehicleId] = useState(() => {
    if (routeAssetId) return routeAssetId;
    const first = vehicleAssets[0];
    return (first && (first.assetId || first.id)) || null;
  });

  useEffect(() => {
    if (routeAssetId) {
      setSelectedVehicleId(routeAssetId);
    } else if (vehicleAssets.length > 0 && !selectedVehicleId) {
      const first = vehicleAssets[0];
      setSelectedVehicleId((first && (first.assetId || first.id)) || null);
    }
  }, [routeAssetId, vehicleAssets, selectedVehicleId]);

  const activeVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return vehicleAssets.find((v) => (v.assetId || v.id) === selectedVehicleId) || getAsset?.(selectedVehicleId) || null;
  }, [selectedVehicleId, vehicleAssets, getAsset]);

  const pres = useMemo(() => getVehiclePresentation(activeVehicle), [activeVehicle]);

  // 3. View Mode: 'MONTHLY' vs 'LIFETIME' (All History)
  const [viewMode, setViewMode] = useState('MONTHLY');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [logOpen, setLogOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // 4. Isolated Fuel Logs Subscription
  useEffect(() => {
    const uid = user?.uid;
    const vId = selectedVehicleId;
    if (!uid || !vId) {
      setLogs([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = FuelService.subscribeFuelLogs(
      uid,
      vId,
      (next) => {
        // Enforce strict assetId match
        const filtered = (next || []).filter((l) => l && l.assetId === vId);
        setLogs(filtered);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => {
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
    };
  }, [user?.uid, selectedVehicleId, refreshNonce]);

  // 5. Compute Unified Analytics & Filtered Dataset
  const analytics = useMemo(() => {
    return computeFuelAnalytics({
      asset: activeVehicle || {},
      logs,
      mode: viewMode,
      month: period,
    });
  }, [activeVehicle, logs, viewMode, period]);

  const onLogFuel = () => {
    if (!user?.uid) {
      ui.info('Sign in to save', 'Create a free account to keep your fuel & mileage history.');
      return;
    }
    Haptics.tap();
    setLogOpen(true);
  };

  const onBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Assets');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* 1. Single Primary Screen Header */}
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 8) }]}>
        <IconButton
          icon={<PremiumIcon name="arrow-left" size={18} color={colors.text} />}
          label="Back"
          onPress={onBack}
          variant="surface"
          size={44}
        />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={[TYPE.h2, { color: colors.text }]} numberOfLines={1}>
            Fuel & Mileage
          </Text>
        </View>
        <IconButton
          icon={<PremiumIcon name="plus" size={18} color={colors.primary} />}
          label="Log fuel"
          onPress={onLogFuel}
          variant="accent"
          size={44}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Vehicle Identity Card */}
        <View style={[styles.vehicleIdentityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.vehicleCardTop}>
            <View style={[styles.vehicleIconBadge, { backgroundColor: colors.accentLight || 'rgba(16,185,129,0.12)' }]}>
              <PremiumIcon name={pres.icon} size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[TYPE.h3, { color: colors.text }]} numberOfLines={1}>
                {pres.displayName}
              </Text>
              <View style={styles.vehicleSubRow}>
                <Text style={[TYPE.micro, { color: colors.primary, fontWeight: '700' }]}>
                  {pres.registration || 'NO REGISTRATION'}
                </Text>
                <Text style={[TYPE.caption, { color: colors.textMuted }]}>
                  • {pres.vehicleType}
                </Text>
              </View>
            </View>
            <IconButton
              icon={<PremiumIcon name="plus" size={16} color={colors.primary} />}
              label="Add Fuel"
              onPress={onLogFuel}
              variant="accent"
              size={38}
            />
          </View>

          {/* Multiple Vehicles Switcher */}
          {vehicleAssets.length > 1 ? (
            <View style={[styles.multiVehicleContainer, { borderTopColor: colors.border }]}>
              <VehicleSelectCard
                vehicleAssets={vehicleAssets}
                selectedVehicleId={selectedVehicleId}
                onSelectVehicleId={(vId) => setSelectedVehicleId(vId)}
              />
            </View>
          ) : null}
        </View>

        {/* 3. Compact Segmented Control: [ Monthly View ] [ All History ] */}
        <View style={[styles.modeSwitcherContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => {
              Haptics.select();
              setViewMode('MONTHLY');
            }}
            style={[
              styles.modeTab,
              viewMode === 'MONTHLY' && [styles.modeTabActive, { backgroundColor: colors.primary }],
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'MONTHLY' }}
          >
            <Text
              style={[
                styles.modeTabText,
                { color: viewMode === 'MONTHLY' ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              Monthly View
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.select();
              setViewMode('LIFETIME');
            }}
            style={[
              styles.modeTab,
              viewMode === 'LIFETIME' && [styles.modeTabActive, { backgroundColor: colors.primary }],
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'LIFETIME' }}
          >
            <Text
              style={[
                styles.modeTabText,
                { color: viewMode === 'LIFETIME' ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              All History
            </Text>
          </Pressable>
        </View>

        {/* 4. Digital Vehicle Passport Card */}
        <Pressable
          onPress={() => {
            Haptics.tap();
            if (selectedVehicleId) {
              navigation.navigate('VehiclePassport', {
                assetId: selectedVehicleId,
                mode: viewMode,
                monthKey: period,
                analytics,
              });
            } else {
              ui.info('Ride Passport', 'Select a vehicle first to view its ride passport.');
            }
          }}
          style={[styles.rideCard, { borderColor: 'rgba(16,185,129,0.45)' }]}
          accessibilityRole="button"
          accessibilityLabel="Open Digital Vehicle Passport"
        >
          <View style={styles.rideBadge}>
            <PremiumIcon name="shield-check" size={18} color="#14B8A6" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.rideTitle}>
              {viewMode === 'MONTHLY' ? `Monthly Passport (${monthLabel(period)})` : 'Digital Vehicle Passport (All History)'}
            </Text>
            <Text style={styles.rideSub}>
              {analytics.totalDistanceKm != null && analytics.totalDistanceKm > 0
                ? `${analytics.totalDistanceKm.toLocaleString('en-IN')} km · ${analytics.averageMileageKmPerL != null ? analytics.averageMileageKmPerL + ' km/L · ' : ''}Shareable digital certificate`
                : 'Verified mileage, running cost & health certificate'}
            </Text>
          </View>
          <PremiumIcon name="chevron" size={16} color="#6EE7B7" />
        </Pressable>

        {/* 5. Month Selector Chips (Shown ONLY in Monthly Mode) */}
        {viewMode === 'MONTHLY' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll}>
            {recentPeriods().map((p) => {
              const active = p === period;
              return (
                <Pressable
                  key={p}
                  onPress={() => {
                    Haptics.select();
                    setPeriod(p);
                  }}
                  style={[
                    styles.monthChip,
                    {
                      backgroundColor: active ? (colors.accentLight || '#0F766E20') : colors.surface,
                      borderColor: active ? (colors.primary || '#0F766E') : colors.border,
                      borderWidth: active ? 1.5 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={monthLabel(p)}
                >
                  <Text style={[TYPE.caption, { color: active ? colors.primary : colors.textMuted, fontWeight: '700' }]}>
                    {monthLabel(p)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* 6. Fuel Analytics & History */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: SPACING.sm }]}>
          <View style={styles.summaryHeader}>
            <Text style={[TYPE.label, { color: colors.textMuted }]}>
              {viewMode === 'MONTHLY' ? 'MONTHLY METRICS' : 'ALL HISTORY TOTALS'}
            </Text>
            <Text style={[TYPE.caption, { color: colors.textMuted }]}>
              {viewMode === 'MONTHLY' ? monthLabel(period) : `${analytics.refillCount} Refills Logged`}
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <FuelMetric
              label={viewMode === 'MONTHLY' ? 'Monthly Distance' : 'Total Distance'}
              value={analytics.totalDistanceKm != null && analytics.totalDistanceKm > 0 ? `${analytics.totalDistanceKm.toLocaleString('en-IN')} km` : '—'}
            />
            <FuelMetric
              label={viewMode === 'MONTHLY' ? 'Monthly Spend' : 'Total Spend'}
              value={analytics.totalSpend > 0 ? `₹${analytics.totalSpend.toLocaleString('en-IN')}` : '—'}
            />
            <FuelMetric
              label="Avg Mileage"
              value={analytics.averageMileageKmPerL != null && analytics.averageMileageKmPerL > 0 ? `${analytics.averageMileageKmPerL} km/L` : '—'}
              subtitle={pres.vehicleType}
            />
            <FuelMetric
              label="Cost / km"
              value={analytics.costPerKm != null && analytics.costPerKm > 0 ? `₹${analytics.costPerKm}` : '—'}
            />
          </View>

          {analytics.fullTankCount > 0 ? (
            <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 4 }]}>
              {analytics.fullTankCount} full-tank refill{analytics.fullTankCount === 1 ? '' : 's'} recorded.
            </Text>
          ) : null}
        </View>

        {/* 7. Fuel History Rows (strictly coupled with filtered dataset) */}
        <View style={{ marginTop: SPACING.md }}>
          <Text style={[TYPE.label, { color: colors.textMuted, marginBottom: SPACING.xs }]}>
            {viewMode === 'MONTHLY' ? `FUEL HISTORY (${monthLabel(period)})` : 'ALL RECORDED REFILLS'}
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.md }} />
          ) : analytics.filteredLogs.length === 0 ? (
            <EmptyState
              title={viewMode === 'MONTHLY' ? `No fuel records for ${monthLabel(period)}` : 'No fuel logs yet'}
              message={viewMode === 'MONTHLY' ? `Add your first ${monthLabel(period).split(' ')[0]} fuel log to start tracking.` : 'Record your first top-up to start tracking mileage and running cost.'}
              ctaLabel={viewMode === 'MONTHLY' ? `+ Add ${monthLabel(period).split(' ')[0]} Fuel Log` : '+ Log Fuel'}
              onCta={onLogFuel}
              style={{ marginTop: SPACING.sm }}
            />
          ) : (
            analytics.filteredLogs.map((log) => <FuelLogCard key={log.id} log={log} />)
          )}
        </View>

        {/* 8. Bottom Action */}
        {analytics.filteredLogs.length > 0 ? (
          <PrimaryButton
            title="+ Log Fuel"
            onPress={onLogFuel}
            style={{ marginTop: SPACING.md }}
          />
        ) : null}
      </ScrollView>

      <QuickFuelLogModal
        visible={logOpen}
        asset={activeVehicle}
        selectedPeriod={period}
        onSaved={() => setRefreshNonce((n) => n + 1)}
        onClose={() => setLogOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },
  vehicleIdentityCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  vehicleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  multiVehicleContainer: {
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    paddingTop: 2,
  },
  modeSwitcherContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: SPACING.sm,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  rideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    backgroundColor: '#040912',
  },
  rideBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideTitle: { color: '#EAF9F5', fontSize: 13.5, fontWeight: '800' },
  rideSub: { color: '#7FB3A8', fontSize: 11, marginTop: 2, fontWeight: '600' },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    marginHorizontal: -4,
  },
  metric: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: SPACING.sm,
  },
  monthScroll: {
    marginVertical: SPACING.xs,
    flexGrow: 0,
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    marginRight: SPACING.xs,
    minHeight: HIT.min,
    justifyContent: 'center',
  },
});

export default FuelVaultScreen;

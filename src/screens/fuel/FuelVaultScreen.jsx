/**
 * Asset Doctor — Fuel Vault Screen
 *
 * Per-asset fuel and mileage history + Monthly Asset Wrap:
 *   - Real-time fuel log list (Users/{uid}/Assets/{aid}/fuelLogs)
 *   - Month selector and per-period FuelSummary (distance, spend, litres, avg
 *     mileage, avg cost/km) computed by the shared summarizeMonthlyFuel engine.
 *   - "+ Log Fuel" quick action.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { summarizeMonthlyFuel } from '../../utils/fuelCalculator';
import { getFuelVehicleType } from '../../utils/fuelCalculator';
import { SPACING, TYPE, RADIUS, HIT } from '../../theme/tokens';
import { IconButton, PrimaryButton, SecondaryButton, EmptyState } from '../../components/design-system';
import { PremiumIcon } from '../../design-system/icons';
import { FuelLogCard } from '../../components/fuel/FuelLogCard';
import { QuickFuelLogModal } from '../../components/fuel/QuickFuelLogModal';

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

import { VehicleSelectCard } from '../../components/fuel/VehicleSelectCard';

export function FuelVaultScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const ui = useUiFeedback();
  const { user } = useAuth();
  const { assets, getAsset } = useAssets();

  const routeAssetId = route?.params?.assetId;
  const routeAsset = getAsset?.(routeAssetId);

  const vehicleAssets = useMemo(() => {
    return (assets || []).filter(
      (a) => !a.isArchived && !a.deletedAt && (a.category === 'VEHICLE' || String(a.categoryId) === 'vehicles' || a.isVehicleInvoice || a.registrationNumber || a.registration)
    );
  }, [assets]);

  const [selectedAsset, setSelectedAsset] = useState(routeAsset || vehicleAssets[0] || null);

  useEffect(() => {
    if (routeAsset) {
      setSelectedAsset(routeAsset);
    } else if (vehicleAssets.length > 0 && !selectedAsset) {
      setSelectedAsset(vehicleAssets[0]);
    }
  }, [routeAsset, vehicleAssets]);

  const activeAsset = selectedAsset || routeAsset;
  const assetId = (activeAsset && (activeAsset.assetId || activeAsset.id)) || null;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid || !assetId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = FuelService.subscribeFuelLogs(
      uid,
      assetId,
      (next) => {
        setLogs(next || []);
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
  }, [user?.uid, assetId]);

  const summary = useMemo(
    () => summarizeMonthlyFuel(period, assetId || '', logs),
    [period, assetId, logs],
  );

  const vehicleType = useMemo(() => getFuelVehicleType(asset || {}), [asset]);

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
      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 8) }]}>
        <IconButton
          icon={<PremiumIcon name="arrow-left" size={18} color={colors.text} />}
          label="Back"
          onPress={onBack}
          variant="surface"
          size={44}
        />
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={[TYPE.h2, { color: colors.text }]} numberOfLines={1}>
            Fuel & Mileage
          </Text>
          <Text style={[TYPE.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {asset?.assetName || 'Vehicle passport'}
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
        <VehicleSelectCard
          vehicleAssets={vehicleAssets}
          selectedAssetId={assetId}
          onSelectAsset={(v) => setSelectedAsset(v)}
        />
        {/* Summary card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryHeader}>
            <Text style={[TYPE.label, { color: colors.textMuted }]}>MONTHLY ASSET WRAP</Text>
            <Text style={[TYPE.caption, { color: colors.textMuted }]}>{monthLabel(period)}</Text>
          </View>

          <View style={styles.summaryGrid}>
            <FuelMetric label="Distance" value={summary.totalDistanceKm > 0 ? `${summary.totalDistanceKm} km` : '—'} />
            <FuelMetric label="Spend" value={summary.totalFuelSpendInr > 0 ? `₹${summary.totalFuelSpendInr}` : '—'} />
            <FuelMetric
              label="Mileage"
              value={summary.averageMileage != null ? `${summary.averageMileage} km/L` : '—'}
              subtitle={vehicleType}
            />
            <FuelMetric
              label="Cost / km"
              value={summary.averageCostPerKm != null ? `₹${summary.averageCostPerKm}` : '—'}
            />
          </View>

          {summary.fullTankCount > 0 ? (
            <Text style={[TYPE.caption, { color: colors.textMuted, marginTop: 8 }]}>
              {summary.fullTankCount} full-tank refill{summary.fullTankCount === 1 ? '' : 's'} this period.
            </Text>
          ) : null}
        </View>

        {/* Ride Passport entry — matte-black monthly passport card */}
        <Pressable
          onPress={() => {
            Haptics.tap();
            if (assetId) {
              navigation.navigate('VehiclePassport', { assetId });
            } else {
              ui.info('Ride Passport', 'Open the asset passport to see its monthly ride summary.');
            }
          }}
          style={[styles.rideCard, { borderColor: 'rgba(16,185,129,0.4)' }]}
          accessibilityRole="button"
          accessibilityLabel="Open monthly Ride Passport"
        >
          <View style={styles.rideBadge}>
            <PremiumIcon name="shield-check" size={18} color="#14B8A6" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.rideTitle}>Monthly Ride Passport</Text>
            <Text style={styles.rideSub}>
              {summary.totalDistanceKm > 0
                ? `${summary.totalDistanceKm} km this month — shareable black card`
                : 'See your mileage, spend & health as a shareable black card'}
            </Text>
          </View>
          <PremiumIcon name="chevron" size={16} color="#6EE7B7" />
        </Pressable>

        {/* Month selector */}
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
                    backgroundColor: active ? colors.accentLight : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={monthLabel(p)}
              >
                <Text style={[TYPE.caption, { color: active ? colors.primary : colors.textMuted, fontWeight: '700' }]}>
                  {monthLabel(p).split(' ')[0]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* List */}
        <View style={{ marginTop: SPACING.sm }}>
          <Text style={[TYPE.label, { color: colors.textMuted, marginBottom: SPACING.xs }]}>
            FUEL HISTORY
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.md }} />
          ) : logs.length === 0 ? (
            <EmptyState
              title="No fuel logs yet"
              message="Record your first top-up to start tracking mileage and running cost. Full-tank refills unlock real km/L."
              ctaLabel="+ Log Fuel"
              onCta={onLogFuel}
              style={{ marginTop: SPACING.md }}
            />
          ) : (
            logs.map((log) => <FuelLogCard key={log.id} log={log} />)
          )}
        </View>

        {/* Action */}
        {logs.length > 0 ? (
          <PrimaryButton
            title="+ Log Fuel"
            onPress={onLogFuel}
            style={{ marginTop: SPACING.lg }}
          />
        ) : null}
      </ScrollView>

      <QuickFuelLogModal
        visible={logOpen}
        asset={asset}
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
  summaryCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  rideCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    backgroundColor: '#08141C',
  },
  rideBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(20,184,166,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideTitle: { color: '#EAF9F5', fontSize: 14, fontWeight: '800' },
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
    marginTop: SPACING.sm,
    flexGrow: 0,
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.xs,
    minHeight: HIT.min,
    justifyContent: 'center',
  },
});

export default FuelVaultScreen;

/**
 * Asset Doctor — Master Digital Vehicle Passport Screen
 *
 * Renders the high-definition Obsidian Digital Vehicle Passport
 * with visual tier switcher (Standard, Gold, Black), Front Certificate &
 * Back Specifications/Audit flip, privacy masking toggles,
 * and 1-tap 1080px PNG image export to WhatsApp / Android Share sheet.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../context/ThemeProvider';
import { useAssets } from '../context/AssetProvider';
import { useAuth } from '../context/AuthProvider';
import { useUiFeedback } from '../context/UiFeedbackProvider';
import { Haptics } from '../services/haptics';
import { TAB_BAR_HEIGHT } from '../theme/tabMetrics';
import { SPACING, TYPE, RADIUS, elevation } from '../theme/tokens';
import { PremiumIcon } from '../design-system/icons';
import { useFuelLogs } from '../hooks/useFuelLogs';
import { monthKeyOf, computeFuelAnalytics, type FuelAnalyticsResult } from '../services/fuel/fuelMetrics';
import { MonthlyBlackCard, type PassportTier } from '../components/fuel/MonthlyBlackCard';
import { IconButton, FilterChip, PrimaryButton } from '../components/design-system';
import { captureView, shareCard } from '../services/share/cardShare';
import { getVehiclePresentation } from '../utils/vehiclePresentation';

let ViewShot: any = null;
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  ViewShot = require('react-native-view-shot').default;
} catch {
  ViewShot = null;
}

const TIER_OPTIONS: Array<{ id: PassportTier; label: string }> = [
  { id: 'standard', label: 'Standard' },
  { id: 'gold', label: 'Gold' },
  { id: 'black', label: 'Black' },
];

export function VehiclePassportScreen({ route, navigation }: any) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const ui = useUiFeedback();
  const { getAsset } = useAssets();
  const { user } = useAuth();
  const shotRef = useRef<any>(null);

  const assetId = route?.params?.assetId as string | undefined;
  const asset = assetId ? getAsset?.(assetId) : undefined;
  const routeMode = route?.params?.mode as 'MONTHLY' | 'LIFETIME' | undefined;
  const routeMonthKey = (route?.params?.monthKey || route?.params?.period) as string | undefined;

  const mode = routeMode || 'MONTHLY';
  const monthKey = routeMonthKey || monthKeyOf();

  const { logs, loading } = useFuelLogs(user?.uid, assetId, { enabled: Boolean(assetId) });

  const [selectedTier, setSelectedTier] = useState<PassportTier | undefined>(undefined);
  const [maskNumber, setMaskNumber] = useState(false);
  const [maskAmount, setMaskAmount] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showBack, setShowBack] = useState(false);

  // Canonical Single Source of Truth Analytics
  const analytics: FuelAnalyticsResult = useMemo(() => {
    return computeFuelAnalytics({
      asset: asset || {},
      logs,
      mode,
      month: monthKey,
    });
  }, [asset, logs, mode, monthKey]);

  const pres = useMemo(() => getVehiclePresentation(asset), [asset]);

  const onShare = async () => {
    Haptics.tap();
    if (sharing) return;
    setSharing(true);
    try {
      let uri: string | null = null;
      if (shotRef.current) {
        uri = await captureView(shotRef, { width: 1080, format: 'png' });
      }

      const periodLabel = mode === 'LIFETIME' ? 'ALL HISTORY' : monthKey;
      const lines = [
        `${pres.displayName} · Digital Vehicle Passport (${periodLabel})`,
        `Registration: ${maskNumber ? '•• •• ••••' : (pres.registration || 'Verified')}`,
        `Vehicle Type: ${pres.vehicleType}`,
        `Total distance: ${analytics.totalDistanceKm != null && analytics.totalDistanceKm > 0 ? `${analytics.totalDistanceKm.toLocaleString('en-IN')} km` : '—'}`,
        analytics.averageMileageKmPerL != null && analytics.averageMileageKmPerL > 0
          ? `Avg mileage: ${analytics.averageMileageKmPerL} km/L`
          : null,
        analytics.costPerKm != null && analytics.costPerKm > 0 ? `Running cost: ₹${analytics.costPerKm}/km` : null,
        analytics.totalSpend > 0 && !maskAmount ? `Fuel spend: ₹${analytics.totalSpend.toLocaleString('en-IN')}` : null,
        `Refill count: ${analytics.refillCount}`,
        '',
        'Verified by Asset Doctor · assetdoctor.in',
      ]
        .filter(Boolean)
        .join('\n');

      if (uri) {
        const res = await shareCard(asset, {
          uri,
          caption: lines,
          fileName: `asset-doctor-passport-${mode === 'LIFETIME' ? 'lifetime' : monthKey}`,
          mime: 'image/png',
        });
        if (res?.success) Haptics.success();
        else if (res?.error && res.error !== 'Share cancelled') ui?.error?.('Share', res.error);
      } else {
        const res2 = await shareCard(asset, { uri: '', caption: lines });
        if (res2?.success) Haptics.success();
        else if (res2?.error && res2.error !== 'Share cancelled') ui?.error?.('Share', res2.error);
      }
    } catch (error: any) {
      Haptics.error();
      ui?.error?.('Share', error?.message || 'Could not export passport image');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <IconButton
          icon={<PremiumIcon name="arrow-left" size={18} color={colors.text} />}
          label="Back"
          onPress={() => navigation.goBack()}
          variant="surface"
          size={44}
        />
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={[TYPE.h2, { color: colors.text, textAlign: 'center', fontWeight: '700' }]} numberOfLines={1}>
            Digital Vehicle Passport
          </Text>
        </View>
        <IconButton
          icon={<PremiumIcon name="share" size={18} color={colors.primary} />}
          label="Share"
          onPress={onShare}
          variant="surface"
          size={44}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Tier Selector Chips */}
        <View style={styles.tierChipRow}>
          {TIER_OPTIONS.map((t) => (
            <FilterChip
              key={t.id}
              label={t.label}
              selected={selectedTier === t.id}
              onPress={() => {
                Haptics.select();
                setSelectedTier((prev) => (prev === t.id ? undefined : t.id));
              }}
            />
          ))}
        </View>

        {/* View Switcher: Certificate Front vs Specifications Back */}
        <View style={[styles.passportViewSwitcher, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => {
              Haptics.select();
              setShowBack(false);
            }}
            style={[
              styles.viewTab,
              !showBack && [styles.viewTabActive, { backgroundColor: colors.primary }],
            ]}
          >
            <Text
              style={[
                styles.viewTabText,
                { color: !showBack ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              Certificate (Front)
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.select();
              setShowBack(true);
            }}
            style={[
              styles.viewTab,
              showBack && [styles.viewTabActive, { backgroundColor: colors.primary }],
            ]}
          >
            <Text
              style={[
                styles.viewTabText,
                { color: showBack ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              Specifications & Audit (Back)
            </Text>
          </Pressable>
        </View>

        {/* Capturable Passport Card */}
        <View style={styles.cardContainer}>
          {ViewShot ? (
            <ViewShot
              ref={shotRef}
              style={{ width: '100%', alignItems: 'center' }}
              options={{ format: 'png', quality: 0.98, result: 'tmpfile', width: 1080 }}
            >
              <MonthlyBlackCard
                asset={asset || {}}
                logs={logs}
                monthKey={monthKey}
                mode={mode}
                analytics={analytics}
                maskNumber={maskNumber}
                maskSpend={maskAmount}
                tier={selectedTier}
                width={340}
                showBack={showBack}
                onToggleFlip={() => setShowBack((b) => !b)}
              />
            </ViewShot>
          ) : (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <MonthlyBlackCard
                asset={asset || {}}
                logs={logs}
                monthKey={monthKey}
                mode={mode}
                analytics={analytics}
                maskNumber={maskNumber}
                maskSpend={maskAmount}
                tier={selectedTier}
                width={340}
                showBack={showBack}
                onToggleFlip={() => setShowBack((b) => !b)}
              />
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.md }} />
        ) : analytics.refillCount === 0 ? (
          <Text style={[TYPE.caption, { color: colors.textMuted, textAlign: 'center', marginTop: SPACING.md }]}>
            No fuel logs recorded for this period. Consecutive full-tank refills automatically compute verified mileage.
          </Text>
        ) : null}

        {/* Privacy Controls Panel */}
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(1, colors.shadow)]}>
          <Text style={[TYPE.label, { color: colors.textMuted }]}>PRIVACY CONTROLS</Text>
          <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2, marginBottom: 8 }]}>
            Controls what appears on your exported image certificate.
          </Text>

          <View style={styles.switchRow}>
            <Text style={[TYPE.body, { color: colors.text, flex: 1, fontWeight: '600' }]}>Mask number plate</Text>
            <Switch
              value={maskNumber}
              onValueChange={(v) => {
                Haptics.select();
                setMaskNumber(v);
              }}
              accessibilityLabel="Mask number plate"
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[TYPE.body, { color: colors.text, flex: 1, fontWeight: '600' }]}>Mask fuel spend</Text>
            <Switch
              value={maskAmount}
              onValueChange={(v) => {
                Haptics.select();
                setMaskAmount(v);
              }}
              accessibilityLabel="Mask fuel spend"
            />
          </View>
        </View>

        {/* Share Action */}
        <View style={{ marginTop: SPACING.lg }}>
          <PrimaryButton
            title="✨ Share Digital Vehicle Passport Image"
            onPress={onShare}
            loading={sharing}
            size="lg"
            style={{ borderRadius: RADIUS.lg }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },
  tierChipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  passportViewSwitcher: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: SPACING.md,
  },
  viewTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewTabActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  viewTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  panel: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginTop: SPACING.xs,
  },
});

export default VehiclePassportScreen;

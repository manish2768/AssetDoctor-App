/**
 * Asset Doctor — 🖤 RIDE PASSPORT (Vehicle Monthly Passport)
 *
 * A dedicated screen rendering the matte-black Monthly Vehicle Passport card
 * with privacy controls (mask plate / mask spend) and 1-tap share. Wired into
 * the navigation stack; reachable from Fuel Vault / Asset Passport.
 */

import React, { useRef, useState } from 'react';
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
import { SPACING, TYPE, RADIUS } from '../theme/tokens';
import { PremiumIcon } from '../design-system/icons';
import { useFuelLogs } from '../hooks/useFuelLogs';
import { monthKeyOf, computeMonthlyMetrics } from '../services/fuel/fuelMetrics';
import { captureView, shareCard } from '../services/share/cardShare';
import { MonthlyBlackCard } from '../components/fuel/MonthlyBlackCard';
import { IconButton } from '../components/design-system';
// Capturable ViewShot
let ViewShot: any = null;
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  ViewShot = require('react-native-view-shot').default;
} catch {
  ViewShot = null;
}

export function VehiclePassportScreen({ route, navigation }: any) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const ui = useUiFeedback();
  const { getAsset } = useAssets();
  const { user } = useAuth();
  const shotRef = useRef<any>(null);

  const assetId = route?.params?.assetId as string | undefined;
  const asset = assetId ? getAsset?.(assetId) : undefined;

  const { logs, loading } = useFuelLogs(user?.uid, assetId, { enabled: Boolean(assetId) });

  const [maskNumber, setMaskNumber] = useState(false);
  const [maskAmount, setMaskAmount] = useState(false);
  const [sharing, setSharing] = useState(false);

  const monthKey = monthKeyOf();
  const metric = computeMonthlyMetrics(monthKey, logs, asset || {});

  const onShare = async () => {
    Haptics.tap();
    if (sharing) return;
    setSharing(true);
    try {
      let uri: string | null = null;
      if (shotRef.current) {
        uri = await captureView(shotRef, { width: 1080, format: 'png' });
      }
      const lines = [
        `${asset?.assetName || vehicleName(asset)} · Ride Passport`,
        `Total distance: ${metric.totalDistanceKm != null ? `${metric.totalDistanceKm} km` : '—'}`,
        metric.averageMileageKmPerL != null ? `Avg mileage: ${metric.averageMileageKmPerL} km/L` : null,
        metric.runningCostPerKm != null ? `Cost/km: ₹${metric.runningCostPerKm}` : null,
        metric.totalSpendInr != null ? `Total spend: ₹${metric.totalSpendInr}` : null,
        '',
        'Shared from Asset Doctor · assetdoctor.in',
      ]
        .filter(Boolean)
        .join('\n');

      if (uri) {
        const res = await shareCard(asset, {
          uri,
          caption: lines,
          fileName: `ride-passport-${monthKey}`,
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
      ui?.error?.('Share', error?.message || 'Could not share');
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
        <Text style={[TYPE.h2, { color: colors.text, flex: 1, textAlign: 'center', marginHorizontal: 8 }]} numberOfLines={1}>
          Ride Passport
        </Text>
        <IconButton
          icon={<PremiumIcon name="share" size={18} color={colors.text} />}
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
        <Text style={[TYPE.caption, { color: colors.textMuted, textAlign: 'center', marginBottom: SPACING.md }]}>
          Monthly Passport
        </Text>

        {/* The card — wrapped in a capture ref so future work can screenshot it.
            Because capturing a live screen needs the ref mounted, use ViewShot. */}
        {ViewShot ? (
          <ViewShot
            ref={shotRef}
            style={{ width: '100%', alignItems: 'center' }}
            options={{ format: 'png', quality: 0.96, result: 'tmpfile', width: 1080 }}
          >
            <MonthlyBlackCard
              asset={asset || {}}
              logs={logs}
              monthKey={monthKey}
              maskNumber={maskNumber}
              maskSpend={maskAmount}
              width={340}
            />
          </ViewShot>
        ) : (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <MonthlyBlackCard
              asset={asset || {}}
              logs={logs}
              monthKey={monthKey}
              maskNumber={maskNumber}
              maskSpend={maskAmount}
              width={340}
            />
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.md }} />
        ) : metric.entryCount === 0 ? (
          <Text style={[TYPE.caption, { color: colors.textMuted, textAlign: 'center', marginTop: SPACING.md }]}>
            No fuel logs this month yet. Log a full-tank refill to build your passport.
          </Text>
        ) : null}

        {/* Privacy controls */}
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[TYPE.label, { color: colors.textMuted }]}>PRIVACY CONTROLS</Text>
          <View style={styles.switchRow}>
            <Text style={[TYPE.body, { color: colors.text, flex: 1 }]}>Mask number plate</Text>
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
            <Text style={[TYPE.body, { color: colors.text, flex: 1 }]}>Mask total spend</Text>
            <Switch
              value={maskAmount}
              onValueChange={(v) => {
                Haptics.select();
                setMaskAmount(v);
              }}
              accessibilityLabel="Mask total spend"
            />
          </View>
        </View>

        {/* Share CTA */}
        <Pressable
          onPress={onShare}
          disabled={sharing}
          style={[styles.shareBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Share Ride Passport"
        >
          {sharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.shareText}>✨ Share Ride Passport</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function vehicleName(asset: any): string {
  return String(asset?.assetName || asset?.name || 'Vehicle');
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
  shareBtn: {
    marginTop: SPACING.lg,
    height: 50,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});

export default VehiclePassportScreen;

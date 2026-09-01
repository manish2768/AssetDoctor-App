/**
 * Asset Doctor — ⛽ REFILL IMPACT CARD
 *
 * A premium, shareable "holographic luxury receipt" shown right after logging a
 * fuel top-up. Black + brand-teal luxury surface, geomagnetic edge glow,
 * entrance scale/fade animation, and a concise monthly mini-card on top.
 *
 * Data is computed by the reusable fuelMetrics service and NEVER fabricated:
 *   - Trip distance = lastOdo - firstOdo (chronological)
 *   - Trip mileage only when litres present
 *   - Running cost only when spend + valid distance
 *   - Efficiency verdict + city-average comparison (per-vehicle benchmark)
 *
 * Includes "Save to Vault" (via DocumentVaultService) + "1-Tap Share Card".
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../../context/ThemeProvider';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { useAuth } from '../../context/AuthProvider';
import { Haptics } from '../../services/haptics';

import {
  computeTripMetrics,
  computeMonthlyMetrics,
  maskVehicleNumber,
  maskSpend,
} from '../../services/fuel/fuelMetrics';
import { useFuelLogs } from '../../hooks/useFuelLogs';
import { captureView, shareCard } from '../../services/share/cardShare';
import { PremiumIcon } from '../../design-system/icons';
import { RADIUS, SPACING, TYPE, MOTION } from '../../theme/tokens';
import { QrBadge } from './QrBadge';

interface RefillImpactCardProps {
  visible: boolean;
  asset: (Record<string, any> & { assetId?: string; id?: string }) | null | undefined;
  onClose: () => void;
  onPreview?: (canvas: 'feed' | 'story') => void;
}

const VERDICT_STYLE: Record<
  string,
  { label: string; icon: string; tint: string; soft: string }
> = {
  SUPER_SAVER: {
    label: 'Super Saver',
    icon: '🔥',
    tint: '#10B981',
    soft: 'rgba(16,185,129,0.16)',
  },
  BALANCED: { label: 'Balanced', icon: '⚡', tint: '#FBBF24', soft: 'rgba(251,191,36,0.16)' },
  HEAVY_THROTTLE: { label: 'Heavy Throttle', icon: '🔴', tint: '#F87171', soft: 'rgba(248,113,113,0.16)' },
  INSUFFICIENT: { label: 'Keep Logging', icon: '🧭', tint: '#94A3B8', soft: 'rgba(148,163,184,0.16)' },
};

function fmt(num: number | null | undefined, decimals = 1, suffix = ''): string {
  if (num === null || num === undefined || !Number.isFinite(Number(num))) return '—';
  return `${Number(num).toFixed(decimals)}${suffix}`;
}

function fmtInt(num: number | null | undefined, suffix = ''): string {
  if (num === null || num === undefined || !Number.isFinite(Number(num))) return '—';
  return `${Number(num).toLocaleString('en-IN')}${suffix}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[(m || 1) - 1]} ${y}`;
}

export function RefillImpactCard({
  visible,
  asset,
  onClose,
  onPreview,
}: RefillImpactCardProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const ui = useUiFeedback();

  const { user } = useAuth();
  const assetId = (asset?.assetId || asset?.id) as string | undefined;
  const liveAsset = asset || {};

  const { logs } = useFuelLogs(user?.uid, assetId, { enabled: visible });

  const [sharing, setSharing] = useState(false);
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.86);
    opacity.setValue(0);
    glow.setValue(0);
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: MOTION.normal, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: MOTION.normal, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: false }),
    ]).start();
  }, [visible, scale, opacity, glow]);

  const trip = useMemo(() => computeTripMetrics(logs, liveAsset), [logs, liveAsset]);
  const month = useMemo(
    () => computeMonthlyMetrics(monthKeyOfNow(), logs, liveAsset),
    [logs, liveAsset],
  );
  const verdict = VERDICT_STYLE[trip.verdict] || VERDICT_STYLE.INSUFFICIENT;
  const vehicleName = String(liveAsset.assetName || liveAsset.name || 'Vehicle');
  const vehicleNumber = String(liveAsset.registration || liveAsset.serialNumber || '');

  const onShareCard = async () => {
    Haptics.tap();
    if (sharing) return;
    setSharing(true);
    try {
      // Build share text with the same trusted numbers.
      const lines = [
        `Refill Impact · ${vehicleName}`,
        `Trip: ${formatInt(trip.tripDistanceKm)} km`,
        trip.tripMileageKmPerL != null ? `Mileage: ${fmt(trip.tripMileageKmPerL)} km/L` : null,
        trip.runningCostPerKm != null ? `Cost/km: ₹${fmt(trip.runningCostPerKm, 2)}` : null,
        trip.fuelSpentInr != null ? `Spent: ${maskSpend(trip.fuelSpentInr, false)}` : null,
        trip.benchmarkText,
        '',
        'Shared from Asset Doctor · assetdoctor.in',
      ]
        .filter(Boolean)
        .join('\n');
      const res = await shareCard(liveAsset as any, { uri: '', caption: lines });
      if (res?.success) {
        Haptics.success();
      } else if (res?.error && res.error !== 'Share cancelled') {
        ui?.error?.('Share', res.error);
      }
    } catch (err: any) {
      ui?.error?.('Share', err?.message || 'Could not share');
    } finally {
      setSharing(false);
    }
  };

  const monthKey = monthKeyOfNow();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[styles.cardShell, { opacity, transform: [{ scale }] }]}
          pointerEvents="auto"
        >
          {/* Geomagnetic edge glow */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }) },
            ]}
          />
          <View style={[styles.card, { backgroundColor: '#0A1820' }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Top brand strip */}
              <View style={styles.brandStrip}>
                <View style={styles.logoBadge}>
                  <PremiumIcon name="shield-check" size={18} color="#14B8A6" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.brandName}>ASSET DOCTOR</Text>
                  <Text style={styles.stamp}>VERIFIED FUEL LOG</Text>
                </View>
                <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
                  <PremiumIcon name="x" size={18} color="#BBD7CE" />
                </Pressable>
              </View>

              {/* Vehicle identity */}
              <View style={styles.identityRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleName}>{vehicleName}</Text>
                  <Text style={styles.vehicleNumber}>
                    {maskVehicleNumber(vehicleNumber || '', false)}
                  </Text>
                </View>
                <View style={styles.verdictPill}>
                  <Text style={styles.verdictEmoji}>{verdict.icon}</Text>
                  <Text style={[styles.verdictText, { color: verdict.tint }]}>{verdict.label}</Text>
                </View>
              </View>

              {/* Hero distance */}
              <View style={styles.hero}>
                <Text style={styles.heroLabel}>TRIP DISTANCE</Text>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>{formatInt(trip.tripDistanceKm)}</Text>
                  <Text style={styles.heroUnit}>km</Text>
                </View>
                {trip.tripMileageKmPerL != null ? (
                  <Text style={styles.heroSub}>
                    Avg <Text style={{ color: verdict.tint, fontWeight: '800' }}>{fmt(trip.tripMileageKmPerL)}</Text> km/L
                  </Text>
                ) : (
                  <Text style={styles.heroSub}>Mileage unlocks after your next full-tank log.</Text>
                )}
              </View>

              {/* Stats grid */}
              <View style={styles.statsGrid}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Eff. Rating</Text>
                  <Text style={styles.statValue}>{verdict.label}</Text>
                  <Text style={[styles.statSub, { color: verdict.tint }]}>{trip.benchmarkText}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Running Cost</Text>
                  <Text style={styles.statValue}>
                    {trip.runningCostPerKm != null ? `₹${fmt(trip.runningCostPerKm, 2)}` : '—'}
                  </Text>
                  <Text style={styles.statSub}>per km</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Fuel Spent</Text>
                  <Text style={styles.statValue}>{maskSpend(trip.fuelSpentInr, false)}</Text>
                  <Text style={styles.statSub}>{trip.litersUsed != null ? `${fmt(trip.litersUsed, 1)} L` : ''}</Text>
                </View>
              </View>

              {/* Monthly mini card */}
              <View style={styles.monthlyCard}>
                <View style={styles.monthlyHeader}>
                  <Text style={styles.monthlyTitle}>MONTHLY REPLAY</Text>
                  <Text style={styles.monthlyDate}>{monthLabel(monthKey)}</Text>
                </View>
                <View style={styles.monthlyRow}>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthValue}>{formatInt(month.totalDistanceKm)} km</Text>
                    <Text style={styles.monthLabel}>this month</Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthValue}>
                      {month.averageMileageKmPerL != null ? `${fmt(month.averageMileageKmPerL)}` : '—'} km/L
                    </Text>
                    <Text style={styles.monthLabel}>avg mileage</Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthValue}>{maskSpend(month.totalSpendInr, false)}</Text>
                    <Text style={styles.monthLabel}>total spend</Text>
                  </View>
                </View>
              </View>

              {/* Footer brand + QR */}
              <View style={styles.footer}>
                <View style={styles.footerBrand}>
                  <Text style={styles.footerTagline}>One place to understand, protect & save</Text>
                  <Text style={styles.footerCredit}>Built by Ashutosh Rai · assetdoctor.in</Text>
                </View>
                <QrBadge size={72} elevated />
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
              <Pressable
                onPress={() => { Haptics.tap(); onClose(); }}
                style={styles.closeAction}
                accessibilityRole="button"
                accessibilityLabel="Close card"
              >
                <Text style={styles.closeActionText}>Maybe later</Text>
              </Pressable>
              <Pressable
                onPress={onShareCard}
                style={styles.saveAction}
                disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel="Share fuel impact card"
              >
                <Text style={styles.saveActionText}>{sharing ? 'Sharing…' : 'Share Card'}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('en-IN');
}

function monthKeyOfNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(1,6,10,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  cardShell: {
    width: '100%',
    maxWidth: 440,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: 'rgba(20,184,166,0.16)',
    transform: [{ scale: 1.02 }],
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.32)',
    overflow: 'hidden',
  },
  scrollContent: { padding: SPACING.md },
  brandStrip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: '#6EE7B7', fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  stamp: { color: '#3F6F6A', fontSize: 9, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(20,184,166,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  vehicleName: { color: '#EAF9F5', fontSize: 18, fontWeight: '900' },
  vehicleNumber: { color: '#7FB3A8', fontSize: 12, fontWeight: '600', marginTop: 2, letterSpacing: 0.8 },
  verdictPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(20,184,166,0.12)',
  },
  verdictEmoji: { fontSize: 13, marginRight: 5 },
  verdictText: { fontSize: 12, fontWeight: '800' },
  hero: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: '#06121A',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.22)',
  },
  heroLabel: { color: '#3F6F6A', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  heroValue: { color: '#FFFFFF', fontSize: 46, fontWeight: '900', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  heroUnit: { color: '#5FA89C', fontSize: 18, fontWeight: '700', marginLeft: 6 },
  heroSub: { color: '#8FB9B0', fontSize: 13, marginTop: 2, fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: 8,
  },
  stat: {
    flex: 1,
    padding: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#07131C',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.14)',
  },
  statLabel: { color: '#3F6F6A', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { color: '#EAF9F5', fontSize: 13, fontWeight: '800', marginTop: 5 },
  statSub: { color: '#7FB3A8', fontSize: 10, marginTop: 3 },
  monthlyCard: {
    marginTop: SPACING.sm,
    padding: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: '#0B2830',
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.20)',
  },
  monthlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthlyTitle: { color: '#6EE7B7', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  monthlyDate: { color: '#5FA89C', fontSize: 11, fontWeight: '700' },
  monthlyRow: { flexDirection: 'row', marginTop: 10, gap: 6 },
  monthStat: { flex: 1 },
  monthValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  monthLabel: { color: '#7FB3A8', fontSize: 9, fontWeight: '600', marginTop: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(110,231,183,0.14)',
  },
  footerBrand: { flex: 1, marginRight: 12 },
  footerTagline: { color: '#7FB3A8', fontSize: 10, fontWeight: '600', lineHeight: 14 },
  footerCredit: { color: '#3F6F6A', fontSize: 9, fontWeight: '700', marginTop: 3 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(110,231,183,0.14)',
  },
  closeAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionText: { color: '#7FB3A8', fontSize: 14, fontWeight: '700' },
  saveAction: {
    flex: 2,
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveActionText: { color: '#06251E', fontSize: 14, fontWeight: '900' },
});

export default RefillImpactCard;

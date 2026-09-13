/**
 * Asset Doctor — Master Digital Vehicle Passport Certificate Card
 *
 * Premium Obsidian / Digital Vehicle Passport Visual Language:
 * - Luxury certificate aesthetic: Deep Obsidian (#040810 / #050B14) background
 * - Restrained emerald brand accents & metallic precision borders
 * - Strict vehicle visual resolver (Car gets car icon, Bike gets bike icon)
 * - Pure single source of truth: consumes canonical FuelAnalyticsResult
 * - Period reflects active view: "AUG 2026", "SEP 2026", or "ALL HISTORY"
 * - Dual state: Front Certificate Summary & Back Specification / Audit Details
 * - Missing fields display "Not recorded" / "Not available" (no fake data, no raw "---")
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { calculateHealthScore } from '../../utils/healthScore';
import {
  computeFuelAnalytics,
  maskVehicleNumber,
  maskSpend,
  fuelLogDate,
  type FuelAnalyticsResult,
  monthKeyOf,
} from '../../services/fuel/fuelMetrics';
import { getVehiclePresentation } from '../../utils/vehiclePresentation';
import { PremiumIcon } from '../../design-system/icons';
import { QrBadge } from './QrBadge';
import { RADIUS, TYPE, SPACING } from '../../theme/tokens';
import { formatDateIN } from '../../utils/dates';

export type PassportTier = 'standard' | 'gold' | 'black';

export interface MonthlyBlackCardProps {
  asset: Record<string, any> | null | undefined;
  logs?: Array<Record<string, any>>;
  monthKey?: string; // 'YYYY-MM'
  mode?: 'MONTHLY' | 'LIFETIME';
  analytics?: FuelAnalyticsResult;
  maskNumber?: boolean;
  maskSpend?: boolean;
  tier?: PassportTier;
  width?: number;
  showBack?: boolean;
  onToggleFlip?: () => void;
}

const BASE_W = 340;

function monthLabel(key?: string): string {
  if (!key) return 'ALL HISTORY';
  const [y, m] = key.split('-').map(Number);
  const names = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${names[(m || 1) - 1]} ${y}`;
}

function resolveVisualTier(healthScore: number, entryCount: number, propTier?: PassportTier): PassportTier {
  if (propTier) return propTier;
  if (healthScore >= 90 || entryCount >= 5) return 'black';
  if (healthScore >= 75 || entryCount >= 2) return 'gold';
  return 'standard';
}

function getOwnershipDuration(purchaseDateStr?: string | null): string {
  if (!purchaseDateStr) return 'Not recorded';
  try {
    const pDate = new Date(purchaseDateStr);
    if (isNaN(pDate.getTime())) return 'Not recorded';
    const now = new Date();
    const diffMonths = (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth());
    if (diffMonths < 1) return 'New acquisition';
    const years = Math.floor(diffMonths / 12);
    const months = diffMonths % 12;
    if (years > 0 && months > 0) return `${years}y ${months}m`;
    if (years > 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${months} month${months > 1 ? 's' : ''}`;
  } catch {
    return 'Not recorded';
  }
}

export function MonthlyBlackCard({
  asset,
  logs = [],
  monthKey,
  mode,
  analytics: externalAnalytics,
  maskNumber = false,
  maskSpend: maskSpendFlag = false,
  tier: propTier,
  width = BASE_W,
  showBack = false,
  onToggleFlip,
}: MonthlyBlackCardProps) {
  const scale = (width || BASE_W) / BASE_W;

  const healthRes = useMemo(() => calculateHealthScore(asset || {}), [asset]);
  const healthScore = typeof healthRes === 'number' ? healthRes : healthRes?.score || 88;

  // Derive presentation from canonical resolver (Car -> car, Bike -> bike, etc.)
  const pres = useMemo(() => getVehiclePresentation(asset), [asset]);

  // Single source of truth for analytics: use external if provided, else compute
  const analytics: FuelAnalyticsResult = useMemo(() => {
    if (externalAnalytics) return externalAnalytics;
    return computeFuelAnalytics({
      asset: asset || {},
      logs,
      mode: mode || (monthKey ? 'MONTHLY' : 'LIFETIME'),
      month: monthKey || monthKeyOf(),
    });
  }, [externalAnalytics, asset, logs, mode, monthKey]);

  const activeTier = resolveVisualTier(healthScore, analytics.refillCount, propTier);

  const plate = maskVehicleNumber(pres.registration, maskNumber);
  const spendText = maskSpend(analytics.totalSpend, maskSpendFlag);

  const isLifetime = (mode === 'LIFETIME' || analytics.mode === 'LIFETIME');
  const passportPeriod = isLifetime
    ? 'ALL HISTORY'
    : monthLabel(analytics.monthKey || monthKey);

  const passportId = `AD-PASS-${String(asset?.id || asset?.assetId || '000').slice(-6).toUpperCase()}`;

  // Theme styles based on visual tier
  const tierConfig = useMemo(() => {
    switch (activeTier) {
      case 'black':
        return {
          bg: '#040810',
          border: 'rgba(0,184,169,0.5)',
          glow: '#00B8A9',
          brandColor: '#00B8A9',
          pillBg: 'rgba(0,184,169,0.15)',
          pillBorder: 'rgba(0,184,169,0.35)',
          pillText: '#22D3EE',
          pillLabel: '🛡️ OBSIDIAN PASSPORT',
          accent: '#00B8A9',
        };
      case 'gold':
        return {
          bg: '#0A0A0C',
          border: 'rgba(245,158,11,0.5)',
          glow: '#F59E0B',
          brandColor: '#F59E0B',
          pillBg: 'rgba(245,158,11,0.15)',
          pillBorder: 'rgba(245,158,11,0.35)',
          pillText: '#FBBF24',
          pillLabel: '⭐ GOLD PASSPORT',
          accent: '#F59E0B',
        };
      case 'standard':
      default:
        return {
          bg: '#050D18',
          border: 'rgba(16,185,129,0.45)',
          glow: '#10B981',
          brandColor: '#10B981',
          pillBg: 'rgba(16,185,129,0.15)',
          pillBorder: 'rgba(16,185,129,0.3)',
          pillText: '#10B981',
          pillLabel: '🛡️ DIGITAL PASSPORT',
          accent: '#10B981',
        };
    }
  }, [activeTier]);

  // If showBack is true, render detailed specification & audit back
  if (showBack) {
    const purchaseDate = asset?.purchaseDate ? formatDateIN(new Date(asset.purchaseDate)) : 'Not recorded';
    const ownershipDuration = getOwnershipDuration(asset?.purchaseDate || asset?.createdAt);
    const currentOdo = asset?.odometerKm != null
      ? `${Number(asset.odometerKm).toLocaleString('en-IN')} km`
      : analytics.totalDistanceKm != null && analytics.totalDistanceKm > 0
      ? `${analytics.totalDistanceKm.toLocaleString('en-IN')} km`
      : 'Not recorded';

    const latestLog = analytics.filteredLogs?.[0];
    const lastFuelDate = latestLog ? (fuelLogDate(latestLog) ? formatDateIN(fuelLogDate(latestLog)) : 'Not recorded') : 'Not recorded';
    const totalLitresText = analytics.totalLitres > 0 ? `${analytics.totalLitres.toFixed(1)} L` : 'Not recorded';
    const avgMileageText = analytics.averageMileageKmPerL != null && analytics.averageMileageKmPerL > 0
      ? `${analytics.averageMileageKmPerL} km/L`
      : 'Not recorded';
    const costPerKmText = analytics.costPerKm != null && analytics.costPerKm > 0
      ? `₹${analytics.costPerKm}/km`
      : 'Not recorded';

    const lastService = asset?.lastServiceDate ? formatDateIN(new Date(asset.lastServiceDate)) : 'Not recorded';
    const nextService = asset?.nextServiceDate
      ? formatDateIN(new Date(asset.nextServiceDate))
      : asset?.nextServiceOdo
      ? `${Number(asset.nextServiceOdo).toLocaleString('en-IN')} km`
      : 'Not recorded';

    const insuranceStatus = asset?.insuranceValidUntil
      ? new Date(asset.insuranceValidUntil) > new Date()
        ? 'Active'
        : 'Expired'
      : 'Not available';

    const pucStatus = asset?.pucValidUntil
      ? new Date(asset.pucValidUntil) > new Date()
        ? 'Active'
        : 'Not available'
      : 'Not available';

    const rcStatus = pres.registration ? 'Verified' : 'Not available';

    return (
      <View
        style={[
          styles.card,
          {
            width,
            minHeight: 250 * scale,
            borderRadius: 22 * scale,
            padding: 16 * scale,
            backgroundColor: tierConfig.bg,
            borderColor: tierConfig.border,
            shadowColor: tierConfig.glow,
          },
        ]}
      >
        {/* Back Header */}
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.brandTitle, { fontSize: 12 * scale, color: tierConfig.brandColor }]}>
              ASSET DOCTOR · SPECIFICATIONS & AUDIT
            </Text>
            <Text style={[styles.certificateBadge, { fontSize: 9 * scale }]}>
              {pres.displayName} · {passportPeriod}
            </Text>
          </View>
          {onToggleFlip ? (
            <Pressable onPress={onToggleFlip} style={styles.flipBtn}>
              <Text style={[styles.flipBtnText, { fontSize: 10 * scale, color: tierConfig.brandColor }]}>
                Flip Card ⤾
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* 2-Column Audit Detail Grid */}
        <View style={[styles.detailGrid, { marginVertical: 10 * scale }]}>
          <DetailRow label="Vehicle Identity" value={pres.displayName} scale={scale} />
          <DetailRow label="Registration" value={plate || 'Not recorded'} scale={scale} />
          <DetailRow label="Vehicle Type" value={pres.vehicleType} scale={scale} />
          <DetailRow label="Purchase Date" value={purchaseDate} scale={scale} />
          <DetailRow label="Ownership" value={ownershipDuration} scale={scale} />
          <DetailRow label="Current Odometer" value={currentOdo} scale={scale} />
          <DetailRow label="Last Refill" value={lastFuelDate} scale={scale} />
          <DetailRow label="Fuel Spend" value={spendText} scale={scale} />
          <DetailRow label="Total Volume" value={totalLitresText} scale={scale} />
          <DetailRow label="Average Mileage" value={avgMileageText} scale={scale} />
          <DetailRow label="Running Cost" value={costPerKmText} scale={scale} />
          <DetailRow label="Refill Count" value={analytics.refillCount > 0 ? `${analytics.refillCount} refills` : '0 refills'} scale={scale} />
          <DetailRow label="Last Service" value={lastService} scale={scale} />
          <DetailRow label="Next Service" value={nextService} scale={scale} />
          <DetailRow label="Insurance" value={insuranceStatus} scale={scale} />
          <DetailRow label="PUC Status" value={pucStatus} scale={scale} />
          <DetailRow label="RC Status" value={rcStatus} scale={scale} />
          <DetailRow label="Health Score" value={`${healthScore} / 100`} scale={scale} />
        </View>

        {/* Back Footer */}
        <View style={styles.bottomRow}>
          <View>
            <Text style={[styles.periodLabel, { fontSize: 8 * scale, color: tierConfig.brandColor }]}>
              PASSPORT ID: {passportId}
            </Text>
            <Text style={[styles.secureText, { fontSize: 8 * scale }]}>
              Verified by Asset Doctor Vault · assetdoctor.in
            </Text>
          </View>
          <View style={styles.qrWrapper}>
            <QrBadge size={28 * scale} />
          </View>
        </View>
      </View>
    );
  }

  // FRONT VIEW: Obsidian Luxury Certificate
  return (
    <View
      style={[
        styles.card,
        {
          width,
          aspectRatio: 1.6,
          borderRadius: 22 * scale,
          padding: 18 * scale,
          backgroundColor: tierConfig.bg,
          borderColor: tierConfig.border,
          shadowColor: tierConfig.glow,
        },
      ]}
    >
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.brandTitle, { fontSize: 13 * scale, color: tierConfig.brandColor }]}>
            ASSET DOCTOR
          </Text>
          <Text style={[styles.certificateBadge, { fontSize: 9 * scale }]}>
            DIGITAL VEHICLE PASSPORT
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={[
              styles.verifiedPill,
              { backgroundColor: tierConfig.pillBg, borderColor: tierConfig.pillBorder },
            ]}
          >
            <Text style={[styles.verifiedText, { fontSize: 8.5 * scale, color: tierConfig.pillText }]}>
              {tierConfig.pillLabel}
            </Text>
          </View>
          {onToggleFlip ? (
            <Pressable onPress={onToggleFlip} style={styles.flipBtn}>
              <Text style={[styles.flipBtnText, { fontSize: 10 * scale, color: tierConfig.brandColor }]}>
                Details ⤾
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Vehicle Identity with Type Icon & Health Badge */}
      <View style={styles.identityRow}>
        <View style={styles.vehicleInfoLeft}>
          <View style={[styles.vehicleIconBadge, { borderColor: tierConfig.pillBorder }]}>
            <PremiumIcon name={pres.icon} size={22 * scale} color={tierConfig.accent} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 * scale }}>
            <Text style={[styles.vehicleName, { fontSize: 17 * scale }]} numberOfLines={1}>
              {pres.displayName}
            </Text>
            <View style={styles.subIdentityRow}>
              {plate ? (
                <Text style={[styles.plateText, { fontSize: 10.5 * scale }]}>
                  {plate}
                </Text>
              ) : null}
              <Text style={[styles.vehicleTypeTag, { fontSize: 10 * scale, color: tierConfig.brandColor }]}>
                • {pres.vehicleType}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.healthBox}>
          <Text style={[styles.healthScore, { fontSize: 22 * scale, color: tierConfig.accent }]}>
            {healthScore}
          </Text>
          <Text style={[styles.healthLabel, { fontSize: 8 * scale }]}>HEALTH</Text>
        </View>
      </View>

      {/* Premium Metric Highlights Grid */}
      <View style={styles.metricGrid}>
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { fontSize: 8.5 * scale }]}>TOTAL KM</Text>
          <Text style={[styles.metricVal, { fontSize: 12.5 * scale }]} numberOfLines={1}>
            {analytics.totalDistanceKm != null && analytics.totalDistanceKm > 0
              ? `${analytics.totalDistanceKm.toLocaleString('en-IN')} km`
              : '—'}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { fontSize: 8.5 * scale }]}>AVG MILEAGE</Text>
          <Text style={[styles.metricVal, { fontSize: 12.5 * scale }]} numberOfLines={1}>
            {analytics.averageMileageKmPerL != null && analytics.averageMileageKmPerL > 0
              ? `${analytics.averageMileageKmPerL} km/L`
              : '—'}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { fontSize: 8.5 * scale }]}>REFILLS</Text>
          <Text style={[styles.metricVal, { fontSize: 12.5 * scale }]} numberOfLines={1}>
            {analytics.refillCount > 0 ? `${analytics.refillCount}` : '—'}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={[styles.metricLabel, { fontSize: 8.5 * scale }]}>FUEL SPEND</Text>
          <Text style={[styles.metricVal, { fontSize: 12.5 * scale }]} numberOfLines={1}>
            {spendText}
          </Text>
        </View>
      </View>

      {/* Bottom Passport Row */}
      <View style={styles.bottomRow}>
        <View>
          <Text style={[styles.periodLabel, { fontSize: 8.5 * scale, color: tierConfig.brandColor }]}>
            PERIOD: {passportPeriod} · ID: {passportId}
          </Text>
          <Text style={[styles.secureText, { fontSize: 7.5 * scale }]}>
            Verified by Asset Doctor Vault · assetdoctor.in
          </Text>
        </View>
        <View style={styles.qrWrapper}>
          <QrBadge size={30 * scale} />
        </View>
      </View>
    </View>
  );
}

function DetailRow({ label, value, scale = 1 }: { label: string; value: string; scale?: number }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { fontSize: 9 * scale }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.detailVal, { fontSize: 9 * scale }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    justifyContent: 'space-between',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandTitle: {
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  certificateBadge: {
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  verifiedPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  verifiedText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  flipBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  flipBtnText: {
    fontWeight: '700',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  vehicleInfoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleName: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  subIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  plateText: {
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  vehicleTypeTag: {
    fontWeight: '600',
    marginLeft: 6,
  },
  healthBox: {
    alignItems: 'center',
    marginLeft: 8,
  },
  healthScore: {
    fontWeight: '800',
    lineHeight: 26,
  },
  healthLabel: {
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.md,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  metricVal: {
    color: '#F8FAFC',
    fontWeight: '700',
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
  },
  periodLabel: {
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  secureText: {
    color: '#64748B',
    marginTop: 2,
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 3,
    borderRadius: RADIUS.xs,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: RADIUS.md,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  detailRow: {
    width: '49%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  detailLabel: {
    color: '#94A3B8',
    fontWeight: '500',
  },
  detailVal: {
    color: '#F8FAFC',
    fontWeight: '700',
    textAlign: 'right',
  },
});

export default MonthlyBlackCard;

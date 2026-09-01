/**
 * Asset Doctor — 🖤 MONTHLY RIDE PASSPORT (matte-black luxury card)
 *
 * A premium "bank card" style monthly Vehicle Passport:
 *   - Matte-black + brass/teal accents, embossed plate text, EMV chip
 *   - Main total-distance metric + health score (via existing calculateHealthScore)
 *   - Monthly highlights: avg mileage, running cost, total spend, fuel used
 *   - "VERIFIED PASSPORT" foil seal + QR
 *   - Privacy toggles: mask plate / mask spend
 *
 * Designed to be captured via ViewShot for 1-tap sharing.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { calculateHealthScore } from '../../utils/healthScore';
import {
  computeMonthlyMetrics,
  maskVehicleNumber,
  maskSpend,
} from '../../services/fuel/fuelMetrics';
import { QrBadge } from './QrBadge';

interface Props {
  asset: Record<string, any> | null | undefined;
  logs: Array<Record<string, any>>;
  monthKey: string; // 'YYYY-MM'
  maskNumber?: boolean;
  maskSpend?: boolean;
  width?: number; // default 360 card width scale
}

const BASE_W = 360;

function fmt(n: number | null | undefined, d = 1, suffix = ''): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toFixed(d)}${suffix}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const names = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${names[(m || 1) - 1]} ${y}`;
}

export function MonthlyBlackCard({
  asset,
  logs,
  monthKey,
  maskNumber = false,
  maskSpend: maskSpendFlag = false,
  width = BASE_W,
}: Props) {
  const scale = (width || BASE_W) / BASE_W;
  const health = useMemo(() => calculateHealthScore(asset || {}), [asset]);
  const metric = useMemo(
    () => computeMonthlyMetrics(monthKey, logs, asset || {}),
    [monthKey, logs, asset],
  );

  const name = String(asset?.assetName || 'Vehicle');
  const reg = String(asset?.registration || asset?.serialNumber || '');
  const plate = maskVehicleNumber(reg, maskNumber);
  const spendText = maskSpend(metric.totalSpendInr, maskSpendFlag);

  return (
    <View
      style={[
        styles.card,
        { width, aspectRatio: 8 / 5, borderRadius: 26 * scale, padding: 26 * scale },
      ]}
    >
      {/* Satin sheen */}
      <View style={styles.sheen} pointerEvents="none" />

      {/* Brand row */}
      <View style={styles.brandRow}>
        <Text style={[styles.brand, { fontSize: 15 * scale, letterSpacing: 1.4 * scale }]}>
          ASSET DOCTOR
        </Text>
        <Text style={[styles.typeText, { fontSize: 9 * scale }]}>RIDE PASSPORT</Text>
      </View>

      {/* EMV chip + health */}
      <View style={styles.chipRow}>
        <View style={[styles.emv, { width: 40 * scale, height: 30 * scale, borderRadius: 6 * scale }]}>
          <View style={styles.emvInner} />
        </View>
        <View style={styles.healthWrap}>
          <Text style={[styles.healthLabel, { fontSize: 8 * scale }]}>HEALTH</Text>
          <Text style={[styles.healthScore, { fontSize: 22 * scale, color: healthTone(health.score) }]}>
            {health.score}
          </Text>
        </View>
      </View>

      {/* Plate */}
      <Text style={[styles.plateName, { fontSize: 15 * scale }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.plateNumber, { fontSize: 13 * scale, letterSpacing: 1.2 * scale }]}>
        {plate}
      </Text>

      {/* Distance hero */}
      <View style={styles.metricHero}>
        <Text style={styles.metricHeroLabel}>TOTAL DISTANCE</Text>
        <View style={styles.metricHeroRow}>
          <Text style={[styles.metricHeroValue, { fontSize: 34 * scale }]}>
            {metric.totalDistanceKm != null ? metric.totalDistanceKm.toLocaleString('en-IN') : '—'}
          </Text>
          <Text style={[styles.metricHeroUnit, { fontSize: 12 * scale }]}>km</Text>
        </View>
        <Text style={[styles.monthCaption, { fontSize: 9 * scale }]}>{monthLabel(monthKey)}</Text>
      </View>

      {/* Highlights */}
      <View style={styles.highlights}>
        <View style={styles.hl}>
          <Text style={[styles.hlLabel, { fontSize: 8 * scale }]}>AVG MILEAGE</Text>
          <Text style={[styles.hlValue, { fontSize: 13 * scale }]}>
            {fmt(metric.averageMileageKmPerL)} km/L
          </Text>
        </View>
        <View style={styles.hl}>
          <Text style={[styles.hlLabel, { fontSize: 8 * scale }]}>COST / KM</Text>
          <Text style={[styles.hlValue, { fontSize: 13 * scale }]}>
            {metric.runningCostPerKm != null ? `₹${fmt(metric.runningCostPerKm, 2)}` : '—'}
          </Text>
        </View>
        <View style={styles.hl}>
          <Text style={[styles.hlLabel, { fontSize: 8 * scale }]}>FUEL USED</Text>
          <Text style={[styles.hlValue, { fontSize: 13 * scale }]}>
            {metric.litersUsed != null ? `${fmt(metric.litersUsed, 1)}L` : '—'}
          </Text>
        </View>
      </View>

      {/* Footer seal + QR */}
      <View style={styles.footer}>
        <View style={styles.seal}>
          <View style={styles.sealDot} />
          <Text style={[styles.sealText, { fontSize: 8 * scale }]}>VERIFIED PASSPORT</Text>
        </View>
        <View style={[styles.spendBox]}>
          <Text style={[styles.spendLabel, { fontSize: 8 * scale }]}>TOTAL SPEND</Text>
          <Text style={[styles.spendValue, { fontSize: 14 * scale }]}>{spendText}</Text>
        </View>
        <QrBadge size={46 * scale} elevated />
      </View>
    </View>
  );
}

function healthTone(score: number): string {
  if (score >= 85) return '#10B981';
  if (score >= 70) return '#FBBF24';
  return '#F87171';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#05090D',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(110,231,183,0.30)',
    position: 'relative',
    overflow: 'hidden',
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,184,166,0.05)',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { color: '#CDE9E2', fontWeight: '900' },
  typeText: { color: '#3F6F6A', fontWeight: '800', letterSpacing: 1 },
  chipRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  emv: {
    backgroundColor: '#D8B56A',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emvInner: {
    width: '72%',
    height: '58%',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(8,10,14,0.4)',
  },
  healthWrap: { marginLeft: 12 },
  healthLabel: { color: '#3F6F6A', fontWeight: '800', letterSpacing: 0.8 },
  healthScore: { fontWeight: '900', lineHeight: 24 },
  plateName: { color: '#EAF9F5', fontWeight: '800', marginTop: 16 },
  plateNumber: { color: '#9CC7BD', fontWeight: '700', marginTop: 2 },
  metricHero: { marginTop: 16 },
  metricHeroLabel: { color: '#3F6F6A', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  metricHeroRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  metricHeroValue: { color: '#FFFFFF', fontWeight: '900', fontVariant: ['tabular-nums'] },
  metricHeroUnit: { color: '#5FA89C', fontWeight: '700', marginLeft: 4 },
  monthCaption: { color: '#3F6F6A', fontWeight: '700', marginTop: 1 },
  highlights: { flexDirection: 'row', marginTop: 16 },
  hl: { flex: 1 },
  hlLabel: { color: '#3F6F6A', fontWeight: '800', letterSpacing: 0.8 },
  hlValue: { color: '#EAF9F5', fontWeight: '800', marginTop: 3, fontVariant: ['tabular-nums'] },
  footer: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  seal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  sealDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 6 },
  sealText: { color: '#6EE7B7', fontWeight: '900', letterSpacing: 0.8 },
  spendBox: { marginLeft: 'auto', marginRight: 12, alignItems: 'flex-end' },
  spendLabel: { color: '#3F6F6A', fontWeight: '800', letterSpacing: 0.8 },
  spendValue: { color: '#10B981', fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
});

export default MonthlyBlackCard;

/**
 * Asset Doctor — Fuel Share Square (1:1 FEED canvas)
 *
 * A self-contained 1080×1080 brand card used as the capture target for
 * Instagram/LinkedIn/WhatsApp posts. High contrast black + teal with the
 * shield logo, trip stats, QR + store footer. Pure <View>/<Text> so it
 * renders predictably inside a ViewShot.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { computeTripMetrics, maskVehicleNumber, maskSpend } from '../../services/fuel/fuelMetrics';
import { PremiumIcon } from '../../design-system/icons';
import { QrBadge } from './QrBadge';

interface Props {
  asset: Record<string, any> | null | undefined;
  logs: Array<Record<string, any>>;
}

function fmt(n: number | null | undefined, d = 1, suffix = ''): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toFixed(d)}${suffix}`;
}

const W = 1080;

export function FuelShareSquare({ asset, logs }: Props) {
  const trip = computeTripMetrics(logs, asset || {});
  const name = String(asset?.assetName || 'Vehicle');
  const reg = String(asset?.registration || '');

  return (
    <View style={[styles.canvas, { width: W, height: W, backgroundColor: '#08141C' }]}>
      {/* Brand header */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <PremiumIcon name="shield-check" size={56} color="#14B8A6" />
        </View>
        <View style={{ flex: 1, marginLeft: 24 }}>
          <Text style={styles.brand}>ASSET DOCTOR</Text>
          <Text style={styles.stamp}>FUEL IMPACT · VERIFIED</Text>
        </View>
      </View>

      {/* Vehicle identity */}
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.number}>{maskVehicleNumber(reg, false)}</Text>

      {/* Hero distance */}
      <View style={styles.hero}>
        <Text style={styles.heroValue}>{trip.tripDistanceKm != null ? trip.tripDistanceKm.toLocaleString('en-IN') : '—'} km</Text>
        <Text style={styles.heroUnit}>Trip Distance</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Mileage</Text>
          <Text style={styles.statValue}>{fmt(trip.tripMileageKmPerL)} km/L</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Cost/km</Text>
          <Text style={styles.statValue}>{trip.runningCostPerKm ? `₹${fmt(trip.runningCostPerKm, 2)}` : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Spend</Text>
          <Text style={styles.statValue}>{maskSpend(trip.fuelSpentInr, false)}</Text>
        </View>
      </View>

      {/* Verdict line */}
      <View style={styles.verdictRow}>
        <Text style={styles.verdictText}>{trip.benchmarkText}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerTagline}>Manage mileage, health & documents in one vault.</Text>
          <Text style={styles.footerCredit}>assetdoctor.in · by Ashutosh Rai</Text>
        </View>
        <QrBadge size={120} elevated />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { padding: 64 },
  header: { flexDirection: 'row', alignItems: 'center' },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: 'rgba(20,184,166,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: '#6EE7B7', fontSize: 40, fontWeight: '900', letterSpacing: 1 },
  stamp: { color: '#3F6F6A', fontSize: 22, fontWeight: '800', letterSpacing: 3, marginTop: 10 },
  name: { color: '#FFFFFF', fontSize: 52, fontWeight: '900', marginTop: 48 },
  number: { color: '#7FB3A8', fontSize: 30, fontWeight: '700', marginTop: 8, letterSpacing: 2 },
  hero: { marginTop: 48 },
  heroValue: { color: '#FFFFFF', fontSize: 96, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  heroUnit: { color: '#5FA89C', fontSize: 28, fontWeight: '700', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 20, marginTop: 36 },
  stat: {
    flex: 1,
    padding: 22,
    borderRadius: 24,
    backgroundColor: '#0B2830',
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.20)',
  },
  statLabel: { color: '#3F6F6A', fontSize: 20, fontWeight: '800' },
  statValue: { color: '#EAF9F5', fontSize: 32, fontWeight: '800', marginTop: 12, fontVariant: ['tabular-nums'] },
  verdictRow: { marginTop: 28 },
  verdictText: { color: '#10B981', fontSize: 28, fontWeight: '800' },
  footer: {
    position: 'absolute',
    left: 64,
    right: 64,
    bottom: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 28,
    borderTopWidth: 2,
    borderTopColor: 'rgba(110,231,183,0.18)',
  },
  footerTagline: { color: '#7FB3A8', fontSize: 24, fontWeight: '600', lineHeight: 30 },
  footerCredit: { color: '#3F6F6A', fontSize: 20, fontWeight: '800', marginTop: 10 },
});

export default FuelShareSquare;

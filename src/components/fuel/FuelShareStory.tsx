/**
 * Asset Doctor — Fuel Share Story (9:16 canvas)
 *
 * Vertical 1080×1920 brand card for Instagram/WhatsApp Status stories.
 * Self-contained capture target for ViewShot.
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
const H = 1920;

export function FuelShareStory({ asset, logs }: Props) {
  const trip = computeTripMetrics(logs, asset || {});
  const name = String(asset?.assetName || 'Vehicle');
  const reg = String(asset?.registration || '');

  return (
    <View style={{ width: W, height: H, backgroundColor: '#08141C', padding: 72 }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <PremiumIcon name="shield-check" size={64} color="#14B8A6" />
        </View>
        <View style={{ flex: 1, marginLeft: 28 }}>
          <Text style={styles.brand}>ASSET DOCTOR</Text>
          <Text style={styles.stamp}>FUEL IMPACT · VERIFIED</Text>
        </View>
      </View>

      {/* Identity */}
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.number}>{maskVehicleNumber(reg, false)}</Text>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroValue}>
          {trip.tripDistanceKm != null ? trip.tripDistanceKm.toLocaleString('en-IN') : '—'} km
        </Text>
        <Text style={styles.heroUnit}>Trip Distance this stretch</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsBlock}>
        <View style={styles.largeStat}>
          <Text style={styles.largeLabel}>True Mileage</Text>
          <Text style={styles.largeValue}>{fmt(trip.tripMileageKmPerL)} km/L</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Cost / km</Text>
            <Text style={styles.statValue}>{trip.runningCostPerKm ? `₹${fmt(trip.runningCostPerKm, 2)}` : '—'}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Fuel Spent</Text>
            <Text style={styles.statValue}>{maskSpend(trip.fuelSpentInr, false)}</Text>
          </View>
        </View>
      </View>

      {/* Verdict */}
      <View style={styles.verdictRow}>
        <Text style={styles.verdictText}>{trip.benchmarkText}</Text>
      </View>

      {/* Footer Q + brand. Q positioned to avoid Story bottom UI ~ leave padding. */}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerTagline}>Track mileage, health & every document in one vault.</Text>
          <Text style={styles.footerCredit}>assetdoctor.in · by Ashutosh Rai</Text>
        </View>
        <QrBadge size={150} elevated />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  logoWrap: {
    width: 120,
    height: 120,
    borderRadius: 34,
    backgroundColor: 'rgba(20,184,166,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: '#6EE7B7', fontSize: 46, fontWeight: '900', letterSpacing: 1 },
  stamp: { color: '#3F6F6A', fontSize: 24, fontWeight: '800', letterSpacing: 3, marginTop: 10 },
  name: { color: '#FFFFFF', fontSize: 64, fontWeight: '900', marginTop: 56 },
  number: { color: '#7FB3A8', fontSize: 34, fontWeight: '700', marginTop: 12, letterSpacing: 2 },
  hero: { marginTop: 56 },
  heroValue: { color: '#FFFFFF', fontSize: 130, fontWeight: '900', letterSpacing: -3, fontVariant: ['tabular-nums'] },
  heroUnit: { color: '#5FA89C', fontSize: 32, fontWeight: '700', marginTop: 8 },
  statsBlock: { marginTop: 44 },
  largeStat: {
    padding: 30,
    borderRadius: 26,
    backgroundColor: '#0B2830',
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.22)',
  },
  largeLabel: { color: '#3F6F6A', fontSize: 22, fontWeight: '800' },
  largeValue: { color: '#10B981', fontSize: 60, fontWeight: '900', marginTop: 12, fontVariant: ['tabular-nums'] },
  statsRow: { flexDirection: 'row', gap: 20, marginTop: 20 },
  stat: {
    flex: 1,
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#07131C',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.16)',
  },
  statLabel: { color: '#3F6F6A', fontSize: 20, fontWeight: '800' },
  statValue: { color: '#EAF9F5', fontSize: 36, fontWeight: '800', marginTop: 10, fontVariant: ['tabular-nums'] },
  verdictRow: { marginTop: 28 },
  verdictText: { color: '#10B981', fontSize: 32, fontWeight: '800' },
  footer: {
    position: 'absolute',
    left: 72,
    right: 72,
    bottom: 120,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 26,
    borderTopWidth: 2,
    borderTopColor: 'rgba(110,231,183,0.18)',
  },
  footerTagline: { color: '#7FB3A8', fontSize: 26, fontWeight: '600', lineHeight: 34 },
  footerCredit: { color: '#3F6F6A', fontSize: 22, fontWeight: '800', marginTop: 12 },
});

export default FuelShareStory;

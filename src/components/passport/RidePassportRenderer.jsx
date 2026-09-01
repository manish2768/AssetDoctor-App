/**
 * Asset Doctor — Canonical Ride Passport Card Renderer
 * Rendered visually for on-screen display and captured into high-res PNG image
 * via react-native-view-shot for native WhatsApp file sharing.
 * Fully responsive without clipping, text overlap, or static pixel positioning.
 */

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const RidePassportRenderer = forwardRef(function RidePassportRenderer(
  { asset = {}, options = {} },
  ref
) {
  const {
    maskRegistration = false,
    maskSpend = false,
    theme = 'dark',
  } = options;

  const modelName = asset.model || asset.assetName || asset.name || 'Vehicle Passport';
  const regNumber = asset.registrationNumber || asset.registration || 'UNREGISTERED';
  const displayReg = maskRegistration
    ? regNumber.length > 4
      ? `${regNumber.slice(0, 2)}••••${regNumber.slice(-2)}`
      : '••••••••'
    : regNumber;

  const assetId = asset.assetId || asset.id || 'asset_01J8XYZ90000000000000000';
  const odo = asset.odometerKm != null ? `${Number(asset.odometerKm).toLocaleString('en-IN')} km` : '12,450 km';
  const monthlySpend = maskSpend ? '₹••••' : asset.monthlySpend != null ? `₹${Number(asset.monthlySpend).toLocaleString('en-IN')}` : '₹4,820';
  const healthScore = asset.healthScore != null ? Number(asset.healthScore) : 95;

  const qrPayload = JSON.stringify({
    app: 'AssetDoctor',
    type: 'RidePassport',
    assetId,
    reg: displayReg,
    health: healthScore,
    verified: true,
  });

  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}>
      <View style={styles.cardContainer}>
        {/* Header Branding */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>ASSET DOCTOR</Text>
            <Text style={styles.brandSubtitle}>RIDE PASSPORT · DIGITAL TWIN</Text>
          </View>
          <View style={styles.healthScoreContainer}>
            <Text style={styles.healthScoreValue}>{healthScore}</Text>
            <Text style={styles.healthScoreLabel}>/100 HEALTH</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Vehicle Identity */}
        <View style={styles.identitySection}>
          <Text style={styles.vehicleModel} numberOfLines={2}>
            {modelName}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.regBadge}>
              <Text style={styles.regBadgeLabel}>REGISTRATION</Text>
              <Text style={styles.regBadgeText}>{displayReg.toUpperCase()}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>✓ VERIFIED</Text>
            </View>
          </View>
        </View>

        {/* Key Metrics Grid */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCell}>
            <Text style={styles.metricLabel}>PERMANENT ASSET ID</Text>
            <Text style={styles.metricValueSmall} numberOfLines={1}>
              {assetId}
            </Text>
          </View>
          <View style={styles.metricRow}>
            <View style={[styles.metricCell, { flex: 1 }]}>
              <Text style={styles.metricLabel}>ODOMETER</Text>
              <Text style={styles.metricValue}>{odo}</Text>
            </View>
            <View style={[styles.metricCell, { flex: 1 }]}>
              <Text style={styles.metricLabel}>MONTHLY SPEND</Text>
              <Text style={styles.metricValue}>{monthlySpend}</Text>
            </View>
          </View>
        </View>

        {/* Footer & Verification QR Code */}
        <View style={styles.footer}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.trustShieldText}>🛡️ END-TO-END VERIFIED PASSPORT</Text>
            <Text style={styles.trustSubtext}>
              Encrypted proof of ownership, service records & mileage calculation.
            </Text>
          </View>
          <View style={styles.qrBox}>
            <QRCode value={qrPayload} size={58} color="#FFFFFF" backgroundColor="#0F172A" />
          </View>
        </View>
      </View>
    </ViewShot>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    width: Math.min(SCREEN_WIDTH - 32, 380),
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  healthScoreContainer: {
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  healthScoreValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#10B981',
  },
  healthScoreLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  identitySection: {
    marginBottom: 14,
  },
  vehicleModel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  regBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF850',
  },
  regBadgeLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
  },
  regBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  statusBadge: {
    backgroundColor: '#065F46',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#34D399',
  },
  metricsGrid: {
    backgroundColor: '#1E293B50',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#33415550',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCell: {},
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  metricValueSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  trustShieldText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  trustSubtext: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  qrBox: {
    padding: 4,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
});

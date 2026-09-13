/**
 * Asset Doctor — Parking Assistant Screen
 *
 * Shows the vehicle's Parking QR code with share actions.
 * QR is fetched idempotently — never generates a new QR on every open.
 * Only accessible for vehicle assets (isVehicleAsset guard is enforced upstream).
 *
 * Navigation: navigate('ParkingAssistant', { asset })
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthProvider';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { assetIdOf } from '../../services/assets/assetIdentity';
import {
  buildParkingQrUrl,
  getOrGenerateParkingQr,
  PARKING_QR_STATUS,
} from '../../services/parking/ParkingQrService';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';

// QRCode is optional — graceful fallback if package not yet installed.
let QRCode = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch {
  /* package not installed — URL-only fallback shown */
}

export function ParkingAssistantScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { user } = useAuth();

  const asset = route?.params?.asset;
  const canonicalId = assetIdOf(asset);
  const vehicleNumber =
    asset?.registration ||
    asset?.registrationNumber ||
    asset?.assetName ||
    '';

  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadOrGenerateQr = useCallback(async () => {
    if (!canonicalId || !user?.uid) {
      setError('Unable to identify vehicle. Please try again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getOrGenerateParkingQr(asset, user.uid);
      if (result?.error) {
        setError(result.error);
      } else {
        setQrData(result);
      }
    } catch (err) {
      setError('Failed to load Parking QR. Please check your connection.');
      console.error('[ParkingAssistantScreen] load error:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [canonicalId, user?.uid]);

  useEffect(() => {
    loadOrGenerateQr();
  }, [loadOrGenerateQr]);

  const qrUrl = qrData?.qrCode ? buildParkingQrUrl(qrData.qrCode) : null;

  const onShare = async () => {
    if (!qrUrl) return;
    Haptics.tap();
    try {
      await Share.share({
        title: 'My Parking Assistant QR',
        message: `Scan this QR to send me a parking alert for my vehicle${vehicleNumber ? ` (${vehicleNumber})` : ''}.\n\n${qrUrl}\n\nPowered by Asset Doctor — Privacy Protected.`,
        url: qrUrl,
      });
    } catch {
      /* user cancelled share */
    }
  };

  const styles = makeStyles(colors);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => {
            Haptics.tap();
            navigation.goBack();
          }}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>
        <Text
          style={[TYPE.h2, { color: colors.text, flex: 1, textAlign: 'center' }]}
          numberOfLines={1}
        >
          Parking Assistant
        </Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main QR Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            elevation(2, colors.shadow),
          ]}
        >
          <Text style={[styles.cardLabel, { color: colors.primary }]}>🅿️ PARKING ASSISTANT</Text>

          {vehicleNumber ? (
            <Text
              style={[TYPE.h3, { color: colors.text, textAlign: 'center', marginBottom: 4 }]}
            >
              {vehicleNumber}
            </Text>
          ) : null}

          <Text
            style={[TYPE.bodySmall, { color: colors.textMuted, textAlign: 'center', marginBottom: 16 }]}
          >
            🔒 Owner contact details protected
          </Text>

          {/* QR Code Area */}
          {loading ? (
            <View style={styles.qrPlaceholder}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[TYPE.bodySmall, { color: colors.textMuted, marginTop: 12 }]}>
                Loading Parking QR…
              </Text>
            </View>
          ) : error ? (
            <View style={styles.qrPlaceholder}>
              <Text
                style={[TYPE.body, { color: colors.danger || '#EF4444', textAlign: 'center' }]}
              >
                {error}
              </Text>
              <Pressable
                onPress={loadOrGenerateQr}
                style={[styles.retryBtn, { borderColor: colors.primary }]}
                accessibilityRole="button"
              >
                <Text style={[TYPE.caption, { color: colors.primary, fontWeight: '700' }]}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : qrUrl ? (
            <View style={styles.qrBox}>
              {QRCode ? (
                <QRCode
                  value={qrUrl}
                  size={200}
                  color={colors.text}
                  backgroundColor={colors.surface}
                  quietZone={12}
                  ecl="M"
                />
              ) : (
                /* Graceful fallback when react-native-qrcode-svg is not installed */
                <View style={styles.qrFallback}>
                  <Text style={[TYPE.bodySmall, { color: colors.textMuted, textAlign: 'center' }]}>
                    QR display requires{'\n'}react-native-qrcode-svg
                  </Text>
                </View>
              )}
              <Text style={[styles.qrCodeText, { color: colors.textMuted }]}>
                {qrData?.qrCode}
              </Text>
              <Text
                style={[TYPE.caption, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}
                numberOfLines={1}
                selectable
              >
                {qrUrl}
              </Text>
            </View>
          ) : null}

          {/* Status Badge */}
          {qrData?.status === PARKING_QR_STATUS.ACTIVE ? (
            <View style={[styles.statusBadge, { backgroundColor: '#10B98120', borderColor: '#10B981' }]}>
              <Text style={[TYPE.label, { color: '#10B981' }]}>✓ ACTIVE</Text>
            </View>
          ) : qrData?.status === PARKING_QR_STATUS.DISABLED ? (
            <View style={[styles.statusBadge, { backgroundColor: '#EF444420', borderColor: '#EF4444' }]}>
              <Text style={[TYPE.label, { color: '#EF4444' }]}>INACTIVE</Text>
            </View>
          ) : null}
        </View>

        {/* Share Action */}
        {qrUrl ? (
          <View style={styles.actionsWrap}>
            <Pressable
              onPress={onShare}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Share Parking QR"
            >
              <Text style={styles.actionBtnText}>↑  Share Parking QR</Text>
            </Pressable>
          </View>
        ) : null}

        {/* How it works */}
        <View
          style={[styles.infoCard, { backgroundColor: colors.surfaceMuted || colors.surface, borderColor: colors.border }]}
        >
          <Text style={[TYPE.h3, { color: colors.text, marginBottom: 8 }]}>How it works</Text>
          {[
            '📌 Print or display this QR on your vehicle dashboard.',
            '📱 Anyone can scan it to send you an instant parking alert.',
            '🔔 You\'ll get a push notification when someone reports an issue.',
            '🔒 Your phone number stays private — always.',
          ].map((line) => (
            <Text key={line} style={[TYPE.bodySmall, { color: colors.textMuted, marginBottom: 4 }]}>
              {line}
            </Text>
          ))}
        </View>

        {/* Alert types preview */}
        <View
          style={[styles.alertTypesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text
            style={[TYPE.label, { color: colors.textMuted, marginBottom: 12 }]}
          >
            SCANNERS CAN REPORT
          </Text>
          {[
            { emoji: '🚨', label: 'Vehicle Blocking Me' },
            { emoji: '🅿️', label: 'Wrong Parking' },
            { emoji: '💡', label: 'Lights / Window Left Open' },
            { emoji: '⚠️', label: 'Vehicle Issue' },
            { emoji: '❤️', label: 'Emergency' },
          ].map((item) => (
            <View key={item.label} style={styles.alertTypeRow}>
              <Text style={styles.alertEmoji}>{item.emoji}</Text>
              <Text style={[TYPE.body, { color: colors.text }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* QR code generated/updated info */}
        {qrData?.createdAt ? (
          <Text style={[TYPE.micro, { color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm }]}>
            QR generated {new Date(qrData.createdAt).toLocaleDateString('en-IN')}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    backBtn: {
      width: 56,
      paddingVertical: 4,
    },
    backText: {
      fontSize: 18,
      fontWeight: '600',
    },
    scroll: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
    },
    card: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      padding: SPACING.xl,
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    cardLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    qrBox: {
      alignItems: 'center',
      marginVertical: SPACING.md,
    },
    qrFallback: {
      width: 200,
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
    },
    qrCodeText: {
      marginTop: 10,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      letterSpacing: 1,
    },
    qrPlaceholder: {
      height: 224,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    statusBadge: {
      borderRadius: RADIUS.full,
      borderWidth: 1,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      marginTop: SPACING.xs,
    },
    retryBtn: {
      marginTop: SPACING.sm,
      borderRadius: RADIUS.sm,
      borderWidth: 1.5,
      paddingHorizontal: SPACING.md,
      paddingVertical: 8,
    },
    actionsWrap: {
      marginBottom: SPACING.md,
    },
    actionBtn: {
      borderRadius: RADIUS.md,
      paddingVertical: 14,
      alignItems: 'center',
    },
    actionBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    infoCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    alertTypesCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    alertTypeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      gap: 10,
    },
    alertEmoji: {
      fontSize: 18,
      width: 28,
      textAlign: 'center',
    },
  });
}

export default ParkingAssistantScreen;

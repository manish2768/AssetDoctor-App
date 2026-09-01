/**
 * Asset Doctor — QrBadge
 *
 * Renders the branded QR code used on the Refill Impact Card + Monthly
 * Vehicle Passport + share canvases. Uses react-native-qrcode-svg (SVG-based,
 * works with react-native-svg which is already installed).
 *
 * If the package is not installed, we render a defensive fallback tile so the
 * card still composes without crashing.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '../../context/ThemeProvider';
import { getInstallUrl } from '../../services/share/cardShare';

let QRCode: any = null;
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  QRCode = require('react-native-qrcode-svg').default;
} catch {
  QRCode = null;
}

interface QrBadgeProps {
  size?: number; // box size in px
  url?: string;
  dark?: boolean;
  elevated?: boolean;
}

export function QrBadge({ size = 84, url, dark = false, elevated = false }: QrBadgeProps) {
  const colors = useThemeColors();
  const data = url || getInstallUrl();

  if (!QRCode) {
    // Graceful fallback — show a neutral "QR" tile (card still composes).
    return (
      <View
        style={[
          styles.fallback,
          {
            width: size,
            height: size,
            backgroundColor: elevated ? '#07111F' : colors.surfaceMuted,
            borderColor: elevated ? 'rgba(255,255,255,0.18)' : colors.border,
          },
        ]}
      >
        <Text style={[styles.fallbackText, { color: elevated ? '#BBD7CE' : colors.textMuted }]}>
          QR
        </Text>
      </View>
    );
  }

  return (
    <QRCode
      value={String(data)}
      size={size}
      color={elevated ? '#FFFFFF' : '#07111F'}
      backgroundColor="transparent"
      ecl="M"
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default QrBadge;

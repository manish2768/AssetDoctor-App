/**
 * Invoice Postcard — glass card preview with tap-to-zoom fullscreen modal.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';

import { COLORS, RADIUS, SPACING } from '../theme/branding';
import { Haptics } from '../services/haptics';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function InvoicePostcard({
  imageUri,
  title = 'Invoice postcard',
  subtitle = 'Tap to zoom',
  shopName = '',
  totalLabel = '',
}) {
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!imageUri) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>No invoice image</Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.select();
          setZoomOpen(true);
        }}
        style={styles.postcard}
      >
        <View style={styles.glowBorder}>
          <View style={styles.glassInner}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.metaOverlay}>
              <Text style={styles.metaTitle} numberOfLines={1}>
                {shopName || title}
              </Text>
              <Text style={styles.metaSub} numberOfLines={1}>
                {totalLabel ? `${totalLabel} · ${subtitle}` : subtitle}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      <Modal
        visible={zoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomOpen(false)}
        statusBarTranslucent
      >
        <StatusBar barStyle="light-content" />
        <Pressable
          style={styles.zoomBackdrop}
          onPress={() => {
            Haptics.tap();
            setZoomOpen(false);
          }}
        >
          <Image source={{ uri: imageUri }} style={styles.zoomImage} resizeMode="contain" />
          <Text style={styles.zoomHint}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  postcard: {
    marginBottom: SPACING.md,
  },
  glowBorder: {
    borderRadius: RADIUS.lg,
    padding: 2,
    backgroundColor: 'rgba(74,168,154,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(79,172,254,0.55)',
    shadowColor: '#4FACFE',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  glassInner: {
    borderRadius: RADIUS.lg - 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  preview: {
    width: '100%',
    aspectRatio: 1.35,
    backgroundColor: COLORS.bgElevated,
  },
  metaOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(8,12,20,0.72)',
  },
  metaTitle: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  metaSub: {
    color: 'rgba(248,250,252,0.75)',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  emptyCard: {
    height: 120,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyText: { color: COLORS.muted, fontWeight: '600' },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  zoomImage: {
    width: SCREEN_W - 16,
    height: SCREEN_H * 0.78,
  },
  zoomHint: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 16,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default InvoicePostcard;

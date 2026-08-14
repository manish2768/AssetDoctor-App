/**
 * Post-save Share Asset card — WhatsApp / Instagram / system share.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Share,
  Linking,
  Alert,
} from 'react-native';

import { COLORS, RADIUS, SPACING, BRAND } from '../theme/branding';
import { GlassButton } from './ui/Glass';
import { Haptics } from '../services/haptics';
import { formatINRExact } from '../utils/format';
import { ShareService } from '../services/share/ShareService';

function buildCaption({ name, price }) {
  const priceText =
    price != null && Number(price) > 0 ? ` · ${formatINRExact(Number(price))}` : '';
  return `🛡️ Vaulted with ${BRAND.name}: ${name || 'My Asset'}${priceText}\nProtect, Track & Save — ${BRAND.tagline}`;
}

export function ShareAssetModal({
  visible,
  onClose,
  onDone,
  assetName = '',
  price = null,
  imageUri = '',
}) {
  const caption = buildCaption({ name: assetName, price });

  const finish = () => {
    onClose?.();
    onDone?.();
  };

  const shareWhatsApp = async () => {
    Haptics.tap();
    const result = await ShareService.shareViaWhatsApp({ message: caption });
    if (!result?.success) {
      try {
        await Share.share({ message: caption });
      } catch {
        Alert.alert('Share', result?.error || 'Could not open WhatsApp');
      }
    }
  };

  const shareInstagram = async () => {
    Haptics.tap();
    try {
      const ig = 'instagram://app';
      const can = await Linking.canOpenURL(ig);
      if (can) {
        await Linking.openURL(ig);
        // Also push system share so user can stick the card caption
        setTimeout(() => {
          Share.share({ message: caption }).catch(() => {});
        }, 400);
        return;
      }
      await Share.share({ message: caption, title: `${BRAND.name} Asset` });
    } catch (error) {
      Alert.alert('Instagram', error?.message || 'Open Instagram and paste your vault caption.');
    }
  };

  const shareSystem = async () => {
    Haptics.tap();
    try {
      if (imageUri) {
        const result = await ShareService.sharePassportCard({
          imageUri,
          asset: { assetName, value: price },
          prefer: 'system',
        });
        if (result?.success) return;
      }
      await Share.share({ message: caption, title: `${BRAND.name} Asset` });
    } catch (error) {
      Alert.alert('Share', error?.message || 'Could not open share sheet');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>SAVED TO VAULT</Text>
          <Text style={styles.title}>Share this asset</Text>

          <View style={styles.preview}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbEmoji}>🛡️</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.assetName} numberOfLines={2}>
                {assetName || 'Vaulted asset'}
              </Text>
              <Text style={styles.price}>
                {price != null && Number(price) > 0 ? formatINRExact(Number(price)) : '—'}
              </Text>
              <Text style={styles.brandTag}>{BRAND.name}</Text>
            </View>
          </View>

          <GlassButton title="WhatsApp" onPress={shareWhatsApp} style={styles.btn} />
          <GlassButton
            title="Instagram"
            variant="ghost"
            onPress={shareInstagram}
            style={styles.btn}
          />
          <GlassButton
            title="More share options"
            variant="ghost"
            onPress={shareSystem}
            style={styles.btn}
          />
          <Pressable
            onPress={() => {
              Haptics.select();
              finish();
            }}
            style={styles.skip}
          >
            <Text style={styles.skipText}>Skip · Go to Home</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default ShareAssetModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.lg || 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
  },
  eyebrow: {
    color: '#2563EB',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
  },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 6, marginBottom: 14 },
  preview: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(37,99,235,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.2)',
    marginBottom: 14,
    alignItems: 'center',
  },
  thumb: { width: 72, height: 72, borderRadius: 14 },
  thumbPlaceholder: {
    backgroundColor: 'rgba(13,148,136,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 28 },
  assetName: { color: COLORS.text, fontWeight: '800', fontSize: 15 },
  price: { color: COLORS.emerald, fontWeight: '900', fontSize: 18, marginTop: 4 },
  brandTag: { color: COLORS.muted, fontSize: 11, marginTop: 4, fontWeight: '600' },
  btn: { marginTop: 8 },
  skip: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  skipText: { color: COLORS.muted, fontWeight: '700', textDecorationLine: 'underline' },
});

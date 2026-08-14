/**
 * Contact Us — support mailto for Asset Doctor
 */

import React from 'react';
import { ScrollView, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';

import { Screen, GlassCard, BrandFooter } from '../../components/ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';

const SUPPORT_EMAIL = 'support@assetdoctor.in';

export function ContactUsScreen() {
  const openMail = async () => {
    Haptics.tap();
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Asset Doctor] Support')}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert('Email', `Write to us at ${SUPPORT_EMAIL}`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Email', `Write to us at ${SUPPORT_EMAIL}`);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Contact Us</Text>
        <GlassCard glow>
          <Text style={styles.label}>Customer support</Text>
          <Text style={styles.body}>
            Questions about your vault, OCR scans, or Play Store listing? Reach the Asset Doctor
            team anytime.
          </Text>
          <Pressable onPress={openMail} style={styles.mailBtn}>
            <Text style={styles.mailText}>{SUPPORT_EMAIL}</Text>
            <Text style={styles.mailHint}>Tap to open your email app →</Text>
          </Pressable>
        </GlassCard>
        <GlassCard style={{ marginTop: 12 }}>
          <Text style={styles.label}>Built by</Text>
          <Text style={styles.body}>{BRAND.creatorCredit} — 14-year-old innovator Ashutosh.</Text>
        </GlassCard>
        <BrandFooter />
      </ScrollView>
    </Screen>
  );
}

export default ContactUsScreen;

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: 48, paddingBottom: 40 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '900', marginBottom: SPACING.md },
  label: { color: COLORS.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  body: { color: COLORS.text, fontSize: 14, lineHeight: 21, marginTop: 8, fontWeight: '500' },
  mailBtn: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(37,99,235,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.35)',
  },
  mailText: { color: '#2563EB', fontWeight: '900', fontSize: 16 },
  mailHint: { color: COLORS.muted, fontSize: 12, marginTop: 4, fontWeight: '600' },
});

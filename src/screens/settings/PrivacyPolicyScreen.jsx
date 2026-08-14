/**
 * In-app Privacy Policy — simple bullet points for Play Store readiness
 */

import React from 'react';
import { ScrollView, Text, StyleSheet, View } from 'react-native';

import { Screen, GlassCard, BrandFooter } from '../../components/ui/Glass';
import { PrivacyVaultTag } from '../../components/PrivacyVaultTag';
import { BRAND, COLORS, SPACING } from '../../theme/branding';

const SECTIONS = [
  {
    title: 'What we collect',
    bullets: [
      'Name, email, phone, and photo you choose to share',
      'Asset and document details you save',
      'Bill / RC / warranty images or PDFs you upload',
      'A notification token for expiry reminders',
    ],
  },
  {
    title: 'How we use it',
    bullets: [
      'Keep your household and vehicle records in one vault',
      'Send PUC, insurance, and warranty reminders',
      'Show health and estimated resale values',
      'Track energy cost on the Energy tab',
    ],
  },
  {
    title: 'Security',
    bullets: [
      'Your data stays under your own Firebase account',
      'Local vault cache is encrypted on this device',
      'Sign-in via Google, phone OTP, or email',
      'Optional biometric App Lock',
    ],
  },
  {
    title: 'Permissions',
    bullets: [
      'Camera & photos — scan invoices and documents',
      'Files — attach PDFs',
      'Notifications — expiry alerts',
      'We never read your SMS inbox',
    ],
  },
  {
    title: 'Sharing',
    bullets: [
      'We do not sell your personal data',
      'Documents are shared only when you tap Share',
      'Google Sign-In uses Google OAuth',
    ],
  },
  {
    title: 'Your controls',
    bullets: [
      'Edit or delete assets anytime',
      'Update your profile in Settings',
      'Sign out from Settings',
      `Email ${BRAND.supportEmail} to request account deletion`,
    ],
  },
];

export function PrivacyPolicyScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.sub}>
          Plain-language summary of how {BRAND.name} handles your data. Updated Aug 2026.
        </Text>
        <PrivacyVaultTag style={{ marginBottom: 16, alignSelf: 'flex-start' }} />
        {SECTIONS.map((s) => (
          <GlassCard key={s.title} style={{ marginBottom: 12 }}>
            <Text style={styles.h}>{s.title}</Text>
            {s.bullets.map((b) => (
              <View key={b} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.p}>{b}</Text>
              </View>
            ))}
          </GlassCard>
        ))}
        <BrandFooter />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: 48, paddingBottom: 40 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '900' },
  sub: { color: COLORS.muted, marginTop: 8, marginBottom: 16, lineHeight: 20 },
  h: { color: COLORS.emerald, fontWeight: '800', marginBottom: 10, fontSize: 15 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  bullet: { color: COLORS.emerald, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  p: { color: COLORS.text, lineHeight: 21, fontSize: 14, flex: 1 },
});

export default PrivacyPolicyScreen;

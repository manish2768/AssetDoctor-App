/**
 * In-app Privacy Policy — required for Play Store readiness
 */

import React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';

import { Screen, GlassCard, BrandFooter } from '../../components/ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';

const SECTIONS = [
  {
    title: '1. Data we collect',
    body: 'Account details (name, email, phone, photo), household and vehicle asset records, document images/PDFs you upload, offline cache metadata, and notification tokens. The app can use your phone PIN, pattern, or biometrics to unlock the vault (App Lock) — we never store a separate app password.',
  },
  {
    title: '2. How we use data',
    body: 'To provide Asset Doctor features: vault storage, expiry alerts, health/resale estimates, power cost tracking, and WhatsApp document sharing you initiate.',
  },
  {
    title: '3. Storage & security',
    body: 'Data is stored in Google Firebase (Auth, Firestore, Storage) under your account. Access is protected by authentication rules owned by your user ID.',
  },
  {
    title: '4. Permissions',
    body: 'Camera/photos for invoices and asset documents; file access for PDFs; notifications for PUC, insurance and warranty reminders. Asset Doctor never reads your SMS inbox.',
  },
  {
    title: '5. Sharing',
    body: 'We do not sell personal data. Documents are shared only when you tap WhatsApp/share. Google Sign-In uses Google OAuth.',
  },
  {
    title: '6. Your controls',
    body: 'You may edit profile data, delete assets/documents, or sign out. Contact the developer to request account deletion.',
  },
  {
    title: '7. Contact',
    body: `${BRAND.footer}. For privacy requests related to Asset Doctor, reply via the store listing or developer email associated with the app.`,
  },
];

export function PrivacyPolicyScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.sub}>
          {BRAND.name} — last updated Jul 2026. This policy supports Play Store / App Store compliance.
        </Text>
        {SECTIONS.map((s) => (
          <GlassCard key={s.title} style={{ marginBottom: 12 }}>
            <Text style={styles.h}>{s.title}</Text>
            <Text style={styles.p}>{s.body}</Text>
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
  h: { color: COLORS.emerald, fontWeight: '800', marginBottom: 8 },
  p: { color: COLORS.text, lineHeight: 21, fontSize: 14 },
});

export default PrivacyPolicyScreen;

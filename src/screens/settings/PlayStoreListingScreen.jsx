/**
 * Play Store listing copy — ready to paste into Play Console
 */

import React from 'react';
import { ScrollView, Text, StyleSheet, Pressable, Share } from 'react-native';

import { Screen, GlassCard, BrandFooter } from '../../components/ui/Glass';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { useUiFeedback } from '../../context/UiFeedbackProvider';

export const PLAY_STORE_LISTING = {
  title: 'Asset Doctor — Smart Asset Vault',
  shortDescription:
    'Smart household and vehicle vault for warranties, RC, PUC and insurance.',
  fullDescription: `Asset Doctor is your smart household asset vault.

Protect
• Store RC, PUC, insurance, warranty cards and invoices in one dark glass vault
• Emergency offline PDF share when you need papers fast

Track
• Health score & resale estimates for bikes, cars, mobiles, ACs and more
• Fine-protection alerts: PUC 7/1 days, insurance 15/3 days, warranty 30 days
• 1-tap manufacturer customer care and warranty assistance

Save
• Appliance energy and running-cost estimates for assets you own
• On-device OCR auto-tags invoices and documents with strict privacy controls
• Key RC, PUC, insurance and warranty documents remain available offline

${BRAND.tagline}
${BRAND.footer}`,
  category: 'Productivity',
  contentRating: 'Everyone',
  privacyPolicyNote:
    'https://assetdoctor-5fd25.web.app/privacy/ — deploy with: npx firebase-tools login && npx firebase-tools deploy --only hosting --project assetdoctor-5fd25',
};

export function PlayStoreListingScreen() {
  const ui = useUiFeedback();
  const onShare = async () => {
    Haptics.tap();
    try {
      await Share.share({
        message: `${PLAY_STORE_LISTING.title}\n\n${PLAY_STORE_LISTING.shortDescription}\n\n${PLAY_STORE_LISTING.fullDescription}`,
      });
    } catch (e) {
      ui.error('Share', e?.message || 'Could not share listing text');
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Play Store listing</Text>
        <Text style={styles.sub}>Copy these fields into Google Play Console.</Text>

        <GlassCard style={{ marginBottom: 12 }}>
          <Text style={styles.h}>App title</Text>
          <Text style={styles.p}>{PLAY_STORE_LISTING.title}</Text>
        </GlassCard>
        <GlassCard style={{ marginBottom: 12 }}>
          <Text style={styles.h}>Short description (≤80 chars)</Text>
          <Text style={styles.p}>{PLAY_STORE_LISTING.shortDescription}</Text>
        </GlassCard>
        <GlassCard style={{ marginBottom: 12 }}>
          <Text style={styles.h}>Full description</Text>
          <Text style={styles.p}>{PLAY_STORE_LISTING.fullDescription}</Text>
        </GlassCard>
        <GlassCard style={{ marginBottom: 12 }}>
          <Text style={styles.h}>Category / rating</Text>
          <Text style={styles.p}>
            {PLAY_STORE_LISTING.category} · {PLAY_STORE_LISTING.contentRating}
          </Text>
        </GlassCard>
        <GlassCard style={{ marginBottom: 12 }}>
          <Text style={styles.h}>Privacy policy URL</Text>
          <Text style={styles.p}>{PLAY_STORE_LISTING.privacyPolicyNote}</Text>
        </GlassCard>

        <Pressable style={styles.btn} onPress={onShare}>
          <Text style={styles.btnText}>Share / copy listing text</Text>
        </Pressable>
        <BrandFooter />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: 48, paddingBottom: 40 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '900' },
  sub: { color: COLORS.muted, marginTop: 8, marginBottom: 16 },
  h: { color: COLORS.emerald, fontWeight: '800', marginBottom: 8 },
  p: { color: COLORS.text, lineHeight: 21, fontSize: 14 },
  btn: {
    backgroundColor: COLORS.neonBlue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '800' },
});

export default PlayStoreListingScreen;

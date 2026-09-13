/**
 * Asset Doctor — Master Contact & Help Center Screen
 * Clear support options + subtle creator credit
 */

import React from 'react';
import { ScrollView, Text, StyleSheet, Pressable, Linking, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BRAND } from '../../theme/branding';
import { useThemeColors } from '../../context/ThemeProvider';
import { Haptics } from '../../services/haptics';
import { useUiFeedback } from '../../context/UiFeedbackProvider';
import { IconButton, PremiumIcon } from '../../design-system';
import { RADIUS, SPACING, TYPE, elevation } from '../../theme/tokens';

const SUPPORT_EMAIL = 'support@assetdoctor.in';

export function ContactUsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const ui = useUiFeedback();

  const openMail = async () => {
    Haptics.tap();
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('[Asset Doctor] Support Inquiry')}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        ui.info('Support Email', `Reach us at ${SUPPORT_EMAIL}`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      ui.info('Support Email', `Reach us at ${SUPPORT_EMAIL}`);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: Math.max(insets.top, 8) }]}>
        <IconButton
          icon={<PremiumIcon name="arrow-left" size={18} color={colors.text} />}
          label="Back"
          onPress={() => navigation?.goBack?.()}
          variant="surface"
          size={44}
        />
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={[TYPE.h2, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
            Help & Support
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(1, colors.shadow)]}>
          <Text style={[TYPE.label, { color: colors.textMuted }]}>CUSTOMER SUPPORT</Text>
          <Text style={[TYPE.body, { color: colors.text, marginTop: 6, lineHeight: 22 }]}>
            Have questions about your asset vault, OCR document recognition, or account security?
            We are here to assist you.
          </Text>

          <Pressable
            onPress={openMail}
            style={[styles.mailBtn, { backgroundColor: colors.accentLight, borderColor: colors.primary }]}
          >
            <Text style={[styles.mailText, { color: colors.primary }]}>{SUPPORT_EMAIL}</Text>
            <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 4 }]}>
              Tap to open email client →
            </Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevation(1, colors.shadow)]}>
          <Text style={[TYPE.label, { color: colors.textMuted }]}>RESPONSE TIME</Text>
          <Text style={[TYPE.body, { color: colors.text, marginTop: 6 }]}>
            All inquiries are typically resolved within 24 hours.
          </Text>
        </View>

        {/* Subtle Creator Credit Footer */}
        <View style={styles.footerWrap}>
          <Text style={[TYPE.micro, { color: colors.textMuted }]}>
            {BRAND.creatorCredit}
          </Text>
          <Text style={[TYPE.micro, { color: colors.textMuted, marginTop: 2 }]}>
            Asset Doctor · Universal Asset Intelligence
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export default ContactUsScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  mailBtn: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  mailText: {
    fontSize: 16,
    fontWeight: '700',
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    paddingVertical: SPACING.md,
  },
});

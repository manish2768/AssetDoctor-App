/**
 * About Us — spotlight Ashutosh (14) & Asset Doctor vision
 */

import React from 'react';
import { ScrollView, Text, StyleSheet, View, Pressable } from 'react-native';

import { Screen, GlassCard, BrandFooter } from '../../components/ui/Glass';
import { AppLogo } from '../../components/AppLogo';
import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { Haptics } from '../../services/haptics';
import { appVersion, appVersionCode, buildLabel, buildNumber, appVersionLabel } from '../../utils/appInfo';
export function AboutUsScreen({ navigation }) {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>About Us</Text>

        <GlassCard glow>
          <View style={styles.heroBadge}>
            <Text style={styles.heroEmoji}>🚀</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Built by Ashutosh Rai</Text>
              <Text style={styles.heroName}>14-year-old innovator Ashutosh</Text>
            </View>
          </View>
          <Text style={styles.story}>
            Created with passion and technical excellence by 14-year-old developer, Ashutosh.
            Asset Doctor replaces messy paperwork with an AI-powered, zero-typing digital vault —
            so families never lose an RC, warranty, or insurance renewal again.
          </Text>
        </GlassCard>

        <GlassCard style={{ marginTop: 12 }}>
          <View style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
            <AppLogo size={56} />
          </View>
          <Text style={styles.brand}>{BRAND.name}</Text>
          <Text style={styles.tagline}>{BRAND.tagline}</Text>
          <Text style={styles.body}>
            Scan bills & RCs in one tap, auto-vault documents, share via WhatsApp instantly, and
            get smart reminders for PUC, insurance, and service — with Family Locker access for
            everyone at home.
          </Text>
        </GlassCard>

        <View style={styles.pill}>
          <Text style={styles.pillText}>{BRAND.creatorCredit}</Text>
        </View>

        <View style={styles.versionCard}>
          <Text style={styles.versionTitle}>About Asset Doctor</Text>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>App Version</Text>
            <Text style={styles.versionValue}>{appVersion()}</Text>
          </View>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Version Code</Text>
            <Text style={styles.versionValue}>{appVersionCode()}</Text>
          </View>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Build</Text>
            <View style={styles.buildPill}>
              <Text style={styles.buildPillText}>{buildLabel()}</Text>
            </View>
          </View>
        </View>
        <Pressable
          style={styles.reportBtn}
          onPress={() => {
            Haptics.tap();
            navigation?.navigate?.('ReportIssue');
          }}
        >
          <Text style={styles.reportBtnText}>Report an issue / Send feedback →</Text>
        </Pressable>

        <BrandFooter />
      </ScrollView>
    </Screen>
  );
}

export default AboutUsScreen;

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingTop: 48, paddingBottom: 40 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '900', marginBottom: SPACING.md },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  heroEmoji: { fontSize: 36 },
  heroLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  heroName: { color: COLORS.emerald, fontSize: 17, fontWeight: '900', marginTop: 2 },
  story: { color: COLORS.text, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  brand: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  tagline: { color: COLORS.emerald, marginTop: 8, fontWeight: '700', fontSize: 13 },
  body: { color: COLORS.muted, marginTop: 12, lineHeight: 20, fontSize: 13 },
  pill: {
    alignSelf: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,245,160,0.35)',
    backgroundColor: 'rgba(0,245,160,0.1)',
  },
  pillText: { color: COLORS.emerald, fontWeight: '800', fontSize: 12 },
  versionCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,245,160,0.3)',
    backgroundColor: 'rgba(0,245,160,0.06)',
  },
  versionTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 2,
  },
  versionLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  versionValue: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  buildPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(13,148,136,0.18)',
    borderWidth: 1,
    borderColor: COLORS.emerald,
  },
  buildPillText: { color: COLORS.emerald, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  reportBtn: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  reportBtnText: { color: COLORS.neonBlue, fontWeight: '800', fontSize: 14 },
});


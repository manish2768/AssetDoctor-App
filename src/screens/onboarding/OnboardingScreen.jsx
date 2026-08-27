/**
 * First-time premium welcome — NEW customers only.
 * Wired from RootNavigator when Firestore welcomeExperiencePending is true.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../theme/branding';
import { TYPE, SPACING, RADIUS } from '../../theme/tokens';
import { Haptics } from '../../services/haptics';
import {
  IconScanLine,
  IconSpark,
  IconBell,
  IconLock,
  IconChart,
  IconArrowRight,
} from '../../design-system/icons';
import {
  firstNameFromDisplay,
  welcomePrimaryAction,
  welcomeSecondaryAction,
} from '../../services/onboarding/welcomeExperience';

const BANNER = require('../../../assets/welcome-banner.jpg');
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BANNER_H = Math.min(Math.round(SCREEN_W * 0.72), Math.round(SCREEN_H * 0.34));

const FEATURES = [
  {
    key: 'scan',
    Icon: IconScanLine,
    title: 'Smart Scan',
    body: 'Scan bills, insurance, warranty, RC and important documents.',
  },
  {
    key: 'intel',
    Icon: IconSpark,
    title: 'Asset Intelligence',
    body: 'Understand asset health, service requirements and important actions.',
  },
  {
    key: 'alerts',
    Icon: IconBell,
    title: 'Smart Alerts',
    body: 'Never miss insurance, warranty, PUC or service deadlines.',
  },
  {
    key: 'vault',
    Icon: IconLock,
    title: 'Document Vault',
    body: 'Keep important documents organized and accessible.',
  },
  {
    key: 'cost',
    Icon: IconChart,
    title: 'Cost & Ownership',
    body: 'Understand purchase, maintenance and ownership costs.',
  },
];

export function OnboardingScreen({ onDone, displayName = '' }) {
  const first = firstNameFromDisplay(displayName);

  const finish = (action) => {
    Haptics.success();
    onDone?.(action);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Image
          source={BANNER}
          style={styles.banner}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Asset Doctor welcome banner"
        />

        {first ? (
          <Text style={styles.hello} numberOfLines={1}>
            Welcome, {first} 👋
          </Text>
        ) : null}

        <Text style={styles.kicker}>Welcome to Asset Doctor</Text>
        <Text style={styles.subtitle}>Your assets. Your documents. Your protection.</Text>
        <Text style={styles.support}>One intelligent vault for everything you own.</Text>

        <View style={styles.features}>
          {FEATURES.map(({ key, Icon, title, body }) => (
            <View key={key} style={styles.featureRow}>
              <View style={styles.iconWrap}>
                <Icon size={18} color={COLORS.electricTeal || '#00B8A9'} />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureBody}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.primary}
          onPress={() => finish(welcomePrimaryAction())}
          accessibilityRole="button"
          accessibilityLabel="Protect My First Asset"
        >
          <Text style={styles.primaryText}>Protect My First Asset</Text>
          <IconArrowRight size={18} color="#FFFFFF" />
        </Pressable>
        <Pressable
          onPress={() => finish(welcomeSecondaryAction())}
          style={styles.secondary}
          accessibilityRole="button"
          accessibilityLabel="Explore Asset Doctor"
        >
          <Text style={styles.secondaryText}>Explore Asset Doctor</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.midnight || '#07111F' },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  banner: {
    width: '100%',
    height: BANNER_H,
    alignSelf: 'center',
    marginTop: SPACING.xs,
  },
  hello: {
    ...TYPE.caption,
    color: COLORS.electricTeal || '#00B8A9',
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  kicker: {
    ...TYPE.h1,
    color: COLORS.textOnHero || '#F8FAFC',
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  subtitle: {
    ...TYPE.bodyStrong,
    color: COLORS.electricTeal || '#00B8A9',
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  support: {
    ...TYPE.bodySmall,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  features: { gap: SPACING.sm },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(0, 184, 169, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 184, 169, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  featureCopy: { flex: 1 },
  featureTitle: { ...TYPE.bodyStrong, color: COLORS.textOnHero || '#F8FAFC' },
  featureBody: { ...TYPE.caption, color: COLORS.textMuted, marginTop: 2 },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: Platform.OS === 'android' ? SPACING.md : SPACING.xs,
    gap: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  primaryText: { ...TYPE.button, color: '#FFFFFF' },
  secondary: { paddingVertical: 12, alignItems: 'center' },
  secondaryText: { ...TYPE.caption, color: COLORS.textMuted },
});

export default OnboardingScreen;

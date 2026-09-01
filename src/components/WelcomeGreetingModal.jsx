/**
 * Glassmorphism welcome greeting — shown once per app session after splash.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Platform,
} from 'react-native';

import { AppLogo } from './AppLogo';
import { BRAND, COLORS, FONTS, RADIUS, SPACING } from '../theme/branding';
import { Haptics } from '../services/haptics';
import { isWelcomeExperienceEligible } from '../services/onboarding/welcomeExperience';

/**
 * Module-scoped flag — the true "session" boundary.
 * It persists for the lifetime of the JS process and resets automatically when
 * the app process restarts. This gives exactly one greeting per app session
 * instead of one per navigation, re-render, or remount.
 */
let sessionGreetingShown = false;

export async function markWelcomeGreetingSeenToday() {
  // Mark the greeting as shown for this app session. Sessions are delimited by
  // the module-scoped flag (reset on a fresh process). The new-vs-existing
  // decision is owned by welcomeExperience.isWelcomeExperienceEligible(profile)
  // (Firestore), so no per-day AsyncStorage bookkeeping is needed.
  sessionGreetingShown = true;
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function firstName(fullName = '') {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] || 'there';
}

/**
 * @param {{
 *   visible: boolean,
 *   displayName?: string,
 *   onDismiss: () => void,
 * }} props
 */
export function WelcomeGreetingModal({ visible, displayName = 'Guest', onDismiss }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  const greetLine = useMemo(() => {
    const first = firstName(displayName);
    return `${timeGreeting()}, ${first}`;
  }, [displayName]);

  useEffect(() => {
    if (!visible) return undefined;
    Haptics.select();
    opacity.setValue(0);
    scale.setValue(0.92);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }),
    ]).start();
    return undefined;
  }, [visible, opacity, scale]);

  const dismiss = () => {
    Haptics.tap();
    onDismiss?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Animated.View
          style={[styles.card, { opacity, transform: [{ scale }] }]}
          // Prevent backdrop press from eating card taps on Android
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.logoWrap}>
            <AppLogo size={72} />
          </View>
          <Text style={styles.brand}>{BRAND.name}</Text>
          <Text style={styles.greet}>{greetLine}</Text>
          <Text style={styles.name} numberOfLines={2}>
            {String(displayName || 'Guest').trim() || 'Guest'}
          </Text>
          <Text style={styles.sub}>
            Your vault is ready — vehicles, warranties & renewals in one place.
          </Text>
          <Pressable style={styles.cta} onPress={dismiss} accessibilityRole="button">
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/**
 * Decide whether the welcome greeting should show for this session.
 *
 * Gating:
 *  - At most once per session (module-scoped flag resets on a fresh process).
 *  - Only for users who are welcome-experience ELIGIBLE. Existing users
 *    (who already completed onboarding / welcome experience) must NOT get the
 *    onboarding greeting repeatedly on every app launch.
 *
 * The eligibility system in onboarding/welcomeExperience.js is the source of
 * truth for "new vs existing user" (Firestore profile flags), not AsyncStorage.
 *
 * @param {object|null} profile - The authenticated user's Firestore profile.
 * @returns {Promise<boolean>}
 */
export async function shouldShowWelcomeGreeting(profile = null) {
  // Existing / non-eligible users never see the onboarding greeting again.
  if (!isWelcomeExperienceEligible(profile)) return false;
  if (sessionGreetingShown) return false;
  // Claim the greeting for this session up-front so concurrent effect runs /
  // re-mounts can never show a duplicate.
  sessionGreetingShown = true;
  return true;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: RADIUS.xl,
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderWidth: 1,
    borderColor: COLORS.borderGlow,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.35,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 12 },
      },
      android: { elevation: 12 },
    }),
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: COLORS.cardStrong,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brand: {
    color: COLORS.emerald,
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  greet: {
    marginTop: 10,
    color: COLORS.text,
    fontFamily: FONTS.bold,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  name: {
    marginTop: 4,
    color: COLORS.muted,
    fontFamily: FONTS.medium,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  sub: {
    marginTop: 12,
    color: COLORS.muted,
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  cta: {
    marginTop: 22,
    backgroundColor: COLORS.emerald,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 160,
    alignItems: 'center',
  },
  ctaText: {
    color: COLORS.onPrimary,
    fontFamily: FONTS.bold,
    fontWeight: '800',
    fontSize: 15,
  },
});

export default WelcomeGreetingModal;

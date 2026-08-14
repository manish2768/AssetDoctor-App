/**
 * Splash — one-shot welcome with time-based greeting + brand mark.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text, Vibration } from 'react-native';

import { AppLogo } from '../../components/AppLogo';
import { BRAND, COLORS, FONTS, SPACING } from '../../theme/branding';
import { BrandFooter } from '../../components/ui/Glass';
import { Haptics } from '../../services/haptics';
import { OtaUpdateService } from '../../services/updates/OtaUpdateService';
import { loadAuthSession } from '../../services/authService';
import { loadLocalProfile } from '../../utils/userProfileStorage';

const FALLBACK_MS = 1600;

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
  return parts[0] || '';
}

export function SplashScreen({ onFinish, holdMs = FALLBACK_MS }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const greet = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);
  const started = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [session, local] = await Promise.all([loadAuthSession(), loadLocalProfile()]);
        const name =
          String(session?.name || local?.name || '')
            .trim() || '';
        if (!cancelled) setDisplayName(name);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (started.current) return undefined;
    started.current = true;

    let cancelled = false;
    const finish = () => {
      if (cancelled || finished.current) return;
      finished.current = true;
      try {
        Vibration.cancel();
      } catch {
        /* ignore */
      }
      onFinishRef.current?.();
    };

    try {
      Haptics.select();
    } catch {
      /* ignore */
    }

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }),
      ]),
      Animated.timing(greet, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();

    const maxWait = Math.min(Math.max(Number(holdMs) || FALLBACK_MS, 800), 2500);
    const hardFallback = setTimeout(finish, maxWait + 800);

    (async () => {
      const minHold = new Promise((resolve) => setTimeout(resolve, maxWait));
      const ota = OtaUpdateService.checkOnLaunch({ reload: false }).catch(() => null);
      await Promise.all([minHold, ota]);
      if (!cancelled) finish();
    })();

    return () => {
      cancelled = true;
      clearTimeout(hardFallback);
      try {
        Vibration.cancel();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const first = firstName(displayName);
  const hello = first ? `${timeGreeting()}, ${first}` : `${timeGreeting()}`;

  return (
    <View style={styles.root}>
      <Animated.View
        style={{
          opacity,
          transform: [{ scale }],
          alignItems: 'center',
          paddingHorizontal: 28,
        }}
      >
        <View style={styles.heroCard}>
          <AppLogo size={120} />
        </View>
        <Animated.View style={{ opacity: greet, alignItems: 'center' }}>
          <Text style={styles.hello}>{hello}</Text>
          {displayName ? (
            <Text style={styles.fullName} numberOfLines={1}>
              {displayName}
            </Text>
          ) : null}
          <Text style={styles.tag}>{BRAND.name}</Text>
          <Text style={styles.sub}>Your smart vault for vehicles, warranties &amp; renewals</Text>
        </Animated.View>
        <BrandFooter />
      </Animated.View>
    </View>
  );
}

export default SplashScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    width: 160,
    height: 160,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.md,
    shadowColor: '#0A1628',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  hello: {
    color: COLORS.text,
    fontFamily: FONTS.bold,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  fullName: {
    color: COLORS.muted,
    fontFamily: FONTS.medium,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  tag: {
    color: COLORS.emerald,
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  sub: {
    color: COLORS.muted,
    fontFamily: FONTS.regular,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: SPACING.md,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});

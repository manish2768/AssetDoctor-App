/**
 * Splash — soft welcome + optional silent OTA check before entering the app.
 * Uses welcome-vault illustration (not the house/bike graphic). App icon untouched.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Text } from 'react-native';

import { BRAND, COLORS, SPACING } from '../../theme/branding';
import { BrandFooter } from '../../components/ui/Glass';
import { Haptics } from '../../services/haptics';
import { OtaUpdateService } from '../../services/updates/OtaUpdateService';

export function SplashScreen({ onFinish, holdMs = 2600 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.94)).current;
  const greet = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  useEffect(() => {
    Haptics.select();
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }),
      ]),
      Animated.timing(greet, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();

    let cancelled = false;
    const finish = () => {
      if (cancelled || finished.current) return;
      finished.current = true;
      Haptics.tap();
      onFinish?.();
    };

    (async () => {
      const minHold = new Promise((resolve) => setTimeout(resolve, holdMs));
      const ota = OtaUpdateService.checkOnLaunch({ reload: true }).catch(() => null);
      await minHold;
      const result = await ota;
      if (!cancelled && !result?.reloaded) finish();
    })();

    return () => {
      cancelled = true;
    };
  }, [holdMs, onFinish, opacity, scale, greet]);

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
          <Image
            source={require('../../../assets/welcome-vault.png')}
            style={styles.heroArt}
            resizeMode="contain"
          />
        </View>
        <Animated.View style={{ opacity: greet, alignItems: 'center' }}>
          <Text style={styles.hello}>Welcome to Asset Doctor</Text>
          <Text style={styles.tag}>{BRAND.shortTagline || BRAND.tagline}</Text>
          <Text style={styles.sub}>Your smart vault for vehicles, warranties &amp; renewals</Text>
        </Animated.View>
        <BrandFooter />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    width: 220,
    height: 220,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.18)',
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
  heroArt: {
    width: 200,
    height: 200,
  },
  hello: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tag: {
    color: COLORS.emerald || COLORS.teal || '#0D9488',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  sub: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: SPACING.md,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});

export default SplashScreen;

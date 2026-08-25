/**
 * Login / action success overlay — View-based (not nested Modal) so it shows above Auth sheet on Android.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';

import { Haptics } from '../services/haptics';
import { BRAND, COLORS } from '../theme/branding';

let LottieView = null;
try {
  // eslint-disable-next-line global-require
  LottieView = require('lottie-react-native').default;
} catch {
  LottieView = null;
}

export function LottieSuccess({
  visible,
  title = 'Logged in!',
  subtitle = BRAND.tagline,
  onFinish,
  duration = 3200,
}) {
  const scale = useRef(new Animated.Value(0.72)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.72);
      return undefined;
    }

    Haptics.success();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
    ]).start();

    const t = setTimeout(() => onFinish?.(), duration);
    return () => clearTimeout(t);
    // intentionally omit onFinish — parent recreates it every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, duration]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.backdrop, { opacity }]} pointerEvents="box-none">
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {LottieView ? (
          <LottieView
            source={require('../assets/lottie/success.json')}
            autoPlay
            loop={false}
            style={{ width: 132, height: 132 }}
          />
        ) : (
          <Text style={styles.emoji}>✅</Text>
        )}
        <Text style={styles.brand}>{BRAND.name}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        <Text style={styles.credit}>{BRAND.footer}</Text>
        <Pressable
          style={styles.cta}
          onPress={() => {
            Haptics.tap();
            onFinish?.();
          }}
        >
          <Text style={styles.ctaText}>Continue to vault</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'rgba(3, 8, 14, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.bgElevated,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: COLORS.borderGlow,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 22,
  },
  emoji: { fontSize: 64, marginBottom: 4 },
  brand: {
    color: COLORS.emerald,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  sub: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 6,
  },
  credit: { color: COLORS.muted, fontSize: 11, marginTop: 12, opacity: 0.85 },
  cta: {
    marginTop: 18,
    backgroundColor: COLORS.emerald,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 22,
    minWidth: 180,
    alignItems: 'center',
  },
  ctaText: { color: COLORS.onPrimary, fontWeight: '900', fontSize: 14 },
});

export default LottieSuccess;

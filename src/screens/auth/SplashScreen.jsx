/**
 * Splash — soft welcome + optional silent OTA check before entering the app.
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
        <Image
          source={require('../../../assets/logo-brand.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Animated.View style={{ opacity: greet, alignItems: 'center' }}>
          <Text style={styles.hello}>Welcome back</Text>
          <Text style={styles.tag}>{BRAND.shortTagline}</Text>
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
  logo: {
    width: 260,
    height: 260,
    marginBottom: SPACING.sm,
  },
  hello: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  tag: {
    color: COLORS.emerald,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: SPACING.md,
  },
});

export default SplashScreen;

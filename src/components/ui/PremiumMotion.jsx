/**
 * Premium motion primitives — fast, subtle, reduced-motion aware.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { MOTION } from '../../theme/tokens';
import {
  createEntranceValues,
  runEntrance,
  usePrefersReducedMotion,
} from '../../utils/motion';
import { Haptics } from '../../services/haptics';

export function Entrance({ children, delay = 0, style }) {
  const reduced = usePrefersReducedMotion();
  const values = useRef(createEntranceValues(reduced)).current;
  useEffect(() => {
    runEntrance(values, reduced, delay);
  }, [delay, reduced, values]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: values.opacity,
          transform: [{ translateY: values.translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Scan / primary CTA press scale — respects reduced motion.
 */
export function PressScale({
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  haptic = 'tap',
}) {
  const reduced = usePrefersReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (to) => {
    if (reduced) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: to,
      friction: MOTION.springFriction,
      tension: MOTION.springTension + 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      onPress={() => {
        if (haptic === 'success') Haptics.success();
        else if (haptic === 'select') Haptics.select();
        else Haptics.tap();
        onPress?.();
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({});

export default { Entrance, PressScale };

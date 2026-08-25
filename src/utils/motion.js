/**
 * Reduced-motion aware animation helpers (UI only).
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

import { MOTION } from '../theme/tokens';

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((v) => {
        if (alive) setReduced(!!v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (v) => setReduced(!!v),
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/**
 * Animate a numeric display value (score, counts). Instant when reduced motion.
 */
export function useAnimatedNumber(target = 0, duration = MOTION.reveal) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(Math.round(Number(target) || 0));
  useEffect(() => {
    const next = Math.round(Number(target) || 0);
    if (reduced) {
      setDisplay(next);
      return undefined;
    }
    const start = display;
    const delta = next - start;
    if (!delta) return undefined;
    const anim = new Animated.Value(0);
    const id = anim.addListener(({ value }) => {
      setDisplay(Math.round(start + delta * value));
    });
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      anim.removeListener(id);
      anim.stopAnimation();
    };
    // intentionally only re-run on target/reduced/duration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced, duration]);
  return display;
}

export function createEntranceValues(reduced) {
  const opacity = new Animated.Value(reduced ? 1 : 0);
  const translateY = new Animated.Value(reduced ? 0 : 12);
  return { opacity, translateY };
}

export function runEntrance(values, reduced, delay = 0, duration = MOTION.entrance) {
  if (reduced) {
    values.opacity.setValue(1);
    values.translateY.setValue(0);
    return;
  }
  Animated.parallel([
    Animated.timing(values.opacity, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.spring(values.translateY, {
      toValue: 0,
      delay,
      friction: MOTION.springFriction,
      tension: MOTION.springTension,
      useNativeDriver: true,
    }),
  ]).start();
}

/** One-shot spring scale (e.g. FAB settle) — never loops. */
export function runSpringOnce(anim, toValue = 1, reduced = false) {
  if (reduced) {
    anim.setValue(toValue);
    return;
  }
  Animated.spring(anim, {
    toValue,
    friction: MOTION.springFriction,
    tension: MOTION.springTension,
    useNativeDriver: true,
  }).start();
}

export default {
  usePrefersReducedMotion,
  useAnimatedNumber,
  createEntranceValues,
  runEntrance,
  runSpringOnce,
};

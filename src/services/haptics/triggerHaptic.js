/**
 * Asset Doctor — Haptic Feedback Helper
 * Prefer native haptic module; always fall back to Android Vibration so feedback works in EAS APKs.
 */

import { Platform, Vibration } from 'react-native';

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const HAPTIC_MAP = {
  tap: 'impactLight',
  select: 'selection',
  success: 'notificationSuccess',
  error: 'notificationError',
  warning: 'notificationWarning',
  impactLight: 'impactLight',
  impactMedium: 'impactMedium',
  impactHeavy: 'impactHeavy',
  notificationSuccess: 'notificationSuccess',
  notificationError: 'notificationError',
  notificationWarning: 'notificationWarning',
};

const VIBRATE_PATTERN = {
  tap: 18,
  select: 12,
  success: [0, 35, 45, 55],
  error: [0, 50, 40, 50, 40, 70],
  warning: [0, 40, 50, 40],
  impactMedium: 28,
  impactHeavy: 40,
  impactLight: 18,
};

function getHapticModule() {
  try {
    // eslint-disable-next-line global-require
    return require('react-native-haptic-feedback').default;
  } catch {
    return null;
  }
}

function vibrateFallback(type) {
  try {
    const pattern = VIBRATE_PATTERN[type] ?? VIBRATE_PATTERN.tap;
    Vibration.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/**
 * Trigger device haptic feedback.
 * @param {string} [type='tap']
 */
export function triggerHaptic(type = 'tap') {
  try {
    const ReactNativeHapticFeedback = getHapticModule();
    if (ReactNativeHapticFeedback?.trigger) {
      const mapped = HAPTIC_MAP[type] || 'impactLight';
      ReactNativeHapticFeedback.trigger(mapped, HAPTIC_OPTIONS);
      // Android OEM builds often mute RNHF — reinforce with Vibration
      if (Platform.OS === 'android') {
        vibrateFallback(type);
      }
      return;
    }
    vibrateFallback(type);
  } catch {
    vibrateFallback(type);
  }
}

export const Haptics = {
  tap: () => triggerHaptic('tap'),
  select: () => triggerHaptic('select'),
  success: () => triggerHaptic('success'),
  error: () => triggerHaptic('error'),
  warning: () => triggerHaptic('warning'),
  impactMedium: () => triggerHaptic('impactMedium'),
  cancel: () => {
    try {
      Vibration.cancel();
    } catch {
      /* ignore */
    }
  },
};

export default triggerHaptic;

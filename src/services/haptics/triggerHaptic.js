/**
 * Asset Doctor — Haptic Feedback Helper
 * Centralizes all haptic-touch triggers for taps, success, and error states.
 */

import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/** @typedef {'tap' | 'select' | 'success' | 'error' | 'warning' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'notificationSuccess' | 'notificationError' | 'notificationWarning'} HapticType */

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

/**
 * Trigger device haptic feedback.
 * @param {HapticType} [type='tap']
 */
export function triggerHaptic(type = 'tap') {
  try {
    const mapped = HAPTIC_MAP[type] || 'impactLight';
    ReactNativeHapticFeedback.trigger(mapped, HAPTIC_OPTIONS);
  } catch {
    // Haptics must never crash the app (simulator / unsupported devices)
  }
}

/** Convenience aliases for common UX events */
export const Haptics = {
  tap: () => triggerHaptic('tap'),
  select: () => triggerHaptic('select'),
  success: () => triggerHaptic('success'),
  error: () => triggerHaptic('error'),
  warning: () => triggerHaptic('warning'),
  impactMedium: () => triggerHaptic('impactMedium'),
};

export default triggerHaptic;

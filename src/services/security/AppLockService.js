/**
 * Device lock (PIN / pattern / biometric) for Asset Doctor vault.
 * Uses the phone screen-lock — we never store a separate app PIN.
 * Graceful if native module missing (old APK + new OTA).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { APP_LOCK_ENABLED_KEY } from '../../constants/storageKeys';

const BACKGROUND_LOCK_MS = 5_000;

let LocalAuthentication = null;
let nativeLoadError = null;
try {
  // eslint-disable-next-line global-require
  LocalAuthentication = require('expo-local-authentication');
} catch (e) {
  nativeLoadError = e?.message || String(e);
}

export class AppLockService {
  static BACKGROUND_LOCK_MS = BACKGROUND_LOCK_MS;

  static isNativeAvailable() {
    return Boolean(LocalAuthentication?.authenticateAsync);
  }

  /** @returns {Promise<boolean>} */
  static async isEnabled() {
    try {
      if (!this.isNativeAvailable()) return false;
      const v = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
      if (v == null) return true;
      return v === '1';
    } catch {
      return Boolean(this.isNativeAvailable());
    }
  }

  /** @param {boolean} enabled */
  static async setEnabled(enabled) {
    await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, enabled ? '1' : '0');
  }

  static async canUseDeviceLock() {
    if (!this.isNativeAvailable()) return false;
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      // Some Androids report enrolled=false for PIN-only — still try authenticate
      if (compatible && enrolled) return true;
      const level = await LocalAuthentication.getEnrolledLevelAsync?.();
      if (
        level === LocalAuthentication.SecurityLevel?.SECRET ||
        level === LocalAuthentication.SecurityLevel?.BIOMETRIC_STRONG ||
        level === LocalAuthentication.SecurityLevel?.BIOMETRIC_WEAK ||
        level === 1 ||
        level === 2 ||
        level === 3
      ) {
        return true;
      }
      return Boolean(compatible);
    } catch {
      return false;
    }
  }

  static async getSecurityLabel() {
    if (!this.isNativeAvailable()) {
      return 'Update app to unlock App Lock';
    }
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasBio =
        types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ||
        types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ||
        types.includes(LocalAuthentication.AuthenticationType.IRIS);
      if (hasBio) return 'Fingerprint / Face + phone PIN or pattern';
      return 'Phone PIN / pattern / password';
    } catch {
      return 'Phone PIN / pattern';
    }
  }

  /**
   * @param {{ reason?: string }} [opts]
   */
  static async authenticate(opts = {}) {
    if (!this.isNativeAvailable()) {
      return {
        success: false,
        missingNative: true,
        error:
          nativeLoadError ||
          'App Lock needs the latest APK. Install the new preview build, then reopen.',
      };
    }

    try {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const level = await LocalAuthentication.getEnrolledLevelAsync?.().catch(() => 0);
      const hasSecret =
        enrolled ||
        level === LocalAuthentication.SecurityLevel?.SECRET ||
        level === LocalAuthentication.SecurityLevel?.BIOMETRIC_STRONG ||
        level === LocalAuthentication.SecurityLevel?.BIOMETRIC_WEAK ||
        level > 0;

      if (!hasSecret) {
        return {
          success: false,
          missingEnrollment: true,
          error:
            'Set a PIN, pattern, or password in your phone Settings first. Asset Doctor uses your phone lock to protect the vault.',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: opts.reason || 'Unlock Asset Doctor',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use phone PIN',
      });

      if (result.success) return { success: true };
      if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        return { success: false, error: 'Authentication cancelled' };
      }
      // Retry once without strong biometric constraint (some OEMs fail first prompt)
      if (Platform.OS === 'android' && result.error === 'not_enrolled') {
        return {
          success: false,
          missingEnrollment: true,
          error: 'Set a phone PIN or pattern in system Settings.',
        };
      }
      return {
        success: false,
        error: result.error || 'Could not verify phone lock',
      };
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Device authentication failed',
      };
    }
  }
}

export default AppLockService;

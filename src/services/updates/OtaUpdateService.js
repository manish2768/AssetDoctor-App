/**
 * EAS Update (OTA) — fetch JS bundles over-the-air for release / channel builds.
 * Metro / Expo Go: Updates.isEnabled is false → graceful no-op.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

let Updates = null;
try {
  // eslint-disable-next-line global-require
  Updates = require('expo-updates');
} catch {
  Updates = null;
}

/** Short stamp so we can see on-device which JS bundle loaded. */
export const OTA_BUNDLE_LABEL = (() => {
  try {
    if (!Updates?.isEnabled) return 'METRO-LOCAL';
    if (Updates.isEmbeddedLaunch) return 'EMBEDDED';
    const id = String(Updates.updateId || '').replace(/-/g, '');
    return id ? `OTA-${id.slice(0, 8)}` : 'OTA';
  } catch {
    return 'METRO-LOCAL';
  }
})();

function channelFromConstants() {
  return (
    Constants.easConfig?.channel ||
    Constants.expoConfig?.extra?.eas?.channel ||
    Updates?.channel ||
    'unknown'
  );
}

export class OtaUpdateService {
  static isSupported() {
    try {
      return Boolean(Updates?.isEnabled);
    } catch {
      return false;
    }
  }

  static getRuntimeInfo() {
    try {
      const updateId = Updates?.updateId || null;
      return {
        channel: channelFromConstants(),
        runtimeVersion: Updates?.runtimeVersion || Constants.expoConfig?.version || 'dev',
        updateId,
        updateIdShort: updateId ? String(updateId).slice(0, 8) : Updates?.isEnabled ? 'embedded' : 'metro',
        isEmbeddedLaunch: Boolean(Updates?.isEmbeddedLaunch ?? true),
        isEnabled: Boolean(Updates?.isEnabled),
        bundleLabel: OTA_BUNDLE_LABEL,
        platform: Platform.OS,
      };
    } catch {
      return {
        channel: 'metro',
        runtimeVersion: 'dev',
        updateId: null,
        updateIdShort: 'metro',
        isEmbeddedLaunch: true,
        isEnabled: false,
        bundleLabel: OTA_BUNDLE_LABEL,
        platform: Platform.OS,
      };
    }
  }

  /**
   * Splash / boot — download + optionally reload when a newer OTA exists.
   * @param {{ reload?: boolean }} [opts]
   */
  static async checkOnLaunch(opts = {}) {
    const reload = opts.reload !== false;
    return this.check({ reload });
  }

  /**
   * Manual / Settings check.
   * @param {{ reload?: boolean }} [opts]
   */
  static async check(opts = {}) {
    const shouldReload = Boolean(opts.reload);
    if (!this.isSupported()) {
      return { success: true, available: false, reason: 'updates-disabled' };
    }

    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result?.isAvailable) {
        return { success: true, available: false, reason: 'up-to-date' };
      }

      const fetched = await Updates.fetchUpdateAsync();
      if (!fetched?.isNew) {
        return { success: true, available: false, reason: 'no-new-bundle' };
      }

      if (shouldReload) {
        await Updates.reloadAsync();
        return { success: true, available: true, reloaded: true };
      }

      return { success: true, available: true, reloaded: false };
    } catch (error) {
      console.warn('[OtaUpdateService] check failed:', error?.message || error);
      return {
        success: false,
        available: false,
        error: error?.message || 'Could not check for updates',
      };
    }
  }

  static async reload() {
    if (!this.isSupported()) return;
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.warn('[OtaUpdateService] reload failed:', error?.message || error);
    }
  }
}

export default OtaUpdateService;

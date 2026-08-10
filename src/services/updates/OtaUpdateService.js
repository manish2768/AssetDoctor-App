/**
 * EAS Update helper.
 * JS/UI changes → `eas update --channel preview`
 * Native/plugin changes → new APK build required
 */

import * as Updates from 'expo-updates';

const LAUNCH_CHECK_MS = 12000;
const LAUNCH_FETCH_MS = 20000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Update check timed out')), ms);
    }),
  ]);
}

/** Short stamp so we can see on-device if this OTA bundle loaded. */
export const OTA_BUNDLE_LABEL = 'FIX-0810-ocr-strict';

export class OtaUpdateService {
  static isSupported() {
    return Boolean(Updates.isEnabled);
  }

  /**
   * Boot check on splash — wait long enough to actually download, then reload.
   */
  static async checkOnLaunch({ reload = true } = {}) {
    if (!Updates.isEnabled) {
      return { success: true, available: false, reason: 'disabled' };
    }
    try {
      const result = await withTimeout(Updates.checkForUpdateAsync(), LAUNCH_CHECK_MS);
      if (!result.isAvailable) return { success: true, available: false };
      await withTimeout(Updates.fetchUpdateAsync(), LAUNCH_FETCH_MS);
      if (reload) {
        await Updates.reloadAsync();
        return { success: true, available: true, downloaded: true, reloaded: true };
      }
      return { success: true, available: true, downloaded: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Launch update check failed' };
    }
  }

  static async check({ reload = false } = {}) {
    if (!Updates.isEnabled) {
      return { success: true, available: false, reason: 'development-build' };
    }
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return { success: true, available: false };
      await Updates.fetchUpdateAsync();
      if (reload) await Updates.reloadAsync();
      return { success: true, available: true, downloaded: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Update check failed' };
    }
  }

  static getRuntimeInfo() {
    const id = Updates.updateId || null;
    return {
      channel: Updates.channel || 'embedded',
      runtimeVersion: Updates.runtimeVersion || 'unknown',
      updateId: id,
      updateIdShort: id ? String(id).slice(0, 8) : 'embedded',
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      isEnabled: Updates.isEnabled,
      bundleLabel: OTA_BUNDLE_LABEL,
    };
  }

  static async reload() {
    if (Updates.isEnabled) await Updates.reloadAsync();
  }
}

export default OtaUpdateService;

/**
 * Remote Play Store version gate for sideloaded / pre-Play APK users.
 * Reads Firestore `app_config/android` (public read) and compares to the
 * installed native app version. When Play listing goes live, set
 * `promptEnabled: true` and bump `latestVersion` / `minSupportedVersion`.
 */

import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

import {
  ANDROID_PACKAGE,
  APP_CONFIG_FIRESTORE_PATH,
  PLAY_STORE_URL_FALLBACK,
} from '../../constants/appIdentity';
import { PLAY_UPDATE_DISMISS_KEY } from '../../constants/storageKeys';
import { Haptics } from '../haptics/triggerHaptic';

function parseVersion(raw) {
  const parts = String(raw || '0')
    .split('.')
    .map((p) => parseInt(p.replace(/[^0-9]/g, ''), 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

/** @returns {number} negative if a < b, 0 if equal, positive if a > b */
export function compareSemver(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

function installedVersion() {
  return (
    Constants.nativeApplicationVersion ||
    Constants.expoConfig?.version ||
    Constants.manifest?.version ||
    '0.0.0'
  );
}

function installedBuild() {
  return String(
    Constants.nativeBuildVersion ||
      Constants.expoConfig?.android?.versionCode ||
      '',
  );
}

/**
 * @typedef {Object} AndroidAppConfig
 * @property {boolean} [promptEnabled]
 * @property {string} [latestVersion]
 * @property {string} [minSupportedVersion]
 * @property {number} [latestVersionCode]
 * @property {string} [playStoreUrl]
 * @property {string} [message]
 * @property {string} [packageName]
 */

export class PlayStoreUpdateService {
  static getInstalledInfo() {
    return {
      version: installedVersion(),
      versionCode: installedBuild(),
      packageName: ANDROID_PACKAGE,
      platform: Platform.OS,
    };
  }

  /**
   * Fetch remote Android config. Missing doc → no prompt (safe default).
   * @returns {Promise<AndroidAppConfig | null>}
   */
  static async fetchAndroidConfig() {
    if (Platform.OS !== 'android') return null;
    try {
      const snap = await firestore()
        .collection(APP_CONFIG_FIRESTORE_PATH.collection)
        .doc(APP_CONFIG_FIRESTORE_PATH.androidDoc)
        .get();
      if (!snap.exists) return null;
      return /** @type {AndroidAppConfig} */ (snap.data() || null);
    } catch (error) {
      console.warn('[PlayStoreUpdate] config read failed:', error?.message || error);
      return null;
    }
  }

  /**
   * @param {AndroidAppConfig | null} config
   */
  static evaluate(config) {
    const installed = this.getInstalledInfo();
    if (!config || !config.promptEnabled) {
      return { shouldPrompt: false, force: false, reason: 'disabled', installed };
    }

    const packageOk =
      !config.packageName || config.packageName === ANDROID_PACKAGE;
    if (!packageOk) {
      return { shouldPrompt: false, force: false, reason: 'package-mismatch', installed };
    }

    const latest = config.latestVersion || '0.0.0';
    const minSupported = config.minSupportedVersion || '0.0.0';
    const behindLatest = compareSemver(installed.version, latest) < 0;
    const belowMin = compareSemver(installed.version, minSupported) < 0;
    const behindCode =
      config.latestVersionCode != null &&
      installed.versionCode &&
      Number(installed.versionCode) < Number(config.latestVersionCode);

    const shouldPrompt = behindLatest || belowMin || behindCode;
    return {
      shouldPrompt,
      force: belowMin,
      reason: belowMin ? 'below-min' : behindLatest || behindCode ? 'outdated' : 'current',
      installed,
      latest,
      minSupported,
      playStoreUrl: config.playStoreUrl || PLAY_STORE_URL_FALLBACK,
      message:
        config.message ||
        'A newer version of Asset Doctor is available on the Google Play Store. Update to keep your vault secure and get the latest features.',
    };
  }

  static async wasDismissedFor(latestVersion) {
    try {
      const raw = await AsyncStorage.getItem(PLAY_UPDATE_DISMISS_KEY);
      return raw === String(latestVersion || '');
    } catch {
      return false;
    }
  }

  static async dismissFor(latestVersion) {
    try {
      await AsyncStorage.setItem(PLAY_UPDATE_DISMISS_KEY, String(latestVersion || ''));
    } catch {
      /* ignore */
    }
  }

  static async openPlayStore(url) {
    Haptics.tap();
    const target = url || PLAY_STORE_URL_FALLBACK;
    const market = `market://details?id=${ANDROID_PACKAGE}`;
    try {
      const canMarket = await Linking.canOpenURL(market);
      if (canMarket) {
        await Linking.openURL(market);
        return;
      }
    } catch {
      /* fall through */
    }
    await Linking.openURL(target);
  }

  /**
   * Check remote config and optionally show an Alert.
   * Safe to call on every cold start after splash.
   */
  static async checkAndPrompt({ showAlert = true } = {}) {
    if (Platform.OS !== 'android') {
      return { shouldPrompt: false, reason: 'not-android' };
    }

    const config = await this.fetchAndroidConfig();
    const decision = this.evaluate(config);
    if (!decision.shouldPrompt) return decision;

    if (!decision.force) {
      const dismissed = await this.wasDismissedFor(decision.latest);
      if (dismissed) {
        return { ...decision, shouldPrompt: false, reason: 'dismissed' };
      }
    }

    if (!showAlert) return decision;

    Haptics.warning();
    return new Promise((resolve) => {
      const buttons = [
        {
          text: 'Update on Play Store',
          onPress: async () => {
            await this.openPlayStore(decision.playStoreUrl);
            resolve({ ...decision, action: 'open-store' });
          },
        },
      ];
      if (!decision.force) {
        buttons.unshift({
          text: 'Later',
          style: 'cancel',
          onPress: async () => {
            await this.dismissFor(decision.latest);
            resolve({ ...decision, action: 'dismiss' });
          },
        });
      }

      Alert.alert(
        'Update Available on Play Store',
        decision.message,
        buttons,
        { cancelable: !decision.force },
      );
    });
  }
}

export default PlayStoreUpdateService;

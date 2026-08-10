/**
 * Smart Expiry & Fine-Protection Engine.
 * Local schedules are persisted by asset/field/window to prevent duplicates.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import firestore from '@react-native-firebase/firestore';

import { Haptics } from '../haptics/triggerHaptic';
import { EXPIRY_ALERT_PROFILES } from '../../theme/branding';
import { daysUntil } from '../../utils/dates';
import { isAlertableStatus } from '../../constants/assetStatus';
import { COLLECTIONS } from '../constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const CHANNEL_ID = 'asset-expiry-alerts';
const REGISTRY_KEY = '@asset_doctor/expiry_notification_registry_v2';
const EAS_PROJECT_ID =
  Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Expiry & Fine Protection',
    description: 'High-priority PUC, insurance and warranty reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    sound: 'default',
  });
}

function assetIdOf(asset) {
  return asset?.assetId || asset?.id || null;
}

function notificationKey(assetId, field, alertDay) {
  return `${assetId}:${field}:${alertDay}`;
}

function fireDate(dateStr, alertDay) {
  const date = new Date(`${String(dateStr).slice(0, 10)}T09:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() - alertDay);
  return date;
}

function contentFor(asset, field, alertDay) {
  const profile = EXPIRY_ALERT_PROFILES[field];
  const name = asset.assetName || 'Asset';
  return {
    title:
      field === 'pucExpiry'
        ? `Fine protection: ${name}`
        : `${profile.label} reminder: ${name}`,
    body: `${profile.message} ${alertDay} day${alertDay === 1 ? '' : 's'} remaining.`,
    data: {
      assetId: assetIdOf(asset),
      field,
      alertDay,
      screen: 'AssetPassport',
    },
    sound: true,
  };
}

async function readRegistry() {
  try {
    const raw = await AsyncStorage.getItem(REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeRegistry(registry) {
  await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

export class ExpiryAlertService {
  static async requestPermissions() {
    Haptics.tap();
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Haptics.error();
      return { success: false, error: 'Notification permission denied' };
    }
    await ensureAndroidChannel();
    Haptics.success();
    return { success: true };
  }

  static async registerPushToken(userId) {
    try {
      const perm = await this.requestPermissions();
      if (!perm.success) return perm;
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: EAS_PROJECT_ID,
      });
      const token = tokenData.data;
      if (userId && token) {
        await firestore()
          .collection(COLLECTIONS.USERS)
          .doc(userId)
          .set(
            {
              expoPushTokens: firestore.FieldValue.arrayUnion(token),
              // Keep old field during migration for the deployed Cloud Function.
              fcmTokens: firestore.FieldValue.arrayUnion(token),
              localExpiryTokens: firestore.FieldValue.arrayUnion(token),
              updatedAt: firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      }
      return { success: true, token };
    } catch (error) {
      return { success: false, error: error?.message || 'Push token registration failed' };
    }
  }

  static async unregisterPushToken(userId) {
    try {
      if (userId) {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: EAS_PROJECT_ID,
        }).catch(() => null);
        const token = tokenData?.data;
        if (token) {
          await firestore()
            .collection(COLLECTIONS.USERS)
            .doc(userId)
            .set(
              {
                expoPushTokens: firestore.FieldValue.arrayRemove(token),
                fcmTokens: firestore.FieldValue.arrayRemove(token),
                localExpiryTokens: firestore.FieldValue.arrayRemove(token),
                updatedAt: firestore.FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
        }
      }
      const registry = await readRegistry();
      for (const item of Object.values(registry)) {
        if (item?.notificationId) {
          await Notifications.cancelScheduledNotificationAsync(item.notificationId).catch(() => {});
        }
      }
      await AsyncStorage.removeItem(REGISTRY_KEY);
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Notification cleanup failed' };
    }
  }

  static async scheduleForAsset(asset, registry = null) {
    const id = assetIdOf(asset);
    if (!id || !isAlertableStatus(asset?.status) || asset?.deletedAt) {
      return { success: true, scheduled: [], registry: registry || (await readRegistry()) };
    }

    await ensureAndroidChannel();
    const nextRegistry = registry || (await readRegistry());
    const scheduled = [];
    const now = Date.now();

    for (const [field, profile] of Object.entries(EXPIRY_ALERT_PROFILES)) {
      const dateStr = asset[field];
      const remaining = daysUntil(dateStr);
      if (!dateStr || remaining === null) continue;

      // Already expired → one-shot red-flag notification (deduped per day)
      if (remaining < 0) {
        const key = notificationKey(id, field, 'expired');
        const dayKey = new Date().toISOString().slice(0, 10);
        const fingerprint = `${dateStr}:expired:${dayKey}`;
        if (nextRegistry[key]?.fingerprint === fingerprint) continue;
        if (nextRegistry[key]?.notificationId) {
          await Notifications.cancelScheduledNotificationAsync(
            nextRegistry[key].notificationId,
          ).catch(() => {});
        }
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `${profile.label || field} Expired`,
            body: `${asset.assetName || 'Asset'}: ${profile.label || field} expired ${Math.abs(remaining)} day(s) ago. Renew now.`,
            data: { assetId: id, field, status: 'expired' },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 2,
            channelId: CHANNEL_ID,
          },
        });
        nextRegistry[key] = { notificationId, fingerprint, status: 'expired' };
        scheduled.push({ notificationId, field, alertDay: 'expired' });
        continue;
      }

      for (const alertDay of profile.days) {
        const key = notificationKey(id, field, alertDay);
        const fingerprint = `${dateStr}:${asset.status || 'active'}`;
        if (nextRegistry[key]?.fingerprint === fingerprint) continue;

        if (nextRegistry[key]?.notificationId) {
          await Notifications.cancelScheduledNotificationAsync(
            nextRegistry[key].notificationId,
          ).catch(() => {});
        }

        const scheduledFor = fireDate(dateStr, alertDay);
        if (!scheduledFor) continue;
        let trigger;
        if (remaining === alertDay) {
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 3,
            channelId: CHANNEL_ID,
          };
        } else if (scheduledFor.getTime() > now) {
          trigger = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: scheduledFor,
            channelId: CHANNEL_ID,
          };
        } else {
          continue;
        }

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: contentFor(asset, field, alertDay),
          trigger,
        });
        nextRegistry[key] = { notificationId, fingerprint };
        scheduled.push({ notificationId, field, alertDay });
      }
    }

    if (!registry) await writeRegistry(nextRegistry);
    return { success: true, scheduled, registry: nextRegistry };
  }

  static async syncPortfolioAlerts(assets = []) {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return { success: false, reason: 'permission' };

    let registry = await readRegistry();
    const desiredKeys = new Set();

    for (const asset of assets) {
      const id = assetIdOf(asset);
      if (!id || !isAlertableStatus(asset.status) || asset.deletedAt) continue;
      for (const [field, profile] of Object.entries(EXPIRY_ALERT_PROFILES)) {
        const remaining = daysUntil(asset[field]);
        if (remaining === null || remaining < 0) continue;
        for (const alertDay of profile.days) {
          desiredKeys.add(notificationKey(id, field, alertDay));
        }
      }
    }

    for (const [key, item] of Object.entries(registry)) {
      if (desiredKeys.has(key)) continue;
      if (item?.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(item.notificationId).catch(() => {});
      }
      delete registry[key];
    }

    const results = [];
    for (const asset of assets) {
      const result = await this.scheduleForAsset(asset, registry);
      registry = result.registry;
      results.push(result);
    }
    await writeRegistry(registry);
    return { success: true, results };
  }

  static getUrgentAssets(assets = []) {
    const urgent = [];
    for (const asset of assets) {
      if (!isAlertableStatus(asset.status) || asset.deletedAt) continue;
      for (const [field, profile] of Object.entries(EXPIRY_ALERT_PROFILES)) {
        const days = daysUntil(asset[field]);
        const maxWindow = Math.max(...profile.days);
        if (days !== null && days <= maxWindow) {
          urgent.push({
            asset,
            field,
            days,
            status: days < 0 ? 'expired' : 'upcoming',
            message:
              days < 0
                ? `${profile.label || field} Expired — renew now`
                : profile.message,
          });
        }
      }
    }
    return urgent.sort((a, b) => a.days - b.days);
  }

  /** In-app welcome notification (replaces WhatsApp welcome template). */
  static async notifyWelcome({ name } = {}) {
    try {
      await ensureAndroidChannel();
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status !== 'granted') {
        const asked = await Notifications.requestPermissionsAsync();
        if (asked.status !== 'granted') {
          return { success: false, error: 'permission' };
        }
      }
      const display = String(name || 'Asset Owner').trim() || 'Asset Owner';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Welcome to Asset Doctor',
          body: `Hi ${display} — your smart asset vault is ready. We'll remind you before insurance, PUC, and warranty expiry.`,
          data: { screen: 'Home', type: 'welcome' },
          sound: true,
        },
        trigger: null,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'welcome notify failed' };
    }
  }

  /** Immediate in-app / local reminder (email may also be queued separately). */
  static async notifyReminder({ title, body, data } = {}) {
    try {
      await ensureAndroidChannel();
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status !== 'granted') {
        return { success: false, error: 'permission' };
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: String(title || 'Asset Doctor reminder').slice(0, 80),
          body: String(body || '').slice(0, 240),
          data: data || { screen: 'Home' },
          sound: true,
        },
        trigger: null,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'reminder notify failed' };
    }
  }
}

export default ExpiryAlertService;

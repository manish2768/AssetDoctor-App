/**
 * In-app notification center + prefs (AsyncStorage).
 * STEP 9 states + unread badge. Works offline.
 * Storage is scoped per Firebase Auth UID so phone/Google sessions
 * never share stale unread counts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

import {
  NOTIFICATION_STATUS,
  DEFAULT_REMINDER_OFFSETS,
} from '../notifications/notificationTypes';

const LEGACY_KEY = '@asset_doctor/notification_center_v1';
const KEY_PREFIX = '@asset_doctor/notification_center_v2:';
const PREFS_KEY = '@asset_doctor/notification_prefs_v1';
const MAX = 200;

function resolveUid(explicit) {
  if (explicit) return String(explicit);
  try {
    return auth().currentUser?.uid || null;
  } catch {
    return null;
  }
}

function storageKey(uid) {
  const id = resolveUid(uid);
  return id ? `${KEY_PREFIX}${id}` : LEGACY_KEY;
}

/** @deprecated use NOTIFICATION_STATUS — kept for older rows */
export const ALERT_STATUS = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  SENT: 'SENT',
  READ: NOTIFICATION_STATUS.READ,
  DISMISSED: NOTIFICATION_STATUS.DISMISSED,
  RESOLVED: 'RESOLVED',
  UNREAD: NOTIFICATION_STATUS.UNREAD,
  ACTIONED: NOTIFICATION_STATUS.ACTIONED,
  EXPIRED: NOTIFICATION_STATUS.EXPIRED,
});

export const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  Service: true,
  Insurance: true,
  PUC: true,
  Warranty: true,
  Battery: true,
  Energy: true,
  Health: true,
  Expense: true,
  Document: true,
  System: true,
  pushEnabled: true,
  inAppEnabled: true,
  emailEnabled: false,
  quietHoursEnabled: false,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  quietHoursBlockNonCritical: true,
  lockScreenPrivacy: 'full', // 'full' | 'generic'
  batteryAttentionThreshold: 80,
  batteryCriticalThreshold: 70,
  energyAnomalyPercent: 25,
  reminderOffsets: {
    default: [...DEFAULT_REMINDER_OFFSETS],
  },
});

export async function getNotificationPrefs() {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return { ...DEFAULT_NOTIFICATION_PREFS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

export async function setNotificationPrefs(patch = {}) {
  const prev = await getNotificationPrefs();
  const next = {
    ...prev,
    ...patch,
    reminderOffsets: {
      ...(prev.reminderOffsets || {}),
      ...(patch.reminderOffsets || {}),
    },
  };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
}

async function migrateLegacyIfNeeded(uid) {
  if (!uid) return;
  const key = storageKey(uid);
  try {
    const existing = await AsyncStorage.getItem(key);
    if (existing) return;
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    const parsed = JSON.parse(legacy);
    if (!Array.isArray(parsed) || !parsed.length) return;
    // Only migrate rows that match this uid (or lack owner — then drop to avoid cross-account badge)
    const scoped = parsed.filter((r) => {
      const owner = r.userId || r.ownerUid || r.uid;
      return !owner || owner === uid;
    });
    if (scoped.length) {
      await AsyncStorage.setItem(key, JSON.stringify(scoped.slice(0, MAX)));
    }
  } catch {
    /* ignore */
  }
}

export async function listNotificationCenter(userId) {
  const uid = resolveUid(userId);
  try {
    await migrateLegacyIfNeeded(uid);
    const raw = await AsyncStorage.getItem(storageKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    if (!uid) return list;
    return list.filter((r) => {
      const owner = r.userId || r.ownerUid || r.uid;
      return !owner || owner === uid;
    });
  } catch {
    return [];
  }
}

function isUnreadStatus(s) {
  // Badge = actual unread only. Scheduled reminders are not unread inbox items.
  return s === NOTIFICATION_STATUS.UNREAD || !s;
}

/**
 * Actual unread count for the current (or given) Auth UID.
 * Returns 0 when signed out or empty — never invents a badge.
 */
export async function unreadCount(userId) {
  const list = await listNotificationCenter(userId);
  return list.filter((r) => isUnreadStatus(r.status)).length;
}

/**
 * Upsert insights into the center — skips disabled categories and duplicate identities.
 */
export async function upsertInsights(insights = [], userId) {
  const uid = resolveUid(userId);
  const prefs = await getNotificationPrefs();
  if (prefs.inAppEnabled === false) {
    return listNotificationCenter(uid);
  }
  const existing = await listNotificationCenter(uid);
  const byId = new Map(existing.map((r) => [r.alertId || r.notificationId, r]));
  const today = new Date().toISOString().slice(0, 10);

  for (const row of insights || []) {
    const id = row?.alertId || row?.notificationId;
    if (!id) continue;
    const cat = row.category || 'Document';
    if (prefs[cat] === false) continue;

    const prev = byId.get(id);
    if (
      prev?.status === ALERT_STATUS.DISMISSED ||
      prev?.status === ALERT_STATUS.RESOLVED ||
      prev?.status === NOTIFICATION_STATUS.ACTIONED ||
      prev?.status === NOTIFICATION_STATUS.DISMISSED
    ) {
      continue;
    }
    if (
      prev &&
      String(prev.updatedAt || prev.createdAt || '').slice(0, 10) === today &&
      (prev.status === ALERT_STATUS.SENT || prev.status === NOTIFICATION_STATUS.UNREAD)
    ) {
      byId.set(id, {
        ...prev,
        ...row,
        userId: uid || prev.userId,
        status: prev.status,
        updatedAt: prev.updatedAt || new Date().toISOString(),
      });
      continue;
    }

    byId.set(id, {
      ...prev,
      ...row,
      alertId: id,
      notificationId: id,
      userId: uid || row.userId || prev?.userId,
      status: prev?.status || NOTIFICATION_STATUS.UNREAD,
      createdAt: prev?.createdAt || row.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const next = [...byId.values()]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, MAX);
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify(next));
  return next;
}

export async function markAlertStatus(alertId, status, userId) {
  const uid = resolveUid(userId);
  const list = await listNotificationCenter(uid);
  const now = new Date().toISOString();
  const next = list.map((r) => {
    if ((r.alertId || r.notificationId) !== alertId) return r;
    return {
      ...r,
      status,
      readAt:
        status === NOTIFICATION_STATUS.READ || status === ALERT_STATUS.READ
          ? now
          : r.readAt,
      dismissedAt:
        status === NOTIFICATION_STATUS.DISMISSED || status === ALERT_STATUS.DISMISSED
          ? now
          : r.dismissedAt,
      actionedAt: status === NOTIFICATION_STATUS.ACTIONED ? now : r.actionedAt,
      updatedAt: now,
    };
  });
  await AsyncStorage.setItem(storageKey(uid), JSON.stringify(next));
  return next;
}

/** Clear center for a uid (e.g. after logout of that session only). */
export async function clearNotificationCenter(userId) {
  const uid = resolveUid(userId);
  if (!uid) return;
  await AsyncStorage.removeItem(storageKey(uid));
}

export default {
  listNotificationCenter,
  unreadCount,
  upsertInsights,
  markAlertStatus,
  getNotificationPrefs,
  setNotificationPrefs,
  clearNotificationCenter,
  ALERT_STATUS,
  DEFAULT_NOTIFICATION_PREFS,
};

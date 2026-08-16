/**
 * STEP 9 — Deterministic notification rule engine (pure).
 * No AI. Does not invent odometer/battery values.
 */

import { daysUntil } from '../../utils/dates';
import { isAlertableStatus } from '../../constants/assetStatus';
import { BATTERY_ALERT_THRESHOLDS } from '../health/healthScoreConfig';
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_PRIORITY,
  DEFAULT_REMINDER_OFFSETS,
  FIELD_TO_TYPE,
  makeNotificationIdentity,
  resolvePriority,
  deepLinkFor,
  TYPE_TO_PREF_KEY,
} from './notificationTypes';
import { privacySafeAssetLabel } from '../security/privacyPrefs';

/** Module cache — NotificationEngine / ExpiryAlertService may refresh. */
let notificationPrivacyOn = true;

export function setNotificationPrivacyMode(enabled) {
  notificationPrivacyOn = enabled !== false;
}

function daysLeftFrom(eventDate, now) {
  if (!now) return daysUntil(eventDate);
  const iso = String(eventDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return daysUntil(eventDate);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target - start) / 86400000);
}

function nameOf(asset) {
  return privacySafeAssetLabel(asset, notificationPrivacyOn);
}

function enabledOffsets(prefs, type) {
  const key = TYPE_TO_PREF_KEY[type];
  if (key && prefs?.[key] === false) return [];
  const custom = prefs?.reminderOffsets?.[type] || prefs?.reminderOffsets?.default;
  if (Array.isArray(custom) && custom.length) {
    return custom.map(Number).filter((n) => Number.isFinite(n));
  }
  return [...DEFAULT_REMINDER_OFFSETS];
}

function expiryCandidates(asset, userId, field, type, prefs, now) {
  const eventDate = asset?.[field];
  if (!eventDate) return [];
  const left = daysLeftFrom(eventDate, now);
  if (left == null) return [];
  const offsets = enabledOffsets(prefs, type);
  const out = [];
  for (const offset of offsets) {
    const match = left === offset || (left < 0 && offset === 0);
    if (!match) continue;

    const priority = resolvePriority(left);
    const identity = makeNotificationIdentity({
      userId,
      assetId: assetIdOf(asset),
      notificationType: type,
      eventDate,
      reminderOffset: offset,
    });
    out.push({
      notificationId: identity,
      alertId: identity,
      userId,
      assetId: assetIdOf(asset),
      notificationType: type,
      category: TYPE_TO_PREF_KEY[type] || 'Document',
      priority,
      reminderOffset: offset,
      eventDate: String(eventDate).slice(0, 10),
      daysLeft: left,
      title: titleFor(type, asset, left),
      body: bodyFor(type, asset, left, offset),
      deepLink: deepLinkFor(type, assetIdOf(asset)),
      createdAt: new Date().toISOString(),
      isEstimate: false,
    });
  }
  return out;
}

function titleFor(type, asset, daysLeft) {
  const name = nameOf(asset);
  if (daysLeft < 0) {
    if (type === NOTIFICATION_TYPE.PUC_EXPIRY) return `PUC expired: ${name}`;
    if (type === NOTIFICATION_TYPE.INSURANCE_EXPIRY) return `Insurance expired: ${name}`;
    if (type === NOTIFICATION_TYPE.WARRANTY_EXPIRY) return `Warranty expired: ${name}`;
    return `Expired: ${name}`;
  }
  if (type === NOTIFICATION_TYPE.PUC_EXPIRY) return `PUC reminder: ${name}`;
  if (type === NOTIFICATION_TYPE.INSURANCE_EXPIRY) return `Insurance reminder: ${name}`;
  if (type === NOTIFICATION_TYPE.WARRANTY_EXPIRY) return `Warranty reminder: ${name}`;
  if (type === NOTIFICATION_TYPE.EXTENDED_WARRANTY_EXPIRY) {
    return `Extended warranty: ${name}`;
  }
  if (type === NOTIFICATION_TYPE.SERVICE_DUE) return `Service due: ${name}`;
  return `Asset reminder: ${name}`;
}

function bodyFor(type, asset, daysLeft, offset) {
  const name = nameOf(asset);
  if (daysLeft < 0) {
    const ago = Math.abs(daysLeft);
    return `${name} — expired ${ago} day${ago === 1 ? '' : 's'} ago. Tap to update.`;
  }
  if (daysLeft === 0) return `${name} — expires today.`;
  return `${name} — ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining (reminded at ${offset}d).`;
}

/**
 * Battery alert — only when actual health is present (never invent).
 */
function batteryCandidates(asset, userId, prefs) {
  if (prefs?.Battery === false) return [];
  const health =
    asset?.batteryProfile?.healthPercent ??
    asset?.batteryHealthPercent ??
    asset?.batteryHealth;
  if (health == null || !Number.isFinite(Number(health))) return [];
  const pct = Number(health);
  const attention = Number(prefs?.batteryAttentionThreshold) || BATTERY_ALERT_THRESHOLDS.attention;
  const critical = Number(prefs?.batteryCriticalThreshold) || BATTERY_ALERT_THRESHOLDS.critical;
  if (pct >= attention) return [];

  const priority =
    pct < critical ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.MEDIUM;
  const type = NOTIFICATION_TYPE.BATTERY_HEALTH;
  const identity = makeNotificationIdentity({
    userId,
    assetId: assetIdOf(asset),
    notificationType: type,
    eventDate: new Date().toISOString().slice(0, 10),
    reminderOffset: Math.round(pct),
  });
  return [
    {
      notificationId: identity,
      alertId: identity,
      userId,
      assetId: assetIdOf(asset),
      notificationType: type,
      category: 'Battery',
      priority,
      title: `Battery attention: ${nameOf(asset)}`,
      body: `Battery health ${pct}% (threshold ${attention}%). Not a universal failure standard.`,
      deepLink: deepLinkFor(type, assetIdOf(asset)),
      createdAt: new Date().toISOString(),
      isEstimate: asset?.batteryProfile?.isEstimate === true,
      batteryPercent: pct,
    },
  ];
}

/**
 * Asset health — uses existing score only (no second engine).
 */
function healthCandidates(asset, userId, prefs) {
  if (prefs?.Health === false) return [];
  const score = asset?.assetHealthScore ?? asset?.healthScore;
  if (score == null || !Number.isFinite(Number(score))) return [];
  const s = Number(score);
  if (s >= 75) return [];
  const priority =
    s < 40 ? NOTIFICATION_PRIORITY.CRITICAL : s < 60 ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.MEDIUM;
  const type = NOTIFICATION_TYPE.ASSET_HEALTH;
  const identity = makeNotificationIdentity({
    userId,
    assetId: assetIdOf(asset),
    notificationType: type,
    eventDate: new Date().toISOString().slice(0, 10),
    reminderOffset: Math.round(s),
  });
  return [
    {
      notificationId: identity,
      alertId: identity,
      userId,
      assetId: assetIdOf(asset),
      notificationType: type,
      category: 'Health',
      priority,
      title: `Health attention: ${nameOf(asset)}`,
      body: `Health score ${s}/100 — needs attention.`,
      deepLink: deepLinkFor(type, assetIdOf(asset)),
      createdAt: new Date().toISOString(),
      healthScore: s,
    },
  ];
}

/**
 * Energy — estimated only; never claim meter readings.
 */
function energyCandidates(asset, userId, prefs) {
  if (prefs?.Energy === false) return [];
  const ep = asset?.energyProfile;
  if (!ep || ep.anomaly !== true && !ep.usageAboveBaseline) return [];
  const type = NOTIFICATION_TYPE.ENERGY_ALERT;
  const identity = makeNotificationIdentity({
    userId,
    assetId: assetIdOf(asset),
    notificationType: type,
    eventDate: new Date().toISOString().slice(0, 10),
    reminderOffset: 0,
  });
  return [
    {
      notificationId: identity,
      alertId: identity,
      userId,
      assetId: assetIdOf(asset),
      notificationType: type,
      category: 'Energy',
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: `Energy note: ${nameOf(asset)}`,
      body: 'Estimated energy use is above your configured baseline (not a meter reading).',
      deepLink: deepLinkFor(type, assetIdOf(asset)),
      createdAt: new Date().toISOString(),
      isEstimate: true,
    },
  ];
}

/**
 * Odometer service — only when both due km and current odometer exist.
 */
function odometerServiceCandidates(asset, userId, prefs) {
  if (prefs?.Service === false) return [];
  const dueKm = Number(asset?.nextServiceOdometerKm);
  const current = Number(asset?.odometerKm);
  if (!Number.isFinite(dueKm) || !Number.isFinite(current)) return [];
  if (current < dueKm) return [];
  const type = NOTIFICATION_TYPE.SERVICE_DUE;
  const identity = makeNotificationIdentity({
    userId,
    assetId: assetIdOf(asset),
    notificationType: type,
    eventDate: `km_${dueKm}`,
    reminderOffset: 0,
  });
  return [
    {
      notificationId: identity,
      alertId: identity,
      userId,
      assetId: assetIdOf(asset),
      notificationType: type,
      category: 'Service',
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: `Service due (odometer): ${nameOf(asset)}`,
      body: `Odometer ${current} km reached service target ${dueKm} km.`,
      deepLink: deepLinkFor(type, assetIdOf(asset)),
      createdAt: new Date().toISOString(),
    },
  ];
}

/**
 * Evaluate one asset → notification candidates (pure).
 */
export function evaluateAssetNotifications(asset, opts = {}) {
  if (!asset || asset.deletedAt || !isAlertableStatus(asset.status)) return [];
  const userId = opts.userId || asset.ownerUid || asset.uid || null;
  const prefs = opts.prefs || {};
  const now = opts.now || new Date();
  const rows = [];

  const expiryFields = [
    ['insuranceExpiry', NOTIFICATION_TYPE.INSURANCE_EXPIRY],
    ['pucExpiry', NOTIFICATION_TYPE.PUC_EXPIRY],
    ['warrantyExpiry', NOTIFICATION_TYPE.WARRANTY_EXPIRY],
    ['extendedWarrantyExpiry', NOTIFICATION_TYPE.EXTENDED_WARRANTY_EXPIRY],
    ['nextServiceDue', NOTIFICATION_TYPE.SERVICE_DUE],
  ];
  for (const [field, type] of expiryFields) {
    rows.push(...expiryCandidates(asset, userId, field, type, prefs, now));
  }
  rows.push(...batteryCandidates(asset, userId, prefs));
  rows.push(...healthCandidates(asset, userId, prefs));
  rows.push(...energyCandidates(asset, userId, prefs));
  rows.push(...odometerServiceCandidates(asset, userId, prefs));
  return rows;
}

export function evaluatePortfolioNotifications(assets = [], opts = {}) {
  const out = [];
  for (const asset of assets || []) {
    out.push(...evaluateAssetNotifications(asset, opts));
  }
  return out;
}

/**
 * Who should receive — STEP 7 family stub-safe.
 * Personal → owner only. Shared/household → primaryResponsibleMember if set, else owner.
 */
export function resolveNotificationRecipients(asset, actorUserId) {
  const owner = asset?.ownerUid || asset?.uid || actorUserId;
  const ownership = String(asset?.ownershipType || 'PERSONAL').toUpperCase();
  const responsible =
    asset?.primaryResponsibleMember ||
    asset?.documentResponsibleMember ||
    asset?.serviceResponsibleMember ||
    null;

  if (ownership === 'PERSONAL' || !asset?.householdId) {
    return {
      recipients: owner ? [owner] : [],
      reason: 'personal_owner',
    };
  }
  const primary = responsible || owner;
  return {
    recipients: primary ? [primary] : [],
    reason: 'responsible_or_owner',
    optionalFanOut: false, // never auto-notify whole household
  };
}

export function buildUpcomingSummary(notifications = []) {
  const buckets = {
    insurance: 0,
    service: 0,
    warranty: 0,
    puc: 0,
    expired: 0,
    other: 0,
  };
  for (const n of notifications) {
    if (n.daysLeft != null && n.daysLeft < 0) {
      buckets.expired += 1;
      continue;
    }
    switch (n.notificationType) {
      case NOTIFICATION_TYPE.INSURANCE_EXPIRY:
        buckets.insurance += 1;
        break;
      case NOTIFICATION_TYPE.SERVICE_DUE:
      case NOTIFICATION_TYPE.MAINTENANCE_DUE:
        buckets.service += 1;
        break;
      case NOTIFICATION_TYPE.WARRANTY_EXPIRY:
      case NOTIFICATION_TYPE.EXTENDED_WARRANTY_EXPIRY:
        buckets.warranty += 1;
        break;
      case NOTIFICATION_TYPE.PUC_EXPIRY:
        buckets.puc += 1;
        break;
      default:
        buckets.other += 1;
    }
  }
  return buckets;
}

export default {
  evaluateAssetNotifications,
  evaluatePortfolioNotifications,
  resolveNotificationRecipients,
  buildUpcomingSummary,
  FIELD_TO_TYPE,
};

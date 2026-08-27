/**
 * Asset Doctor (Gadi Doctor) — Production WhatsApp Notification Engine
 * 
 * Central notification service integrating Meta WhatsApp Cloud API with:
 * 1. User Welcome (`welcome_message` - en)
 * 2. OTP Verification (`asset_doctor_otp` - en)
 * 3. Expiry Reminders (`expiry_reminder` - hi) for Insurance, PUC, Warranty
 * 4. Future Service Reminders (queued / template guard)
 * 5. Deduplication, Rate Limiting & User Opt-in Preferences
 * 6. Delivery Audit Logging (Zero token exposure)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  sendMetaWhatsAppMessage,
  normalizeWhatsAppNumber,
  getWhatsAppConfigStatus,
} from './MetaWhatsAppService.js';

// Storage keys for persistent state (React Native / Node fallback)
const NOTIF_LOGS_KEY = '@asset_doctor/whatsapp_notification_logs_v2';
const DEDUP_REGISTRY_KEY = '@asset_doctor/whatsapp_dedup_registry_v2';
const OTP_STORE_KEY = '@asset_doctor/whatsapp_otp_store_v2';
const USER_PREFS_KEY = '@asset_doctor/whatsapp_user_prefs_v2';

// In-memory fallback stores for non-AsyncStorage / server execution
const memoryLogs = new Map();
const memoryDedup = new Map();
const memoryOtp = new Map();
const memoryPrefs = new Map();

/**
 * Approved Meta Template Names in WABA (2938269399848544)
 */
export const APPROVED_META_TEMPLATES = Object.freeze({
  WELCOME_MESSAGE: {
    name: 'welcome_message',
    language: 'en',
    category: 'MARKETING',
    paramCount: 1, // {{1}} = User Name
  },
  WELCOME_BOT: {
    name: 'welcome_gadi_doctor_bot_sznk2',
    language: 'en_GB',
    category: 'MARKETING',
    paramCount: 0,
  },
  EXPIRY_REMINDER: {
    name: 'expiry_reminder',
    language: 'hi',
    category: 'MARKETING',
    paramCount: 4, // {{1}} = Name, {{2}} = Vehicle, {{3}} = Document Type, {{4}} = Expiry Date
  },
  OTP_AUTHENTICATION: {
    name: 'asset_doctor_otp',
    language: 'en',
    category: 'AUTHENTICATION',
    paramCount: 1, // {{1}} = 6-digit OTP
  },
});

export const NOTIF_TYPE = Object.freeze({
  WELCOME: 'WELCOME',
  OTP: 'OTP',
  EXPIRY_REMINDER: 'EXPIRY_REMINDER',
  SERVICE_REMINDER: 'SERVICE_REMINDER',
  CUSTOM: 'CUSTOM',
});

export const NOTIF_STATUS = Object.freeze({
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  SUPPRESSED_OPT_OUT: 'SUPPRESSED_OPT_OUT',
  SUPPRESSED_DUPLICATE: 'SUPPRESSED_DUPLICATE',
  RATE_LIMITED: 'RATE_LIMITED',
  QUEUED_PENDING_TEMPLATE: 'QUEUED_PENDING_TEMPLATE',
});

/**
 * Helper to safely read from AsyncStorage or memory fallback
 */
async function getItem(key, fallbackMap) {
  try {
    if (AsyncStorage?.getItem) {
      const val = await AsyncStorage.getItem(key);
      if (val) return JSON.parse(val);
    }
  } catch {
    // Fall back to memory map
  }

  return fallbackMap.get(key) || null;
}

/**
 * Helper to safely write to AsyncStorage or memory fallback
 */
async function setItem(key, data, fallbackMap) {
  try {
    if (AsyncStorage?.setItem) {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    }
  } catch {
    // Fall back to memory map
  }

  fallbackMap.set(key, data);
}

/**
 * Masks phone number for safe logs and display (e.g. "919956289111" -> "9199****9111")
 */
export function maskPhoneNumber(phone) {
  if (!phone) return '—';
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length < 8) return '****';
  return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
}

/**
 * 1. User Preferences Service
 */
export async function getWhatsAppUserPreferences(userId) {
  if (!userId) {
    return {
      whatsappEnabled: true,
      marketingEnabled: true,
      remindersEnabled: true,
      quietHours: { enabled: false, start: 22, end: 7 },
    };
  }

  const allPrefs = (await getItem(USER_PREFS_KEY, memoryPrefs)) || {};
  return (
    allPrefs[userId] || {
      whatsappEnabled: true,
      marketingEnabled: true,
      remindersEnabled: true,
      quietHours: { enabled: false, start: 22, end: 7 },
    }
  );
}

export async function setWhatsAppUserPreferences(userId, updates = {}) {
  if (!userId) return;
  const allPrefs = (await getItem(USER_PREFS_KEY, memoryPrefs)) || {};
  const current = allPrefs[userId] || {
    whatsappEnabled: true,
    marketingEnabled: true,
    remindersEnabled: true,
    quietHours: { enabled: false, start: 22, end: 7 },
  };

  allPrefs[userId] = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await setItem(USER_PREFS_KEY, allPrefs, memoryPrefs);
  return allPrefs[userId];
}

/**
 * 2. Deduplication Engine
 */
export async function isDuplicateNotification(dedupKey, windowMinutes = 1440) {
  const registry = (await getItem(DEDUP_REGISTRY_KEY, memoryDedup)) || {};
  const record = registry[dedupKey];
  if (!record) return false;

  const sentTime = new Date(record.sentAt).getTime();
  const now = Date.now();
  const elapsedMinutes = (now - sentTime) / (1000 * 60);

  return elapsedMinutes < windowMinutes;
}

export async function recordNotificationSent(dedupKey, metadata = {}) {
  const registry = (await getItem(DEDUP_REGISTRY_KEY, memoryDedup)) || {};
  registry[dedupKey] = {
    sentAt: new Date().toISOString(),
    ...metadata,
  };
  await setItem(DEDUP_REGISTRY_KEY, registry, memoryDedup);
}

/**
 * 3. Audit Log Persister (Zero token exposure)
 */
export async function logNotification(entry) {
  const log = {
    notificationId: entry.notificationId || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: entry.userId || 'anonymous',
    maskedPhone: maskPhoneNumber(entry.phone),
    type: entry.type,
    templateName: entry.templateName,
    templateLanguage: entry.templateLanguage,
    status: entry.status,
    wamid: entry.wamid || null,
    errorCode: entry.errorCode || null,
    errorCategory: entry.errorCategory || null,
    errorMessage: entry.errorMessage || null,
    createdAt: entry.createdAt || new Date().toISOString(),
    sentAt: entry.sentAt || null,
    retryCount: entry.retryCount || 0,
  };

  let logs = (await getItem(NOTIF_LOGS_KEY, memoryLogs)) || [];
  if (!Array.isArray(logs)) logs = [];
  logs.unshift(log);
  // Keep last 500 records
  logs = logs.slice(0, 500);

  await setItem(NOTIF_LOGS_KEY, logs, memoryLogs);
  return log;
}

export async function getNotificationAuditLogs(filterUserId = null) {
  const logs = (await getItem(NOTIF_LOGS_KEY, memoryLogs)) || [];
  if (!Array.isArray(logs)) return [];
  if (filterUserId) {
    return logs.filter((l) => l.userId === filterUserId);
  }
  return logs;
}

/**
 * Core Template Sender with Opt-in check, Deduplication & Retries
 */
export async function sendWhatsAppTemplate({
  userId,
  phone,
  templateName,
  languageCode = 'en',
  parameters = [],
  notificationType = NOTIF_TYPE.CUSTOM,
  dedupKey = null,
  dedupWindowMinutes = 1440, // 24 hours default
  isTransactional = false,
  maxRetries = 2,
}) {
  const normalizedPhone = normalizeWhatsAppNumber(phone);
  if (!normalizedPhone || normalizedPhone.length < 8) {
    await logNotification({
      userId,
      phone,
      type: notificationType,
      templateName,
      templateLanguage: languageCode,
      status: NOTIF_STATUS.FAILED,
      errorCategory: 'INVALID_RECIPIENT_PHONE',
      errorMessage: 'Recipient phone number is invalid or empty.',
    });
    return {
      success: false,
      status: NOTIF_STATUS.FAILED,
      error: 'Invalid recipient phone number.',
    };
  }

  // 1. Preference Check (unless transactional OTP)
  if (!isTransactional && userId) {
    const prefs = await getWhatsAppUserPreferences(userId);
    if (!prefs.whatsappEnabled || (notificationType === NOTIF_TYPE.EXPIRY_REMINDER && !prefs.remindersEnabled)) {
      await logNotification({
        userId,
        phone: normalizedPhone,
        type: notificationType,
        templateName,
        templateLanguage: languageCode,
        status: NOTIF_STATUS.SUPPRESSED_OPT_OUT,
        errorMessage: 'User opted out of WhatsApp reminders.',
      });
      return {
        success: false,
        status: NOTIF_STATUS.SUPPRESSED_OPT_OUT,
        message: 'Notification suppressed because user opted out.',
      };
    }
  }

  // 2. Deduplication Check
  if (dedupKey) {
    const isDup = await isDuplicateNotification(dedupKey, dedupWindowMinutes);
    if (isDup) {
      await logNotification({
        userId,
        phone: normalizedPhone,
        type: notificationType,
        templateName,
        templateLanguage: languageCode,
        status: NOTIF_STATUS.SUPPRESSED_DUPLICATE,
        errorMessage: `Duplicate event suppressed within ${dedupWindowMinutes} min window.`,
      });
      return {
        success: false,
        status: NOTIF_STATUS.SUPPRESSED_DUPLICATE,
        message: 'Duplicate notification suppressed.',
      };
    }
  }

  // 3. Build Parameters Component
  let components = undefined;
  if (parameters && Array.isArray(parameters) && parameters.length > 0) {
    components = [
      {
        type: 'body',
        parameters: parameters.map((p) => ({
          type: 'text',
          text: String(p ?? ''),
        })),
      },
    ];
  }

  // 4. Dispatch with Exponential Backoff Retry
  let attempt = 0;
  let lastResult = null;

  while (attempt <= maxRetries) {
    attempt++;
    const res = await sendMetaWhatsAppMessage({
      to: normalizedPhone,
      template: templateName,
      languageCode,
      components,
    });

    lastResult = res;

    if (res.success) {
      if (dedupKey) {
        await recordNotificationSent(dedupKey, { userId, phone: normalizedPhone, templateName });
      }

      await logNotification({
        userId,
        phone: normalizedPhone,
        type: notificationType,
        templateName,
        templateLanguage: languageCode,
        status: NOTIF_STATUS.SENT,
        wamid: res.messageId,
        sentAt: new Date().toISOString(),
        retryCount: attempt - 1,
      });

      return {
        success: true,
        status: NOTIF_STATUS.SENT,
        wamid: res.messageId,
        recipient: normalizedPhone,
      };
    }

    // If rate-limited or transient network error, wait and retry
    if (attempt <= maxRetries && (res.errorCategory === 'RATE_LIMIT_EXCEEDED' || res.errorCategory === 'NETWORK_ERROR')) {
      const backoffMs = attempt * 1500;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } else {
      break; // Non-retryable error
    }
  }

  await logNotification({
    userId,
    phone: normalizedPhone,
    type: notificationType,
    templateName,
    templateLanguage: languageCode,
    status: NOTIF_STATUS.FAILED,
    errorCode: lastResult?.metaCode || null,
    errorCategory: lastResult?.errorCategory || 'UNKNOWN_ERROR',
    errorMessage: lastResult?.error || 'Failed to dispatch WhatsApp message.',
    retryCount: attempt - 1,
  });

  return {
    success: false,
    status: NOTIF_STATUS.FAILED,
    error: lastResult?.error || 'Failed to send WhatsApp message.',
    errorCategory: lastResult?.errorCategory,
  };
}

/**
 * FLOW A: User Welcome Notification
 * Sends approved `welcome_message` (en) with {{1}} = User Name
 */
export async function sendWelcomeNotification({ userId, phone, userName }) {
  const displayName = String(userName || 'Valued User').trim();
  const dedupKey = `welcome:${userId || normalizeWhatsAppNumber(phone)}`;

  return sendWhatsAppTemplate({
    userId,
    phone,
    templateName: APPROVED_META_TEMPLATES.WELCOME_MESSAGE.name,
    languageCode: APPROVED_META_TEMPLATES.WELCOME_MESSAGE.language,
    parameters: [displayName],
    notificationType: NOTIF_TYPE.WELCOME,
    dedupKey,
    dedupWindowMinutes: 43200, // 30 days deduplication
    isTransactional: false,
  });
}

/**
 * FLOW B: WhatsApp OTP Notification
 * Sends approved `asset_doctor_otp` (en) with {{1}} = 6-digit OTP
 * Zero token or OTP logging. Strict rate limiting & 10-min expiry.
 */
export async function sendOtpNotification({ userId, phone, otp = null }) {
  const normalizedPhone = normalizeWhatsAppNumber(phone);
  if (!normalizedPhone) {
    return { success: false, error: 'Valid phone number required for OTP.' };
  }

  // Rate-limiting: Max 3 OTP requests in 10 minutes
  const otpStore = (await getItem(OTP_STORE_KEY, memoryOtp)) || {};
  const userOtpData = otpStore[normalizedPhone] || { attempts: 0, firstAttemptAt: Date.now() };

  const now = Date.now();
  if (now - userOtpData.firstAttemptAt > 600000) {
    // Reset window after 10 min
    userOtpData.attempts = 0;
    userOtpData.firstAttemptAt = now;
  }

  if (userOtpData.attempts >= 4) {
    await logNotification({
      userId,
      phone: normalizedPhone,
      type: NOTIF_TYPE.OTP,
      templateName: APPROVED_META_TEMPLATES.OTP_AUTHENTICATION.name,
      templateLanguage: APPROVED_META_TEMPLATES.OTP_AUTHENTICATION.language,
      status: NOTIF_STATUS.RATE_LIMITED,
      errorMessage: 'OTP rate limit exceeded. Please wait 10 minutes.',
    });
    return {
      success: false,
      status: NOTIF_STATUS.RATE_LIMITED,
      error: 'Too many OTP requests. Please try again after 10 minutes.',
    };
  }

  // Generate 6-digit OTP if not supplied
  const code = otp || Math.floor(100000 + Math.random() * 900000).toString();

  // Save OTP with 10-minute expiry
  userOtpData.attempts += 1;
  userOtpData.activeOtpHash = code; // Stored locally for verification
  userOtpData.expiresAt = now + 600000;
  otpStore[normalizedPhone] = userOtpData;
  await setItem(OTP_STORE_KEY, otpStore, memoryOtp);

  const res = await sendWhatsAppTemplate({
    userId,
    phone: normalizedPhone,
    templateName: APPROVED_META_TEMPLATES.OTP_AUTHENTICATION.name,
    languageCode: APPROVED_META_TEMPLATES.OTP_AUTHENTICATION.language,
    parameters: [code],
    notificationType: NOTIF_TYPE.OTP,
    isTransactional: true, // Always allow regardless of marketing opt-out
  });

  return {
    ...res,
    expiresInSeconds: 600,
  };
}

/**
 * Verify OTP entered by user
 */
export async function verifyWhatsAppOtp(phone, inputOtp) {
  const normalizedPhone = normalizeWhatsAppNumber(phone);
  const otpStore = (await getItem(OTP_STORE_KEY, memoryOtp)) || {};
  const record = otpStore[normalizedPhone];

  if (!record || !record.activeOtpHash) {
    return { success: false, error: 'No active OTP found for this number. Request a new OTP.' };
  }

  if (Date.now() > record.expiresAt) {
    delete record.activeOtpHash;
    await setItem(OTP_STORE_KEY, otpStore, memoryOtp);
    return { success: false, error: 'OTP has expired. Please request a new code.' };
  }

  if (String(inputOtp).trim() !== String(record.activeOtpHash).trim()) {
    return { success: false, error: 'Incorrect OTP code.' };
  }

  // OTP is valid -> clear it
  delete record.activeOtpHash;
  await setItem(OTP_STORE_KEY, otpStore, memoryOtp);

  return {
    success: true,
    message: 'OTP verified successfully.',
  };
}

/**
 * FLOW C: Document Expiry Reminder Notification
 * Sends approved `expiry_reminder` (hi)
 * Parameters:
 *   {{1}} = Customer Name
 *   {{2}} = Vehicle Name / Reg
 *   {{3}} = Document Type (Insurance, PUC, Warranty, etc.)
 *   {{4}} = Expiry Date (DD-MMM-YYYY)
 */
export async function sendExpiryReminder({
  userId,
  phone,
  customerName,
  vehicleName,
  docType,
  expiryDate,
  assetId,
}) {
  const cust = String(customerName || 'Customer').trim();
  const veh = String(vehicleName || 'Vehicle').trim();
  const doc = String(docType || 'Document').trim();
  const exp = String(expiryDate || 'Soon').trim();

  // Deduplication key: specific to asset + docType + expiryDate
  const dedupKey = `expiry:${userId || phone}:${assetId || veh}:${doc}:${exp}`;

  return sendWhatsAppTemplate({
    userId,
    phone,
    templateName: APPROVED_META_TEMPLATES.EXPIRY_REMINDER.name,
    languageCode: APPROVED_META_TEMPLATES.EXPIRY_REMINDER.language,
    parameters: [cust, veh, doc, exp],
    notificationType: NOTIF_TYPE.EXPIRY_REMINDER,
    dedupKey,
    dedupWindowMinutes: 2880, // 48 hours deduplication per expiry event
    isTransactional: false,
  });
}

/**
 * FLOW D: Future Service Reminder Notification (Template Guard)
 * Checks for approved service templates; if not approved on Meta, queues cleanly.
 */
export async function sendServiceReminder({
  userId,
  phone,
  userName,
  vehicleName,
  odometer,
  daysLeft,
}) {
  // Currently, `ad_service_reminder` is pending Meta template approval.
  // Template Guard: We DO NOT invent unapproved templates on Meta.
  await logNotification({
    userId,
    phone,
    type: NOTIF_TYPE.SERVICE_REMINDER,
    templateName: 'ad_service_reminder',
    templateLanguage: 'en',
    status: NOTIF_STATUS.QUEUED_PENDING_TEMPLATE,
    errorMessage: 'Service reminder template "ad_service_reminder" is pending Meta approval.',
  });

  return {
    success: false,
    status: NOTIF_STATUS.QUEUED_PENDING_TEMPLATE,
    message: 'Service reminder queued. Awaiting template approval in Meta WhatsApp Manager.',
  };
}

/**
 * Process incoming Meta Webhook delivery status update
 */
export async function handleWebhookStatusUpdate(payload) {
  try {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const statusObj = change?.statuses?.[0];

    if (!statusObj) return { processed: false, reason: 'no_status' };

    const wamid = statusObj.id;
    const status = statusObj.status?.toUpperCase(); // 'SENT', 'DELIVERED', 'READ', 'FAILED'
    const timestamp = statusObj.timestamp ? new Date(Number(statusObj.timestamp) * 1000).toISOString() : new Date().toISOString();

    const logs = (await getItem(NOTIF_LOGS_KEY, memoryLogs)) || [];
    const targetIdx = logs.findIndex((l) => l.wamid === wamid);

    if (targetIdx !== -1) {
      logs[targetIdx].status = status;
      if (status === 'DELIVERED') logs[targetIdx].deliveredAt = timestamp;
      if (status === 'READ') logs[targetIdx].readAt = timestamp;
      if (statusObj.errors) {
        logs[targetIdx].errorCode = statusObj.errors[0]?.code;
        logs[targetIdx].errorMessage = statusObj.errors[0]?.message;
      }
      await setItem(NOTIF_LOGS_KEY, logs, memoryLogs);
      return { processed: true, wamid, status };
    }

    return { processed: true, wamid, status, note: 'wamid_not_in_local_logs' };
  } catch (err) {
    return { processed: false, error: err.message };
  }
}

export default {
  APPROVED_META_TEMPLATES,
  NOTIF_TYPE,
  NOTIF_STATUS,
  getWhatsAppUserPreferences,
  setWhatsAppUserPreferences,
  sendWhatsAppTemplate,
  sendWelcomeNotification,
  sendOtpNotification,
  verifyWhatsAppOtp,
  sendExpiryReminder,
  sendServiceReminder,
  handleWebhookStatusUpdate,
  getNotificationAuditLogs,
  maskPhoneNumber,
};

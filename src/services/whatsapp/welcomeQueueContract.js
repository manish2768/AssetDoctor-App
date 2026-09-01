/**
 * Pure welcome-queue contract (no RN / Firebase imports).
 * Production Meta template name is exactly welcome_message.
 */

export const WELCOME_QUEUE_COLLECTION = 'notification_queue';
export const WELCOME_EVENT_TYPE = 'user_welcome';
export const WELCOME_TEMPLATE_NAME = 'welcome_message';
export const WELCOME_TEMPLATE_KEY = WELCOME_TEMPLATE_NAME;
export const WELCOME_TEMPLATE_LANGUAGE = 'en';
export const WELCOME_PROVIDER = 'meta_cloud_api';

export function normalizeE164Phone(value) {
  if (!value) return '';
  const trimmed = String(value).replace(/[^\d+]/g, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  if (trimmed.startsWith('91') && trimmed.length === 12) return `+${trimmed}`;
  return `+${trimmed}`;
}

/**
 * Single Indian WhatsApp digits form for Meta `to`.
 * 9876543210 / +919876543210 / 919876543210 → 919876543210
 */
export function normalizeIndianWhatsAppDigits(phone) {
  if (phone == null || String(phone).trim() === '') {
    return { ok: false, reason: 'BLOCKED_INVALID_PHONE', digits: '', e164: '' };
  }
  const digits = String(phone).replace(/\D/g, '');
  let national = '';
  if (digits.length === 10) national = digits;
  else if (digits.length === 12 && digits.startsWith('91')) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) national = digits.slice(1);
  else {
    return { ok: false, reason: 'BLOCKED_INVALID_PHONE', digits: '', e164: '' };
  }
  if (!/^[6-9]\d{9}$/.test(national)) {
    return { ok: false, reason: 'BLOCKED_INVALID_PHONE', digits: '', e164: '' };
  }
  return { ok: true, reason: null, digits: `91${national}`, e164: `+91${national}` };
}

export function normalizeWhatsAppNumber(phone) {
  const parsed = normalizeIndianWhatsAppDigits(phone);
  if (parsed.ok) return parsed.digits;
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function maskE164ForTrace(phone) {
  const parsed = normalizeIndianWhatsAppDigits(phone);
  const digits = parsed.ok ? parsed.digits : String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return '****';
  return `+${digits.slice(0, 2)}******${digits.slice(-4)}`;
}

export function welcomeQueueDocId(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return '';
  return `welcome_${uid}`;
}

export function welcomeIdempotencyKey(userId) {
  return `welcome:${String(userId || '').trim()}`;
}

/**
 * Consent + phone + already-sent gate. Never silent.
 * whatsappOptIn must be strictly true to send.
 */
export function evaluateWelcomeEligibility({
  phone,
  whatsappOptIn,
  welcomeMessageSent,
} = {}) {
  if (welcomeMessageSent === true) {
    return { action: 'skip', status: 'skipped', reason: 'ALREADY_SENT' };
  }
  const parsed = normalizeIndianWhatsAppDigits(phone);
  if (!parsed.ok) {
    return { action: 'block', status: 'failed', reason: 'INVALID_PHONE' };
  }
  if (whatsappOptIn !== true) {
    return {
      action: 'skip',
      status: 'skipped',
      reason: 'WHATSAPP_OPT_IN_FALSE',
      digits: parsed.digits,
      e164: parsed.e164,
    };
  }
  return {
    action: 'send',
    status: 'queued',
    reason: null,
    digits: parsed.digits,
    e164: parsed.e164,
  };
}

export function classifyMetaError({ httpStatus, error } = {}) {
  const code = Number(error?.code);
  const subcode = Number(error?.error_subcode || error?.error_user_title);
  const message = String(error?.message || '').toLowerCase();
  if (!httpStatus && !error) return { reason: 'META_API_UNAVAILABLE', human: 'Meta API unavailable' };
  if (httpStatus === 401 || code === 190 || code === 102) {
    return { reason: 'TOKEN_EXPIRED', human: 'Token expired' };
  }
  if (code === 133010 || /phone number id/i.test(message)) {
    return { reason: 'PHONE_NUMBER_ID_INVALID', human: 'Phone number ID invalid' };
  }
  if (code === 131026 || code === 131031 || /invalid.*user|not on whatsapp/i.test(message)) {
    return { reason: 'INVALID_PHONE', human: 'Invalid phone number' };
  }
  if (code === 132001 || code === 132000 || code === 132005 || /template/i.test(message)) {
    return { reason: 'TEMPLATE_NOT_APPROVED', human: 'Template not approved' };
  }
  if (code === 131047 || code === 131051 || /opt.?in|outside.*window/i.test(message)) {
    return { reason: 'WHATSAPP_OPT_IN_MISSING', human: 'WhatsApp opt-in missing' };
  }
  if (code === 100 || /invalid parameter/i.test(message)) {
    return { reason: 'INVALID_PARAMETER', human: 'Invalid parameter' };
  }
  if (httpStatus >= 500 || code === 1 || code === 2) {
    return { reason: 'META_API_UNAVAILABLE', human: 'Meta API unavailable' };
  }
  return {
    reason: 'META_ERROR',
    human: error?.message ? String(error.message).slice(0, 180) : `HTTP ${httpStatus || 'unknown'}`,
    metaCode: Number.isFinite(code) ? code : null,
    metaSubcode: Number.isFinite(subcode) ? subcode : null,
  };
}

export function isAcceptedMetaSend(data, httpStatus) {
  const wamid = data?.messages?.[0]?.id;
  return Boolean(httpStatus >= 200 && httpStatus < 300 && !data?.error && wamid);
}

export function extractWamid(data) {
  return data?.messages?.[0]?.id || null;
}

const WEBHOOK_RANK = {
  queued: 1,
  sending: 2,
  sent: 3,
  delivered: 4,
  read: 5,
  skipped: 6,
  failed: 6,
  cancelled: 6,
};

export function mergeWebhookStatus(currentStatus, incomingStatus) {
  const incoming = String(incomingStatus || '').toLowerCase();
  const current = String(currentStatus || '').toLowerCase();
  if (!incoming) return { apply: false, status: current || 'sent' };
  if (incoming === current) return { apply: true, status: incoming, idempotent: true };
  if (current === 'read' && (incoming === 'sent' || incoming === 'delivered')) {
    return { apply: false, status: 'read', idempotent: true };
  }
  if (current === 'failed' && incoming !== 'failed') {
    return { apply: false, status: 'failed', idempotent: true };
  }
  const curRank = WEBHOOK_RANK[current] || 0;
  const nextRank = WEBHOOK_RANK[incoming] || 0;
  if (incoming === 'failed') return { apply: true, status: 'failed' };
  if (nextRank >= curRank) return { apply: true, status: incoming };
  return { apply: false, status: current, idempotent: true };
}

export function diagnoseStuckQueue(item, nowMs = Date.now()) {
  const status = String(item?.status || '').toLowerCase();
  const created = Date.parse(item?.createdAt || item?.scheduledAt || '') || 0;
  const updated = Date.parse(item?.updatedAt || item?.sentAt || '') || created;
  const ageMs = created ? nowMs - created : 0;
  const staleMs = 120000;
  if (status === 'queued' && ageMs > staleMs && !item?.failureReason) {
    return { stuck: true, reason: 'STUCK_NO_WORKER', human: 'Still queued — Cloud Function may not be deployed or did not run' };
  }
  if (status === 'sending' && nowMs - updated > staleMs) {
    return { stuck: true, reason: 'STUCK_SENDING', human: 'Stuck in sending — Meta request may have thrown before status write' };
  }
  return { stuck: false, reason: null, human: null };
}

export function tokenNeverRendered(payload) {
  const blob = JSON.stringify(payload || {});
  return !/META_WHATSAPP_ACCESS_TOKEN|Bearer\s+[A-Za-z0-9]/i.test(blob)
    && !Object.prototype.hasOwnProperty.call(payload || {}, 'accessToken')
    && !Object.prototype.hasOwnProperty.call(payload || {}, 'token');
}

export function buildWelcomeQueueItem({
  userId,
  phone,
  userName,
  customerType = 'NEW',
  gate,
} = {}) {
  const uid = String(userId || '').trim();
  const displayName = String(userName || 'Valued User').trim() || 'Valued User';
  const now = new Date().toISOString();
  const type = String(customerType || 'NEW').toUpperCase() === 'EXISTING' ? 'EXISTING' : 'NEW';
  const eligibility = gate || evaluateWelcomeEligibility({
    phone,
    whatsappOptIn: true,
    welcomeMessageSent: false,
  });

  if (!uid) {
    return { ok: false, error: 'userId required', errorCategory: 'MISSING_USER' };
  }

  const parsed = normalizeIndianWhatsAppDigits(phone);
  if (!parsed.ok || eligibility.reason === 'INVALID_PHONE') {
    const skipAlready = eligibility.reason === 'ALREADY_SENT';
    return {
      ok: false,
      error: skipAlready ? 'Welcome already sent.' : 'Invalid recipient phone number.',
      errorCategory: skipAlready ? 'ALREADY_SENT' : 'INVALID_RECIPIENT_PHONE',
      diagnosticItem: {
        uid,
        userId: uid,
        type: 'WELCOME',
        eventType: WELCOME_EVENT_TYPE,
        channel: 'whatsapp',
        templateName: WELCOME_TEMPLATE_NAME,
        templateKey: WELCOME_TEMPLATE_KEY,
        language: WELCOME_TEMPLATE_LANGUAGE,
        templateLanguage: WELCOME_TEMPLATE_LANGUAGE,
        phoneMasked: parsed.ok ? maskE164ForTrace(parsed.e164) : '****',
        maskedPhone: parsed.ok ? maskE164ForTrace(parsed.e164) : '****',
        recipientPhone: parsed.e164 || '',
        status: skipAlready ? 'skipped' : 'failed',
        failureReason: skipAlready ? 'ALREADY_SENT' : 'INVALID_PHONE',
        failureCode: skipAlready ? 'ALREADY_SENT' : 'INVALID_PHONE',
        provider: WELCOME_PROVIDER,
        createdAt: now,
        updatedAt: now,
        attemptCount: 0,
        retryCount: 0,
        idempotencyKey: welcomeIdempotencyKey(uid),
        payload: { userName: displayName.slice(0, 80), customerType: type },
        source: 'client_signup',
      },
      docId: welcomeQueueDocId(uid),
    };
  }

  const status = eligibility.status || 'queued';
  const item = {
    uid,
    userId: uid,
    customerName: displayName.slice(0, 80),
    customerType: type,
    welcomeEligible: type === 'NEW' && status === 'queued',
    eventType: WELCOME_EVENT_TYPE,
    type: 'WELCOME',
    channel: 'whatsapp',
    templateName: WELCOME_TEMPLATE_NAME,
    templateKey: WELCOME_TEMPLATE_KEY,
    language: WELCOME_TEMPLATE_LANGUAGE,
    templateLanguage: WELCOME_TEMPLATE_LANGUAGE,
    recipientPhone: parsed.e164,
    recipientWhatsApp: parsed.digits,
    phoneMasked: maskE164ForTrace(parsed.e164),
    maskedPhone: maskE164ForTrace(parsed.e164),
    payload: {
      userName: displayName.slice(0, 80),
      customerType: type,
      welcomeEligible: type === 'NEW' && status === 'queued',
    },
    status,
    failureReason: eligibility.reason || null,
    failureCode: eligibility.reason || null,
    provider: WELCOME_PROVIDER,
    scheduledAt: now,
    createdAt: now,
    updatedAt: now,
    attemptCount: 0,
    retryCount: 0,
    idempotencyKey: welcomeIdempotencyKey(uid),
    source: 'client_signup',
  };

  if (status !== 'queued') {
    return {
      ok: true,
      blocked: true,
      docId: welcomeQueueDocId(uid),
      item,
    };
  }

  return {
    ok: true,
    docId: welcomeQueueDocId(uid),
    item,
  };
}

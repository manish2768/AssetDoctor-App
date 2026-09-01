/**
 * Cloud Function helpers for welcome_message send + webhook.
 * CommonJS so functions/index.js can require it. No secrets in this file.
 */

const WELCOME_TEMPLATE_NAME = 'welcome_message';
const WELCOME_LANGUAGE = 'en';
const GRAPH_BASE = 'https://graph.facebook.com';

function normalizeIndianWhatsAppDigits(phone) {
  if (phone == null || String(phone).trim() === '') {
    return { ok: false, reason: 'BLOCKED_INVALID_PHONE', digits: '' };
  }
  const digits = String(phone).replace(/\D/g, '');
  let national = '';
  if (digits.length === 10) national = digits;
  else if (digits.length === 12 && digits.startsWith('91')) national = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) national = digits.slice(1);
  else return { ok: false, reason: 'BLOCKED_INVALID_PHONE', digits: '' };
  if (!/^[6-9]\d{9}$/.test(national)) {
    return { ok: false, reason: 'BLOCKED_INVALID_PHONE', digits: '' };
  }
  return { ok: true, digits: `91${national}` };
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return '****';
  return `+${digits.slice(0, 2)}******${digits.slice(-4)}`;
}

function classifyMetaError({ httpStatus, error } = {}) {
  const code = Number(error && error.code);
  const subcode = Number(error && (error.error_subcode || error.error_user_title));
  const message = String((error && error.message) || '').toLowerCase();
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
    human: error && error.message ? String(error.message).slice(0, 180) : `HTTP ${httpStatus || 'unknown'}`,
    metaCode: Number.isFinite(code) ? code : null,
    metaSubcode: Number.isFinite(subcode) ? subcode : null,
  };
}

function extractWamid(data) {
  return data && data.messages && data.messages[0] && data.messages[0].id ? data.messages[0].id : null;
}

function isAcceptedMetaSend(data, httpStatus) {
  return Boolean(httpStatus >= 200 && httpStatus < 300 && !(data && data.error) && extractWamid(data));
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

function mergeWebhookStatus(currentStatus, incomingStatus) {
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

function diagnoseStuckQueue(item, nowMs) {
  nowMs = nowMs || Date.now();
  const status = String((item && item.status) || '').toLowerCase();
  const created = Date.parse((item && (item.createdAt || item.scheduledAt)) || '') || 0;
  const updated = Date.parse((item && (item.updatedAt || item.sentAt)) || '') || created;
  const ageMs = created ? nowMs - created : 0;
  const staleMs = 120000;
  if (status === 'queued' && ageMs > staleMs && !(item && item.failureReason)) {
    return { stuck: true, reason: 'STUCK_NO_WORKER', human: 'Still queued — Cloud Function may not be deployed or did not run' };
  }
  if (status === 'sending' && nowMs - updated > staleMs) {
    return { stuck: true, reason: 'STUCK_SENDING', human: 'Stuck in sending — Meta request may have thrown before status write' };
  }
  return { stuck: false, reason: null, human: null };
}

function buildGraphPayload(toDigits, userName) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toDigits,
    type: 'template',
    template: {
      name: WELCOME_TEMPLATE_NAME,
      language: { code: WELCOME_LANGUAGE },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: String(userName || 'Valued User').slice(0, 80) }],
        },
      ],
    },
  };
}

async function sendWelcomeTemplate(token, phoneNumberId, to, userName) {
  if (!token || !phoneNumberId) {
    return {
      success: false,
      errorCategory: 'FUNCTION_CONFIGURATION_MISSING',
      error: 'Meta WhatsApp secrets missing',
      human: 'Function configuration missing',
    };
  }
  const parsed = normalizeIndianWhatsAppDigits(to);
  if (!parsed.ok) {
    return {
      success: false,
      errorCategory: 'INVALID_PHONE',
      error: 'Invalid recipient',
      human: 'Invalid phone number',
    };
  }

  const url = `${GRAPH_BASE}/v21.0/${phoneNumberId}/messages`;
  const payload = buildGraphPayload(parsed.digits, userName);

  let response;
  let data = {};
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    data = await response.json().catch(() => ({}));
  } catch (err) {
    return {
      success: false,
      errorCategory: 'META_API_UNAVAILABLE',
      error: err && err.message ? err.message : 'fetch failed',
      human: 'Meta API unavailable',
    };
  }

  if (!isAcceptedMetaSend(data, response.status)) {
    const classified = classifyMetaError({ httpStatus: response.status, error: data.error });
    return {
      success: false,
      errorCategory: classified.reason,
      error: classified.human,
      human: classified.human,
      metaCode: data.error && data.error.code ? data.error.code : null,
      metaSubcode: data.error && data.error.error_subcode ? data.error.error_subcode : null,
      fbtraceId: data.error && data.error.fbtrace_id ? data.error.fbtrace_id : null,
      httpStatus: response.status,
    };
  }

  return {
    success: true,
    messageId: extractWamid(data),
    httpStatus: response.status,
  };
}

function webhookPatchForStatus(incoming, statusObj, now) {
  const status = String(incoming || '').toLowerCase();
  const patch = { status, updatedAt: now };
  if (status === 'delivered') patch.deliveredAt = now;
  if (status === 'read') patch.readAt = now;
  if (status === 'sent') patch.sentAt = patch.sentAt || now;
  if (status === 'failed') {
    const err = statusObj && statusObj.errors && statusObj.errors[0] ? statusObj.errors[0] : {};
    const classified = classifyMetaError({ error: err });
    patch.failureReason = classified.reason;
    patch.failureCode = err.code || classified.reason;
    patch.errorMessage = classified.human;
  }
  return patch;
}

module.exports = {
  WELCOME_TEMPLATE_NAME,
  WELCOME_LANGUAGE,
  normalizeIndianWhatsAppDigits,
  maskPhone,
  classifyMetaError,
  extractWamid,
  isAcceptedMetaSend,
  mergeWebhookStatus,
  diagnoseStuckQueue,
  buildGraphPayload,
  sendWelcomeTemplate,
  webhookPatchForStatus,
};

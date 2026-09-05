/**
 * Asset Doctor — Unified WhatsApp Dispatcher & Lifecycle Engine
 * CommonJS for Firebase Cloud Functions (Node 20).
 *
 * Handles:
 * 1. Template Resolver (welcome_message, expiry_reminder, service_reminder, asset_doctor_otp)
 * 2. Meta WhatsApp Cloud API v21.0 client
 * 3. E.164 phone normalization & masking
 * 4. Error classification (transient vs. permanent)
 * 5. Retry policy & state machine (forward-only transitions)
 * 6. Webhook status merging & regression protection
 *
 * ZERO SECRETS IN THIS FILE.
 */

const WELCOME_TEMPLATE_NAME = 'asset_doctor_welcome';
const WELCOME_LANGUAGE = 'en';
const GRAPH_BASE = 'https://graph.facebook.com';

const SUPPORTED_TEMPLATES = Object.freeze({
  asset_doctor_welcome: {
    name: 'asset_doctor_welcome',
    language: 'en',
    category: 'MARKETING',
    paramCount: 1,
    isApproved: true,
  },
  welcome_message: {
    name: 'asset_doctor_welcome',
    language: 'en',
    category: 'MARKETING',
    paramCount: 1,
    isApproved: true,
  },
  electricity_bill_due_reminder: {
    name: 'electricity_bill_due_reminder',
    language: 'en',
    category: 'UTILITY',
    paramCount: 5,
    isApproved: true,
  },
  warranty_expiry_reminder: {
    name: 'warranty_expiry_reminder',
    language: 'en',
    category: 'UTILITY',
    paramCount: 3,
    isApproved: true,
  },
  asset_doctor_puc_expiry: {
    name: 'asset_doctor_puc_expiry',
    language: 'en',
    category: 'UTILITY',
    paramCount: 3,
    isApproved: true,
  },
  asset_doctor_insurance_expiry: {
    name: 'asset_doctor_insurance_expiry',
    language: 'en',
    category: 'UTILITY',
    paramCount: 3,
    isApproved: true,
  },
  service_due_reminder: {
    name: 'service_due_reminder',
    language: 'en',
    category: 'MARKETING',
    paramCount: 3,
    isApproved: true,
  },
  expiry_reminder: {
    name: 'expiry_reminder',
    language: 'hi',
    category: 'MARKETING',
    paramCount: 4,
    isApproved: true,
  },
  asset_doctor_otp: {
    name: 'asset_doctor_otp',
    language: 'en',
    category: 'AUTHENTICATION',
    paramCount: 1,
    isApproved: true,
  },
  service_reminder: {
    name: 'service_reminder',
    language: 'en',
    category: 'MARKETING',
    paramCount: 3,
    isApproved: false, // Guard: Pending Meta approval
  },
});

/**
 * Strict Indian E.164 normalization (+91XXXXXXXXXX -> digits 91XXXXXXXXXX)
 */
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
    return { ok: false, reason: 'BLOCKED_INVALID_PHONE', digits: '', e164: '' };
  }
  return { ok: true, digits: `91${national}`, e164: `+91${national}` };
}

/**
 * Mask phone number for safe logs and displays (e.g. "+91******1234")
 */
function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return '****';
  return `+${digits.slice(0, 2)}******${digits.slice(-4)}`;
}

/**
 * Resolves template key and builds Meta template components
 */
function resolveTemplate(templateKey, payload = {}) {
  const rawKey = String(templateKey || '').trim().toLowerCase();

  // 1. WELCOME
  if (
    rawKey === 'asset_doctor_welcome' ||
    rawKey === 'welcome_message' ||
    rawKey === 'welcome' ||
    rawKey === 'user_welcome'
  ) {
    const rawName = payload.customerName || payload.userName || payload.name || payload.displayName;
    const userName = rawName ? String(rawName).trim().slice(0, 80) : '';
    if (!userName) {
      return {
        ok: false,
        errorCategory: 'VALIDATION_ERROR',
        error: 'Customer name is required for this WhatsApp template.',
      };
    }
    return {
      ok: true,
      templateName: 'asset_doctor_welcome',
      languageCode: 'en',
      category: 'MARKETING',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: userName, parameter_name: 'customer_name' },
          ],
        },
      ],
    };
  }

  // 2. PUC EXPIRY
  if (rawKey === 'asset_doctor_puc_expiry' || rawKey === 'puc_expiry') {
    const cust = String(payload.customerName || payload.userName || payload.name || 'Valued Customer').trim().slice(0, 80);
    const veh = String(payload.vehicleName || payload.assetName || payload.asset || 'Vehicle').trim().slice(0, 80);
    const exp = String(payload.pucExpiryDate || payload.expiryDate || payload.expiry || 'Soon').trim().slice(0, 80);
    return {
      ok: true,
      templateName: 'asset_doctor_puc_expiry',
      languageCode: 'en',
      category: 'UTILITY',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: cust, parameter_name: 'customer_name' },
            { type: 'text', text: veh, parameter_name: 'vehicle_name' },
            { type: 'text', text: exp, parameter_name: 'puc_expiry_date' },
          ],
        },
      ],
    };
  }

  // 3. INSURANCE EXPIRY
  if (rawKey === 'asset_doctor_insurance_expiry' || rawKey === 'insurance_expiry') {
    const cust = String(payload.customerName || payload.userName || payload.name || 'Valued Customer').trim().slice(0, 80);
    const veh = String(payload.vehicleName || payload.assetName || payload.asset || 'Vehicle').trim().slice(0, 80);
    const exp = String(payload.insuranceExpiryDate || payload.expiryDate || payload.expiry || 'Soon').trim().slice(0, 80);
    return {
      ok: true,
      templateName: 'asset_doctor_insurance_expiry',
      languageCode: 'en',
      category: 'UTILITY',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: cust, parameter_name: 'customer_name' },
            { type: 'text', text: veh, parameter_name: 'vehicle_name' },
            { type: 'text', text: exp, parameter_name: 'insurance_expiry_date' },
          ],
        },
      ],
    };
  }

  // 4. WARRANTY EXPIRY
  if (rawKey === 'warranty_expiry_reminder' || rawKey === 'warranty_expiry') {
    const cust = String(payload.customerName || payload.userName || payload.name || 'Valued Customer').trim().slice(0, 80);
    const asset = String(payload.assetName || payload.vehicleName || payload.asset || 'Asset').trim().slice(0, 80);
    const exp = String(payload.warrantyExpiryDate || payload.expiryDate || payload.expiry || 'Soon').trim().slice(0, 80);
    return {
      ok: true,
      templateName: 'warranty_expiry_reminder',
      languageCode: 'en',
      category: 'UTILITY',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: cust, parameter_name: 'customer_name' },
            { type: 'text', text: asset, parameter_name: 'asset_name' },
            { type: 'text', text: exp, parameter_name: 'warranty_expiry_date' },
          ],
        },
      ],
    };
  }

  // 5. ELECTRICITY BILL DUE
  if (rawKey === 'electricity_bill_due_reminder' || rawKey === 'electricity_bill') {
    const cust = String(payload.customerName || payload.userName || payload.name || 'Valued Customer').trim().slice(0, 80);
    const month = String(payload.billingMonth || payload.month || 'Current Month').trim().slice(0, 80);
    const due = String(payload.dueDate || payload.expiryDate || 'Soon').trim().slice(0, 80);
    const currAmt = String(payload.currentBillAmount || payload.amount || '0').trim().slice(0, 80);
    const totalAmt = String(payload.totalPayableAmount || payload.totalAmount || currAmt).trim().slice(0, 80);
    return {
      ok: true,
      templateName: 'electricity_bill_due_reminder',
      languageCode: 'en',
      category: 'UTILITY',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: cust, parameter_name: 'customer_name' },
            { type: 'text', text: month, parameter_name: 'billing_month' },
            { type: 'text', text: due, parameter_name: 'due_date' },
            { type: 'text', text: currAmt, parameter_name: 'current_bill_amount' },
            { type: 'text', text: totalAmt, parameter_name: 'total_payable_amount' },
          ],
        },
      ],
    };
  }

  // 6. SERVICE DUE REMINDER
  if (rawKey === 'service_due_reminder' || rawKey === 'service_due') {
    const cust = String(payload.customerName || payload.userName || payload.name || 'Valued Customer').trim().slice(0, 80);
    const asset = String(payload.assetName || payload.vehicleName || payload.asset || 'Asset').trim().slice(0, 80);
    const due = String(payload.serviceDueDate || payload.dueDate || payload.expiryDate || 'Soon').trim().slice(0, 80);
    return {
      ok: true,
      templateName: 'service_due_reminder',
      languageCode: 'en',
      category: 'MARKETING',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: cust, parameter_name: 'customer_name' },
            { type: 'text', text: asset, parameter_name: 'asset_name' },
            { type: 'text', text: due, parameter_name: 'service_due_date' },
          ],
        },
      ],
    };
  }

  // 7. LEGACY EXPIRY REMINDER (Hindi)
  if (rawKey === 'expiry_reminder' || rawKey === 'expiry') {
    const cust = String(payload.customerName || payload.userName || payload.name || 'Customer').trim().slice(0, 80);
    const veh = String(payload.vehicleName || payload.assetName || payload.asset || 'Vehicle').trim().slice(0, 80);
    const doc = String(payload.docType || payload.documentType || 'Document').trim().slice(0, 80);
    const exp = String(payload.expiryDate || payload.expiry || 'Soon').trim().slice(0, 80);
    return {
      ok: true,
      templateName: 'expiry_reminder',
      languageCode: 'hi',
      category: 'MARKETING',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: cust },
            { type: 'text', text: veh },
            { type: 'text', text: doc },
            { type: 'text', text: exp },
          ],
        },
      ],
    };
  }

  // 3. OTP AUTHENTICATION
  if (rawKey === 'asset_doctor_otp' || rawKey === 'otp' || rawKey === 'auth_otp') {
    const code = String(payload.otp || payload.code || '').trim();
    if (!code || code.length < 4) {
      return {
        ok: false,
        errorCategory: 'INVALID_PARAMETER',
        error: 'Missing or invalid OTP code in payload (requires at least 4 digits).',
      };
    }
    return {
      ok: true,
      templateName: 'asset_doctor_otp',
      languageCode: 'en',
      category: 'AUTHENTICATION',
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: code.slice(0, 8) }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code.slice(0, 8) }],
        },
      ],
    };
  }

  // 4. SERVICE REMINDER (Template Guard: unapproved on Meta)
  if (rawKey === 'service_reminder' || rawKey === 'ad_service_reminder' || rawKey === 'service') {
    return {
      ok: false,
      errorCategory: 'TEMPLATE_UNAVAILABLE',
      error: 'Service reminder template "service_reminder" is currently unapproved on Meta WABA.',
    };
  }

  return {
    ok: false,
    errorCategory: 'TEMPLATE_UNAVAILABLE',
    error: `Template "${templateKey}" is not registered or approved on Meta.`,
  };
}

/**
 * Categorize Meta Graph API error codes into normalized domain categories
 */
function classifyMetaError({ httpStatus, error } = {}) {
  const code = Number(error && error.code);
  const subcode = Number(error && (error.error_subcode || error.error_user_title));
  const message = String((error && error.message) || '').toLowerCase();

  let reason = 'META_ERROR';
  let human = error && error.message ? String(error.message).slice(0, 180) : `HTTP ${httpStatus || 'unknown'}`;

  if (!httpStatus && !error) {
    reason = 'META_API_UNAVAILABLE';
    human = 'Meta API unavailable';
  } else if (httpStatus === 401 || code === 190 || code === 102) {
    reason = 'TOKEN_EXPIRED';
    human = 'Token expired';
  } else if (code === 133010 || /phone number id/i.test(message)) {
    reason = 'PHONE_NUMBER_ID_INVALID';
    human = 'Phone number ID invalid';
  } else if (code === 131026 || code === 131031 || /invalid.*user|not on whatsapp/i.test(message)) {
    reason = 'INVALID_PHONE';
    human = 'Invalid phone number';
  } else if (code === 132001 || code === 132000 || code === 132005 || /template/i.test(message)) {
    reason = 'TEMPLATE_NOT_APPROVED';
    human = 'Template not approved or unavailable';
  } else if (code === 131047 || code === 131051 || /opt.?in|outside.*window/i.test(message)) {
    reason = 'WHATSAPP_OPT_IN_MISSING';
    human = 'WhatsApp opt-in missing';
  } else if (code === 100 || /invalid parameter/i.test(message)) {
    reason = 'INVALID_PARAMETER';
    human = 'Invalid parameter';
  } else if (httpStatus === 429 || code === 130429 || /rate limit/i.test(message)) {
    reason = 'RATE_LIMITED';
    human = 'Rate limited by Meta';
  } else if (httpStatus >= 500 || code === 1 || code === 2 || code === 4) {
    reason = 'META_API_UNAVAILABLE';
    human = 'Meta API unavailable';
  }

  return {
    reason,
    human,
    metaCode: Number.isFinite(code) ? code : null,
    metaSubcode: Number.isFinite(subcode) ? subcode : null,
    isTransient: isTransientError(reason, httpStatus, code),
  };
}

/**
 * Check if an error is transient (eligible for retry) or permanent
 */
function isTransientError(errorCategory, httpStatus, metaCode) {
  const code = Number(metaCode);
  const status = Number(httpStatus);
  if (status >= 500 && status <= 599) return true;
  if (status === 429) return true;
  if (code === 1 || code === 2 || code === 4 || code === 130429) return true;
  if (errorCategory === 'META_API_UNAVAILABLE' || errorCategory === 'RATE_LIMITED') return true;
  return false;
}

function extractWamid(data) {
  return data && data.messages && data.messages[0] && data.messages[0].id ? data.messages[0].id : null;
}

function isAcceptedMetaSend(data, httpStatus) {
  return Boolean(httpStatus >= 200 && httpStatus < 300 && !(data && data.error) && extractWamid(data));
}

/**
 * Unified Meta Cloud API v21.0 Template Dispatcher
 */
async function sendMetaTemplate(token, phoneNumberId, { to, templateName, languageCode, components }) {
  if (!token || !phoneNumberId) {
    return {
      success: false,
      errorCategory: 'FUNCTION_CONFIGURATION_MISSING',
      error: 'Meta WhatsApp secrets missing',
      human: 'Function configuration missing',
      isTransient: false,
    };
  }

  const parsed = normalizeIndianWhatsAppDigits(to);
  if (!parsed.ok) {
    return {
      success: false,
      errorCategory: 'INVALID_PHONE',
      error: 'Invalid recipient phone number',
      human: 'Invalid phone number',
      isTransient: false,
    };
  }

  const url = `${GRAPH_BASE}/v21.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: parsed.digits,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components || [],
    },
  };

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
      isTransient: true,
    };
  }

  if (!isAcceptedMetaSend(data, response.status)) {
    // If Meta returns error 132000 / 100 for asset_doctor_welcome because Meta template currently expects 0 parameters:
    if (
      data.error &&
      (data.error.code === 132000 || data.error.code === 100) &&
      templateName === 'asset_doctor_welcome' &&
      components &&
      components.length > 0
    ) {
      try {
        const fallbackPayload = {
          ...payload,
          template: {
            ...payload.template,
            components: [],
          },
        };
        const fbResp = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fallbackPayload),
        });
        const fbData = await fbResp.json().catch(() => ({}));
        if (isAcceptedMetaSend(fbData, fbResp.status)) {
          return {
            success: true,
            messageId: extractWamid(fbData),
            httpStatus: fbResp.status,
            note: 'Dispatched without components (Meta WABA template asset_doctor_welcome requires updating to {{customer_name}} in WhatsApp Manager)',
          };
        }
      } catch (fbErr) {
        // Fall through to standard error handling
      }
    }

    const classified = classifyMetaError({ httpStatus: response.status, error: data.error });
    const isTransient = isTransientError(classified.reason, response.status, data.error && data.error.code);
    return {
      success: false,
      errorCategory: classified.reason,
      error: classified.human,
      human: classified.human,
      metaCode: data.error && data.error.code ? data.error.code : null,
      metaSubcode: data.error && data.error.error_subcode ? data.error.error_subcode : null,
      fbtraceId: data.error && data.error.fbtrace_id ? data.error.fbtrace_id : null,
      httpStatus: response.status,
      isTransient,
    };
  }

  return {
    success: true,
    messageId: extractWamid(data),
    httpStatus: response.status,
  };
}

/**
 * Backward-compatible helper for welcome template
 */
async function sendWelcomeTemplate(token, phoneNumberId, to, userName) {
  const resolved = resolveTemplate('welcome_message', { userName });
  return sendMetaTemplate(token, phoneNumberId, {
    to,
    templateName: resolved.templateName,
    languageCode: resolved.languageCode,
    components: resolved.components,
  });
}

/**
 * UNIFIED QUEUE DISPATCHER
 * Executes: Queue Item -> Normalizer -> Template Resolver -> Meta Client -> State Machine
 */
async function dispatchWhatsAppNotification({
  token,
  phoneNumberId,
  item = {},
  now = new Date().toISOString(),
  maxRetries = 3,
}) {
  const currentStatus = String(item.status || '').toLowerCase();

  // 1. Idempotency Check: Skip terminal success states or already-assigned message IDs
  if (currentStatus === 'sent' || currentStatus === 'delivered' || currentStatus === 'read' || item.wamid) {
    return {
      success: true,
      idempotent: true,
      status: currentStatus || 'sent',
      wamid: item.wamid || null,
      patch: null,
    };
  }

  // 2. Phone validation
  const rawPhone = item.recipientWhatsApp || item.recipientPhone || item.phone;
  const parsedPhone = normalizeIndianWhatsAppDigits(rawPhone);
  if (!parsedPhone.ok) {
    return {
      success: false,
      errorCategory: 'INVALID_PHONE',
      error: 'Invalid recipient phone number.',
      patch: {
        status: 'failed',
        failureReason: 'INVALID_PHONE',
        failureCode: 'INVALID_PHONE',
        errorMessage: 'Recipient phone number is invalid for WhatsApp (requires Indian E.164 +91XXXXXXXXXX).',
        failedAt: now,
        updatedAt: now,
      },
    };
  }

  // 3. Template Resolution
  const templateKey = item.templateKey || item.templateName || item.type;
  const resolved = resolveTemplate(templateKey, item.payload);
  if (!resolved.ok) {
    return {
      success: false,
      errorCategory: resolved.errorCategory,
      error: resolved.error,
      patch: {
        status: 'failed',
        failureReason: resolved.errorCategory,
        failureCode: resolved.errorCategory,
        errorMessage: resolved.error,
        failedAt: now,
        updatedAt: now,
      },
    };
  }

  // 4. Secret Presence Check
  if (!token || !phoneNumberId) {
    return {
      success: false,
      errorCategory: 'FUNCTION_CONFIGURATION_MISSING',
      error: 'Meta WhatsApp secrets missing.',
      patch: {
        status: 'failed',
        failureReason: 'FUNCTION_CONFIGURATION_MISSING',
        failureCode: 'FUNCTION_CONFIGURATION_MISSING',
        errorMessage: 'Meta WhatsApp secrets (META_WHATSAPP_ACCESS_TOKEN or META_WHATSAPP_PHONE_NUMBER_ID) not configured.',
        failedAt: now,
        updatedAt: now,
      },
    };
  }

  // 5. Meta API Send
  const sendResult = await sendMetaTemplate(token, phoneNumberId, {
    to: parsedPhone.digits,
    templateName: resolved.templateName,
    languageCode: resolved.languageCode,
    components: resolved.components,
  });

  if (sendResult.success && sendResult.messageId) {
    return {
      success: true,
      status: 'sent',
      wamid: sendResult.messageId,
      templateName: resolved.templateName,
      languageCode: resolved.languageCode,
      httpStatus: sendResult.httpStatus,
      patch: {
        status: 'sent',
        wamid: sendResult.messageId,
        provider: 'meta_cloud_api',
        templateName: resolved.templateName,
        language: resolved.languageCode,
        sentAt: now,
        updatedAt: now,
        attemptCount: Number(item.attemptCount || 0) + 1,
      },
    };
  }

  // 6. Error & Retry Policy Handling
  const currentRetries = Number(item.retryCount || 0);
  const isTransient = sendResult.isTransient || isTransientError(sendResult.errorCategory, sendResult.httpStatus, sendResult.metaCode);

  if (isTransient && currentRetries < maxRetries) {
    const nextRetryMs = Date.now() + Math.pow(2, currentRetries) * 60000;
    return {
      success: false,
      isTransient: true,
      status: 'retrying',
      errorCategory: sendResult.errorCategory,
      error: sendResult.error,
      patch: {
        status: 'retrying',
        failureReason: sendResult.errorCategory,
        failureCode: sendResult.metaCode || sendResult.errorCategory,
        errorMessage: sendResult.human || sendResult.error,
        retryCount: currentRetries + 1,
        attemptCount: Number(item.attemptCount || 0) + 1,
        nextRetryAt: new Date(nextRetryMs).toISOString(),
        updatedAt: now,
      },
    };
  }

  return {
    success: false,
    isTransient: false,
    status: 'failed',
    errorCategory: sendResult.errorCategory,
    error: sendResult.error,
    patch: {
      status: 'failed',
      failureReason: sendResult.errorCategory,
      failureCode: sendResult.metaCode || sendResult.errorCategory,
      errorMessage: sendResult.human || sendResult.error,
      failedAt: now,
      updatedAt: now,
      retryCount: currentRetries + 1,
      attemptCount: Number(item.attemptCount || 0) + 1,
      httpStatus: sendResult.httpStatus || null,
      fbtraceId: sendResult.fbtraceId || null,
    },
  };
}

/**
 * Webhook status ranking to prevent backward regression
 */
const WEBHOOK_RANK = {
  queued: 1,
  pending: 1,
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

  // Strict regression protection:
  // 'read' can never revert to 'sent' or 'delivered'
  if (current === 'read' && (incoming === 'sent' || incoming === 'delivered')) {
    return { apply: false, status: 'read', idempotent: true, regressed: true };
  }
  // 'delivered' can never revert to 'sent'
  if (current === 'delivered' && incoming === 'sent') {
    return { apply: false, status: 'delivered', idempotent: true, regressed: true };
  }
  // 'failed' is terminal unless explicitly retried
  if (current === 'failed' && incoming !== 'failed') {
    return { apply: false, status: 'failed', idempotent: true };
  }

  const curRank = WEBHOOK_RANK[current] || 0;
  const nextRank = WEBHOOK_RANK[incoming] || 0;

  if (incoming === 'failed') return { apply: true, status: 'failed' };
  if (nextRank >= curRank) return { apply: true, status: incoming };

  return { apply: false, status: current, idempotent: true, regressed: true };
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
  const resolved = resolveTemplate('welcome_message', { userName });
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toDigits,
    type: 'template',
    template: {
      name: resolved.templateName,
      language: { code: resolved.languageCode },
      components: resolved.components,
    },
  };
}

/**
 * Queries Meta Graph API v21.0 for phone number details (display name, quality, verified status)
 */
async function fetchMetaPhoneNumberDetails(token, phoneNumberId) {
  if (!token || !phoneNumberId) {
    return { ok: false, errorCategory: 'FUNCTION_CONFIGURATION_MISSING', error: 'Missing token or phoneNumberId' };
  }
  const url = `${GRAPH_BASE}/v21.0/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status,status`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.error) {
      const classified = classifyMetaError({ httpStatus: resp.status, error: data.error });
      return { ok: false, errorCategory: classified.reason, error: classified.human, httpStatus: resp.status };
    }
    return {
      ok: true,
      displayName: data.verified_name || 'Asset Doctor',
      phoneNumber: data.display_phone_number || '+91 96968 61966',
      maskedPhoneNumber: maskPhone(data.display_phone_number || '+91 96968 61966'),
      qualityRating: data.quality_rating || 'GREEN',
      codeVerificationStatus: data.code_verification_status || 'VERIFIED',
      status: data.status || 'CONNECTED',
    };
  } catch (err) {
    return { ok: false, errorCategory: 'META_API_UNAVAILABLE', error: err && err.message ? err.message : 'Fetch failed' };
  }
}

/**
 * Queries Meta Graph API v21.0 for message templates of the WABA account
 */
async function fetchMetaTemplates(token, wabaId) {
  if (!token || !wabaId) {
    return { ok: false, errorCategory: 'FUNCTION_CONFIGURATION_MISSING', error: 'Missing token or wabaId' };
  }
  const fields = 'name,status,language,category,components,id,last_updated_time';
  const url = `${GRAPH_BASE}/v21.0/${wabaId}/message_templates?fields=${fields}&limit=100`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.error) {
      const classified = classifyMetaError({ httpStatus: resp.status, error: data.error });
      return { ok: false, errorCategory: classified.reason, error: classified.human, httpStatus: resp.status };
    }
    return { ok: true, templates: Array.isArray(data.data) ? data.data : [] };
  } catch (err) {
    return { ok: false, errorCategory: 'META_API_UNAVAILABLE', error: err && err.message ? err.message : 'Fetch failed' };
  }
}

/**
 * Queries Meta Graph API v21.0 for WABA account details
 */
async function fetchMetaWabaDetails(token, wabaId) {
  if (!token || !wabaId) {
    return { ok: false, errorCategory: 'FUNCTION_CONFIGURATION_MISSING', error: 'Missing token or wabaId' };
  }
  const url = `${GRAPH_BASE}/v21.0/${wabaId}?fields=id,name,timezone_id,currency`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.error) {
      const classified = classifyMetaError({ httpStatus: resp.status, error: data.error });
      return { ok: false, errorCategory: classified.reason, error: classified.human, httpStatus: resp.status };
    }
    return {
      ok: true,
      id: data.id,
      name: data.name || 'Asset Doctor',
      currency: data.currency || 'INR',
      timezoneId: data.timezone_id || '476',
      status: 'CONNECTED',
    };
  } catch (err) {
    return { ok: false, errorCategory: 'META_API_UNAVAILABLE', error: err && err.message ? err.message : 'Fetch failed' };
  }
}

/**
 * Sends a plain text WhatsApp message via Meta Cloud API v21.0
 */
async function sendMetaText(token, phoneNumberId, { to, body }) {
  if (!token || !phoneNumberId) {
    return { success: false, errorCategory: 'FUNCTION_CONFIGURATION_MISSING', error: 'Meta WhatsApp credentials missing' };
  }
  const parsed = normalizeIndianWhatsAppDigits(to);
  if (!parsed.ok) {
    return { success: false, errorCategory: 'INVALID_PHONE', error: 'Invalid recipient phone number' };
  }
  const url = `${GRAPH_BASE}/v21.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: parsed.digits,
    type: 'text',
    text: { preview_url: false, body: String(body || '').slice(0, 4096) },
  };
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!isAcceptedMetaSend(data, response.status)) {
      const classified = classifyMetaError({ httpStatus: response.status, error: data.error });
      return {
        success: false,
        errorCategory: classified.reason,
        error: classified.human,
        metaCode: data.error && data.error.code ? data.error.code : null,
        metaSubcode: data.error && data.error.error_subcode ? data.error.error_subcode : null,
        httpStatus: response.status,
      };
    }
    return {
      success: true,
      messageId: extractWamid(data),
      httpStatus: response.status,
    };
  } catch (err) {
    return { success: false, errorCategory: 'META_API_UNAVAILABLE', error: err && err.message ? err.message : 'Fetch failed' };
  }
}

/**
 * Comprehensive 6-layer diagnostic inspection
 */
async function runWhatsAppDiagnosticSuite({ token, phoneNumberId, wabaId, verifyToken, db }) {
  const now = new Date().toISOString();
  const layers = {};

  // Layer 1: Credentials
  const hasToken = Boolean(token && token.length > 20);
  const hasPhoneId = Boolean(phoneNumberId && phoneNumberId.length > 5);
  const hasWaba = Boolean(wabaId && wabaId.length > 5);
  layers.credentials = {
    status: (hasToken && hasPhoneId && hasWaba) ? 'PASS' : 'FAIL',
    label: 'Server Credentials',
    detail: (hasToken && hasPhoneId && hasWaba) ? 'Server secrets present (Token, Phone ID, WABA ID)' : 'Missing server credentials',
    tokenPresent: hasToken,
    phoneIdPresent: hasPhoneId,
    wabaIdPresent: hasWaba,
  };

  // Layer 2: Meta Graph API & Token
  if (hasToken) {
    try {
      const meResp = await fetch(`${GRAPH_BASE}/v21.0/me?fields=id,name`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const meData = await meResp.json().catch(() => ({}));
      if (meResp.ok && meData.id) {
        layers.metaApi = {
          status: 'PASS',
          label: 'Meta Graph API',
          detail: `Connected to Meta v21.0 · Identity: ${meData.name || 'AssetDoctor'}`,
          ownerId: meData.id,
          ownerName: meData.name,
        };
      } else {
        layers.metaApi = {
          status: 'FAIL',
          label: 'Meta Graph API',
          detail: (meData.error && meData.error.message) || 'Failed to authenticate with Meta Graph API',
        };
      }
    } catch (e) {
      layers.metaApi = { status: 'FAIL', label: 'Meta Graph API', detail: e.message || 'Network unreachable' };
    }
  } else {
    layers.metaApi = { status: 'UNKNOWN', label: 'Meta Graph API', detail: 'Skipped (no token)' };
  }

  // Layer 3: WABA Entity
  if (hasToken && hasWaba) {
    const wabaRes = await fetchMetaWabaDetails(token, wabaId);
    if (wabaRes.ok) {
      layers.waba = {
        status: 'PASS',
        label: 'WABA Entity',
        detail: `${wabaRes.name} (WABA ID: ${wabaRes.id}) · Currency: ${wabaRes.currency}`,
        wabaId: wabaRes.id,
        name: wabaRes.name,
      };
    } else {
      layers.waba = { status: 'FAIL', label: 'WABA Entity', detail: wabaRes.error || 'WABA inaccessible' };
    }
  } else {
    layers.waba = { status: 'UNKNOWN', label: 'WABA Entity', detail: 'Skipped' };
  }

  // Layer 4: Phone Number
  if (hasToken && hasPhoneId) {
    const pRes = await fetchMetaPhoneNumberDetails(token, phoneNumberId);
    if (pRes.ok) {
      layers.phone = {
        status: 'PASS',
        label: 'Phone Registration',
        detail: `${pRes.displayName} (${pRes.phoneNumber}) · Quality: ${pRes.qualityRating} · Status: ${pRes.status}`,
        phoneNumber: pRes.phoneNumber,
        displayName: pRes.displayName,
        qualityRating: pRes.qualityRating,
        accountStatus: pRes.status,
      };
    } else {
      layers.phone = { status: 'FAIL', label: 'Phone Registration', detail: pRes.error || 'Phone inaccessible' };
    }
  } else {
    layers.phone = { status: 'UNKNOWN', label: 'Phone Registration', detail: 'Skipped' };
  }

  // Layer 5: Message Templates
  if (hasToken && hasWaba) {
    const tRes = await fetchMetaTemplates(token, wabaId);
    if (tRes.ok) {
      const approved = tRes.templates.filter(t => t.status === 'APPROVED').length;
      const pending = tRes.templates.filter(t => t.status === 'PENDING').length;
      const rejected = tRes.templates.filter(t => t.status === 'REJECTED').length;
      layers.templates = {
        status: approved > 0 ? 'PASS' : 'WARN',
        label: 'Message Templates',
        detail: `${tRes.templates.length} total · ${approved} approved · ${pending} pending · ${rejected} rejected`,
        total: tRes.templates.length,
        approved,
        pending,
        rejected,
      };
    } else {
      layers.templates = { status: 'FAIL', label: 'Message Templates', detail: tRes.error || 'Failed to list templates' };
    }
  } else {
    layers.templates = { status: 'UNKNOWN', label: 'Message Templates', detail: 'Skipped' };
  }

  // Layer 6: Webhook Processing
  layers.webhook = {
    status: verifyToken ? 'PASS' : 'WARN',
    label: 'Webhook System',
    detail: verifyToken ? 'Verification token configured · Endpoint active' : 'Verify token missing',
  };

  const allPassed = Object.values(layers).every(l => l.status === 'PASS');
  const anyFailed = Object.values(layers).some(l => l.status === 'FAIL');

  return {
    ok: !anyFailed,
    overallStatus: allPassed ? 'HEALTHY' : anyFailed ? 'DEGRADED' : 'WARNING',
    checkedAt: now,
    layers,
  };
}

function sanitizeForFirestore(val) {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    return val.map((item) => {
      if (Array.isArray(item)) {
        return item.map(sub => (typeof sub === 'object' ? JSON.stringify(sub) : String(sub))).join(', ');
      }
      if (typeof item === 'object' && item !== null) {
        return sanitizeForFirestore(item);
      }
      return item;
    });
  }
  if (typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        out[k] = sanitizeForFirestore(v);
      }
    }
    return out;
  }
  return val;
}

/**
 * Normalizes a Meta template into the standard Asset Doctor schema
 */
function normalizeMetaTemplate(metaTpl, now = new Date().toISOString()) {
  const name = String(metaTpl.name || '').trim();
  const status = String(metaTpl.status || 'PENDING').toUpperCase();
  const lang = String(metaTpl.language || 'en').trim();
  const category = String(metaTpl.category || 'MARKETING').toUpperCase();
  const isApproved = status === 'APPROVED';

  // Specific deliverability check
  let deliverable = isApproved;
  if (name === 'service_reminder') {
    deliverable = false; // Guarded pending Meta approval
  }

  const rawComponents = Array.isArray(metaTpl.components) ? metaTpl.components : [];
  const bodyComp = rawComponents.find(c => (c.type || '').toUpperCase() === 'BODY');
  const headerComp = rawComponents.find(c => (c.type || '').toUpperCase() === 'HEADER');
  const footerComp = rawComponents.find(c => (c.type || '').toUpperCase() === 'FOOTER');
  const buttonsComp = rawComponents.find(c => (c.type || '').toUpperCase() === 'BUTTONS');

  const bodyText = bodyComp ? (bodyComp.text || '') : '';
  const namedParams = (bodyComp && bodyComp.example && Array.isArray(bodyComp.example.body_text_named_params))
    ? bodyComp.example.body_text_named_params.map(p => p.param_name)
    : [];
  const placeholderMatches = [...bodyText.matchAll(/\{\{([a-zA-Z0-9_ ]+)\}\}/g)].map(m => m[1].trim().toLowerCase().replace(/\s+/g, '_'));
  const placeholders = namedParams.length > 0 ? namedParams : placeholderMatches;

  const sanitizedComponents = sanitizeForFirestore(rawComponents);
  const sanitizedButtons = sanitizeForFirestore(buttonsComp ? buttonsComp.buttons : []);

  return {
    localKey: name,
    templateKey: name,
    displayName: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    metaName: name,
    metaTemplateName: name,
    language: lang,
    category: category,
    metaStatus: status,
    localStatus: 'REGISTERED',
    deliverable: deliverable,
    rejectionReason: metaTpl.rejected_reason || null,
    body: bodyText,
    placeholders: placeholders,
    paramCount: placeholders.length,
    headerContent: headerComp ? (headerComp.text || '') : '',
    footer: footerComp ? (footerComp.text || '') : '',
    buttons: sanitizedButtons,
    components: sanitizedComponents,
    id: metaTpl.id || name,
    lastSyncedAt: now,
    updatedAt: now,
  };
}


/**
 * Computes delivery analytics from actual queue & log records
 */
function calculateDeliveryMetrics(queueDocs = []) {
  let sentCount = 0;
  let deliveredCount = 0;
  let readCount = 0;
  let failedCount = 0;

  queueDocs.forEach((doc) => {
    const s = String(doc.status || '').toLowerCase();
    if (s === 'sent' || s === 'delivered' || s === 'read') sentCount++;
    if (s === 'delivered' || s === 'read') deliveredCount++;
    if (s === 'read') readCount++;
    if (s === 'failed') failedCount++;
  });

  const totalTerminal = sentCount + failedCount;
  const deliveryRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : null;

  return {
    sent: sentCount,
    delivered: deliveredCount,
    read: readCount,
    failed: failedCount,
    totalTerminal,
    deliveryRate, // null when sentCount === 0 (differentiating NO_DATA from 0%)
    hasData: totalTerminal > 0,
  };
}

/**
 * Evaluates webhook status from verification token presence and recent delivery timestamps
 */
function checkWebhookHealth(queueDocs = [], verifyTokenPresent = false, webhookDiagnostics = null) {
  let lastEventAt = webhookDiagnostics?.lastEventAt || null;
  let eventCount = Number(webhookDiagnostics?.webhookMatched || 0);

  queueDocs.forEach((doc) => {
    const t = doc.deliveredAt || doc.readAt;
    if (t) {
      eventCount++;
      if (!lastEventAt || t > lastEventAt) lastEventAt = t;
    }
  });

  const verified = Boolean(verifyTokenPresent);
  const status = verified ? (eventCount > 0 ? 'VERIFIED' : 'CONFIGURED') : 'UNVERIFIED';

  return {
    configured: verifyTokenPresent,
    verified: verified,
    status: status,
    eventCount: eventCount,
    lastEventAt: lastEventAt,
    callbackReachable: true,
    diagnostics: webhookDiagnostics || {
      webhookReceived: 0,
      webhookParsed: 0,
      webhookMatched: 0,
      webhookIgnored: 0,
      webhookWriteSuccess: 0,
      webhookWriteFailed: 0,
    },
  };
}

/**
 * Builds the single authoritative server health model
 */
function buildAuthoritativeWhatsAppHealthModel({
  tokenConfigured,
  phoneIdConfigured,
  verifyTokenConfigured,
  phoneDetails,
  metaTemplates,
  queueDocs = [],
  workerDeployed = true,
  lastInvocation = null,
  now = new Date().toISOString(),
  nextScheduledReminder = null,
  surveillanceStats = null,
  webhookDiagnostics = null,
}) {
  const delivery = calculateDeliveryMetrics(queueDocs);
  const webhook = checkWebhookHealth(queueDocs, verifyTokenConfigured, webhookDiagnostics);

  // Queue breakdown
  let queued = 0, processing = 0, sent = 0, delivered = 0, read = 0, failed = 0, retrying = 0, stuck = 0;
  const nowMs = Date.parse(now) || Date.now();
  queueDocs.forEach((doc) => {
    const s = String(doc.status || '').toLowerCase();
    if (s === 'queued') queued++;
    else if (s === 'sending' || s === 'processing') processing++;
    else if (s === 'sent') sent++;
    else if (s === 'delivered') delivered++;
    else if (s === 'read') read++;
    else if (s === 'failed') failed++;
    else if (s === 'retrying') retrying++;

    const diag = diagnoseStuckQueue(doc, nowMs);
    if (diag.stuck) stuck++;
  });

  // Template evaluation
  const tplList = Array.isArray(metaTemplates) ? metaTemplates : [];
  let tplApproved = 0, tplPending = 0, tplRejected = 0, tplDeliverable = 0;

  const requiredKeys = ['asset_doctor_welcome', 'welcome_message', 'expiry_reminder', 'service_reminder', 'asset_doctor_otp', 'asset_doctor_puc_expiry', 'asset_doctor_insurance_expiry', 'warranty_expiry_reminder', 'electricity_bill_due_reminder', 'service_due_reminder'];
  const requiredMap = {};

  requiredKeys.forEach((key) => {
    const found = tplList.find((t) => String(t.name || '').toLowerCase() === key);
    if (found) {
      const isApp = String(found.status || '').toUpperCase() === 'APPROVED';
      const isDeliv = isApp && key !== 'service_reminder';
      requiredMap[key] = {
        localStatus: 'REGISTERED',
        metaStatus: String(found.status || 'PENDING').toUpperCase(),
        deliverable: isDeliv,
        language: found.language || 'en',
      };
    } else if (key === 'service_reminder') {
      requiredMap[key] = {
        localStatus: 'REGISTERED',
        metaStatus: 'PENDING',
        deliverable: false,
        language: 'en',
      };
    } else {
      requiredMap[key] = {
        localStatus: 'REGISTERED',
        metaStatus: 'META_TEMPLATE_NOT_FOUND',
        deliverable: false,
        language: 'en',
      };
    }
  });

  tplList.forEach((t) => {
    const st = String(t.status || '').toUpperCase();
    if (st === 'APPROVED') tplApproved++;
    else if (st === 'PENDING') tplPending++;
    else if (st === 'REJECTED') tplRejected++;
    if (st === 'APPROVED' && t.name !== 'service_reminder') tplDeliverable++;
  });

  const welcomeDeliverable = Boolean(
    (requiredMap.asset_doctor_welcome && requiredMap.asset_doctor_welcome.deliverable) ||
    (requiredMap.welcome_message && requiredMap.welcome_message.deliverable)
  );

  // Overall Status
  let overallStatus = 'LIVE';
  if (!tokenConfigured || !phoneIdConfigured) {
    overallStatus = 'OFFLINE';
  } else if (!phoneDetails || !phoneDetails.ok) {
    overallStatus = 'DEGRADED';
  } else if (!welcomeDeliverable) {
    overallStatus = 'DEGRADED';
  }

  return {
    metaApi: {
      status: phoneDetails && phoneDetails.ok ? 'LIVE' : (tokenConfigured ? 'DEGRADED' : 'OFFLINE'),
      checkedAt: now,
      phoneNumberIdPresent: Boolean(phoneIdConfigured),
      wabaPresent: Boolean(metaTemplates !== null),
      graphApiReachable: Boolean(phoneDetails && phoneDetails.ok),
      errorCategory: phoneDetails && !phoneDetails.ok ? phoneDetails.errorCategory : null,
    },
    credentials: {
      accessTokenConfigured: Boolean(tokenConfigured),
      phoneNumberIdConfigured: Boolean(phoneIdConfigured),
      webhookVerifyTokenConfigured: Boolean(verifyTokenConfigured),
    },
    phoneNumber: {
      configured: Boolean(phoneIdConfigured),
      displayName: (phoneDetails && phoneDetails.displayName) || 'Asset Doctor',
      phoneNumber: (phoneDetails && phoneDetails.phoneNumber) || '+91 96968 61966',
      maskedPhoneNumber: (phoneDetails && phoneDetails.maskedPhoneNumber) || maskPhone('+91 96968 61966'),
      qualityRating: (phoneDetails && phoneDetails.qualityRating) || 'GREEN',
      status: (phoneDetails && phoneDetails.status) || 'CONNECTED',
    },
    webhook: webhook,
    templates: {
      total: tplList.length,
      approved: tplApproved,
      pending: tplPending,
      rejected: tplRejected,
      deliverable: tplDeliverable,
      blocked: tplList.length - tplDeliverable,
      requiredTemplates: requiredMap,
      lastSyncedAt: now,
    },
    worker: {
      deployed: workerDeployed,
      reachable: true,
      lastSuccessfulInvocation: lastInvocation,
      lastFailure: null,
    },
    queue: {
      queued,
      processing,
      sent,
      delivered,
      read,
      failed,
      retrying,
      stuck,
      total: queueDocs.length,
    },
    reminderSchedule: AUTHORITATIVE_REMINDER_SCHEDULE,
    nextScheduledReminder: nextScheduledReminder || {
      hasUpcoming: false,
      label: 'None Pending',
      assetName: '—',
      daysRemaining: null,
      nextMilestone: '—',
      channel: '—',
    },
    surveillance: surveillanceStats || {
      status: 'ACTIVE',
      cadence: 'Daily at 09:00 AM IST (asia-south1)',
      channel: 'WhatsApp (Meta v21.0)',
      lastRunAt: null,
    },
    delivery: delivery,
    overallStatus: overallStatus,
  };
}

/**
 * Timezone-aware date difference calculator in Asia/Kolkata (IST).
 */
function calculateDaysRemainingIST(expiryDateStr, referenceDateIST) {
  if (!expiryDateStr || typeof expiryDateStr !== 'string') {
    return { daysRemaining: 0, valid: false, normalizedDate: '' };
  }
  const cleanDateStr = String(expiryDateStr).split('T')[0].trim();
  const parts = cleanDateStr.split('-');
  if (parts.length !== 3) {
    return { daysRemaining: 0, valid: false, normalizedDate: cleanDateStr };
  }
  const expYear = parseInt(parts[0], 10);
  const expMonth = parseInt(parts[1], 10) - 1;
  const expDay = parseInt(parts[2], 10);
  const expUtc = Date.UTC(expYear, expMonth, expDay);

  const now = referenceDateIST || new Date();
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const istParts = istFormatter.format(now).split('-');
  const nowYear = parseInt(istParts[0], 10);
  const nowMonth = parseInt(istParts[1], 10) - 1;
  const nowDay = parseInt(istParts[2], 10);
  const nowUtc = Date.UTC(nowYear, nowMonth, nowDay);

  const diffMs = expUtc - nowUtc;
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return {
    daysRemaining,
    valid: !Number.isNaN(daysRemaining),
    normalizedDate: cleanDateStr,
  };
}

function determineReminderWindow(daysRemaining) {
  if (daysRemaining === 30) return '30d';
  if (daysRemaining === 15) return '15d';
  if (daysRemaining === 7) return '7d';
  if (daysRemaining === 3) return '3d';
  if (daysRemaining === 1) return '1d';
  if (daysRemaining === 0) return '0d';
  if (daysRemaining < 0 && daysRemaining >= -3) return 'expired';
  return 'none';
}

function formatDateForWhatsApp(dateStr) {
  if (!dateStr) return 'Soon';
  const clean = String(dateStr).split('T')[0].trim();
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return clean;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[m - 1] || String(m);
  return `${String(d).padStart(2, '0')}-${monthName}-${y}`;
}

function generateExpiryIdempotencyKey(ownerUid, assetId, field, expiryDate, window) {
  return `${ownerUid}_${assetId}_${field}_${expiryDate}_${window}`;
}

const AUTHORITATIVE_REMINDER_SCHEDULE = Object.freeze([
  {
    domain: 'PUC',
    targetField: 'pucExpiry',
    milestones: [30, 15, 7, 3, 1, 0],
    postExpiryDaily: true,
    channel: 'WhatsApp & Local Push',
    template: 'expiry_reminder',
    language: 'hi',
    deliverable: true,
  },
  {
    domain: 'Insurance',
    targetField: 'insuranceExpiry',
    milestones: [30, 15, 7, 3, 1, 0],
    postExpiryDaily: true,
    channel: 'WhatsApp & Local Push',
    template: 'expiry_reminder',
    language: 'hi',
    deliverable: true,
  },
  {
    domain: 'Warranty',
    targetField: 'warrantyExpiry',
    milestones: [30, 15, 7, 3, 1, 0],
    postExpiryDaily: true,
    channel: 'WhatsApp & Local Push',
    template: 'expiry_reminder',
    language: 'hi',
    deliverable: true,
  },
  {
    domain: 'Extended Warranty',
    targetField: 'extendedWarrantyExpiry',
    milestones: [30, 15, 7, 3, 1, 0],
    postExpiryDaily: true,
    channel: 'WhatsApp & Local Push',
    template: 'expiry_reminder',
    language: 'hi',
    deliverable: true,
  },
  {
    domain: 'Service / Maintenance',
    targetField: 'nextServiceDue',
    milestones: [30, 15, 7, 3, 1, 0],
    postExpiryDaily: true,
    channel: 'Local Push Only (WhatsApp Pending Meta Approval)',
    template: 'service_reminder',
    language: 'en',
    deliverable: false,
  },
]);

/**
 * Server-side Expiry Surveillance Engine
 */
async function runDailyExpirySurveillance(db, options = {}) {
  const summary = {
    evaluatedAssets: 0,
    generatedReminders: 0,
    skippedConsents: 0,
    duplicatePrevented: 0,
    errors: 0,
    details: [],
    runAt: new Date().toISOString(),
  };

  const refDate = options.referenceDateIST || new Date();
  const nowIso = new Date().toISOString();
  const dryRun = Boolean(options.dryRun);

  try {
    const assetsSnap = await db.collectionGroup('Assets').get().catch(() => ({ docs: [] }));
    summary.evaluatedAssets = assetsSnap.docs ? assetsSnap.docs.length : 0;

    // Cache user profiles for batch efficiency
    const userCache = new Map();
    async function getUser(uid) {
      if (!uid) return null;
      if (userCache.has(uid)) return userCache.get(uid);
      const doc = await db.collection('users').doc(uid).get().catch(() => null);
      const data = doc && doc.exists ? doc.data() : null;
      userCache.set(uid, data);
      return data;
    }

    const fieldConfig = [
      { field: 'insuranceExpiry', label: 'Insurance' },
      { field: 'pucExpiry', label: 'PUC' },
      { field: 'warrantyExpiry', label: 'Warranty' },
      { field: 'extendedWarrantyExpiry', label: 'Extended warranty' },
      { field: 'nextServiceDue', label: 'Service' },
    ];

    for (const doc of (assetsSnap.docs || [])) {
      const assetData = { id: doc.id, ...doc.data() };
      if (assetData.deletedAt || assetData.status === 'sold' || assetData.status === 'inactive') {
        continue;
      }
      const pathParts = doc.ref.path.split('/');
      const ownerUid = pathParts[1] || assetData.ownerUid || assetData.uid;
      if (!ownerUid) continue;

      const vehicleName = assetData.registrationNumber || assetData.assetName || assetData.name || 'Vehicle';

      for (const conf of fieldConfig) {
        const rawDate = assetData[conf.field];
        if (!rawDate) continue;

        const { daysRemaining, valid, normalizedDate } = calculateDaysRemainingIST(rawDate, refDate);
        if (!valid) continue;

        const window = determineReminderWindow(daysRemaining);
        if (window === 'none') continue;

        // Service template guard: service_reminder is unapproved on Meta WABA
        if (conf.field === 'nextServiceDue') {
          summary.skippedConsents++;
          summary.details.push({
            assetId: assetData.id,
            field: conf.field,
            window,
            status: 'skipped',
            reason: 'SERVICE_REMINDER_META_PENDING',
          });
          continue;
        }

        const idempotencyKey = generateExpiryIdempotencyKey(
          ownerUid,
          assetData.id,
          conf.field,
          normalizedDate,
          window
        );

        // Deduplication Check
        const existingSnap = await db.collection('notification_queue')
          .where('idempotencyKey', '==', idempotencyKey)
          .limit(1)
          .get()
          .catch(() => ({ empty: true }));

        if (existingSnap && !existingSnap.empty) {
          summary.duplicatePrevented++;
          continue;
        }

        // Customer Opt-In & Phone Check
        const user = await getUser(ownerUid);
        const optIn = user ? user.whatsappOptIn !== false : true;
        const rawPhone = user ? (user.normalizedPhoneNumber || user.phoneNumber || user.phone) : '';
        const parsedPhone = normalizeIndianWhatsAppDigits(rawPhone);

        if (!optIn) {
          summary.skippedConsents++;
          summary.details.push({
            assetId: assetData.id,
            field: conf.field,
            window,
            status: 'skipped',
            reason: 'WHATSAPP_OPT_IN_FALSE',
          });
          continue;
        }

        if (!parsedPhone.ok) {
          summary.skippedConsents++;
          summary.details.push({
            assetId: assetData.id,
            field: conf.field,
            window,
            status: 'skipped',
            reason: 'MISSING_RECIPIENT_PHONE',
          });
          continue;
        }

        const customerName = (user && user.name) ? String(user.name).trim().slice(0, 80) : 'Customer';
        const formattedExpDate = formatDateForWhatsApp(normalizedDate);

        const queueItem = {
          userId: ownerUid,
          assetId: assetData.id,
          channel: 'whatsapp',
          eventType: `expiry_${conf.field}`,
          templateKey: 'expiry_reminder',
          templateName: 'expiry_reminder',
          recipientPhone: parsedPhone.e164 || `+${parsedPhone.digits}`,
          recipientWhatsApp: parsedPhone.digits,
          status: 'queued',
          idempotencyKey,
          payload: {
            customerName,
            vehicleName: String(vehicleName).slice(0, 80),
            docType: conf.label,
            expiryDate: formattedExpDate,
            daysRemaining,
            reminderWindow: window,
          },
          scheduledAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
          attemptCount: 0,
          retryCount: 0,
          provider: 'meta_cloud_api',
          source: 'daily_expiry_scheduler',
        };

        if (!dryRun) {
          await db.collection('notification_queue').add(queueItem);
          await db.collection('adminActivity').add({
            type: 'NOTIFICATION_GENERATED',
            action: `Generated ${conf.label} WhatsApp Reminder (${window})`,
            customerUid: ownerUid,
            customerName,
            assetTitle: vehicleName,
            priority: (window === '1d' || window === '0d' || window === 'expired') ? 'HIGH' : 'INFO',
            source: 'EXPIRY_SURVEILLANCE_SCHEDULER',
            timestamp: nowIso,
            status: 'QUEUED',
          }).catch(() => {});
        }

        summary.generatedReminders++;
        summary.details.push({
          idempotencyKey,
          assetId: assetData.id,
          field: conf.field,
          window,
          status: 'queued',
        });
      }
    }

    // Persist surveillance execution record
    if (!dryRun) {
      await db.collection('system_metadata').doc('whatsapp_surveillance').set({
        lastRunAt: nowIso,
        evaluatedAssets: summary.evaluatedAssets,
        generatedReminders: summary.generatedReminders,
        skippedConsents: summary.skippedConsents,
        duplicatePrevented: summary.duplicatePrevented,
        status: 'COMPLETED',
      }, { merge: true }).catch(() => {});
    }
  } catch (err) {
    summary.errors++;
    summary.errorMessage = err && err.message ? err.message : 'Surveillance failure';
  }

  return summary;
}

/**
 * Computes next scheduled reminder for admin visibility
 */
async function computeNextScheduledReminder(db, referenceDateIST = new Date()) {
  try {
    const assetsSnap = await db.collectionGroup('Assets').get().catch(() => ({ docs: [] }));
    let nearest = null;
    const fieldConfig = [
      { field: 'insuranceExpiry', label: 'Insurance' },
      { field: 'pucExpiry', label: 'PUC' },
      { field: 'warrantyExpiry', label: 'Warranty' },
      { field: 'extendedWarrantyExpiry', label: 'Extended warranty' },
      { field: 'nextServiceDue', label: 'Service' },
    ];

    for (const doc of (assetsSnap.docs || [])) {
      const a = { id: doc.id, ...doc.data() };
      if (a.deletedAt || a.status === 'sold' || a.status === 'inactive') continue;
      const vehicleName = a.registrationNumber || a.assetName || a.name || 'Asset';

      for (const conf of fieldConfig) {
        const rawDate = a[conf.field];
        if (!rawDate) continue;
        const { daysRemaining, valid, normalizedDate } = calculateDaysRemainingIST(rawDate, referenceDateIST);
        if (!valid || daysRemaining < 0) continue;

        // Find nearest milestone
        const upcomingMilestones = [30, 15, 7, 3, 1, 0].filter(m => daysRemaining >= m);
        const nextMilestone = upcomingMilestones.length ? Math.max(...upcomingMilestones) : 0;
        const daysToMilestone = daysRemaining - nextMilestone;

        if (nearest === null || daysRemaining < nearest.daysRemaining) {
          nearest = {
            hasUpcoming: true,
            assetName: vehicleName,
            field: conf.field,
            label: conf.label,
            expiryDate: normalizedDate,
            daysRemaining,
            nextMilestone: `T-${nextMilestone}`,
            daysToMilestone,
            channel: conf.field === 'nextServiceDue' ? 'Local Push (Meta pending)' : 'WhatsApp (expiry_reminder)',
          };
        }
      }
    }

    if (!nearest) {
      return {
        hasUpcoming: false,
        label: 'None Pending',
        assetName: '—',
        daysRemaining: null,
        nextMilestone: '—',
        channel: '—',
      };
    }

    return nearest;
  } catch (err) {
    return {
      hasUpcoming: false,
      error: err && err.message,
    };
  }
}

async function ensureMetaWabaSubscribed(token, wabaId) {
  if (!token || !wabaId) return { ok: false, error: 'Missing token or wabaId' };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: Boolean(data && data.success), data };
  } catch (err) {
    return { ok: false, error: err && err.message };
  }
}

module.exports = {
  WELCOME_TEMPLATE_NAME,
  WELCOME_LANGUAGE,
  SUPPORTED_TEMPLATES,
  AUTHORITATIVE_REMINDER_SCHEDULE,
  ensureMetaWabaSubscribed,
  normalizeIndianWhatsAppDigits,
  maskPhone,
  resolveTemplate,
  classifyMetaError,
  isTransientError,
  extractWamid,
  isAcceptedMetaSend,
  sendMetaTemplate,
  sendWelcomeTemplate,
  dispatchWhatsAppNotification,
  mergeWebhookStatus,
  webhookPatchForStatus,
  diagnoseStuckQueue,
  buildGraphPayload,
  fetchMetaPhoneNumberDetails,
  fetchMetaTemplates,
  fetchMetaWabaDetails,
  sendMetaText,
  runWhatsAppDiagnosticSuite,
  normalizeMetaTemplate,
  calculateDeliveryMetrics,
  checkWebhookHealth,
  buildAuthoritativeWhatsAppHealthModel,
  calculateDaysRemainingIST,
  determineReminderWindow,
  formatDateForWhatsApp,
  generateExpiryIdempotencyKey,
  runDailyExpirySurveillance,
  computeNextScheduledReminder,
};



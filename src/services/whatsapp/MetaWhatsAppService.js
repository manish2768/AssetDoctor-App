/**
 * Meta WhatsApp Cloud API Service — Asset Doctor (Gadi Doctor)
 * 
 * Secure server-side service for WhatsApp Business Cloud API.
 * Handles phone number registration, template & text messaging, and status checks.
 * 
 * SECURITY RULES:
 * 1. NEVER log, return, or expose the Meta Access Token.
 * 2. Token is read strictly from server-side environment variables.
 * 3. Frontend must NEVER have access to the access token.
 */

const DEFAULT_API_VERSION = 'v21.0';
const GRAPH_BASE_URL = 'https://graph.facebook.com';

/**
 * Retrieves sanitized configuration from environment variables.
 * Checks both META_WHATSAPP_* and WHATSAPP_* naming conventions.
 */
export function getWhatsAppConfig() {
  const env = (typeof process !== 'undefined' && process.env) ? process.env : {};

  const token = (
    env.META_WHATSAPP_ACCESS_TOKEN ||
    env.WHATSAPP_ACCESS_TOKEN ||
    env.WHATSAPP_TOKEN ||
    ''
  ).trim();

  const phoneNumberId = (
    env.META_WHATSAPP_PHONE_NUMBER_ID ||
    env.WHATSAPP_PHONE_NUMBER_ID ||
    env.WHATSAPP_PHONE_ID ||
    ''
  ).trim();

  const businessAccountId = (
    env.META_WHATSAPP_BUSINESS_ACCOUNT_ID ||
    env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
    env.WHATSAPP_WABA_ID ||
    ''
  ).trim();

  const apiVersion = (
    env.META_WHATSAPP_API_VERSION ||
    env.WHATSAPP_API_VERSION ||
    DEFAULT_API_VERSION
  ).trim();

  return {
    token,
    phoneNumberId,
    businessAccountId,
    apiVersion,
  };
}

/**
 * Returns safe health/status report without revealing sensitive token.
 */
export function getWhatsAppConfigStatus() {
  const config = getWhatsAppConfig();
  const hasToken = Boolean(config.token && config.token.length > 20);
  const hasPhoneNumberId = Boolean(config.phoneNumberId && config.phoneNumberId.length > 5);
  const hasWabaId = Boolean(config.businessAccountId && config.businessAccountId.length > 5);

  const maskedPhoneId = hasPhoneNumberId
    ? `${config.phoneNumberId.slice(0, 4)}...${config.phoneNumberId.slice(-4)}`
    : 'NOT_CONFIGURED';

  return {
    isConfigured: hasToken && hasPhoneNumberId,
    tokenStatus: hasToken ? 'CONFIGURED (SECURE)' : 'MISSING',
    hasToken,
    hasPhoneNumberId,
    hasBusinessAccountId: hasWabaId,
    phoneNumberIdMasked: maskedPhoneId,
    apiVersion: config.apiVersion,
  };
}

/**
 * Normalizes phone numbers to standard E.164 digits without '+' or spaces.
 * e.g., "+91 98765 43210" -> "919876543210"
 */
export function normalizeWhatsAppNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  // Default to India (+91) if 10 digits provided
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Normalizes phone numbers to E.164 format with leading '+'
 * e.g., "9918288299" -> "+919918288299"
 */
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
 * Parses and maps Meta Cloud API error responses to clean human-actionable errors.
 */
export function parseMetaApiError(errorData, httpStatus) {
  const metaError = errorData?.error || errorData;
  const code = metaError?.code;
  const subcode = metaError?.error_subcode;
  const message = metaError?.message || 'Unknown Meta API error';
  const type = metaError?.type || 'OAuthException';
  const fbtrace_id = metaError?.fbtrace_id;

  let userFriendly = message;
  let errorCategory = 'GENERIC_META_ERROR';

  // 1. Token & Authentication Errors
  if (code === 190 || httpStatus === 401) {
    errorCategory = 'AUTHENTICATION_EXPIRED_OR_INVALID';
    if (subcode === 463 || subcode === 467) {
      userFriendly = 'The Meta WhatsApp access token has expired. Please refresh the System User token in Meta Business Manager.';
    } else {
      userFriendly = 'Invalid Meta WhatsApp access token. Ensure the System User has full access to the WhatsApp app.';
    }
  }

  // 2. Permission / Scope Errors
  else if (code === 10 || code === 200 || code === 298 || httpStatus === 403) {
    errorCategory = 'INSUFFICIENT_PERMISSIONS';
    userFriendly = 'Permission denied. Ensure the System User has "whatsapp_business_messaging" and "whatsapp_business_management" permissions.';
  }

  // 3. Phone Number ID / Object Not Found
  else if (code === 100 && (subcode === 33 || message.includes('does not exist') || message.includes('Object with ID'))) {
    errorCategory = 'INVALID_PHONE_NUMBER_ID';
    userFriendly = 'Invalid META_WHATSAPP_PHONE_NUMBER_ID. The specified Phone Number ID was not found in your Meta Business Account.';
  }

  // 4. PIN & Registration Specific Errors
  else if (code === 133005 || message.includes('already registered')) {
    errorCategory = 'NUMBER_ALREADY_REGISTERED';
    userFriendly = 'This WhatsApp phone number is already registered and active on Meta Cloud API.';
  } else if (code === 133000 || code === 133004 || message.includes('pin') || message.includes('PIN')) {
    errorCategory = 'INVALID_TWO_STEP_PIN';
    userFriendly = 'Invalid Two-Step Verification 6-digit PIN. Please provide the exact 6-digit PIN configured in Meta WhatsApp Manager.';
  }

  // 5. Rate Limiting & Throttling
  else if (code === 4 || code === 17 || code === 80007 || code === 130429 || httpStatus === 429) {
    errorCategory = 'RATE_LIMIT_EXCEEDED';
    userFriendly = 'Meta WhatsApp Cloud API rate limit reached. Please wait a few moments before retrying.';
  }

  // 6. Template Errors
  else if (code === 132000 || code === 132001 || code === 132012) {
    errorCategory = 'TEMPLATE_NOT_FOUND_OR_PARAM_MISMATCH';
    userFriendly = `WhatsApp Template error: ${message}. Ensure the template is approved in WhatsApp Business Manager.`;
  }

  return {
    success: false,
    error: userFriendly,
    errorCategory,
    metaCode: code,
    metaSubcode: subcode,
    metaType: type,
    httpStatus,
    fbtrace_id,
    rawMessage: message,
  };
}

/**
 * Registers the WhatsApp phone number with Meta Cloud API using the 6-digit PIN.
 * 
 * Meta Endpoint:
 * POST https://graph.facebook.com/{META_WHATSAPP_API_VERSION}/{META_WHATSAPP_PHONE_NUMBER_ID}/register
 * 
 * @param {Object} options
 * @param {string} options.pin - 6-digit two-step verification PIN
 * @param {string} [options.dataLocalizationRegion] - Optional data localization region (e.g. 'IN')
 */
export async function registerWhatsAppPhoneNumber(options = {}) {
  const config = getWhatsAppConfig();

  if (!config.token) {
    return {
      success: false,
      error: 'META_WHATSAPP_ACCESS_TOKEN is not set in environment variables.',
      errorCategory: 'MISSING_CREDENTIALS',
    };
  }

  if (!config.phoneNumberId) {
    return {
      success: false,
      error: 'META_WHATSAPP_PHONE_NUMBER_ID is not set in environment variables.',
      errorCategory: 'MISSING_CREDENTIALS',
    };
  }

  const rawPin = String(options.pin || '').trim();
  if (!rawPin || !/^\d{6}$/.test(rawPin)) {
    return {
      success: false,
      error: 'A valid 6-digit numeric PIN is required for WhatsApp phone number registration.',
      errorCategory: 'INVALID_PIN_FORMAT',
    };
  }

  const url = `${GRAPH_BASE_URL}/${config.apiVersion}/${config.phoneNumberId}/register`;

  const payload = {
    messaging_product: 'whatsapp',
    pin: rawPin,
  };

  if (options.dataLocalizationRegion) {
    payload.data_localization_region = options.dataLocalizationRegion;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      return parseMetaApiError(data, response.status);
    }

    return {
      success: true,
      message: 'WhatsApp phone number successfully registered with Meta Cloud API.',
      data: data,
      registeredAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error connecting to Meta Cloud API: ${err.message}`,
      errorCategory: 'NETWORK_ERROR',
    };
  }
}

/**
 * Retrieves details and health of the WhatsApp Business Phone Number from Meta.
 * 
 * Meta Endpoint:
 * GET https://graph.facebook.com/{META_WHATSAPP_API_VERSION}/{META_WHATSAPP_PHONE_NUMBER_ID}
 */
export async function getWhatsAppPhoneNumberDetails() {
  const config = getWhatsAppConfig();

  if (!config.token || !config.phoneNumberId) {
    return {
      success: false,
      error: 'Missing META_WHATSAPP_ACCESS_TOKEN or META_WHATSAPP_PHONE_NUMBER_ID',
      errorCategory: 'MISSING_CREDENTIALS',
    };
  }

  const fields = 'id,display_phone_number,verified_name,quality_rating,code_verification_status,name_status,status';
  const url = `${GRAPH_BASE_URL}/${config.apiVersion}/${config.phoneNumberId}?fields=${fields}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      return parseMetaApiError(data, response.status);
    }

    return {
      success: true,
      phoneNumberId: data.id,
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      qualityRating: data.quality_rating,
      codeVerificationStatus: data.code_verification_status,
      nameStatus: data.name_status,
      status: data.status,
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error: ${err.message}`,
      errorCategory: 'NETWORK_ERROR',
    };
  }
}

/**
 * Retrieves all WhatsApp Message Templates from the WABA account.
 * 
 * Meta Endpoint:
 * GET https://graph.facebook.com/{META_WHATSAPP_API_VERSION}/{META_WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates
 */
export async function getWhatsAppTemplates() {
  const config = getWhatsAppConfig();

  if (!config.token) {
    return {
      success: false,
      error: 'Missing META_WHATSAPP_ACCESS_TOKEN in environment variables.',
      errorCategory: 'MISSING_CREDENTIALS',
    };
  }

  const wabaId = config.businessAccountId;
  if (!wabaId) {
    return {
      success: false,
      error: 'Missing META_WHATSAPP_BUSINESS_ACCOUNT_ID in environment variables.',
      errorCategory: 'MISSING_CREDENTIALS',
    };
  }

  const fields = 'name,status,language,category,components,id,last_updated_time';
  const url = `${GRAPH_BASE_URL}/${config.apiVersion}/${wabaId}/message_templates?fields=${fields}&limit=100`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      return parseMetaApiError(data, response.status);
    }

    const templates = Array.isArray(data?.data) ? data.data : [];
    return {
      success: true,
      count: templates.length,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        language: t.language,
        category: t.category,
        components: t.components || [],
      })),
      paging: data.paging || null,
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error retrieving message templates: ${err.message}`,
      errorCategory: 'NETWORK_ERROR',
    };
  }
}

/**
 * Sends a WhatsApp message (Template or Plain Text) via Meta Cloud API.
 * 
 * Meta Endpoint:
 * POST https://graph.facebook.com/{META_WHATSAPP_API_VERSION}/{META_WHATSAPP_PHONE_NUMBER_ID}/messages
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient phone number (E.164 without '+', e.g. '919876543210')
 * @param {string} [options.template] - Template name (e.g. 'hello_world')
 * @param {string} [options.languageCode='en_US'] - Template language code (e.g. 'en_US' or 'en')
 * @param {Array} [options.components] - Template parameters/components
 * @param {string} [options.text] - Plain text body (only valid within 24h user-initiated window)
 */
export async function sendMetaWhatsAppMessage(options = {}) {
  const isRnClient =
    typeof navigator !== 'undefined' &&
    typeof __DEV__ !== 'undefined';
  const allowClient =
    !isRnClient ||
    __DEV__ === true ||
    String(process.env.EXPO_PUBLIC_ALLOW_CLIENT_WHATSAPP || '').trim() === '1';
  if (!allowClient) {
    console.warn('[WHATSAPP_TRACE] WHATSAPP_SEND_ATTEMPT CLIENT_SEND_BLOCKED');
    return {
      success: false,
      error: 'Meta WhatsApp send is server-only in production. Queue the notification instead.',
      errorCategory: 'CLIENT_SEND_BLOCKED',
    };
  }

  const config = getWhatsAppConfig();

  if (!config.token || !config.phoneNumberId) {
    return {
      success: false,
      error: 'Missing META_WHATSAPP_ACCESS_TOKEN or META_WHATSAPP_PHONE_NUMBER_ID',
      errorCategory: 'MISSING_CREDENTIALS',
    };
  }

  const recipient = normalizeWhatsAppNumber(options.to);
  if (!recipient || recipient.length < 8) {
    return {
      success: false,
      error: 'Invalid recipient phone number. Provide valid digits with country code (e.g. 919876543210).',
      errorCategory: 'INVALID_RECIPIENT_PHONE',
    };
  }

  const url = `${GRAPH_BASE_URL}/${config.apiVersion}/${config.phoneNumberId}/messages`;

  let payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
  };

  if (options.template) {
    payload.type = 'template';
    payload.template = {
      name: options.template,
      language: {
        code: options.languageCode || 'en_US',
      },
    };
    if (options.components && Array.isArray(options.components) && options.components.length > 0) {
      payload.template.components = options.components;
    }
  } else if (options.text) {
    payload.type = 'text';
    payload.text = {
      preview_url: Boolean(options.previewUrl),
      body: String(options.text),
    };
  } else {
    // Default to hello_world test template if no payload specified
    payload.type = 'template';
    payload.template = {
      name: 'hello_world',
      language: {
        code: 'en_US',
      },
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      return parseMetaApiError(data, response.status);
    }

    const messageId = data?.messages?.[0]?.id || `wa-msg-${Date.now()}`;
    const contactWaId = data?.contacts?.[0]?.wa_id || recipient;

    return {
      success: true,
      messageId,
      recipient: contactWaId,
      status: 'accepted',
      rawResponse: data,
    };
  } catch (err) {
    return {
      success: false,
      error: `Network error connecting to Meta Cloud API: ${err.message}`,
      errorCategory: 'NETWORK_ERROR',
    };
  }
}

export default {
  getWhatsAppConfig,
  getWhatsAppConfigStatus,
  normalizeWhatsAppNumber,
  registerWhatsAppPhoneNumber,
  getWhatsAppPhoneNumberDetails,
  getWhatsAppTemplates,
  sendMetaWhatsAppMessage,
  parseMetaApiError,
};

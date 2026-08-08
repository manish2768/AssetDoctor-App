/**
 * Meta WhatsApp Cloud API — modular send helpers (template + text).
 * Base: https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages
 */

const { logger } = require('firebase-functions');
const { getWhatsAppConfig, assertWhatsAppConfigured } = require('../config/whatsappConfig');
const { toWhatsAppRecipient } = require('./phoneUtils');

/**
 * Normalize recipient to E.164 digits without '+' (e.g. 919918288299).
 * @param {string} phone
 */
function normalizeRecipient(phone) {
  const recipient = toWhatsAppRecipient(phone);
  if (!recipient) {
    throw new Error('WhatsApp recipient phone is required (E.164 digits, no +)');
  }
  return recipient;
}

/**
 * Extract Meta Graph error fields for logs / thrown Error.
 * @param {object|null} json
 * @param {string} fallbackText
 * @param {number} status
 */
function parseMetaError(json, fallbackText, status) {
  const apiError = json?.error || null;
  return {
    message:
      apiError?.message ||
      apiError?.error_user_msg ||
      fallbackText ||
      `WhatsApp API HTTP ${status}`,
    code: apiError?.code ?? null,
    errorSubcode: apiError?.error_subcode ?? null,
    type: apiError?.type ?? null,
    fbtraceId: apiError?.fbtrace_id ?? null,
    apiError,
  };
}

/**
 * Low-level POST to Graph messages endpoint.
 * @param {object} payload
 * @param {{ token?: string }} [options]
 */
async function sendWhatsAppMessage(payload, options = {}) {
  const config = getWhatsAppConfig({ token: options.token });
  assertWhatsAppConfigured(config);

  const logContext = {
    endpoint: config.apiUrl,
    phoneNumberId: config.phoneNumberId,
    graphVersion: config.graphVersion,
    to: payload?.to,
    type: payload?.type,
    template: payload?.template?.name || null,
  };

  logger.info('WhatsApp API request', logContext);

  let res;
  try {
    res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    logger.error('WhatsApp API network failure', {
      ...logContext,
      error: networkErr?.message || String(networkErr),
    });
    const error = new Error(`WhatsApp API network error: ${networkErr?.message || networkErr}`);
    error.status = 0;
    error.apiError = null;
    throw error;
  }

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const parsed = parseMetaError(json, text, res.status);
    logger.error('WhatsApp API error', {
      ...logContext,
      status: res.status,
      metaCode: parsed.code,
      metaSubcode: parsed.errorSubcode,
      metaType: parsed.type,
      fbtraceId: parsed.fbtraceId,
      error: parsed.apiError || text,
    });
    const error = new Error(parsed.message);
    error.status = res.status;
    error.code = parsed.code;
    error.errorSubcode = parsed.errorSubcode;
    error.fbtraceId = parsed.fbtraceId;
    error.apiError = parsed.apiError;
    throw error;
  }

  const messageId = json?.messages?.[0]?.id || null;
  const contactWaId = json?.contacts?.[0]?.wa_id || null;

  logger.info('WhatsApp message sent', {
    ...logContext,
    status: res.status,
    messageId,
    contactWaId,
  });

  return {
    success: true,
    messageId,
    contactWaId,
    status: res.status,
    response: json,
  };
}

/**
 * Send an approved WhatsApp template message.
 * @param {{
 *   to: string,
 *   templateName: string,
 *   languageCode?: string,
 *   components?: object[],
 *   token?: string,
 * }} params
 */
async function sendTemplateMessage({
  to,
  templateName,
  languageCode,
  components = [],
  token,
}) {
  const config = getWhatsAppConfig({ token });
  const recipient = normalizeRecipient(to);
  if (!templateName) throw new Error('templateName is required');

  return sendWhatsAppMessage(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode || config.templateLang || 'en' },
        components,
      },
    },
    { token },
  );
}

/**
 * Send a free-form text message (24h customer-care window only).
 * @param {{
 *   to: string,
 *   body: string,
 *   previewUrl?: boolean,
 *   token?: string,
 * }} params
 */
async function sendTextMessage({ to, body, previewUrl = false, token }) {
  const recipient = normalizeRecipient(to);
  const text = String(body || '').trim();
  if (!text) throw new Error('WhatsApp text body is required');

  return sendWhatsAppMessage(
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: Boolean(previewUrl),
        body: text,
      },
    },
    { token },
  );
}

module.exports = {
  sendWhatsAppMessage,
  sendTemplateMessage,
  sendTextMessage,
  normalizeRecipient,
};

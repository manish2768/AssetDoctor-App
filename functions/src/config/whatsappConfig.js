/**
 * WhatsApp Cloud API configuration (Meta Graph).
 * Prefer Firebase secrets in production; fall back to process.env for local `.env`.
 *
 * Approved Meta credentials (non-secret):
 * - Phone Number ID: 1269029059621551
 * - WhatsApp Business Account ID: 956803424039436
 * - App ID: 1050912807397326
 * - Graph API: v20.0
 */

const DEFAULT_PHONE_NUMBER_ID = '1269029059621551';
const DEFAULT_BUSINESS_ACCOUNT_ID = '956803424039436';
const DEFAULT_APP_ID = '1050912807397326';
const DEFAULT_GRAPH_VERSION = 'v20.0';

function readEnv(name, fallback = '') {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return String(value).trim();
}

function normalizeGraphVersion(version) {
  const raw = String(version || DEFAULT_GRAPH_VERSION).trim();
  if (!raw) return DEFAULT_GRAPH_VERSION;
  return raw.startsWith('v') ? raw : `v${raw}`;
}

/**
 * @param {{ token?: string }} [overrides] — inject secret from defineSecret().value()
 */
function getWhatsAppConfig(overrides = {}) {
  const phoneNumberId = readEnv(
    'WHATSAPP_PHONE_NUMBER_ID',
    readEnv('META_PHONE_NUMBER_ID', DEFAULT_PHONE_NUMBER_ID),
  );
  const graphVersion = normalizeGraphVersion(
    readEnv('WHATSAPP_GRAPH_VERSION', DEFAULT_GRAPH_VERSION),
  );
  const apiUrl =
    readEnv('WHATSAPP_API_URL') ||
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  return {
    token: overrides.token || readEnv('WHATSAPP_TOKEN', readEnv('META_ACCESS_TOKEN')),
    phoneNumberId,
    businessAccountId: readEnv(
      'WHATSAPP_BUSINESS_ACCOUNT_ID',
      readEnv('META_BUSINESS_ACCOUNT_ID', DEFAULT_BUSINESS_ACCOUNT_ID),
    ),
    appId: readEnv('WHATSAPP_APP_ID', readEnv('META_APP_ID', DEFAULT_APP_ID)),
    apiUrl,
    graphVersion,
    templateLang: readEnv('WHATSAPP_TEMPLATE_LANG', 'en'),
    websiteUrl: readEnv(
      'WHATSAPP_WEBSITE_URL',
      'https://assetdoctor-5fd25.web.app',
    ),
    welcomeTemplateName: readEnv('WHATSAPP_WELCOME_TEMPLATE', 'welcome_gadi_doctor'),
    otpTemplateName: readEnv('WHATSAPP_OTP_TEMPLATE', 'asset_doctor_otp'),
    reminderTemplateName: readEnv('WHATSAPP_REMINDER_TEMPLATE', 'asset_service_reminder'),
    otpTtlMinutes: Number(readEnv('WHATSAPP_OTP_TTL_MINUTES', '10')) || 10,
    otpMaxAttempts: Number(readEnv('WHATSAPP_OTP_MAX_ATTEMPTS', '5')) || 5,
  };
}

function assertWhatsAppConfigured(config) {
  if (!config?.token || config.token.includes('REPLACE_WITH') || config.token.includes('INSERT_')) {
    throw new Error('WHATSAPP_TOKEN is not configured');
  }
  if (!config.phoneNumberId) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured');
  }
  if (!config.apiUrl) {
    throw new Error('WHATSAPP_API_URL is not configured');
  }
}

module.exports = {
  DEFAULT_PHONE_NUMBER_ID,
  DEFAULT_BUSINESS_ACCOUNT_ID,
  DEFAULT_APP_ID,
  DEFAULT_GRAPH_VERSION,
  getWhatsAppConfig,
  assertWhatsAppConfigured,
};

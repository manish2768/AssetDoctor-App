/**
 * Approved WhatsApp template builders for Asset Doctor.
 */

const { sendTemplateMessage } = require('./WhatsAppService');
const { getWhatsAppConfig } = require('../config/whatsappConfig');

/**
 * Authentication template `asset_doctor_otp`
 * Body {{1}} = OTP · Copy Code button also receives OTP.
 */
async function sendOtpTemplate({ to, otp, token, languageCode }) {
  const code = String(otp || '').trim();
  if (!/^\d{4,8}$/.test(code)) {
    throw new Error('OTP must be 4–8 digits');
  }

  const config = getWhatsAppConfig({ token });
  const templateName = config.otpTemplateName || 'asset_doctor_otp';
  const buttonType = String(process.env.WHATSAPP_OTP_BUTTON || 'url').toLowerCase();
  const buttonComponent =
    buttonType === 'copy_code'
      ? {
          type: 'button',
          sub_type: 'copy_code',
          index: '0',
          parameters: [{ type: 'coupon_code', coupon_code: code }],
        }
      : {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: code }],
        };

  return sendTemplateMessage({
    to,
    templateName,
    languageCode,
    token,
    components: [
      {
        type: 'body',
        parameters: [{ type: 'text', text: code }],
      },
      buttonComponent,
    ],
  });
}

/**
 * Welcome template — default `welcome_gadi_doctor`, override via WHATSAPP_WELCOME_TEMPLATE
 * Body {{1}} = user name · {{2}} = website URL
 */
async function sendWelcomeTemplate({ to, name, websiteUrl, token, languageCode }) {
  const config = getWhatsAppConfig({ token });
  const templateName = config.welcomeTemplateName || 'welcome_gadi_doctor';
  const displayName =
    String(name || '').trim().slice(0, 60) ||
    String(to || '').trim().slice(0, 60) ||
    'Friend';
  const site =
    String(websiteUrl || config.websiteUrl || 'https://assetdoctor-5fd25.web.app')
      .trim()
      .slice(0, 200) || 'https://assetdoctor-5fd25.web.app';

  return sendTemplateMessage({
    to,
    templateName,
    languageCode,
    token,
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: displayName },
          { type: 'text', text: site },
        ],
      },
    ],
  });
}

/**
 * Utility template `asset_service_reminder`
 * {{1}} name · {{2}} asset · {{3}} event type · {{4}} due date
 */
async function sendServiceReminderTemplate({
  to,
  userName,
  assetName,
  eventType,
  dueDate,
  token,
  languageCode,
}) {
  const config = getWhatsAppConfig({ token });
  const templateName = config.reminderTemplateName || 'asset_service_reminder';
  const params = [
    String(userName || to || 'Friend').slice(0, 60),
    String(assetName || 'Asset').slice(0, 60),
    String(eventType || 'Reminder').slice(0, 60),
    String(dueDate || '—').slice(0, 40),
  ];

  return sendTemplateMessage({
    to,
    templateName,
    languageCode,
    token,
    components: [
      {
        type: 'body',
        parameters: params.map((text) => ({ type: 'text', text })),
      },
    ],
  });
}

module.exports = {
  sendOtpTemplate,
  sendWelcomeTemplate,
  sendServiceReminderTemplate,
};

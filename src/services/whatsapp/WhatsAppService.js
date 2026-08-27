/**
 * WhatsApp Business Platform Service — Asset Doctor
 * Clean integration layer for Meta WhatsApp Cloud API / Webhook dispatch.
 * Handles service reminders, warranty expiries, OTPs, and ticket notifications.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getWhatsAppConfigStatus,
  registerWhatsAppPhoneNumber,
  getWhatsAppPhoneNumberDetails,
  getWhatsAppTemplates,
  sendMetaWhatsAppMessage,
  normalizeWhatsAppNumber,
} from './MetaWhatsAppService.js';
import {
  APPROVED_META_TEMPLATES,
  NOTIF_TYPE,
  NOTIF_STATUS,
  sendWelcomeNotification,
  sendOtpNotification,
  verifyWhatsAppOtp,
  sendExpiryReminder,
  sendServiceReminder,
  sendWhatsAppTemplate,
  getWhatsAppUserPreferences,
  setWhatsAppUserPreferences,
  getNotificationAuditLogs,
  handleWebhookStatusUpdate,
} from './WhatsAppNotificationService.js';

const WA_LOGS_STORAGE_KEY = 'asset_doctor_whatsapp_logs_v1';
const WA_CONSENT_STORAGE_KEY = 'asset_doctor_whatsapp_consents_v1';

export const WA_TEMPLATE = Object.freeze({
  OTP_VERIFICATION: 'asset_doctor_otp',
  WELCOME: 'welcome_message',
  EXPIRY_REMINDER: 'expiry_reminder',
  SERVICE_REMINDER: 'ad_service_reminder',
  WARRANTY_EXPIRY: 'ad_warranty_expiry',
  INSURANCE_EXPIRY: 'ad_insurance_expiry',
  PUC_EXPIRY: 'ad_puc_expiry',
  TICKET_UPDATE: 'ad_ticket_update',
  CRITICAL_ASSET_ALERT: 'ad_critical_asset_alert',
});

export const WA_MESSAGE_STATUS = Object.freeze({
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
});

export const WhatsAppService = {
  // Re-export Constants
  APPROVED_TEMPLATES: APPROVED_META_TEMPLATES,
  NOTIF_TYPE,
  NOTIF_STATUS,

  /**
   * Safe status check of WhatsApp Cloud API configuration
   */
  getStatus() {
    return getWhatsAppConfigStatus();
  },

  /**
   * Register phone number on Meta Cloud API with 6-digit PIN
   */
  async registerPhoneNumber(options = {}) {
    return registerWhatsAppPhoneNumber(options);
  },

  /**
   * Fetch verified business display name & quality rating from Meta
   */
  async getPhoneNumberDetails() {
    return getWhatsAppPhoneNumberDetails();
  },

  /**
   * Query approved templates from WABA account
   */
  async getTemplates() {
    return getWhatsAppTemplates();
  },

  /**
   * Flow A: Send User Welcome Message
   */
  async sendWelcome({ userId, phone, userName }) {
    return sendWelcomeNotification({ userId, phone, userName });
  },

  /**
   * Flow B: Send WhatsApp OTP
   */
  async sendOtp({ userId, phone, otp }) {
    return sendOtpNotification({ userId, phone, otp });
  },

  /**
   * Flow B: Verify WhatsApp OTP
   */
  async verifyOtp(phone, inputOtp) {
    return verifyWhatsAppOtp(phone, inputOtp);
  },

  /**
   * Flow C: Send Document Expiry Reminder (Insurance, PUC, Warranty)
   */
  async sendExpiryReminder({
    userId,
    phone,
    customerName,
    vehicleName,
    docType,
    expiryDate,
    assetId,
  }) {
    return sendExpiryReminder({
      userId,
      phone,
      customerName,
      vehicleName,
      docType,
      expiryDate,
      assetId,
    });
  },

  /**
   * Flow D: Send Service Reminder
   */
  async sendServiceReminder({
    userId,
    phone,
    userName,
    vehicleName,
    odometer,
    daysLeft,
  }) {
    return sendServiceReminder({
      userId,
      phone,
      userName,
      vehicleName,
      odometer,
      daysLeft,
    });
  },

  /**
   * Send arbitrary approved WhatsApp template
   */
  async sendTemplate(options) {
    return sendWhatsAppTemplate(options);
  },

  /**
   * Check if user has opted in for WhatsApp updates
   */
  async getUserConsent(userId) {
    if (!userId) return false;
    const prefs = await getWhatsAppUserPreferences(userId);
    return prefs.whatsappEnabled;
  },

  /**
   * Update WhatsApp opt-in / opt-out consent
   */
  async setUserConsent(userId, optedIn = true) {
    if (!userId) return;
    return setWhatsAppUserPreferences(userId, { whatsappEnabled: optedIn });
  },

  /**
   * Render template parameters for fallback dispatch
   */
  renderTemplate(templateName, variables = {}) {
    switch (templateName) {
      case WA_TEMPLATE.OTP_VERIFICATION:
      case 'asset_doctor_otp':
        return `Your Asset Doctor verification code is ${variables.otp || variables['1']}. Valid for 10 minutes.`;
      case WA_TEMPLATE.WELCOME:
      case 'welcome_message':
        return `Hello ${variables.userName || variables['1'] || 'User'}, welcome to Asset Doctor!`;
      case WA_TEMPLATE.EXPIRY_REMINDER:
      case 'expiry_reminder':
        return `Hello ${variables.customerName || variables['1']}, reminder for ${variables.vehicleName || variables['2']}: ${variables.docType || variables['3']} expires on ${variables.expiryDate || variables['4']}.`;
      default:
        return `Asset Doctor Notification: ${variables.message || 'You have an asset update.'}`;
    }
  },

  /**
   * Legacy notification dispatcher for backward compatibility
   */
  async sendNotification({
    userId,
    phone,
    template,
    variables = {},
  }) {
    if (!phone) {
      throw new Error('Recipient phone number required for WhatsApp notification');
    }

    if (template === WA_TEMPLATE.WELCOME || template === 'welcome_message') {
      return this.sendWelcome({ userId, phone, userName: variables.userName || variables['1'] });
    }

    if (template === WA_TEMPLATE.OTP_VERIFICATION || template === 'asset_doctor_otp') {
      return this.sendOtp({ userId, phone, otp: variables.otp || variables['1'] });
    }

    if (template === WA_TEMPLATE.EXPIRY_REMINDER || template === 'expiry_reminder') {
      return this.sendExpiryReminder({
        userId,
        phone,
        customerName: variables.customerName || variables['1'],
        vehicleName: variables.vehicleName || variables['2'],
        docType: variables.docType || variables['3'],
        expiryDate: variables.expiryDate || variables['4'],
        assetId: variables.assetId,
      });
    }

    // Default template send
    return sendWhatsAppTemplate({
      userId,
      phone,
      templateName: template,
      languageCode: variables.languageCode || 'en',
      parameters: variables.parameters || Object.values(variables),
    });
  },

  /**
   * Process incoming WhatsApp webhook status update
   */
  async processWebhookStatusUpdate(payload) {
    if (!payload) return false;
    return handleWebhookStatusUpdate(payload);
  },

  /**
   * Get all message delivery logs
   */
  async getMessageLogs(filterUserId = null) {
    return getNotificationAuditLogs(filterUserId);
  },
};

export default WhatsAppService;

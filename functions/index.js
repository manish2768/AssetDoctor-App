/**
 * Asset Doctor — Cloud Functions entry
 */

try {
  // Local emulator / scripts — production uses Firebase secrets
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  require('dotenv').config();
} catch {
  /* dotenv optional */
}

const { initializeApp } = require('firebase-admin/app');

initializeApp();

const { dailyExpiryAlerts } = require('./src/dailyExpiryAlerts');
const { onMailQueueCreate } = require('./src/onMailQueueCreate');
const { scanInvoiceVision } = require('./src/scanInvoiceVision');
const { sendWhatsAppOtp, verifyWhatsAppOtp } = require('./src/whatsapp/otpHandlers');
const {
  onUserCreatedWelcomeWhatsApp,
  sendWelcomeWhatsApp,
} = require('./src/whatsapp/welcomeHandlers');
const {
  dailyWhatsAppReminders,
  runWhatsAppRemindersNow,
} = require('./src/whatsapp/dailyServiceReminders');
const { grantAdminAccess } = require('./src/grantAdmin');

exports.dailyExpiryAlerts = dailyExpiryAlerts;
exports.onMailQueueCreate = onMailQueueCreate;
exports.scanInvoiceVision = scanInvoiceVision;

exports.sendWhatsAppOtp = sendWhatsAppOtp;
exports.verifyWhatsAppOtp = verifyWhatsAppOtp;
exports.onUserCreatedWelcomeWhatsApp = onUserCreatedWelcomeWhatsApp;
exports.sendWelcomeWhatsApp = sendWelcomeWhatsApp;
exports.dailyWhatsAppReminders = dailyWhatsAppReminders;
exports.runWhatsAppRemindersNow = runWhatsAppRemindersNow;
exports.grantAdminAccess = grantAdminAccess;

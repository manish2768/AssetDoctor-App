/**
 * Asset Doctor — Cloud Functions entry
 */

try {
  // Local emulator / scripts — production uses Firebase Secret Manager
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const path = require('path');
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '.env') });
  dotenv.config({ path: path.join(__dirname, '.secret.local'), override: true });
} catch {
  /* dotenv optional */
}

const { initializeApp } = require('firebase-admin/app');

initializeApp();

const { dailyExpiryAlerts } = require('./src/dailyExpiryAlerts');
const { onMailQueueCreate } = require('./src/onMailQueueCreate');
const { scanInvoiceVision } = require('./src/scanInvoiceVision');
const { grantAdminAccess } = require('./src/grantAdmin');
const { checkIdentityAvailable, checkIdentityAvailableHttp } = require('./src/identityGuard');

exports.dailyExpiryAlerts = dailyExpiryAlerts;
exports.onMailQueueCreate = onMailQueueCreate;
exports.scanInvoiceVision = scanInvoiceVision;
exports.grantAdminAccess = grantAdminAccess;
exports.checkIdentityAvailable = checkIdentityAvailable;
exports.checkIdentityAvailableHttp = checkIdentityAvailableHttp;

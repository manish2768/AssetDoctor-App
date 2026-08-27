#!/usr/bin/env node
/**
 * Asset Doctor (Gadi Doctor) — Meta WhatsApp Cloud API Admin CLI
 * 
 * Secure administration tool to:
 * 1. Check Meta WhatsApp Cloud API connection status (Zero token exposure)
 * 2. Register WhatsApp Business Phone Number with 6-digit PIN
 * 3. Send test WhatsApp message / template
 * 4. Inspect WhatsApp Phone Number details & quality rating
 * 
 * Usage:
 *   node scripts/meta-whatsapp-admin.js status
 *   node scripts/meta-whatsapp-admin.js register <6-digit-pin>
 *   node scripts/meta-whatsapp-admin.js test-message <recipient-phone> [template-name]
 *   node scripts/meta-whatsapp-admin.js details
 * 
 * SECURITY:
 * Never logs or prints the META_WHATSAPP_ACCESS_TOKEN.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Automatically load .env and .env.local if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envLocalPath = path.join(rootDir, '.env.local');
const envPath = path.join(rootDir, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

import {
  getWhatsAppConfig,
  getWhatsAppConfigStatus,
  registerWhatsAppPhoneNumber,
  getWhatsAppPhoneNumberDetails,
  getWhatsAppTemplates,
  sendMetaWhatsAppMessage,
  normalizeWhatsAppNumber,
} from '../src/services/whatsapp/MetaWhatsAppService.js';

const args = process.argv.slice(2);
const command = args[0] || 'status';

console.log('================================================================');
console.log('   ASSET DOCTOR (GADI DOCTOR) — META WHATSAPP CLOUD API ADMIN   ');
console.log('================================================================\n');

async function handleStatus() {
  const status = getWhatsAppConfigStatus();

  console.log('--- CONFIGURATION STATUS ---');
  console.log(`WhatsApp API Configured : ${status.isConfigured ? '✓ YES' : '✗ NO'}`);
  console.log(`Access Token Present    : ${status.hasToken ? '✓ YES (SECURE / HIDDEN)' : '✗ MISSING'}`);
  console.log(`Phone Number ID         : ${status.phoneNumberIdMasked}`);
  console.log(`API Version             : ${status.apiVersion}`);
  console.log(`Business Account ID (WABA): ${status.hasBusinessAccountId ? '✓ CONFIGURED' : '— OPTIONAL'}`);
  console.log('----------------------------\n');

  if (!status.isConfigured) {
    console.log('⚠️  ACTION REQUIRED:');
    console.log('Please set the following environment variables in your server / .env file:');
    console.log('  META_WHATSAPP_ACCESS_TOKEN=<Your_System_User_Permanent_Token>');
    console.log('  META_WHATSAPP_PHONE_NUMBER_ID=<Your_Phone_Number_ID>');
    console.log('  META_WHATSAPP_API_VERSION=v21.0\n');
    return;
  }

  console.log('Testing Meta Cloud API connectivity...');
  const details = await getWhatsAppPhoneNumberDetails();

  if (details.success) {
    console.log('\n✓ META CLOUD API CONNECTION SUCCESSFUL!');
    console.log(`  Display Phone Number   : ${details.displayPhoneNumber || '—'}`);
    console.log(`  Verified Business Name : ${details.verifiedName || 'Gadi Doctor'}`);
    console.log(`  Quality Rating         : ${details.qualityRating || 'UNKNOWN'}`);
    console.log(`  Code Verification      : ${details.codeVerificationStatus || '—'}`);
    console.log(`  Account Status         : ${details.status || 'ACTIVE'}`);
  } else {
    console.log('\n✗ META API ERROR:');
    console.log(`  Category: ${details.errorCategory}`);
    console.log(`  Message : ${details.error}`);
    if (details.metaCode) console.log(`  Code    : ${details.metaCode} (Subcode: ${details.metaSubcode || 'N/A'})`);
  }
  console.log('\n================================================================\n');
}

async function handleTemplates() {
  console.log('Querying WhatsApp Message Templates for WABA Account...');
  const res = await getWhatsAppTemplates();

  if (!res.success) {
    console.error('\n✗ FAILED TO RETRIEVE TEMPLATES:');
    console.error(`  Category: ${res.errorCategory}`);
    console.error(`  Error   : ${res.error}`);
    if (res.metaCode) console.error(`  Meta Code: ${res.metaCode}`);
    console.log('\n================================================================\n');
    return;
  }

  console.log(`\nFound ${res.count} template(s) in WhatsApp Business Account:\n`);

  if (res.count === 0) {
    console.log('  (No message templates found in this WABA account)');
    console.log('\n💡 HOW TO CREATE A TEMPLATE IN META WHATSAPP MANAGER:');
    console.log('  1. Open Meta Business Manager -> WhatsApp Manager');
    console.log('  2. Select Account "Gadi Doctor" -> Message Templates');
    console.log('  3. Click "Create Template"');
    console.log('  4. Category: UTILITY, Name: "ad_welcome" or "hello_world", Language: English (US) [en_US]');
    console.log('  5. Add body text and submit for instant approval.');
  } else {
    res.templates.forEach((t, i) => {
      const isApproved = t.status === 'APPROVED';
      const badge = isApproved ? '✓ APPROVED' : `⏳ ${t.status}`;
      console.log(`[${i + 1}] Template: "${t.name}"`);
      console.log(`    Status   : ${badge}`);
      console.log(`    Language : ${t.language}`);
      console.log(`    Category : ${t.category}`);
      console.log(`    ID       : ${t.id}`);
      if (t.components && t.components.length > 0) {
        const bodyComp = t.components.find((c) => c.type === 'BODY');
        if (bodyComp?.text) {
          console.log(`    Body     : "${bodyComp.text.replace(/\n/g, ' ')}"`);
        }
      }
      console.log('');
    });
  }
  console.log('================================================================\n');
}

async function handleRegister() {
  let pin = args[1];

  if (!pin && args[0]?.startsWith('--pin=')) {
    pin = args[0].split('=')[1];
  } else if (args[1]?.startsWith('--pin=')) {
    pin = args[1].split('=')[1];
  }

  if (!pin) {
    console.error('✗ ERROR: 6-digit PIN required.');
    console.log('\nUsage:');
    console.log('  node scripts/meta-whatsapp-admin.js register <6-digit-pin>');
    console.log('Example:');
    console.log('  node scripts/meta-whatsapp-admin.js register 123456\n');
    process.exit(1);
  }

  const cleanPin = String(pin).trim();
  if (!/^\d{6}$/.test(cleanPin)) {
    console.error(`✗ ERROR: PIN must be exactly 6 numeric digits (got "${cleanPin}").`);
    process.exit(1);
  }

  console.log(`Registering WhatsApp Business Phone Number on Meta Cloud API with 6-digit PIN...`);
  const result = await registerWhatsAppPhoneNumber({ pin: cleanPin });

  if (result.success) {
    console.log('\n🎉 SUCCESS: WhatsApp phone number is successfully registered on Meta Cloud API!');
    console.log(`  Timestamp: ${result.registeredAt}`);
    console.log('  Your WhatsApp Business number ("Gadi Doctor") is now active and ready to send messages.');
  } else {
    console.error('\n✗ REGISTRATION FAILED:');
    console.error(`  Category: ${result.errorCategory}`);
    console.error(`  Error   : ${result.error}`);
    if (result.metaCode) console.error(`  Meta Code: ${result.metaCode} (Subcode: ${result.metaSubcode || 'N/A'})`);

    if (result.errorCategory === 'NUMBER_ALREADY_REGISTERED') {
      console.log('\n💡 Note: Your number is already registered and ready to use.');
    } else if (result.errorCategory === 'INVALID_TWO_STEP_PIN') {
      console.log('\n💡 Troubleshooting: Verify the 6-digit two-step verification PIN in WhatsApp Manager.');
    } else if (result.errorCategory === 'AUTHENTICATION_EXPIRED_OR_INVALID') {
      console.log('\n💡 Troubleshooting: Check that META_WHATSAPP_ACCESS_TOKEN is valid and has not expired.');
    }
  }
  console.log('\n================================================================\n');
}

async function handleTestMessage() {
  const recipient = args[1];
  const templateName = args[2] || 'hello_world';
  const languageCode = args[3] || 'en_US';
  const rawParams = args[4]; // optional comma-separated body params

  if (!recipient) {
    console.error('✗ ERROR: Recipient phone number required.');
    console.log('\nUsage:');
    console.log('  node scripts/meta-whatsapp-admin.js test-message <recipient_phone> [template_name] [language_code] [params]');
    console.log('Examples:');
    console.log('  node scripts/meta-whatsapp-admin.js test-message 919956289111 hello_world en_US');
    console.log('  node scripts/meta-whatsapp-admin.js test-message 919956289111 ad_welcome en "John,AssetDoctor"\n');
    process.exit(1);
  }

  const normalized = normalizeWhatsAppNumber(recipient);
  console.log(`Sending WhatsApp test template:`);
  console.log(`  Recipient : ${normalized}`);
  console.log(`  Template  : "${templateName}"`);
  console.log(`  Language  : "${languageCode}"`);

  let components = undefined;
  if (rawParams) {
    const paramsList = rawParams.split(',').map((p) => ({ type: 'text', text: p.trim() }));
    components = [
      {
        type: 'body',
        parameters: paramsList,
      },
    ];
    console.log(`  Params    : ${JSON.stringify(paramsList)}`);
  }

  const result = await sendMetaWhatsAppMessage({
    to: normalized,
    template: templateName,
    languageCode,
    components,
  });

  if (result.success) {
    console.log('\n🎉 MESSAGE ACCEPTED BY META!');
    console.log(`  Message ID : ${result.messageId}`);
    console.log(`  Recipient  : ${result.recipient}`);
    console.log(`  Status     : ${result.status}`);
  } else {
    console.error('\n✗ MESSAGE DISPATCH FAILED:');
    console.error(`  Category: ${result.errorCategory}`);
    console.error(`  Error   : ${result.error}`);
    if (result.metaCode) console.error(`  Meta Code: ${result.metaCode}`);
    if (result.metaCode === 132001) {
      console.log('\n💡 Tip: Run "npm run wa:templates" to see available approved templates and language codes for your WABA account.');
    }
  }
  console.log('\n================================================================\n');
}

async function handleDetails() {
  console.log('Fetching WhatsApp Phone Number details from Meta Cloud API...');
  const details = await getWhatsAppPhoneNumberDetails();

  if (details.success) {
    console.log('\n--- WHATSAPP PHONE NUMBER DETAILS ---');
    console.log(`Phone Number ID        : ${details.phoneNumberId}`);
    console.log(`Display Phone Number   : ${details.displayPhoneNumber || '—'}`);
    console.log(`Verified Business Name : ${details.verifiedName || 'Gadi Doctor'}`);
    console.log(`Quality Rating         : ${details.qualityRating || 'UNKNOWN'}`);
    console.log(`Name Status            : ${details.nameStatus || 'APPROVED'}`);
    console.log(`Code Verification      : ${details.codeVerificationStatus || 'VERIFIED'}`);
    console.log(`Status                 : ${details.status || 'CONNECTED'}`);
    console.log('------------------------------------');
  } else {
    console.error('\n✗ FAILED TO FETCH DETAILS:');
    console.error(`  Category: ${details.errorCategory}`);
    console.error(`  Error   : ${details.error}`);
  }
  console.log('\n================================================================\n');
}

async function handleWelcome() {
  const phone = args[1];
  const userName = args[2] || 'Valued Member';

  if (!phone) {
    console.error('✗ ERROR: Recipient phone number required.');
    console.log('Usage: node scripts/meta-whatsapp-admin.js welcome <phone> [userName]');
    process.exit(1);
  }

  const { sendWelcomeNotification } = await import('../src/services/whatsapp/WhatsAppNotificationService.js');
  console.log(`Sending Welcome Notification ("welcome_message") to ${phone} for user "${userName}"...`);
  const res = await sendWelcomeNotification({ phone, userName });

  if (res.success) {
    console.log('\n🎉 WELCOME MESSAGE SENT SUCCESSFULLY!');
    console.log(`  Message ID : ${res.wamid}`);
    console.log(`  Recipient  : ${res.recipient}`);
  } else {
    console.error('\n✗ FAILED TO SEND WELCOME MESSAGE:');
    console.error(`  Status : ${res.status}`);
    console.error(`  Error  : ${res.error || res.message}`);
  }
  console.log('\n================================================================\n');
}

async function handleOtp() {
  const phone = args[1];
  const customOtp = args[2];

  if (!phone) {
    console.error('✗ ERROR: Recipient phone number required.');
    console.log('Usage: node scripts/meta-whatsapp-admin.js otp <phone> [6_digit_otp]');
    process.exit(1);
  }

  const { sendOtpNotification } = await import('../src/services/whatsapp/WhatsAppNotificationService.js');
  console.log(`Sending OTP Notification ("asset_doctor_otp") to ${phone}...`);
  const res = await sendOtpNotification({ phone, otp: customOtp });

  if (res.success) {
    console.log('\n🎉 OTP MESSAGE SENT SUCCESSFULLY!');
    console.log(`  Message ID : ${res.wamid}`);
    console.log(`  Recipient  : ${res.recipient}`);
    console.log(`  Expires In : ${res.expiresInSeconds}s`);
  } else {
    console.error('\n✗ FAILED TO SEND OTP:');
    console.error(`  Status : ${res.status}`);
    console.error(`  Error  : ${res.error || res.message}`);
  }
  console.log('\n================================================================\n');
}

async function handleVerifyOtp() {
  const phone = args[1];
  const inputOtp = args[2];

  if (!phone || !inputOtp) {
    console.error('✗ ERROR: Phone number and OTP code required.');
    console.log('Usage: node scripts/meta-whatsapp-admin.js verify-otp <phone> <otp_code>');
    process.exit(1);
  }

  const { verifyWhatsAppOtp } = await import('../src/services/whatsapp/WhatsAppNotificationService.js');
  console.log(`Verifying OTP code for ${phone}...`);
  const res = await verifyWhatsAppOtp(phone, inputOtp);

  if (res.success) {
    console.log('\n✓ OTP CODE VERIFIED SUCCESSFULLY!');
  } else {
    console.error('\n✗ OTP VERIFICATION FAILED:');
    console.error(`  Error: ${res.error}`);
  }
  console.log('\n================================================================\n');
}

async function handleExpiry() {
  const phone = args[1];
  const customerName = args[2] || 'Customer';
  const vehicleName = args[3] || 'Vehicle';
  const docType = args[4] || 'Insurance';
  const expiryDate = args[5] || '31-Aug-2026';

  if (!phone) {
    console.error('✗ ERROR: Recipient phone number required.');
    console.log('Usage: node scripts/meta-whatsapp-admin.js expiry <phone> [customerName] [vehicleName] [docType] [expiryDate]');
    console.log('Example: node scripts/meta-whatsapp-admin.js expiry 919956289111 "Manish" "TVS Ronin" "Insurance" "31-Aug-2026"');
    process.exit(1);
  }

  const { sendExpiryReminder } = await import('../src/services/whatsapp/WhatsAppNotificationService.js');
  console.log(`Sending Document Expiry Reminder ("expiry_reminder") to ${phone}...`);
  console.log(`  Customer : ${customerName}`);
  console.log(`  Vehicle  : ${vehicleName}`);
  console.log(`  Document : ${docType}`);
  console.log(`  Expiry   : ${expiryDate}`);

  const res = await sendExpiryReminder({
    phone,
    customerName,
    vehicleName,
    docType,
    expiryDate,
  });

  if (res.success) {
    console.log('\n🎉 EXPIRY REMINDER SENT SUCCESSFULLY!');
    console.log(`  Message ID : ${res.wamid}`);
    console.log(`  Recipient  : ${res.recipient}`);
  } else {
    console.error('\n✗ FAILED TO SEND EXPIRY REMINDER:');
    console.error(`  Status : ${res.status}`);
    console.error(`  Error  : ${res.error || res.message}`);
  }
  console.log('\n================================================================\n');
}

async function handleService() {
  const phone = args[1];
  const userName = args[2] || 'User';
  const vehicleName = args[3] || 'Vehicle';
  const odometer = args[4] || '12000';
  const daysLeft = args[5] || '7';

  const { sendServiceReminder } = await import('../src/services/whatsapp/WhatsAppNotificationService.js');
  console.log(`Testing Service Reminder Flow for ${phone}...`);
  const res = await sendServiceReminder({
    phone,
    userName,
    vehicleName,
    odometer,
    daysLeft,
  });

  console.log(`  Status  : ${res.status}`);
  console.log(`  Message : ${res.message}`);
  console.log('\n================================================================\n');
}

async function handleLogs() {
  const filterUser = args[1];
  const { getNotificationAuditLogs } = await import('../src/services/whatsapp/WhatsAppNotificationService.js');
  const logs = await getNotificationAuditLogs(filterUser);

  console.log(`--- WHATSAPP NOTIFICATION AUDIT LOGS (${logs.length}) ---`);
  if (logs.length === 0) {
    console.log('  (No notification logs recorded yet)');
  } else {
    logs.slice(0, 20).forEach((l, i) => {
      console.log(`[${i + 1}] ID: ${l.notificationId}`);
      console.log(`    Type     : ${l.type}`);
      console.log(`    Template : ${l.templateName} (${l.templateLanguage || '—'})`);
      console.log(`    Phone    : ${l.maskedPhone}`);
      console.log(`    Status   : ${l.status}`);
      console.log(`    WAMID    : ${l.wamid || '—'}`);
      console.log(`    Created  : ${l.createdAt}`);
      console.log('');
    });
  }
  console.log('================================================================\n');
}

async function main() {
  switch (command.toLowerCase()) {
    case 'status':
    case 'health':
    case 'check':
      await handleStatus();
      break;
    case 'templates':
    case 'template':
    case 'list-templates':
      await handleTemplates();
      break;
    case 'register':
      await handleRegister();
      break;
    case 'test-message':
    case 'send-test':
    case 'test':
      await handleTestMessage();
      break;
    case 'welcome':
      await handleWelcome();
      break;
    case 'otp':
      await handleOtp();
      break;
    case 'verify-otp':
      await handleVerifyOtp();
      break;
    case 'expiry':
    case 'expiry-reminder':
      await handleExpiry();
      break;
    case 'service':
    case 'service-reminder':
      await handleService();
      break;
    case 'logs':
    case 'audit':
      await handleLogs();
      break;
    case 'details':
    case 'info':
      await handleDetails();
      break;
    default:
      console.log(`Unknown command: "${command}"`);
      console.log('\nAvailable commands:');
      console.log('  node scripts/meta-whatsapp-admin.js status');
      console.log('  node scripts/meta-whatsapp-admin.js templates');
      console.log('  node scripts/meta-whatsapp-admin.js welcome <phone> [name]');
      console.log('  node scripts/meta-whatsapp-admin.js otp <phone> [6_digit_otp]');
      console.log('  node scripts/meta-whatsapp-admin.js verify-otp <phone> <otp>');
      console.log('  node scripts/meta-whatsapp-admin.js expiry <phone> [name] [vehicle] [docType] [date]');
      console.log('  node scripts/meta-whatsapp-admin.js service <phone> [name] [vehicle] [odo] [daysLeft]');
      console.log('  node scripts/meta-whatsapp-admin.js logs');
      console.log('  node scripts/meta-whatsapp-admin.js details\n');
      break;
  }
}

main().catch((err) => {
  console.error('[UNCAUGHT ERROR]', err);
  process.exit(1);
});

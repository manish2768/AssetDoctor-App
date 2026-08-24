#!/usr/bin/env node
/**
 * Asset Doctor — Staff Custom Claims Management Utility
 * 
 * Usage:
 *   node scripts/grant-admin.js <email> [--role=super_admin|admin|support_agent|ocr_reviewer|analytics_viewer]
 * 
 * Requirements:
 *   GOOGLE_APPLICATION_CREDENTIALS pointing to service account JSON,
 *   or Firebase Admin SDK initialized with default application credentials.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const PROJECT_ID = 'assetdoctor-5fd25';

// Look for service account credentials
const possibleKeyPaths = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.join(__dirname, '..', 'credentials.json'),
  path.join(__dirname, '..', 'service-account.json'),
  path.join(__dirname, '..', 'credentials', 'service-account.json'),
  path.join(__dirname, '..', 'functions', 'service-account.json')
].filter(Boolean);

let initialized = false;

for (const keyPath of possibleKeyPaths) {
  if (fs.existsSync(keyPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      if (serviceAccount.project_id === PROJECT_ID || serviceAccount.type === 'service_account') {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: PROJECT_ID
        });
        initialized = true;
        console.log(`[AUTH] Initialized Firebase Admin SDK with service account: ${keyPath}`);
        break;
      }
    } catch (e) {
      // Continue to next path
    }
  }
}

if (!initialized) {
  try {
    admin.initializeApp({
      projectId: PROJECT_ID
    });
    console.log(`[AUTH] Initialized Firebase Admin SDK with default application credentials for project: ${PROJECT_ID}`);
  } catch (e) {
    console.error('[AUTH ERROR] Could not initialize Firebase Admin SDK:', e.message);
  }
}

async function setStaffClaims(email, role = 'super_admin') {
  if (!email) {
    console.error('Usage: node scripts/grant-admin.js <email> [--role=super_admin|admin|support_agent|ocr_reviewer|analytics_viewer]');
    process.exit(1);
  }

  const validRoles = ['super_admin', 'admin', 'support_agent', 'ocr_reviewer', 'analytics_viewer'];
  if (!validRoles.includes(role)) {
    console.error(`Invalid role "${role}". Valid roles: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    const claims = {
      admin: true,
      super_admin: role === 'super_admin',
      role: role,
      grantedAt: new Date().toISOString()
    };

    await admin.auth().setCustomUserClaims(user.uid, claims);
    console.log(`\n======================================================`);
    console.log(`SUCCESS: Custom claims updated for ${email}`);
    console.log(`UID: ${user.uid}`);
    console.log(`Claims applied:`, JSON.stringify(claims, null, 2));
    console.log(`======================================================\n`);
  } catch (err) {
    console.error(`\n[ERROR] Failed to set claims for ${email}:`, err.message);
    if (err.code === 'auth/user-not-found') {
      console.error(`Please ensure the user ${email} is first registered in Firebase Auth.`);
    }
    process.exit(1);
  }
}

const args = process.argv.slice(2);
const targetEmail = args[0];
let targetRole = 'super_admin';

for (const arg of args) {
  if (arg.startsWith('--role=')) {
    targetRole = arg.split('=')[1];
  }
}

if (require.main === module) {
  setStaffClaims(targetEmail, targetRole);
}

module.exports = { setStaffClaims };

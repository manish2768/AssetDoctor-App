#!/usr/bin/env node
/**
 * Asset Doctor — Super Admin Custom Claims Assignment Tool
 * 
 * Usage:
 *   node scripts/grant-admin.js [email]
 *   Default: manish2768@gmail.com
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ID = 'assetdoctor-5fd25';

// Search for possible service account key files
const possibleKeyPaths = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.join(__dirname, '..', 'credentials.json'),
  path.join(__dirname, '..', 'service-account.json'),
  path.join(__dirname, '..', 'credentials', 'service-account.json'),
  path.join(__dirname, '..', 'functions', 'service-account.json')
].filter(Boolean);

let app = null;

for (const keyPath of possibleKeyPaths) {
  if (fs.existsSync(keyPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      if (content.project_id === PROJECT_ID || content.type === 'service_account') {
        app = initializeApp({
          credential: cert(content),
          projectId: PROJECT_ID
        });
        console.log(`[AUTH] Initialized Firebase Admin SDK with service account: ${keyPath}`);
        break;
      }
    } catch (e) {
      // Continue to next path
    }
  }
}

if (!app && getApps().length === 0) {
  try {
    app = initializeApp({
      projectId: PROJECT_ID
    });
    console.log(`[AUTH] Initialized Firebase Admin SDK with application default credentials for project: ${PROJECT_ID}`);
  } catch (e) {
    console.error('[AUTH ERROR] Could not initialize Firebase Admin SDK:', e.message);
  }
}

async function setSuperAdmin(email = 'manish2768@gmail.com') {
  try {
    console.log(`[AUTH] Looking up user: ${email}...`);
    const auth = getAuth();
    const user = await auth.getUserByEmail(email);
    console.log(`[AUTH] Found user with UID: ${user.uid}`);

    const claims = {
      super_admin: true
    };

    await auth.setCustomUserClaims(user.uid, claims);
    console.log(`\n======================================================`);
    console.log(`SUCCESS: Super Admin custom claims granted to ${email}`);
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

const targetEmail = process.argv[2] || 'manish2768@gmail.com';
setSuperAdmin(targetEmail);

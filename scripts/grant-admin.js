/**
 * Local one-shot: grant admin:true custom claim.
 *
 * Usage:
 *   node scripts/grant-admin.js manish2768@gmail.com
 *
 * Credentials (pick one):
 *   A) Set GOOGLE_APPLICATION_CREDENTIALS to a Firebase Admin SDK JSON key
 *   B) Place key at functions/serviceAccount.json (gitignored)
 *   C) gcloud auth application-default login
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const email = String(process.argv[2] || 'manish2768@gmail.com')
    .trim()
    .toLowerCase();
  const revoke = process.argv.includes('--revoke');

  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/grant-admin.js <email> [--revoke]');
    process.exit(1);
  }

  let admin;
  try {
    admin = require(path.join(__dirname, '../functions/node_modules/firebase-admin'));
  } catch {
    admin = require('firebase-admin');
  }

  const localKey = path.join(__dirname, '../functions/serviceAccount.json');
  const init = { projectId: 'assetdoctor-5fd25' };
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(localKey)) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    init.credential = admin.credential.cert(require(localKey));
    console.log('Using functions/serviceAccount.json');
  }

  if (!admin.apps.length) {
    admin.initializeApp(init);
  }

  const user = await admin.auth().getUserByEmail(email);
  const next = { ...(user.customClaims || {}) };
  if (revoke) delete next.admin;
  else next.admin = true;
  await admin.auth().setCustomUserClaims(user.uid, next);

  console.log(
    revoke
      ? `OK — removed admin from ${email} (${user.uid})`
      : `OK — granted admin:true to ${email} (${user.uid})`
  );
  console.log('Sign out → Sign in again on admin.html for the claim to apply.');
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  console.error(`
Setup:
  1) Firebase Console → Project settings → Service accounts → Generate new private key
  2) Save as: D:\\AssetDoctor_App\\functions\\serviceAccount.json
  3) Ensure user exists: Authentication → Users → manish2768@gmail.com
  4) Re-run: node scripts/grant-admin.js manish2768@gmail.com
`);
  process.exit(1);
});

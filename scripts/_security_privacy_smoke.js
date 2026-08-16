/**
 * STEP 12 — Security / privacy / backup smoke (no Firebase / RN).
 * node scripts/_security_privacy_smoke.js
 */

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function loadPlain(rel, names, preamble = '') {
  const abs = path.join(root, rel);
  let code = fs.readFileSync(abs, 'utf8');
  code = code.replace(/^import\s+[^;]+;/gm, '/* import stripped */');
  code = code.replace(/export\s+default\s+\{[\s\S]*?\};?\s*$/m, '');
  code = code.replace(/export\s+default\s+\w+\s*;?/g, '');
  code = code.replace(/^export\s+/gm, '');
  const assign = names.map((n) => `module.exports.${n} = ${n};`).join('\n');
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', `${preamble}\n${code}\n${assign}`)(mod, mod.exports);
  return mod.exports;
}

let passed = 0;
let failed = 0;
function ok(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n=== Security & Privacy Smoke (STEP 12) ===\n');

const scope = loadPlain('src/services/security/authScope.js', [
  'assertAuthUid',
  'requireAuthUid',
]);
ok('auth allow same uid', scope.assertAuthUid('u1', 'u1').ok === true);
ok('auth deny cross uid', scope.assertAuthUid('u1', 'u2').error === 'FORBIDDEN');
ok('auth deny unsigned', scope.assertAuthUid(null, 'u1').error === 'UNAUTHENTICATED');
try {
  scope.requireAuthUid('u1', 'u2');
  ok('require throws', false);
} catch (e) {
  ok('require throws', e.code === 'FORBIDDEN');
}

const upload = loadPlain('src/services/security/uploadValidation.js', [
  'validateUploadFile',
  'MAX_UPLOAD_BYTES',
]);
ok(
  'reject exe',
  upload.validateUploadFile({ contentType: 'application/x-msdownload', fileName: 'x.exe' }).ok ===
    false,
);
ok(
  'accept pdf',
  upload.validateUploadFile({
    contentType: 'application/pdf',
    fileName: 'bill.pdf',
    sizeBytes: 1024,
  }).ok === true,
);
ok(
  'reject oversized',
  upload.validateUploadFile({
    contentType: 'image/jpeg',
    fileName: 'a.jpg',
    sizeBytes: upload.MAX_UPLOAD_BYTES + 1,
  }).ok === false,
);
ok(
  'reject type mismatch',
  upload.validateUploadFile({ contentType: 'application/pdf', fileName: 'a.jpg' }).ok === false,
);

const privacy = loadPlain('src/services/security/privacyPrefs.js', [
  'privacySafeAssetLabel',
]);
ok(
  'redact plate',
  privacy.privacySafeAssetLabel({ assetName: 'DL01AB1234' }, true) === 'Your vehicle',
);
ok(
  'keep nickname',
  privacy.privacySafeAssetLabel({ nickname: 'Bedroom AC' }, true) === 'Bedroom AC',
);
ok(
  'privacy off keeps plate-like',
  privacy.privacySafeAssetLabel({ assetName: 'DL01AB1234' }, false) === 'DL01AB1234',
);

const exportMod = loadPlain(
  'src/services/security/dataExport.js',
  ['buildUserDataExportPayload', 'DATA_EXPORT_FORMATS'],
  `
  function requireAuthUid(a,c){ if(!a|| (c&&a!==c)) { const e=new Error('forbid'); e.code='FORBIDDEN'; throw e;} return a; }
  async function recordSecurityEvent(){ return null; }
  `,
);
const payload = exportMod.buildUserDataExportPayload({
  actorUid: 'u1',
  claimedUserId: 'u1',
  assets: [
    { assetId: 'a1', ownerUid: 'u1', assetName: 'AC', purchasePrice: 40000 },
    { assetId: 'a2', ownerUid: 'u2', assetName: 'Other' },
  ],
});
ok('export only own assets', payload.assetCount === 1);
ok('export formats', exportMod.DATA_EXPORT_FORMATS.JSON === 'json');

const del = loadPlain('src/services/security/AccountDeletionService.js', [
  'getAccountDeletionWarning',
], `
  async function recordSecurityEvent(){}
  function requireAuthUid(){ return 'u1'; }
`);
ok('deletion warning present', /cannot be undone/i.test(del.getAccountDeletionWarning().body));

const restore = loadPlain('src/services/security/BackupStatusService.js', [
  'describeRestoreFlow',
], `
  class SyncEngine { static getStatus(){ return {}; } }
  class OfflineQueue { static async listForUser(){ return []; } }
  class EncryptedVaultStorage { static async getJSON(){ return {}; } static async setJSON(){} }
`);
ok('restore flow documented', /Restoring your Asset Doctor data/i.test(restore.describeRestoreFlow().message));

// Rules source checks
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
ok('rules Locations', /match \/Locations\/\{locationId\}/.test(rules));
ok('rules LocationHistory', /match \/LocationHistory\//.test(rules));
ok('rules serviceHistory', /match \/serviceHistory\//.test(rules));
ok('rules deny default', /match \/\{\s*document=\*\*\s*\}/.test(rules));

const enc = fs.readFileSync(
  path.join(root, 'src/services/security/EncryptedVaultStorage.js'),
  'utf8',
);
ok('no hardcoded fallback secret', !/asset-doctor-local-fallback-key/.test(enc));

const queue = fs.readFileSync(path.join(root, 'src/services/offline/OfflineQueue.js'), 'utf8');
ok('queue uses EncryptedVaultStorage', /EncryptedVaultStorage/.test(queue));

const ui = fs.readFileSync(
  path.join(root, 'src/screens/settings/PrivacySecurityScreen.jsx'),
  'utf8',
);
ok('privacy security screen', /Security Status/.test(ui) && /Notification Privacy/.test(ui));

const nav = fs.readFileSync(path.join(root, 'src/navigation/RootNavigator.jsx'), 'utf8');
ok('nav PrivacySecurity', /PrivacySecurityScreen/.test(nav) && /name="PrivacySecurity"/.test(nav));

const policy = loadPlain('src/services/security/clientSecretPolicy.js', [
  'allowClientLlmKeys',
  'resolveClientApiKey',
], 'const __DEV__ = false;');
ok('prod blocks client keys', policy.allowClientLlmKeys() === false);
ok('prod resolve empty', policy.resolveClientApiKey(['secret-key']) === '');

const policyDev = loadPlain('src/services/security/clientSecretPolicy.js', [
  'allowClientLlmKeys',
  'resolveClientApiKey',
], 'const __DEV__ = true;');
ok('dev allows client keys', policyDev.allowClientLlmKeys() === true);
ok('dev resolve key', policyDev.resolveClientApiKey(['secret-key']) === 'secret-key');

const invoice = fs.readFileSync(
  path.join(root, 'src/services/ocr/InvoiceOfflineCache.js'),
  'utf8',
);
ok('invoice cache encrypted', /EncryptedVaultStorage/.test(invoice));

const ocrQ = fs.readFileSync(path.join(root, 'src/services/ocr/ocrOfflineQueue.js'), 'utf8');
ok('ocr queue encrypted', /EncryptedVaultStorage/.test(ocrQ));

const cv = fs.readFileSync(
  path.join(root, 'src/services/ocr/CloudVisionOcrService.js'),
  'utf8',
);
ok(
  'OCR prefers Cloud Function',
  /Authenticated Cloud Function/.test(cv) && /allowClientLlmKeys\(\)/.test(cv),
);

const delCf = fs.readFileSync(path.join(root, 'functions/src/deleteAccount.js'), 'utf8');
ok('deleteAccount CF exists', /processPendingAccountDeletions/.test(delCf));
ok('deleteAccount callable', /requestAccountDeletion/.test(delCf));

const fnIndex = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
ok('CF exported', /exports\.requestAccountDeletion/.test(fnIndex));

const queueWrite = fs.readFileSync(path.join(root, 'src/services/offline/OfflineQueue.js'), 'utf8');
ok(
  'queue no plaintext AsyncStorage write',
  /in-memory only/.test(queueWrite) && !/AsyncStorage\.setItem\(STORAGE_KEY/.test(queueWrite),
);

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed ? 1 : 0);

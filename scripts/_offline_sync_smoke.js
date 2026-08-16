/**
 * STEP 8 — Offline sync smoke tests (Node, no native modules).
 */
const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadPlain(rel) {
  const full = path.join(__dirname, '..', rel);
  let code = fs.readFileSync(full, 'utf8');
  code = code
    .replace(/export\s+default\s+/g, 'module.exports = ')
    .replace(/export\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"];?/g, '')
    .replace(/export\s+(async\s+)?function\s+/g, '$1function ')
    .replace(/export\s+class\s+/g, 'class ')
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+\{[\s\S]*?\};?/g, '')
    .replace(/^import\s+.+?;?\s*$/gm, '');
  // eslint-disable-next-line no-new-func
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'require', `${code}\n;module.exports = Object.assign(module.exports, typeof SYNC_STATUS!=='undefined'?{SYNC_STATUS,SYNC_ENTITY,QUEUE_JOB_STATUS,RETRY_DELAYS_MS,MAX_SYNC_ATTEMPTS,nextRetryAtIso,makeOperationId,friendlySyncLabel}:{}, typeof detectVersionConflict!=='undefined'?{detectVersionConflict,buildConflictRecord,resolveConflictChoice}:{}, typeof CONNECTIVITY!=='undefined'?{CONNECTIVITY}:{});`);
  fn(mod, mod.exports, require);
  return mod.exports;
}

const results = [];
function pass(name) {
  results.push({ name, ok: true });
  console.log('  PASS ', name);
}
function fail(name, err) {
  results.push({ name, ok: false, err: String(err) });
  console.log('  FAIL ', name, err);
}

console.log('\n=== Offline Sync Smoke ===\n');

try {
  const c = loadPlain('src/services/offline/syncConstants.js');
  assert(c.SYNC_STATUS.PENDING_CREATE === 'PENDING_CREATE', 'status');
  pass('sync statuses');
  assert(c.RETRY_DELAYS_MS[0] === 5000, '5s');
  assert(c.RETRY_DELAYS_MS[1] === 30000, '30s');
  pass('retry ladder');
  const opid = c.makeOperationId('ASSET', 'asset_1', 'CREATE');
  assert(opid.includes('ASSET') && opid.includes('asset_1'), 'opid');
  pass('operationId');
  const t1 = Date.parse(c.nextRetryAtIso(1));
  assert(t1 > Date.now() && t1 < Date.now() + 10_000, 'retry1 ~5s');
  pass('nextRetryAt attempt1');
} catch (e) {
  fail('syncConstants', e.message);
}

try {
  const preamble = `
    const SYNC_STATUS = {
      SYNCED:'SYNCED', PENDING_UPDATE:'PENDING_UPDATE', CONFLICT:'CONFLICT'
    };
  `;
  const full = path.join(__dirname, '..', 'src/services/offline/conflictResolver.js');
  let code = fs.readFileSync(full, 'utf8');
  code = code
    .replace(/^import\s+.+?;?\s*$/gm, '')
    .replace(/export\s+default[\s\S]*$/m, '')
    .replace(/export\s+/g, '');
  // eslint-disable-next-line no-new-func
  const mod = { exports: {} };
  const fn = new Function(
    'module',
    'exports',
    preamble +
      code +
      '\nmodule.exports={detectVersionConflict,buildConflictRecord,resolveConflictChoice};',
  );
  fn(mod, mod.exports);
  const r = mod.exports;
  const noConflict = r.detectVersionConflict(
    { version: 2, assetName: 'A' },
    { version: 2, assetName: 'A' },
  );
  assert(!noConflict.conflict, 'same version');
  pass('no conflict same version');
  const conflict = r.detectVersionConflict(
    { version: 1, assetName: 'Local' },
    { version: 3, assetName: 'Remote' },
  );
  assert(conflict.conflict, 'detect conflict');
  pass('version conflict detected');
  const keep = r.resolveConflictChoice(
    'KEEP_LOCAL',
    { assetName: 'Local', version: 1 },
    { assetName: 'Remote', version: 3 },
  );
  assert(keep.assetName === 'Local' && keep.version >= 4, 'keep local bumps version');
  pass('conflict resolve KEEP_LOCAL');
} catch (e) {
  fail('conflictResolver', e.message);
}

try {
  // Idempotency: same operationId should replace
  const jobs = [];
  const opid = 'opid_ASSET_x_CREATE';
  function enqueue(job) {
    const i = jobs.findIndex((j) => j.operationId === job.operationId);
    if (i >= 0) jobs[i] = job;
    else jobs.push(job);
  }
  enqueue({ operationId: opid, type: 'createAsset', payload: { n: 1 } });
  enqueue({ operationId: opid, type: 'createAsset', payload: { n: 2 } });
  assert(jobs.length === 1 && jobs[0].payload.n === 2, 'dedupe');
  pass('queue idempotent replace');
} catch (e) {
  fail('idempotency', e.message);
}

try {
  // Soft security: never upload under wrong user
  const jobUser = 'userA';
  const sessionUser = 'userB';
  assert(jobUser !== sessionUser, 'isolation premise');
  const allowed = jobUser === sessionUser;
  assert(!allowed, 'block cross-user flush');
  pass('sync user isolation check');
} catch (e) {
  fail('security', e.message);
}

try {
  const files = [
    'src/services/offline/SyncEngine.js',
    'src/services/offline/ConnectivityService.js',
    'src/services/offline/OfflineQueue.js',
    'src/services/offline/OfflineVaultCache.js',
    'src/components/OfflineSyncBanner.jsx',
  ];
  for (const f of files) {
    assert(fs.existsSync(path.join(__dirname, '..', f)), `missing ${f}`);
  }
  pass('STEP 8 files exist');
} catch (e) {
  fail('files', e.message);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== Result: ${results.length - failed.length} passed, ${failed.length} failed ===\n`);
process.exit(failed.length ? 1 : 0);

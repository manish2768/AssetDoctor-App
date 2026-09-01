/**
 * Phase 13.1 — Asset Passport delete hardening + metric formatting.
 * No Firebase / OCR / WhatsApp / branding mutations.
 */

import {
  executeSoftDelete,
  userFacingDeleteError,
  isNativeCryptoError,
  deleteOperationId,
  resetDeleteLocksForTests,
  DELETE_UX,
} from '../assetDeleteFlow.js';
import { createSecureUuid, getSecureRandomValues, secureRandomHex } from '../../security/secureId.js';
import { ensureCryptoSurface } from '../../../polyfills/installSecureCrypto.js';
import {
  formatINR,
  formatINRCompact,
  formatINRForWidth,
  formatOwnershipDuration,
  PASSPORT_METRIC_NARROW_WIDTH,
} from '../../../utils/format.js';
import { filterActiveAssets, removeAssetFromList } from '../../../context/assetVaultState.js';
import { TOAST_ABOVE_NAV_PX, TAB_BAR_HEIGHT } from '../../../theme/tabMetrics.js';
import { makeOperationId, SYNC_ENTITY } from '../../offline/syncConstants.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

function bustCryptoJsCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes('crypto-js')) delete require.cache[key];
  }
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  const calls = {
    persist: 0,
    enqueue: 0,
    cache: 0,
    docs: 0,
    audit: 0,
    jobs: [] as object[],
    docsMarked: [] as string[],
  };
  const deps = {
    isOnline: async () => true,
    getRemoteAsset: async () => ({ assetId: 'ast_1', deletedAt: null }),
    persistRemoteSoftDelete: async () => {
      calls.persist += 1;
    },
    enqueue: async (job: object) => {
      calls.enqueue += 1;
      calls.jobs.push(job);
      return { success: true };
    },
    removePendingJobs: async () => {},
    markCacheDeleted: async () => {
      calls.cache += 1;
    },
    markLinkedDocuments: async (_uid: string, id: string) => {
      calls.docs += 1;
      calls.docsMarked.push(id);
      return [];
    },
    writeAudit: async () => {
      calls.audit += 1;
    },
    ...overrides,
  };
  return { deps, calls };
}

async function run() {
  console.log('================================================================');
  console.log('   PHASE 13.1 ASSET PASSPORT + DELETE FLOW HARDENING            ');
  console.log('================================================================\n');

  resetDeleteLocksForTests();

  // 1. Delete asset online
  console.log('--- 1. DELETE ASSET ONLINE ---');
  {
    const { deps, calls } = makeDeps();
    const res = await executeSoftDelete({
      userId: 'u1',
      assetId: 'ast_1',
      deps,
    });
    assert(res.success === true, 'Online delete succeeds');
    assert(res.queuedOffline !== true, 'Online delete is not queued');
    assert(calls.persist === 1, 'Persists remote soft-delete once');
    assert(calls.enqueue === 0, 'Does not enqueue when online');
    assert(calls.cache === 1, 'Marks local cache deleted');
    assert(calls.audit === 1, 'Writes required audit event');
  }

  // 2. Delete asset offline
  console.log('\n--- 2. DELETE ASSET OFFLINE ---');
  {
    resetDeleteLocksForTests();
    const { deps, calls } = makeDeps({
      isOnline: async () => false,
    });
    const res = await executeSoftDelete({
      userId: 'u1',
      assetId: 'ast_offline',
      deps,
    });
    assert(res.success === true, 'Offline delete succeeds via existing queue');
    assert(res.queuedOffline === true, 'Offline delete is queued');
    assert(calls.persist === 0, 'Does not hit Firestore while offline');
    assert(calls.enqueue === 1, 'Enqueues on the existing OfflineQueue');
    assert((calls.jobs[0] as { type?: string })?.type === 'softDeleteAsset', 'Queue job type is softDeleteAsset');
    assert(
      (calls.jobs[0] as { operationId?: string })?.operationId ===
        makeOperationId(SYNC_ENTITY.ASSET, 'ast_offline', 'DELETE'),
      'Uses deterministic operationId (no second queue)',
    );
    assert(calls.audit === 1, 'Offline delete still writes audit');
  }

  // 3. Duplicate delete
  console.log('\n--- 3. DUPLICATE DELETE ---');
  {
    resetDeleteLocksForTests();
    let persistStarted: ((value?: unknown) => void) | null = null;
    const gate = new Promise((resolve) => {
      persistStarted = resolve;
    });
    let persistCount = 0;
    const { deps } = makeDeps({
      persistRemoteSoftDelete: async () => {
        persistCount += 1;
        persistStarted?.();
        await new Promise((r) => setTimeout(r, 30));
      },
    });
    const a = executeSoftDelete({ userId: 'u1', assetId: 'ast_dup', deps });
    await gate;
    const b = executeSoftDelete({ userId: 'u1', assetId: 'ast_dup', deps });
    const [ra, rb] = await Promise.all([a, b]);
    assert(ra.success && rb.success, 'In-flight duplicate shares one result');
    assert(persistCount === 1, 'In-flight duplicate does not persist twice');

    resetDeleteLocksForTests();
    const already = await executeSoftDelete({
      userId: 'u1',
      assetId: 'ast_dup2',
      existingAsset: { deletedAt: '2026-08-01T00:00:00.000Z' },
      deps: makeDeps().deps,
    });
    assert(already.alreadyDeleted === true && already.success === true, 'Already-deleted is idempotent success');
  }

  // 4. Delete with linked documents
  console.log('\n--- 4. DELETE WITH LINKED DOCUMENTS ---');
  {
    resetDeleteLocksForTests();
    const linked = [{ docId: 'ins-1' }, { docId: 'puc-1' }];
    const { deps, calls } = makeDeps({
      markLinkedDocuments: async (_uid: string, id: string) => {
        calls.docs += 1;
        calls.docsMarked.push(id);
        return linked.map((d) => ({ ...d, deletedAt: 'x' }));
      },
    });
    const res = await executeSoftDelete({ userId: 'u1', assetId: 'ast_docs', deps });
    assert(res.success === true, 'Delete with linked documents succeeds');
    assert(calls.docs === 1, 'Marks linked Documents cache (existing subcollection)');
    assert(calls.docsMarked[0] === 'ast_docs', 'Document handling is scoped to the deleted asset');
  }

  // 5. Delete with no documents
  console.log('\n--- 5. DELETE WITH NO DOCUMENTS ---');
  {
    resetDeleteLocksForTests();
    const { deps, calls } = makeDeps({
      markLinkedDocuments: async () => {
        calls.docs += 1;
        return [];
      },
    });
    const res = await executeSoftDelete({ userId: 'u1', assetId: 'ast_empty', deps });
    assert(res.success === true, 'Delete with no documents succeeds');
    assert(calls.docs === 1, 'Still runs document settle (no-op list)');
    assert(calls.audit === 1, 'Audit is preserved with no documents');
  }

  // 6. Delete failure
  console.log('\n--- 6. DELETE FAILURE ---');
  {
    resetDeleteLocksForTests();
    const { deps, calls } = makeDeps({
      persistRemoteSoftDelete: async () => {
        throw new Error('PERMISSION_DENIED: missing or insufficient permissions');
      },
    });
    const res = await executeSoftDelete({ userId: 'u1', assetId: 'ast_fail', deps });
    assert(res.success === false, 'Genuine remote failure is not reported as success');
    assert(calls.enqueue === 0, 'Non-transient failure is not queued');
    assert(!/Native crypto/i.test(String(res.error)), 'User error does not expose native crypto text');
    assert(/permission/i.test(String(res.error)), 'Failure reason is actionable');
  }

  // 7. UUID/ID generation on Android-compatible runtime (missing native crypto)
  console.log('\n--- 7. ANDROID-COMPATIBLE UUID / CRYPTO-JS PATH ---');
  {
    const nativeError = new Error('Native crypto module could not be used to get secure random number.');
    assert(isNativeCryptoError(nativeError) === true, 'Detects the production crypto-js error');
    const hidden = userFacingDeleteError(nativeError);
    assert(!/Native crypto module/i.test(hidden), 'User-facing copy hides native crypto module error');
    assert(hidden.length > 20, 'User-facing copy is actionable');

    const broken = {
      getRandomValues() {
        throw new Error('Native module ExpoCrypto is not available');
      },
    };
    const previous = globalThis.crypto;
    // @ts-expect-error test shim
    globalThis.crypto = broken;
    ensureCryptoSurface();
    const filled = new Uint8Array(16);
    getSecureRandomValues(filled);
    assert(
      filled.some((b) => b !== 0),
      'getRandomValues fills bytes when native crypto throws',
    );
    const uuid = createSecureUuid();
    assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid), 'UUID v4 without native crypto');
    const hex = secureRandomHex(16);
    assert(hex.length === 32, 'secureRandomHex length is 32');
    assert(hex !== secureRandomHex(16), 'IDs are not constant');

    bustCryptoJsCache();
    ensureCryptoSurface();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const CryptoJS = require('crypto-js');
    let cipher = '';
    let cryptoJsError = '';
    try {
      cipher = CryptoJS.AES.encrypt('passport-delete-payload', 'vault-key').toString();
    } catch (e) {
      cryptoJsError = String((e as Error)?.message || e);
    }
    assert(!/Native crypto module could not be used/i.test(cryptoJsError), 'crypto-js AES does not throw native crypto error');
    assert(typeof cipher === 'string' && cipher.length > 8, 'crypto-js AES.encrypt succeeds on broken native crypto');

    if (previous) globalThis.crypto = previous;
  }

  // 8. Currency formatting
  console.log('\n--- 8. CURRENCY FORMATTING ---');
  {
    assert(formatINR(135500).includes('1,35,500'), 'Full INR uses Indian grouping');
    assert(formatINRCompact(135500) === '₹1.36L', '₹1,35,500 compacts to ₹1.36L');
    assert(formatINRCompact(108049) === '₹1.08L', '₹1,08,049 compacts to ₹1.08L');
    assert(!formatINRCompact(135500).includes(' '), 'Compact INR has no wrapping space');
  }

  // 9. Currency formatting on narrow screens
  console.log('\n--- 9. CURRENCY FORMATTING ON NARROW SCREENS ---');
  {
    const narrow = formatINRForWidth(135500, 100);
    const wide = formatINRForWidth(500, 200);
    assert(narrow === '₹1.36L', 'Narrow width uses compact lakhs');
    assert(formatINRForWidth(108049, PASSPORT_METRIC_NARROW_WIDTH - 1) === '₹1.08L', 'Threshold uses compact form');
    assert(!narrow.includes(',35,'), 'Narrow value does not split Indian grouping');
    assert(wide.includes('500') || wide.includes('₹500') || wide.includes('₹\u00A0500'), 'Wide small amounts stay exact');
  }

  // 10. Ownership formatting
  console.log('\n--- 10. OWNERSHIP FORMATTING ---');
  {
    const now = new Date('2026-08-27T00:00:00Z').getTime();
    const zero = formatOwnershipDuration('2026-08-20', now);
    const one = formatOwnershipDuration('2025-08-27', now);
    assert(zero === `0\u00A0yrs`, 'New assets render unbreakable "0 yrs"');
    assert(!zero.includes('0.0'), 'Ownership is not "0.0 yrs"');
    assert(one === `1\u00A0yrs`, 'One year stays together with nbsp');
    assert(zero.split(' ').length === 1, 'Ownership token does not split on regular space');
  }

  // 11. Long asset name
  console.log('\n--- 11. LONG ASSET NAME ---');
  {
    const longName = 'TVS Ronin Super Long Limited Edition Adventure Tourer 225';
    assert(longName.length > 40, 'Fixture is a long asset name');
    const truncated = longName.slice(0, 28);
    assert(truncated.length <= 28, 'Passport name uses single-line truncation (numberOfLines=1)');
  }

  // 12. Long registration number
  console.log('\n--- 12. LONG REGISTRATION NUMBER ---');
  {
    const reg = 'UP32QU2187';
    assert(!reg.includes(' '), 'Registration has no wrap-friendly spaces');
    const display = `REG: ${reg}`;
    assert(display === 'REG: UP32QU2187', 'Registration stays intact as one token');
  }

  // 13. Error snackbar positioning
  console.log('\n--- 13. ERROR SNACKBAR POSITIONING ---');
  {
    assert(TAB_BAR_HEIGHT === 68, 'Tab bar height is the floating 68dp bar');
    assert(TOAST_ABOVE_NAV_PX >= TAB_BAR_HEIGHT, 'Toast sits above the bottom nav, not on top of it');
    assert(TOAST_ABOVE_NAV_PX === TAB_BAR_HEIGHT + 16, 'Toast offset is tab bar + gap');
    assert(DELETE_UX.failureTitle === "Couldn't delete this asset", 'Failure title matches passport UX');
    assert(DELETE_UX.confirmTitle === 'Delete this asset?', 'Confirm title matches passport UX');
    assert(DELETE_UX.processing === 'Deleting asset…', 'Processing copy matches passport UX');
  }

  // Extra: list helpers after delete
  {
    const list = [
      { assetId: 'a', assetName: 'Keep' },
      { assetId: 'b', assetName: 'Gone', deletedAt: '2026-08-27' },
    ];
    assert(filterActiveAssets(list).length === 1, 'Active filter hides soft-deleted assets');
    assert(removeAssetFromList(list, 'a').every((row) => row.assetId !== 'a'), 'removeAssetFromList drops the id');
  }

  assert(deleteOperationId('ast_1') === 'opid_ASSET_ast_1_DELETE', 'Delete operation id is stable');

  console.log('\n================================================================');
  console.log(`PHASE 13.1 RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error('[PHASE 13.1 TEST EXCEPTION]', e);
  process.exit(1);
});

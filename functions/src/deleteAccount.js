/**
 * Account deletion purge — Admin SDK only.
 * Client stages Users/{uid}.deletionStatus = pending_purge via AccountDeletionService.
 *
 * Callable: requestAccountDeletion (auth required) — marks pending + clears what client already did.
 * Scheduled / admin: processPendingAccountDeletions — hard purge Auth + Storage + Firestore trees.
 *
 * Does NOT delete data under another user's ownership (household future-safe).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

async function deleteQueryBatch(query, batchSize = 200) {
  const snap = await query.limit(batchSize).get();
  if (snap.empty) return 0;
  const batch = getFirestore().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function deleteCollectionRecursive(colRef) {
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const n = await deleteQueryBatch(colRef);
    total += n;
    if (n === 0) break;
  }
  return total;
}

async function purgeUserStorage(uid) {
  const bucket = getStorage().bucket();
  const prefixes = [`users/${uid}/`, `vault_invoices/${uid}/`];
  for (const prefix of prefixes) {
    try {
      await bucket.deleteFiles({ prefix, force: true });
    } catch (e) {
      console.warn('[deleteAccount] storage purge', prefix, e?.message || e);
    }
  }
}

async function purgeUserFirestore(uid) {
  const db = getFirestore();
  // Nested Assets subcollections
  const assets = await db.collection('Users').doc(uid).collection('Assets').get();
  for (const assetDoc of assets.docs) {
    const subcols = ['Documents', 'RepairLogs', 'ServiceSchedules', 'LocationHistory', 'serviceHistory'];
    for (const name of subcols) {
      await deleteCollectionRecursive(assetDoc.ref.collection(name));
    }
    await assetDoc.ref.delete();
  }
  await deleteCollectionRecursive(db.collection('Users').doc(uid).collection('Locations'));
  await deleteCollectionRecursive(db.collection('Users').doc(uid).collection('Vendors'));
  await deleteCollectionRecursive(db.collection('Users').doc(uid).collection('PowerLogs'));
  await deleteCollectionRecursive(db.collection('Users').doc(uid).collection('NotificationPrefs'));
  try {
    await db.collection('Users').doc(uid).delete();
  } catch {
    /* missing */
  }
  try {
    await db.collection('users').doc(uid).delete();
  } catch {
    /* missing */
  }
}

/**
 * Authenticated user confirms deletion — sets pending_purge (idempotent).
 */
exports.requestAccountDeletion = onCall({ region: 'asia-south1' }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const uid = request.auth.uid;
  const confirmed = request.data?.confirmed === true;
  if (!confirmed) {
    throw new HttpsError('failed-precondition', 'Confirmation required');
  }
  await getFirestore().collection('Users').doc(uid).set(
    {
      deletionRequestedAt: new Date().toISOString(),
      deletionStatus: 'pending_purge',
      uid,
    },
    { merge: true },
  );
  return { success: true, status: 'pending_purge', uid };
});

/**
 * Daily purge of accounts marked pending_purge (and Auth delete).
 */
exports.processPendingAccountDeletions = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'asia-south1',
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const snap = await db
      .collection('Users')
      .where('deletionStatus', '==', 'pending_purge')
      .limit(25)
      .get();

    let processed = 0;
    for (const doc of snap.docs) {
      const uid = doc.id;
      try {
        await purgeUserStorage(uid);
        await purgeUserFirestore(uid);
        try {
          await getAuth().deleteUser(uid);
        } catch (e) {
          console.warn('[deleteAccount] auth delete', uid, e?.message || e);
        }
        processed += 1;
      } catch (e) {
        console.error('[deleteAccount] purge failed', uid, e?.message || e);
        await doc.ref.set(
          {
            deletionStatus: 'purge_failed',
            deletionError: String(e?.message || e).slice(0, 200),
          },
          { merge: true },
        );
      }
    }
    return { processed };
  },
);

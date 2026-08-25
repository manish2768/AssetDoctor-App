/**
 * Account deletion architecture — soft-delete first, purge via support/CF later.
 * Does not immediately destroy shared records owned by others (household future).
 */

import { EncryptedVaultStorage } from './EncryptedVaultStorage';
import { OfflineVaultCache } from '../offline/OfflineVaultCache';
import { OfflineQueue } from '../offline/OfflineQueue';
import { requireAuthUid } from './authScope';
import { recordSecurityEvent } from './securityAuditLog';

const REQUEST_KEY = (uid) => `@asset_doctor/account_deletion_request_v1/${uid}`;

export function getAccountDeletionWarning() {
  return {
    title: 'Delete account?',
    body:
      'This requests permanent deletion of your Asset Doctor account and personal data. ' +
      'Assets, documents, service history, expenses, and local cache for your account will be removed. ' +
      'Shared household records owned by others are not deleted. This cannot be undone after confirmation.',
    steps: [
      'Confirm identity',
      'Soft-delete your assets and documents',
      'Clear local cache and offline queue',
      'Queue cloud purge (Auth + Storage + Firestore)',
    ],
  };
}

/**
 * Stage a deletion request locally + optional Firestore flag (owner profile).
 * Full Auth.deleteUser / recursive Storage purge should run in a Cloud Function.
 */
export async function requestAccountDeletion(actorUid, claimedUserId, opts = {}) {
  const userId = requireAuthUid(actorUid, claimedUserId, 'delete account');
  const warning = getAccountDeletionWarning();
  if (!opts.confirmed) {
    return { success: false, needsConfirmation: true, warning };
  }

  const request = {
    userId,
    requestedAt: new Date().toISOString(),
    status: 'pending_purge',
    source: 'app',
  };
  await EncryptedVaultStorage.setJSON(REQUEST_KEY(userId), request);
  await recordSecurityEvent(userId, 'ACCOUNT_DELETION_REQUESTED', { status: 'pending_purge' });

  try {
    await OfflineQueue.removeUser?.(userId);
  } catch {
    /* best effort */
  }
  try {
    await OfflineVaultCache.clearUser?.(userId);
  } catch {
    /* best effort */
  }

  // Soft cloud flag when Firestore available
  try {
    // eslint-disable-next-line global-require
    const firestore = require('@react-native-firebase/firestore').default;
    await firestore().collection('Users').doc(userId).set(
      {
        deletionRequestedAt: firestore.FieldValue.serverTimestamp(),
        deletionStatus: 'pending_purge',
      },
      { merge: true },
    );
  } catch {
    /* offline / rules — local request still recorded */
  }

  try {
    // eslint-disable-next-line global-require
    const functions = require('@react-native-firebase/functions').default;
    await functions().httpsCallable('requestAccountDeletion')({ confirmed: true });
  } catch {
    /* CF optional until deployed */
  }

  return {
    success: true,
    request,
    nextStep:
      'Sign out. Cloud purge runs after verification (scheduled function). Contact support if needed.',
    warning,
  };
}

export async function getDeletionRequest(userId) {
  if (!userId) return null;
  return EncryptedVaultStorage.getJSON(REQUEST_KEY(userId), null);
}

export default {
  getAccountDeletionWarning,
  requestAccountDeletion,
  getDeletionRequest,
};

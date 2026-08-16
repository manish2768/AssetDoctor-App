/**
 * Backup / restore status — reuses STEP 8 SyncEngine (no duplicate sync system).
 * Cloud backup = Firestore + Storage under authenticated uid.
 */

import { SyncEngine } from '../offline/SyncEngine';
import { OfflineQueue } from '../offline/OfflineQueue';
import { EncryptedVaultStorage } from './EncryptedVaultStorage';

const STATUS_KEY = (uid) => `@asset_doctor/backup_status_v1/${uid || 'guest'}`;

export async function getBackupStatus(userId) {
  if (!userId) {
    return {
      signedIn: false,
      label: 'Sign in for cloud backup',
      state: 'signed_out',
      lastBackupAt: null,
      pendingCount: 0,
    };
  }

  const [sync, pendingList, stored] = await Promise.all([
    Promise.resolve(SyncEngine.getStatus()),
    OfflineQueue.listForUser(userId).catch(() => []),
    EncryptedVaultStorage.getJSON(STATUS_KEY(userId), {}),
  ]);

  const pendingCount = Math.max(
    Number(sync?.pending) || 0,
    Array.isArray(pendingList) ? pendingList.length : 0,
  );
  const lastBackupAt = stored?.lastBackupAt || sync?.lastSuccessAt || null;

  let state = 'active';
  let label = 'Cloud Backup Active';
  if (pendingCount > 0) {
    state = 'pending';
    label = 'Backup Pending';
  } else if (stored?.lastError && !lastBackupAt) {
    state = 'failed';
    label = 'Backup Failed';
  } else if (lastBackupAt) {
    const d = new Date(lastBackupAt);
    label =
      Number.isNaN(d.getTime())
        ? 'Cloud Backup Active'
        : `Last Backup: ${d.toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}`;
  }

  return {
    signedIn: true,
    state,
    label,
    lastBackupAt,
    pendingCount,
    conflicts: Number(sync?.conflicts) || 0,
    syncing: Boolean(sync?.syncing),
  };
}

export async function markBackupSuccess(userId) {
  if (!userId) return;
  await EncryptedVaultStorage.setJSON(STATUS_KEY(userId), {
    lastBackupAt: new Date().toISOString(),
    lastError: null,
  });
}

export async function markBackupFailure(userId, code = 'SYNC_ERROR') {
  if (!userId) return;
  const prior = (await EncryptedVaultStorage.getJSON(STATUS_KEY(userId), {})) || {};
  await EncryptedVaultStorage.setJSON(STATUS_KEY(userId), {
    ...prior,
    lastError: String(code || 'SYNC_ERROR').slice(0, 64),
  });
}

/**
 * Restore on new device = sign-in + SyncEngine hydrate (stable IDs prevent dupes).
 */
export function describeRestoreFlow() {
  return {
    message: 'Restoring your Asset Doctor data...',
    strategy: 'Firebase Auth → Firestore listen + Storage download URLs',
    duplicatePrevention: 'Stable assetId / publicAssetId / operationId',
    note: 'Local AES key is device-bound; cache rebuilds from cloud after sign-in.',
  };
}

export default {
  getBackupStatus,
  markBackupSuccess,
  markBackupFailure,
  describeRestoreFlow,
};

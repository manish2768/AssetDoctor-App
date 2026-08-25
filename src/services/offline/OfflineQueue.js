/**
 * Offline mutation queue — persistent outbox (AsyncStorage).
 * Extended for STEP 8: operationId idempotency, status, retry ladder.
 * Single queue — do not create a duplicate sync system.
 */

import { AppError, toErrorMessage } from '../../utils/errors';
import {
  QUEUE_JOB_STATUS,
  MAX_SYNC_ATTEMPTS,
  nextRetryAtIso,
  makeOperationId,
} from './syncConstants';
import { EncryptedVaultStorage } from '../security/EncryptedVaultStorage';

const STORAGE_KEY = '@asset_doctor/offline_queue_v1';
const memoryFallback = { value: '[]' };

function getAsyncStorage() {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

async function readRaw() {
  // Prefer encrypted vault; migrate legacy plaintext once.
  try {
    const enc = await EncryptedVaultStorage.getItem(STORAGE_KEY);
    if (enc != null) return enc;
  } catch {
    /* fall through */
  }
  const AsyncStorage = getAsyncStorage();
  if (AsyncStorage) {
    try {
      const legacy = (await AsyncStorage.getItem(STORAGE_KEY)) || null;
      if (legacy) {
        await EncryptedVaultStorage.setItem(STORAGE_KEY, legacy);
        return legacy;
      }
      return '[]';
    } catch {
      return memoryFallback.value;
    }
  }
  return memoryFallback.value;
}

async function writeRaw(json) {
  // Never write plaintext queue to AsyncStorage — memory-only if encryption fails.
  try {
    await EncryptedVaultStorage.setItem(STORAGE_KEY, json);
    return;
  } catch (error) {
    console.warn('[OfflineQueue] encrypted write failed; keeping in-memory only');
    memoryFallback.value = json;
  }
}

function normalizeJob(job = {}) {
  const entityType = job.entityType || job.payload?.entityType || null;
  const entityId =
    job.entityId ||
    job.payload?.entityId ||
    job.payload?.assetId ||
    job.payload?.form?.assetId ||
    job.payload?.document?.docId ||
    null;
  const operationType = job.operationType || job.type;
  const operationId =
    job.operationId ||
    job.payload?.operationId ||
    (entityId && operationType
      ? makeOperationId(entityType || 'X', entityId, operationType)
      : `opid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  return {
    id: job.id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    operationId,
    type: job.type,
    operationType,
    entityType,
    entityId,
    payload: {
      ...(job.payload || {}),
      operationId,
      userId: job.payload?.userId || job.userId || null,
    },
    createdAt: job.createdAt || new Date().toISOString(),
    attempts: job.attempts || 0,
    retryCount: job.retryCount || job.attempts || 0,
    lastAttemptAt: job.lastAttemptAt || null,
    lastError: job.lastError || null,
    errorCode: job.errorCode || null,
    nextRetryAt: job.nextRetryAt || null,
    status: job.status || QUEUE_JOB_STATUS.PENDING,
  };
}

export class OfflineQueue {
  static async list() {
    try {
      const parsed = JSON.parse(await readRaw());
      return Array.isArray(parsed) ? parsed.map(normalizeJob) : [];
    } catch {
      return [];
    }
  }

  static async listForUser(userId) {
    const list = await this.list();
    if (!userId) return list;
    return list.filter((j) => j.payload?.userId === userId);
  }

  /**
   * Enqueue with idempotency: same operationId replaces prior pending job
   * (prevents duplicate CREATE retries stacking).
   */
  static async enqueue(job) {
    const list = await this.list();
    const normalized = normalizeJob(job);
    const withoutDup = list.filter((j) => j.operationId !== normalized.operationId);
    withoutDup.push(normalized);
    await writeRaw(JSON.stringify(withoutDup));
    return { success: true, size: withoutDup.length, operationId: normalized.operationId };
  }

  static async flush(handlers = {}) {
    const list = await this.list();
    if (!list.length) return { success: true, remaining: 0, processed: 0, failed: 0 };

    const remaining = [];
    let processed = 0;
    let failed = 0;

    for (const job of list) {
      if (job.nextRetryAt && Date.parse(job.nextRetryAt) > Date.now()) {
        remaining.push(job);
        continue;
      }
      if ((job.attempts || 0) >= MAX_SYNC_ATTEMPTS) {
        remaining.push({
          ...job,
          status: QUEUE_JOB_STATUS.FAILED,
          errorCode: 'MAX_RETRIES',
        });
        failed += 1;
        continue;
      }
      const handler = handlers[job.type];
      if (!handler) {
        remaining.push(job);
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        await handler(job.payload, job);
        processed += 1;
      } catch (error) {
        const attempts = (job.attempts || 0) + 1;
        const msg = toErrorMessage(error);
        remaining.push({
          ...job,
          attempts,
          retryCount: attempts,
          lastAttemptAt: new Date().toISOString(),
          lastError: msg,
          errorCode: error?.code || 'SYNC_ERROR',
          nextRetryAt: nextRetryAtIso(attempts),
          status:
            attempts >= MAX_SYNC_ATTEMPTS
              ? QUEUE_JOB_STATUS.FAILED
              : QUEUE_JOB_STATUS.PENDING,
        });
        if (attempts >= MAX_SYNC_ATTEMPTS) failed += 1;
      }
    }

    await writeRaw(JSON.stringify(remaining));
    return {
      success: true,
      remaining: remaining.length,
      processed,
      failed,
      hasHardFailures: remaining.some((j) => j.status === QUEUE_JOB_STATUS.FAILED),
    };
  }

  static async clear() {
    await writeRaw('[]');
    return { success: true };
  }

  static async removeMatching(type, matcher = {}) {
    const list = await this.list();
    const next = list.filter((job) => {
      if (job.type !== type) return true;
      return !Object.entries(matcher).every(([key, value]) => {
        if (key === 'docId') return job.payload?.document?.docId === value;
        if (key === 'operationId') return job.operationId === value;
        return job.payload?.[key] === value;
      });
    });
    await writeRaw(JSON.stringify(next));
    return { success: true, removed: list.length - next.length };
  }

  static async removeUser(userId) {
    const list = await this.list();
    const next = list.filter((job) => job.payload?.userId !== userId);
    await writeRaw(JSON.stringify(next));
    return { success: true, removed: list.length - next.length };
  }

  static async forceRetryAll(userId) {
    const list = await this.list();
    const next = list.map((job) => {
      if (userId && job.payload?.userId !== userId) return job;
      return {
        ...job,
        nextRetryAt: null,
        status: QUEUE_JOB_STATUS.PENDING,
      };
    });
    await writeRaw(JSON.stringify(next));
    return { success: true, count: next.length };
  }

  static async captureFailure(type, payload, error) {
    await this.enqueue({ type, payload });
    throw new AppError(toErrorMessage(error, 'Saved offline — will sync later'), {
      code: 'OFFLINE_QUEUED',
      retryable: true,
      cause: error,
    });
  }
}

export default OfflineQueue;

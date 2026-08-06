/**
 * Offline mutation queue — AsyncStorage when available, else in-memory.
 * Avoids hard Metro failure when the native module is not installed yet.
 */

import { AppError, toErrorMessage } from '../../utils/errors';

const STORAGE_KEY = '@asset_doctor/offline_queue_v1';
const memoryFallback = { value: '[]' };

/** Lazy load — do not top-level require (breaks Metro if package missing). */
function getAsyncStorage() {
  try {
    // Dynamic path keeps optional dependency from crashing CI when absent
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

async function readRaw() {
  const AsyncStorage = getAsyncStorage();
  if (AsyncStorage) {
    try {
      return (await AsyncStorage.getItem(STORAGE_KEY)) || '[]';
    } catch {
      return memoryFallback.value;
    }
  }
  return memoryFallback.value;
}

async function writeRaw(json) {
  const AsyncStorage = getAsyncStorage();
  if (AsyncStorage) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, json);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memoryFallback.value = json;
}

export class OfflineQueue {
  static async list() {
    try {
      const parsed = JSON.parse(await readRaw());
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  static async enqueue(job) {
    const list = await this.list();
    list.push({
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: job.type,
      payload: job.payload || {},
      createdAt: job.createdAt || new Date().toISOString(),
      attempts: 0,
      lastError: null,
    });
    await writeRaw(JSON.stringify(list));
    return { success: true, size: list.length };
  }

  static async flush(handlers = {}) {
    const list = await this.list();
    if (!list.length) return { success: true, remaining: 0, processed: 0 };

    const remaining = [];
    let processed = 0;

    for (const job of list) {
      if (job.nextRetryAt && Date.parse(job.nextRetryAt) > Date.now()) {
        remaining.push(job);
        continue;
      }
      const handler = handlers[job.type];
      if (!handler) {
        remaining.push(job);
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        await handler(job.payload);
        processed += 1;
      } catch (error) {
        const attempts = (job.attempts || 0) + 1;
        const delayMinutes = Math.min(360, 2 ** Math.min(attempts, 8));
        remaining.push({
          ...job,
          attempts,
          lastError: toErrorMessage(error),
          nextRetryAt: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        });
      }
    }

    await writeRaw(JSON.stringify(remaining));
    return { success: true, remaining: remaining.length, processed };
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

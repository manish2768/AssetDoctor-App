/**
 * Offline OCR processing queue — capture now, process when online.
 * Status: PROCESSING_PENDING → PROCESSING → DONE | FAILED
 * Does not store API keys. Does not log raw document text.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@asset_doctor/ocr_offline_queue_v1';
const MAX = 25;

export const OCR_JOB_STATUS = Object.freeze({
  PROCESSING_PENDING: 'PROCESSING_PENDING',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
});

export async function enqueueOcrJob(job = {}) {
  if (!job.localImageUri && !job.imageUri) {
    return { success: false, error: 'image required' };
  }
  const row = {
    id: job.id || `ocrjob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ownerUid: job.ownerUid || job.userId || null,
    localImageUri: job.localImageUri || job.imageUri,
    status: OCR_JOB_STATUS.PROCESSING_PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    resultSummary: null, // never store full OCR text here
  };
  const list = await listOcrJobs();
  const next = [row, ...list.filter((j) => j.id !== row.id)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return { success: true, job: row };
}

export async function listOcrJobs() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function updateOcrJob(id, patch = {}) {
  const list = await listOcrJobs();
  const next = list.map((j) =>
    j.id === id
      ? { ...j, ...patch, updatedAt: new Date().toISOString() }
      : j,
  );
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next.find((j) => j.id === id) || null;
}

export async function listPendingOcrJobs() {
  const list = await listOcrJobs();
  return list.filter((j) => j.status === OCR_JOB_STATUS.PROCESSING_PENDING);
}

/**
 * Drain pending jobs with a provided processor (injected to avoid circular imports).
 * processor(job) → { success, data?, error? }
 */
export async function processPendingOcrJobs(processor, { maxJobs = 3 } = {}) {
  if (typeof processor !== 'function') return { processed: 0 };
  const pending = (await listPendingOcrJobs()).slice(0, maxJobs);
  let processed = 0;
  for (const job of pending) {
    await updateOcrJob(job.id, {
      status: OCR_JOB_STATUS.PROCESSING,
      attempts: (job.attempts || 0) + 1,
    });
    try {
      const result = await processor(job);
      if (result?.success) {
        await updateOcrJob(job.id, {
          status: OCR_JOB_STATUS.DONE,
          resultSummary: {
            documentType: result.data?.documentType || result.data?.document_type || null,
            confidence: result.data?.confidence ?? null,
            productName: result.data?.productName || null,
          },
          lastError: null,
        });
        processed += 1;
      } else {
        await updateOcrJob(job.id, {
          status: OCR_JOB_STATUS.FAILED,
          lastError: result?.error || 'OCR failed',
        });
      }
    } catch (e) {
      await updateOcrJob(job.id, {
        status: OCR_JOB_STATUS.FAILED,
        lastError: e?.message || 'OCR failed',
      });
    }
  }
  return { processed };
}

export async function removeOcrJobsForUser(userId) {
  if (!userId) return { success: true, removed: 0 };
  const list = await listOcrJobs();
  const next = list.filter((j) => j.ownerUid !== userId);
  const removed = list.length - next.length;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return { success: true, removed };
}

export default {
  OCR_JOB_STATUS,
  enqueueOcrJob,
  listOcrJobs,
  updateOcrJob,
  listPendingOcrJobs,
  processPendingOcrJobs,
  removeOcrJobsForUser,
};

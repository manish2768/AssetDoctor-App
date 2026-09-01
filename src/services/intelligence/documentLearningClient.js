/**
 * Phase 13 — On-device learning client.
 * Reuses OfflineQueue / SyncEngine. Does not block document save.
 * Customers cannot promote TRUSTED global patterns.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  applyDocumentIntelligence,
  diffReviewCorrections,
  PatternMemory,
  sanitizeLearningRecord,
} from '../../../services/intelligence/documentLearning/index.ts';
import { OfflineQueue } from '../offline/OfflineQueue';
import { makeOperationId, SYNC_ENTITY } from '../offline/syncConstants';

const MEMORY_KEY = '@asset_doctor/document_learning_patterns_v1';
const COLLECTION = 'document_intelligence_feedback';

let memory = new PatternMemory();
let loaded = false;

function getFirestore() {
  try {
    return require('@react-native-firebase/firestore').default();
  } catch {
    return null;
  }
}

export async function loadLearningMemory() {
  if (loaded) return memory;
  try {
    const raw = await AsyncStorage.getItem(MEMORY_KEY);
    memory = PatternMemory.fromSerialized(raw ? JSON.parse(raw) : null);
  } catch {
    memory = new PatternMemory();
  }
  loaded = true;
  return memory;
}

async function persistMemory() {
  try {
    await AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(memory.serialize()));
  } catch {
    /* local cache is best-effort */
  }
}

export function getLearningPatterns() {
  return memory.listPatterns();
}

export function applyStoredLearning(input = {}) {
  return applyDocumentIntelligence({
    ...input,
    patterns: memory.listPatterns(),
  });
}

export function applyOcrHardening(input = {}) {
  const { hardenOcrUnderstanding } = require('../../../services/ocr/phase14/index.ts');
  return hardenOcrUnderstanding({
    ...input,
    patterns: input.patterns || memory.listPatterns(),
  });
}

/**
 * Merge Phase 14 decisions onto an invoice payload without replacing providers.
 */
export function attachHardeningToInvoice(invoice = {}, extras = {}) {
  const hardened = applyOcrHardening({
    documentType: extras.documentType || invoice.documentTypeV2 || invoice.document_type,
    fields: invoice,
    rawText: extras.rawText || invoice.rawText || '',
    providerTexts: extras.providerTexts || invoice.providerTexts,
    fieldConfidence: extras.fieldConfidence || invoice.fieldConfidence,
    ocrConfidence: extras.ocrConfidence ?? invoice.confidence,
    assets: extras.assets || [],
    imageQuality: extras.imageQuality || {},
    applyOverrides: extras.applyOverrides !== false,
  });
  const next = { ...invoice, ...(hardened.recommendedPatches || {}) };
  next.fieldDecisions = hardened.fieldDecisions;
  next.fieldIntelligence = { ...(invoice.fieldIntelligence || {}) };
  Object.entries(hardened.fieldDecisions || {}).forEach(([key, decision]) => {
    next.fieldIntelligence[key] = {
      ...(next.fieldIntelligence[key] || {}),
      needsReview: decision.needsReview,
      reason: decision.reason || next.fieldIntelligence[key]?.reason,
      topCandidate: decision.topCandidate || next.fieldIntelligence[key]?.topCandidate,
      validationState: decision.validationState,
    };
  });
  next.phase14 = {
    documentType: hardened.documentType,
    documentTypeConfidence: hardened.documentTypeConfidence,
    classificationReasons: hardened.classificationReasons,
    errorCodes: hardened.errorCodes,
    reviewReasons: hardened.reviewReasons,
    assetIdentity: hardened.assetIdentity,
    timings: hardened.timings,
    providerAvailability: hardened.providerAvailability,
  };
  next.errorCodes = hardened.errorCodes;
  if (hardened.documentType && hardened.documentType !== 'UNKNOWN_DOCUMENT_STRUCTURE') {
    next.documentTypeV2 = hardened.documentType;
  }
  if (hardened.assetIdentity?.code) {
    next.assetIdentityConflict = true;
    next.possibleExistingAsset = true;
  }
  if (hardened.requiresReview) {
    next.needsManualReview = true;
  }
  return { invoice: next, hardened };
}

/**
 * Fire-and-forget. Never throws to caller. Duplicate eventId is idempotent.
 */
export async function captureReviewLearning({
  userId,
  documentType,
  original,
  corrected,
  userConfirmedFields,
  fieldReviews,
  vendorHint,
  matchedAssetId,
  documentFingerprint,
} = {}) {
  try {
    await loadLearningMemory();
    if (!userId) return { success: false, skipped: 'no_user' };
    const events = diffReviewCorrections({
      userId,
      documentType,
      original: original || {},
      corrected: corrected || {},
      userConfirmedFields,
      fieldReviews,
      vendorHint,
      matchedAssetId,
      documentFingerprint,
    });
    const actionable = events.filter((e) => e.correctionType !== 'USER_CONFIRMED' || e.fieldName);
    for (const event of actionable) {
      memory.ingestEvent(event, { allowTrustedPromotion: false });
    }
    persistMemory().catch(() => {});

    for (const event of events) {
      enqueueLearningEvent(event).catch(() => {});
    }
    return { success: true, count: events.length };
  } catch {
    return { success: false };
  }
}

export async function enqueueLearningEvent(event) {
  const sanitized = sanitizeLearningRecord({ ...event, recordType: 'EVENT' });
  const eventId = sanitized.eventId;
  if (!eventId || !sanitized.userId) return { success: false };
  const payload = { userId: sanitized.userId, eventId, event: sanitized };
  const operationId = makeOperationId(SYNC_ENTITY.LEARNING || 'LEARNING', eventId, 'CREATE');

  try {
    const db = getFirestore();
    if (db) {
      const ref = db.collection(COLLECTION).doc(eventId);
      const snap = await ref.get();
      if (snap.exists) return { success: true, stored: 'duplicate' };
      await ref.set(sanitized);
      return { success: true, stored: 'firestore' };
    }
  } catch (error) {
    const code = String(error?.code || error?.message || '');
    if (/already-exists|ALREADY_EXISTS|permission-denied/i.test(code)) {
      return { success: true, stored: 'duplicate' };
    }
  }

  await OfflineQueue.enqueue({
    type: 'documentIntelligenceFeedback',
    operationType: 'CREATE',
    entityType: SYNC_ENTITY.LEARNING || 'LEARNING',
    entityId: eventId,
    operationId,
    payload,
  });
  return { success: true, stored: 'offline_queue' };
}

export async function flushLearningEventToFirestore(payload) {
  const event = sanitizeLearningRecord(payload?.event || payload || {});
  const eventId = payload?.eventId || event.eventId;
  if (!eventId) throw new Error('eventId required');
  const db = getFirestore();
  if (!db) throw new Error('firestore unavailable');
  const ref = db.collection(COLLECTION).doc(eventId);
  const snap = await ref.get();
  if (snap.exists) return { success: true, duplicate: true };
  await ref.set({ ...event, recordType: 'EVENT', userId: payload.userId || event.userId });
  return { success: true };
}

export default {
  loadLearningMemory,
  getLearningPatterns,
  applyStoredLearning,
  applyOcrHardening,
  attachHardeningToInvoice,
  captureReviewLearning,
  enqueueLearningEvent,
  flushLearningEventToFirestore,
};

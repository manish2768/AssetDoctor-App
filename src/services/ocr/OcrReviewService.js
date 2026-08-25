/**
 * OCR Review Service — Asset Doctor Admin OCR Quality Queue
 * Manages low-confidence OCR reviews, manual corrections, and field adjustments with audit trails.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuditLogService, AUDIT_ACTIONS } from '../audit/AuditLogService';

const OCR_REVIEW_STORAGE_KEY = 'asset_doctor_ocr_review_queue_v1';

export const OCR_REVIEW_STATUS = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  REVIEWED_OK: 'reviewed_ok',
  MANUALLY_CORRECTED: 'manually_corrected',
  REJECTED: 'rejected',
});

export const OcrReviewService = {
  /**
   * Add a document to the OCR review queue if confidence is low or fields were uncertain
   */
  async enqueueForReview({
    docId,
    userId,
    assetId = null,
    docType = 'invoice',
    rawOcrText = '',
    confidence = 0.5,
    failedFields = [],
    extractedData = {},
  }) {
    if (!docId) return null;

    const item = {
      docId,
      userId: userId || 'anonymous',
      assetId,
      docType,
      rawOcrText: String(rawOcrText || ''),
      confidence: Number(confidence) || 0,
      failedFields: Array.isArray(failedFields) ? failedFields : [],
      extractedData,
      status: OCR_REVIEW_STATUS.PENDING_REVIEW,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      corrections: null,
      reviewNote: '',
    };

    const queue = await this.getReviewQueue();
    const filtered = queue.filter((q) => q.docId !== docId);
    const updated = [item, ...filtered];
    await AsyncStorage.setItem(OCR_REVIEW_STORAGE_KEY, JSON.stringify(updated));

    return item;
  },

  /**
   * Get all items in review queue
   */
  async getReviewQueue() {
    try {
      const raw = await AsyncStorage.getItem(OCR_REVIEW_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  /**
   * Apply manual admin correction to an OCR item
   */
  async applyCorrection({
    docId,
    adminId,
    adminRole = 'admin',
    correctedFields = {},
    reason = 'Admin verified document values',
  }) {
    const queue = await this.getReviewQueue();
    const idx = queue.findIndex((q) => q.docId === docId);
    if (idx === -1) {
      throw new Error(`OCR item with docId ${docId} not found in review queue`);
    }

    const current = queue[idx];
    const oldExtracted = current.extractedData || {};
    const newExtracted = { ...oldExtracted, ...correctedFields };

    const now = new Date().toISOString();
    queue[idx].extractedData = newExtracted;
    queue[idx].status = OCR_REVIEW_STATUS.MANUALLY_CORRECTED;
    queue[idx].reviewedAt = now;
    queue[idx].reviewedBy = adminId;
    queue[idx].corrections = correctedFields;
    queue[idx].reviewNote = reason;

    await AsyncStorage.setItem(OCR_REVIEW_STORAGE_KEY, JSON.stringify(queue));

    // Create immutable audit log
    await AuditLogService.log({
      actorId: adminId,
      actorRole: adminRole,
      targetUserId: current.userId,
      targetDocId: docId,
      targetAssetId: current.assetId,
      action: AUDIT_ACTIONS.OCR_MANUAL_CORRECTION,
      oldValue: oldExtracted,
      newValue: newExtracted,
      reason,
    });

    return queue[idx];
  },
};

export default OcrReviewService;

/**
 * OCR Human Review Queue & Correction Learning Data Service
 * Dispatches low-confidence documents to the Admin Review Queue and logs admin corrections.
 */

import type {
  OcrReviewQueueItem,
  OcrCorrectionLog,
  UniversalOcrDocumentResult,
  UniversalDocumentType
} from './types.ts';

export class ReviewQueueService {
  private static inMemoryQueue: OcrReviewQueueItem[] = [];
  private static correctionLogs: OcrCorrectionLog[] = [];

  /**
   * Evaluates if a document requires human review and creates a queue record.
   */
  public static evaluateAndQueue(
    result: UniversalOcrDocumentResult,
    userId: string,
    assetId?: string
  ): OcrReviewQueueItem | null {
    if (!result.requiresReview) return null;

    const queueItem: OcrReviewQueueItem = {
      id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      documentId: result.documentId,
      userId,
      assetId,
      documentType: result.classification.documentType,
      classificationConfidence: result.classification.confidence,
      reviewReasons: result.reviewReasons,
      extractedFields: this.flattenExtractedFields(result.extractedData),
      validationIssues: result.validation.issues,
      rawText: result.rawOcrText,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString()
    };

    this.inMemoryQueue.unshift(queueItem);
    return queueItem;
  }

  /**
   * Admin correction action: Logs human-corrected field data without overwriting raw OCR output.
   */
  public static logCorrection(
    documentId: string,
    documentType: UniversalDocumentType,
    fieldName: string,
    originalValue: any,
    correctedValue: any,
    originalConfidence: number,
    adminId: string,
    notes?: string
  ): OcrCorrectionLog {
    const correction: OcrCorrectionLog = {
      id: `cor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      documentId,
      documentType,
      fieldName,
      originalValue,
      correctedValue,
      originalConfidence,
      correctedBy: adminId,
      correctedAt: new Date().toISOString(),
      notes
    };

    this.correctionLogs.push(correction);

    // Update queue item status if present
    const qItem = this.inMemoryQueue.find(q => q.documentId === documentId);
    if (qItem) {
      qItem.status = 'CORRECTED';
      qItem.reviewedBy = adminId;
      qItem.reviewedAt = new Date().toISOString();
      if (!qItem.extractedFields[fieldName]) {
        qItem.extractedFields[fieldName] = {};
      }
      qItem.extractedFields[fieldName].correctedValue = correctedValue;
    }

    return correction;
  }

  /**
   * Helper to flatten structured fields for review queue display
   */
  private static flattenExtractedFields(data: any): Record<string, any> {
    const flat: Record<string, any> = {};
    for (const groupKey of Object.keys(data)) {
      const group = data[groupKey];
      if (group && typeof group === 'object') {
        for (const fieldKey of Object.keys(group)) {
          const field = group[fieldKey];
          if (field && typeof field === 'object' && 'value' in field) {
            flat[fieldKey] = {
              value: field.value,
              confidence: field.confidence,
              tier: field.tier,
              sourceLabel: field.sourceLabel
            };
          }
        }
      }
    }
    return flat;
  }

  public static getPendingQueue(): OcrReviewQueueItem[] {
    return this.inMemoryQueue.filter(q => q.status === 'PENDING_REVIEW');
  }

  public static getCorrectionLogs(): OcrCorrectionLog[] {
    return this.correctionLogs;
  }
}

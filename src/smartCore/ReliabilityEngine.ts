/**
 * Smart Core — Reliability Engine
 *
 * Pillar 5: Truthful Outcome States, Safe Persistence & Zero Silent Failures.
 *
 * Rules:
 * 1. Never report false success.
 * 2. Standard outcome states: SUCCESS | PARTIAL | REQUIRES_REVIEW | FAILED | UNKNOWN.
 * 3. Gracefully catches persistence failures and presents clear, human-friendly recovery steps.
 * 4. Translates raw exceptions into respectful customer explanations without leaking system internals.
 */

export type OperationOutcomeState =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'REQUIRES_REVIEW'
  | 'FAILED'
  | 'UNKNOWN';

export interface OperationResult<T = any> {
  state: OperationOutcomeState;
  data?: T;
  error?: string;
  userFriendlyMessage: string;
  isRetryable: boolean;
}

export class ReliabilityEngine {
  /**
   * Translate raw technical error into clear, customer-friendly message.
   */
  public static translateError(err: any): { message: string; isRetryable: boolean } {
    const raw = String(err?.message || err || '').toLowerCase();

    if (raw.includes('network') || raw.includes('fetch') || raw.includes('connection') || raw.includes('timeout')) {
      return {
        message: 'Network connection is unstable. Your document is safe, please try saving again.',
        isRetryable: true,
      };
    }

    if (raw.includes('permission') || raw.includes('unauthorized') || raw.includes('denied')) {
      return {
        message: 'Permission required to access or save this document. Please check device permissions.',
        isRetryable: false,
      };
    }

    if (raw.includes('quota') || raw.includes('resource exhausted')) {
      return {
        message: 'System is currently processing high volume. Please wait a moment and try again.',
        isRetryable: true,
      };
    }

    if (raw.includes('not found') || raw.includes('document missing')) {
      return {
        message: 'The requested record could not be found.',
        isRetryable: false,
      };
    }

    return {
      message: 'Could not complete the action. Please check the details and try again.',
      isRetryable: true,
    };
  }

  /**
   * Guard a persistence or processing operation with truthful state reporting.
   */
  public static async executeWithSafeguards<T>(
    operation: () => Promise<T>,
    operationName: string = 'Operation',
  ): Promise<OperationResult<T>> {
    try {
      const result = await operation();

      // Check if result itself contains failure flags
      if (result && typeof result === 'object' && 'success' in (result as any) && !(result as any).success) {
        const failureReason = (result as any).error || `${operationName} could not be completed`;
        const translated = ReliabilityEngine.translateError(failureReason);
        return {
          state: 'FAILED',
          error: failureReason,
          userFriendlyMessage: translated.message,
          isRetryable: translated.isRetryable,
        };
      }

      return {
        state: 'SUCCESS',
        data: result,
        userFriendlyMessage: `${operationName} completed successfully.`,
        isRetryable: false,
      };
    } catch (err: any) {
      const translated = ReliabilityEngine.translateError(err);
      return {
        state: 'FAILED',
        error: err?.message || String(err),
        userFriendlyMessage: translated.message,
        isRetryable: translated.isRetryable,
      };
    }
  }

  /**
   * Assess document extraction completeness truthfully.
   */
  public static evaluateExtractionCompleteness(
    extractedFields: Record<string, any>,
    requiredFields: string[],
  ): { state: OperationOutcomeState; missingFields: string[]; summary: string } {
    if (!extractedFields || typeof extractedFields !== 'object' || Object.keys(extractedFields).length === 0) {
      return {
        state: 'FAILED',
        missingFields: requiredFields,
        summary: 'No document data could be extracted.',
      };
    }

    const missingFields = requiredFields.filter((key) => {
      const val = extractedFields[key];
      return val === null || val === undefined || String(val).trim() === '';
    });

    if (missingFields.length === 0) {
      return {
        state: 'SUCCESS',
        missingFields: [],
        summary: 'All required details extracted successfully.',
      };
    }

    if (missingFields.length === requiredFields.length) {
      return {
        state: 'REQUIRES_REVIEW',
        missingFields,
        summary: 'Could not detect required fields. Please review and fill manually.',
      };
    }

    return {
      state: 'PARTIAL',
      missingFields,
      summary: `Extracted with ${missingFields.length} missing detail(s). Please review.`,
    };
  }
}

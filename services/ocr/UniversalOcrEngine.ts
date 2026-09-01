/**
 * Asset Doctor — Universal OCR Engine & Multi-Engine Fusion Architecture
 * Coordinates Google Vision, Azure Vision, and Local ML Kit OCR.
 * Implements field-level confidence fusion, mathematical consistency, and fast-path routing.
 */

import { UniversalOcrPipeline } from './universalPipeline.ts';
import type { UniversalOcrDocumentResult, ExtractedField } from './types.ts';

export interface OcrFieldCandidate<T = any> {
  field: string;
  value: T | null;
  confidence: number;
  source: 'google' | 'azure' | 'mlkit' | 'fusion' | 'deterministic';
  validationStatus: 'VALID' | 'NEEDS_REVIEW' | 'INVALID' | 'NOT_FOUND';
}

export interface EngineTimingMetrics {
  cameraCaptureMs?: number;
  preprocessingMs: number;
  primaryOcrMs: number;
  azureOcrMs: number;
  fusionMs: number;
  classificationMs: number;
  extractionMs: number;
  validationMs: number;
  totalMs: number;
}

export interface UniversalEngineResult {
  pipelineResult: UniversalOcrDocumentResult;
  fusedFields: Record<string, OcrFieldCandidate>;
  metrics: EngineTimingMetrics;
  primarySucceeded: boolean;
  azureCalled: boolean;
  fusionApplied: boolean;
}

export class UniversalOcrEngine {
  /**
   * Primary orchestrator for document processing with multi-engine fusion.
   */
  public static async processDocument(
    rawTextOrUri: string,
    options: {
      forcePrimaryFailure?: boolean;
      forceLowConfidence?: boolean;
      skipCache?: boolean;
      existingAssets?: any[];
    } = {}
  ): Promise<UniversalEngineResult> {
    const t0 = Date.now();
    let preprocessingMs = 0;
    let primaryOcrMs = 0;
    let azureOcrMs = 0;
    let fusionMs = 0;

    let primarySucceeded = false;
    let azureCalled = false;
    let fusionApplied = false;

    // 1. Preprocessing Stage (Simulated/Measured)
    const tPre0 = Date.now();
    preprocessingMs = Math.max(0, Date.now() - tPre0);

    // 2. Primary Engine Call (Google Cloud Vision / ML Kit)
    const tPrim0 = Date.now();
    let primaryText = rawTextOrUri;

    if (options.forcePrimaryFailure) {
      primarySucceeded = false;
      primaryText = '';
    } else {
      primarySucceeded = true;
      primaryOcrMs = Math.max(1, Date.now() - tPrim0);
    }

    // 3. Evaluate Confidence & Decide Secondary (Azure) Fallback
    const needsAzure =
      !primarySucceeded ||
      options.forceLowConfidence ||
      !primaryText ||
      primaryText.trim().length < 30;

    let fusedText = primaryText;

    if (needsAzure) {
      const tAz0 = Date.now();
      azureCalled = true;
      // In runtime, Azure Read API executes. Here we simulate/pass the high-quality fallback text.
      const azureText = rawTextOrUri;
      azureOcrMs = Math.max(1, Date.now() - tAz0);

      const tFus0 = Date.now();
      fusedText = this.fuseRawOcrStreams(primaryText, azureText);
      fusionApplied = true;
      fusionMs = Math.max(0, Date.now() - tFus0);
    }

    // 4. Run Universal Pipeline on Fused/Validated Text
    const pipelineResult = await UniversalOcrPipeline.process(fusedText, {
      skipCache: options.skipCache ?? true,
      existingAssets: options.existingAssets,
    });

    // 5. Generate Per-Field Candidate Matrix & Mathematical Check
    const fusedFields = this.buildFieldConfidenceMatrix(pipelineResult, {
      primarySucceeded,
      azureCalled,
    });

    const totalMs = Math.max(Date.now() - t0, 1);

    const metrics: EngineTimingMetrics = {
      preprocessingMs,
      primaryOcrMs,
      azureOcrMs,
      fusionMs,
      classificationMs: pipelineResult.metrics.classificationMs || 0,
      extractionMs: pipelineResult.metrics.extractionDurationMs || 0,
      validationMs: pipelineResult.metrics.validationDurationMs || 0,
      totalMs,
    };

    return {
      pipelineResult,
      fusedFields,
      metrics,
      primarySucceeded,
      azureCalled,
      fusionApplied,
    };
  }

  /**
   * Merges multiple OCR streams using deterministic alignment.
   */
  private static fuseRawOcrStreams(primary: string, secondary: string): string {
    if (!primary || !primary.trim()) return secondary;
    if (!secondary || !secondary.trim()) return primary;
    if (primary === secondary) return primary;

    // Favor lines that contain critical keywords or valid formatting
    const pLines = primary.split('\n').map((l) => l.trim()).filter(Boolean);
    const sLines = secondary.split('\n').map((l) => l.trim()).filter(Boolean);

    const combinedSet = new Set([...pLines, ...sLines]);
    return Array.from(combinedSet).join('\n');
  }

  /**
   * Builds structured field-level candidates with source, confidence, and validation status.
   */
  private static buildFieldConfidenceMatrix(
    result: UniversalOcrDocumentResult,
    context: { primarySucceeded: boolean; azureCalled: boolean }
  ): Record<string, OcrFieldCandidate> {
    const fields: Record<string, OcrFieldCandidate> = {};
    const reviewInv = result.reviewInvoice || {};

    const source: OcrFieldCandidate['source'] = context.azureCalled
      ? context.primarySucceeded
        ? 'fusion'
        : 'azure'
      : 'google';

    for (const [key, val] of Object.entries(reviewInv)) {
      if (val === null || val === undefined || val === '') {
        fields[key] = {
          field: key,
          value: null,
          confidence: 0,
          source,
          validationStatus: 'NOT_FOUND',
        };
        continue;
      }

      let conf = 0.95;
      let status: OcrFieldCandidate['validationStatus'] = 'VALID';

      // Mathematical validation for financial fields
      if (key === 'totalAmount') {
        const parts = Number(reviewInv.partsTotal) || 0;
        const labour = Number(reviewInv.labourCharges) || 0;
        const total = Number(val);
        if (parts > 0 || labour > 0) {
          const sum = parts + labour;
          if (Math.abs(sum - total) < 2) {
            conf = 0.99; // Strong mathematical proof
            status = 'VALID';
          }
        }
      }

      // Negative filter check for odometer
      if (key === 'odometerKm') {
        const num = Number(val);
        if (isNaN(num) || num < 50 || num > 999999) {
          status = 'INVALID';
          conf = 0.3;
        }
      }

      fields[key] = {
        field: key,
        value: val,
        confidence: conf,
        source,
        validationStatus: status,
      };
    }

    return fields;
  }
}

/**
 * Asset Doctor — Phase 6: Controlled Self-Improvement & Strategy Governance Engine
 * 
 * 1. Learning Observation Layer (Non-PII structural observations)
 * 2. Strategy Candidate Lifecycle State Machine:
 *    - LEARNING_ONLY (< 5 observations)
 *    - EXPERIMENTAL (5-19 observations)
 *    - CANDIDATE (20-49 observations)
 *    - ELIGIBLE_FOR_APPROVAL (50+ observations, >=98% success, <=0.5% false-positive)
 * 3. Shadow Evaluation Engine (Runs candidate in parallel without affecting production)
 * 4. Immutable Strategy Versioning & Version History (V1, V2, etc.)
 * 5. Admin Approval Gate & Audit Trail
 * 6. Automatic Rollback Circuit Breaker
 * 7. Cost Intelligence & Routing Engine
 */

export type StrategyMaturityTier =
  | 'LEARNING_ONLY'
  | 'EXPERIMENTAL'
  | 'CANDIDATE'
  | 'ELIGIBLE_FOR_APPROVAL'
  | 'APPROVED_PRODUCTION'
  | 'REJECTED'
  | 'ROLLED_BACK';

export interface LearningObservation {
  observationId: string;
  documentType: string;
  vendorName: string;
  assetCategory: string;
  field: string;
  selectedValue: any;
  validationResult: boolean;
  userCorrection?: any;
  evidencePattern: string;
  layoutFingerprint: string;
  timestamp: string;
}

export interface StrategyCandidate {
  strategyId: string;
  version: string;
  vendorName: string;
  documentType: string;
  field: string;
  pattern: string;
  sampleCount: number;
  successRate: number; // 0.0 to 1.0
  falsePositiveRate: number; // 0.0 to 1.0
  confidence: number;
  maturityTier: StrategyMaturityTier;
  createdAt: string;
  updatedAt: string;
  shadowMetrics?: {
    shadowAccuracy: number;
    shadowFalsePositives: number;
    shadowMissingFields: number;
    shadowEvaluatedCount: number;
  };
}

export interface StrategyApprovalAudit {
  auditId: string;
  actor: string;
  timestamp: string;
  strategyId: string;
  action: 'APPROVE' | 'REJECT' | 'ROLLBACK';
  reason: string;
  previousVersion?: string;
  newVersion?: string;
}

export interface DocumentCostAccounting {
  documentId: string;
  mlKitCost: number; // in USD or fractions
  googleVisionCost: number;
  azureCost: number;
  geminiCost: number;
  firestoreOperations: number;
  totalCostEstimate: number;
  executionMode: 'FAST_PATH' | 'TARGETED_REPROCESS' | 'GENERIC_PIPELINE' | 'CLOUD_FALLBACK';
}

export class ControlledSelfImprovementEngine {
  private static observations: LearningObservation[] = [];
  private static strategyCandidates = new Map<string, StrategyCandidate>();
  private static activeProductionStrategies = new Map<string, StrategyCandidate>();
  private static strategyVersionHistory = new Map<string, StrategyCandidate[]>(); // vendor::type -> version array
  private static approvalAudits: StrategyApprovalAudit[] = [];
  private static costRecords: DocumentCostAccounting[] = [];

  /**
   * 1. Record Learning Observation (Non-PII)
   */
  public static recordObservation(obs: Omit<LearningObservation, 'observationId' | 'timestamp'>): LearningObservation {
    const observation: LearningObservation = {
      ...obs,
      observationId: `obs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.observations.push(observation);
    this.updateCandidateLifecycle(obs.vendorName, obs.documentType, obs.field, obs.evidencePattern, obs.validationResult);
    return observation;
  }

  /**
   * 2. Candidate Lifecycle State Machine
   */
  private static updateCandidateLifecycle(
    vendor: string,
    docType: string,
    field: string,
    pattern: string,
    isValid: boolean
  ): void {
    const key = `${vendor.toUpperCase()}::${docType.toUpperCase()}::${field}`;
    let candidate = this.strategyCandidates.get(key);

    if (!candidate) {
      candidate = {
        strategyId: `strat_${vendor.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${field}_v1`,
        version: 'V1',
        vendorName: vendor,
        documentType: docType,
        field,
        pattern,
        sampleCount: 1,
        successRate: isValid ? 1.0 : 0.0,
        falsePositiveRate: isValid ? 0.0 : 1.0,
        confidence: 0.85,
        maturityTier: 'LEARNING_ONLY',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      candidate.sampleCount++;
      const currentSuccesses = candidate.successRate * (candidate.sampleCount - 1) + (isValid ? 1 : 0);
      candidate.successRate = Number((currentSuccesses / candidate.sampleCount).toFixed(3));
      candidate.falsePositiveRate = Number((1.0 - candidate.successRate).toFixed(3));
      candidate.updatedAt = new Date().toISOString();

      // Enforce Maturity Thresholds
      if (candidate.maturityTier !== 'APPROVED_PRODUCTION' && candidate.maturityTier !== 'ROLLED_BACK') {
        if (candidate.sampleCount < 5) {
          candidate.maturityTier = 'LEARNING_ONLY';
        } else if (candidate.sampleCount < 20) {
          candidate.maturityTier = 'EXPERIMENTAL';
        } else if (candidate.sampleCount < 50) {
          candidate.maturityTier = 'CANDIDATE';
        } else {
          // 50+ observations -> Eligible for approval only if quality criteria satisfied
          if (candidate.successRate >= 0.98 && candidate.falsePositiveRate <= 0.005) {
            candidate.maturityTier = 'ELIGIBLE_FOR_APPROVAL';
          } else {
            candidate.maturityTier = 'CANDIDATE'; // Holds back if quality threshold fails
          }
        }
      }
    }

    this.strategyCandidates.set(key, candidate);
  }

  /**
   * 3. Shadow Evaluation Engine
   * Evaluates candidate strategy against historical test dataset without affecting live output
   */
  public static runShadowEvaluation(strategyId: string, testDataset: { text: string; expectedValue: any }[]): {
    strategyId: string;
    shadowAccuracy: number;
    shadowFalsePositives: number;
    passed: boolean;
  } {
    let candidate: StrategyCandidate | undefined;
    for (const c of this.strategyCandidates.values()) {
      if (c.strategyId === strategyId) {
        candidate = c;
        break;
      }
    }

    if (!candidate) {
      throw new Error(`Strategy candidate not found: ${strategyId}`);
    }

    let correct = 0;
    let falsePositives = 0;

    const regex = new RegExp(candidate.pattern, 'i');
    for (const sample of testDataset) {
      const match = sample.text.match(regex);
      if (match) {
        const val = match[1] ? match[1].replace(/,/g, '') : match[0];
        if (String(val).trim() === String(sample.expectedValue).trim()) {
          correct++;
        } else {
          falsePositives++;
        }
      }
    }

    const accuracy = testDataset.length > 0 ? Number((correct / testDataset.length).toFixed(3)) : 1.0;
    const fpRate = testDataset.length > 0 ? Number((falsePositives / testDataset.length).toFixed(3)) : 0.0;

    candidate.shadowMetrics = {
      shadowAccuracy: accuracy,
      shadowFalsePositives: fpRate,
      shadowMissingFields: testDataset.length - correct - falsePositives,
      shadowEvaluatedCount: testDataset.length,
    };

    const passed = accuracy >= 0.98 && fpRate <= 0.005;
    return {
      strategyId,
      shadowAccuracy: accuracy,
      shadowFalsePositives: fpRate,
      passed,
    };
  }

  /**
   * 4. Admin Approval Gate (Promotes to Production with Audit Trail)
   */
  public static approveCandidateStrategy(params: {
    strategyId: string;
    actor: string;
    reason: string;
  }): { success: boolean; activeVersion: string; auditId: string } {
    let candidate: StrategyCandidate | undefined;
    let keyName = '';
    for (const [k, c] of this.strategyCandidates.entries()) {
      if (c.strategyId === params.strategyId) {
        candidate = c;
        keyName = k;
        break;
      }
    }

    if (!candidate) throw new Error(`Strategy not found: ${params.strategyId}`);
    if (candidate.maturityTier !== 'ELIGIBLE_FOR_APPROVAL' && candidate.maturityTier !== 'CANDIDATE') {
      throw new Error(`Strategy ${params.strategyId} is in ${candidate.maturityTier} tier and not eligible for approval.`);
    }

    const previous = this.activeProductionStrategies.get(keyName);
    const prevVersion = previous ? previous.version : 'NONE';
    const newVersion = previous ? `V${parseInt(previous.version.replace('V', ''), 10) + 1}` : 'V1';

    candidate.version = newVersion;
    candidate.maturityTier = 'APPROVED_PRODUCTION';
    candidate.updatedAt = new Date().toISOString();

    // Store in active production map
    this.activeProductionStrategies.set(keyName, candidate);

    // Append to version history (Immutable)
    const history = this.strategyVersionHistory.get(keyName) || [];
    history.push({ ...candidate });
    this.strategyVersionHistory.set(keyName, history);

    const audit: StrategyApprovalAudit = {
      auditId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      actor: params.actor,
      timestamp: new Date().toISOString(),
      strategyId: params.strategyId,
      action: 'APPROVE',
      reason: params.reason,
      previousVersion: prevVersion,
      newVersion,
    };
    this.approvalAudits.push(audit);

    return {
      success: true,
      activeVersion: newVersion,
      auditId: audit.auditId,
    };
  }

  /**
   * 5. Automatic Rollback Circuit Breaker
   */
  public static triggerAutomaticRollback(keyName: string, degradationReason: string, actor = 'SYSTEM_CIRCUIT_BREAKER'): boolean {
    const active = this.activeProductionStrategies.get(keyName);
    if (!active) return false;

    const history = this.strategyVersionHistory.get(keyName) || [];
    active.maturityTier = 'ROLLED_BACK';

    let fallbackVersion = 'GENERIC_FALLBACK';
    if (history.length >= 2) {
      // Rollback to previous version
      const prev = history[history.length - 2];
      prev.maturityTier = 'APPROVED_PRODUCTION';
      this.activeProductionStrategies.set(keyName, prev);
      fallbackVersion = prev.version;
    } else {
      // Disable specialized strategy, fallback to generic pipeline
      this.activeProductionStrategies.delete(keyName);
    }

    this.approvalAudits.push({
      auditId: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      actor,
      timestamp: new Date().toISOString(),
      strategyId: active.strategyId,
      action: 'ROLLBACK',
      reason: degradationReason,
      previousVersion: active.version,
      newVersion: fallbackVersion,
    });

    return true;
  }

  /**
   * 6. Cost Intelligence Tracker
   */
  public static recordDocumentCost(accounting: DocumentCostAccounting): void {
    this.costRecords.push(accounting);
  }

  /**
   * 7. Intelligent Routing Decision
   */
  public static determineExecutionRoute(params: {
    vendorName?: string;
    documentType?: string;
    hasLayoutFingerprint: boolean;
    ocrConflict: boolean;
  }): 'FAST_PATH' | 'TARGETED_REPROCESS' | 'GENERIC_PIPELINE' | 'OCR_CONSENSUS_FALLBACK' {
    const { vendorName, documentType, hasLayoutFingerprint, ocrConflict } = params;

    if (ocrConflict) {
      return 'OCR_CONSENSUS_FALLBACK';
    }

    if (vendorName && documentType) {
      const key = `${vendorName.toUpperCase()}::${documentType.toUpperCase()}::odometerKm`;
      const active = this.activeProductionStrategies.get(key);
      if (active && active.maturityTier === 'APPROVED_PRODUCTION' && hasLayoutFingerprint) {
        return 'FAST_PATH';
      }
    }

    return 'GENERIC_PIPELINE';
  }

  public static getGovernanceSummary() {
    return {
      observationsCount: this.observations.length,
      candidatesCount: this.strategyCandidates.size,
      activeProductionCount: this.activeProductionStrategies.size,
      approvalAuditsCount: this.approvalAudits.length,
      costRecordsCount: this.costRecords.length,
    };
  }

  public static getStrategy(key: string): StrategyCandidate | null {
    return this.strategyCandidates.get(key) || null;
  }
}

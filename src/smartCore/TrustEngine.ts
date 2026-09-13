/**
 * Smart Core — Trust Engine
 *
 * Pillar 1: Zero Hallucination, Strict Field Provenance & Truthful State Evaluation.
 *
 * Rules:
 * 1. Every field carries an explicit provenance tag.
 * 2. Never invent synthetic defaults or placeholder dates/numbers (e.g., 2026-12-31, 15000 KM, 12 months).
 * 3. Incomplete or missing data must be reported truthfully as MISSING_DATA or UNKNOWN.
 * 4. Compliance records (insurance, PUC) missing from an asset evaluate to MISSING_DATA or AT_RISK, never HEALTHY.
 */

export type FieldProvenance =
  | 'EXTRACTED'
  | 'USER_ENTERED'
  | 'EXISTING_TRUSTED_DATA'
  | 'INFERRED'
  | 'UNKNOWN'
  | 'MISSING'
  | 'CONFLICTED';

export interface ProvenanceTaggedField<T = any> {
  value: T;
  provenance: FieldProvenance;
  confidence: number;
  sourceNote?: string;
}

export type AssetHealthStatus =
  | 'HEALTHY'
  | 'AT_RISK'
  | 'EXPIRED'
  | 'MISSING_DATA'
  | 'UNKNOWN';

export interface HealthEvaluationResult {
  status: AssetHealthStatus;
  score: number;
  grade: string;
  missingRequirements: string[];
  expiredItems: string[];
  atRiskItems: string[];
  truthfulSummary: string;
}

const SYNTHETIC_PATTERNS = [
  /^12\s*months?$/i,
  /^1y\s*1m$/i,
  /^15000\s*(km)?$/i,
  /^2026-12-31$/,
  /leave\s*blank\s*if\s*not\s*on\s*bill/i,
  /^sn-[a-z0-9]{4,10}$/i,
  /^test[\s_-]?asset/i,
  /^dummy/i,
];

export class TrustEngine {
  /**
   * Check if a raw value represents a synthetic placeholder or mock artifact.
   */
  public static isSyntheticOrPlaceholder(val: any): boolean {
    if (val === null || val === undefined) return false;
    const str = String(val).trim();
    if (!str) return false;
    return SYNTHETIC_PATTERNS.some((p) => p.test(str));
  }

  /**
   * Sanitize an incoming field value. If it matches synthetic placeholders,
   * returns null instead of passing synthetic data into the system.
   */
  public static sanitizeValue<T>(val: T): T | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string' && TrustEngine.isSyntheticOrPlaceholder(val)) {
      return null;
    }
    return val;
  }

  /**
   * Tag a value with explicit provenance.
   */
  public static tagField<T>(
    value: T,
    provenance: FieldProvenance,
    confidence: number = 1.0,
    sourceNote?: string,
  ): ProvenanceTaggedField<T> {
    const sanitized = TrustEngine.sanitizeValue(value);
    const effectiveProv =
      sanitized === null || sanitized === undefined
        ? 'MISSING'
        : provenance;

    return {
      value: sanitized as T,
      provenance: effectiveProv,
      confidence: effectiveProv === 'MISSING' ? 0 : Math.max(0, Math.min(1, confidence)),
      sourceNote,
    };
  }

  /**
   * Format display value truthfully. Never invents text.
   * If value is missing or empty, returns standard truthful display.
   */
  public static formatDisplayValue(
    value: any,
    emptyFallback: string = 'Not detected',
  ): string {
    const sanitized = TrustEngine.sanitizeValue(value);
    if (sanitized === null || sanitized === undefined || String(sanitized).trim() === '') {
      return emptyFallback;
    }
    return String(sanitized).trim();
  }

  /**
   * Truthful Asset Health Evaluation.
   * Never reports HEALTHY if mandatory compliance documents are missing.
   */
  public static evaluateAssetHealth(asset: any): HealthEvaluationResult {
    if (!asset || typeof asset !== 'object') {
      return {
        status: 'UNKNOWN',
        score: 0,
        grade: 'Unknown',
        missingRequirements: ['No asset data provided'],
        expiredItems: [],
        atRiskItems: [],
        truthfulSummary: 'Asset details are unavailable.',
      };
    }

    const missingRequirements: string[] = [];
    const expiredItems: string[] = [];
    const atRiskItems: string[] = [];

    const isVehicle =
      asset.categoryId === 'vehicles' ||
      asset.category === 'vehicle' ||
      asset.isVehicle ||
      Boolean(asset.registration || asset.registrationNumber || asset.chassisNumber);

    const now = new Date();
    const todayMs = now.getTime();

    const checkDate = (dateStr: string | null | undefined, label: string) => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      const target = new Date(dateStr);
      if (isNaN(target.getTime())) return null;
      const diffDays = Math.ceil((target.getTime() - todayMs) / (1000 * 60 * 60 * 24));
      return { diffDays, target };
    };

    // 1. Vehicle Compliance Checks
    if (isVehicle) {
      // Insurance
      const insExpiry = asset.insuranceExpiry || asset.policyExpiryDate;
      if (!insExpiry) {
        missingRequirements.push('Insurance policy missing');
      } else {
        const check = checkDate(insExpiry, 'Insurance');
        if (check) {
          if (check.diffDays < 0) {
            expiredItems.push(`Insurance expired ${Math.abs(check.diffDays)} day(s) ago`);
          } else if (check.diffDays <= 15) {
            atRiskItems.push(`Insurance expires in ${check.diffDays} day(s)`);
          }
        }
      }

      // PUC
      const pucExpiry = asset.pucExpiry || asset.validUntil;
      if (!pucExpiry) {
        missingRequirements.push('PUC certificate missing');
      } else {
        const check = checkDate(pucExpiry, 'PUC');
        if (check) {
          if (check.diffDays < 0) {
            expiredItems.push(`PUC expired ${Math.abs(check.diffDays)} day(s) ago`);
          } else if (check.diffDays <= 15) {
            atRiskItems.push(`PUC expires in ${check.diffDays} day(s)`);
          }
        }
      }

      // Essential Identity
      if (!asset.registration && !asset.registrationNumber && !asset.chassisNumber) {
        missingRequirements.push('Vehicle registration or chassis number missing');
      }
    } else {
      // General Appliance / Electronic checks
      if (!asset.serialNumber && !asset.imei && !asset.assetCode) {
        missingRequirements.push('Serial or identifier missing');
      }
      if (asset.warrantyExpiry) {
        const check = checkDate(asset.warrantyExpiry, 'Warranty');
        if (check) {
          if (check.diffDays < 0) {
            expiredItems.push(`Warranty expired ${Math.abs(check.diffDays)} day(s) ago`);
          } else if (check.diffDays <= 15) {
            atRiskItems.push(`Warranty expires in ${check.diffDays} day(s)`);
          }
        }
      }
    }

    // Determine Final Truthful Status
    let status: AssetHealthStatus = 'HEALTHY';
    let grade = 'Good';
    let score = 100;

    if (expiredItems.length > 0) {
      status = 'EXPIRED';
      grade = 'Critical';
      score = Math.max(10, 40 - expiredItems.length * 15);
    } else if (missingRequirements.length > 0) {
      status = 'MISSING_DATA';
      grade = 'Needs Attention';
      score = Math.max(30, 70 - missingRequirements.length * 15);
    } else if (atRiskItems.length > 0) {
      status = 'AT_RISK';
      grade = 'At Risk';
      score = Math.max(45, 65 - atRiskItems.length * 10);
    }

    let summary = 'Asset documentation is complete and up to date.';
    if (status === 'EXPIRED') {
      summary = `Critical: ${expiredItems.join(', ')}.`;
    } else if (status === 'MISSING_DATA') {
      summary = `Incomplete records: ${missingRequirements.join(', ')}.`;
    } else if (status === 'AT_RISK') {
      summary = `Attention required: ${atRiskItems.join(', ')}.`;
    }

    return {
      status,
      score,
      grade,
      missingRequirements,
      expiredItems,
      atRiskItems,
      truthfulSummary: summary,
    };
  }
}

/**
 * Asset Doctor — Universal Asset Health Engine
 * Versioned multi-factor scoring engine evaluating maintenance compliance, document vaulting, and age degradation.
 */

import { UniversalAssetModel } from '../core/universalAssetSchema';
import { assetModuleRegistry } from '../modules/moduleRegistry';

export interface HealthScoreResult {
  score: number; // 0 to 100
  status: 'OPTIMAL' | 'GOOD' | 'ATTENTION_REQUIRED' | 'CRITICAL';
  statusLabel: string;
  riskFactors: string[];
  positiveFactors: string[];
  recommendedActions: string[];
  modelVersion: string;
  evaluatedAt: string;
}

export class AssetHealthEngine {
  public static readonly HEALTH_MODEL_VERSION = '1.0';

  public static calculateHealth(asset: UniversalAssetModel): HealthScoreResult {
    let score = 100;
    const riskFactors: string[] = [];
    const positiveFactors: string[] = [];
    const recommendedActions: string[] = [];

    // 1. Warranty / Coverage Factor
    if (asset.warranty?.hasWarranty) {
      if (asset.warranty.warrantyStatus === 'ACTIVE') {
        positiveFactors.push('Active manufacturer warranty coverage in vault');
      } else if (asset.warranty.warrantyStatus === 'EXPIRING_SOON') {
        score -= 10;
        riskFactors.push('Warranty protection expiring within 30 days');
        recommendedActions.push('Review extended warranty options');
      } else if (asset.warranty.warrantyStatus === 'EXPIRED') {
        score -= 15;
        riskFactors.push('Warranty protection expired');
      }
    } else {
      score -= 10;
      riskFactors.push('No warranty document vaulted');
      recommendedActions.push('Upload original purchase invoice or warranty card');
    }

    // 2. Category-Specific Health Rules Evaluation
    const module = assetModuleRegistry.getModule(asset.category);
    for (const rule of module.healthRules) {
      try {
        const res = rule.condition(asset);
        score += res.impact;
        if (res.isRisk) {
          riskFactors.push(res.reason);
        } else {
          positiveFactors.push(res.reason);
        }
      } catch (e) {
        console.warn(`[HealthEngine] Error evaluating health rule ${rule.ruleId}:`, e);
      }
    }

    // 3. Document Completeness Factor
    if (asset.originalInvoiceNumber) {
      positiveFactors.push('Original tax invoice verified');
    }

    // Normalize bounds [10, 100]
    score = Math.max(10, Math.min(100, Math.round(score)));

    let status: HealthScoreResult['status'] = 'OPTIMAL';
    let statusLabel = 'Optimal & Protected';

    if (score < 50) {
      status = 'CRITICAL';
      statusLabel = 'Critical Attention Required';
    } else if (score < 75) {
      status = 'ATTENTION_REQUIRED';
      statusLabel = 'Moderate Attention Needed';
    } else if (score < 90) {
      status = 'GOOD';
      statusLabel = 'Good Operational Condition';
    }

    return {
      score,
      status,
      statusLabel,
      riskFactors,
      positiveFactors,
      recommendedActions,
      modelVersion: this.HEALTH_MODEL_VERSION,
      evaluatedAt: new Date().toISOString()
    };
  }
}

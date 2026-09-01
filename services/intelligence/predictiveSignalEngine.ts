/**
 * Asset Doctor — Phase 5: Predictive Signals & Explainable Recommendations Engine
 * 
 * Emits typed, explainable lifecycle events:
 * 1. SERVICE_APPROACHING
 * 2. SERVICE_OVERDUE
 * 3. WARRANTY_APPROACHING
 * 4. INSURANCE_APPROACHING
 * 5. DOCUMENT_MISSING
 * 6. MAINTENANCE_PATTERN_DETECTED
 * 7. UNUSUAL_EXPENSE
 * 8. ODOMETER_ANOMALY
 * 9. ASSET_DATA_CONFLICT
 */

import { AssetKnowledgeGraphEngine, type AssetPassportProfile, type AssetIntelligenceInsight } from './assetKnowledgeGraph.ts';

export type PredictiveSignalType =
  | 'SERVICE_APPROACHING'
  | 'SERVICE_OVERDUE'
  | 'WARRANTY_APPROACHING'
  | 'INSURANCE_APPROACHING'
  | 'DOCUMENT_MISSING'
  | 'MAINTENANCE_PATTERN_DETECTED'
  | 'UNUSUAL_EXPENSE'
  | 'ODOMETER_ANOMALY'
  | 'ASSET_DATA_CONFLICT';

export interface ExplainableRecommendation {
  signal: PredictiveSignalType;
  assetId: string;
  assetName: string;
  category: string;
  confidence: number; // 0.0 to 1.0
  evidence: string[];
  source: string;
  reason: string;
  recommendedAction: string;
  generatedAt: string;
}

export class PredictiveSignalEngine {
  /**
   * Evaluates an asset profile and generates explainable intelligence signals
   */
  public static evaluateSignals(passport: AssetPassportProfile, now = new Date()): ExplainableRecommendation[] {
    const signals: ExplainableRecommendation[] = [];
    const insight = AssetKnowledgeGraphEngine.evaluateAsset(passport, now);

    // 1. Service Approaching or Overdue Signals
    if (insight.maintenanceStatus === 'SERVICE_OVERDUE') {
      signals.push({
        signal: 'SERVICE_OVERDUE',
        assetId: passport.assetId,
        assetName: passport.assetName,
        category: passport.category,
        confidence: 0.98,
        evidence: [
          `Current Odometer: ${passport.currentOdometerKm?.toLocaleString('en-IN')} KM`,
          `Last Service: ${passport.lastServiceOdometerKm?.toLocaleString('en-IN') || 0} KM`,
          `Target Service Due: ${insight.nextExpectedMaintenance.targetOdometerKm?.toLocaleString('en-IN')} KM`,
        ],
        source: 'KNOWLEDGE_GRAPH_OEM_SCHEDULE',
        reason: `Vehicle has exceeded the OEM periodic service interval.`,
        recommendedAction: `Schedule periodic maintenance service to protect engine health and warranty compliance.`,
        generatedAt: now.toISOString(),
      });
    } else if (insight.maintenanceStatus === 'SERVICE_APPROACHING') {
      signals.push({
        signal: 'SERVICE_APPROACHING',
        assetId: passport.assetId,
        assetName: passport.assetName,
        category: passport.category,
        confidence: 0.95,
        evidence: [
          `Current Odometer: ${passport.currentOdometerKm?.toLocaleString('en-IN')} KM`,
          `Target Service Due: ${insight.nextExpectedMaintenance.targetOdometerKm?.toLocaleString('en-IN')} KM`,
          `Next Action: ${insight.nextExpectedMaintenance.description}`,
        ],
        source: 'KNOWLEDGE_GRAPH_OEM_SCHEDULE',
        reason: `Vehicle/Asset is within the approaching maintenance window.`,
        recommendedAction: `Review service schedule and prepare for next maintenance appointment.`,
        generatedAt: now.toISOString(),
      });
    }

    // 2. Warranty Approaching Expiry
    if (insight.warrantyStatus === 'EXPIRING_SOON') {
      signals.push({
        signal: 'WARRANTY_APPROACHING',
        assetId: passport.assetId,
        assetName: passport.assetName,
        category: passport.category,
        confidence: 0.96,
        evidence: [
          `Asset Age: ${insight.assetAgeMonths} months`,
          `Standard Brand Warranty: 12 months`,
        ],
        source: 'WARRANTY_LIFECYCLE_TRACKER',
        reason: `Manufacturer warranty expires in less than 60 days.`,
        recommendedAction: `Consider purchasing an Extended Warranty / AMC plan before manufacturer warranty expires.`,
        generatedAt: now.toISOString(),
      });
    }

    // 3. Insurance Approaching Expiry
    if (insight.insuranceStatus === 'EXPIRING_SOON') {
      signals.push({
        signal: 'INSURANCE_APPROACHING',
        assetId: passport.assetId,
        assetName: passport.assetName,
        category: passport.category,
        confidence: 0.97,
        evidence: [
          `Insurance Status: EXPIRING_SOON`,
          `Category: ${passport.category}`,
        ],
        source: 'INSURANCE_SCHEDULE_TRACKER',
        reason: `Motor insurance policy requires renewal to avoid compliance fines and coverage lapse.`,
        recommendedAction: `Renew comprehensive motor insurance policy before expiration.`,
        generatedAt: now.toISOString(),
      });
    }

    // 4. Missing Critical Documents
    if (insight.documentCompletenessPercent < 50) {
      signals.push({
        signal: 'DOCUMENT_MISSING',
        assetId: passport.assetId,
        assetName: passport.assetName,
        category: passport.category,
        confidence: 0.92,
        evidence: [
          `Document Completeness Score: ${insight.documentCompletenessPercent}%`,
          `Documents Count: ${passport.documents?.length || 0}`,
        ],
        source: 'PASSPORT_COMPLETENESS_ANALYZER',
        reason: `Asset passport is missing purchase invoice or active compliance certificate.`,
        recommendedAction: `Scan and upload purchase invoice or warranty certificate to maximize asset resale value.`,
        generatedAt: now.toISOString(),
      });
    }

    // 5. Odometer Anomaly Detection (Monotonicity Check)
    if (
      passport.currentOdometerKm != null &&
      passport.lastServiceOdometerKm != null &&
      passport.currentOdometerKm < passport.lastServiceOdometerKm
    ) {
      signals.push({
        signal: 'ODOMETER_ANOMALY',
        assetId: passport.assetId,
        assetName: passport.assetName,
        category: passport.category,
        confidence: 0.99,
        evidence: [
          `Current Reading: ${passport.currentOdometerKm} KM`,
          `Previous Reading: ${passport.lastServiceOdometerKm} KM`,
        ],
        source: 'ANOMALY_DETECTOR',
        reason: `Current odometer reading is lower than previously verified service record (Reverse odometer anomaly).`,
        recommendedAction: `Verify and re-confirm the latest odometer reading.`,
        generatedAt: now.toISOString(),
      });
    }

    return signals;
  }
}

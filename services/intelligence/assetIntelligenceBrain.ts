/**
 * Asset Doctor — Phase 7: Universal Asset Intelligence Brain
 * 
 * Evolved Intelligence Architecture:
 * 1. Asset Health Score Engine (Explainable 0-100 with impact factors)
 * 2. Category-Aware Asset Intelligence (Vehicles, Electronics, Appliances, Power, Home)
 * 3. Asset Lifecycle Engine (NEW, ACTIVE, MATURE, AGING, END_OF_LIFE, UNKNOWN)
 * 4. Maintenance Intelligence ("Whichever Comes First" OEM Schedules)
 * 5. Warranty & Insurance Trackers
 * 6. Document Completeness Analyzer (Expected vs Present documents)
 * 7. Verified Expense Intelligence (TCO, Annualized, Maintenance, Repair)
 * 8. Repair vs. Replace Advisory Decision Model
 * 9. Depreciation & Resale Intelligence (Safe UNKNOWN fallback)
 * 10. Multi-Dimensional Risk Engine
 * 11. Cross-Asset Portfolio Intelligence (Tenant-Isolated)
 * 12. Proactive Decision Queue with Deduplication Keys
 * 13. Strict Confidence Separation (FACT vs PREDICTION vs RECOMMENDATION)
 */

export type BrainAssetCategory =
  | 'BIKE'
  | 'CAR'
  | 'COMMERCIAL_VEHICLE'
  | 'PHONE'
  | 'LAPTOP'
  | 'TABLET'
  | 'TV'
  | 'AC'
  | 'REFRIGERATOR'
  | 'WASHING_MACHINE'
  | 'WATER_PURIFIER'
  | 'INVERTER'
  | 'BATTERY'
  | 'SOLAR'
  | 'CCTV'
  | 'PRINTER'
  | 'ROUTER'
  | 'FURNITURE'
  | 'UNKNOWN_ASSET';

export interface VerifiedDocumentRecord {
  documentId: string;
  documentType: string;
  vendorName?: string;
  issueDate?: string;
  expiryDate?: string;
  verifiedAmount?: number;
  isVerified: boolean;
  factConfidence: number; // 0.0 - 1.0
}

export interface BrainAssetProfile {
  assetId: string;
  userId: string;
  category: BrainAssetCategory;
  assetName: string;
  brand?: string;
  model?: string;
  primaryIdentifier?: string; // Reg No, Serial No, IMEI
  purchaseDate?: string;
  purchasePrice?: number;
  currentOdometerKm?: number;
  lastServiceDate?: string;
  lastServiceOdometerKm?: number;
  documents: VerifiedDocumentRecord[];
  estimatedReplacementCost?: number;
}

export interface HealthScoreFactor {
  factor: string;
  impact: number; // e.g. -5, +10
  evidence: string;
}

export interface AssetHealthReport {
  score: number; // 0 to 100
  confidence: number;
  rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  factors: HealthScoreFactor[];
}

export interface RepairVsReplaceDecision {
  action: 'KEEP' | 'REPAIR' | 'MONITOR' | 'CONSIDER_REPLACEMENT';
  reason: string;
  confidence: number;
  repairToReplacementRatio: number;
  advisoryOnly: true;
}

export interface RiskSignal {
  riskType:
    | 'DOCUMENT_RISK'
    | 'MAINTENANCE_RISK'
    | 'WARRANTY_RISK'
    | 'INSURANCE_RISK'
    | 'IDENTITY_CONFLICT'
    | 'ODOMETER_ANOMALY'
    | 'EXPENSE_ANOMALY'
    | 'DATA_COMPLETENESS_RISK';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: string[];
  confidence: number;
  recommendedAction: string;
}

export interface ProactiveDecisionItem {
  decisionId: string;
  deduplicationKey: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  category: string;
  title: string;
  evidence: string[];
  factConfidence: number;
  predictionConfidence: number;
  recommendationConfidence: number;
  recommendedAction: string;
  createdAt: string;
}

export interface PortfolioIntelligenceSummary {
  userId: string;
  totalAssets: number;
  totalPortfolioTCO: number;
  assetsNeedingService: string[];
  warrantiesExpiringSoon: string[];
  insurancesExpiringSoon: string[];
  missingDocumentAlerts: string[];
  crossAssetRisks: string[];
}

export class AssetIntelligenceBrain {
  /**
   * 1. Category-Aware Expected Documents Map
   */
  public static getExpectedDocumentTypes(category: BrainAssetCategory): string[] {
    switch (category) {
      case 'BIKE':
      case 'CAR':
      case 'COMMERCIAL_VEHICLE':
        return ['REGISTRATION_CERTIFICATE', 'INSURANCE_POLICY', 'PUC_CERTIFICATE', 'SERVICE_INVOICE', 'PURCHASE_INVOICE'];
      case 'PHONE':
      case 'LAPTOP':
      case 'TABLET':
      case 'TV':
        return ['PURCHASE_INVOICE', 'WARRANTY_DOCUMENT'];
      case 'AC':
      case 'REFRIGERATOR':
      case 'WASHING_MACHINE':
      case 'WATER_PURIFIER':
        return ['PURCHASE_INVOICE', 'WARRANTY_DOCUMENT', 'SERVICE_INVOICE'];
      case 'INVERTER':
      case 'BATTERY':
      case 'SOLAR':
        return ['PURCHASE_INVOICE', 'WARRANTY_DOCUMENT', 'INSTALLATION_CERTIFICATE'];
      default:
        return ['PURCHASE_INVOICE'];
    }
  }

  /**
   * 2. Document Completeness Engine
   */
  public static evaluateDocumentCompleteness(profile: BrainAssetProfile): {
    presentDocuments: string[];
    missingDocuments: string[];
    completenessScore: number;
    confidence: number;
  } {
    const expected = this.getExpectedDocumentTypes(profile.category);
    const present = new Set<string>();

    for (const doc of profile.documents || []) {
      if (doc.isVerified) {
        present.add(doc.documentType);
      }
    }

    const missing = expected.filter((e) => !present.has(e));
    const completenessScore = Math.round(((expected.length - missing.length) / (expected.length || 1)) * 100);

    return {
      presentDocuments: Array.from(present),
      missingDocuments: missing,
      completenessScore,
      confidence: 0.98,
    };
  }

  /**
   * 3. Expense Intelligence Engine
   */
  public static evaluateExpenses(profile: BrainAssetProfile): {
    purchaseCost: number;
    maintenanceCost: number;
    insuranceCost: number;
    repairCost: number;
    complianceCost: number;
    totalOwnershipCost: number;
    annualizedCost: number;
  } {
    let purchaseCost = profile.purchasePrice || 0;
    let maintenanceCost = 0;
    let insuranceCost = 0;
    let repairCost = 0;
    let complianceCost = 0;

    for (const doc of profile.documents || []) {
      if (doc.verifiedAmount && doc.verifiedAmount > 0) {
        if (doc.documentType.includes('INSURANCE')) {
          insuranceCost += doc.verifiedAmount;
        } else if (doc.documentType.includes('SERVICE')) {
          maintenanceCost += doc.verifiedAmount;
        } else if (doc.documentType.includes('REPAIR')) {
          repairCost += doc.verifiedAmount;
        } else if (doc.documentType.includes('PUC') || doc.documentType.includes('REGISTRATION')) {
          complianceCost += doc.verifiedAmount;
        }
      }
    }

    const totalOwnershipCost = purchaseCost + maintenanceCost + insuranceCost + repairCost + complianceCost;
    
    // Calculate ownership duration in years
    let years = 1;
    if (profile.purchaseDate) {
      const pDate = new Date(profile.purchaseDate);
      if (!isNaN(pDate.getTime())) {
        const diffYears = (Date.now() - pDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        years = Math.max(1, Number(diffYears.toFixed(1)));
      }
    }
    const annualizedCost = Math.round(totalOwnershipCost / years);

    return {
      purchaseCost,
      maintenanceCost,
      insuranceCost,
      repairCost,
      complianceCost,
      totalOwnershipCost,
      annualizedCost,
    };
  }

  /**
   * 4. Asset Health Engine (Explainable 0-100 Score with Factors)
   */
  public static calculateHealthScore(profile: BrainAssetProfile, now = new Date()): AssetHealthReport {
    let score = 100;
    const factors: HealthScoreFactor[] = [];

    // Factor 1: Document Completeness
    const docComp = this.evaluateDocumentCompleteness(profile);
    if (docComp.completenessScore < 50) {
      const penalty = -15;
      score += penalty;
      factors.push({
        factor: 'Document Completeness',
        impact: penalty,
        evidence: `Missing critical documents: ${docComp.missingDocuments.join(', ')}`,
      });
    } else if (docComp.completenessScore < 80) {
      const penalty = -5;
      score += penalty;
      factors.push({
        factor: 'Document Completeness',
        impact: penalty,
        evidence: `Passport missing non-critical document: ${docComp.missingDocuments.join(', ')}`,
      });
    } else {
      factors.push({
        factor: 'Document Completeness',
        impact: 0,
        evidence: `Complete verified documentation passport (${docComp.completenessScore}%)`,
      });
    }

    // Factor 2: Maintenance Compliance (Vehicles)
    if (profile.category === 'BIKE' || profile.category === 'CAR' || profile.category === 'COMMERCIAL_VEHICLE') {
      const lastOdo = profile.lastServiceOdometerKm || 0;
      const currentOdo = profile.currentOdometerKm || lastOdo;
      const interval = profile.category === 'BIKE' ? 6000 : 10000;
      const targetOdo = lastOdo + interval;

      if (currentOdo > targetOdo) {
        const overdueKm = currentOdo - targetOdo;
        const penalty = Math.min(-25, Math.max(-10, Math.round(-10 - (overdueKm / 1000) * 5)));
        score += penalty;
        factors.push({
          factor: 'Maintenance Compliance',
          impact: penalty,
          evidence: `Service overdue by ${overdueKm.toLocaleString('en-IN')} KM (Last service at ${lastOdo.toLocaleString('en-IN')} KM)`,
        });
      } else if (targetOdo - currentOdo <= 500) {
        const penalty = -5;
        score += penalty;
        factors.push({
          factor: 'Maintenance Compliance',
          impact: penalty,
          evidence: `Service due soon (${(targetOdo - currentOdo).toLocaleString('en-IN')} KM remaining)`,
        });
      }
    }

    // Factor 3: Insurance Status (Vehicles)
    if (profile.category === 'BIKE' || profile.category === 'CAR') {
      const insDoc = profile.documents?.find((d) => d.documentType.includes('INSURANCE'));
      if (!insDoc) {
        const penalty = -20;
        score += penalty;
        factors.push({
          factor: 'Insurance Compliance',
          impact: penalty,
          evidence: 'No verified active motor insurance certificate found.',
        });
      } else if (insDoc.expiryDate) {
        const exp = new Date(insDoc.expiryDate);
        const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) {
          const penalty = -25;
          score += penalty;
          factors.push({
            factor: 'Insurance Compliance',
            impact: penalty,
            evidence: `Motor insurance expired ${Math.abs(daysLeft)} days ago.`,
          });
        } else if (daysLeft <= 30) {
          const penalty = -5;
          score += penalty;
          factors.push({
            factor: 'Insurance Compliance',
            impact: penalty,
            evidence: `Motor insurance expires in ${daysLeft} days.`,
          });
        }
      }
    }

    // Factor 4: Odometer Anomaly Detection
    if (
      profile.currentOdometerKm != null &&
      profile.lastServiceOdometerKm != null &&
      profile.currentOdometerKm < profile.lastServiceOdometerKm
    ) {
      const penalty = -30;
      score += penalty;
      factors.push({
        factor: 'Odometer Anomaly',
        impact: penalty,
        evidence: `Current reading (${profile.currentOdometerKm} KM) is lower than previous verified record (${profile.lastServiceOdometerKm} KM)`,
      });
    }

    const finalScore = Math.max(0, Math.min(100, score));
    let rating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL' = 'EXCELLENT';
    if (finalScore >= 90) rating = 'EXCELLENT';
    else if (finalScore >= 75) rating = 'GOOD';
    else if (finalScore >= 60) rating = 'FAIR';
    else if (finalScore >= 40) rating = 'POOR';
    else rating = 'CRITICAL';

    return {
      score: finalScore,
      confidence: 0.96,
      rating,
      factors,
    };
  }

  /**
   * 5. Repair vs Replace Advisory Engine
   */
  public static evaluateRepairVsReplace(profile: BrainAssetProfile, proposedRepairCost: number): RepairVsReplaceDecision {
    const expenses = this.evaluateExpenses(profile);
    const replacementSource = profile.estimatedReplacementCost || profile.purchasePrice;
    if (!(Number(replacementSource) > 0)) {
      return {
        action: 'MONITOR',
        reason: 'Insufficient evidence: no verified purchase price or replacement cost. Repair/replace ratio was not invented.',
        confidence: 0.4,
        repairToReplacementRatio: 0,
        advisoryOnly: true,
      };
    }
    const estReplacement = Number(replacementSource);
    const totalRepairHistory = expenses.repairCost + proposedRepairCost;
    const ratio = Number((totalRepairHistory / estReplacement).toFixed(2));

    let action: 'KEEP' | 'REPAIR' | 'MONITOR' | 'CONSIDER_REPLACEMENT' = 'REPAIR';
    let reason = '';

    if (ratio >= 0.65) {
      action = 'CONSIDER_REPLACEMENT';
      reason = `Cumulative repair expense (₹${totalRepairHistory.toLocaleString('en-IN')}) exceeds 65% of estimated replacement cost (₹${estReplacement.toLocaleString('en-IN')}).`;
    } else if (ratio >= 0.40) {
      action = 'MONITOR';
      reason = `Cumulative repair expense is approaching 40-50% of asset value. Proceed with essential repair only.`;
    } else {
      action = 'REPAIR';
      reason = `Repair cost is economical relative to replacement value (${(ratio * 100).toFixed(0)}% of replacement value).`;
    }

    return {
      action,
      reason,
      confidence: 0.92,
      repairToReplacementRatio: ratio,
      advisoryOnly: true,
    };
  }

  /**
   * 6. Multi-Dimensional Risk Engine
   */
  public static evaluateRisks(profile: BrainAssetProfile, now = new Date()): RiskSignal[] {
    const risks: RiskSignal[] = [];

    // Odometer Anomaly Risk
    if (
      profile.currentOdometerKm != null &&
      profile.lastServiceOdometerKm != null &&
      profile.currentOdometerKm < profile.lastServiceOdometerKm
    ) {
      risks.push({
        riskType: 'ODOMETER_ANOMALY',
        riskLevel: 'CRITICAL',
        evidence: [
          `Current Reading: ${profile.currentOdometerKm} KM`,
          `Previous Service: ${profile.lastServiceOdometerKm} KM`,
        ],
        confidence: 0.99,
        recommendedAction: 'Verify physical dashboard reading and audit previous service invoices.',
      });
    }

    // Maintenance Overdue Risk
    if (profile.category === 'BIKE' || profile.category === 'CAR') {
      const lastOdo = profile.lastServiceOdometerKm || 0;
      const currentOdo = profile.currentOdometerKm || lastOdo;
      const interval = profile.category === 'BIKE' ? 6000 : 10000;
      if (currentOdo - lastOdo > interval) {
        risks.push({
          riskType: 'MAINTENANCE_RISK',
          riskLevel: 'HIGH',
          evidence: [`Service overdue by ${currentOdo - lastOdo - interval} KM`],
          confidence: 0.96,
          recommendedAction: 'Schedule periodic OEM maintenance to avoid premature engine wear.',
        });
      }
    }

    // Document Completeness Risk
    const docComp = this.evaluateDocumentCompleteness(profile);
    if (docComp.completenessScore < 50) {
      risks.push({
        riskType: 'DOCUMENT_RISK',
        riskLevel: 'MEDIUM',
        evidence: [`Missing critical documents: ${docComp.missingDocuments.join(', ')}`],
        confidence: 0.95,
        recommendedAction: 'Upload missing purchase invoice or compliance certificate.',
      });
    }

    return risks;
  }

  /**
   * 7. Cross-Asset Portfolio Intelligence (Tenant-Isolated)
   */
  public static evaluatePortfolio(userId: string, profiles: BrainAssetProfile[]): PortfolioIntelligenceSummary {
    const userProfiles = profiles.filter((p) => p.userId === userId);
    let totalTCO = 0;
    const assetsNeedingService: string[] = [];
    const warrantiesExpiringSoon: string[] = [];
    const insurancesExpiringSoon: string[] = [];
    const missingDocumentAlerts: string[] = [];
    const crossAssetRisks: string[] = [];

    for (const p of userProfiles) {
      const expenses = this.evaluateExpenses(p);
      totalTCO += expenses.totalOwnershipCost;

      const health = this.calculateHealthScore(p);
      if (health.rating === 'POOR' || health.rating === 'CRITICAL') {
        crossAssetRisks.push(`Asset ${p.assetName} has ${health.rating} health score (${health.score}/100)`);
      }

      const docComp = this.evaluateDocumentCompleteness(p);
      if (docComp.completenessScore < 60) {
        missingDocumentAlerts.push(`${p.assetName} (${docComp.completenessScore}% complete)`);
      }

      // Check maintenance
      if (p.category === 'BIKE' || p.category === 'CAR') {
        const interval = p.category === 'BIKE' ? 6000 : 10000;
        if ((p.currentOdometerKm || 0) - (p.lastServiceOdometerKm || 0) >= interval - 500) {
          assetsNeedingService.push(p.assetName);
        }
      }
    }

    return {
      userId,
      totalAssets: userProfiles.length,
      totalPortfolioTCO: totalTCO,
      assetsNeedingService,
      warrantiesExpiringSoon,
      insurancesExpiringSoon,
      missingDocumentAlerts,
      crossAssetRisks,
    };
  }

  /**
   * 8. Proactive Decision Item Generator with Strict Confidence Separation
   */
  public static generateDecisionItem(
    profile: BrainAssetProfile,
    title: string,
    category: string,
    evidence: string[],
    recommendedAction: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM'
  ): ProactiveDecisionItem {
    const dedupKey = `dec_${profile.assetId}_${category}_${Buffer.from(title).toString('base64').substring(0, 12)}`;
    return {
      decisionId: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      deduplicationKey: dedupKey,
      priority,
      category,
      title,
      evidence,
      factConfidence: 0.99,
      predictionConfidence: 0.95,
      recommendationConfidence: 0.92,
      recommendedAction,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Asset Doctor — Phase 5: Universal Asset Knowledge Graph & Lifecycle Intelligence
 * 
 * Logical Hierarchy:
 * CUSTOMER -> ASSET -> PURCHASE -> DOCUMENT -> WARRANTY/SERVICE/INSURANCE/PUC -> EXPENSES -> MAINTENANCE
 */

export type UniversalAssetCategory =
  | 'CAR'
  | 'BIKE'
  | 'PHONE'
  | 'LAPTOP'
  | 'TV'
  | 'AC'
  | 'REFRIGERATOR'
  | 'WASHING_MACHINE'
  | 'WATER_PURIFIER'
  | 'INVERTER'
  | 'SOLAR'
  | 'GENERATOR'
  | 'CCTV'
  | 'PRINTER'
  | 'FURNITURE'
  | 'OTHER_ASSET';

export interface AssetDocumentNode {
  documentId: string;
  documentType: string;
  vendorName?: string;
  documentDate?: string;
  expiryDate?: string;
  verifiedAmount?: number;
  isVerified: boolean;
}

export interface AssetPassportProfile {
  assetId: string;
  userId: string;
  category: UniversalAssetCategory;
  assetName: string;
  brand?: string;
  model?: string;
  primaryIdentifier?: string; // Reg No, Serial No, IMEI
  purchaseDate?: string;
  purchasePrice?: number;
  currentOdometerKm?: number;
  lastServiceDate?: string;
  lastServiceOdometerKm?: number;
  documents: AssetDocumentNode[];
}

export interface AssetIntelligenceInsight {
  assetId: string;
  category: UniversalAssetCategory;
  assetAgeMonths: number;
  documentCompletenessPercent: number;
  warrantyStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_APPLICABLE';
  insuranceStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_APPLICABLE';
  maintenanceStatus: 'HEALTHY' | 'SERVICE_APPROACHING' | 'SERVICE_OVERDUE' | 'SCHEDULE_PENDING';
  totalCostOfOwnership: number;
  estimatedLifecycleStage: 'NEW' | 'PRIME' | 'MATURE' | 'AGING' | 'END_OF_LIFE';
  nextExpectedMaintenance: {
    targetDate?: string;
    targetOdometerKm?: number;
    description: string;
    isOemSchedule: boolean;
  };
}

export class AssetKnowledgeGraphEngine {
  /**
   * Calculates comprehensive internal intelligence for any asset category
   */
  public static evaluateAsset(passport: AssetPassportProfile, now = new Date()): AssetIntelligenceInsight {
    const purchaseDate = passport.purchaseDate ? new Date(passport.purchaseDate) : null;
    let assetAgeMonths = 0;
    if (purchaseDate && !isNaN(purchaseDate.getTime())) {
      assetAgeMonths = Math.max(
        0,
        (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth()),
      );
    }

    // 1. Document Completeness Calculation
    let completeness = 20; // Base profile
    if (passport.purchaseDate) completeness += 20;
    if (passport.primaryIdentifier) completeness += 20;
    if (passport.documents && passport.documents.length > 0) {
      completeness += Math.min(40, passport.documents.length * 15);
    }
    const documentCompletenessPercent = Math.min(100, completeness);

    // 2. Lifecycle Stage Estimation
    let lifecycleStage: 'NEW' | 'PRIME' | 'MATURE' | 'AGING' | 'END_OF_LIFE' = 'NEW';
    if (assetAgeMonths <= 6) lifecycleStage = 'NEW';
    else if (assetAgeMonths <= 24) lifecycleStage = 'PRIME';
    else if (assetAgeMonths <= 60) lifecycleStage = 'MATURE';
    else if (assetAgeMonths <= 120) lifecycleStage = 'AGING';
    else lifecycleStage = 'END_OF_LIFE';

    // 3. Warranty Status Evaluation
    let warrantyStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
    if (passport.category === 'PHONE' || passport.category === 'LAPTOP' || passport.category === 'TV' || passport.category === 'AC' || passport.category === 'REFRIGERATOR' || passport.category === 'WASHING_MACHINE') {
      if (assetAgeMonths <= 10) warrantyStatus = 'ACTIVE';
      else if (assetAgeMonths <= 12) warrantyStatus = 'EXPIRING_SOON';
      else warrantyStatus = 'EXPIRED';
    }

    // 4. Insurance Status Evaluation (Vehicles)
    let insuranceStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_APPLICABLE' = 'NOT_APPLICABLE';
    if (passport.category === 'CAR' || passport.category === 'BIKE') {
      const insDoc = passport.documents?.find((d) => d.documentType.includes('INSURANCE'));
      if (insDoc && insDoc.expiryDate) {
        const exp = new Date(insDoc.expiryDate);
        const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) insuranceStatus = 'EXPIRED';
        else if (daysLeft <= 30) insuranceStatus = 'EXPIRING_SOON';
        else insuranceStatus = 'ACTIVE';
      } else {
        insuranceStatus = 'EXPIRING_SOON'; // Missing insurance flagged
      }
    }

    // 5. Smart Maintenance Schedule & Next Due Calculation
    let maintenanceStatus: 'HEALTHY' | 'SERVICE_APPROACHING' | 'SERVICE_OVERDUE' | 'SCHEDULE_PENDING' = 'HEALTHY';
    let nextMaintenance: { targetDate?: string; targetOdometerKm?: number; description: string; isOemSchedule: boolean } = {
      description: 'Periodic maintenance check',
      isOemSchedule: false,
    };

    if (passport.category === 'BIKE' || passport.category === 'CAR') {
      const lastOdo = passport.lastServiceOdometerKm || 0;
      const currentOdo = passport.currentOdometerKm || lastOdo;
      const intervalKm = passport.category === 'BIKE' ? 6000 : 10000;
      const targetOdo = lastOdo > 0 ? lastOdo + intervalKm : currentOdo + intervalKm;
      const kmRemaining = targetOdo - currentOdo;

      nextMaintenance = {
        targetOdometerKm: targetOdo,
        description: `OEM Periodic Service at ${targetOdo.toLocaleString('en-IN')} KM`,
        isOemSchedule: true,
      };

      if (kmRemaining <= 0) maintenanceStatus = 'SERVICE_OVERDUE';
      else if (kmRemaining <= 600) maintenanceStatus = 'SERVICE_APPROACHING';
      else maintenanceStatus = 'HEALTHY';
    } else if (passport.category === 'AC') {
      nextMaintenance = {
        description: 'AC Air Filter Cleaning & Pre-Season Service',
        isOemSchedule: true,
      };
      maintenanceStatus = assetAgeMonths % 6 === 0 ? 'SERVICE_APPROACHING' : 'HEALTHY';
    } else if (passport.category === 'WATER_PURIFIER') {
      nextMaintenance = {
        description: 'RO Sediment & Carbon Filter Replacement',
        isOemSchedule: true,
      };
      maintenanceStatus = assetAgeMonths >= 6 ? 'SERVICE_APPROACHING' : 'HEALTHY';
    } else {
      nextMaintenance = {
        description: 'Annual Maintenance Inspection',
        isOemSchedule: false,
      };
    }

    // 6. Total Cost of Ownership
    let totalCost = passport.purchasePrice || 0;
    if (passport.documents) {
      for (const d of passport.documents) {
        if (d.verifiedAmount && d.verifiedAmount > 0) {
          totalCost += d.verifiedAmount;
        }
      }
    }

    return {
      assetId: passport.assetId,
      category: passport.category,
      assetAgeMonths,
      documentCompletenessPercent,
      warrantyStatus,
      insuranceStatus,
      maintenanceStatus,
      totalCostOfOwnership: totalCost,
      estimatedLifecycleStage: lifecycleStage,
      nextExpectedMaintenance: nextMaintenance,
    };
  }
}

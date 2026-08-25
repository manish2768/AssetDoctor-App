/**
 * Asset Doctor — Universal Asset Timeline & Lifecycle Intelligence Engine
 * Computes category-aware lifecycle events, health deltas, unified expiry timelines, and lifecycle insights.
 */

import type { Asset, AssetCategory } from '../../types';

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'PURCHASE' | 'WARRANTY' | 'DOCUMENT' | 'MAINTENANCE' | 'SERVICE' | 'REPAIR' | 'HEALTH_CHANGE' | 'VALUATION' | 'LIFECYCLE';
  category: AssetCategory;
  urgency?: 'OVERDUE' | 'CRITICAL_7D' | 'WARNING_30D' | 'UPCOMING' | 'COMPLETED';
  isEstimated?: boolean;
  metadata?: Record<string, any>;
}

export interface HealthHistoryPoint {
  date: string;
  score: number;
  delta: number;
  reason: string;
}

export interface UpcomingExpiryItem {
  id: string;
  assetId: string;
  assetName: string;
  assetCategory: AssetCategory;
  eventType: 'WARRANTY_EXPIRY' | 'MAINTENANCE_DUE' | 'SERVICE_DUE' | 'INSURANCE_EXPIRY' | 'PUC_EXPIRY' | 'AMC_EXPIRY' | 'FILTER_CLEAN';
  eventLabel: string;
  dueDate: string;
  daysRemaining: number;
  urgency: 'OVERDUE' | 'CRITICAL_7D' | 'WARNING_30D' | 'UPCOMING';
  isVehicleOnly: boolean;
}

export interface LifecycleInsight {
  assetAgeYears: number;
  stage: 'BRAND_NEW' | 'EARLY_LIFE' | 'MID_LIFE' | 'MATURE' | 'REPLACEMENT_WINDOW';
  stageLabel: string;
  summary: string;
  actionRecommendation: string;
  isEstimated: true;
}

export class AssetTimelineEngine {
  /**
   * 1. Category Capability Rules: Strict gating against vehicle-only fields
   */
  public static isVehicleCategory(category: string): boolean {
    const c = (category || '').toLowerCase();
    return c.includes('veh') || c.includes('car') || c.includes('bike') || c.includes('scoot');
  }

  /**
   * 2. Generate Universal Category-Aware Lifecycle Timeline
   */
  public static generateAssetTimeline(asset: Asset): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    const isVehicle = this.isVehicleCategory(asset.category);

    // Event 1: Purchase / Onboarding
    if (asset.purchaseDate) {
      events.push({
        id: `ev_purch_${asset.id}`,
        date: asset.purchaseDate,
        title: 'Asset Acquired & Onboarded',
        description: `Acquired for ₹${(asset.price || 0).toLocaleString('en-IN')}. Initial setup registered in Asset Doctor Vault.`,
        type: 'PURCHASE',
        category: asset.category,
        urgency: 'COMPLETED'
      });
    }

    // Event 2: Warranty Start
    if (asset.purchaseDate && asset.warrantyMonths) {
      events.push({
        id: `ev_war_start_${asset.id}`,
        date: asset.purchaseDate,
        title: 'OEM Warranty Protection Active',
        description: `${asset.warrantyMonths}-month official manufacturer warranty coverage commenced.`,
        type: 'WARRANTY',
        category: asset.category,
        urgency: 'COMPLETED'
      });
    }

    // Event 3: Document Vault Registration
    if (asset.receiptImageUrl || asset.gstin) {
      events.push({
        id: `ev_doc_${asset.id}`,
        date: asset.purchaseDate || new Date().toISOString().split('T')[0],
        title: 'Tax Invoice & Ownership Document Vaulted',
        description: `Encrypted invoice stored. ${asset.gstin ? `Verified GSTIN: ${asset.gstin}` : 'Proof of purchase secured.'}`,
        type: 'DOCUMENT',
        category: asset.category,
        urgency: 'COMPLETED'
      });
    }

    // Event 4: Past Maintenance & Service Records
    if (asset.serviceLogs && asset.serviceLogs.length > 0) {
      asset.serviceLogs.forEach((log, idx) => {
        events.push({
          id: `ev_log_${log.id || idx}`,
          date: log.date,
          title: log.serviceType || 'Scheduled Upkeep',
          description: `${log.replacedParts ? `Parts replaced: ${log.replacedParts}. ` : ''}Cost: ₹${(log.cost || 0).toLocaleString('en-IN')}.`,
          type: 'SERVICE',
          category: asset.category,
          urgency: 'COMPLETED',
          metadata: { odometerKm: isVehicle ? log.odometerKm : undefined }
        });
      });
    }

    // Event 5: Vehicle Specific Records (GATED STRICTLY TO VEHICLES)
    if (isVehicle) {
      if (asset.insuranceExpiryDate) {
        const days = this.calculateDaysRemaining(asset.insuranceExpiryDate);
        events.push({
          id: `ev_ins_${asset.id}`,
          date: asset.insuranceExpiryDate,
          title: 'Motor Insurance Renewal',
          description: `Comprehensive vehicle insurance policy renewal.`,
          type: 'DOCUMENT',
          category: asset.category,
          urgency: days < 0 ? 'OVERDUE' : days <= 7 ? 'CRITICAL_7D' : days <= 30 ? 'WARNING_30D' : 'UPCOMING'
        });
      }

      if (asset.pucExpiryDate) {
        const days = this.calculateDaysRemaining(asset.pucExpiryDate);
        events.push({
          id: `ev_puc_${asset.id}`,
          date: asset.pucExpiryDate,
          title: 'Pollution Under Control (PUC) Expiry',
          description: `Mandatory statutory vehicular emission compliance.`,
          type: 'DOCUMENT',
          category: asset.category,
          urgency: days < 0 ? 'OVERDUE' : days <= 7 ? 'CRITICAL_7D' : days <= 30 ? 'WARNING_30D' : 'UPCOMING'
        });
      }
    }

    // Event 6: Non-Vehicle Specific (Appliances / HVAC filter upkeep)
    if (!isVehicle && (asset.category === 'Appliances' || (asset.name && asset.name.toLowerCase().includes('ac')))) {
      events.push({
        id: `ev_filter_${asset.id}`,
        date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        title: 'Air Filter Cleaning Recommended',
        description: 'Bi-monthly dust mesh wash to maintain cooling COP and prevent compressor strain.',
        type: 'MAINTENANCE',
        category: asset.category,
        urgency: 'WARNING_30D',
        isEstimated: true
      });
    }

    // Event 7: Upcoming Scheduled Maintenance
    if (asset.maintenanceDueDate) {
      const days = this.calculateDaysRemaining(asset.maintenanceDueDate);
      events.push({
        id: `ev_maint_due_${asset.id}`,
        date: asset.maintenanceDueDate,
        title: asset.maintenanceType ? `${asset.maintenanceType} Due` : 'Preventative Upkeep Due',
        description: `Scheduled maintenance check window.`,
        type: 'MAINTENANCE',
        category: asset.category,
        urgency: days < 0 ? 'OVERDUE' : days <= 7 ? 'CRITICAL_7D' : days <= 30 ? 'WARNING_30D' : 'UPCOMING'
      });
    }

    // Event 8: Warranty Expiration Window
    if (asset.expiryDate) {
      const days = this.calculateDaysRemaining(asset.expiryDate);
      events.push({
        id: `ev_war_exp_${asset.id}`,
        date: asset.expiryDate,
        title: days <= 0 ? 'Warranty Expired' : 'Warranty Expiration Date',
        description: days <= 0 ? 'Asset now operating out-of-warranty.' : `Standard warranty coverage concludes in ${days} days.`,
        type: 'WARRANTY',
        category: asset.category,
        urgency: days < 0 ? 'OVERDUE' : days <= 7 ? 'CRITICAL_7D' : days <= 30 ? 'WARNING_30D' : 'UPCOMING'
      });
    }

    // Sort chronologically (oldest to newest)
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return events;
  }

  /**
   * 3. Compute Asset Health Score History and Honest Deltas
   */
  public static computeHealthHistory(asset: Asset): HealthHistoryPoint[] {
    const history: HealthHistoryPoint[] = [];
    const now = new Date();

    if (!asset.purchaseDate) {
      return history;
    }

    const purchaseDate = new Date(asset.purchaseDate);
    const ageMonths = Math.max(1, Math.round((now.getTime() - purchaseDate.getTime()) / (30 * 86400000)));

    // Point 1: Baseline at acquisition
    history.push({
      date: asset.purchaseDate,
      score: 100,
      delta: 0,
      reason: 'Initial pristine benchmark score recorded at acquisition.'
    });

    // Point 2: 12-Month Aging Checkpoint (if older than 12 months)
    if (ageMonths >= 12) {
      const pointDate = new Date(purchaseDate.getTime() + 365 * 86400000).toISOString().split('T')[0];
      const hasRepairs = asset.serviceLogs && asset.serviceLogs.length > 0;
      const score = hasRepairs ? 92 : 88;
      history.push({
        date: pointDate,
        score,
        delta: score - 100,
        reason: hasRepairs
          ? 'Score calibrated: Regular maintenance logged offset 12-month calendar aging.'
          : 'Score calibrated: Standard 1-year calendar component aging applied.'
      });
    }

    // Point 3: Current State
    const currentScore = this.calculateCurrentHealthScore(asset);
    const lastPoint = history[history.length - 1];
    const delta = currentScore - lastPoint.score;

    let deltaReason = 'Health score stable based on active records.';
    if (delta < 0) {
      deltaReason = asset.status === 'expired'
        ? 'Score adjusted: Manufacturer warranty expired, shifting full component risk to owner.'
        : `Score adjusted due to ${ageMonths} months cumulative lifecycle aging.`;
    } else if (delta > 0) {
      deltaReason = 'Score increased due to verified maintenance documentation on file.';
    }

    history.push({
      date: now.toISOString().split('T')[0],
      score: currentScore,
      delta,
      reason: deltaReason
    });

    return history;
  }

  /**
   * 4. Unified Upcoming Expiry & Maintenance Timeline across ALL Assets
   */
  public static getUnifiedUpcomingTimeline(assets: Asset[]): UpcomingExpiryItem[] {
    const items: UpcomingExpiryItem[] = [];

    assets.forEach(asset => {
      const isVehicle = this.isVehicleCategory(asset.category);

      // 1. Warranty Expiry
      if (asset.expiryDate) {
        const days = this.calculateDaysRemaining(asset.expiryDate);
        items.push({
          id: `up_war_${asset.id}`,
          assetId: asset.id,
          assetName: asset.name,
          assetCategory: asset.category,
          eventType: 'WARRANTY_EXPIRY',
          eventLabel: 'Warranty Expiry',
          dueDate: asset.expiryDate,
          daysRemaining: days,
          urgency: days < 0 ? 'OVERDUE' : days <= 7 ? 'CRITICAL_7D' : days <= 30 ? 'WARNING_30D' : 'UPCOMING',
          isVehicleOnly: false
        });
      }

      // 2. Scheduled Maintenance
      if (asset.maintenanceDueDate) {
        const days = this.calculateDaysRemaining(asset.maintenanceDueDate);
        items.push({
          id: `up_maint_${asset.id}`,
          assetId: asset.id,
          assetName: asset.name,
          assetCategory: asset.category,
          eventType: 'MAINTENANCE_DUE',
          eventLabel: asset.maintenanceType || 'Scheduled Maintenance',
          dueDate: asset.maintenanceDueDate,
          daysRemaining: days,
          urgency: days < 0 ? 'OVERDUE' : days <= 7 ? 'CRITICAL_7D' : days <= 30 ? 'WARNING_30D' : 'UPCOMING',
          isVehicleOnly: false
        });
      }

      // 3. Vehicle Insurance (Gated)
      if (isVehicle && asset.insuranceExpiryDate) {
        const days = this.calculateDaysRemaining(asset.insuranceExpiryDate);
        items.push({
          id: `up_ins_${asset.id}`,
          assetId: asset.id,
          assetName: asset.name,
          assetCategory: asset.category,
          eventType: 'INSURANCE_EXPIRY',
          eventLabel: 'Motor Insurance Renewal',
          dueDate: asset.insuranceExpiryDate,
          daysRemaining: days,
          urgency: days < 0 ? 'OVERDUE' : days <= 7 ? 'CRITICAL_7D' : days <= 30 ? 'WARNING_30D' : 'UPCOMING',
          isVehicleOnly: true
        });
      }

      // 4. Vehicle PUC (Gated)
      if (isVehicle && asset.pucExpiryDate) {
        const days = this.calculateDaysRemaining(asset.pucExpiryDate);
        items.push({
          id: `up_puc_${asset.id}`,
          assetId: asset.id,
          assetName: asset.name,
          assetCategory: asset.category,
          eventType: 'PUC_EXPIRY',
          eventLabel: 'PUC Certificate Renewal',
          dueDate: asset.pucExpiryDate,
          daysRemaining: days,
          urgency: days < 0 ? 'OVERDUE' : days <= 7 ? 'CRITICAL_7D' : days <= 30 ? 'WARNING_30D' : 'UPCOMING',
          isVehicleOnly: true
        });
      }
    });

    // Sort strictly by urgency: OVERDUE -> CRITICAL_7D -> WARNING_30D -> UPCOMING (ascending by days remaining)
    items.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return items;
  }

  /**
   * 5. Generate Lifecycle Stage Insights
   */
  public static getLifecycleInsight(asset: Asset): LifecycleInsight {
    const now = new Date();
    const purchaseDate = asset.purchaseDate ? new Date(asset.purchaseDate) : now;
    const ageYears = Math.max(0.1, Number(((now.getTime() - purchaseDate.getTime()) / (365.25 * 86400000)).toFixed(1)));

    const expectedLifespans: Record<string, number> = {
      Vehicles: 12,
      Electronics: 5,
      Appliances: 9,
      Gadgets: 4,
      Home: 12,
      Other: 8
    };

    const maxLife = expectedLifespans[asset.category] || 8;
    const lifeRatio = ageYears / maxLife;

    let stage: LifecycleInsight['stage'] = 'BRAND_NEW';
    let stageLabel = 'Brand New';
    let summary = 'Asset is in its initial operational break-in period.';
    let actionRecommendation = 'Verify warranty registration and keep digital invoice vaulted.';

    if (lifeRatio >= 0.75) {
      stage = 'REPLACEMENT_WINDOW';
      stageLabel = 'Replacement Window';
      summary = `Asset has reached ${Math.round(lifeRatio * 100)}% of expected economic utility (${ageYears} of ${maxLife} yrs).`;
      actionRecommendation = 'Run a Repair vs Replace check before authorizing major component repairs.';
    } else if (lifeRatio >= 0.50) {
      stage = 'MATURE';
      stageLabel = 'Mature Stage';
      summary = `Asset is past half-life. Maintenance costs may begin outpacing residual equity.`;
      actionRecommendation = 'Adhere strictly to scheduled upkeep to maximize salvage valuation.';
    } else if (lifeRatio >= 0.25) {
      stage = 'MID_LIFE';
      stageLabel = 'Mid-Life Stage';
      summary = `Optimal operational phase with predictable operational expense.`;
      actionRecommendation = 'Ensure annual filter/oil renewals are recorded to preserve resale passport.';
    } else if (ageYears > 0.5) {
      stage = 'EARLY_LIFE';
      stageLabel = 'Early Life Stage';
      summary = `Hardware running smoothly within primary warranty window.`;
      actionRecommendation = 'Monitor warranty countdown and report any manufacturer defects.';
    }

    return {
      assetAgeYears: ageYears,
      stage,
      stageLabel,
      summary,
      actionRecommendation,
      isEstimated: true
    };
  }

  // Internal helper: Days remaining calculation
  private static calculateDaysRemaining(targetDate: string): number {
    try {
      const target = new Date(targetDate);
      const now = new Date();
      target.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  }

  // Internal helper: Quick deterministic health calculation
  private static calculateCurrentHealthScore(asset: Asset): number {
    let score = 85;
    if (asset.status === 'expired') score -= 15;
    if (asset.status === 'expiring_soon') score -= 5;
    if (asset.serviceLogs && asset.serviceLogs.length > 0) score += 10;
    return Math.max(10, Math.min(100, score));
  }
}
